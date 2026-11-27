# Contrats d'API — tableau de bord UMMC ↔ Supabase local

Toutes les fonctions s'appellent en `POST {SUPA_URL}/{fonction}`, où `SUPA_URL` = `http://192.168.11.214:30736/rest/v1/rpc`, avec les en-têtes `apikey` et `Authorization: Bearer <clé anon>`.

Le corps de la requête contient **toujours** `p_token` (jeton du client `ui`), ajouté par le serveur Next.js et jamais par le navigateur. Les noms de paramètres doivent être **exacts** : PostgREST refuse un paramètre inconnu (erreur 404 PGRST202).

Les réponses sont toutes en JSON (`jsonb`). Les dates sont des chaînes `YYYY-MM-DD`. Le jour de référence de la copie figée est le `2026-08-13`.

## A. Fonctions existantes (scripts 06b, 10, 12, 16)

| Fonction | Paramètres (en plus de `p_token`) | Réponse |
|---|---|---|
| `ui_dashboard` | `p_day?` | `{day, centres_actifs, centres_total, pec_total, patients_total, consultations_total, admissions_total, pec_median_centre, events_open, events_urgent, attention, last_night:{run_id, started_at, ended_at, ok}\|null}` |
| `ui_map` | `p_measure?='pec'` | `[{centre_id, centre_name, province, region, latitude, longitude, category, mean_value, attention, attention_reason, open_events}]` |
| `ui_events` | `p_status?='open'\|'all'\|'explained'\|'resolved'`, `p_region?`, `p_limit?=100` | `[{id, centre_id, centre_name, province, region, signal_type, severity, status, first_seen, last_seen, occurrences, last_value, last_expected, message, explanation, explanation_source, ack_by, ack_at}]` |
| `sup_centre_category_list` | `p_attention_only?=true`, `p_measure?='pec'`, `p_period_end?` | `[{measure, period_end, centre_id, centre_name, province, region, category, mean_value, ci_low, ci_high, pct_days_over_target, mean_prev, adj_change_pct, trend_z, days_open, days_zero, attention, attention_reason}]` |
| `ui_centre_detail` | `p_centre_id`, `p_from`, `p_to` (**obligatoires**), `p_measure?` | `{measure, centre:{centre_id, centre_name, province, region, latitude, longitude, category, mean_value, ci_low, ci_high, days_zero, attention_reason, target}, series:[{day, value, expected, signal}], category_history:[{period_end, category, mean_value}], events:[...]}` |
| `ctx_centre_context` | `p_centre_id`, `p_from`, `p_to` (**obligatoires**) | `[{day, t_min_c, t_max_c, precip_mm, snow_cm, gust_max_kmh, heavy_rain, snow, strong_wind, extreme_heat, cold, adverse_weather, souk_today, calendar}]` |
| `ui_health` | — | `{data_last_day, nights:[{run_id, started_at, ended_at, ok, steps}], last_deliveries:[{channel, recipient, sent_at, ok, event_id}], context_loads:[{dataset, loaded_at, n_rows, status}]}` |
| `sup_event_ack` | `p_id`, `p_by`, `p_cause?`, `p_resolve?=false` | `{ok, id, status}` |
| `flux_indicateurs` | `p_indicateur` (`volumes`\|`repartition`\|`retour`\|`profil`\|`heures`\|`entonnoir`\|`croissance`), `p_du`, `p_au`, `p_niveau?` (`centre`\|`province`\|`region`\|`national`), `p_centre_id?`, `p_grain?` (`jour`\|`mois`\|`annee`) | tableau propre à chaque indicateur (voir ci-dessous) |

