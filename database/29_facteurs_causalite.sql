-- =====================================================================
-- 29 — Facteurs du flux : alimenter la base, puis distinguer corrélation et causalité
--   Studio : coller, Run (quelques secondes). Rejouable. Prérequis : 20 (ana), 10/17 (météo, calendrier), 12 (agrégats).
--   Puis, dans l'ordre (une commande par exécution) :
--     select ana.fn_charger_medecins('2023-10-19', '2024-01-17');   -- puis les 11 fenêtres suivantes (LISEZ-MOI, étape 17),
--                                                                   -- une par exécution ; rejouable
--     select ana.fn_alimenter_facteurs();         -- remplit ana.facteur_jour (30 facteurs)
--     select * from ana.fn_tester_causalite();    -- 6 tests par facteur + verdict (1 à 3 min)
--   API : ui_causalite (clé anon + jeton) ; écran « Facteurs & causes ».
--
--   Méthode (chaque jour d'une unité comparé à son attendu : médiane des 8 mêmes jours de semaine)
--     T1 association      effet moyen les jours avec le facteur, intervalle de confiance à 95 %
--     T2 témoin du jour   même calcul, moins l'écart des unités SANS le facteur le même jour dans la région
--                         (pour la météo : unités sans aucun événement météo) ; retire ce qui touche tout le monde ce jour-là ;
--                         impossible pour un facteur national. Les jours fériés sont exclus de tous les tests sauf « férié ».
--     T3 placebo          le facteur décalé de 10 jours ne doit avoir AUCUN effet
--     T4 antériorité      la veille d'un facteur imprévisible (météo, médecin) doit être normale
--     T5 dose-réponse     plus d'intensité, plus d'effet (pluie, neige, vent, chaleur, froid)
--     T6 cohérence        le même sens d'effet dans au moins 70 % des provinces concernées
--   Verdict : « cause probable » si T1 significatif (au moins 5 %, 8 % pour une saison) et T3 nul et T2, T4, T5, T6 non contredits ;
--             « association » si T1 significatif mais un test contredit ; « effet faible » (< 5 %) ;
--             « pas d'effet démontré » ; « trop peu de jours ».
--   Une cause probable reste une conclusion statistique : l'enquête terrain la confirme.
-- =====================================================================
create schema if not exists ana;

-- 1. Catalogue des facteurs ------------------------------------------------------------------------
create table if not exists ana.facteur_def (
  facteur    text primary key,
  libelle    text not null,
  famille    text not null,
  portee     text not null check (portee in ('national', 'unite')),   -- national : même jour pour tout le réseau
  imprevu    boolean not null default false,                         -- non anticipable (T4 applicable)
  nature     text not null default 'demande',                        -- demande : agit sur la venue des patients ; mesure : artefact de saisie
  dose       text,                                                   -- variable d'intensité pour T5
  source     text not null,
  remarque   text
);
insert into ana.facteur_def (facteur, libelle, famille, portee, imprevu, dose, source, remarque) values
 ('ferie', 'Jour férié ou fête', 'Calendrier', 'national', false, null, 'calendrier', null),
 ('veille_fete', 'Veille de fête', 'Calendrier', 'national', false, null, 'calendrier', null),
 ('lendemain_fete', 'Lendemain de fête (2 jours)', 'Calendrier', 'national', false, null, 'calendrier', null),
 ('semaine_aid_adha', 'Semaine après l''Aïd al-Adha', 'Calendrier', 'national', false, null, 'calendrier', 'libellé contenant « adha »'),
 ('ramadan', 'Ramadan', 'Calendrier', 'national', false, null, 'calendrier', null),
 ('vacances', 'Vacances scolaires', 'Calendrier', 'national', false, null, 'calendrier', null),
 ('rentree', 'Rentrée scolaire (1er au 20 septembre)', 'Calendrier', 'national', false, null, 'règle', 'dates approximatives'),
 ('examens', 'Période d''examens (1er au 20 juin)', 'Calendrier', 'national', false, null, 'règle', 'dates approximatives'),
 ('debut_mois', 'Début de mois (1 au 5)', 'Économie', 'national', false, null, 'règle', 'paie, aides'),
 ('fin_mois', 'Fin de mois (26 au 31)', 'Économie', 'national', false, null, 'règle', null),
 ('moisson', 'Moisson des céréales (15 mai au 30 juin)', 'Économie', 'national', false, null, 'règle', 'saison agricole approximative ; effet attendu surtout en plaine'),
 ('olives', 'Récolte des olives (1er novembre au 15 janvier)', 'Économie', 'national', false, null, 'règle', 'saison agricole approximative'),
 ('souk', 'Jour de souk (≤ 20 km)', 'Économie', 'unite', false, null, 'référentiel souks', null),
 ('pluie_moderee', 'Pluie modérée (5 mm au seuil)', 'Météo', 'unite', true, 'precip_mm', 'Open-Meteo', null),
 ('pluie_forte', 'Pluie forte (seuil et plus)', 'Météo', 'unite', true, 'precip_mm', 'Open-Meteo', null),
 ('pluie_veille', 'Pluie forte la veille (pistes abîmées)', 'Météo', 'unite', true, 'precip_mm', 'Open-Meteo', 'effet décalé'),
 ('neige', 'Neige', 'Météo', 'unite', true, 'snow_cm', 'Open-Meteo', null),
 ('vent', 'Vent fort', 'Météo', 'unite', true, 'gust_max_kmh', 'Open-Meteo', null),
 ('chaleur', 'Chaleur extrême', 'Météo', 'unite', true, 't_max_c', 'Open-Meteo', null),
 ('froid', 'Froid', 'Météo', 'unite', true, 'froid_c', 'Open-Meteo', 'intensité = degrés sous le seuil'),
 ('medecin_remplacant', 'Médecin différent du médecin habituel', 'Offre de soins', 'unite', true, null, 'copie MediFus', 'habituel = le plus fréquent des 28 jours précédents'),
 ('nouveau_medecin', 'Nouveau médecin dans l''unité (14 premiers jours)', 'Offre de soins', 'unite', true, null, 'copie MediFus', null),
 ('deux_medecins', 'Deux médecins ou plus dans la journée', 'Offre de soins', 'unite', false, null, 'copie MediFus', null),
 ('reprise', 'Reprise après au moins 3 jours ouvrés sans activité', 'Offre de soins', 'unite', true, null, 'agrégats', 'retour de panne, de congé ou d''intempérie'),
 ('hors_ligne_fort', 'Plus de la moitié des saisies hors ligne', 'Qualité de saisie', 'unite', true, null, 'agrégats', null),
 ('enquete_confirmee', 'Cause confirmée par enquête (toutes causes)', 'Terrain', 'unite', true, null, 'enquêtes', 'alimenté par les enquêtes du tableau de bord')
on conflict (facteur) do update set libelle = excluded.libelle, famille = excluded.famille, portee = excluded.portee,
  imprevu = excluded.imprevu, dose = excluded.dose, source = excluded.source, remarque = excluded.remarque;
alter table ana.facteur_def add column if not exists nature text not null default 'demande';
update ana.facteur_def set nature = 'mesure', famille = 'Qualité de saisie',
       remarque = 'une saisie hors ligne est synchronisée en bloc : le compte du jour monte mécaniquement ; ce n''est pas un facteur de venue'
 where facteur = 'hors_ligne_fort';

-- 1 bis. Calendrier : Ramadan et vacances scolaires (absents du calendrier de la base au 26/11/2026)
--   Ramadan au Maroc (ministère des Habous) : 12/03/2024 (Aïd 10/04), 02/03/2025 (Aïd 31/03), 19/02/2026 (Aïd 20/03).
--   Vacances scolaires des écoles publiques (ministère de l'Éducation nationale) : périodes intermédiaires et semestrielles.
insert into sup.ref_calendar (day, scope, scope_ref, kind, label, source)
select d::date, 'national', null, 'ramadan', 'Ramadan ' || extract(year from d), 'ana29 (Habous)'
from (values ('2024-03-12'::date, '2024-04-09'::date), ('2025-03-02', '2025-03-30'), ('2026-02-19', '2026-03-19')) r(du, au)
cross join generate_series(r.du, r.au, interval '1 day') d
on conflict do nothing;
insert into sup.ref_calendar (day, scope, scope_ref, kind, label, source)
select d::date, 'national', null, 'school', 'Vacances scolaires', 'ana29 (MEN)'
from (values ('2023-10-15'::date, '2023-10-22'::date), ('2023-12-03', '2023-12-10'), ('2024-01-21', '2024-01-28'),
             ('2024-03-10', '2024-03-17'), ('2024-04-28', '2024-05-05'),
             ('2024-10-20', '2024-10-27'), ('2024-12-08', '2024-12-15'), ('2025-01-26', '2025-02-02'),
             ('2025-03-16', '2025-03-23'), ('2025-05-04', '2025-05-11'),
             ('2025-10-19', '2025-10-26'), ('2025-12-07', '2025-12-14'), ('2026-01-25', '2026-02-01'),
             ('2026-03-15', '2026-03-22'), ('2026-05-03', '2026-05-10')) v(du, au)
cross join generate_series(v.du, v.au, interval '1 day') d
on conflict do nothing;

-- 2. Valeur des facteurs par unité et par jour (1 ligne = facteur présent ; valeur = intensité si utile)
create table if not exists ana.facteur_jour (
  facteur   text not null references ana.facteur_def (facteur) on delete cascade,
  centre_id int  not null,
  jour      date not null,
  valeur    numeric,
  primary key (facteur, centre_id, jour)
);
create index if not exists facteur_jour_cj on ana.facteur_jour (centre_id, jour);

-- 3. Médecin principal par unité et par jour (lu dans la copie MediFus ; aucun nom gardé)
create table if not exists ana.centre_jour_medecin (
  centre_id          int  not null,
  jour               date not null,
  medecin_principal  int,
  n_medecins         int,
  primary key (centre_id, jour)
);

create or replace function ana.fn_charger_medecins(p_du date, p_au date)
returns int language plpgsql security definer set search_path = ana, medifus_src, public as $$
declare v_n int;
begin
  if p_au - p_du > 92 then raise exception 'période limitée à 92 jours par appel'; end if;
  with c as materialized (
    select c.id, s."centerId" as centre_id, ((c.created_at at time zone 'UTC') at time zone 'Africa/Casablanca')::date as jour
    from medifus_src.consultations c join medifus_src.stations s on s.id = c."stationId"
    where c.created_at >= p_du - 1 and c.created_at < p_au + 2 and coalesce(c.deleted_at::text, 'null') in ('null', '')),
  d as materialized (
    select cd."consultationId" as cid, cd."doctorId" as medecin
    from medifus_src.consultations_doctors cd join medifus_src.doctors dr on dr.id = cd."doctorId"
    where dr."specialityId" = 1 and coalesce(cd.deleted_at::text, 'null') in ('null', '')
      and cd.created_at >= p_du - 1 and cd.created_at < p_au + 3),
  j as (
    select c.centre_id, c.jour, d.medecin, count(*) as n
    from c join d on d.cid = c.id where c.jour between p_du and p_au group by 1, 2, 3)
  insert into ana.centre_jour_medecin (centre_id, jour, medecin_principal, n_medecins)
  select centre_id, jour, (array_agg(medecin order by n desc, medecin))[1], count(*)
  from j group by 1, 2
  on conflict (centre_id, jour) do update set medecin_principal = excluded.medecin_principal, n_medecins = excluded.n_medecins;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Chargement complet : Studio exécute chaque requête dans une transaction (pas de COMMIT possible dans une procédure).
-- Lancer donc une fenêtre de 91 jours par exécution (12 commandes, voir LISEZ-MOI) ; chaque fenêtre est rejouable.
drop procedure if exists ana.pr_charger_medecins(date, date, boolean);
create or replace function ana.fn_charger_medecins_tout(p_du date default '2023-10-19', p_au date default null)
returns jsonb language plpgsql security definer set search_path = ana, sup, public as $$
declare d date := p_du; v_au date := coalesce(p_au, (select max(day) from sup.agg_centre_day)); v_n int := 0; t0 timestamptz := clock_timestamp();
begin
  while d <= v_au loop
    v_n := v_n + ana.fn_charger_medecins(d, least(d + 61, v_au));
    d := d + 62;
  end loop;
  return jsonb_build_object('lignes', v_n, 'du', p_du, 'au', v_au, 'duree_s', round(extract(epoch from clock_timestamp() - t0)));
end $$;

-- 4. Alimentation de ana.facteur_jour ---------------------------------------------------------------
create or replace function ana.fn_alimenter_facteurs(p_du date default '2023-10-19', p_au date default null)
returns jsonb language plpgsql security definer set search_path = ana, sup, ctx, public, pg_temp as $$
declare v_au date := coalesce(p_au, (select max(day) from sup.agg_centre_day)); v_n int;
        fer date[] := array(select distinct day from sup.ref_calendar where scope = 'national' and kind in ('holiday', 'religious'));
        adha date[] := array(select distinct day from sup.ref_calendar where kind in ('holiday', 'religious') and label ~* 'adha|kebir');
        ram date[] := array(select distinct day from sup.ref_calendar where scope = 'national' and kind = 'ramadan');
        sco date[] := array(select distinct day from sup.ref_calendar where kind = 'school');
        rain numeric; snow numeric; wind numeric; heat numeric; cold numeric;
begin
  select max(value) filter (where key = 'heavy_rain_mm'), max(value) filter (where key = 'snow_cm'),
         max(value) filter (where key = 'strong_wind_kmh'), max(value) filter (where key = 'heat_c'), max(value) filter (where key = 'cold_c')
    into rain, snow, wind, heat, cold from ctx.config;
  rain := coalesce(rain, 20); snow := coalesce(snow, 1); wind := coalesce(wind, 60); heat := coalesce(heat, 40); cold := coalesce(cold, 0);

  delete from ana.facteur_jour where jour between p_du and v_au;

  -- unités et jours connus (lundi à samedi)
  drop table if exists t29_cj;
  create temp table t29_cj as
  select a.centre_id, a.day as jour, a.n_consultations as n, coalesce(a.n_offline, 0) as n_off
  from sup.agg_centre_day a where a.day between p_du and v_au and extract(isodow from a.day) <> 7;
  create index on t29_cj (centre_id, jour);

  -- calendrier et économie (même jour pour tout le réseau)
  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select f, centre_id, jour, 1 from t29_cj cross join lateral (values
    ('ferie', jour = any(fer)),
    ('veille_fete', (jour + 1) = any(fer) and jour <> all(fer)),
    ('lendemain_fete', ((jour - 1) = any(fer) or (jour - 2) = any(fer)) and jour <> all(fer)),
    ('semaine_aid_adha', exists (select 1 from unnest(adha) a where jour > a and jour <= a + 7) and jour <> all(fer)),
    ('ramadan', jour = any(ram)),
    ('vacances', jour = any(sco)),
    ('rentree', extract(month from jour) = 9 and extract(day from jour) <= 20),
    ('examens', extract(month from jour) = 6 and extract(day from jour) <= 20),
    ('debut_mois', extract(day from jour) <= 5),
    ('fin_mois', extract(day from jour) >= 26),
    ('moisson', (extract(month from jour) = 5 and extract(day from jour) >= 15) or extract(month from jour) = 6),
    ('olives', extract(month from jour) in (11, 12) or (extract(month from jour) = 1 and extract(day from jour) <= 15))
  ) v(f, present) where present;

  -- souk
  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select distinct 'souk', t.centre_id, t.jour, 1
  from t29_cj t join ctx.centre_souk cs on cs.centre_id = t.centre_id join ctx.souk s using (souk_id)
  where s.weekday = extract(isodow from t.jour)
  on conflict do nothing;

  -- météo (avec intensité)
  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select f, t.centre_id, t.jour, v
  from t29_cj t join ctx.weather_daily w on w.centre_id = t.centre_id and w.day = t.jour
  left join ctx.weather_daily w1 on w1.centre_id = t.centre_id and w1.day = t.jour - 1
  cross join lateral (values
    ('pluie_moderee', w.precip_mm >= 5 and w.precip_mm < rain, w.precip_mm),
    ('pluie_forte', w.precip_mm >= rain, w.precip_mm),
    ('pluie_veille', w1.precip_mm >= rain and coalesce(w.precip_mm, 0) < rain, w1.precip_mm),
    ('neige', w.snow_cm >= snow, w.snow_cm),
    ('vent', w.gust_max_kmh >= wind, w.gust_max_kmh),
    ('chaleur', w.t_max_c >= heat, w.t_max_c),
    ('froid', w.t_min_c <= cold, cold - w.t_min_c)
  ) x(f, present, v) where present;

  -- offre de soins : médecin habituel, nouveau médecin, deux médecins
  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select 'medecin_remplacant', m.centre_id, m.jour, 1
  from ana.centre_jour_medecin m
  cross join lateral (select mode() within group (order by p.medecin_principal) as habituel, count(*) as n_ref
                      from ana.centre_jour_medecin p where p.centre_id = m.centre_id and p.jour between m.jour - 28 and m.jour - 1) h
  where m.jour between p_du and v_au and h.n_ref >= 8 and m.medecin_principal is distinct from h.habituel;

  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select 'nouveau_medecin', m.centre_id, m.jour, 1
  from ana.centre_jour_medecin m
  join (select centre_id, medecin_principal, min(jour) as premier from ana.centre_jour_medecin group by 1, 2) p
    on p.centre_id = m.centre_id and p.medecin_principal = m.medecin_principal
  where m.jour between p_du and v_au and m.jour < p.premier + 14
    and p.premier > (select min(jour) + 60 from ana.centre_jour_medecin);   -- pas les médecins présents dès le début des données

  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select 'deux_medecins', centre_id, jour, n_medecins from ana.centre_jour_medecin where jour between p_du and v_au and n_medecins >= 2;

  -- reprise après au moins 3 jours ouvrés sans activité, et saisie hors ligne
  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select 'reprise', t.centre_id, t.jour, 1
  from t29_cj t
  where t.n > 0 and t.jour <> all(fer)
    and (select count(*) from t29_cj z where z.centre_id = t.centre_id and z.jour between t.jour - 4 and t.jour - 1 and z.n = 0 and z.jour <> all(fer)) >= 3;
  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select 'hors_ligne_fort', centre_id, jour, round(n_off::numeric / n, 2) from t29_cj where n >= 5 and n_off::numeric / n >= 0.5;

  -- causes confirmées par enquête (jour de l'anomalie)
  insert into ana.facteur_jour (facteur, centre_id, jour, valeur)
  select distinct 'enquete_confirmee', centre_id, jour, 1 from ana.anomalie where statut = 'confirme' and jour between p_du and v_au
  on conflict do nothing;

  select count(*) into v_n from ana.facteur_jour where jour between p_du and v_au;
  return jsonb_build_object('lignes', v_n, 'du', p_du, 'au', v_au,
    'par_facteur', (select jsonb_object_agg(facteur, n) from (select facteur, count(*) n from ana.facteur_jour group by 1) z),
    'medecins_charges', (select count(*) from ana.centre_jour_medecin));
end $$;

-- 5. Tests de causalité ------------------------------------------------------------------------------
create table if not exists ana.causalite (
  facteur text primary key references ana.facteur_def (facteur) on delete cascade,
  n_jours int, effet_pct numeric, ic_bas numeric, ic_haut numeric,
  effet_ajuste_pct numeric, placebo_pct numeric, placebo_ic_bas numeric, placebo_ic_haut numeric,
  veille_pct numeric, dose jsonb, coherence_pct numeric, provinces int,
  verdict text, explication text, calcule_le timestamptz default now()
);

create or replace function ana.fn_tester_causalite(p_du date default '2023-10-19', p_au date default null)
returns table (facteur text, libelle text, n_jours int, effet_pct numeric, effet_ajuste_pct numeric, placebo_pct numeric,
               veille_pct numeric, coherence_pct numeric, verdict text)
language plpgsql security definer set search_path = ana, sup, public, pg_temp as $$
#variable_conflict use_column
declare v_au date := coalesce(p_au, (select max(day) from sup.agg_centre_day)); k record;
        r record; p record; v record; adj numeric; coh record; dose jsonb; vd text; ex text;
        sig boolean; plac_nul boolean; contra text[];
begin
  -- base : ratio observé / attendu, jours ouvrés avec activité attendue
  drop table if exists t29_ball;
  create temp table t29_ball as
  select b.centre_id, b.province, b.region, b.jour, (b.n::numeric + 0.5) / (b.attendu + 0.5) as ratio,
         b.jour in (select k.day from sup.ref_calendar k where k.scope = 'national' and k.kind in ('holiday', 'religious')) as est_ferie
  from ana.fn_base(p_du, v_au) b where b.attendu >= 3 and b.act_avant > 0 and extract(isodow from b.jour) <> 7;
  -- jours-unités avec un événement météo quelconque (exclus des témoins des facteurs météo)
  drop table if exists t29_meteo;
  create temp table t29_meteo as
  select distinct f.centre_id, f.jour from ana.facteur_jour f join ana.facteur_def d using (facteur) where d.famille = 'Météo';
  create index on t29_meteo (centre_id, jour);

  for k in select d.* from ana.facteur_def d order by d.famille, d.facteur loop
    -- les jours de fermeture nationale ne servent qu'au facteur « jour férié »
    drop table if exists t29_b;
    create temp table t29_b as select * from t29_ball where k.facteur = 'ferie' or not est_ferie;
    create index on t29_b (centre_id, jour);
    create index on t29_b (region, jour);
    drop table if exists t29_f;
    create temp table t29_f as select f.centre_id, f.jour, f.valeur from ana.facteur_jour f where f.facteur = k.facteur;
    create index on t29_f (centre_id, jour);

    -- T1 association
    select count(*) filter (where f.centre_id is not null) as n,
           avg(b.ratio) filter (where f.centre_id is not null) as m1, stddev_samp(b.ratio) filter (where f.centre_id is not null) as s1,
           avg(b.ratio) filter (where f.centre_id is null) as m0
      into r
    from t29_b b left join t29_f f on f.centre_id = b.centre_id and f.jour = b.jour;
    if coalesce(r.n, 0) < 30 then
      insert into ana.causalite as c (facteur, n_jours, verdict, explication, calcule_le)
      values (k.facteur, coalesce(r.n, 0), 'trop peu de jours', 'Moins de 30 jours-unités avec ce facteur : à alimenter (enquêtes, référentiel).', now())
      on conflict (facteur) do update set n_jours = excluded.n_jours, effet_pct = null, ic_bas = null, ic_haut = null, effet_ajuste_pct = null,
        placebo_pct = null, placebo_ic_bas = null, placebo_ic_haut = null, veille_pct = null, dose = null, coherence_pct = null, provinces = null,
        verdict = excluded.verdict, explication = excluded.explication, calcule_le = now();
      continue;
    end if;

    -- T2 témoin du jour (unités sans le facteur, même région, même jour ; pour la météo : sans aucun événement météo)
    adj := null;
    if k.portee = 'unite' then
      select avg(b.ratio - t.m) into adj
      from t29_b b join t29_f f on f.centre_id = b.centre_id and f.jour = b.jour
      join lateral (select avg(b2.ratio) as m, count(*) as nn from t29_b b2
                    where b2.region = b.region and b2.jour = b.jour
                      and not exists (select 1 from t29_f f2 where f2.centre_id = b2.centre_id and f2.jour = b2.jour)
                      and (k.famille <> 'Météo' or not exists (select 1 from t29_meteo m where m.centre_id = b2.centre_id and m.jour = b2.jour))) t on t.nn >= 3
      having count(*) >= 30;   -- trop peu de jours avec des témoins : test non concluant
    end if;

    -- T3 placebo : le facteur déplacé de 10 jours (autre jour de semaine ; hors jours où il est réellement présent)
    select count(*) as n, avg(b.ratio) as m1, stddev_samp(b.ratio) as s1 into p
    from t29_f f join t29_b b on b.centre_id = f.centre_id and b.jour = f.jour - 10
    where not exists (select 1 from t29_f f2 where f2.centre_id = b.centre_id and f2.jour = b.jour);

    -- T4 antériorité : la veille (hors jours avec le facteur) ; seulement pour un facteur imprévisible
    select null::numeric as m1 into v;
    if k.imprevu and k.facteur <> 'pluie_veille' then
      select avg(b.ratio) as m1 into v
      from t29_f f join t29_b b on b.centre_id = f.centre_id and b.jour = f.jour - 1
      where not exists (select 1 from t29_f f2 where f2.centre_id = b.centre_id and f2.jour = b.jour);
    end if;

    -- T5 dose-réponse : effet par quartile d'intensité
    dose := null;
    if k.dose is not null then
      select jsonb_agg(jsonb_build_object('quartile', q, 'intensite_moyenne', round(iv, 1), 'effet_pct', round(100 * (m / r.m0 - 1), 1)) order by q) into dose
      from (select q, avg(valeur) iv, avg(ratio) m from (
              select f.valeur, b.ratio, ntile(4) over (order by f.valeur) q
              from t29_f f join t29_b b on b.centre_id = f.centre_id and b.jour = f.jour where f.valeur is not null) z group by q) y;
    end if;

    -- T6 cohérence entre provinces (au moins 5 jours avec le facteur dans la province)
    select count(*) as provinces,
           100.0 * count(*) filter (where sign(m1 - m0) = sign(r.m1 - r.m0)) / nullif(count(*), 0) as pct into coh
    from (select b.province, avg(b.ratio) filter (where f.centre_id is not null) m1, avg(b.ratio) filter (where f.centre_id is null) m0,
                 count(*) filter (where f.centre_id is not null) nf
          from t29_b b left join t29_f f on f.centre_id = b.centre_id and f.jour = b.jour group by b.province) z
    where nf >= 5 and m0 is not null;

    -- verdict
    sig := (r.m1 - 1.96 * coalesce(r.s1, 0) / sqrt(r.n)::numeric > r.m0) or (r.m1 + 1.96 * coalesce(r.s1, 0) / sqrt(r.n)::numeric < r.m0);
    plac_nul := p.n < 30 or abs(p.m1 / r.m0 - 1) < greatest(1.96 * coalesce(p.s1, 0) / sqrt(greatest(p.n, 1))::numeric / r.m0, 0.03)
                or abs(p.m1 / r.m0 - 1) < abs(r.m1 / r.m0 - 1) / 4;
    contra := array_remove(array[
      case when not plac_nul then 'le placebo (décalage de 10 jours) montre aussi un effet' end,
      case when adj is not null and (sign(adj) <> sign(r.m1 - r.m0) or abs(adj) < abs(r.m1 - r.m0) / 3)
           then 'l''effet disparaît face aux unités voisines du même jour (cause commune à la région ?)' end,
      case when k.imprevu and v.m1 is not null and abs(v.m1 / r.m0 - 1) > abs(r.m1 / r.m0 - 1) / 2 then 'la veille est déjà anormale (autre cause possible)' end,
      case when dose is not null and jsonb_array_length(dose) = 4
                and sign(((dose->3->>'effet_pct')::numeric) - ((dose->0->>'effet_pct')::numeric)) <> sign(r.m1 - r.m0)
                and k.facteur not in ('chaleur') then 'pas de relation dose-réponse' end,
      case when coh.provinces >= 3 and coh.pct < 70 then 'sens différent selon les provinces (' || round(coh.pct) || ' % seulement dans le même sens)' end
    ]::text[], null);
    -- taille d'effet : un effet de moins de 5 % est réel mais sans portée pratique ; une saison (fenêtre de plusieurs
    -- semaines) se confond avec la tendance et la saison elle-même : il lui faut au moins 8 % pour être retenue comme cause
    if k.nature = 'mesure' then
      vd := 'artefact de saisie';
    elsif sig and abs(r.m1 / r.m0 - 1) < 0.05 then
      vd := 'effet faible';
    elsif sig and k.facteur in ('vacances', 'rentree', 'examens', 'moisson', 'olives') and abs(r.m1 / r.m0 - 1) < 0.08 then
      vd := 'association';
      contra := contra || 'effet modeste sur une longue période, confondu possible avec la saison et la tendance'::text;
    else
      vd := case when not sig then 'pas d''effet démontré'
                 when cardinality(contra) = 0 then 'cause probable'
                 else 'association' end;
    end if;
    ex := case vd
      when 'cause probable' then 'Effet significatif, placebo nul' ||
           case when adj is not null then ', confirmé face aux unités voisines du même jour' else '' end ||
           case when dose is not null then ', relation dose-réponse' else '' end ||
           case when coh.provinces >= 3 then ', même sens dans ' || round(coh.pct) || ' % des provinces' else '' end || '.'
      when 'association' then 'Lien statistique, mais ' || array_to_string(contra, ' ; ') || '.'
      when 'effet faible' then 'Effet statistiquement net mais inférieur à 5 % : sans portée pratique pour le pilotage.'
      when 'artefact de saisie' then 'Lien mécanique avec la façon de saisir (synchronisation en bloc) : à traiter comme un problème de qualité des données, pas comme un facteur de venue.'
      else 'L''intervalle de confiance contient zéro.' end;

    insert into ana.causalite as c (facteur, n_jours, effet_pct, ic_bas, ic_haut, effet_ajuste_pct, placebo_pct, placebo_ic_bas, placebo_ic_haut,
                                    veille_pct, dose, coherence_pct, provinces, verdict, explication, calcule_le)
    values (k.facteur, r.n, round(100 * (r.m1 / r.m0 - 1), 1),
            round(100 * ((r.m1 - 1.96 * coalesce(r.s1, 0) / sqrt(r.n)::numeric) / r.m0 - 1), 1),
            round(100 * ((r.m1 + 1.96 * coalesce(r.s1, 0) / sqrt(r.n)::numeric) / r.m0 - 1), 1),
            round(100 * adj / r.m0, 1),
            round(100 * (p.m1 / r.m0 - 1), 1),
            round(100 * ((p.m1 - 1.96 * coalesce(p.s1, 0) / sqrt(greatest(p.n, 1))::numeric) / r.m0 - 1), 1),
            round(100 * ((p.m1 + 1.96 * coalesce(p.s1, 0) / sqrt(greatest(p.n, 1))::numeric) / r.m0 - 1), 1),
            round(100 * (v.m1 / r.m0 - 1), 1), dose, round(coh.pct, 0), coh.provinces, vd, ex, now())
    on conflict (facteur) do update set n_jours = excluded.n_jours, effet_pct = excluded.effet_pct, ic_bas = excluded.ic_bas, ic_haut = excluded.ic_haut,
      effet_ajuste_pct = excluded.effet_ajuste_pct, placebo_pct = excluded.placebo_pct, placebo_ic_bas = excluded.placebo_ic_bas,
      placebo_ic_haut = excluded.placebo_ic_haut, veille_pct = excluded.veille_pct, dose = excluded.dose, coherence_pct = excluded.coherence_pct,
      provinces = excluded.provinces, verdict = excluded.verdict, explication = excluded.explication, calcule_le = now();
  end loop;

  return query
  select c.facteur, d.libelle, c.n_jours, c.effet_pct, c.effet_ajuste_pct, c.placebo_pct, c.veille_pct, c.coherence_pct, c.verdict
  from ana.causalite c join ana.facteur_def d using (facteur)
  order by case c.verdict when 'cause probable' then 1 when 'association' then 2 when 'effet faible' then 3 when 'pas d''effet démontré' then 4 when 'artefact de saisie' then 5 else 6 end,
           abs(c.effet_pct) desc nulls last;
end $$;

-- 6. API du tableau de bord -----------------------------------------------------------------------------
create or replace function public.ui_causalite(p_token text)
returns jsonb language plpgsql security definer set search_path = ana, sup, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'facteur', c.facteur, 'libelle', d.libelle, 'famille', d.famille, 'portee', d.portee, 'source', d.source, 'remarque', d.remarque,
            'n_jours', c.n_jours, 'effet_pct', c.effet_pct, 'ic_bas', c.ic_bas, 'ic_haut', c.ic_haut,
            'effet_ajuste_pct', c.effet_ajuste_pct, 'placebo_pct', c.placebo_pct, 'veille_pct', c.veille_pct,
            'dose', c.dose, 'coherence_pct', c.coherence_pct, 'provinces', c.provinces,
            'verdict', c.verdict, 'explication', c.explication, 'calcule_le', c.calcule_le)
          order by case c.verdict when 'cause probable' then 1 when 'association' then 2 when 'effet faible' then 3 when 'pas d''effet démontré' then 4 when 'artefact de saisie' then 5 else 6 end,
                   abs(c.effet_pct) desc nulls last), '[]'::jsonb)
          from ana.causalite c join ana.facteur_def d using (facteur));
end $$;
revoke all on function public.ui_causalite(text) from public, authenticated;
grant execute on function public.ui_causalite(text) to anon, service_role;
revoke all on all functions in schema ana from public, anon, authenticated;
revoke all on all tables in schema ana from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'facteurs et causalité installés' as statut, (select count(*) from ana.facteur_def) as facteurs,
       (select count(*) from ana.centre_jour_medecin) as jours_medecin_charges;
