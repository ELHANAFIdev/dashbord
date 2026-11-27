-- =====================================================================
-- 20 — Jours anormaux par unité, catalogue des causes, enquêtes, liens avec les facteurs
--   Schéma ana (analyses). Studio : coller, Run. Rejouable. Aucune donnée patient (comptes par unité et par jour).
--   Prérequis : 01–17 et 19 (sup.agg_centre_day, sup.ref_centre, sup.ref_calendar, ctx.*), météo chargée.
--   Ensuite : select ana.fn_detecter('2023-10-19', '2026-08-13');   (≈ 10 à 60 s)
--             select ana.fn_calculer_effets();                         (effets des facteurs, ≈ 10 à 60 s)
--   API : ui_anomalies, ui_anomalie_enquete, ui_causes, ui_facteurs (clé anon + jeton, comme 06b).
-- =====================================================================
create schema if not exists ana;
revoke all on schema ana from public;

-- 1. Catalogue des causes (référence commune : CATALOGUE_CAUSES_VARIATION_FLUX.md) ----------------
create table if not exists ana.cause (
  code text primary key, famille text not null, libelle text not null,
  effet text not null, portee text not null, donnees text not null, detection_auto boolean not null default false);

insert into ana.cause (code, famille, libelle, effet, portee, donnees, detection_auto) values
 ('1.1','Calendrier','Jour férié civil','baisse à 0','national','base',true),
 ('1.2','Calendrier','Fête religieuse ou sa veille','baisse à 0 ; veille partielle','national','base',true),
 ('1.3','Calendrier','Ramadan','baisse modérée','national','base',true),
 ('1.4','Calendrier','Lendemain de fête, pont (rattrapage)','baisse ou hausse','national','base',true),
 ('1.5','Calendrier','Jour du souk hebdomadaire','hausse au souk, baisse autour','unité','base',true),
 ('1.6','Calendrier','Moussem, fête locale, saison des mariages','variable','unité / province','terrain',false),
 ('1.7','Calendrier','Vacances scolaires','variable','national','calendrier',true),
 ('1.8','Calendrier','Rentrée scolaire, examens (certificats)','hausse','national','calendrier',false),
 ('1.9','Calendrier','Retour des Marocains résidant à l''étranger (été)','hausse','province','calendrier',true),
 ('1.10','Calendrier','Fin de mois, versement des aides sociales','variable','national','base',true),
 ('1.11','Calendrier','Jour de la semaine','variable','unité','base',true),
 ('2.1','Environnement','Neige, routes coupées','baisse forte','province','météo',true),
 ('2.2','Environnement','Fortes pluies, crues','baisse forte','province','météo',true),
 ('2.3','Environnement','Chaleur extrême','baisse','province','météo',true),
 ('2.4','Environnement','Vent fort, tempête de sable','baisse','province','météo',true),
 ('2.5','Environnement','Froid intense','variable','province','météo',true),
 ('2.7','Environnement','Piste impraticable, transport suspendu','baisse','unité','terrain',false),
 ('2.8','Environnement','Éloignement de la population, douars dispersés','niveau bas permanent','unité','population',true),
 ('3.1','Santé de la population','Saison des infections respiratoires','hausse','national','base',false),
 ('3.3','Santé de la population','Épidémie locale','hausse','unité / province','diagnostics',false),
 ('3.5','Santé de la population','Campagne de vaccination','hausse des actes','unité / province','base',false),
 ('3.6','Santé de la population','Campagne de dépistage','hausse','national / province','base',false),
 ('4.1','Offre de soins','Médecin absent (congé, maladie, formation)','baisse à 0 ou forte','unité','base',true),
 ('4.2','Offre de soins','Infirmier ou agent d''accueil absent','baisse des admissions','unité','base',true),
 ('4.3','Offre de soins','Spécialiste indisponible','baisse des télé-expertises','unité / national','base',false),
 ('4.4','Offre de soins','Panne de connexion (satellite, 4G)','hausse du hors ligne','unité','base',true),
 ('4.5','Offre de soins','Panne de matériel ou d''électricité','baisse à 0','unité','terrain',true),
 ('4.6','Offre de soins','Unité déplacée vers un autre douar','variable entre unités','unité','base',false),
 ('4.7','Offre de soins','Véhicule, carburant, logistique','baisse à 0','unité','terrain',false),
 ('4.8','Offre de soins','Rupture de médicaments ou de consommables','baisse progressive','unité / province','terrain',false),
 ('4.9','Offre de soins','Grève des personnels','baisse','national / province','presse',false),
 ('4.10','Offre de soins','Horaires réduits','baisse','unité','base',false),
 ('4.11','Offre de soins','Ouverture, montée en charge','hausse progressive','unité','base',true),
 ('4.12','Offre de soins','Fermeture ou transfert de l''unité','baisse à 0 définitive','unité','base',true),
 ('5.1','Accès et demande','Saison agricole (olives, céréales, safran, dattes)','baisse saisonnière','province','calendrier agricole',false),
 ('5.3','Accès et demande','Caravane médicale à proximité','variable','unité','terrain',false),
 ('5.4','Accès et demande','Nouvelle structure de santé à proximité','baisse durable','unité','carte sanitaire',false),
 ('5.6','Accès et demande','Communication, sensibilisation','hausse','unité','terrain',false),
 ('5.7','Accès et demande','Confiance, satisfaction des patients','variable lente','unité','avis patients',false),
 ('6.1','Événement','Catastrophe naturelle','hausse puis retour','province','presse',false),
 ('6.2','Événement','Grand événement sportif (CAN 2025)','baisse aux heures de match','national','calendrier',false),
 ('6.4','Événement','Deuil ou événement local','baisse','unité','terrain',false),
 ('6.5','Événement','Panne nationale de la plateforme','baisse à 0','national','base',true),
 ('7.1','Saisie','Saisie hors ligne pas encore synchronisée','baisse provisoire','unité','base',true),
 ('7.2','Saisie','Consultations de test ou de formation','hausse artificielle','unité','base',true),
 ('7.4','Saisie','Doublons','hausse des consultations','unité','base',true),
 ('7.6','Saisie','Admissions non saisies','baisse des admissions seulement','unité','base',true),
 ('7.8','Saisie','Station réaffectée à une autre unité','variable entre unités','unité','base',false),
 ('X','Inconnue','Cause non identifiée : enquête terrain','—','—','terrain',false)
