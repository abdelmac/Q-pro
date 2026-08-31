# Configuration Supabase — Q Project

Q Project utilise Supabase pour collecter des réponses de recherche anonymes et pour fournir un portail fermé aux chercheurs, Doctors et Professors autorisés. La clé `VITE_SUPABASE_PUBLISHABLE_KEY` est publique par conception ; la sécurité repose sur Supabase Auth, les privilèges PostgreSQL, les RPC validées et les politiques RLS. Ne jamais placer une clé `service_role`, `sb_secret_...`, un mot de passe PostgreSQL ou un access token dans une variable `VITE_*`.

## Architecture déployée

- `public.student_responses` et `public.specialist_responses` conservent les observations anonymes. Le navigateur n’a aucun droit d’écriture directe ; les soumissions passent par `submit_*_response_v1` ou `submit_*_response_v2`.
- `private.researchers` est l’allowlist liée à `auth.users`. Son champ `portal_role` accepte `researcher`, `doctor` ou `professor`.
- `private.trait_catalog` documente la provenance de mesure de chaque trait.
- `private.specialty_catalog_versions` contient les snapshots `draft`, `active` et `archived`.
- `private.specialty_catalog_entries` contient, pour chacune des 58 spécialités et chaque snapshot, les descriptions EN/FR/RO, les résumés cliniques et le profil de matching.
- `private.specialty_catalog_audit` est le journal append-only des modifications, publications et restaurations.

Les tables de configuration restent dans le schéma `private`, sans accès direct depuis le navigateur. Le frontend ne reçoit que les données strictement nécessaires via des fonctions `SECURITY DEFINER` dont le `search_path` est vide.

## Variables d’environnement

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La variable legacy `VITE_SUPABASE_ANON_KEY` reste acceptée pendant la transition.

## Rôles du portail

| Capacité | researcher | doctor | professor |
|---|---:|---:|---:|
| Lire les réponses protégées par RLS | oui | oui | oui |
| Lire et modifier le brouillon | non | oui | oui |
| Publier un brouillon | non | non | oui |
| Restaurer une version archivée | non | non | oui |

Le Doctor prépare et justifie les changements. Le Professor les relit puis les publie. Une publication archive l’ancienne configuration et rend le snapshot complet du brouillon actif dans une seule transaction. Une restauration crée une nouvelle version active ; elle ne réécrit jamais l’historique.

Pour provisionner un compte, créer ou inviter d’abord l’utilisateur dans Supabase Auth, puis exécuter avec un rôle serveur :

```sql
select private.add_portal_user_by_email(
  'utilisateur@exemple.org',
  'Nom affiché',
  'doctor' -- researcher | doctor | professor
);
```

Cette fonction n’est accordée ni à `anon`, ni à `authenticated`. Désactiver un accès sans supprimer le compte :

```sql
update private.researchers
set enabled = false
where user_id = (
  select id from auth.users
  where lower(email) = lower('utilisateur@exemple.org')
);
```

## Cycle de configuration

1. `get_active_specialty_catalog()` fournit au quiz le snapshot publié.
2. `get_specialty_catalog_draft()` fournit au Doctor/Professor le brouillon, ou le snapshot actif avant la première modification.
3. `save_specialty_catalog_entry_draft(...)` clone l’actif si nécessaire, valide les textes et le profil, exige une justification et vérifie l’UUID ainsi que le verrou optimiste.
4. `publish_specialty_catalog_draft(...)` vérifie les 58 spécialités, calcule le checksum, archive l’ancienne version puis active le brouillon. Cette RPC est réservée au Professor.
5. `list_specialty_catalog_versions(...)` expose l’historique administratif autorisé.
6. `restore_specialty_catalog_version(...)` republie un snapshot historique sous un nouvel UUID et une nouvelle révision.

Le frontend charge le catalogue avant de démarrer le questionnaire, le valide puis utilise ce snapshot pour le scoring. Les soumissions v2 enregistrent `specialty_config_version_id` et `specialty_config_revision`. Les lignes legacy, dont la configuration exacte est inconnue, conservent ces champs à `NULL`.

Les `client_scores` étudiants restent un résultat calculé dans le navigateur et non une vérité vérifiée. Toute analyse scientifique doit repartir de `ratings`, `selected_values`, des versions enregistrées et du snapshot de configuration concerné.

## Limites scientifiques protégées

- `manual_orientation` est `value_only` : il n’existe que pour les personnes ayant sélectionné la valeur manuelle. Sa couverture est donc partielle.
- `prevention_orientation` est `unmeasured` : aucune question ni valeur actuelle ne le produit. Sa valeur de profil est verrouillée en base et dans l’interface jusqu’à correction et versionnement du modèle.
- Les rappels Top-k décrivent le moteur courant. Ils ne valident jamais seuls une modification de cible ou de poids.
- Un très petit échantillon reste descriptif et ne doit déclencher aucune modification automatique.

## Développement et tests

Prérequis locaux : Docker Desktop et Supabase CLI.

```powershell
npx.cmd --yes supabase@2.115.0 start
npx.cmd --yes supabase@2.115.0 db reset
npx.cmd --yes supabase@2.115.0 test db
npx.cmd --yes supabase@2.115.0 db lint --local
npm.cmd run test:dashboard
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Le test pgTAP couvre les privilèges, les RPC, les rôles Doctor/Professor, le verrou optimiste, l’immutabilité des snapshots publiés, les soumissions v1/v2 et la provenance. `test:dashboard` vérifie notamment l’éligibilité scientifique, les ex æquo, les dénominateurs, la couverture structurelle, les exports CSV et le checksum du modèle.

Après un changement de schéma, regénérer les types et relire le diff :

```powershell
npx.cmd --yes supabase@2.115.0 gen types --lang typescript --linked
```

## Déploiement distant

Faire une sauvegarde avant toute migration de production. Ne jamais exécuter `db reset --linked`.

```powershell
npx.cmd --yes supabase@2.115.0 link --project-ref <project-ref>
npx.cmd --yes supabase@2.115.0 migration list --linked
npx.cmd --yes supabase@2.115.0 db push --dry-run --linked
npx.cmd --yes supabase@2.115.0 db push --linked
npx.cmd --yes supabase@2.115.0 db lint --linked
```

La migration du portail est `supabase/migrations/20260831120000_specialist_admin_portal.sql`. Elle préserve les RPC v1 pour compatibilité, ajoute les RPC v2 avec provenance et ne donne aucun droit direct supplémentaire sur les réponses.

## Points d’exploitation

- Les inscriptions Auth doivent rester fermées ; les comptes sont créés ou invités manuellement.
- Activer MFA pour les comptes du portail lorsque l’offre Supabase le permet.
- Le dashboard ferme sa session locale après 30 minutes d’inactivité.
- Une collecte publique importante devrait placer les RPC d’ingestion derrière une Edge Function avec CAPTCHA et limitation de débit.
- Définir une politique de conservation et une procédure de purge avec le responsable du projet.
- Les journaux techniques de l’hébergeur peuvent contenir des métadonnées réseau : ne pas promettre un anonymat absolu sans revue juridique.

La documentation Word détaillée se trouve dans `docs/Q-Project-Structure-Base-de-donnees.docx`, avec sa source lisible dans `docs/STRUCTURE_BASE_DE_DONNEES.md`.
