# Analyses du flux de patients et second avis : scripts de base de données (20 à 29)

Ces scripts ajoutent au Supabase local le schéma `ana` (analyses) et les fonctions d'API utilisées par le tableau de bord. Ils sont **rejouables** et n'utilisent aucune donnée patient : seulement des comptes par unité et par jour.

## Ordre d'exécution (Supabase Studio > SQL Editor, un fichier par exécution)

| Étape | Commande | Durée indicative | Résultat attendu |
|---|---|---|---|
| 1 | `20_anomalies_causes.sql` | quelques secondes | `ana installé \| 49 \| 4` |
| 2 | `select ana.fn_detecter('2023-10-19', '2026-08-13');` | 10 à 60 s | nombre de jours anormaux par type |
| 3 | `21_population.sql` | quelques secondes | `75` provinces, total `36828330`, `provinces_non_rattachees = aucune` |
| 4 | `22_prevision.sql` | quelques secondes | `prévision installée \| 16` |
| 5 | `select ana.fn_ajuster_modele('2023-12-15', '2026-04-30', '2026-05-01', '2026-08-13');` | 20 à 60 s | **contrôle** : erreur du modèle contre erreur de la référence seule |
| 6 | `select ana.fn_ajuster_modele('2023-12-15', '2026-08-13');` | 20 à 60 s | modèle **actif** (toutes les données) |
| 7 | `select ana.fn_calculer_effets();` | 10 à 60 s | effets des facteurs (après l'étape 2) |
| 8 | `23_evolution_centres.sql` | quelques secondes | nombre d'unités par statut (croissance, stable, déclin, à risque, nouveau) |
| 9 | `24_stats_formation.sql` | quelques secondes | période couverte par le nettoyage (refaire `clean.fn_run` pour l'élargir) |
| 10 | `select ana.fn_charger_complements('2026-07-14', '2026-08-13');` | 10 à 60 s | attentes mesurées et conclusions lues (62 jours au plus par appel) |
| 11 | `25_cache_flux_tableau_de_bord.sql` | 10 à 60 s | une ligne par indicateur de flux avec sa durée de calcul ; au-delà de 3 000 ms, seul ce cache permet l'affichage (écrans Vue d'ensemble et Affluence). À relancer après chaque rechargement de l'historique : `select * from flux.fn_rafraichir_cache();` |
| 12 | `26_a3_resultats.sql` | quelques secondes | `a3 résultats installés \| 0 \| 4` : tables des résultats du second avis et 4 fonctions d'API |
| 13 | `26b_a3_import_sheet_2026-11-26.sql` (livré à part, **à supprimer après l'import**) | quelques secondes | `{"ok": true, "enregistrees": 500, …}` : les résultats déjà dans le Google Sheet |
| 14 | `27_a3_diagnostic_age_sexe.sql` | quelques secondes | lecture de `patients` (ok ou refusée), colonnes candidates, compte du lien. Si `ok` : `select a3.fn_so_completer_sujet(true);` |
| 15 | `28_tableau_de_bord_complements.sql` | 10 à 60 s | unités actives, communes, cartes jour × heure, liste rouge « N actives, M hors liste active » |
| 16 | `29_facteurs_causalite.sql` | quelques secondes | `facteurs et causalité installés \| 26 \| 0` |
| 17 | `select ana.fn_charger_medecins('2023-10-19', '2024-01-17');` puis les 11 fenêtres de 91 jours suivantes (`2024-01-18`→`2024-04-17`, `2024-04-18`→`2024-07-17`, … jusqu'à `2026-07-16`→`2026-08-13`), **une par exécution** | 10 à 60 s chacune | nombre de jours-unités chargés ; rejouable. Contrôle : `select min(jour), max(jour), count(*) from ana.centre_jour_medecin;` |
| 18 | `select ana.fn_alimenter_facteurs();` | 10 à 60 s | nombre de jours-unités par facteur |
| 19 | `select * from ana.fn_tester_causalite();` | 1 à 3 min | un verdict par facteur : cause probable, association, effet faible, pas d'effet démontré |

Si Studio affiche l'erreur `expected string … formattedError`, ne relancez pas : la requête continue sur le serveur. Suivez-la avec `optionnel\14z_requetes_bloquees.sql`.

## Méthode

**1. Jours anormaux** (`ana.anomalie`) : chaque journée d'une unité est comparée à la **médiane des 8 mêmes jours de semaine** précédents. Les fermetures nationales sont exclues de cette référence.
- **Consultations basses** : au plus 60 % de l'attendu, attendu ≥ 5, et un écart d'au moins 3 fois la dispersion (écart absolu médian, ou Poisson × 1,3).
- **Consultations hautes** : au moins 160 % de l'attendu, au moins 8 consultations de plus, même seuil de dispersion.
- **Écart admissions** : la part des patients admis s'écarte d'au moins 35 points de l'habitude de l'unité sur les 28 jours précédents.
- Chaque anomalie reçoit son **contexte** : météo, calendrier, souk, veille ou lendemain de fête, baisse commune à la province ou au réseau, part de saisie hors ligne, jours sans activité, journée provisoire.
- Elle reçoit aussi une **cause proposée** tirée du catalogue (`ana.cause`, 49 causes en 7 familles), selon un arbre de décision ordonné.
- Le coordinateur confirme ou corrige la cause depuis l'écran « Anomalies & enquêtes » (`ui_anomalie_enquete`). Une nouvelle détection ne touche jamais aux enquêtes déjà saisies.

**2. Lien avec les facteurs** (`ana.effet`) : pour chaque facteur, deux mesures.
- L'**effet** sur l'activité, en %, avec un intervalle de confiance à 95 %.
- Le **lift** : la part des anomalies où le facteur est présent, divisée par la même part les jours normaux. Un lift de 5 signifie que le facteur est 5 fois plus fréquent les jours anormaux.

**3. Équation de prévision** (`ana.modele`, `ana.modele_coef`) :

```
log((consultations + 1) / (référence + 1)) = b0 + Σ bk × facteur_k
référence = médiane des 8 mêmes jours de semaine, à partir de 2 semaines avant le jour prévu
prévision = (référence + 1) × exp(b0 + Σ bk × facteur_k + σ²/2) − 1 ; jour férié = 0 ; intervalle à 90 % = × exp(± 1,645 σ)
```

- **La référence porte déjà** le niveau de l'unité, son jour de semaine, son souk et sa tendance récente.
- **Les 15 facteurs :** veille et lendemain de fête, Ramadan, part de Ramadan dans la référence, vacances scolaires, été, hiver, début et fin de mois, pluie modérée, pluie forte, neige, vent fort, chaleur, froid.
- **Calcul :** les coefficients sont ajustés par moindres carrés dans la base elle-même, par élimination de Gauss-Jordan, avec leurs erreurs types.
- **Contrôle :** le modèle est ajusté avant le 01/05/2026, puis mesuré du 01/05 au 13/08/2026. On compare l'erreur absolue pondérée (WAPE) du modèle à celle de la référence seule.
- **Validation sur données simulées** dont les effets étaient connus : l'équation retrouve pluie forte −33,9 % (fixé à −35 %), chaleur −19,6 % (fixé à −20 %) et Ramadan −15,6 % (fixé à −15 %).
- **Pour la production :** la météo des jours futurs doit venir de la prévision Open-Meteo (types `PREVISION` de la base de Hassan). Sur la copie figée, la météo des jours « futurs » est la météo réelle observée.

**4. Évolution des unités** (`ui_evolution`) : tendance sur 12 mois des consultations par jour ouvré, en % par an, avec un test t. Elle donne aussi :
- une projection à 3 mois ;
- la fréquentation pour 1 000 habitants de la province, en divisant la population par le nombre d'unités de la province ;
- les jours sans activité et les anomalies non expliquées sur 90 jours ;
- un statut (croissance, stable, déclin, à risque, nouveau) et une recommandation : informer la population, revoir l'emplacement, vérifier l'équipe ou renforcer l'unité.

**5. Population** (`ana.population_province`) : population légale du **RGPH 2024 (HCP)** pour les 75 provinces et préfectures, au 1er septembre 2024 (décret n° 2.24.1009), total 36 828 330. Source : https://www.hcp.ma/file/242342/. Chaque unité est rattachée à sa province par une correspondance explicite, sinon par le nom normalisé.

**6. Problèmes de pratique** (`ui_stats_formation`), par médecin et par unité, à partir du nettoyage de Hafsa. Ils servent à cibler l'accompagnement et la formation.
- **Durée** : consultation très longue (plus de 60 min), dossier ouvert et clôturé en moins d'une minute, consultation laissée ouverte (clôturée plus de 4 h après le début, un autre jour, ou jamais).
- **Attente** : plus de 120 min entre l'admission et le début de la consultation (même patient, même unité, même jour).
- **Horaires** : saisie avant 7 h ou après 20 h (heure du Maroc, comme la règle T05 du nettoyage), consultation un dimanche ou un jour férié, ouverture tardive (1re consultation après 10 h), fin précoce (dernière avant 13 h).
- **Tenue du dossier** : modification plus de 3 jours après la création, dossier sans conclusion du généraliste, doublon (même patient, même médecin, même jour).
- **Charge** : journée de plus de 80 consultations.
- **Information** : saisie hors ligne, jamais signalée comme problème (souvent la connexion).
- Un **problème** est signalé quand la part atteint au moins 2 fois la médiane du réseau, et au moins 5 % avec au moins 3 cas.
- Tous les seuils sont modifiables dans `ana.seuil_pratique` (`update ana.seuil_pratique set valeur = 45 where code = 'duree_longue_min';`).
- L'attente et la conclusion demandent la lecture de la copie MediFus (`ana.fn_charger_complements`, étape 10). Elle ne conserve que deux valeurs par consultation : l'attente en minutes et « sans conclusion » oui/non.
- Le nom du médecin n'est donné que sous forme d'initiales, et le tableau de bord ne l'affiche qu'au profil direction.
- Un indicateur décrit une pratique à comprendre, pas une faute : une unité sans réseau ou un médecin qui couvre deux unités peuvent l'expliquer. Le premier usage est l'échange avec le médecin.

**7. Corrélation ou causalité** (`ana.facteur_jour`, `ana.causalite`, script 29) : 26 facteurs alimentés automatiquement.
- **Calendrier** : fêtes, veille et lendemain, semaine après l'Aïd al-Adha, Ramadan, vacances, rentrée, examens.
- **Économie** : début et fin de mois, moisson, récolte des olives (saisons approximatives), souk.
- **Météo** : pluie modérée, pluie forte, pluie forte la veille, neige, vent, chaleur, froid (avec leur intensité).
- **Offre de soins** : médecin différent de l'habituel, nouveau médecin, deux médecins, reprise après un arrêt, saisie hors ligne.
- **Terrain** : causes confirmées par les enquêtes du tableau de bord.
- **Six tests par facteur** : association avec intervalle de confiance ; comparaison aux unités voisines le même jour (pour la météo : voisines sans aucun événement météo) ; placebo décalé de 10 jours ; veille normale pour un facteur imprévisible ; dose-réponse ; cohérence entre provinces. Les jours fériés sont exclus de tous les tests sauf « férié ».
- **Calendrier complété** : Ramadan 2024 à 2026 (Habous) et vacances scolaires des écoles publiques 2023 à 2026 (ministère de l'Éducation nationale), absents de la base jusque-là. Ils servent aussi à la détection (20) et à la prévision (22) : relancer leurs calculs.
- **Saisie hors ligne** : classée « artefact de saisie » (la synchronisation en bloc gonfle le compte du jour), pas facteur de venue.
- **Verdict** : « cause probable » seulement si l'effet atteint 5 % (8 % pour une saison), si le placebo est nul et si aucun autre test ne le contredit. Validé sur données simulées : pluie forte, chaleur et Ramadan retrouvés comme causes probables ; olives, moisson et début de mois classés « effet faible ».

## Limites
- L'**attente** est une estimation : elle suppose que l'admission du patient dans la journée précède sa consultation. Elle n'est calculée que si l'écart est compris entre 0 et 10 h.
- Les **causes terrain** (moussem, panne de véhicule, caravane médicale…) ne se devinent pas : elles s'obtiennent par l'enquête, et chaque réponse enrichit l'historique.
- L'équation explique surtout les **effets communs** (calendrier, météo). Une baisse propre à une unité (médecin absent, panne) reste imprévisible : c'est le rôle de la détection et de l'enquête.
