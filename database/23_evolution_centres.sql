-- =====================================================================
-- 23 — Évolution du flux de chaque unité : tendance, projection à 3 mois, unités à risque, recommandation
--   Studio : coller, Run. Rejouable. Prérequis : 20, 21 (ana, population), 12 (agrégats).
--   Tendance = droite de régression sur le logarithme des consultations par jour ouvré, mois par mois,
--   sur les p_mois derniers mois complets ; exprimée en % par an, avec son test (|t| ≥ 2 = significatif).
--   API : ui_evolution (clé anon + jeton).
-- =====================================================================
create schema if not exists ana;

create or replace function ana.fn_evolution(p_mois int default 12)
returns table (centre_id int, centre_name text, province text, region text, population_province int, unites_province int,
               premier_jour date, consultations_periode bigint, par_jour_3_derniers_mois numeric, tendance_pct_an numeric,
               t_stat numeric, prevision_3_mois numeric, pour_1000_hab_an numeric, jours_sans_activite_90 int,
               anomalies_ouvertes_90 int, statut text)
language plpgsql stable set search_path = ana, sup, public as $$
declare v_fin date := (select max(day) from sup.agg_centre_day);
        v_m1 date;   -- 1er jour du mois qui suit le dernier mois complet
        v_m0 date;
        fer date[] := array(select distinct k.day from sup.ref_calendar k where k.scope = 'national' and k.kind in ('holiday','religious'));
begin
  v_m1 := case when v_fin = (date_trunc('month', v_fin) + interval '1 month - 1 day')::date
               then (date_trunc('month', v_fin) + interval '1 month')::date else date_trunc('month', v_fin)::date end;
  v_m0 := (v_m1 - make_interval(months => greatest(p_mois, 6)))::date;
  return query
  with ouvres as (   -- jours ouvrés par mois (lundi au samedi, hors fermetures nationales)
    select date_trunc('month', d)::date as mois, count(*) as n_ouvres
    from generate_series(v_m0, v_m1 - 1, interval '1 day') d
    where extract(isodow from d) <> 7 and d::date <> all(fer) group by 1),
  mens as (
    select r.centre_id, o.mois, coalesce(sum(a.n_consultations), 0)::numeric / o.n_ouvres as par_jour, coalesce(sum(a.n_consultations), 0) as n
    from sup.ref_centre r cross join ouvres o
    left join sup.agg_centre_day a on a.centre_id = r.centre_id and a.day >= o.mois and a.day < (o.mois + interval '1 month')::date
    group by r.centre_id, o.mois, o.n_ouvres),
  prem as (select a.centre_id, min(a.day) as premier from sup.agg_centre_day a where a.n_consultations > 0 group by 1),
  reg as (   -- régression ln(par_jour + 0,5) = a + b × mois, sur les mois depuis la première activité
    select m.centre_id, count(*) as nm,
           regr_slope(ln(m.par_jour + 0.5), extract(epoch from m.mois) / 2629800.0)::numeric as b,
           regr_intercept(ln(m.par_jour + 0.5), extract(epoch from m.mois) / 2629800.0)::numeric as a0,
           regr_r2(ln(m.par_jour + 0.5), extract(epoch from m.mois) / 2629800.0)::numeric as r2,
           sum(m.n) as n_total
    from mens m join prem p using (centre_id)
    where m.mois >= date_trunc('month', p.premier)
    group by m.centre_id),
  der as (
    select m.centre_id, avg(m.par_jour) as niveau from mens m where m.mois >= (v_m1 - interval '3 months')::date group by 1),
  pop as (
    select v.centre_id, v.population, count(*) over (partition by v.province) as unites from ana.v_centre_population v),
  sans as (
    select r.centre_id, count(*) filter (where coalesce(a.n_consultations, 0) = 0)::int as jours_zero
    from sup.ref_centre r cross join generate_series(v_fin - 89, v_fin, interval '1 day') d
    left join sup.agg_centre_day a on a.centre_id = r.centre_id and a.day = d::date
    where extract(isodow from d) <> 7 and d::date <> all(fer)
    group by r.centre_id),
  ano as (
    select an.centre_id, count(*)::int as n from ana.anomalie an
    where an.jour > v_fin - 90 and an.statut = 'a_enqueter' and an.type = 'consultations_basses' group by 1)
  select r.centre_id, r.centre_name, r.province, r.region, p.population, p.unites::int, pr.premier,
         coalesce(g.n_total, 0)::bigint,
         round(d.niveau, 1),
         round(100 * (exp(12 * g.b) - 1), 1),
         -- t de Student de la pente : b / erreur type, erreur type ≈ |b| × sqrt((1 − r²) / (r² × (n − 2)))
         case when g.nm >= 4 and g.r2 > 0 and g.r2 < 1 then round(sign(g.b) * sqrt(g.r2 * (g.nm - 2) / (1 - g.r2)), 2) end,
         round(greatest(0, d.niveau * exp(3 * coalesce(g.b, 0))), 1),
         case when p.population > 0 then round(1000.0 * coalesce(g12.n, 0) / (p.population::numeric / p.unites), 1) end,
         coalesce(s.jours_zero, 0), coalesce(an.n, 0),
         case
           when pr.premier is null then 'inactif'
           when pr.premier > v_fin - 182 then 'nouveau'
           when g.nm >= 6 and g.b * 12 <= ln(0.85) and abs(coalesce(sqrt(g.r2 * (g.nm - 2) / nullif(1 - g.r2, 0)), 0)) >= 2
                and (d.niveau < 13 or d.niveau * exp(3 * g.b) < 8) then 'a_risque'
           when g.nm >= 6 and g.b * 12 <= ln(0.85) and abs(coalesce(sqrt(g.r2 * (g.nm - 2) / nullif(1 - g.r2, 0)), 0)) >= 2 then 'declin'
           when d.niveau < 8 or coalesce(s.jours_zero, 0) >= 20 then 'a_risque'
           when g.nm >= 6 and g.b * 12 >= ln(1.15) and abs(coalesce(sqrt(g.r2 * (g.nm - 2) / nullif(1 - g.r2, 0)), 0)) >= 2 then 'croissance'
           else 'stable' end
  from sup.ref_centre r
  left join reg g using (centre_id)
  left join der d using (centre_id)
  left join prem pr using (centre_id)
  left join pop p using (centre_id)
  left join sans s using (centre_id)
  left join ano an using (centre_id)
  left join lateral (select sum(a.n_consultations) as n from sup.agg_centre_day a
                     where a.centre_id = r.centre_id and a.day > v_fin - 365 and a.day <= v_fin) g12 on true;