on conflict (code) do update set famille = excluded.famille, libelle = excluded.libelle, effet = excluded.effet,
  portee = excluded.portee, donnees = excluded.donnees, detection_auto = excluded.detection_auto;

-- 2. Jours anormaux ---------------------------------------------------------------------------------
create table if not exists ana.anomalie (
  id              bigserial primary key,
  centre_id       int  not null,
  jour            date not null,
  type            text not null check (type in ('consultations_basses','consultations_hautes','ecart_admissions')),
  observe         numeric not null,
  attendu         numeric not null,
  ecart_pct       numeric,
  score           numeric,
  contexte        jsonb not null default '{}'::jsonb,
  cause_code      text references ana.cause(code),
  cause_proposee  text,
  confiance       text,
  statut          text not null default 'a_enqueter' check (statut in ('a_enqueter','explique','confirme','ecarte')),
  cause_confirmee text references ana.cause(code),
  commentaire     text,
  par             text,
  maj             timestamptz,
  detecte_le      timestamptz not null default now(),
  unique (centre_id, jour, type));
create index if not exists anomalie_jour on ana.anomalie (jour);
create index if not exists anomalie_statut on ana.anomalie (statut, jour);

create table if not exists ana.execution (
  id bigserial primary key, etape text not null, du date, au date, n int, duree_ms int, fait_le timestamptz default now());

-- Série dense unité × jour avec référence robuste (médiane et écart absolu médian des 8 mêmes jours de semaine)
create or replace function ana.fn_base(p_du date, p_au date)
returns table (centre_id int, province text, region text, jour date, n int, n_adm int, n_pat int, n_off int,
               maturity text, attendu numeric, mad numeric, act_avant int, part_adm numeric, part_adm_ref numeric)
