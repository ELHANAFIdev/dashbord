# Supervision UMMC

Tableau de bord **en lecture seule** des Unités Médicales Mobiles Connectées (Maroc) : 100 unités actives, données arrêtées au 13 août 2026 (copie anonymisée). L’essentiel doit se lire en moins de 30 secondes sur l’écran d’accueil.

Utilisateurs : direction du programme, coordinateur régional, médecin référent, démonstration (jury).

## Écrans

| Groupe | Écran | Route | Données |
|---|---|---|---|
| Pilotage | Vue d’ensemble | `/` | `ui_dashboard`, `ui_map`, `ui_events`, `flux_indicateurs` (volumes, mois), `ui_anomalies`, `ui_evolution` |
| | Carte | `/carte` | `ui_map`, `ui_population`, fond `public/geo/*.geojson` (aucune tuile tierce) |
| | Liste rouge | `/liste-rouge` | `sup_centre_category_list` (`p_attention_only = true`) |
| | Alertes | `/alertes` | `ui_events` (`p_status`), `sup_event_ack`, `ui_causes` |
| Analyse | Fiche unité | `/unites`, `/unites/[id]` | `ui_centre_detail` et `ctx_centre_context` (15/05 au 13/08/2026), `ui_anomalies`, `ui_prevision`, `ui_evolution` |
| | Affluence | `/affluence` | `flux_indicateurs` : `heures`, `croissance`, `repartition` (région), `retour` |
| | Évolution & population | `/evolution` | `ui_evolution`, `ui_population` |
| | Prévision | `/prevision` | `ui_prevision` |
| Qualité & IA | Anomalies & enquêtes | `/anomalies` | `ui_anomalies`, `ui_anomalie_enquete`, `ui_causes` |
| | Facteurs & causes | `/facteurs` | `ui_facteurs`, `ui_causes` |
| | Problèmes de pratique | `/statistiques` | `ui_stats_formation` (`p_groupe` = `medecin` ou `centre`) |
| | Second avis IA | `/second-avis` | échantillon statique `src/data/second_avis_echantillon.json` |
| Système | Santé du système | `/sante` | `ui_health` |

Toutes les fonctions et leurs paramètres exacts sont décrits dans [`CONTRATS_API.md`](CONTRATS_API.md), contrat de référence.

## Profils et droits

Le profil de démonstration se choisit en haut à droite ; il est gardé dans un cookie `httpOnly` et **appliqué par le serveur** à chaque appel.

| Droit | Direction | Coordinateur | Médecin référent | Démonstration |
|---|:-:|:-:|:-:|:-:|
| Voir tout le réseau | oui | sa région seulement | oui | oui |
| Acquitter une alerte (`sup_event_ack`) | oui | sa région | non | non |
| Renseigner une enquête (`ui_anomalie_enquete`) | oui | sa région | non | non |
| Valider un second avis (accepter, modifier, rejeter) | oui | non | oui | non |
| Voir le nom des médecins | oui | non (« Médecin n° id ») | non | non |

Règles appliquées par le proxy (`src/server/`) :
- liste blanche des fonctions et des paramètres : un paramètre inconnu n’est jamais transmis (PostgREST le refuserait) ;
- `p_region` n’est accepté que par `ui_events` ; pour un coordinateur il est imposé, et les autres réponses portant un champ `region` sont filtrées côté serveur ; la fiche, le contexte et la prévision d’une unité d’une autre région sont refusés (403) ;
- l’auteur des écritures (`p_by`, `p_par`) vient de la session, jamais du navigateur ;
- noms des médecins remplacés par « Médecin n° id » hors direction ; groupes de moins de 10 consultations exclus ;
- censure thérapeutique des textes du second avis (traitement, molécule, dose, consigne) ;
- profil démonstration en lecture seule.

`ui_dashboard` reste national : pour un coordinateur, l’accueil compte les unités et les alertes de sa région à partir de `ui_map` et `ui_events`.

