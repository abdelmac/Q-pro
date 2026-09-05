# Q Project

## Structure de la base de données et portail Specialist/Admin

**Version documentaire :** 5 septembre 2026

**Migrations de référence :** `supabase/migrations/20260831120000_specialist_admin_portal.sql` et `supabase/migrations/20260904193000_accuracy_and_qualitative_specialist_v2.sql`

**Périmètre :** Supabase Auth, PostgreSQL, collecte de recherche, catalogue éditable des spécialités, sécurité, versionnement et provenance scientifique.

Ce document décrit la structure fonctionnelle et technique de la base Q Project après l’introduction du portail Specialist/Admin. Il ne contient aucun secret, aucune adresse de compte et aucun mot de passe.

<!-- PAGEBREAK -->

## Sommaire

1. Résumé exécutif
2. Architecture générale
3. Séparation des schémas PostgreSQL
4. Diagramme des relations
5. Dictionnaire des tables
6. Fonctions RPC et points d’entrée
7. Matrice des permissions
8. Workflow Doctor → Professor
9. Sécurité RLS et validation côté serveur
10. Versionnement et provenance des résultats
11. Limites scientifiques du moteur actuel
12. Sauvegarde, restauration et continuité
13. Tests et déploiement
14. Exploitation et bonnes pratiques
15. Glossaire

## 1. Résumé exécutif

Q Project utilise Supabase pour deux familles de données strictement séparées :

- les **réponses anonymes de recherche** des étudiants et des spécialistes ;
- la **configuration versionnée du moteur de matching**, comprenant les descriptions, les résumés cliniques et les profils de traits des spécialités.

Le portail administratif ne modifie jamais les réponses de recherche. Il permet à des comptes autorisés de préparer un brouillon du catalogue, de documenter les changements et de publier une nouvelle version sans modifier le code TypeScript.

Les principes structurants sont les suivants :

- Supabase Auth gère l’identité des membres du portail ;
- `private.researchers` constitue l’allowlist applicative et porte le rôle du portail ;
- toutes les tables éditoriales et d’audit restent dans le schéma non exposé `private` ;
- le navigateur ne reçoit que des fonctions RPC étroites et validées ;
- Doctor et Professor peuvent modifier un brouillon ;
- seul Professor peut publier ou demander la restauration d’une version historique ;
- une version publiée est un instantané immuable ;
- chaque nouvelle soumission de schéma 2, envoyée par une RPC v3, enregistre la version exacte du catalogue utilisée ;
- l'entretien spécialiste de schéma 2 collecte cinq réponses qualitatives après les 81 items, au lieu des anciens champs structurés d'expérience, satisfaction, intention de changement et caractère volontaire du choix ;
- les anciennes colonnes et les anciennes RPC restent présentes afin de conserver l'historique sans le mélanger au protocole courant ;
- les indicateurs Top-k sont descriptifs et ne modifient jamais automatiquement les poids.

La migration `20260831120000_specialist_admin_portal.sql` ajoute la couche éditoriale sans supprimer les fonctions v1 historiques. La migration `20260904193000_accuracy_and_qualitative_specialist_v2.sql` ajoute le schéma de soumission 2 et les RPC v3, publie un nouvel instantané immuable qui complète les traits clés mesurés manquants, et laisse volontairement `prevention_orientation` non mesuré. Les appels v2 restent utilisables pour l'historique ; les nouvelles collectes utilisent v3.

## 2. Architecture générale

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Application React                                                   │
│                                                                     │
│  Questionnaire public             Dashboard sécurisé                │
│  - catalogue actif                - réponses de recherche            │
│  - soumissions v3 / schéma 2      - réponses qualitatives            │
│                                    - publication / historique        │
└───────────────┬───────────────────────────────┬─────────────────────┘
                │ clé publique                  │ session Auth JWT
                ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API Supabase / PostgREST / Auth                                     │
│                                                                     │
│ RPC publiques validées             RPC administratives contrôlées   │
│ get_active_specialty_catalog       current_user_portal_profile      │
│ submit_*_response_v1/v2/v3         get/save/publish/list/restore     │
└───────────────┬───────────────────────────────┬─────────────────────┘
                ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PostgreSQL                                                          │
│                                                                     │
│ public : réponses + façades RPC                                     │
│ private : rôles, catalogue, versions, audit, validateurs            │
│ auth : comptes gérés par Supabase                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Flux public

1. L’application charge l’unique catalogue publié avec `get_active_specialty_catalog()`.
2. Le moteur construit le profil et le classement dans le navigateur.
3. La soumission v3 transmet l’identifiant UUID de la version publiée utilisée et crée une ligne de `submission_schema_version = 2`.
4. PostgreSQL vérifie que cet UUID correspond bien à un instantané publié.
5. La réponse et la révision du catalogue sont enregistrées ensemble.
6. Pour un spécialiste, la spécialité réelle et les cinq réponses qualitatives ne sont demandées qu'après les 81 notes et le choix des valeurs, afin de réduire le biais d'ancrage pendant le questionnaire principal.

### 2.2 Flux administratif

1. Supabase Auth authentifie le compte.
2. `current_user_portal_profile()` résout son autorisation et son rôle.
3. Les données de recherche, y compris le verbatim qualitatif des spécialistes et les exports, restent accessibles uniquement aux chercheurs allowlistés.
4. Doctor ou Professor ouvre le brouillon, le modifie et fournit une justification.
5. Le verrou optimiste empêche l’écrasement silencieux d’un changement concurrent.
6. Professor publie atomiquement la version complète.

