-- =====================================================================
-- 24 — Problèmes de pratique par médecin et par unité (pour cibler l'accompagnement et la formation)
--   Studio : coller, Run. Rejouable. Prérequis : 08 (nettoyage) avec au moins un clean.fn_run sur la période voulue.
--   Puis, pour l'attente et les dossiers sans conclusion (lecture de la copie MediFus, une fois par période) :
--     select ana.fn_charger_complements('2026-07-14', '2026-08-13');
--
--   Indicateurs, par consultation sauf mention :
--     P01 durée très longue        P02 durée très courte (< 1 min)    P03 consultation laissée ouverte
--     P04 attente longue (admission → début de consultation, même patient, même unité, même jour)
--     P05 saisie hors horaires     P06 consultation un dimanche ou un jour férié
--     P07 modification tardive (plus de N jours après la création ; hors jours de mise à jour en masse par le système)    P08 dossier sans conclusion du généraliste
--     P09 doublon (même patient, même médecin, même jour)             P10 journée surchargée (plus de N consultations)
--     P11 ouverture tardive (1re consultation après HH h, par jour)   P12 fin précoce (dernière avant HH h, par jour)
--     P13 saisie hors ligne (information : souvent la connexion, pas le médecin)
--   Un PROBLÈME est signalé quand l'indicateur atteint au moins 2 fois la médiane du réseau ET le seuil minimal.
--   Seuils modifiables dans ana.seuil_pratique. Groupes de moins de 10 consultations exclus.
--   Nom du médecin : initiales seulement (« Dr A. B. »), le tableau de bord ne les montre qu'au profil direction.
--   API : ui_stats_formation (clé anon + jeton).
-- =====================================================================
create schema if not exists ana;

create table if not exists ana.seuil_pratique (code text primary key, valeur numeric not null, libelle text not null);
insert into ana.seuil_pratique (code, valeur, libelle) values
 ('duree_longue_min', 60, 'Durée très longue : plus de N minutes'),
 ('ouverte_heures', 4, 'Consultation laissée ouverte : clôturée plus de N heures après le début, un autre jour, ou jamais'),
 ('attente_longue_min', 120, 'Attente longue : plus de N minutes entre l''admission et le début de la consultation'),
 ('heure_debut', 7, 'Horaires : début de journée (heure du Maroc)'),
 ('heure_fin', 20, 'Horaires : fin de journée (heure du Maroc)'),
 ('modif_tardive_jours', 3, 'Modification tardive : plus de N jours après la création'),
 ('charge_max_jour', 80, 'Journée surchargée : plus de N consultations pour un médecin'),
 ('ouverture_tardive_h', 10, 'Ouverture tardive : première consultation après N h'),
 ('fin_precoce_h', 13, 'Fin précoce : dernière consultation avant N h'),
 ('seuil_min_pct', 5, 'Part minimale (%) pour signaler un problème'),
 ('facteur_mediane', 2, 'Signaler quand la part atteint N fois la médiane du réseau')
on conflict (code) do nothing;

-- Compléments lus dans la copie MediFus : attente estimée et conclusion du généraliste
create table if not exists ana.consultation_complement (
  consultation_id int primary key, attente_min numeric, sans_conclusion boolean, charge_le timestamptz default now());

create or replace function ana.fn_charger_complements(p_du date, p_au date)
returns jsonb language plpgsql set search_path = ana, clean, public, pg_temp as $$
declare t0 timestamptz := clock_timestamp(); v_n int; v_att int; v_conc int;
begin
  if p_au - p_du > 62 then raise exception 'période limitée à 62 jours par appel'; end if;
  insert into ana.consultation_complement (consultation_id)
  select s.consultation_id from clean.stg_consultation s where s.day_src between p_du and p_au
  on conflict (consultation_id) do nothing;
  -- attente : admission du même patient, même unité, même jour, la plus proche AVANT le début de la consultation
  with adm as materialized (   -- lu une seule fois dans la copie
    select a."patientId"::text as pid, a."centerId" as centre_id, a.created_at as ts
    from medifus_src.admissions a
    where a.deleted_at = 'null' and a.created_at >= p_du - 1 and a.created_at < p_au + 2),
  w as (
    select s.consultation_id,
           extract(epoch from coalesce(s.start_ts, s.created_at) - max(adm.ts)) / 60 as att
    from clean.stg_consultation s
    join adm on adm.pid = s.patient_id::text and adm.centre_id = s.centre_id_src
            and adm.ts::date = s.day_src and adm.ts <= coalesce(s.start_ts, s.created_at)
    where s.day_src between p_du and p_au
    group by s.consultation_id, s.start_ts, s.created_at)
  update ana.consultation_complement c set attente_min = round(w.att::numeric, 1), charge_le = now()
  from w where w.consultation_id = c.consultation_id and w.att between 0 and 600;
  get diagnostics v_att = row_count;
  -- conclusion du généraliste (spécialité 1) absente ou vide
  with cd as materialized (
    select cd."consultationId" as cid, bool_and(coalesce(trim(cd.conclusion::text), '') in ('', 'null')) as vide
    from medifus_src.consultations_doctors cd join medifus_src.doctors d on d.id = cd."doctorId"
    where cd.deleted_at = 'null' and d."specialityId" = 1
      and cd.created_at >= p_du - 1 and cd.created_at < p_au + 2
    group by 1)
  update ana.consultation_complement c set sans_conclusion = cd.vide
  from cd where cd.cid = c.consultation_id;
  get diagnostics v_conc = row_count;
  select count(*) into v_n from ana.consultation_complement c join clean.stg_consultation s using (consultation_id)
  where s.day_src between p_du and p_au;
  return jsonb_build_object('du', p_du, 'au', p_au, 'consultations', v_n, 'attentes_mesurees', v_att,
                            'conclusions_lues', v_conc, 'duree_ms', (extract(epoch from clock_timestamp() - t0) * 1000)::int);
end $$;

-- Initiales d'un médecin depuis la copie MediFus (si les colonnes de nom existent), sinon « Médecin n° id »
create or replace function ana.fn_nom_medecin(p_id int) returns text
language plpgsql stable set search_path = ana, public as $$
declare j jsonb; v_prenom text; v_nom text;
begin
  if p_id is null then return null; end if;
  begin
    execute 'select to_jsonb(d) from medifus_src.doctors d where d.id = $1' into j using p_id;
    if j ? 'userId' and coalesce(j->>'firstName', j->>'first_name', j->>'lastName', j->>'last_name') is null then
      execute 'select to_jsonb(u) from medifus_src.users u where u.id::text = $1' into j using j->>'userId';
    end if;
    v_prenom := coalesce(j->>'firstName', j->>'first_name', j->>'firstname', j->>'prenom');
    v_nom := coalesce(j->>'lastName', j->>'last_name', j->>'lastname', j->>'nom');
  exception when others then return 'Médecin n° ' || p_id;
  end;
  if coalesce(v_prenom, v_nom) is null then return 'Médecin n° ' || p_id; end if;
  return 'Dr ' || coalesce(upper(left(v_prenom, 1)) || '. ', '') || coalesce(upper(left(v_nom, 1)) || '.', '') || ' (n° ' || p_id || ')';
end $$;

create or replace function ana.fn_s(p_code text) returns numeric language sql stable as $$
  select valeur from ana.seuil_pratique where code = p_code $$;

create or replace function public.ui_stats_formation(p_token text, p_du date, p_au date, p_groupe text default 'medecin')
returns jsonb language plpgsql security definer set search_path = ana, clean, sup, public, pg_temp set client_min_messages = warning as $$
declare fer date[] := array(select distinct k.day from sup.ref_calendar k where k.scope = 'national' and k.kind in ('holiday','religious'));
        -- jours de mise à jour en masse (système, migration, export) : au moins 100 dossiers modifiés tardivement le même jour
        masse date[] := array(select z.d from (select s.updated_at::date as d from clean.stg_consultation s
                                               where s.updated_at > s.created_at + make_interval(days => ana.fn_s('modif_tardive_jours')::int)
                                               group by 1 having count(*) >= 100) z);
begin
  perform sup.api_check(p_token);
  if p_groupe not in ('medecin', 'centre') then raise exception 'p_groupe : medecin ou centre'; end if;

  -- une ligne par consultation valide, heures en heure du Maroc
  drop table if exists t24c;
  create temp table t24c on commit drop as
  select cc.consultation_id, cc.centre_id, cc.day, s.gp_doctor_id as medecin_id, s.patient_id,
         case when p_groupe = 'medecin' then s.gp_doctor_id else cc.centre_id end as groupe_id,
         (coalesce(s.start_ts, s.created_at) at time zone 'UTC') at time zone 'Africa/Casablanca' as debut_local,
         (s.created_at at time zone 'UTC') at time zone 'Africa/Casablanca' as cree_local,
         cc.duration_min, s.start_ts, s.end_ts, s.created_at, s.updated_at, cc.is_offline, cc.flags,
         x.attente_min, x.sans_conclusion
  from clean.consultation_clean cc
  join clean.stg_consultation s using (consultation_id)
  left join ana.consultation_complement x using (consultation_id)
  where cc.is_valid and cc.day between p_du and p_au and (p_groupe = 'centre' or s.gp_doctor_id is not null);

  -- indicateurs par consultation
  drop table if exists t24i;
  create temp table t24i on commit drop as
  with j as (   -- journées du médecin (ou de l'unité) : charge, première et dernière consultation
    select groupe_id, day, count(*) as n_jour, min(debut_local) as premiere, max(debut_local) as derniere
    from t24c group by 1, 2),
  dbl as (
    select consultation_id from (
      select consultation_id, row_number() over (partition by medecin_id, patient_id, day order by created_at) as rg from t24c
      where patient_id is not null and medecin_id is not null) z where rg > 1)
  select c.groupe_id, c.consultation_id, c.day,
    (c.duration_min > ana.fn_s('duree_longue_min')) as p01,
    ('D02_DUREE_COURTE' = any(c.flags) or c.duration_min < 1) as p02,
    (c.start_ts is not null and (c.end_ts is null or c.end_ts > c.start_ts + make_interval(hours => ana.fn_s('ouverte_heures')::int)
                                 or c.end_ts::date > c.start_ts::date)) as p03,
    case when c.attente_min is not null then c.attente_min > ana.fn_s('attente_longue_min') end as p04,
    (extract(hour from c.cree_local) < ana.fn_s('heure_debut') or extract(hour from c.cree_local) >= ana.fn_s('heure_fin')) as p05,
    (extract(isodow from c.day) = 7 or c.day = any(fer)) as p06,
    (c.updated_at > c.created_at + make_interval(days => ana.fn_s('modif_tardive_jours')::int) and c.updated_at::date <> all(masse)) as p07,
    c.sans_conclusion as p08,
    (c.consultation_id in (select consultation_id from dbl)) as p09,
    (j.n_jour > ana.fn_s('charge_max_jour')) as p10,
    coalesce(c.is_offline, false) as p13,
    c.duration_min, c.attente_min
  from t24c c join j using (groupe_id, day);

  drop table if exists t24g;
  create temp table t24g on commit drop as
  with jours as (
    select groupe_id, count(*) as jours_actifs,
           count(*) filter (where extract(isodow from day) between 1 and 6
                              and extract(hour from premiere) * 60 + extract(minute from premiere) > ana.fn_s('ouverture_tardive_h') * 60) as p11,
           count(*) filter (where extract(isodow from day) between 1 and 6 and n_jour >= 5
                              and extract(hour from derniere) < ana.fn_s('fin_precoce_h')) as p12
    from (select groupe_id, day, count(*) as n_jour, min(debut_local) as premiere, max(debut_local) as derniere from t24c group by 1, 2) d
    group by 1)
  select i.groupe_id, count(*) as consultations, max(jr.jours_actifs) as jours_actifs,
         round(count(*)::numeric / greatest(max(jr.jours_actifs), 1), 1) as par_jour,
         round(percentile_cont(0.5) within group (order by i.duration_min)::numeric, 1) as duree_mediane_min,
         round(percentile_cont(0.5) within group (order by i.attente_min)::numeric, 0) as attente_mediane_min,
         count(i.attente_min) as n_attentes, count(i.p08) as n_conclusions,
         jsonb_build_object(
           'P01', round(100.0 * count(*) filter (where i.p01) / count(*), 1),
           'P02', round(100.0 * count(*) filter (where i.p02) / count(*), 1),
           'P03', round(100.0 * count(*) filter (where i.p03) / count(*), 1),
           'P04', round(100.0 * count(*) filter (where i.p04) / nullif(count(i.p04), 0), 1),
           'P05', round(100.0 * count(*) filter (where i.p05) / count(*), 1),
           'P06', round(100.0 * count(*) filter (where i.p06) / count(*), 1),
           'P07', round(100.0 * count(*) filter (where i.p07) / count(*), 1),
           'P08', round(100.0 * count(*) filter (where i.p08) / nullif(count(i.p08), 0), 1),
           'P09', round(100.0 * count(*) filter (where i.p09) / count(*), 1),
           'P10', round(100.0 * count(*) filter (where i.p10) / count(*), 1),
           'P11', round(100.0 * max(jr.p11) / greatest(max(jr.jours_actifs), 1), 1),
           'P12', round(100.0 * max(jr.p12) / greatest(max(jr.jours_actifs), 1), 1),
           'P13', round(100.0 * count(*) filter (where i.p13) / count(*), 1)) as pct,
         jsonb_build_object(
           'P01', count(*) filter (where i.p01), 'P02', count(*) filter (where i.p02), 'P03', count(*) filter (where i.p03),
           'P04', count(*) filter (where i.p04), 'P05', count(*) filter (where i.p05), 'P06', count(*) filter (where i.p06),
           'P07', count(*) filter (where i.p07), 'P08', count(*) filter (where i.p08), 'P09', count(*) filter (where i.p09),
           'P10', count(*) filter (where i.p10), 'P11', max(jr.p11), 'P12', max(jr.p12), 'P13', count(*) filter (where i.p13)) as n,
         (select mode() within group (order by c2.centre_id) from t24c c2 where c2.groupe_id = i.groupe_id) as centre_principal
  from t24i i join jours jr using (groupe_id)
  group by i.groupe_id
  having count(*) >= 10;

  return (
    with def(code, libelle, famille, base, ordre) as (values
      ('P01', 'Consultation très longue (plus de ' || ana.fn_s('duree_longue_min') || ' min)', 'Durée', 'consultations', 1),
      ('P02', 'Dossier ouvert et clôturé en moins d''une minute', 'Durée', 'consultations', 2),
      ('P03', 'Consultation laissée ouverte (clôturée tard, un autre jour ou jamais)', 'Durée', 'consultations', 3),
      ('P04', 'Attente longue (plus de ' || ana.fn_s('attente_longue_min') || ' min après l''admission)', 'Attente', 'attentes mesurées', 4),
      ('P05', 'Saisie hors horaires (avant ' || ana.fn_s('heure_debut') || ' h ou après ' || ana.fn_s('heure_fin') || ' h)', 'Horaires', 'consultations', 5),
      ('P06', 'Consultation un dimanche ou un jour férié', 'Horaires', 'consultations', 6),
      ('P11', 'Ouverture tardive (1re consultation après ' || ana.fn_s('ouverture_tardive_h') || ' h)', 'Horaires', 'jours', 7),
      ('P12', 'Fin précoce (dernière consultation avant ' || ana.fn_s('fin_precoce_h') || ' h)', 'Horaires', 'jours', 8),
      ('P07', 'Dossier modifié plus de ' || ana.fn_s('modif_tardive_jours') || ' jours après la consultation', 'Tenue du dossier', 'consultations', 9),
      ('P08', 'Dossier sans conclusion du généraliste', 'Tenue du dossier', 'consultations lues', 10),
      ('P09', 'Doublon (même patient, même médecin, même jour)', 'Tenue du dossier', 'consultations', 11),
      ('P10', 'Journée surchargée (plus de ' || ana.fn_s('charge_max_jour') || ' consultations)', 'Charge', 'consultations', 12),
      ('P13', 'Saisie hors ligne (souvent la connexion)', 'Information', 'consultations', 13)),
    med as (
      select d.code, percentile_cont(0.5) within group (order by (g.pct ->> d.code)::numeric) as m
      from def d cross join t24g g where g.pct ->> d.code is not null group by d.code),
    ind as (
      select g.groupe_id, d.ordre,
             jsonb_build_object('code', d.code, 'libelle', d.libelle, 'famille', d.famille, 'base', d.base,
                                'n', (g.n ->> d.code)::int, 'pct', (g.pct ->> d.code)::numeric,
                                'mediane_reseau_pct', round(m.m::numeric, 1),
                                'alerte', d.code <> 'P13' and (g.pct ->> d.code)::numeric >= greatest(ana.fn_s('facteur_mediane') * coalesce(m.m, 0), ana.fn_s('seuil_min_pct'))
                                          and coalesce((g.n ->> d.code)::int, 0) >= 3) as j
      from t24g g cross join def d left join med m using (code))
    select coalesce(jsonb_agg(x order by jsonb_array_length(x->'problemes') desc, (x->>'consultations')::int desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'groupe_id', g.groupe_id,
        'groupe_nom', case when p_groupe = 'medecin' then ana.fn_nom_medecin(g.groupe_id) else r.centre_name end,
        'centre_name', r.centre_name, 'region', r.region, 'province', r.province,
        'consultations', g.consultations, 'jours_actifs', g.jours_actifs, 'consultations_par_jour', g.par_jour,
        'duree_mediane_min', g.duree_mediane_min, 'attente_mediane_min', g.attente_mediane_min,
        'attentes_mesurees', g.n_attentes,
        'indicateurs', (select jsonb_agg(i.j order by i.ordre) from ind i where i.groupe_id = g.groupe_id),
        'problemes', coalesce((select jsonb_agg(i.j ->> 'libelle' order by (i.j ->> 'pct')::numeric / greatest((i.j ->> 'mediane_reseau_pct')::numeric, 0.1) desc)
                               from ind i where i.groupe_id = g.groupe_id and (i.j ->> 'alerte')::boolean), '[]'::jsonb)) as x
      from t24g g left join sup.ref_centre r on r.centre_id = g.centre_principal) z);
end $$;
revoke all on function public.ui_stats_formation(text, date, date, text) from public, authenticated;
grant execute on function public.ui_stats_formation(text, date, date, text) to anon, service_role;
revoke all on all functions in schema ana from public, anon, authenticated;
revoke all on all tables in schema ana from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'problèmes de pratique installés' as statut,
       (select count(*) from clean.consultation_clean where is_valid) as consultations_nettoyees,
       (select min(day) || ' → ' || max(day) from clean.consultation_clean where is_valid) as periode_disponible,
       (select count(attente_min) from ana.consultation_complement) as attentes_mesurees;