language sql stable set search_path = sup, public as $$
  with dense as (
    select c.centre_id, c.province, c.region, d::date as jour,
           coalesce(a.n_consultations, 0) as n, coalesce(a.n_admissions, 0) as n_adm, coalesce(a.n_patients, 0) as n_pat,
           coalesce(a.n_offline, 0) as n_off, a.maturity,
           -- jours de fermeture nationale exclus de la référence (sinon la semaine suivante paraît « haute »)
           case when d::date in (select k.day from sup.ref_calendar k where k.scope = 'national' and k.kind in ('holiday','religious'))
                then null else coalesce(a.n_consultations, 0) end as n_ref
    from sup.ref_centre c
    cross join generate_series(p_du - 70, p_au, interval '1 day') d
    left join sup.agg_centre_day a on a.centre_id = c.centre_id and a.day = d::date),
  w as (
    select d.*,
      array[lag(n_ref,7) over x, lag(n_ref,14) over x, lag(n_ref,21) over x, lag(n_ref,28) over x,
            lag(n_ref,35) over x, lag(n_ref,42) over x, lag(n_ref,49) over x, lag(n_ref,56) over x] as h,
      sum((n > 0)::int) over (partition by d.centre_id order by d.jour rows between 28 preceding and 1 preceding)::int as act_avant,
      -- part des patients avec admission, référence sur 28 jours précédents (jours avec ≥ 5 patients)
      case when n_pat >= 5 then n_adm::numeric / n_pat end as part_adm,
      (sum(n_adm) filter (where n_pat >= 5) over (partition by d.centre_id order by d.jour rows between 28 preceding and 1 preceding))::numeric
        / nullif(sum(n_pat) filter (where n_pat >= 5) over (partition by d.centre_id order by d.jour rows between 28 preceding and 1 preceding), 0) as part_adm_ref
    from dense d window x as (partition by d.centre_id order by d.jour)),
  m as (
    select w.*, (select percentile_cont(0.5) within group (order by v) from unnest(w.h) v)::numeric as med from w)
  select m.centre_id, m.province, m.region, m.jour, m.n, m.n_adm, m.n_pat, m.n_off, m.maturity,
         m.med,
         (select percentile_cont(0.5) within group (order by abs(v - m.med)) from unnest(m.h) v where v is not null)::numeric,
         m.act_avant, m.part_adm, m.part_adm_ref
  from m where m.jour between p_du and p_au
$$;