## 3. Séparation des schémas PostgreSQL

| Schéma | Exposition | Responsabilité |
|---|---|---|
| `auth` | Géré par Supabase | Comptes, sessions, identité et authentification. |
| `public` | Exposé par l’API selon les privilèges | Tables de réponses anonymes et façades RPC explicitement accordées. |
| `private` | Non exposé au navigateur | Allowlist, rôles, validateurs, catalogue éditable, versions et journal d’audit. |

Cette séparation limite la surface d’attaque. Les rôles `anon` et `authenticated` n’obtiennent aucun droit direct sur les tables privées. Les fonctions publiques `SECURITY DEFINER` constituent les seuls passages autorisés et réalisent leurs propres contrôles de rôle et de validité.

## 4. Diagramme des relations

```text
auth.users
    │ 1
    │
    │ 0..1  ON DELETE CASCADE
    ▼
private.researchers
    user_id PK
    portal_role = researcher | doctor | professor

private.specialty_catalog_versions
    id UUID PK
    revision BIGINT UNIQUE
    parent_version_id ───────────────┐
    status draft | active | archived │ auto-référence
             │ 1                     │
             │                       └───────────────┐
             │ N                                     │
             ▼                                       │
private.specialty_catalog_entries                    │
    PK (version_id, name)                            │
    descriptions / clinical_summaries / profile      │
                                                     │
private.specialty_catalog_audit                      │
    version_id ──────────────────────────────────────┘
    journal append-only

private.trait_catalog
    code PK
    provenance de mesure utilisée pour valider profile JSONB

public.student_responses                 public.specialist_responses
    specialty_config_version_id ─┐           specialty_config_version_id ─┐
    specialty_config_revision ───┴────────── specialty_config_revision ───┴─►
             FK composite vers (id, revision) de specialty_catalog_versions
```

Les réponses ne référencent pas `auth.users`. Elles restent anonymes du point de vue du modèle applicatif. Seuls les membres du portail ont une relation avec un compte Auth.

## 5. Dictionnaire des tables

### 5.1 `auth.users`

Table gérée par Supabase Auth. Q Project ne la recrée pas et n’y stocke aucune donnée de questionnaire.

Éléments utilisés par l’application :

- `id` : UUID du compte Auth ;
- identité e-mail et état de confirmation, gérés par Supabase ;
- mot de passe conservé uniquement sous forme sécurisée par le service Auth ;
- session JWT utilisée par `auth.uid()` dans PostgreSQL.

La création, l’invitation ou la suppression d’un compte relève d’une opération d’administration Supabase. Un compte Auth seul ne donne aucun accès aux données de recherche : il doit également être actif dans `private.researchers`.

### 5.2 `private.researchers`

Allowlist des personnes autorisées à utiliser le dashboard.

| Colonne | Type | Rôle |
|---|---|---|
| `user_id` | `uuid` PK, FK vers `auth.users(id)` | Identité Auth. Suppression en cascade lorsque le compte Auth disparaît. |
| `display_name` | `text`, nullable | Nom affiché dans le portail et l’historique. |
| `enabled` | `boolean` | Révocation immédiate sans supprimer le compte Auth. |
| `created_at` | `timestamptz` | Date d’ajout à l’allowlist. |
| `portal_role` | `text` | `researcher`, `doctor` ou `professor`. |

La contrainte `researchers_portal_role_check` empêche toute valeur de rôle non prévue.

### 5.3 `private.trait_catalog`

Catalogue technique des traits connus par le moteur. Cette table documente surtout la provenance de chaque mesure.

| Colonne | Type | Rôle |
|---|---|---|
| `code` | `text` PK | Identifiant stable, par exemple `precision`. |
| `dimension` | `text` | `thinking`, `working`, `interpersonal`, `technical` ou `lifestyle`. |
| `measurement_source` | `text` | `question`, `question_and_value`, `value_only` ou `unmeasured`. |
| `warning` | `text`, nullable | Avertissement scientifique ou opérationnel. |
| `created_at` | `timestamptz` | Date d’initialisation du trait. |

Le profil JSONB de chaque spécialité ne peut référencer qu’un code présent dans cette table.

Le catalogue courant contient 96 traits : 92 sont produits par les notes du questionnaire, 3 (`manual_orientation`, `prestige_priority`, `security_priority`) uniquement lorsqu'une valeur professionnelle correspondante est sélectionnée, et 1 (`prevention_orientation`) n'est actuellement produit par aucune question ni valeur.

### 5.4 `private.specialty_catalog_versions`

