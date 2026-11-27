-- =====================================================================
-- 25 — Mémoire des indicateurs de flux pour le tableau de bord (évite l'erreur 502 / délai de 3 s)
--   Pourquoi : la clé anon a une limite de 3 s par requête (réglage commun, on n'y touche pas).
--   Sur 12 mois, flux_indicateurs compte des centaines de milliers de consultations : plus de 3 s.
--   Solution : calculer une fois depuis Studio (pas de limite), garder le résultat, le servir en quelques ms.
--   Studio : coller, Run (10 à 60 s). Rejouable. Prérequis : 16 (flux) et l'historique chargé.
--   Après un nouveau chargement de l'historique : select flux.fn_rafraichir_cache();
--   La forme de la réponse ne change pas : {indicateur, du, au, lignes} (+ calcule_le).
-- =====================================================================
create table if not exists flux.cache_indicateur (
  cle         text primary key,
  indicateur  text not null,
  du          date not null,
  au          date not null,
  niveau      text,
  centre_id   int,
  grain       text,
  valeur      jsonb not null,
  calcule_le  timestamptz not null default now(),
  duree_ms    int
);
revoke all on flux.cache_indicateur from public, anon, authenticated;

create or replace function flux.fn_cle(p_indicateur text, p_du date, p_au date, p_niveau text, p_centre_id int, p_grain text)
returns text language sql immutable as $$
  select concat_ws('|', p_indicateur, p_du, p_au, coalesce(p_niveau, '-'), coalesce(p_centre_id::text, '-'), coalesce(p_grain, '-')) $$;

-- Calcul (même contenu que l'ancienne flux_indicateurs, sans le contrôle du jeton)
create or replace function flux.fn_indicateurs_calcul(p_indicateur text, p_du date, p_au date,
                                                      p_niveau text, p_centre_id int, p_grain text)
returns jsonb language plpgsql security definer set search_path = flux, sup, public as $$
declare r jsonb;
begin
  if p_au - p_du > 1100 then raise exception 'FLUX_PERIODE_TROP_LONGUE'; end if;
  r := case p_indicateur
    when 'volumes'     then (select jsonb_agg(to_jsonb(x)) from flux.fn_volumes(p_du, p_au, coalesce(p_grain, 'jour'), p_centre_id) x)
    when 'repartition' then (select jsonb_agg(to_jsonb(x)) from flux.fn_repartition(p_du, p_au, coalesce(p_niveau, 'centre')) x)
    when 'retour'      then (select jsonb_agg(to_jsonb(x)) from flux.fn_retour(p_du, p_au, coalesce(p_niveau, 'national')) x)
    when 'profil'      then (select jsonb_agg(to_jsonb(x)) from flux.fn_profil(p_du, p_au, p_centre_id) x)
    when 'heures'      then (select jsonb_agg(to_jsonb(x)) from flux.fn_heures(p_du, p_au, p_centre_id) x)
    when 'entonnoir'   then (select jsonb_agg(to_jsonb(x)) from flux.fn_entonnoir(p_du, p_au, coalesce(p_niveau, 'centre')) x)
    when 'croissance'  then (select jsonb_agg(to_jsonb(x)) from flux.fn_croissance(extract(year from p_au)::int) x)
    else null end;
  if r is null and p_indicateur not in ('volumes','repartition','retour','profil','heures','entonnoir','croissance') then
    raise exception 'FLUX_INDICATEUR_INCONNU : %', p_indicateur;
  end if;
  return jsonb_build_object('indicateur', p_indicateur, 'du', p_du, 'au', p_au, 'lignes', coalesce(r, '[]'::jsonb));
end $$;

-- Calcule et garde en mémoire
create or replace function flux.fn_cache_calculer(p_indicateur text, p_du date, p_au date,
                                                  p_niveau text, p_centre_id int, p_grain text)
returns jsonb language plpgsql security definer set search_path = flux, sup, public as $$
declare t0 timestamptz := clock_timestamp(); r jsonb;
begin
  r := flux.fn_indicateurs_calcul(p_indicateur, p_du, p_au, p_niveau, p_centre_id, p_grain);
  insert into flux.cache_indicateur (cle, indicateur, du, au, niveau, centre_id, grain, valeur, calcule_le, duree_ms)
  values (flux.fn_cle(p_indicateur, p_du, p_au, p_niveau, p_centre_id, p_grain), p_indicateur, p_du, p_au, p_niveau,
          p_centre_id, p_grain, r, now(), (extract(epoch from clock_timestamp() - t0) * 1000)::int)
  on conflict (cle) do update set valeur = excluded.valeur, calcule_le = excluded.calcule_le, duree_ms = excluded.duree_ms;
  return r;
end $$;

-- API : sert la mémoire si elle existe, sinon calcule (et garde le résultat si le calcul tient en 3 s)
create or replace function public.flux_indicateurs(p_token text, p_indicateur text, p_du date, p_au date,
                                                   p_niveau text default null, p_centre_id int default null,
                                                   p_grain text default 'jour')
returns jsonb language plpgsql security definer set search_path = flux, sup, public as $$
declare r jsonb; v_le timestamptz;
begin
  perform sup.api_check(p_token);
  select c.valeur, c.calcule_le into r, v_le from flux.cache_indicateur c
  where c.cle = flux.fn_cle(p_indicateur, p_du, p_au, p_niveau, p_centre_id, p_grain);
  if r is not null then return r || jsonb_build_object('calcule_le', v_le); end if;
  return flux.fn_cache_calculer(p_indicateur, p_du, p_au, p_niveau, p_centre_id, p_grain);
end $$;
revoke all on function public.flux_indicateurs(text, text, date, date, text, int, text) from public, authenticated;
grant execute on function public.flux_indicateurs(text, text, date, date, text, int, text) to anon, service_role;

-- Recalcule tout ce qui est en mémoire + les appels du tableau de bord (12 mois de la copie figée)
create or replace function flux.fn_rafraichir_cache(p_du date default '2025-08-01', p_au date default '2026-07-31')
returns table (indicateur text, du date, au date, niveau text, grain text, lignes int, duree_ms int)
language plpgsql security definer set search_path = flux, sup, public as $$
declare k record;
begin
  for k in
    select * from (values
      ('volumes', p_du, p_au, 'national', null::int, 'mois'),
      ('volumes', p_du, p_au, 'national', null::int, 'annee'),
      ('heures', p_du, p_au, 'national', null::int, 'jour'),
      ('croissance', make_date(extract(year from p_au)::int, 1, 1), p_au, 'national', null::int, 'jour'),
      ('repartition', p_du, p_au, 'region', null::int, 'jour'),
      ('repartition', p_du, p_au, 'province', null::int, 'jour'),
      ('repartition', p_du, p_au, 'centre', null::int, 'jour'),
      ('retour', p_du, p_au, 'national', null::int, 'jour'),
      ('retour', p_du, p_au, 'region', null::int, 'jour'),
      ('entonnoir', p_du, p_au, 'national', null::int, 'jour'),
      ('profil', p_du, p_au, 'national', null::int, 'jour')
    ) v(i, d, a, n, c, g)
    union
    select c.indicateur, c.du, c.au, c.niveau, c.centre_id, c.grain from flux.cache_indicateur c
    where c.indicateur in ('volumes','repartition','retour','profil','heures','entonnoir','croissance')
  loop
    perform flux.fn_cache_calculer(k.i, k.d, k.a, k.n, k.c, k.g);
  end loop;
  -- cartes jour × heure par région et province (script 28), si installé
  if to_regprocedure('flux.fn_precalculer_heures(date,date)') is not null then
    perform flux.fn_precalculer_heures(p_du, p_au);
  end if;
  return query select c.indicateur, c.du, c.au, c.niveau, c.grain,
                      coalesce(jsonb_array_length(c.valeur -> 'lignes'), jsonb_array_length(c.valeur)), c.duree_ms
               from flux.cache_indicateur c order by c.duree_ms desc;
end $$;
revoke all on function flux.fn_cache_calculer(text, date, date, text, int, text), flux.fn_indicateurs_calcul(text, date, date, text, int, text),
                       flux.fn_rafraichir_cache(date, date) from public, anon, authenticated;

notify pgrst, 'reload schema';
select * from flux.fn_rafraichir_cache();   -- durée de chaque calcul : au-dessus de 3000 ms, seule la mémoire permet l'affichage