end $$;

create or replace function public.ui_evolution(p_token text, p_mois int default 12)
returns jsonb language plpgsql security definer set search_path = ana, sup, public, pg_temp as $$
declare v_med numeric;
begin
  perform sup.api_check(p_token);
  drop table if exists t23;
  create temp table t23 on commit drop as select * from ana.fn_evolution(least(greatest(coalesce(p_mois, 12), 6), 24));
  select percentile_cont(0.5) within group (order by pour_1000_hab_an) into v_med from t23 where statut not in ('inactif','nouveau');
  return (select coalesce(jsonb_agg(x order by x.ordre, x.tendance_pct_an nulls last), '[]'::jsonb) from (
    select e.centre_id, e.centre_name, e.province, e.region, e.population_province, e.unites_province, e.premier_jour,
           e.consultations_periode, e.par_jour_3_derniers_mois, e.tendance_pct_an, e.t_stat, e.prevision_3_mois,
           e.pour_1000_hab_an, round(v_med, 1) as mediane_reseau_pour_1000, e.jours_sans_activite_90, e.anomalies_ouvertes_90, e.statut,
           case e.statut when 'a_risque' then 1 when 'declin' then 2 when 'nouveau' then 3 when 'stable' then 4 when 'croissance' then 5 else 6 end as ordre,
           to_jsonb(array_remove(array[
             case when e.tendance_pct_an <= -15 and abs(coalesce(e.t_stat, 0)) >= 2 then 'Baisse de ' || replace(abs(e.tendance_pct_an)::text, '.', ',') || ' % par an' end,
             case when e.tendance_pct_an >= 15 and abs(coalesce(e.t_stat, 0)) >= 2 then 'Hausse de ' || replace(e.tendance_pct_an::text, '.', ',') || ' % par an' end,
             case when e.par_jour_3_derniers_mois < 13 then replace(e.par_jour_3_derniers_mois::text, '.', ',') || ' consultations par jour ouvré (objectif 21)' end,
             case when e.prevision_3_mois < 8 then 'Projection à 3 mois : ' || replace(e.prevision_3_mois::text, '.', ',') || ' par jour' end,
             case when e.jours_sans_activite_90 >= 10 then e.jours_sans_activite_90 || ' jours ouvrés sans activité sur 90' end,
             case when e.anomalies_ouvertes_90 >= 3 then e.anomalies_ouvertes_90 || ' baisses anormales non expliquées sur 90 jours' end,
             case when v_med > 0 and e.pour_1000_hab_an < v_med / 2 then 'Fréquentation faible : ' || replace(e.pour_1000_hab_an::text, '.', ',') || ' pour 1 000 habitants (médiane ' || round(v_med) || ')' end
           ]::text[], null)) as signaux,
           case
             when e.statut = 'inactif' then 'Vérifier si l''unité est en service.'
             when e.statut = 'nouveau' then 'Suivre la montée en charge (3 à 6 mois) ; informer la population des jours de passage.'
             when e.jours_sans_activite_90 >= 20 then 'Vérifier l''équipe, le véhicule et le matériel : trop de jours sans activité.'
             when e.statut = 'a_risque' and v_med > 0 and e.pour_1000_hab_an < v_med / 2
               then 'Informer la population (souk, associations, radio) et étudier un emplacement plus proche des douars peuplés.'
             when e.statut = 'a_risque' then 'Enquête terrain : causes des baisses, horaires, équipe ; campagne d''information au souk.'
             when e.statut = 'declin' then 'Analyser les baisses anormales récentes et les retours terrain ; vérifier l''offre (médecin, télé-expertise).'
             when e.statut = 'croissance' and e.par_jour_3_derniers_mois >= 30 then 'Forte demande : renforcer (deuxième station, télé-expertise) pour éviter l''attente.'
             when v_med > 0 and e.pour_1000_hab_an < v_med / 2 then 'Fréquentation faible pour la population : campagne d''information.'
             else 'Poursuivre le suivi.' end as recommandation
    from t23 e) x);
end $$;
revoke all on function public.ui_evolution(text, int) from public, authenticated;
grant execute on function public.ui_evolution(text, int) to anon, service_role;
revoke all on all functions in schema ana from public, anon, authenticated;

notify pgrst, 'reload schema';
select statut, count(*) as unites from ana.fn_evolution(12) group by 1 order by 1;