Registre des instantanés du catalogue.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid` PK | Identifiant immuable de la version. |
| `revision` | `bigint identity`, unique | Numéro humain croissant. |
| `label` | `text` | Libellé lisible de la version. |
| `status` | `text` | `draft`, `active` ou `archived`. |
| `lock_version` | `bigint` | Verrou optimiste incrémenté lors des modifications. |
| `parent_version_id` | `uuid`, FK auto-référente | Version dont le brouillon est issu. |
| `note` | `text` | Justification obligatoire, de 3 à 1 000 caractères. |
| `created_by` | `uuid`, nullable | Acteur ayant créé le brouillon. |
| `created_at` | `timestamptz` | Date de création. |
| `published_by` | `uuid`, nullable | Professor ayant publié. |
| `published_at` | `timestamptz`, nullable | Date de publication. |
| `checksum` | `text`, nullable | Empreinte déterministe du contenu publié. |

Deux index uniques partiels imposent au maximum :

- une seule version `active` ;
- une seule version `draft`.

Une version `draft` ne possède ni date de publication ni checksum. Une version `active` ou `archived` possède sa date de publication et son empreinte. Les versions publiées ne sont pas éditées : une nouvelle modification passe toujours par un autre brouillon.

### 5.5 `private.specialty_catalog_entries`

Contenu complet des spécialités pour une version donnée.

| Colonne | Type | Rôle |
|---|---|---|
| `version_id` | `uuid`, FK | Version propriétaire de l’entrée. |
| `name` | `text` | Nom canonique de la spécialité. |
| `category` | `text` | Catégorie médicale contrôlée. |
| `descriptions` | `jsonb` | Textes courts `{en, fr, ro}`. |
| `clinical_summaries` | `jsonb` | Résumés cliniques `{en, fr, ro}`. |
| `profile` | `jsonb` | Dictionnaire `trait: [cible, importance]`. |
| `updated_by` | `uuid`, nullable | Dernier éditeur. |
| `updated_at` | `timestamptz` | Date de dernière modification. |

Clé primaire : `(version_id, name)`.

Règles principales :

- les trois langues `en`, `fr` et `ro` sont obligatoires ;
- une description contient de 1 à 2 000 caractères par langue ;
- un résumé clinique contient de 20 à 5 000 caractères par langue ;
- une cible est un entier compris entre 0 et 100 ;
- l’importance est bornée par la base et l’interface standard expose l’échelle 1 à 3 ;
- les noms et catégories ne peuvent pas être changés par l’éditeur ;
- une entrée d’une version publiée ne peut pas être modifiée ou supprimée ;
- `prevention_orientation` ne peut pas être modifié tant qu’il reste non mesuré.

#### Révision d'intégrité du schéma 2

La migration du 4 septembre 2026 ne modifie pas en place l'instantané actif. Elle en crée une copie, complète uniquement des clés absentes puis publie la copie comme une nouvelle révision immuable. L'ancien actif devient `archived`, un nouveau checksum est calculé et l'opération est inscrite dans `private.specialty_catalog_audit` avec l'acteur `system`.

Cette réparation aligne les profils avec les traits clés déjà annoncés dans les métadonnées des spécialités, par exemple `communication`, `precision`, `detail_orientation`, `long_term_orientation`, `cognitive_empathy`, `care_coordination`, `teamwork`, `patience`, `technology_interest`, `social_energy`, `independence` et `lifestyle_priority`. Une cible existante gagne toujours sur la valeur proposée par la migration : seules les omissions sont comblées. Un éventuel brouillon en cours reçoit la même réparation additive, son `lock_version` est incrémenté et chaque changement est audité.

`prevention_orientation` est explicitement exclu de cette opération. Sa présence dans une description ou parmi des traits clés ne transforme pas ce concept en mesure : `q81-v1` ne produit toujours aucune valeur comparable pour ce trait.

### 5.6 `private.specialty_catalog_audit`

Journal append-only de chaque action significative.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `bigint identity` PK | Numéro d’événement. |
| `occurred_at` | `timestamptz` | Date de l’action. |
| `actor_user_id` | `uuid`, nullable | Compte ayant effectué l’action. |
| `actor_role` | `text` | Rôle au moment de l’action ou `system`. |
| `action` | `text` | `seeded`, `draft_created`, `entry_updated`, `published` ou `restore_requested`. |
| `version_id` | `uuid`, FK | Version concernée. |
| `version_revision` | `bigint` | Révision lisible concernée. |
| `specialty_name` | `text`, nullable | Spécialité concernée lorsqu’applicable. |
| `note` | `text` | Justification obligatoire. |
| `before_value` | `jsonb`, nullable | État précédent. |
| `after_value` | `jsonb`, nullable | Nouvel état. |

Le journal permet de déterminer qui a changé quoi, quand, avec quelle justification et dans quelle version. Les comptes doivent donc rester individuels ; un compte partagé détruirait cette attribution.

### 5.7 `public.student_responses`

Réponses anonymes des étudiants.

| Groupe | Colonnes | Description |
|---|---|---|
| Identité technique | `id`, `created_at` | UUID de soumission et horodatage. Aucun lien vers Auth. |
| Contexte | `study_year`, `preferred_specialty`, `language` | Métadonnées facultatives et langue. |
| Données brutes | `ratings`, `selected_values` | 81 notes et 1 à 4 valeurs professionnelles. |
| Résultat client | `client_scores` | Classement calculé dans le navigateur, non vérifié. |
| Versions scientifiques | `submission_schema_version`, `questionnaire_version`, `value_catalog_version`, `specialty_catalog_version`, `scoring_version`, `consent_version` | Versions nécessaires à l’interprétation. |
| Provenance du catalogue | `specialty_config_version_id`, `specialty_config_revision` | Instantané publié exact utilisé par les soumissions v2 et v3 ; obligatoire pour le schéma 2. |

La paire de provenance est soit entièrement absente, soit entièrement présente. Une clé étrangère composite pointe vers `(id, revision)` de `private.specialty_catalog_versions`.

### 5.8 `public.specialist_responses`

Réponses anonymes des médecins spécialistes utilisées pour étudier la calibration.

| Groupe | Colonnes | Description |
|---|---|---|
| Identité technique | `id`, `created_at` | UUID de soumission et horodatage. Aucun lien vers Auth. |
| Spécialité réelle | `actual_specialty` | Spécialité déclarée par le participant. |
| Données brutes | `ratings`, `selected_values`, `language` | 81 notes, valeurs choisies et langue. |
| Entretien qualitatif courant | `current_specialty_view`, `specialty_changes_over_years`, `most_important_specialty_quality`, `student_self_question` | Quatre textes obligatoires du schéma 2, nettoyés des espaces périphériques. Les trois premiers acceptent 3 à 2 000 caractères ; la question destinée à l'étudiant, 3 à 1 000 caractères. |
| Choix à refaire | `would_choose_again_code`, `would_not_choose_again_reason` | Code obligatoire `yes` ou `no`. La raison de 3 à 2 000 caractères est obligatoire si la réponse vaut `no` et doit rester `NULL` si elle vaut `yes`. |
| Champs structurés legacy | `years_of_experience`, `career_satisfaction`, `intention_to_change_code`, `voluntary_choice_code` | Anciens champs conservés pour relire les lignes historiques. Les nouvelles lignes de schéma 2 les laissent à `NULL`. |
| Libellés legacy | `would_choose_again`, `intention_to_change`, `voluntary_choice` | Anciennes étiquettes localisées conservées pour l'historique ; elles restent `NULL` pour le schéma 2. |
| Versions scientifiques | `submission_schema_version`, `questionnaire_version`, `value_catalog_version`, `specialty_catalog_version`, `calibration_version`, `consent_version` | Versions nécessaires à l’analyse. |
| Provenance du catalogue | `specialty_config_version_id`, `specialty_config_revision` | Instantané publié exact utilisé par les soumissions v2 et v3 ; obligatoire pour le schéma 2. |

Comme pour les étudiants, la paire `(specialty_config_version_id, specialty_config_revision)` est cohérente et contrôlée par une clé étrangère composite. La suppression de l'ancien formulaire ne supprime donc aucune colonne ni aucune réponse historique : elle sépare le protocole courant de l'ancien par `submission_schema_version` et les versions scientifiques.

Pour le protocole courant, les versions enregistrées sont :

- `submission_schema_version = 2` ;
- `questionnaire_version = q81-v1` ;
- `value_catalog_version = career-values-v1` ;
- `specialty_catalog_version = medical-specialties-v1` ;
- `scoring_version = client-scoring-v2` pour les étudiants ;
- `calibration_version = calibration-v2-qualitative` pour les spécialistes ;
- `consent_version = research-consent-2026-09-04`.

Le libellé stable `medical-specialties-v1` désigne le format canonique du catalogue. La provenance de son contenu effectif est donnée séparément par l'UUID et la révision de l'instantané publié.

## 6. Fonctions RPC et points d’entrée

### 6.1 Accès et identité du portail

#### `current_user_is_researcher()`

Retourne un booléen indiquant si `auth.uid()` correspond à un chercheur actif. Cette fonction maintient la compatibilité avec le dashboard de recherche existant.

#### `current_user_portal_profile()`

Retourne un objet JSON minimal : autorisation, nom affiché, rôle, droit de consulter la recherche, droit d’éditer le catalogue et droit de publier. Elle ne renvoie ni e-mail ni donnée Auth sensible.

### 6.2 Lecture du catalogue

#### `get_active_specialty_catalog()`

Accessible publiquement. Retourne uniquement l’instantané `active` : métadonnées de version, 58 spécialités, textes localisés et profils de matching. Aucun brouillon, acteur interne ou journal d’audit n’est exposé.

#### `get_specialty_catalog_draft()`

Réservée à Doctor et Professor. Retourne le brouillon courant avec son `lock_version`. En l’absence de brouillon, elle retourne l’actif comme base de travail.

#### `list_specialty_catalog_versions()`

Réservée à Doctor et Professor. Retourne l’historique des versions, leur statut, leur parent, leur justification, leur acteur, leur date et leur checksum.

### 6.3 Édition et publication

#### `save_specialty_catalog_entry_draft(...)`

Réservée à Doctor et Professor. Elle :

1. vérifie le rôle ;
2. exige une note de changement ;
3. contrôle le verrou optimiste ;
4. crée le brouillon depuis l’actif si nécessaire ;
5. valide les trois langues et le profil ;
6. interdit toute modification de `prevention_orientation` ;
7. incrémente `lock_version` ;
8. écrit l’avant/après dans le journal d’audit.

#### `publish_specialty_catalog_draft(...)`

Réservée à Professor. La publication vérifie dans une transaction :

- le verrou du brouillon ;
- la présence exacte des 58 spécialités ;
- la validité de chaque entrée ;
- l’absence de changement interdit sur `prevention_orientation`.

Elle calcule ensuite le checksum, archive l’ancienne version active et active le brouillon. L’opération est atomique : il ne doit jamais exister un catalogue à moitié publié.

#### `restore_specialty_catalog_version(...)`

Réservée à Professor. La restauration ne réécrit pas l’historique. Elle copie un instantané publié antérieur dans une nouvelle révision, archive l’actif courant et publie la copie de façon atomique. Elle ne réactive jamais directement l’ancienne ligne historique.

### 6.4 Soumissions de recherche

#### `submit_student_response_v1(...)` et `submit_specialist_response_v1(...)`

Fonctions historiques conservées pour compatibilité. Elles valident strictement le payload mais ne demandaient pas initialement l’identifiant de la configuration dynamique.

#### `submit_student_response_v2(...)` et `submit_specialist_response_v2(...)`

Ajoutent `p_specialty_config_version_id`. La base refuse un identifiant absent ou un instantané qui n’a jamais été publié. La révision correspondante est résolue côté serveur puis enregistrée avec la réponse.

Les fonctions restent idempotentes sur l’UUID de soumission. Un rejeu avec une provenance différente est refusé.

#### `submit_student_response_v3(...)`

Point d'entrée courant des étudiants. Il conserve les 81 items et le catalogue de valeurs, impose `client-scoring-v2`, `research-consent-2026-09-04` et la provenance exacte d'un catalogue publié, puis écrit `submission_schema_version = 2`. L'UUID fourni par le client reste idempotent : un rejeu strictement identique renvoie le même identifiant, tandis qu'un payload différent avec le même UUID est refusé.

#### `submit_specialist_response_v3(...)`

Point d'entrée courant des spécialistes. Après les 81 notes et les valeurs, il reçoit :

1. la spécialité actuelle ;
2. la manière dont le spécialiste voit aujourd'hui sa spécialité ;
3. ce qui a changé au fil des années ;
4. la qualité la plus importante pour cette spécialité ;
5. le choix `yes` ou `no` de refaire la même spécialité, avec une justification obligatoire seulement pour `no` ;
6. la question qu'un étudiant devrait se poser avant de choisir cette spécialité.

La fonction normalise les espaces périphériques, vérifie les longueurs et le caractère conditionnel de la justification, exige `calibration-v2-qualitative`, `research-consent-2026-09-04` et une provenance publiée, puis écrit une ligne de schéma 2. Les anciens champs d'expérience, satisfaction, intention de changement et caractère volontaire sont volontairement écrits à `NULL`.

Les façades `public.*_v3` sont exécutables par `anon` et `authenticated`. Elles délèguent aux implémentations `private.*_v3`, auxquelles ces rôles n'ont aucun droit direct.

### 6.5 Consultation et export des réponses qualitatives

Les comptes allowlistés disposant du droit de recherche peuvent :

- filtrer les spécialistes selon la complétude de l'entretien qualitatif ;
- prévisualiser la réponse sur la perception actuelle dans la liste ;
- ouvrir le détail d'une réponse et lire les cinq réponses dans leur intégralité ;
- exporter les colonnes qualitatives en JSON ou dans les CSV large, long et analytique ;
- consulter séparément les anciens champs pour les lignes antérieures au schéma 2.

La recherche, la pagination et l'export passent par les politiques RLS existantes. Les cellules CSV commençant comme une formule de tableur sont préfixées afin de limiter l'injection de formules lors de l'ouverture dans Excel ou un logiciel équivalent.

## 7. Matrice des permissions

| Opération | `anon` | Auth ordinaire | Researcher | Doctor | Professor |
|---|---:|---:|---:|---:|---:|
| Lire le catalogue actif | Oui | Oui | Oui | Oui | Oui |
| Soumettre une réponse v1/v2/v3 | Oui | Oui | Oui | Oui | Oui |
| Lire les réponses de recherche | Non | Non | Oui | Oui | Oui |
| Lire/exporter les verbatims spécialistes | Non | Non | Oui | Oui | Oui |
| Lire le brouillon | Non | Non | Non | Oui | Oui |
| Modifier le brouillon | Non | Non | Non | Oui | Oui |
| Consulter l’historique éditorial | Non | Non | Non | Oui | Oui |
| Publier une version | Non | Non | Non | Non | Oui |
| Demander une restauration | Non | Non | Non | Non | Oui |
| Écrire directement dans les tables privées | Non | Non | Non | Non | Non |
| Modifier/supprimer directement les réponses | Non | Non | Non | Non | Non |

Un administrateur serveur PostgreSQL conserve les capacités opérationnelles normales, mais celles-ci ne sont jamais accordées au navigateur.

## 8. Workflow Doctor → Professor

```text
Catalogue actif immuable
        │
        │ première modification documentée
        ▼
