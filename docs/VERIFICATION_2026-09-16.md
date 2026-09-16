# Vérification — accueil, carte mondiale et socle mobile

## Modifications livrées

- Accueil EN/FR/RO : exploration avant études, étudiant pendant les études, spécialiste après les études ; question introspective, perspective rétrospective d'un psychiatre et liens vers la carte et les crédits.
- Spécialiste : sélection de la spécialité pratiquée, entretien écrit conservé lors du retour arrière ; les 81 réponses restent facultatives.
- Carte publique : géographie volontaire, agrégats PostgreSQL de mois clos, cellules fixes de dix réponses minimum arrondies au multiple inférieur de cinq. Les entretiens sans questionnaire complet et les réponses sans nouveau consentement géographique sont exclus.
- Reprise locale : choix explicite de reprendre/remplacer un brouillon ; désactivation persistante de la sauvegarde ; conservation de la version publiée exacte du catalogue.
- Envoi différé : consentement explicite, identifiant/payload figés, confirmation serveur distinguée de la file d'attente, refus d'une réutilisation avec contenu modifié, coordination entre onglets, délai réseau de vingt secondes par tentative.
- Projets Capacitor Android/iOS partageant intégralement l'application et le moteur TypeScript ; stockage natif sécurisé pour brouillons, file et sessions du portail.

## Vérifications réalisées

- `npm run lint` et `npm run typecheck`.
- `npm run test:dashboard` : anciennes fonctionnalités et éligibilité historique conservées ; provenance `fnv1a64-abdce4ee5b50c668` inchangée.
- `npm run test:specialty-content` : 58 spécialités, trois langues, textes spécialistes et migration synchronisés.
- `npm run test:map` : contrats d'agrégats, totaux, filtres, géographie, traductions et géométrie.
- `npm run test:mobile` : reprise, contenu de catalogue figé, scores identiques, files idempotentes, expiration, données incompatibles, concurrence entre instances/onglets.
- `npm run test:browser` : Edge/Chromium à 375 px et sur bureau ; EN/FR/RO, navigation/crédits, tap réel sur SVG, zoom, filtres, conservation des textes et des notes après rechargement, consentement hors connexion puis un seul envoi confirmé à la reconnexion, rejet d'une modification sous un UUID déjà reçu, choix d'effacement et désactivation persistante.
- Les appels Supabase du test navigateur sont entièrement interceptés. Aucun questionnaire synthétique n'est envoyé à la production.
- CI Supabase du commit `5daa0a7860c5099e00d4c888024ad06bd33f026e` : migration appliquée dans une instance isolée, suite pgTAP historique et 61 nouvelles assertions réussies, lint SQL réussi. [Exécution](https://github.com/abdelmac/Q-pro/actions/runs/35097431771).
- Migration `20260916122348_geographic_participation_map.sql` appliquée au projet Supabase utilisé par le site. Tests non mutateurs `test:supabase-runtime` et `node scripts/verify-map-runtime.mjs` réussis ; catalogue publié révision 12, 58 spécialités ; accès anonyme aux réponses et à l'éditeur refusé.
- Job `q-pro-publish-participation-map` actif : `15 1 1 * *`. Publication mensuelle UTC ; procédure de récupération d'un mois manqué dans `PARTICIPATION_MAP.md`.
- `npm run build`, `npm run build:mobile` et synchronisation Capacitor Android/iOS.
- Document Word régénéré et archive/XML validés par `scripts/generate_database_docx.py`.

## Restriction complémentaire : filtres administrateurs

- La carte publique conserve les agrégats globaux, le zoom, le déplacement et les détails de pays. Les filtres de type de participant, pays, langue, période et version sont réservés aux comptes activés `doctor`/`professor`, après connexion au dashboard ; le choix « spécialiste » du questionnaire ne donne aucun privilège.
- Migration additive `20260916155938_admin_only_participation_map_filters.sql` : tout argument non standard exige une autorisation serveur avant validation du filtre. Aucun nouveau droit de lecture des réponses individuelles.
- Tests navigateur réussis : public sans filtres en trois langues, administrateurs sur mobile/bureau, refus des chercheurs/comptes désactivés/profils invalides, déconnexion avec panneau ouvert, révocation après erreur `42501` et réponse d'autorisation tardive après déconnexion. Appels Auth/recherche intégralement simulés.
- Tests carte, dashboard, mobile, contenu multilingue, lint, typage, builds web/mobile, synchronisation Capacitor et validation Word réussis. Contrôle local PostgreSQL/WASM : les quinze migrations et 82 assertions carte passent ; Auth/Cron/pgTAP y sont simulés et la CI Supabase demeure le contrôle intégré.

## Carte intégrée au portail administrateur

- Nouvelle entrée **Administration → Carte de participation**, traduite en anglais, français et roumain, réservée aux comptes d'administration. La sidebar, le retour à l'onglet précédent et la déconnexion restent ceux du portail.
- Carte partagée chargée à la demande : aucun second en-tête, titre principal ou élément `main`. Tous les filtres existants restent disponibles ; Actualiser conserve les six paramètres appliqués et ne soumet pas un brouillon de filtre.
- Vérifications navigateur : médecin à 375 px, professeur à 1440 px, largeur intermédiaire 1024 px, sélection et réinitialisation des six filtres, dates invalides, Actualiser, historique des onglets, déconnexion et absence de l'onglet pour un chercheur. Aucune lecture de réponses individuelles pendant les interactions avec la carte ; tous les appels Auth et tables du test sont simulés.
- Correction ciblée du conteneur du tableau : son positionnement relatif empêche un libellé accessible hors écran d'élargir le viewport mobile et de rendre le bas de la sidebar inaccessible.
- Aucune nouvelle migration ; la protection Supabase existante est conservée et les tests distants non mutateurs de la carte passent.

## Limites et points à conserver visibles

Les compteurs publics ne sont ni instantanés ni exacts, et ne représentent pas des personnes uniques vérifiées. Une carte vide au lancement est normale : aucune localisation historique n'est inventée et aucun petit groupe n'est divulgué.

L'audit de sécurité Supabase ne signale aucune erreur bloquante. Il signale les façades RPC `SECURITY DEFINER` intentionnellement exécutables pour lire le catalogue/les agrégats ou soumettre un questionnaire ; leurs validations et frontières d'accès sont testées. Il signale aussi la protection Auth contre les mots de passe compromis, déjà désactivée : activation à examiner dans les réglages Supabase Auth. Les autorisations du portail restent contrôlées côté serveur.

Le build web conserve un avertissement de taille du bundle principal (textes multilingues embarqués). La carte et le dashboard sont chargés séparément. Les polices externes peuvent ne pas se charger hors connexion ; les polices de repli restent utilisables.

La préparation mobile n'est pas une publication App Store/Google Play. Cet environnement ne dispose pas de JDK/Android Studio ni de macOS/Xcode : aucun APK/AAB/IPA compilé et signé ni test physique du stockage natif n'est annoncé. Ces étapes, le choix définitif de l'identifiant d'application et les déclarations de confidentialité des boutiques sont décrits dans `MOBILE.md`.
