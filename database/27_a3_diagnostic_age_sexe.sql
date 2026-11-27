-- =====================================================================
-- 27 — Diagnostic : peut-on lire le sexe et l'âge des patients dans la copie MediFus ?
--   Studio : coller, Run. Lecture seule : ne modifie rien dans MediFus.
--   Ajoute seulement, côté Supabase local, une table étrangère qui lit le catalogue distant (information_schema).
--   Résultat attendu après l'ouverture du droit : lecture_patients = ok, puis
--     select a3.fn_so_completer_sujet(true);   -- complète sexe et âge des seconds avis déjà enregistrés
-- =====================================================================
create foreign table if not exists medifus_src.distant_colonnes (
  table_schema text, table_name text, column_name text, data_type text)
  server medifus options (schema_name 'information_schema', table_name 'columns');
revoke all on medifus_src.distant_colonnes from public, anon, authenticated;

drop table if exists t27;
create temp table t27 (ordre int, controle text, resultat text);

-- 1. Lecture des tables patients et users
do $$
declare v text;
begin
  begin execute 'select count(*) from (select 1 from medifus_src.patients limit 1) x' into v; insert into t27 values (1, 'lecture patients', 'ok');
  exception when others then insert into t27 values (1, 'lecture patients', 'REFUSÉE : ' || sqlerrm); end;
  begin execute 'select count(*) from (select 1 from medifus_src.users limit 1) x' into v; insert into t27 values (2, 'lecture users', 'ok');
  exception when others then insert into t27 values (2, 'lecture users', 'REFUSÉE : ' || sqlerrm); end;
end $$;

-- 2. Colonnes distantes lisibles qui peuvent contenir le sexe, la naissance ou l'âge (toutes tables)
insert into t27
select 3, 'colonnes candidates lisibles (table.colonne : type)',
       coalesce(string_agg(table_name || '.' || column_name || ' : ' || data_type, ', ' order by table_name, column_name), 'aucune')
from medifus_src.distant_colonnes
where table_schema = 'public'
  and column_name ~* '(gender|sex|sexe|birth|naissance|dob|^age$|age_|_age$|ageyears|patientage)';

-- 3. Tables distantes lisibles (pour repérer une autre source : profils, admissions, dossiers…)
insert into t27
select 4, 'tables distantes lisibles', string_agg(distinct table_name, ', ' order by table_name)
from medifus_src.distant_colonnes where table_schema = 'public';

-- 4. Compte utilisé par le lien (nom seulement, jamais le mot de passe)
insert into t27
select 5, 'compte distant du lien medifus', coalesce(max(o.option_value), 'inconnu')
from pg_user_mappings um cross join lateral pg_options_to_table(um.umoptions) o
where um.srvname = 'medifus' and o.option_name = 'user';

-- 5. Essai sur une consultation récente
insert into t27
select 6, 'essai sur une consultation', a3.fn_sujet((select max(id) from medifus_src.consultations where created_at >= now() - interval '5 years'))::text;

-- 6. Seconds avis déjà enregistrés avec sexe ou âge
insert into t27
select 7, 'seconds avis avec sexe ou âge', count(*) filter (where sexe is not null or age is not null) || ' / ' || count(*)
from a3.so_resultat;

select controle, resultat from t27 order by ordre;