Brouillon unique créé depuis l’actif
        │
        ├── Doctor : édite contenus et poids, ajoute une justification
        ├── Professor : peut effectuer les mêmes éditions
        └── chaque sauvegarde : validation + lock_version + audit avant/après
        │
        ▼
Relecture scientifique et éditoriale
        │
        │ Professor uniquement
        ▼
Publication atomique
        ├── ancien actif → archived
        ├── brouillon → active
        ├── checksum calculé
        └── événement d’audit publié
```

### 8.1 Concurrence

Le client relit `lock_version` avant une sauvegarde ou une publication. Si un autre éditeur a modifié le brouillon entre-temps, PostgreSQL renvoie un conflit de sérialisation. L’éditeur doit recharger le brouillon et réappliquer consciemment sa modification.

### 8.2 Justification

Chaque sauvegarde, publication ou restauration exige une note de 3 à 1 000 caractères. Une bonne note doit préciser :

- la source clinique ou scientifique ;
- l’hypothèse testée ;
- la population concernée ;
- la raison d’un changement de poids ;
- la personne ayant relu le changement lorsque nécessaire.

## 9. Sécurité RLS et validation côté serveur

### 9.1 Tables privées

RLS est activée sur :

- `private.trait_catalog` ;
- `private.specialty_catalog_versions` ;
- `private.specialty_catalog_entries` ;
- `private.specialty_catalog_audit`.

Tous les privilèges directs sont révoqués pour `PUBLIC`, `anon` et `authenticated`. Une politique frontend permissive ajoutée par erreur ne suffit donc pas à exposer ces tables.

### 9.2 Fonctions `SECURITY DEFINER`

Les RPC publiques sensibles utilisent :

- `SECURITY DEFINER` ;
- `SET search_path = ''` ;
- des noms de schéma qualifiés ;
- `auth.uid()` résolu côté serveur ;
- un contrôle explicite des rôles ;
- des validations de type, longueur, catalogue et domaine ;
- des GRANT d’exécution limités fonction par fonction.

Les helpers privés ne sont exécutables ni par `anon` ni par `authenticated`.

### 9.3 Réponses de recherche

Le navigateur n’a aucun `INSERT`, `UPDATE` ou `DELETE` direct sur les tables de réponses. Les soumissions passent par des RPC validées. La lecture est filtrée par les politiques RLS existantes et l’allowlist `private.researchers`.

### 9.4 Validation des payloads

Les contraintes de table distinguent trois générations sans réinterpréter les anciennes lignes :

- le schéma 0 reste lisible comme legacy ;
- le schéma 1 conserve exactement `client-scoring-v1` ou `calibration-v1` et le consentement du 26 août 2026 ;
- le schéma 2 exige les versions courantes, les deux colonnes de provenance et les nouvelles règles qualitatives.

Pour le schéma 2, la base contrôle notamment :

- exactement 81 identifiants de questions attendus ;
- des notes entières de 1 à 10 ;
- une à quatre valeurs canoniques, distinctes ;
- une spécialité parmi les 58 valeurs du catalogue ;
- une langue parmi `en`, `fr`, `ro` ;
- les versions exactes du questionnaire, des catalogues, du scoring ou du calibrage et du consentement ;
- la structure des scores clients étudiants ;
- l'existence de l'instantané publié référencé et la cohérence UUID/révision ;
- quatre textes spécialistes obligatoires, non vides après normalisation et dans leurs longueurs maximales ;
- `would_choose_again_code` limité à `yes` ou `no` ;
- la présence d'une justification uniquement lorsque le choix vaut `no` ;
- la nullité des anciens champs structurés dans toute nouvelle réponse spécialiste.

Les contrôles existent à la fois dans les RPC et dans des contraintes `CHECK`, afin qu'une erreur interne ne puisse pas créer silencieusement une ligne de schéma 2 incohérente. Les lignes historiques restent consultables et exportables, mais le dashboard les signale comme incompatibles avec les indicateurs du protocole courant.

## 10. Versionnement et provenance des résultats

Une recommandation reproductible dépend de plusieurs éléments :

- les 81 réponses brutes ;
- les valeurs sélectionnées ;
- la version du questionnaire ;
- la version du catalogue de valeurs ;
- la version du catalogue canonique des spécialités ;
- la version du moteur de scoring ou de calibration ;
- la version du consentement ;
- l’UUID et la révision du catalogue dynamique publié.

Les RPC v2 et v3 enregistrent les deux derniers champs de provenance dans la ligne de réponse. Les RPC v3 les rendent obligatoires pour le schéma 2. Cela permet de retrouver l'instantané exact même après plusieurs publications et d'éviter d'analyser une réponse avec un catalogue différent de celui réellement utilisé.

Le `checksum` sert à détecter une différence de contenu et à identifier un instantané. Il n’est pas un secret et ne remplace pas le contrôle d’accès.

### 10.1 `client_scores`

`student_responses.client_scores` est un résultat calculé dans le navigateur. Il est conservé pour comprendre ce qui a été affiché, mais il n’est pas une mesure serveur vérifiée. Toute analyse scientifique doit recalculer les traits et le classement depuis les données brutes et la configuration versionnée.

### 10.2 Anciennes soumissions

Les fonctions v1 et v2 restent disponibles pour la compatibilité et certaines lignes anciennes peuvent ne pas avoir une provenance dynamique complète. Le dashboard distingue :

- données de schéma 2 courantes et reproductibles ;
- données de schéma 0 ou 1 consultables et exportables comme legacy ;
- données exclues des indicateurs pour incompatibilité de version.

## 11. Limites scientifiques du moteur actuel

### 11.1 `manual_orientation`

Dans `private.trait_catalog`, `manual_orientation` a la provenance `value_only`.

Ce trait n'est créé que lorsqu'un participant sélectionne la valeur « Manual/hands-on activity ». Dans `client-scoring-v2`, cette sélection produit un signal explicite de 90/100. Elle ne part plus d'une pseudo-valeur neutre de 50 susceptible de pénaliser paradoxalement les spécialités manuelles. Pour les traits déjà mesurés par les 81 réponses, les valeurs de carrière ne changent plus le niveau du trait : elles augmentent seulement son importance dans la comparaison avec les spécialités.

Cette correction supprime un défaut directionnel du moteur précédent, mais elle ne transforme pas `manual_orientation` en mesure de questionnaire. Les participants qui ne sélectionnent pas cette valeur ne disposent toujours pas d'une mesure comparable de ce trait.

Conséquences :

- la couverture du trait est partielle ;
- les scores peuvent reposer sur des ensembles de traits différents ;
- une moyenne observée sur ce trait ne représente pas automatiquement toute la cohorte ;
- toute modification de son poids exige une justification scientifique spécifique.

### 11.2 `prevention_orientation`

Dans `private.trait_catalog`, `prevention_orientation` a la provenance `unmeasured`.

Aucune question et aucune valeur sélectionnée ne produisent actuellement ce trait. La migration et le portail empêchent sa modification afin qu’un poids non mesuré ne soit pas augmenté ou ajouté silencieusement.

Avant de rendre ce trait calibrable, il faut :

1. ajouter une mesure directe validée ; ou
2. rattacher des items existants avec une justification documentée ; ou
3. retirer le trait des profils concernés ; ou
4. définir une baseline commune et scientifiquement défendable.

Cette correction doit créer une nouvelle version du questionnaire, du moteur ou du protocole selon la nature du changement.

### 11.3 Dimensions non observées et portée du score

Lorsqu'un profil de spécialité ne contient aucun trait d'une dimension, `client-scoring-v2` représente le sous-score comme non mesuré (`NULL` dans le modèle applicatif, affiché par un tiret) et non comme 0 %. Cette distinction évite de présenter une absence de preuve comme une incompatibilité.

Le score global reste un indice de proximité interne au moteur et au catalogue versionnés. Il ne doit pas être interprété comme une probabilité de réussite, une certitude d'orientation ou une validation clinique. Les poids par défaut et les préférences sélectionnées doivent toujours accompagner un export analytique afin de rendre le calcul interprétable.

### 11.4 Interprétation des Top-k

Le rappel Top-k répond uniquement à la question : « la spécialité déclarée par le spécialiste apparaît-elle parmi les k premières recommandations du moteur courant ? »

Il ne constitue pas :

- une probabilité de réussite ;
- une précision diagnostique ;
- une validation clinique ;
- une preuve causale ;
- une autorisation automatique de modifier les poids.

Une amélioration du Top-k sur la même cohorte utilisée pour ajuster les poids peut être un simple surapprentissage. Les Top-k sont descriptifs et ne valident jamais seuls un changement de profil ou de poids.

Une calibration défendable exige notamment :

- des effectifs suffisants par spécialité ;
- des critères d’inclusion définis à l’avance ;
- la gestion des soumissions multiples ;
- une cohorte de validation indépendante ;
- une analyse des incertitudes et des ex æquo ;
- une revue clinique des résultats ;
- un protocole versionné et, idéalement, pré-enregistré.

## 12. Sauvegarde, restauration et continuité

### 12.1 Avant une migration

- sauvegarder la base ;
- vérifier l’historique des migrations locales et distantes ;
- exécuter un dry-run ;
- relire les changements de privilèges ;
- ne jamais utiliser une réinitialisation destructive sur un projet contenant des données réelles.

### 12.2 Restauration logique du catalogue

`restore_specialty_catalog_version(...)` copie une version publiée dans une nouvelle révision active. Elle archive l’actif courant dans la même transaction, ne remet jamais l’ancienne ligne elle-même en statut actif et ne supprime aucun historique.

Le processus recommandé est :

1. choisir une révision historique ;
2. vérifier qu’aucun brouillon de travail n’est en attente ;
3. saisir la justification et confirmer avec un compte Professor ;
4. laisser la RPC valider les 58 spécialités, copier le snapshot et basculer l’actif atomiquement ;
5. contrôler la nouvelle révision active et son checksum.

### 12.3 Sauvegarde de la plateforme

Les mécanismes de sauvegarde disponibles dépendent du plan Supabase. Ils doivent être complétés par :

- l’archivage des migrations SQL dans le dépôt ;
- l’export périodique des données selon la politique de conservation ;
- un test documenté de restauration ;
- une conservation séparée des journaux nécessaires à l’audit ;
- une procédure d’incident et de révocation des comptes.

## 13. Tests et déploiement

### 13.1 Tests de base à conserver

- absence de lecture anonyme des réponses ;
- absence d’écriture directe ;
- validation stricte des payloads ;
- idempotence des soumissions ;
- rejet d'un même UUID rejoué avec un payload ou une provenance différente ;
- allowlist de recherche ;
- résistance des gardes RLS restrictives.

### 13.2 Tests du portail à ajouter ou maintenir

- `anon` lit uniquement le catalogue actif ;
- un compte Auth ordinaire ne lit ni réponses ni brouillon ;
- Researcher lit les réponses mais n’édite pas le catalogue ;
- Doctor édite un brouillon mais ne publie pas ;
- Professor édite, publie et restaure ;
- aucun rôle navigateur n’écrit directement dans les tables privées ;
- les versions actives et archivées sont immuables ;
- un conflit de `lock_version` est détecté ;
- une publication contient exactement 58 spécialités ;
- la publication est atomique ;
- le checksum est stable pour un contenu stable ;
- `prevention_orientation` ne peut pas changer ;
- les appels v2 et v3 refusent une version non publiée ;
- l’UUID et la révision enregistrés sont cohérents ;
- les fonctions v1 et v2 restent compatibles avec les données historiques ;
- les soumissions v3 écrivent le schéma 2 et les versions scientifiques exactes ;
- les quatre textes permanents et, pour une réponse `no`, le texte conditionnel sont obligatoires selon leurs règles de longueur ;
- une réponse `no` exige une raison et une réponse `yes` interdit cette raison ;
- les champs structurés legacy restent `NULL` dans le schéma 2 ;
- le nouvel instantané actif complète seulement les traits mesurés manquants, garde les cibles existantes et laisse `prevention_orientation` inchangé ;
- les exports contiennent les verbatims, la provenance et neutralisent les préfixes de formule CSV ;
- la sélection d'une valeur manuelle ne peut plus diminuer le rang d'une spécialité manuelle ;
- un sous-score sans trait disponible reste non mesuré plutôt que 0 %.

### 13.3 Vérifications applicatives

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:dashboard
npm.cmd run build
```