-- Détection + contexte + cause proposée (en masse). Conserve les enquêtes déjà saisies.
create or replace function ana.fn_detecter(p_du date, p_au date)
returns jsonb language plpgsql set search_path = ana, sup, ctx, public, pg_temp as $$
declare t0 timestamptz := clock_timestamp(); v_n int;
begin
  if p_au - p_du > 1200 then raise exception 'période limitée à 1 200 jours'; end if;

  drop table if exists t20_b;
  create temp table t20_b on commit drop as select * from ana.fn_base(p_du, p_au);
  create index on t20_b (jour, province);

  -- jours de fermeture nationale (fériés, fêtes, fermetures détectées) : expliqués, non retenus comme anomalies
  drop table if exists t20_ferme;
  create temp table t20_ferme on commit drop as
    select distinct day as jour from sup.ref_calendar where scope = 'national' and kind in ('holiday','religious');

  drop table if exists t20_a;
  create temp table t20_a on commit drop as
  with s as (
    select b.*, greatest(1.4826 * coalesce(b.mad, 0), 1.3 * sqrt(greatest(b.attendu, 1)), 1) as echelle  -- surdispersion : 1,3 × Poisson
    from t20_b b
    where b.act_avant > 0 and extract(isodow from b.jour) <> 7 and b.jour not in (select jour from t20_ferme))
  select s.centre_id, s.province, s.region, s.jour, 'consultations_basses'::text as type,
         s.n::numeric as observe, s.attendu, (s.n - s.attendu) / s.echelle as score, s.n_off, s.n, s.maturity
  from s where s.attendu >= 5 and s.n <= 0.6 * s.attendu and (s.n - s.attendu) / s.echelle <= -3
  union all
  select s.centre_id, s.province, s.region, s.jour, 'consultations_hautes', s.n, s.attendu, (s.n - s.attendu) / s.echelle,
         s.n_off, s.n, s.maturity
  from s where s.attendu >= 5 and s.n >= 1.6 * s.attendu and s.n - s.attendu >= 8 and (s.n - s.attendu) / s.echelle >= 3
  union all
  -- écart admissions / patients : part des patients admis très différente de l'habitude de l'unité
  select s.centre_id, s.province, s.region, s.jour, 'ecart_admissions', s.n_adm, round(s.part_adm_ref * s.n_pat, 1),
         (s.part_adm - s.part_adm_ref) / greatest(0.1, sqrt(s.part_adm_ref * (1 - least(s.part_adm_ref, 0.99)) / s.n_pat)),
         s.n_off, s.n, s.maturity
  from s where s.n_pat >= 8 and s.part_adm_ref is not null and s.part_adm_ref between 0.2 and 1.2
         and abs(s.part_adm - s.part_adm_ref) >= 0.35;

  -- baisse commune : part des unités de la province (et du réseau) en forte baisse le même jour
  drop table if exists t20_prov;
  create temp table t20_prov on commit drop as
    select jour, province, count(*) filter (where attendu >= 5 and n <= 0.6 * attendu)::numeric / nullif(count(*) filter (where attendu >= 5), 0) as part_basse,
           count(*) filter (where attendu >= 5) as n_comp
    from t20_b group by 1, 2;
  drop table if exists t20_nat;
  create temp table t20_nat on commit drop as
    select jour, count(*) filter (where attendu >= 5 and n <= 0.6 * attendu)::numeric / nullif(count(*) filter (where attendu >= 5), 0) as part_basse
    from t20_b group by 1;

  insert into ana.anomalie (centre_id, jour, type, observe, attendu, ecart_pct, score, contexte, cause_code, cause_proposee, confiance)
  select a.centre_id, a.jour, a.type, a.observe, round(a.attendu, 1),
         round(100 * (a.observe - a.attendu) / nullif(a.attendu, 0)), round(a.score, 2),
         jsonb_strip_nulls(jsonb_build_object(
           'meteo', nullif(concat_ws(', ',
              case when w.precip_mm >= cf.rain then 'pluie ' || w.precip_mm || ' mm' end,
              case when w.snow_cm >= cf.snow then 'neige ' || w.snow_cm || ' cm' end,
              case when w.gust_max_kmh >= cf.wind then 'vent ' || w.gust_max_kmh || ' km/h' end,
              case when w.t_max_c >= cf.heat then 'chaleur ' || w.t_max_c || ' °C' end,
              case when w.t_min_c <= cf.cold then 'froid ' || w.t_min_c || ' °C' end), ''),
           'calendrier', cal.libelle,
           'souk', sk.souk,
           'lendemain_fete', case when (a.jour - 1) in (select jour from t20_ferme) or (a.jour - 2) in (select jour from t20_ferme) then true end,
           'veille_fete', case when (a.jour + 1) in (select jour from t20_ferme) then true end,
           'baisse_province_pct', case when p.n_comp >= 3 then round(100 * p.part_basse) end,
           'baisse_reseau_pct', round(100 * nt.part_basse),
           'hors_ligne_pct', case when a.n > 0 then round(100.0 * a.n_off / a.n) end,
           'jours_zero_avant', z.jours_zero,
           'provisoire', case when a.maturity is distinct from 'consolide' then true end)),
         r.code, r.texte, r.confiance
  from t20_a a
  cross join (select max(value) filter (where key = 'heavy_rain_mm') rain, max(value) filter (where key = 'snow_cm') snow,
                     max(value) filter (where key = 'strong_wind_kmh') wind, max(value) filter (where key = 'heat_c') heat,
                     max(value) filter (where key = 'cold_c') cold from ctx.config) cf
  left join ctx.weather_daily w on w.centre_id = a.centre_id and w.day = a.jour
  left join lateral (select string_agg(distinct k.label, ' ; ') as libelle, bool_or(k.kind = 'ramadan') as ramadan,
                            bool_or(k.kind = 'school') as vacances
                     from sup.ref_calendar k
                     where k.day = a.jour and (k.scope = 'national' or (k.scope = 'centre' and k.scope_ref = a.centre_id::text)
                           or (k.scope = 'province' and k.scope_ref = a.province) or (k.scope = 'region' and k.scope_ref = a.region))) cal on true
  left join lateral (select string_agg(s.name, ' ; ') as souk from ctx.centre_souk cs join ctx.souk s using (souk_id)
                     where cs.centre_id = a.centre_id and s.weekday = extract(isodow from a.jour)) sk on true
  left join t20_prov p on p.jour = a.jour and p.province = a.province
  left join t20_nat nt on nt.jour = a.jour
  left join lateral (select count(*)::int as jours_zero from t20_b b2
                     where b2.centre_id = a.centre_id and b2.jour between a.jour - 6 and a.jour - 1
                       and extract(isodow from b2.jour) between 1 and 5 and b2.n = 0) z on true
  cross join lateral (
    select * from (values
      -- ordre de priorité : la première règle vraie l'emporte
      (1, a.type = 'consultations_basses' and nt.part_basse >= 0.5, '6.5', 'Baisse sur tout le réseau : panne de la plateforme ou fermeture non inscrite', 'forte'),
      (2, a.type = 'consultations_basses' and cal.ramadan, '1.3', 'Ramadan', 'moyenne'),
      (3, a.type = 'consultations_basses' and coalesce(p.n_comp, 0) >= 3 and p.part_basse >= 0.5
          and (w.precip_mm >= cf.rain or w.snow_cm >= cf.snow or w.gust_max_kmh >= cf.wind),
          case when w.snow_cm >= cf.snow then '2.1' when w.precip_mm >= cf.rain then '2.2' else '2.4' end,
          'Baisse commune à la province avec météo défavorable', 'forte'),
      (4, a.type = 'consultations_basses' and coalesce(p.n_comp, 0) >= 3 and p.part_basse >= 0.5, '4.9',
          'Baisse commune à la province sans météo : grève, événement ou fête locale ?', 'moyenne'),
      (5, a.type = 'consultations_basses' and (w.snow_cm >= cf.snow), '2.1', 'Neige à l''emplacement de l''unité', 'moyenne'),
      (6, a.type = 'consultations_basses' and (w.precip_mm >= cf.rain), '2.2', 'Fortes pluies à l''emplacement de l''unité', 'moyenne'),
      (7, a.type = 'consultations_basses' and (w.t_max_c >= cf.heat), '2.3', 'Chaleur extrême', 'faible'),
      (8, a.type = 'consultations_basses' and a.n = 0 and coalesce(z.jours_zero, 0) >= 2, '4.5',
          'Unité à l''arrêt plusieurs jours : panne, véhicule ou fermeture', 'moyenne'),
      (9, a.type = 'consultations_basses' and a.n = 0, '4.1', 'Aucune consultation un jour ouvré : médecin absent ?', 'moyenne'),
      (10, a.type = 'consultations_basses' and a.maturity is distinct from 'consolide', '7.1',
          'Journée non consolidée : saisies hors ligne en attente', 'faible'),
      (11, a.type = 'consultations_hautes' and ((a.jour - 1) in (select jour from t20_ferme) or (a.jour - 2) in (select jour from t20_ferme)),
          '1.4', 'Rattrapage après une fête ou un pont', 'moyenne'),
      (12, a.type = 'consultations_hautes' and sk.souk is not null, '1.5', 'Jour de souk', 'faible'),
      (13, a.type = 'consultations_hautes', '3.5', 'Hausse ponctuelle : campagne, caravane, épidémie ou doublons ? à vérifier', 'faible'),
      (14, a.type = 'ecart_admissions' and a.observe < a.attendu, '7.6', 'Admissions non saisies ce jour (agent d''accueil absent ?)', 'moyenne'),
      (15, a.type = 'ecart_admissions', '7.4', 'Plus d''admissions que d''habitude : doublons ou patients non vus ?', 'faible'),
      (99, true, 'X', 'Aucune cause connue : demander au coordinateur', 'aucune')
    ) v(ordre, ok, code, texte, confiance)
    where v.ok order by v.ordre limit 1) r
  on conflict (centre_id, jour, type) do update set
    observe = excluded.observe, attendu = excluded.attendu, ecart_pct = excluded.ecart_pct, score = excluded.score,
    contexte = excluded.contexte, cause_code = excluded.cause_code, cause_proposee = excluded.cause_proposee,
    confiance = excluded.confiance, detecte_le = now();
  get diagnostics v_n = row_count;

  insert into ana.execution (etape, du, au, n, duree_ms)
  values ('detection', p_du, p_au, v_n, (extract(epoch from clock_timestamp() - t0) * 1000)::int);
  return jsonb_build_object('du', p_du, 'au', p_au, 'anomalies', v_n,
    'par_type', (select jsonb_object_agg(type, n) from (select type, count(*) n from ana.anomalie where jour between p_du and p_au group by 1) x),
    'duree_ms', (extract(epoch from clock_timestamp() - t0) * 1000)::int);
