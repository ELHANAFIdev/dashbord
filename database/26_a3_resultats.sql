-- =====================================================================
-- 26 — Résultats du second avis A3 dans la base locale (pour le tableau de bord)
--   Studio : coller, Run. Rejouable. Prérequis : 06b (jetons), 14 (schéma a3).
--   Écriture : le workflow A3 (v7.2) appelle a3_so_enregistrer avec le jeton a3, une fois par consultation.
--   Lecture : le tableau de bord appelle ui_second_avis (jeton ui) ; validation : ui_so_revue.
--   Contenu gardé : la sortie du modèle déjà contrôlée (aucun identifiant : contrôles VerifyScrub,
--   LeakCheck, SemanticCheck), l'unité, le jour, le sexe et l'âge. Aucun nom, téléphone, CIN, adresse ni date de naissance.
--   Sexe et âge : envoyés par le workflow (v7.3), sinon lus dans patients (droit de lecture MediFus requis, voir 27).
--   Import des lignes déjà dans le Google Sheet : fichier 26b (à supprimer après l'import).
-- =====================================================================
create schema if not exists a3;

create table if not exists a3.so_resultat (
  version_key      text primary key,
  consultation_id  bigint not null,
  run_id           text,
  statut           text not null,          -- SUCCESS, QUARANTINED, FAILED_FINAL, ERROR, BLOCKED_CONFIG
  review_priority  text,                   -- ROUTINE, MEDIUM, HIGH, CRITICAL
  summary          text,
  red_flags        jsonb,
  confidence       text,
  signaux          jsonb,                  -- signaux de priorité et compteurs de dé-identification (SUCCESS)
  raison           text,                   -- raison de l'échec ou de la quarantaine
  output           jsonb,                  -- second avis complet (format so-v3)
  workflow_version text,
  prompt_version   text,
  model            text,
  cree_le          timestamptz not null default now(),
  centre_id        int,
  jour             date,
  enregistre_le    timestamptz not null default now()
);
alter table a3.so_resultat add column if not exists sexe text;            -- female / male
alter table a3.so_resultat add column if not exists age int;              -- âge à la consultation (la date de naissance n'est pas gardée)
alter table a3.so_resultat add column if not exists sujet_source text;    -- workflow, patients, ou refus : <raison>
create index if not exists so_resultat_consultation on a3.so_resultat (consultation_id, cree_le desc);

create table if not exists a3.so_revue (
  version_key text primary key references a3.so_resultat (version_key) on delete cascade,
  verdict     text not null check (verdict in ('accepte', 'modifie', 'rejete')),
  commentaire text,
  par         text not null,
  le          timestamptz not null default now()
);
revoke all on a3.so_resultat, a3.so_revue from public, anon, authenticated;

-- Texte → jsonb sans erreur (un JSON coupé ou vide donne null)
create or replace function a3.fn_json(p jsonb) returns jsonb language plpgsql immutable as $$
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) <> 'string' then return p; end if;
  if btrim(p #>> '{}') = '' then return null; end if;
  return (p #>> '{}')::jsonb;
exception when others then return null;
end $$;

-- Sexe et âge d'une consultation, lus dans la copie MediFus (patients, puis users).
-- Demande le droit de lecture sur patients côté MediFus (voir 27_a3_diagnostic_age_sexe.sql).
create or replace function a3.fn_sujet(p_consultation_id bigint) returns jsonb
language plpgsql stable security definer set search_path = a3, medifus_src, public, pg_temp as $$
declare v_pat text; v_jour date; pj jsonb; uj jsonb; v_uid text; v_sex text; v_birth date; v_age int; v_age_txt text;
begin
  select x."patientId"::text, x.created_at::date into v_pat, v_jour from medifus_src.consultations x where x.id = p_consultation_id;
  if v_pat is null then return jsonb_build_object('source', 'refus : consultation sans patient'); end if;
  begin
    execute format('select to_jsonb(p) from medifus_src.patients p where p.id = $1::%s', a3.fn_idtype('patients')) into pj using v_pat;
  exception when others then return jsonb_build_object('source', 'refus : ' || left(sqlerrm, 120));
  end;
  v_uid := nullif(coalesce(pj->>'userId', pj->>'user_id'), '');
  if v_uid is not null then
    begin
      execute format('select to_jsonb(u) from medifus_src.users u where u.id = $1::%s', a3.fn_idtype('users')) into uj using v_uid;
    exception when others then uj := null;
    end;
  end if;
  v_sex := lower(coalesce(pj->>'gender', pj->>'sex', pj->>'sexe', uj->>'gender', uj->>'sex'));
  v_birth := nullif(left(coalesce(pj->>'birthDate', pj->>'birth_date', pj->>'dateOfBirth', pj->>'date_of_birth', pj->>'birthday',
                                  uj->>'birthDate', uj->>'birth_date', uj->>'dateOfBirth'), 10), '')::date;
  if v_birth is not null then
    v_age := extract(year from age(v_jour, v_birth))::int;
  else
    v_age_txt := coalesce(pj->>'age', uj->>'age');
    if v_age_txt ~ '^[0-9]{1,3}$' then v_age := v_age_txt::int; end if;
  end if;
  if v_age < 0 or v_age > 129 then v_age := null; end if;
  return jsonb_build_object(
    'sexe', case when v_sex ~ '^(female|femme|f|feminin|féminin|woman)$' then 'female'
                 when v_sex ~ '^(male|homme|m|masculin|man)$' then 'male' end,
    'age', v_age, 'source', 'patients');
exception when others then return jsonb_build_object('source', 'refus : ' || left(sqlerrm, 120));
end $$;
revoke all on function a3.fn_sujet(bigint) from public, anon, authenticated;

-- Complète sexe et âge des résultats qui n'en ont pas (à relancer après l'ouverture du droit de lecture)
create or replace function a3.fn_so_completer_sujet(p_tout boolean default false) returns jsonb
language plpgsql security definer set search_path = a3, public, pg_temp as $$
declare v_n int;
begin
  with c as materialized (
    select distinct consultation_id from a3.so_resultat
    where sexe is null and age is null and (p_tout or sujet_source is null)),
  j as materialized (select consultation_id, a3.fn_sujet(consultation_id) as s from c)
  update a3.so_resultat r set sexe = j.s->>'sexe', age = (j.s->>'age')::int, sujet_source = j.s->>'source'
  from j where r.consultation_id = j.consultation_id and r.sexe is null and r.age is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('lignes', v_n,
    'avec_sexe_ou_age', (select count(*) from a3.so_resultat where sexe is not null or age is not null),
    'refus', (select max(sujet_source) from a3.so_resultat where sujet_source like 'refus%'));
end $$;
revoke all on function a3.fn_so_completer_sujet(boolean) from public, anon, authenticated;

create or replace function a3.fn_client(p_token text) returns text
language sql stable security definer set search_path = sup, pg_temp as $$
  select name from sup.api_client
  where enabled and token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') $$;
revoke all on function a3.fn_client(text) from public, anon, authenticated;

-- Enregistre une ligne (objet) ou plusieurs (tableau), aux noms de colonnes du Sheet so_records
create or replace function a3.fn_so_enregistrer(p jsonb)
returns jsonb language plpgsql security definer set search_path = a3, medifus_src, public, pg_temp as $$
declare v_n int; v_ids bigint[]; v_c int;
begin
  with src as (
    select r from jsonb_array_elements(case jsonb_typeof(p) when 'array' then p else jsonb_build_array(p) end) r),
  l as (
    select nullif(r->>'version_key', '') as version_key,
           nullif(r->>'consultation_id', '')::bigint as consultation_id,
           nullif(r->>'run_id', '') as run_id,
           upper(coalesce(nullif(r->>'status', ''), 'ERROR')) as statut,
           nullif(upper(r->>'review_priority'), '') as review_priority,
           nullif(r->>'summary', '') as summary,
           a3.fn_json(r->'red_flags') as red_flags,
           nullif(r->>'confidence', '') as confidence,
           a3.fn_json(r->'signals_or_reason') as sig,
           r->>'signals_or_reason' as sig_txt,
           a3.fn_json(coalesce(r->'output_json', r->'output')) as output,
           nullif(r->>'workflow_version', '') as workflow_version,
           nullif(r->>'prompt_version', '') as prompt_version,
           nullif(r->>'model', '') as model,
           coalesce(nullif(r->>'created_at', '')::timestamptz, now()) as cree_le,
           r->'subject'->>'sexe' as sexe,
           case when r->'subject'->>'age' ~ '^[0-9]{1,3}$' then (r->'subject'->>'age')::int end as age
    from src)
  insert into a3.so_resultat as t (version_key, consultation_id, run_id, statut, review_priority, summary, red_flags, confidence,
                                   signaux, raison, output, workflow_version, prompt_version, model, cree_le, sexe, age, sujet_source)
  select version_key, consultation_id, run_id, statut,
         case when review_priority in ('ROUTINE','MEDIUM','HIGH','CRITICAL') then review_priority end,
         summary, red_flags, confidence,
         case when jsonb_typeof(sig) = 'object' then sig end,
         case when jsonb_typeof(sig) = 'object' then null else left(sig_txt, 500) end,
         output, workflow_version, prompt_version, model, cree_le,
         case when sexe in ('female', 'male') then sexe end, case when age between 0 and 129 then age end,
         case when sexe is not null or age is not null then 'workflow' end
  from (select distinct on (version_key) * from l
        where version_key is not null and consultation_id is not null
        order by version_key, (statut = 'SUCCESS') desc, cree_le desc) l   -- une version relancée : le succès, sinon la plus récente
  on conflict (version_key) do update set
    run_id = excluded.run_id, statut = excluded.statut, review_priority = excluded.review_priority,
    summary = excluded.summary, red_flags = excluded.red_flags, confidence = excluded.confidence,
    signaux = excluded.signaux, raison = excluded.raison, output = excluded.output,
    workflow_version = excluded.workflow_version, prompt_version = excluded.prompt_version, model = excluded.model,
    cree_le = excluded.cree_le, enregistre_le = now(),
    sexe = coalesce(excluded.sexe, t.sexe), age = coalesce(excluded.age, t.age), sujet_source = coalesce(excluded.sujet_source, t.sujet_source)
  -- une ligne d'échec n'écrase jamais un succès déjà enregistré pour la même version
  where not (t.statut = 'SUCCESS' and excluded.statut <> 'SUCCESS');
  get diagnostics v_n = row_count;

  -- unité et jour de la consultation (lecture ciblée dans la copie MediFus)
  select array_agg(distinct consultation_id) into v_ids from a3.so_resultat where centre_id is null;
  if v_ids is not null then
    with c as materialized (
      select c.id::bigint as cid, s."centerId" as centre_id,
             ((c.created_at at time zone 'UTC') at time zone 'Africa/Casablanca')::date as jour
      from medifus_src.consultations c join medifus_src.stations s on s.id = c."stationId"
      where c.id = any(v_ids))
    update a3.so_resultat r set centre_id = c.centre_id, jour = c.jour from c where r.consultation_id = c.cid and r.centre_id is null;
    get diagnostics v_c = row_count;
  end if;
  -- sexe et âge absents du workflow : lus dans la copie MediFus (une seule tentative par ligne)
  perform a3.fn_so_completer_sujet(false);
  return jsonb_build_object('ok', true, 'enregistrees', v_n, 'unites_trouvees', coalesce(v_c, 0));
end $$;

-- API du workflow A3 (jeton a3 seulement)
create or replace function public.a3_so_enregistrer(p_token text, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = a3, sup, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  if coalesce(a3.fn_client(p_token), '') <> 'a3' then raise exception 'acces refuse : jeton a3 requis' using errcode = '42501'; end if;
  return a3.fn_so_enregistrer(p_record);
end $$;

-- API du tableau de bord : dernier second avis réussi de chaque consultation, trié par priorité
create or replace function public.ui_second_avis(p_token text, p_priorite text default null, p_limit int default 500)
returns jsonb language plpgsql security definer set search_path = a3, sup, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  return (
    with dernier as (
      select distinct on (r.consultation_id) r.*
      from a3.so_resultat r
      order by r.consultation_id, r.cree_le desc),
    ok as (
      select d.* from dernier d
      where d.statut = 'SUCCESS' and d.output is not null
        and (p_priorite is null or d.review_priority = upper(p_priorite)))
    select coalesce(jsonb_agg(x order by x.rang, x.recu_le desc), '[]'::jsonb) from (
      select o.consultation_id::text as id, o.consultation_id, o.version_key, o.run_id,
             coalesce(rc.centre_name, 'Unité n° ' || o.centre_id, 'Unité inconnue') as centre_name,
             rc.region, rc.province, o.jour,
             o.age, case o.sexe when 'female' then 'Femme' when 'male' then 'Homme' end as sexe, null::text as motif,
             o.cree_le as recu_le, coalesce(o.review_priority, 'ROUTINE') as review_priority,
             case o.review_priority when 'CRITICAL' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end as rang,
             o.model, o.prompt_version, o.output, o.signaux,
             case when v.version_key is null then null
                  else jsonb_build_object('verdict', v.verdict, 'comment', coalesce(v.commentaire, ''), 'by', v.par, 'at', v.le) end as review
      from ok o
      left join sup.ref_centre rc on rc.centre_id = o.centre_id
      left join a3.so_revue v on v.version_key = o.version_key
      order by rang, o.cree_le desc
      limit least(greatest(coalesce(p_limit, 500), 1), 1000)) x);
end $$;

-- Bilan des lancements (tous statuts), pour l'en-tête de l'écran et la présentation
create or replace function public.ui_second_avis_bilan(p_token text)
returns jsonb language plpgsql security definer set search_path = a3, sup, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  return (
    with dernier as (
      select distinct on (consultation_id) * from a3.so_resultat order by consultation_id, cree_le desc)
    select jsonb_build_object(
      'consultations', (select count(*) from dernier),
      'par_statut', (select coalesce(jsonb_object_agg(statut, n), '{}'::jsonb) from (select statut, count(*) n from dernier group by 1) s),
      'par_priorite', (select coalesce(jsonb_object_agg(review_priority, n), '{}'::jsonb)
                       from (select review_priority, count(*) n from dernier where statut = 'SUCCESS' group by 1) s),
      'valides', (select count(*) from a3.so_revue),
      'lancements', (select count(distinct run_id) from a3.so_resultat),
      'dernier', (select max(cree_le) from a3.so_resultat),
      'modeles', (select coalesce(jsonb_agg(distinct model), '[]'::jsonb) from dernier where statut = 'SUCCESS')));
end $$;

-- Validation par le médecin référent (le nom vient du serveur du tableau de bord, pas du navigateur)
create or replace function public.ui_so_revue(p_token text, p_version_key text, p_verdict text, p_par text, p_commentaire text default null)
returns jsonb language plpgsql security definer set search_path = a3, sup, public, pg_temp as $$
begin
  perform sup.api_check(p_token);
  if p_verdict not in ('accepte', 'modifie', 'rejete') then raise exception 'verdict : accepte, modifie ou rejete'; end if;
  if p_verdict <> 'accepte' and coalesce(btrim(p_commentaire), '') = '' then raise exception 'commentaire obligatoire pour modifier ou rejeter'; end if;
  if not exists (select 1 from a3.so_resultat where version_key = p_version_key and statut = 'SUCCESS') then
    raise exception 'second avis introuvable : %', p_version_key;
  end if;
  insert into a3.so_revue (version_key, verdict, commentaire, par, le)
  values (p_version_key, p_verdict, left(p_commentaire, 1000), left(coalesce(p_par, 'inconnu'), 120), now())
  on conflict (version_key) do update set verdict = excluded.verdict, commentaire = excluded.commentaire, par = excluded.par, le = now();
  return jsonb_build_object('ok', true, 'version_key', p_version_key, 'verdict', p_verdict, 'comment', coalesce(p_commentaire, ''),
                            'by', p_par, 'at', now());
end $$;

revoke all on function public.a3_so_enregistrer(text, jsonb), public.ui_second_avis(text, text, int),
                       public.ui_second_avis_bilan(text), public.ui_so_revue(text, text, text, text, text) from public, authenticated;
grant execute on function public.a3_so_enregistrer(text, jsonb), public.ui_second_avis(text, text, int),
                          public.ui_second_avis_bilan(text), public.ui_so_revue(text, text, text, text, text) to anon, service_role;
revoke all on function a3.fn_so_enregistrer(jsonb), a3.fn_json(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'a3 résultats installés' as statut,
       (select count(*) from a3.so_resultat) as lignes,
       (select count(*) from pg_proc where proname in ('a3_so_enregistrer','ui_second_avis','ui_second_avis_bilan','ui_so_revue')) as api;  -- attendu : 4