### 13.4 Déploiement Supabase

```powershell
npx.cmd --yes supabase@2.115.0 migration list
npx.cmd --yes supabase@2.115.0 db push --dry-run
npx.cmd --yes supabase@2.115.0 db push
npx.cmd --yes supabase@2.115.0 db lint --linked
```

Après déploiement :

1. contrôler les résultats pgTAP ;
2. vérifier les privilèges et RLS ;
3. tester chaque rôle avec un compte distinct ;
4. tester la lecture publique du seul catalogue actif ;
5. créer un brouillon de test, vérifier le conflit optimiste, puis l’annuler ou le publier selon le protocole ;
6. effectuer une soumission étudiante v3 et une soumission spécialiste v3 synthétiques, puis vérifier leur schéma, leurs versions, leurs réponses qualitatives et leur provenance ;
7. supprimer les données synthétiques avec une procédure administrative contrôlée.

## 14. Exploitation et bonnes pratiques

### 14.1 Comptes

- utiliser un compte individuel par personne ;
- réserver Professor à la personne responsable de la publication ;
- accorder Doctor aux contributeurs cliniques qui préparent les brouillons ;
- conserver Researcher pour la consultation des cohortes ;
- désactiver immédiatement `enabled` lors d’un départ ou d’un incident ;
- utiliser MFA lorsque le plan et la politique de l’organisation le permettent ;
- ne jamais stocker de mot de passe ou de clé administrative dans une variable `VITE_*`.