end $$;

-- 3. Effets des facteurs (rapport observé / habituel), y compris les nouveaux facteurs calendaires ----------
create table if not exists ana.effet (
  facteur text primary key, libelle text, famille text, portee text default 'national',
  effet_pct numeric, ic_bas numeric, ic_haut numeric, n_jours int,
  pct_anomalies numeric, pct_jours_normaux numeric, lift numeric, calcule_le timestamptz default now());

create or replace function ana.fn_calculer_effets(p_du date default '2023-10-19', p_au date default null)
returns jsonb language plpgsql set search_path = ana, sup, ctx, public, pg_temp as $$
declare v_au date := coalesce(p_au, (select max(day) from sup.agg_centre_day)); v_n int;
begin
  drop table if exists t20_e;
  create temp table t20_e on commit drop as
  with b as (select * from ana.fn_base(p_du, v_au) where act_avant > 0 and attendu >= 3),
  cf as (select max(value) filter (where key = 'heavy_rain_mm') rain, max(value) filter (where key = 'snow_cm') snow,
                max(value) filter (where key = 'strong_wind_kmh') wind, max(value) filter (where key = 'heat_c') heat,
                max(value) filter (where key = 'cold_c') cold from ctx.config),
  fer as (select distinct day from sup.ref_calendar where scope = 'national' and kind in ('holiday','religious'))
  select b.centre_id, b.jour, b.n / b.attendu as ratio,
    exists (select 1 from ana.anomalie an where an.centre_id = b.centre_id and an.jour = b.jour and an.type <> 'ecart_admissions') as anomalie,
    b.jour in (select day from fer) as ferie,
    ((b.jour - 1) in (select day from fer) or (b.jour - 2) in (select day from fer)) and b.jour not in (select day from fer) as lendemain_fete,
    (b.jour + 1) in (select day from fer) and b.jour not in (select day from fer) as veille_fete,
    exists (select 1 from sup.ref_calendar k where k.day = b.jour and k.kind = 'ramadan' and k.scope = 'national') as ramadan,
    exists (select 1 from sup.ref_calendar k where k.day = b.jour and k.kind = 'school') as vacances,
    extract(day from b.jour) >= 26 as fin_mois,
    extract(day from b.jour) <= 5 as debut_mois,
    extract(month from b.jour) in (7, 8) as ete,
    extract(month from b.jour) in (12, 1, 2) as hiver,
    extract(isodow from b.jour) = 1 as lundi,
    extract(isodow from b.jour) = 5 as vendredi,
    w.precip_mm >= cf.rain as pluie_forte, w.precip_mm >= 5 and w.precip_mm < cf.rain as pluie_moderee,
    w.snow_cm >= cf.snow as neige, w.gust_max_kmh >= cf.wind as vent, w.t_max_c >= cf.heat as chaleur, w.t_min_c <= cf.cold as froid,
    w.centre_id is not null as meteo,
    exists (select 1 from ctx.centre_souk cs join ctx.souk s using (souk_id) where cs.centre_id = b.centre_id and s.weekday = extract(isodow from b.jour)) as souk,
    b.n > 0 and b.n_off::numeric / b.n >= 0.5 as hors_ligne_fort
  from b cross join cf
  left join ctx.weather_daily w on w.centre_id = b.centre_id and w.day = b.jour;

  delete from ana.effet;
  insert into ana.effet (facteur, libelle, famille, effet_pct, ic_bas, ic_haut, n_jours, pct_anomalies, pct_jours_normaux, lift)
  select f.facteur, f.libelle, f.famille,
    round(100 * (avg(e.ratio) filter (where f.v) / nullif(avg(e.ratio) filter (where not f.v), 0) - 1), 1),
    round(100 * ((avg(e.ratio) filter (where f.v) - 1.96 * coalesce(stddev_samp(e.ratio) filter (where f.v), 0) / sqrt(greatest(count(*) filter (where f.v), 1))::numeric)
                 / nullif(avg(e.ratio) filter (where not f.v), 0) - 1), 1),
    round(100 * ((avg(e.ratio) filter (where f.v) + 1.96 * coalesce(stddev_samp(e.ratio) filter (where f.v), 0) / sqrt(greatest(count(*) filter (where f.v), 1))::numeric)
                 / nullif(avg(e.ratio) filter (where not f.v), 0) - 1), 1),
    count(*) filter (where f.v),
    round(100.0 * count(*) filter (where f.v and e.anomalie) / nullif(count(*) filter (where e.anomalie), 0), 1),
    round(100.0 * count(*) filter (where f.v and not e.anomalie) / nullif(count(*) filter (where not e.anomalie), 0), 1),
    round((count(*) filter (where f.v and e.anomalie)::numeric / nullif(count(*) filter (where e.anomalie), 0))
          / nullif(count(*) filter (where f.v and not e.anomalie)::numeric / nullif(count(*) filter (where not e.anomalie), 0), 0), 2)
  from t20_e e
  cross join lateral (values
    ('ferie', 'Jour férié ou fête', 'Calendrier', e.ferie),
    ('veille_fete', 'Veille de fête', 'Calendrier', e.veille_fete),
    ('lendemain_fete', 'Lendemain de fête (2 jours)', 'Calendrier', e.lendemain_fete),
    ('ramadan', 'Ramadan', 'Calendrier', e.ramadan),
    ('vacances', 'Vacances scolaires', 'Calendrier', e.vacances),
    ('fin_mois', 'Fin de mois (26 au 31)', 'Calendrier', e.fin_mois),
    ('debut_mois', 'Début de mois (1 au 5)', 'Calendrier', e.debut_mois),
    ('ete', 'Été (juillet-août)', 'Calendrier', e.ete),
    ('hiver', 'Hiver (décembre à février)', 'Calendrier', e.hiver),
    ('lundi', 'Lundi', 'Calendrier', e.lundi),
    ('vendredi', 'Vendredi', 'Calendrier', e.vendredi),
    ('souk', 'Jour de souk (≤ 20 km)', 'Calendrier', e.souk),
    ('pluie_forte', 'Pluie forte', 'Environnement', case when e.meteo then e.pluie_forte end),
    ('pluie_moderee', 'Pluie modérée (5 mm à seuil)', 'Environnement', case when e.meteo then e.pluie_moderee end),
    ('neige', 'Neige', 'Environnement', case when e.meteo then e.neige end),
    ('vent', 'Vent fort', 'Environnement', case when e.meteo then e.vent end),
    ('chaleur', 'Chaleur extrême', 'Environnement', case when e.meteo then e.chaleur end),
    ('froid', 'Froid', 'Environnement', case when e.meteo then e.froid end),
    ('hors_ligne_fort', 'Plus de la moitié des saisies hors ligne', 'Offre de soins', e.hors_ligne_fort)
  ) f(facteur, libelle, famille, v)
  where f.v is not null
  group by f.facteur, f.libelle, f.famille
  having count(*) filter (where f.v) >= 5;
  get diagnostics v_n = row_count;
  -- Les effets « vendredi » et « lundi » sont mesurés contre le même jour de semaine : ils valent ≈ 0 par construction.
  -- Ils restent utiles pour le lift (part des anomalies). Le souk est repris de ctx.impact_factor (méthode corrigée).
  update ana.effet e set effet_pct = f.effect_pct, ic_bas = f.ci_low, ic_haut = f.ci_high
  from ctx.impact_factor f where e.facteur = 'souk' and f.factor = 'souk' and f.scope = 'national';
  insert into ana.execution (etape, du, au, n) values ('effets', p_du, v_au, v_n);
  return jsonb_build_object('facteurs', v_n, 'du', p_du, 'au', v_au);
