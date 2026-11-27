-- =====================================================================
-- 28 — Compléments du tableau de bord
--   1. Liste rouge : chaque ligne dit si l'unité est dans la liste active (règles R1 à R7 du script 15),
--      et reçoit un nom lisible (nom MediFus, sinon « Unité n° id »). Le tableau de bord montre les actives par défaut.
--   2. Affluence jour × heure par région, province, commune ou unité (flux_heures_niveau) + liste des lieux (flux_lieux).
--   Studio : coller, Run. Rejouable. Prérequis : 12, 15, 16, 25.
--   Après un rechargement de l'historique ou un changement d'unités : select flux.fn_rafraichir_lieux();
-- =====================================================================

-- 1. Lieux des unités (copie locale : évite de relire la copie MediFus à chaque appel) ------------
create table if not exists flux.centre_lieu (
  centre_id   int primary key,
  centre_name text,
  commune     text,
  province    text,
  region      text,
  actif       boolean not null,
  motif       text,
  maj         timestamptz not null default now()
);
revoke all on flux.centre_lieu from public, anon, authenticated;

create or replace function flux.fn_nom_lisible(p_nom text, p_id int) returns text language sql immutable as $$
  select case when coalesce(regexp_replace(p_nom, '[^[:alnum:]]', '', 'g'), '') = '' then 'Unité n° ' || p_id else btrim(p_nom) end $$;

create or replace function flux.fn_rafraichir_lieux() returns jsonb
language plpgsql security definer set search_path = flux, sup, public as $$
begin
  insert into flux.centre_lieu (centre_id, centre_name, commune, province, region, actif, motif, maj)
  select s.centre_id, flux.fn_nom_lisible(coalesce(nullif(r.centre_name, ''), s.centre_name), s.centre_id),
         s.city_name, coalesce(r.province, s.province), coalesce(r.region, s.region), s.statut = 'actif', s.motif, now()
  from sup.fn_centres_statut() s left join sup.ref_centre r on r.centre_id = s.centre_id
  on conflict (centre_id) do update set centre_name = excluded.centre_name, commune = excluded.commune, province = excluded.province,
    region = excluded.region, actif = excluded.actif, motif = excluded.motif, maj = now();
  -- unités présentes dans les agrégats mais plus dans MediFus
  insert into flux.centre_lieu (centre_id, centre_name, province, region, actif, motif)
  select distinct a.centre_id, flux.fn_nom_lisible(r.centre_name, a.centre_id), r.province, r.region, false, 'absente de MediFus'
  from sup.agg_centre_day a left join sup.ref_centre r using (centre_id)
  where not exists (select 1 from flux.centre_lieu l where l.centre_id = a.centre_id)
  on conflict do nothing;
  return jsonb_build_object('unites', (select count(*) from flux.centre_lieu),
                            'actives', (select count(*) from flux.centre_lieu where actif),
                            'communes', (select count(distinct commune) from flux.centre_lieu where actif));
end $$;
revoke all on function flux.fn_rafraichir_lieux() from public, anon, authenticated;

-- 2. Liste rouge (même signature qu'au script 12 ; champs ajoutés : actif, motif_hors_liste) ------
create or replace function public.sup_centre_category_list(p_token text, p_attention_only boolean default true,
                                                           p_measure text default 'pec', p_period_end date default null)
returns jsonb language plpgsql security definer set search_path = sup, flux, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'measure', c.measure, 'period_end', c.period_end, 'centre_id', c.centre_id,
             'centre_name', coalesce(l.centre_name, flux.fn_nom_lisible(r.centre_name, c.centre_id)),
             'province', coalesce(r.province, l.province), 'region', coalesce(r.region, l.region), 'category', c.category,
             'mean_value', c.mean_patients, 'mean_patients', c.mean_patients, 'ci_low', c.ci_low, 'ci_high', c.ci_high,
             'pct_days_over_target', c.pct_days_over_target, 'mean_prev', c.mean_prev, 'adj_change_pct', c.adj_change_pct,
             'trend_z', c.trend_z, 'days_open', c.days_open, 'days_zero', c.days_zero,
             'attention', c.attention, 'attention_reason', c.attention_reason,
             'actif', coalesce(l.actif, true), 'motif_hors_liste', case when l.actif is false then l.motif end)
           order by c.attention desc, c.mean_patients), '[]'::jsonb)
    from sup.centre_category c
    left join sup.ref_centre r using (centre_id)
    left join flux.centre_lieu l using (centre_id)
    where c.measure = coalesce(p_measure, 'pec')
      and c.period_end = coalesce(p_period_end, (select max(period_end) from sup.centre_category where measure = coalesce(p_measure, 'pec')))
      and (c.attention or not p_attention_only));
end $$;

-- 3. Liste des lieux pour les filtres du tableau de bord ---------------------------------------
create or replace function public.flux_lieux(p_token text)
returns jsonb language plpgsql security definer set search_path = flux, sup, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object('centre_id', centre_id, 'centre_name', centre_name, 'commune', commune,
                                                       'province', province, 'region', region)
                                    order by region, province, commune, centre_name), '[]'::jsonb)
          from flux.centre_lieu where actif);