## Architecture

```
Navigateur (React 19, Next.js 16, Tailwind 4, Leaflet, Chart.js)
   │  POST /api/rpc/<fonction>   corps = paramètres p_*   (jamais de clé ni de jeton)
   ▼
Next.js : src/app/api/rpc/[fn]/route.ts  →  src/server/rpc.ts
   │  session (cookie ummc_role) → droits, liste blanche, paramètres exacts
   │  filtrage régional, noms des médecins, censure, en-tête x-ummc-source: live | mock
   ├── mode réel : POST {SUPA_URL}/<fonction> + apikey + p_token (SUPA_TOKEN)
   │               erreur de la base → 502 et écran d’erreur avec « Réessayer », jamais de données fictives
   └── mode démo : src/mock/*.json (formes du contrat) + écritures en mémoire du serveur
```

Côté navigateur, `src/client/rpc.ts` met les lectures en cache (par profil et paramètres), relit après une écriture et remonte la source de chaque donnée affichée : dès qu’une donnée à l’écran vient de la démonstration, le bandeau **DONNÉES DE DÉMONSTRATION** s’affiche.

```
src/app/            routes (une par écran), layout, globals.css (jetons de design)
src/components/     shell (menu, en-tête), ui (primitives, tableau, tiroir), charts, screens
src/client/         accès aux données, session, thème, registre des sources
src/server/         liste blanche, règles, proxy, lecture des données de démonstration
src/lib/            types du contrat, formats fr-MA, constantes, régions
src/mock/           données de démonstration (générées)
database/           scripts SQL 20 à 24 et leur LISEZ-MOI
public/geo/         régions officielles et pays voisins (GeoJSON)
scripts/            générateur des données de démonstration
tests/              vitest (proxy) et test de fumée Playwright
docs/captures/      captures de chaque écran, thèmes clair et sombre
```

## Installation

Prérequis : Node.js 20 ou plus récent, npm.

**Linux / macOS**

```bash
npm ci
cp .env.example .env.local      # puis renseigner les valeurs
npm run dev                     # http://localhost:3000
```

**Windows (PowerShell)**

```powershell
npm ci
Copy-Item .env.example .env.local   # puis renseigner les valeurs
npm run dev                         # http://localhost:3000
```

Production : `npm run build` puis `npm run start`.

## Variables d’environnement

| Variable | Rôle |
|---|---|
| `SUPA_URL` | adresse des fonctions RPC, par exemple `http://192.168.11.214:30736/rest/v1/rpc` |
| `SUPA_ANON_KEY` | clé anon de Supabase (en-têtes `apikey` et `Authorization`) |
| `SUPA_TOKEN` | jeton du client `ui`, ajouté par le serveur dans `p_token` |
| `USE_MOCK` | `true` : données de démonstration ; `false` : base réelle |
| `UMMC_COORD_REGION` | facultatif : région du coordinateur de démonstration (défaut `L'Oriental`) |

Le mode démonstration est actif si `USE_MOCK=true` **ou** si l’une des variables `SUPA_*` manque.

### Créer le jeton `ui`

Dans Supabase Studio, menu **SQL Editor**, exécuter :

```sql
select sup.api_new_token('ui');
```

Copier la valeur renvoyée dans `SUPA_TOKEN` de `.env.local`, puis redémarrer le serveur Next.js.

## Données réelles ou de démonstration

- **Réel** (`USE_MOCK=false`, variables `SUPA_*` renseignées) : chaque réponse porte `x-ummc-source: live`. Si la base échoue, l’écran affiche l’erreur avec un bouton « Réessayer » ; aucune donnée fictive n’est substituée.
- **Démonstration** : réponses `x-ummc-source: mock`, bandeau permanent « DONNÉES DE DÉMONSTRATION ». Les acquittements, enquêtes et validations sont gardés en mémoire du serveur (perdus au redémarrage).
- Le **second avis** est toujours un échantillon de test (5 cas fictifs au format A3 réel, modèle `google/gemma-4-31B-it`, badge « Échantillon de test — décision réservée au médecin ») ; sa validation reste en mémoire (`so_review` n’existe pas dans la base).

