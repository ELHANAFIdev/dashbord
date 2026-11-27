-- =====================================================================
-- 22 — Prévision du nombre de consultations par unité et par jour (équation explicable)
--   Studio : coller, Run. Rejouable. Prérequis : 20, 21 (schéma ana), 10/10b/17 (météo, calendrier, souks).
--
--   Équation (régression linéaire sur le logarithme, ajustée dans la base, sans outil externe) :
--     log((consultations + 1) / (référence + 1)) = b0 + Σ bk × facteur_k + erreur
--     référence = médiane des 8 mêmes jours de semaine, à partir de 2 semaines avant le jour prévu
--                 (elle porte déjà le niveau de l'unité, son jour de semaine et son souk)
--     facteurs  = veille ou lendemain de fête, Ramadan, part de Ramadan dans la référence, vacances scolaires,
--                 été, hiver, début et fin de mois, pluie modérée, pluie forte, neige, vent fort, chaleur, froid
--     jour férié ou fête nationale : prévision = 0
--   Prévision = (référence + 1) × exp(b0 + Σ bk × facteur_k + σ²/2) − 1, intervalle à 90 % = × exp(± 1,645 σ)
--
--   Étapes :  select ana.fn_ajuster_modele('2023-12-15', '2026-04-30', '2026-05-01', '2026-08-13');  -- contrôle sur période passée
--             select ana.fn_ajuster_modele('2023-12-15', '2026-08-13');                              -- modèle final (toutes les données)
--   API : ui_prevision (clé anon + jeton).
-- =====================================================================
create schema if not exists ana;

create table if not exists ana.modele (
  version text primary key, ajuste_le timestamptz not null default now(), actif boolean not null default false,
  train_du date, train_au date, test_du date, test_au date, n_train int, n_test int, sigma numeric,
  wape_modele_pct numeric, wape_reference_pct numeric, erreur_moyenne_pct numeric, r2_log numeric, note text);
create table if not exists ana.modele_coef (
  version text references ana.modele(version) on delete cascade, terme text, libelle text,
  coefficient numeric, erreur_type numeric, effet_pct numeric, ic_bas_pct numeric, ic_haut_pct numeric, n_jours int,
  primary key (version, terme));

-- Libellés des facteurs (ordre = colonnes de la matrice)
create or replace function ana.fn_termes() returns table (terme text, libelle text) language sql immutable as $$
  values ('constante','Constante'), ('veille_fete','Veille de fête'), ('lendemain_fete','Lendemain de fête (2 jours)'),
         ('ramadan','Ramadan'), ('ref_ramadan','Part de Ramadan dans la référence'), ('vacances','Vacances scolaires'),
         ('ete','Été (juillet-août)'), ('hiver','Hiver (décembre à février)'), ('debut_mois','Début de mois (1 au 5)'),
         ('fin_mois','Fin de mois (26 au 31)'), ('pluie_moderee','Pluie modérée'), ('pluie_forte','Pluie forte'),
         ('neige','Neige'), ('vent','Vent fort'), ('chaleur','Chaleur extrême'), ('froid','Froid')
$$;

-- Variables d'un jour pour chaque unité (jours passés : y connu ; jours futurs : y nul)
create or replace function ana.fn_variables(p_du date, p_au date, p_centre_id int default null)
returns table (centre_id int, jour date, y numeric, ref numeric, ferie boolean, souk text, meteo text, x numeric[])
language plpgsql stable set search_path = ana, sup, ctx, public as $$
declare v_fin date := (select max(day) from sup.agg_centre_day);
  fer date[] := array(select distinct k.day from sup.ref_calendar k where k.scope = 'national' and k.kind in ('holiday','religious'));
  ram date[] := array(select distinct k.day from sup.ref_calendar k where k.scope = 'national' and k.kind = 'ramadan');
  vac date[] := array(select distinct k.day from sup.ref_calendar k where k.kind = 'school');
begin
  return query
  with cf as (select max(value) filter (where key = 'heavy_rain_mm') rain, max(value) filter (where key = 'snow_cm') snow,
                max(value) filter (where key = 'strong_wind_kmh') wind, max(value) filter (where key = 'heat_c') heat,
                max(value) filter (where key = 'cold_c') cold from ctx.config),
  g as (
    select c.centre_id, d::date as jour,
           greatest(2, ceil((d::date - v_fin)::numeric / 7))::int as k0
    from sup.ref_centre c cross join generate_series(p_du, p_au, interval '1 day') d
    where p_centre_id is null or c.centre_id = p_centre_id),
  r as (
    select g.centre_id, g.jour,
           (select a.n_consultations from sup.agg_centre_day a where a.centre_id = g.centre_id and a.day = g.jour and g.jour <= v_fin) as y,
           (select percentile_cont(0.5) within group (order by coalesce(a.n_consultations, 0))
              from generate_series(g.k0, g.k0 + 7) k
              left join sup.agg_centre_day a on a.centre_id = g.centre_id and a.day = g.jour - 7 * k
              where (g.jour - 7 * k) <> all(fer))::numeric as ref,
           (select count(*) from generate_series(g.k0, g.k0 + 7) k where (g.jour - 7 * k) = any(ram))::numeric / 8 as ref_ram,
           (select sum((a.n_consultations > 0)::int) from sup.agg_centre_day a
             where a.centre_id = g.centre_id and a.day between g.jour - 7 * g.k0 - 28 and g.jour - 7 * g.k0) as actif
    from g)
  select r.centre_id, r.jour, r.y::numeric, r.ref,
         r.jour = any(fer),
         (select string_agg(s.name, ' ; ') from ctx.centre_souk cs join ctx.souk s using (souk_id)
           where cs.centre_id = r.centre_id and s.weekday = extract(isodow from r.jour)),
         nullif(concat_ws(', ',
           case when w.precip_mm >= 5 then 'pluie ' || w.precip_mm || ' mm' end,
           case when w.snow_cm >= cf.snow then 'neige' end,
           case when w.gust_max_kmh >= cf.wind then 'vent ' || w.gust_max_kmh || ' km/h' end,
           case when w.t_max_c >= cf.heat then 'chaleur ' || w.t_max_c || ' °C' end,
           case when w.t_min_c <= cf.cold then 'froid' end), ''),
         array[1,
           ((r.jour + 1) = any(fer))::int,
           ((r.jour - 1) = any(fer) or (r.jour - 2) = any(fer))::int,
           (r.jour = any(ram))::int,
           r.ref_ram,
           (r.jour = any(vac))::int,
           (extract(month from r.jour) in (7, 8))::int,
           (extract(month from r.jour) in (12, 1, 2))::int,
           (extract(day from r.jour) <= 5)::int,
           (extract(day from r.jour) >= 26)::int,
           coalesce((w.precip_mm >= 5 and w.precip_mm < cf.rain)::int, 0),
           coalesce((w.precip_mm >= cf.rain)::int, 0),
           coalesce((w.snow_cm >= cf.snow)::int, 0),
           coalesce((w.gust_max_kmh >= cf.wind)::int, 0),
           coalesce((w.t_max_c >= cf.heat)::int, 0),
           coalesce((w.t_min_c <= cf.cold)::int, 0)]::numeric[]
  from r cross join cf
  left join ctx.weather_daily w on w.centre_id = r.centre_id and w.day = r.jour
  where coalesce(r.actif, 0) > 0 and extract(isodow from r.jour) <> 7;
end $$;

-- Résolution de A·b = c par élimination de Gauss-Jordan (avec inverse pour les erreurs types)
create or replace function ana.fn_resoudre(a numeric[], c numeric[], out b numeric[], out inv numeric[])
language plpgsql immutable as $$
declare n int := array_length(c, 1); m numeric[]; i int; j int; k int; p int; f numeric; tmp numeric;
begin
  m := array_fill(0::numeric, array[n, 2 * n + 1]);
  for i in 1..n loop
    for j in 1..n loop m[i][j] := a[i][j]; end loop;
    m[i][n + i] := 1; m[i][2 * n + 1] := c[i];
  end loop;
  for k in 1..n loop
    p := k;
    for i in k + 1..n loop if abs(m[i][k]) > abs(m[p][k]) then p := i; end if; end loop;
    if abs(m[p][k]) < 1e-12 then raise exception 'matrice singulière (facteur sans variation : colonne %)', k; end if;
    if p <> k then for j in 1..2 * n + 1 loop tmp := m[k][j]; m[k][j] := m[p][j]; m[p][j] := tmp; end loop; end if;
    f := m[k][k];
    for j in 1..2 * n + 1 loop m[k][j] := m[k][j] / f; end loop;
    for i in 1..n loop
      if i <> k and m[i][k] <> 0 then
        f := m[i][k];
        for j in 1..2 * n + 1 loop m[i][j] := m[i][j] - f * m[k][j]; end loop;
      end if;
    end loop;
  end loop;
  b := array_fill(0::numeric, array[n]); inv := array_fill(0::numeric, array[n, n]);
  for i in 1..n loop
    b[i] := m[i][2 * n + 1];
    for j in 1..n loop inv[i][j] := m[i][n + j]; end loop;
  end loop;
end $$;

-- Ajustement (moindres carrés sur log, légère pénalisation 1e-3 pour les facteurs rares) et contrôle
create or replace function ana.fn_ajuster_modele(p_train_du date, p_train_au date, p_test_du date default null, p_test_au date default null)
returns jsonb language plpgsql set search_path = ana, sup, ctx, public, pg_temp as $$
declare
  t0 timestamptz := clock_timestamp(); k int; a numeric[]; c numeric[]; sol record; rss numeric; n int; sigma numeric;
  v_version text := 'prev-' || to_char(now(), 'YYYYMMDD-HH24MI') || case when p_test_du is null then '' else '-controle' end;
  v_termes text[] := array(select terme from ana.fn_termes()); v_lib text[] := array(select libelle from ana.fn_termes());
  i int; j int; v_cnt int[]; v_s numeric; v_c int; b8 float8[]; v_wape numeric; v_wape_ref numeric; v_mape numeric; v_ntest int; v_r2 numeric;
begin
  k := array_length(v_termes, 1);
  drop table if exists t22;
  create temp table t22 on commit drop as
    select * from ana.fn_variables(p_train_du, coalesce(p_test_au, p_train_au))
    where not ferie and ref >= 3 and y is not null;
  -- matrices X'X et X'z en un seul passage (z = log((y+1)/(ref+1))), calcul en double précision
  drop table if exists t22f;
  create temp table t22f on commit drop as
    select x::float8[] as xf, ln((y + 1) / (ref + 1))::float8 as z from t22 where jour <= p_train_au;
  a := array_fill(0::numeric, array[k, k]); c := array_fill(0::numeric, array[k]); v_cnt := array_fill(0, array[k]);
  for i, j, v_s in
    select q.ii, q.jj, sum(t.xf[q.ii] * t.xf[q.jj])::numeric
    from t22f t cross join (select g1 as ii, g2 as jj from generate_series(1, k) g1, generate_series(1, k) g2 where g2 >= g1) q
    group by q.ii, q.jj
  loop a[i][j] := v_s; a[j][i] := v_s; end loop;
  for i, v_s, v_c in
    select q.ii, sum(t.xf[q.ii] * t.z)::numeric, count(*) filter (where t.xf[q.ii] <> 0)::int
    from t22f t cross join generate_series(1, k) q(ii) group by q.ii
  loop c[i] := v_s; v_cnt[i] := v_c; end loop;
  for i in 2..k loop
    a[i][i] := a[i][i] + 1e-3 + case when v_cnt[i] < 10 then 1e6 else 0 end;  -- facteur absent ou rare : coefficient ≈ 0
  end loop;
  select * into sol from ana.fn_resoudre(a, c);
  b8 := array(select round(v, 8)::float8 from unnest(sol.b) v);   -- précision bornée (calculs rapides)
  -- prédiction de chaque jour (log) une seule fois
  drop table if exists t22p;
  create temp table t22p on commit drop as
    select t.jour, t.y::float8 as y, t.ref::float8 as ref, ln((t.y + 1) / (t.ref + 1))::float8 as z,
           (select sum(t.x[q]::float8 * b8[q]) from generate_series(1, k) q) as s
    from t22 t;
  select count(*), sum(power(z - s, 2)), 1 - sum(power(z - s, 2)) / nullif(sum(power(z - avg_z, 2)), 0)
    into n, rss, v_r2
  from t22p, (select avg(z) as avg_z from t22p where jour <= p_train_au) m
  where jour <= p_train_au;
  sigma := round(sqrt(rss / greatest(n - k, 1)), 6);

  -- contrôle : erreur absolue pondérée (WAPE) du modèle contre la référence seule, jours ouvrés
  select 100 * sum(abs(y - greatest(0, (ref + 1) * exp(s + sigma * sigma / 2) - 1))) / nullif(sum(y), 0),
         100 * sum(abs(y - ref)) / nullif(sum(y), 0),
         100 * avg(abs(y - greatest(0, (ref + 1) * exp(s + sigma * sigma / 2) - 1)) / y) filter (where y >= 5),
         count(*)
    into v_wape, v_wape_ref, v_mape, v_ntest
  from t22p where jour between coalesce(p_test_du, p_train_du) and coalesce(p_test_au, p_train_au);

  update ana.modele set actif = false where p_test_du is null;
  insert into ana.modele (version, actif, train_du, train_au, test_du, test_au, n_train, n_test, sigma,
                          wape_modele_pct, wape_reference_pct, erreur_moyenne_pct, r2_log, note)
  values (v_version, p_test_du is null, p_train_du, p_train_au, p_test_du, p_test_au, n, v_ntest, round(sigma, 4),
          round(v_wape, 1), round(v_wape_ref, 1), round(v_mape, 1), round(v_r2, 3),
          case when p_test_du is null then 'modèle actif (toutes les données) ; erreurs mesurées sur la période d''ajustement'
               else 'contrôle : ajusté avant ' || p_test_du || ', mesuré après' end)
  on conflict (version) do update set ajuste_le = now();
  for i in 1..k loop
    insert into ana.modele_coef (version, terme, libelle, coefficient, erreur_type, effet_pct, ic_bas_pct, ic_haut_pct, n_jours)
    values (v_version, v_termes[i], v_lib[i], round(sol.b[i], 6), round(sigma * sqrt(greatest(sol.inv[i][i], 0)), 6),
            case when i > 1 then round(100 * (exp(sol.b[i]) - 1), 1) end,
            case when i > 1 then round(100 * (exp(sol.b[i] - 1.96 * sigma * sqrt(greatest(sol.inv[i][i], 0))) - 1), 1) end,
            case when i > 1 then round(100 * (exp(sol.b[i] + 1.96 * sigma * sqrt(greatest(sol.inv[i][i], 0))) - 1), 1) end,
            v_cnt[i])
    on conflict (version, terme) do update set coefficient = excluded.coefficient, erreur_type = excluded.erreur_type,
      effet_pct = excluded.effet_pct, ic_bas_pct = excluded.ic_bas_pct, ic_haut_pct = excluded.ic_haut_pct, n_jours = excluded.n_jours;
  end loop;
  return jsonb_build_object('version', v_version, 'jours_ajustement', n, 'jours_controle', v_ntest, 'sigma', round(sigma, 3),
    'r2_log', round(v_r2, 3), 'erreur_modele_pct', round(v_wape, 1), 'erreur_reference_seule_pct', round(v_wape_ref, 1),
    'erreur_moyenne_jours_5_plus_pct', round(v_mape, 1), 'actif', p_test_du is null,
    'duree_ms', (extract(epoch from clock_timestamp() - t0) * 1000)::int);
end $$;

-- Prévision d'une unité sur N jours avec le modèle actif
create or replace function ana.fn_prevoir(p_centre_id int, p_du date, p_jours int default 14)
returns table (jour date, prevu numeric, bas numeric, haut numeric, reference numeric, ferie boolean, souk text, meteo text)
language plpgsql stable set search_path = ana, public as $$
declare v_m record; v_b numeric[];
begin
  select * into v_m from ana.modele where actif order by ajuste_le desc limit 1;
  if v_m is null then raise exception 'aucun modèle actif : lancer ana.fn_ajuster_modele'; end if;
  select array_agg(c.coefficient order by t.ord) into v_b
  from ana.modele_coef c join (select terme, row_number() over () as ord from ana.fn_termes()) t using (terme)
  where c.version = v_m.version;
  return query
  select v.jour,
         case when v.ferie then 0 else round(greatest(0, (v.ref + 1) * exp(e.s + v_m.sigma * v_m.sigma / 2) - 1), 1) end,
         case when v.ferie then 0 else round(greatest(0, (v.ref + 1) * exp(e.s - 1.645 * v_m.sigma) - 1), 1) end,
         case when v.ferie then 0 else round(greatest(0, (v.ref + 1) * exp(e.s + 1.645 * v_m.sigma) - 1), 1) end,
         round(v.ref, 1), v.ferie, v.souk, v.meteo
  from ana.fn_variables(p_du, p_du + least(greatest(p_jours, 1), 60) - 1, p_centre_id) v
  cross join lateral (select sum(v.x[q] * v_b[q]) as s from generate_series(1, array_length(v_b, 1)) q) e
  order by v.jour;
end $$;

create or replace function public.ui_prevision(p_token text, p_centre_id int, p_du date default null, p_jours int default 14)
returns jsonb language plpgsql security definer set search_path = ana, sup, public, pg_temp as $$
declare v_m record; v_du date := coalesce(p_du, (select max(day) from sup.agg_centre_day) + 1);
begin
  perform sup.api_check(p_token);
  select * into v_m from ana.modele where actif order by ajuste_le desc limit 1;
  return jsonb_build_object(
    'centre', (select jsonb_build_object('centre_id', centre_id, 'centre_name', centre_name, 'province', province)
               from sup.ref_centre where centre_id = p_centre_id),
    'modele', case when v_m is null then null else jsonb_build_object('version', v_m.version, 'ajuste_le', v_m.ajuste_le,
                'erreur_moyenne_pct', coalesce((select wape_modele_pct from ana.modele where test_du is not null order by ajuste_le desc limit 1), v_m.wape_modele_pct),
                'erreur_reference_seule_pct', (select wape_reference_pct from ana.modele where test_du is not null order by ajuste_le desc limit 1),
                'n_jours_test', (select n_test from ana.modele where test_du is not null order by ajuste_le desc limit 1)) end,
    'jours', case when v_m is null then '[]'::jsonb else
               (select coalesce(jsonb_agg(to_jsonb(p) order by p.jour), '[]'::jsonb) from ana.fn_prevoir(p_centre_id, v_du, p_jours) p) end,
    'equation', (select coalesce(jsonb_agg(jsonb_build_object('terme', c.libelle, 'coefficient', c.coefficient, 'effet_pct', c.effet_pct,
                                                              'ic_bas_pct', c.ic_bas_pct, 'ic_haut_pct', c.ic_haut_pct, 'n_jours', c.n_jours)
                                           order by t.ord), '[]'::jsonb)
                 from ana.modele_coef c join (select terme, row_number() over () as ord from ana.fn_termes()) t using (terme)
                 where c.version = v_m.version));
end $$;
revoke all on function public.ui_prevision(text, int, date, int) from public, authenticated;
grant execute on function public.ui_prevision(text, int, date, int) to anon, service_role;
revoke all on all functions in schema ana from public, anon, authenticated;
revoke all on all tables in schema ana from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'prévision installée' as statut, (select count(*) from ana.fn_termes()) as termes,
       (select version from ana.modele where actif order by ajuste_le desc limit 1) as modele_actif;