### 14.2 Changements scientifiques

- citer les sources dans la note de changement ;
- modifier un nombre limité de paramètres à la fois ;
- comparer les résultats inclusifs et conservateurs en présence d’ex æquo ;
- examiner les dénominateurs et les tailles de cohorte par spécialité ;
- ne pas effacer une version publiée ;
- incrémenter les versions du protocole lorsqu’une signification scientifique change ;
- documenter la décision même lorsqu’aucun changement n’est finalement publié.

### 14.3 Données personnelles et conservation

Le questionnaire ne crée pas de relation avec un compte participant, mais les réponses qualitatives sont du texte libre : un participant pourrait malgré l'avertissement y saisir un nom, une coordonnée ou une information permettant d'identifier un patient. Ces verbatims doivent donc être traités comme des données de recherche potentiellement sensibles, avec accès restreint, exports maîtrisés et revue avant diffusion.

Les journaux techniques de la plateforme peuvent aussi contenir des métadonnées opérationnelles. La durée de conservation, les procédures de purge, les sauvegardes, la pseudonymisation des exports et les obligations réglementaires doivent être définies avec les responsables juridiques et scientifiques du projet.

## 15. Glossaire

| Terme | Définition |
|---|---|
| Allowlist | Liste explicite des comptes autorisés à accéder au portail. |
| Catalogue actif | Unique instantané publié lu par le moteur public. |
| Brouillon | Copie modifiable qui n’affecte pas encore le moteur public. |
| Révision | Numéro croissant et lisible d’une version du catalogue. |
| UUID de version | Identifiant technique immuable de l’instantané. |
| Verrou optimiste | Numéro empêchant l’écrasement silencieux d’une édition concurrente. |
| Checksum | Empreinte déterministe du contenu d’une version. |
| RLS | Row Level Security, règles PostgreSQL appliquées aux lignes visibles. |
| RPC | Fonction PostgreSQL exposée comme point d’entrée API contrôlé. |
| `SECURITY DEFINER` | Fonction exécutée avec les privilèges de son propriétaire, donc à durcir strictement. |
| Provenance | Ensemble des versions permettant de reproduire et interpréter un résultat. |
| Top-k | Présence de la spécialité déclarée parmi les k premières recommandations. |
| Legacy | Donnée historique conservée mais incompatible avec tout ou partie du protocole courant. |

---

**Références de structure :** `supabase/migrations/20260831120000_specialist_admin_portal.sql` et `supabase/migrations/20260904193000_accuracy_and_qualitative_specialist_v2.sql`

**Source des règles antérieures de collecte et de sécurité :** migrations précédentes du dossier `supabase/migrations`.  
**Format Word généré :** `docs/Q-Project-Structure-Base-de-donnees.docx`.