Les fichiers `src/mock/` sont produits par `npm run mock:generer` (`scripts/generer-mock.mjs`, déterministe) : 100 unités sur 9 régions, catégories ≈ A 54 / B 15 / C 13 / D 13 / E 5, environ 1 600 consultations par jour, croissance 2026 ≈ +29 % sur janvier–juillet, pic le lundi à 10 h, taux de retour ≈ 30 %, Marrakech-Safi en tête (≈ 21 consultations par jour actif). Noms d’unités et initiales des médecins fictifs ; le catalogue des causes est lu dans `database/20_anomalies_causes.sql`. Aucune valeur n’est réelle.

## Base de données

Les scripts SQL des fonctions d’analyse (`ui_anomalies`, `ui_anomalie_enquete`, `ui_causes`, `ui_facteurs`, `ui_prevision`, `ui_evolution`, `ui_population`, `ui_stats_formation`) sont dans [`database/`](database/) :

- [`20_anomalies_causes.sql`](database/20_anomalies_causes.sql) : jours anormaux, catalogue des causes, effets des facteurs ;
- [`21_population.sql`](database/21_population.sql) : population légale RGPH 2024 (HCP) des 75 provinces ;
- [`22_prevision.sql`](database/22_prevision.sql) : équation de prévision et son contrôle ;
- [`23_evolution_centres.sql`](database/23_evolution_centres.sql) : tendance et statut de chaque unité ;
- [`24_stats_formation.sql`](database/24_stats_formation.sql) : problèmes de pratique (P01 à P13) par médecin et par unité.

Ordre d’exécution, durées et méthode : [`database/LISEZ-MOI.md`](database/LISEZ-MOI.md).

## Carte

Leaflet sans aucune tuile tierce : fond « mer » neutre, pays voisins en terre neutre sans frontière (`public/geo/maroc_voisins.geojson`), puis les 12 régions officielles (`public/geo/maroc_regions.geojson`, propriétés `code`, `nom`, `nom_ar`). Vue initiale ajustée sur les régions, jusqu’à Lagouira. Attribution : « Régions : © contributeurs OpenStreetMap (ODbL) · Voisins : Natural Earth ». Si le fichier des régions manque, les repères restent affichés avec le message « Fond de carte en cours de chargement ».

## Design

Thème clair par défaut, thème sombre au choix (mémorisé dans le navigateur ; sans choix, la préférence du système est suivie). Jetons de couleur en variables CSS (`src/app/globals.css`) utilisés par Tailwind 4. Police IBM Plex Sans (fichiers locaux, licence OFL), chiffres tabulaires. Formats `fr-MA`, fuseau `Africa/Casablanca`.

Les couleurs des catégories A à E forment une échelle ordonnée (bleu « cible atteinte » → rouge « très faible »), vérifiée avec un validateur de daltonisme : séparation suffisante entre catégories voisines dans les deux thèmes ; la lettre de la catégorie est toujours affichée en plus de la couleur.

## Tests et vérifications

```bash
npm run lint        # ESLint, 0 erreur et 0 avertissement
npm run typecheck   # TypeScript
npm test            # vitest : règles du proxy (tests/proxy.test.ts)
npm run build
npm run test:e2e    # après le build : next start, chaque écran en clair et sombre, captures dans docs/captures/
```

Le test de fumée utilise Playwright (Chromium) installé sur le poste ; il vérifie l’absence d’erreur console et de débordement horizontal, et la présence du bandeau de démonstration. La CI GitHub (`.github/workflows/ci.yml`, Node 20) enchaîne `npm ci`, lint, typecheck, vitest et build.

## Crédits

Version d’origine : Mohammed El Hanafi ; refonte : Mohammed Ezzi.
