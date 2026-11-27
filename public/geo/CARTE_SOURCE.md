# Carte du Royaume du Maroc — 12 régions (découpage 2015)

## Fichiers

| Fichier | Contenu | Taille |
|---|---|---|
| `maroc_regions.geojson` | 12 régions, WGS84 (EPSG:4326), RFC 7946, coordonnées à 4 décimales | 245 Ko (250 671 o) |
| `maroc_voisins.geojson` | Contour léger des pays voisins (Algérie, Mauritanie, Mali, Espagne, Portugal), sans aucune entité « Sahara occidental » | 77 Ko (79 246 o) |
| `maroc_regions_apercu.png` | Aperçu de contrôle avec le nom de chaque région | 140 Ko |

Propriétés de `maroc_regions.geojson` : `{ "code": "01".."12", "nom": "<nom officiel FR>", "nom_ar": "<nom AR>" }`.
Propriétés de `maroc_voisins.geojson` : `{ "iso": "DZA|MRT|MLI|ESP|PRT", "nom": "<nom FR>" }`.

## Sources et licences

1. **Régions** : paquet npm `morocco-map@1.3.0` (fichier `data/regions.json`, TopoJSON, 12 régions, id ISO 3166-2 `MA-01`..`MA-12`).
   - Dépôt : https://github.com/yousfiSaad/morocco-map, paquet : https://www.npmjs.com/package/morocco-map
   - Données dérivées d'OpenStreetMap. **Licence ODbL 1.0.** Attribution obligatoire : « © les contributeurs d'OpenStreetMap ». Toute base de données dérivée doit rester sous ODbL (partage à l'identique). Ce fichier est une base dérivée, il est donc lui aussi sous ODbL.
   - La source contient déjà les 3 régions du Sud comme régions marocaines (MA-10, MA-11, MA-12). Elle n'a ni entité séparée ni ligne à 27°40'N. Les suffixes « (EH) » / « (EH-partial) » de son champ `name:en` ont été supprimés à la normalisation.
2. **Voisins** : Natural Earth `ne_50m_admin_0_countries` (v5, https://github.com/nvkelso/natural-earth-vector). **Domaine public.** Seuls DZA, MRT, MLI, ESP et PRT ont été repris. Les entités MAR et SAH de Natural Earth ne figurent pas dans le fichier de sortie.

## Traitement

1. TopoJSON → `mapshaper@0.6.102` : `-clean` (57 micro-interstices supprimés), puis `-simplify 40% keep-shapes` (Visvalingam, avec la topologie partagée entre régions), puis un second `-clean`, puis une sortie GeoJSON RFC 7946 à `precision=0.0001`.
2. Normalisation en Python : `code` à partir de l'id ISO (`MA-07` → `"07"`). `nom` reprend la liste officielle française. `nom_ar` suit la forme du décret 2.15.40 (mêmes graphies que la source, sauf pour la région 02, « الشرق » au lieu de « الشرقية »). Les entités sont triées par code et les coordonnées arrondies à 4 décimales.
3. Voisins : pays Natural Earth découpés au cadre -20..2,5°E / 19..38,5°N. Les interstices entre la frontière Natural Earth et le contour OSM sont comblés par extension vers la zone MAR+SAH de Natural Earth. On soustrait ensuite l'union des 12 régions (marge de 0,0002°). Les parties espagnoles situées sur le continent africain sont retirées (on garde la péninsule Ibérique et les Canaries). La géométrie est simplifiée à 25 % et arrondie à 4 décimales.

## Vérifications (script shapely + matplotlib, aperçu inspecté visuellement)

- 12 entités, codes 01 à 12, toutes les géométries sont valides (`is_valid`).
- Aucun nom contenant « Western », « Occidental », « Sahara occ. » ou « EH ».
- BBox de l'union : lon **-17,103 .. -0,998**, lat **20,776 .. 35,923**.
- Continuité : l'union forme **un seul territoire continental**, qui porte 99,9994 % de la surface, de Tanger (35,9°N) à Lagouira (20,78°N). Les 14 autres parties sont de petits îlots côtiers (lagune de Nador, etc.).
- Tests de point : Tanger → 01, Oujda → 02, Laâyoune → 11, Dakhla → 12, Lagouira (-17,08 ; 20,85) → 12, Guerguerat (-16,95 ; 21,37) → 12.
- 27°40'N : le transect de -14° à -8,6° à 27,667°N reste à l'intérieur du territoire en **un seul morceau** (pas de trou, pas de coupure). Aucune frontière rectiligne ne suit ce parallèle. Les seuls segments proches sont le trait de côte et les méandres de la limite Guelmim–Laâyoune, qui s'étend de 27,14 à 28,21°N, conformément au découpage provincial (Tarfaya rattachée à Laâyoune-Sakia El Hamra, Assa-Zag à Guelmim-Oued Noun).
- Les voisins ne recouvrent pas le Maroc : recouvrement ≈ 0 km² pour chaque pays.

## Points d'attention

- **Attribution ODbL** à afficher dans Leaflet : `attribution: '© les contributeurs d'OpenStreetMap (ODbL)'`.
- **Ceuta et Melilla** ne font pas partie des polygones (encoches côtières, conformément à OSM). Ils ne figurent pas non plus dans `maroc_voisins.geojson`.
- Un trou d'environ 9 km² près de Moulay Bousselham (-6,28 ; 34,86) correspond à la lagune de Merja Zerga, qui est une surface en eau.
- La précision de la source est d'environ 150 m (quantification TopoJSON). Elle convient à un tableau de bord, pas à un usage cadastral.
- Les noms arabes doivent être relus par un arabophone si un affichage officiel est requis.

## Noms des régions

| code | nom | nom_ar |
|---|---|---|
| 01 | Tanger-Tétouan-Al Hoceïma | طنجة - تطوان - الحسيمة |
| 02 | L'Oriental | الشرق |
| 03 | Fès-Meknès | فاس - مكناس |
| 04 | Rabat-Salé-Kénitra | الرباط - سلا - القنيطرة |
| 05 | Béni Mellal-Khénifra | بني ملال - خنيفرة |
| 06 | Casablanca-Settat | الدار البيضاء - سطات |
| 07 | Marrakech-Safi | مراكش - آسفي |
| 08 | Drâa-Tafilalet | درعة - تافيلالت |
| 09 | Souss-Massa | سوس - ماسة |
| 10 | Guelmim-Oued Noun | كلميم - واد نون |
| 11 | Laâyoune-Sakia El Hamra | العيون - الساقية الحمراء |
| 12 | Dakhla-Oued Ed-Dahab | الداخلة - وادي الذهب |