end $$;

-- 4. API -------------------------------------------------------------------------------------------
create or replace function public.ui_anomalies(p_token text, p_du date, p_au date, p_centre_id int default null,
                                               p_type text default null, p_statut text default null, p_limit int default 500)
returns jsonb language plpgsql security definer set search_path = ana, sup, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  return (select coalesce(jsonb_agg(x order by x.score_abs desc, x.jour desc), '[]'::jsonb) from (
    select a.id, a.centre_id, r.centre_name, r.province, r.region, a.jour, a.type, a.observe, a.attendu, a.ecart_pct, a.score,
           abs(a.score) as score_abs, a.contexte, a.cause_proposee, a.cause_code, a.confiance, a.statut, a.cause_confirmee,
           a.commentaire, a.par, a.maj
    from ana.anomalie a join sup.ref_centre r using (centre_id)
    where a.jour between p_du and p_au
      and (p_centre_id is null or a.centre_id = p_centre_id)
      and (p_type is null or a.type = p_type)
      and (p_statut is null or a.statut = p_statut)
    order by abs(a.score) desc, a.jour desc
    limit least(greatest(coalesce(p_limit, 500), 1), 2000)) x);
end $$;

create or replace function public.ui_anomalie_enquete(p_token text, p_id bigint, p_statut text, p_par text,
                                                      p_cause_code text default null, p_commentaire text default null)