Formes des réponses de `flux_indicateurs` :
- `volumes` → `[{periode, consultations, patients, nouveaux_patients}]`
- `repartition` → `[{niveau, centres, consultations, patients, jours_actifs, consultations_par_jour_actif, rang}]`
- `retour` → `[{niveau, patients, patients_revenus, taux_retour_pct}]`
- `heures` → `[{jour_semaine (1 = lundi), heure, consultations, heures_actives, consultations_par_heure_active}]`
- `croissance` → `[{mois, consultations_n, consultations_n_1, variation_pct}]` (avec `p_du` = 1er janvier de l'année)
- `profil` → `[{dimension ('sexe'|'age'), valeur, patients, part_pct}]` (« inconnu » sans accès à la table patients)
- `entonnoir` → `[{niveau, admissions, patients_admis, consultations, patients_consultes, taux_consultes_sur_admis_pct}]`

## B. Nouvelles fonctions (script 20, livré avec ce dépôt)

| Fonction | Paramètres | Réponse |
|---|---|---|
| `ui_anomalies` | `p_du`, `p_au`, `p_centre_id?`, `p_type?`, `p_statut?`, `p_limit?=500` | `[{id, centre_id, centre_name, province, region, jour, type, observe, attendu, ecart_pct, score, contexte:{meteo, calendrier, souk, baisse_province_pct, medecins, hors_ligne_pct}, cause_proposee, cause_code, confiance, statut, cause_confirmee, commentaire, par, maj}]` |
| `ui_anomalie_enquete` | `p_id`, `p_statut` (`a_enqueter`\|`explique`\|`confirme`\|`ecarte`), `p_cause_code?`, `p_commentaire?`, `p_par` | `{ok, id, statut}` |
| `ui_causes` | — | `[{code, famille, libelle, effet, portee, donnees, detection_auto}]` (catalogue des causes) |
| `ui_facteurs` | — | `[{facteur, libelle, famille, portee, effet_pct, ic_bas, ic_haut, n_jours, verdict}]` |
| `ui_prevision` | `p_centre_id`, `p_du?` (défaut : lendemain du dernier jour connu), `p_jours?=14` | `{centre:{centre_id, centre_name, province}, modele:{version, ajuste_le, erreur_moyenne_pct, n_jours_test}, jours:[{jour, prevu, bas, haut, ferie, souk, meteo}], equation:[{terme, coefficient, effet_pct}]}` |
| `ui_evolution` | `p_mois?=12` | `[{centre_id, centre_name, province, region, population_province, consultations_periode, pour_1000_hab_an, tendance_pct_an, prevision_3_mois, statut ('croissance'\|'stable'\|'declin'\|'a_risque'\|'nouveau'), signaux:[texte], recommandation}]` |
| `ui_population` | — | `[{region, province, population, menages, centres, consultations_12_mois, pour_1000_hab_an, source}]` |
| `ui_stats_formation` | `p_du`, `p_au`, `p_groupe` (`medecin`\|`centre`) | **Problèmes de pratique** : `[{groupe_id, groupe_nom, centre_name, region, province, consultations, jours_actifs, consultations_par_jour, duree_mediane_min, attente_mediane_min, attentes_mesurees, indicateurs:[{code, libelle, famille, base, n, pct, mediane_reseau_pct, alerte}], problemes:[libellé]}]`, triés par nombre de problèmes. Groupes de moins de 10 consultations exclus. `groupe_nom` vaut « Dr A. B. (n° id) » ou « Médecin n° id » : le serveur Next.js ne le transmet qu'au profil direction, sinon il le remplace par « Médecin n° id » |

**Précisions sur les réponses réelles (scripts `database/20` à `24`, testés) :**
- **`ui_anomalies`.** Clés de `contexte`, toutes facultatives : `meteo` (texte), `calendrier` (texte), `souk` (texte), `lendemain_fete` (bool), `veille_fete` (bool), `baisse_province_pct`, `baisse_reseau_pct`, `hors_ligne_pct`, `jours_zero_avant`, `provisoire` (bool). Il n'y a pas de clé `medecins`. Valeurs de `confiance` : `forte`, `moyenne`, `faible`, `aucune`. Valeur de `cause_code` : un code du catalogue (`2.2`, `4.1`…) ou `X` (inconnue).
- **`ui_anomalie_enquete`.** Paramètres exacts : `p_id`, `p_statut`, `p_par`, `p_cause_code?`, `p_commentaire?`.
- **`ui_facteurs`.** Chaque ligne contient en plus `pct_anomalies`, `pct_jours_normaux` et `lift`, ainsi qu'un `verdict` parmi : `hausse démontrée`, `baisse démontrée`, `hausse faible`, `baisse faible`, `pas d'effet démontré`, `trop peu de jours`, `référence par jour de semaine`.
- **`ui_prevision`.** `jours[]` contient en plus `reference`. `modele` contient en plus `erreur_reference_seule_pct`. `equation[]` contient en plus `ic_bas_pct`, `ic_haut_pct` et `n_jours`. `modele` vaut `null` tant qu'aucun modèle n'est ajusté.
- **`ui_evolution`.** Champs supplémentaires : `unites_province`, `premier_jour`, `par_jour_3_derniers_mois`, `t_stat`, `mediane_reseau_pour_1000`, `jours_sans_activite_90`, `anomalies_ouvertes_90`. Le `statut` peut aussi valoir `inactif`.
- **`ui_population`.** Champs supplémentaires : `population_rurale`, `patients_12_mois`, `couverture_pct` (patients distincts / population), `habitants_par_unite`. `patients_12_mois` et `couverture_pct` valent `null` si les indicateurs de flux ne sont pas chargés.
- **`ui_stats_formation`** (problèmes de pratique, script 24 refait). 13 indicateurs, toujours dans cet ordre, `famille` entre parenthèses :
  - `P01` consultation très longue, `P02` ouverte et clôturée en moins d'une minute, `P03` laissée ouverte (Durée) ;
  - `P04` attente longue après l'admission (Attente) ;
  - `P05` saisie hors horaires, `P06` dimanche ou jour férié, `P11` ouverture tardive, `P12` fin précoce (Horaires) ;
  - `P07` modification tardive, `P08` sans conclusion, `P09` doublon (Tenue du dossier) ;
  - `P10` journée surchargée (Charge) ;
  - `P13` saisie hors ligne (Information : jamais en alerte, c'est souvent la connexion).
  - `base` dit sur quoi porte le pourcentage : `consultations`, `jours` (P11, P12), `attentes mesurées` (P04) ou `consultations lues` (P08). `pct` et `mediane_reseau_pct` valent `null` pour P04 et P08 tant que `ana.fn_charger_complements` n'a pas été lancé sur la période : afficher « non mesuré ».
  - `alerte = true` quand `pct` ≥ max(2 × médiane du réseau, 5 %) et `n` ≥ 3. `problemes` reprend les libellés en alerte, du plus marqué au moins marqué. Les libellés contiennent déjà les seuils (« plus de 60 min ») : les afficher tels quels.
  - Les anciens champs `part_*_pct`, `besoins_formation` et `mediane_reseau` n'existent plus.

## D. Compléments du 26/11 (scripts 28 et 29)

| Fonction | Paramètres | Réponse |
|---|---|---|
| `flux_lieux` | — | `[{centre_id, centre_name, commune, province, region}]` (unités actives) |
| `flux_heures_niveau` | `p_du`, `p_au`, `p_niveau` (`national`\|`region`\|`province`\|`commune`\|`centre`), `p_valeur` (nom, ou `centre_id` en texte) | même forme que `flux_indicateurs` `heures` |
| `ui_causalite` | — | `[{facteur, libelle, famille, portee, source, remarque, n_jours, effet_pct, ic_bas, ic_haut, effet_ajuste_pct, placebo_pct, veille_pct, dose:[{quartile, intensite_moyenne, effet_pct}]\|null, coherence_pct, provinces, verdict, explication, calcule_le}]` |
| `sup_centre_category_list` (script 28) | inchangés | champs ajoutés : `actif` (liste des 100 unités actives), `motif_hors_liste` ; `centre_name` vaut « Unité n° id » quand le nom MediFus est vide |

`ui_second_avis` renvoie désormais `sexe` (`Femme`\|`Homme`) et `age` quand ils sont connus (workflow A3 v7.3, ou table `patients` lisible).

## C. Second avis A3 (script 26)

| Fonction | Qui l'appelle | Paramètres | Réponse |
|---|---|---|---|
| `a3_so_enregistrer` | workflow A3 v7.2 (nœuds `SaveDBS`, `SaveDBF`), **jeton a3 seulement** | `p_record` : un objet ou un tableau, aux noms de colonnes du Sheet `so_records` (`run_id, consultation_id, version_key, status, review_priority, summary, red_flags, confidence, signals_or_reason, output_json, workflow_version, prompt_version, model, created_at`) | `{ok, enregistrees, unites_trouvees}` |
| `ui_second_avis` | tableau de bord (proxy : `second_avis`) | `p_priorite?` (`CRITICAL`\|`HIGH`\|`MEDIUM`\|`ROUTINE`), `p_limit?=500` | dernier second avis **réussi** de chaque consultation, trié par priorité : `[{id, consultation_id, version_key, run_id, centre_name, region, province, jour, age:null, sexe:null, motif:null, recu_le, review_priority, model, prompt_version, output, signaux, review:{verdict, comment, by, at}\|null}]` |
| `ui_second_avis_bilan` | tableau de bord (proxy : `second_avis_bilan`) | — | `{consultations, par_statut, par_priorite, valides, lancements, dernier, modeles}` |
| `ui_so_revue` | tableau de bord (proxy : `so_review`) | `p_version_key`, `p_verdict` (`accepte`\|`modifie`\|`rejete`), `p_par` (rempli par le serveur), `p_commentaire?` (obligatoire sauf `accepte`) | `{ok, version_key, verdict, comment, by, at}` |

- Une ligne d'échec n'écrase jamais un succès déjà enregistré pour la même `version_key`.
- En démonstration, `second_avis` sert l'échantillon fictif `src/data/second_avis_echantillon.json` et la validation reste en mémoire du serveur.
- La censure thérapeutique du proxy s'applique aussi aux résultats réels.

Les fonctions `flux_series`, `flux_stats`, `flux_live_centres` et `ui_second_opinion`, présentes dans la version d'origine, **n'existent pas** dans la base. Elles sont remplacées par `flux_indicateurs`, `ui_stats_formation`, la carte de chaleur `heures` et `ui_second_avis`.
