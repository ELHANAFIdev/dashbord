-- =====================================================================
-- 21 — Population RGPH 2024 par province (HCP) et indicateurs rapportés à la population
--   Studio : coller, Run. Rejouable. Prérequis : 20 (schéma ana), 01 (sup.ref_centre), 12 (agrégats).
--   Population légale au 1er septembre 2024 (décret n° 2.24.1009), 75 provinces et préfectures, total 36 828 330.
--   API : ui_population (clé anon + jeton).
-- =====================================================================
create schema if not exists ana;
create table if not exists ana.population_province (
  province text primary key, region text not null, population int not null check (population > 0), menages int,
  population_urbaine int, population_rurale int, source text not null, charge_le timestamptz default now());
create table if not exists ana.population_correspondance (nom_base text primary key, province text not null);

-- Nom de province normalisé (sans « Province de », « Préfecture d' », accents, tirets, casse)
create or replace function ana.fn_nom_province(p text) returns text language sql immutable as $$
  select regexp_replace(lower(translate(regexp_replace(coalesce(p, ''), '^(Province|Préfecture|Prefecture)( de la| de l''| des| du| de| d'')?\s*', '', 'i'),
         'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç''’', 'AAAEEEEIIOOUUUCaaaeeeeiioouuuc  ')), '[^a-z]+', '', 'g')
$$;

-- Données HCP, RGPH 2024 (population légale au 1er septembre 2024), décret n° 2.24.1009. Source : https://www.hcp.ma/file/242342/
insert into ana.population_province (region, province, population, menages, population_urbaine, population_rurale, source) values
 ('Tanger-Tétouan-Al Hoceïma', 'Tanger-Assilah', 1494413, 418844, 1402668, 91745, 'HCP, RGPH 2024 (population légale)'),
 ('Tanger-Tétouan-Al Hoceïma', 'M''diq-Fnideq', 254064, 67797, 240745, 13319, 'HCP, RGPH 2024 (population légale)'),
 ('Tanger-Tétouan-Al Hoceïma', 'Tétouan', 611928, 157384, 440054, 171874, 'HCP, RGPH 2024 (population légale)'),
 ('Tanger-Tétouan-Al Hoceïma', 'Fahs-Anjra', 100789, 25160, 3763, 97026, 'HCP, RGPH 2024 (population légale)'),
 ('Tanger-Tétouan-Al Hoceïma', 'Larache', 510211, 124642, 275450, 234761, 'HCP, RGPH 2024 (population légale)'),
 ('Tanger-Tétouan-Al Hoceïma', 'Al Hoceima', 371527, 89181, 138977, 232550, 'HCP, RGPH 2024 (population légale)'),
 ('Tanger-Tétouan-Al Hoceïma', 'Chefchaouen', 412713, 90956, 62632, 350081, 'HCP, RGPH 2024 (population légale)'),
 ('Tanger-Tétouan-Al Hoceïma', 'Ouezzane', 274577, 74896, 74526, 200051, 'HCP, RGPH 2024 (population légale)'),
 ('L''Oriental', 'Oujda-Angad', 572454, 148929, 518150, 54304, 'HCP, RGPH 2024 (population légale)'),
 ('L''Oriental', 'Nador', 565987, 146090, 388378, 177609, 'HCP, RGPH 2024 (population légale)'),
 ('L''Oriental', 'Driouch', 188191, 48849, 58347, 129844, 'HCP, RGPH 2024 (population légale)'),
 ('L''Oriental', 'Jerada', 103527, 23833, 62722, 40805, 'HCP, RGPH 2024 (population légale)'),
 ('L''Oriental', 'Berkane', 284061, 75643, 175510, 108551, 'HCP, RGPH 2024 (population légale)'),
 ('L''Oriental', 'Taourirt', 220157, 50028, 145501, 74656, 'HCP, RGPH 2024 (population légale)'),
 ('L''Oriental', 'Guercif', 215837, 47538, 80703, 135134, 'HCP, RGPH 2024 (population légale)'),
 ('L''Oriental', 'Figuig', 144451, 34105, 76403, 68048, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'Fès', 1256172, 329286, 1231023, 25149, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'Meknès', 942945, 248296, 780290, 162655, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'El Hajeb', 267156, 66258, 142035, 125121, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'Ifrane', 160904, 42684, 88895, 72009, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'Moulay Yacoub', 216954, 46348, 53378, 163576, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'Sefrou', 304748, 81262, 172891, 131857, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'Boulemane', 205411, 48509, 76063, 129348, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'Taounate', 612650, 147051, 98078, 514572, 'HCP, RGPH 2024 (population légale)'),
 ('Fès-Meknès', 'Taza', 500971, 126023, 212713, 288258, 'HCP, RGPH 2024 (population légale)'),
 ('Rabat-Salé-Kénitra', 'Rabat', 515619, 157183, 515619, 0, 'HCP, RGPH 2024 (population légale)'),
 ('Rabat-Salé-Kénitra', 'Salé', 1089554, 290311, 1012670, 76884, 'HCP, RGPH 2024 (population légale)'),
 ('Rabat-Salé-Kénitra', 'Skhirate-Témara', 783475, 208316, 735707, 47768, 'HCP, RGPH 2024 (population légale)'),
 ('Rabat-Salé-Kénitra', 'Kénitra', 1284247, 300046, 744099, 540148, 'HCP, RGPH 2024 (population légale)'),
 ('Rabat-Salé-Kénitra', 'Khémisset', 563036, 146516, 307932, 255104, 'HCP, RGPH 2024 (population légale)'),
 ('Rabat-Salé-Kénitra', 'Sidi Kacem', 545509, 122538, 176091, 369418, 'HCP, RGPH 2024 (population légale)'),
 ('Rabat-Salé-Kénitra', 'Sidi Slimane', 351199, 76582, 135060, 216139, 'HCP, RGPH 2024 (population légale)'),
 ('Béni Mellal-Khénifra', 'Béni Mellal', 580327, 150397, 350703, 229624, 'HCP, RGPH 2024 (population légale)'),
 ('Béni Mellal-Khénifra', 'Azilal', 574112, 121842, 113211, 460901, 'HCP, RGPH 2024 (population légale)'),
 ('Béni Mellal-Khénifra', 'Fquih Ben Salah', 475977, 111668, 202338, 273639, 'HCP, RGPH 2024 (population légale)'),
 ('Béni Mellal-Khénifra', 'Khénifra', 370240, 100159, 244643, 125597, 'HCP, RGPH 2024 (population légale)'),
 ('Béni Mellal-Khénifra', 'Khouribga', 525145, 132500, 372597, 152548, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'Casablanca', 3218036, 909829, 3218036, 0, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'Mohammadia', 514057, 137265, 397315, 116742, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'El Jadida', 914367, 221678, 376148, 538219, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'Nouaceur', 672324, 183539, 572840, 99484, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'Médiouna', 345787, 88190, 173968, 171819, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'Benslimane', 279517, 69353, 152178, 127339, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'Berrechid', 640657, 160957, 405860, 234797, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'Settat', 652292, 148224, 247089, 405203, 'HCP, RGPH 2024 (population légale)'),
 ('Casablanca-Settat', 'Sidi Bennour', 451930, 101997, 90314, 361616, 'HCP, RGPH 2024 (population légale)'),
 ('Marrakech-Safi', 'Marrakech', 1571580, 402389, 1134473, 437107, 'HCP, RGPH 2024 (population légale)'),
 ('Marrakech-Safi', 'Chichaoua', 379079, 92262, 84361, 294718, 'HCP, RGPH 2024 (population légale)'),
 ('Marrakech-Safi', 'Al Haouz', 642815, 147971, 132875, 509940, 'HCP, RGPH 2024 (population légale)'),
 ('Marrakech-Safi', 'El Kelâa des Sraghna', 560273, 125161, 177696, 382577, 'HCP, RGPH 2024 (population légale)'),
 ('Marrakech-Safi', 'Essaouira', 426719, 111602, 115467, 311252, 'HCP, RGPH 2024 (population légale)'),
 ('Marrakech-Safi', 'Rehamna', 346108, 76166, 133645, 212463, 'HCP, RGPH 2024 (population légale)'),
 ('Marrakech-Safi', 'Safi', 719671, 175259, 369861, 349810, 'HCP, RGPH 2024 (population légale)'),
 ('Marrakech-Safi', 'Youssoufia', 246148, 55055, 100576, 145572, 'HCP, RGPH 2024 (population légale)'),
 ('Drâa-Tafilalet', 'Errachidia', 427572, 90107, 199190, 228382, 'HCP, RGPH 2024 (population légale)'),
 ('Drâa-Tafilalet', 'Ouarzazate', 304932, 66420, 129527, 175405, 'HCP, RGPH 2024 (population légale)'),
 ('Drâa-Tafilalet', 'Midelt', 313769, 73708, 145700, 168069, 'HCP, RGPH 2024 (population légale)'),
 ('Drâa-Tafilalet', 'Tinghir', 323805, 62123, 79824, 243981, 'HCP, RGPH 2024 (population légale)'),
 ('Drâa-Tafilalet', 'Zagora', 285545, 46619, 53483, 232062, 'HCP, RGPH 2024 (population légale)'),
 ('Souss-Massa', 'Agadir-Ida-Ou-Tanane', 721431, 197248, 628004, 93427, 'HCP, RGPH 2024 (population légale)'),
 ('Souss-Massa', 'Inezgane-Aït Melloul', 636916, 161551, 605684, 31232, 'HCP, RGPH 2024 (population légale)'),
 ('Souss-Massa', 'Chtouka-Aït Baha', 493623, 133727, 172143, 321480, 'HCP, RGPH 2024 (population légale)'),
 ('Souss-Massa', 'Taroudannt', 858162, 209341, 277865, 580297, 'HCP, RGPH 2024 (population légale)'),
 ('Souss-Massa', 'Tiznit', 198542, 57811, 92719, 105823, 'HCP, RGPH 2024 (population légale)'),
 ('Souss-Massa', 'Tata', 111757, 25530, 39687, 72070, 'HCP, RGPH 2024 (population légale)'),
 ('Guelmim-Oued Noun', 'Guelmim', 196267, 47250, 153238, 43029, 'HCP, RGPH 2024 (population légale)'),
 ('Guelmim-Oued Noun', 'Assa-Zag', 53298, 6297, 20357, 32941, 'HCP, RGPH 2024 (population légale)'),
 ('Guelmim-Oued Noun', 'Tan-Tan', 94519, 23308, 90392, 4127, 'HCP, RGPH 2024 (population légale)'),
 ('Guelmim-Oued Noun', 'Sidi Ifni', 104601, 28539, 35556, 69045, 'HCP, RGPH 2024 (population légale)'),
 ('Laâyoune-Sakia El Hamra', 'Laâyoune', 295555, 73866, 291639, 3916, 'HCP, RGPH 2024 (population légale)'),
 ('Laâyoune-Sakia El Hamra', 'Boujdour', 65381, 14429, 57360, 8021, 'HCP, RGPH 2024 (population légale)'),
 ('Laâyoune-Sakia El Hamra', 'Tarfaya', 16228, 4328, 11030, 5198, 'HCP, RGPH 2024 (population légale)'),
 ('Laâyoune-Sakia El Hamra', 'Es-Semara', 73864, 14128, 56607, 17257, 'HCP, RGPH 2024 (population légale)'),
 ('Dakhla-Oued Ed-Dahab', 'Oued Ed-Dahab', 195467, 51740, 165463, 30004, 'HCP, RGPH 2024 (population légale)'),
 ('Dakhla-Oued Ed-Dahab', 'Aousserd', 24498, 2421, 11373, 13125, 'HCP, RGPH 2024 (population légale)')
on conflict (province) do update set region = excluded.region, population = excluded.population, menages = excluded.menages,
  population_urbaine = excluded.population_urbaine, population_rurale = excluded.population_rurale, source = excluded.source;
insert into ana.population_correspondance (nom_base, province) values
 ('Préfecture d''Oujda-Angad', 'Oujda-Angad'),
 ('Province d''Al Haouz', 'Al Haouz'),
 ('Province d''Al Hoceima', 'Al Hoceima'),
 ('Province d''Azilal', 'Azilal'),
 ('Province de Béni Mellal', 'Béni Mellal'),
 ('Province de Boulemane', 'Boulemane'),
 ('Province de Chefchaouen', 'Chefchaouen'),
 ('Province de Chichaoua', 'Chichaoua'),
 ('Province de Chtouka-Aït Baha', 'Chtouka-Aït Baha'),
 ('Province de Driouch', 'Driouch'),
 ('Province de Figuig', 'Figuig'),
 ('Province de Guercif', 'Guercif'),
 ('Province de Jerada', 'Jerada'),
 ('Province de Khémisset', 'Khémisset'),
 ('Province de Khénifra', 'Khénifra'),
 ('Province de Larache', 'Larache'),
 ('Province d''El Kelâa Des-Sraghna', 'El Kelâa des Sraghna'),
 ('Province de Midelt', 'Midelt'),
 ('Province de Moulay Yacoub', 'Moulay Yacoub'),
 ('Province de Nador', 'Nador'),
 ('Province de Rehamna', 'Rehamna'),
 ('Province d''Errachidia', 'Errachidia'),
 ('Province de Safi', 'Safi'),
 ('Province de Sefrou', 'Sefrou'),
 ('Province de Settat', 'Settat'),
 ('Province de Sidi Bennour', 'Sidi Bennour'),
 ('Province de Sidi Kacem', 'Sidi Kacem'),
 ('Province d''Essaouira', 'Essaouira'),
 ('Province de Taounate', 'Taounate'),
 ('Province de Taourirt', 'Taourirt'),
 ('Province de Taroudannt', 'Taroudannt'),
 ('Province de Tata', 'Tata'),
 ('Province de Taza', 'Taza'),
 ('Province de Tinghir', 'Tinghir'),
 ('Province de Tiznit', 'Tiznit'),
 ('Province de Youssoufia', 'Youssoufia'),
 ('Province de Zagora', 'Zagora'),
 ('Province d''Ifrane', 'Ifrane'),
 ('Province d''Ouarzazate', 'Ouarzazate'),
 ('Province d''Ouezzane', 'Ouezzane'),
 ('Province de Berkane', 'Berkane')
on conflict (nom_base) do update set province = excluded.province;

-- Province RGPH de chaque unité : correspondance explicite, sinon nom normalisé
create or replace view ana.v_centre_population as
select r.centre_id, r.centre_name, r.province as province_base, r.region as region_base,
       p.province, p.region, p.population, p.menages
from sup.ref_centre r
left join ana.population_correspondance c on c.nom_base = r.province
left join ana.population_province p on p.province = coalesce(c.province,
       (select p2.province from ana.population_province p2 where ana.fn_nom_province(p2.province) = ana.fn_nom_province(r.province) limit 1));

create or replace function public.ui_population(p_token text)
returns jsonb language plpgsql security definer set search_path = ana, sup, flux, public, pg_temp as $$
declare v_fin date := (select max(day) from sup.agg_centre_day); v_pat jsonb := '{}'::jsonb;
begin
  perform sup.api_check(p_token);
  -- patients distincts sur 12 mois par province (si les indicateurs de flux sont chargés)
  if to_regclass('flux.consultation_fait') is not null then
    execute $q$select coalesce(jsonb_object_agg(province, n), '{}'::jsonb) from (
               select v.province, count(distinct f.patient_id) n
               from flux.consultation_fait f join ana.v_centre_population v using (centre_id)
               where f.jour > $1 - 365 and f.jour <= $1 and v.province is not null group by 1) x$q$ into v_pat using v_fin;
  end if;
  return (select coalesce(jsonb_agg(x order by x.region, x.province), '[]'::jsonb) from (
    select p.region, p.province, p.population, p.menages, p.population_rurale,
           count(distinct v.centre_id) as centres,
           coalesce(sum(a.n), 0) as consultations_12_mois,
           round(1000.0 * coalesce(sum(a.n), 0) / p.population, 1) as pour_1000_hab_an,
           (v_pat ->> p.province)::int as patients_12_mois,
           round(100.0 * (v_pat ->> p.province)::numeric / p.population, 2) as couverture_pct,
           round(p.population::numeric / nullif(count(distinct v.centre_id), 0)) as habitants_par_unite,
           p.source
    from ana.population_province p
    join ana.v_centre_population v on v.province = p.province
    left join lateral (select sum(n_consultations) as n from sup.agg_centre_day d
                       where d.centre_id = v.centre_id and d.day > v_fin - 365 and d.day <= v_fin) a on true
    group by p.region, p.province, p.population, p.menages, p.population_rurale, p.source) x);
end $$;
revoke all on function public.ui_population(text) from public, authenticated;
grant execute on function public.ui_population(text) to anon, service_role;
revoke all on all tables in schema ana from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'population chargée' as statut, (select count(*) from ana.population_province) as provinces,
       (select sum(population) from ana.population_province) as total,
       (select count(*) from ana.v_centre_population where province is not null) as unites_rattachees,
       (select coalesce(string_agg(distinct province_base, ', '), 'aucune') from ana.v_centre_population where province is null) as provinces_non_rattachees;