returns jsonb language plpgsql security definer set search_path = ana, sup, public, pg_temp as $$
declare v_statut text;
begin
  perform sup.api_check(p_token);
  if p_statut not in ('a_enqueter','explique','confirme','ecarte') then raise exception 'statut invalide'; end if;
  if p_cause_code is not null and not exists (select 1 from ana.cause where code = p_cause_code) then raise exception 'cause inconnue'; end if;
  update ana.anomalie set statut = p_statut, cause_confirmee = coalesce(p_cause_code, cause_confirmee),
         commentaire = left(p_commentaire, 1000), par = left(coalesce(p_par, 'interface'), 80), maj = now()
  where id = p_id returning statut into v_statut;
  if v_statut is null then raise exception 'anomalie introuvable'; end if;
  return jsonb_build_object('ok', true, 'id', p_id, 'statut', v_statut);
end $$;

create or replace function public.ui_causes(p_token text)
returns jsonb language plpgsql security definer set search_path = ana, sup, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(c) order by c.code), '[]'::jsonb) from ana.cause c);
end $$;

create or replace function public.ui_facteurs(p_token text)
returns jsonb language plpgsql security definer set search_path = ana, sup, ctx, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  return (select coalesce(jsonb_agg(x order by x.famille, x.facteur), '[]'::jsonb) from (
    select e.facteur, e.libelle, e.famille, e.portee, e.effet_pct, e.ic_bas, e.ic_haut, e.n_jours,
           e.pct_anomalies, e.pct_jours_normaux, e.lift,
           case when e.n_jours < 30 then 'trop peu de jours'
                when e.facteur in ('lundi','vendredi') then 'référence par jour de semaine'
                when e.ic_bas > 0 then case when e.effet_pct >= 5 then 'hausse démontrée' else 'hausse faible' end
                when e.ic_haut < 0 then case when e.effet_pct <= -5 then 'baisse démontrée' else 'baisse faible' end
                else 'pas d''effet démontré' end as verdict
    from ana.effet e) x);
end $$;

do $$ declare f text; begin
  foreach f in array array['ui_anomalies(text, date, date, int, text, text, int)',
                           'ui_anomalie_enquete(text, bigint, text, text, text, text)',
                           'ui_causes(text)', 'ui_facteurs(text)'] loop
    execute format('revoke all on function public.%s from public, authenticated', f);
    execute format('grant execute on function public.%s to anon, service_role', f);
  end loop;
end $$;
revoke all on all functions in schema ana from public, anon, authenticated;
revoke all on all tables in schema ana from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'ana installé' as statut, (select count(*) from ana.cause) as causes,
       (select count(*) from pg_proc where proname in ('ui_anomalies','ui_anomalie_enquete','ui_causes','ui_facteurs')) as api;