end $$;

-- 4. Affluence jour × heure à un niveau donné ----------------------------------------------------
create or replace function flux.fn_heures_niveau(p_du date, p_au date, p_niveau text, p_valeur text)
returns jsonb language sql stable security definer set search_path = flux, sup, public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.jour_semaine, x.heure), '[]'::jsonb) from (
    select f.jour_semaine, f.heure, count(*) as consultations, count(distinct (f.centre_id, f.jour)) as heures_actives,
           round(count(*)::numeric / nullif(count(distinct (f.centre_id, f.jour)), 0), 2) as consultations_par_heure_active
    from flux.consultation_fait f
    join flux.centre_lieu l on l.centre_id = f.centre_id
    where f.jour between p_du and p_au
      and case p_niveau when 'region' then l.region = p_valeur
                        when 'province' then l.province = p_valeur
                        when 'commune' then l.commune = p_valeur
                        when 'centre' then l.centre_id::text = p_valeur
                        else true end
    group by 1, 2) x $$;

create or replace function public.flux_heures_niveau(p_token text, p_du date, p_au date,
                                                     p_niveau text default 'national', p_valeur text default null)
returns jsonb language plpgsql security definer set search_path = flux, sup, public, pg_temp as $$
declare v_cle text; r jsonb; t0 timestamptz := clock_timestamp();
begin
  perform sup.api_check(p_token);
  if p_niveau not in ('national', 'region', 'province', 'commune', 'centre') then
    raise exception 'p_niveau : national, region, province, commune ou centre';
  end if;
  if p_niveau <> 'national' and coalesce(p_valeur, '') = '' then raise exception 'p_valeur obligatoire pour le niveau %', p_niveau; end if;
  if p_au - p_du > 1100 then raise exception 'FLUX_PERIODE_TROP_LONGUE'; end if;
  v_cle := flux.fn_cle('heures_niveau', p_du, p_au, p_niveau, null, coalesce(p_valeur, '-'));
  select valeur into r from flux.cache_indicateur where cle = v_cle;
  if r is not null then return r; end if;
  r := flux.fn_heures_niveau(p_du, p_au, p_niveau, p_valeur);
  insert into flux.cache_indicateur (cle, indicateur, du, au, niveau, grain, valeur, calcule_le, duree_ms)
  values (v_cle, 'heures_niveau', p_du, p_au, p_niveau, coalesce(p_valeur, '-'), r, now(),
          (extract(epoch from clock_timestamp() - t0) * 1000)::int)
  on conflict (cle) do update set valeur = excluded.valeur, calcule_le = now(), duree_ms = excluded.duree_ms;
  return r;
end $$;

-- Pré-calcul pour toutes les régions (et les provinces) sur 12 mois : affichage immédiat
create or replace function flux.fn_precalculer_heures(p_du date default '2025-08-01', p_au date default '2026-07-31')
returns jsonb language plpgsql security definer set search_path = flux, sup, public as $$
declare k record; n int := 0;
begin
  for k in select distinct 'region' as niv, region as val from flux.centre_lieu where actif and region is not null
           union select distinct 'province', province from flux.centre_lieu where actif and province is not null loop
    insert into flux.cache_indicateur (cle, indicateur, du, au, niveau, grain, valeur)
    values (flux.fn_cle('heures_niveau', p_du, p_au, k.niv, null, k.val), 'heures_niveau', p_du, p_au, k.niv, k.val,
            flux.fn_heures_niveau(p_du, p_au, k.niv, k.val))
    on conflict (cle) do update set valeur = excluded.valeur, calcule_le = now();
    n := n + 1;
  end loop;
  return jsonb_build_object('cartes_calculees', n);
end $$;
revoke all on function flux.fn_heures_niveau(date, date, text, text), flux.fn_precalculer_heures(date, date),
                       flux.fn_nom_lisible(text, int) from public, anon, authenticated;

revoke all on function public.flux_lieux(text), public.flux_heures_niveau(text, date, date, text, text) from public, authenticated;
grant execute on function public.flux_lieux(text), public.flux_heures_niveau(text, date, date, text, text) to anon, service_role;

notify pgrst, 'reload schema';
do $$ begin perform flux.fn_rafraichir_lieux(); perform flux.fn_precalculer_heures(); end $$;
select (select count(*) filter (where actif) from flux.centre_lieu) as unites_actives,
       (select count(distinct commune) filter (where actif) from flux.centre_lieu) as communes,
       (select count(*) from flux.cache_indicateur where indicateur = 'heures_niveau') as cartes_jour_heure,
       (select count(*) filter (where coalesce(l.actif, true)) || ' actives, ' || count(*) filter (where l.actif is false) || ' hors liste active'
        from sup.centre_category c left join flux.centre_lieu l using (centre_id)
        where c.measure = 'pec' and c.attention
          and c.period_end = (select max(period_end) from sup.centre_category where measure = 'pec')) as liste_rouge;
