# Configuration Supabase — Q Project

Cette application utilise Supabase pour deux usages uniquement : collecter des réponses de recherche via des RPC validées et permettre à une liste fermée de chercheurs de consulter les données. La clé utilisée dans Vite est publique ; la protection repose sur les privilèges PostgreSQL et les politiques RLS.

## Ce qui est configuré

- migrations reproductibles dans `supabase/migrations` ;
- validation stricte des 81 réponses, des 14 valeurs et des 58 spécialités ;
- versions explicites du questionnaire, des catalogues, du scoring et du consentement ;
- codes de calibration indépendants de la langue ;
- RPC d’insertion idempotentes, sans droit d’`INSERT` direct pour le navigateur ;
- aucune lecture anonyme ;
- lecture authentifiée réservée à `private.researchers` ;
- tests pgTAP dans `supabase/tests/database` ;
- contrôle CI qui reconstruit la base, exécute pgTAP et lance le linter SQL ;
- configuration versionnée dans `supabase/config.toml` avec URL de production, redirections locales autorisées et inscriptions Auth désactivées.

Les scores étudiants sont nommés `client_scores` car ils sont calculés dans le navigateur et ne constituent pas une mesure vérifiée. Pour une analyse scientifique, les recalculer depuis `ratings`, `selected_values` et les versions enregistrées.

## Variables d’environnement

Copier `.env.example` vers `.env`, puis renseigner :

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La variable legacy `VITE_SUPABASE_ANON_KEY` reste acceptée pendant la transition. Ne jamais placer une clé `sb_secret_...`, `service_role`, un mot de passe PostgreSQL ou un access token dans une variable `VITE_*` : elle serait incluse dans le JavaScript public.

Le workflow GitHub Pages contient directement l’URL et la clé `sb_publishable_...` du projet. Ces deux valeurs sont publiques par conception et sont de toute façon incluses dans le bundle du navigateur. Aucun secret Supabase administratif n’est stocké dans GitHub.

## Développement local

Prérequis : Docker Desktop et la CLI Supabase. La configuration a été générée avec la CLI `2.115.0`.

```powershell
npx.cmd --yes supabase@2.115.0 start
npx.cmd --yes supabase@2.115.0 db reset
npx.cmd --yes supabase@2.115.0 test db
npx.cmd --yes supabase@2.115.0 db lint --local
npm.cmd run test:dashboard
```

`test:dashboard` vérifie localement l’éligibilité scientifique, l’absence de fuite de la spécialité déclarée dans le classement, les rangs avec ex æquo, les dénominateurs, la couverture des traits, la provenance et la sécurité/structure des exports CSV.

Récupérer ensuite les valeurs locales affichées par `supabase status` dans `.env`. Après chaque changement de schéma, regénérer les types et relire le diff avant de remplacer `src/lib/database.types.ts` :

```powershell
npx.cmd --yes supabase@2.115.0 gen types --lang typescript --local
```

Docker n’est pas installé sur la machine ayant préparé cette configuration. La même suite pgTAP a donc été exécutée contre le projet lié, dans une transaction annulée après les assertions. Le workflow `.github/workflows/database-tests.yml` reconstruit néanmoins une base locale et rejoue ces tests automatiquement pour chaque changement qui touche `supabase/`.

## Déployer les migrations vers le projet distant

Faire d’abord une sauvegarde si le projet contient déjà des données. Ne jamais utiliser `db reset --linked` sur une base de production.

```powershell
npx.cmd --yes supabase@2.115.0 login
npx.cmd --yes supabase@2.115.0 link --project-ref <project-ref>
npx.cmd --yes supabase@2.115.0 migration list
npx.cmd --yes supabase@2.115.0 db push --dry-run
npx.cmd --yes supabase@2.115.0 db push
npx.cmd --yes supabase@2.115.0 config push --project-ref ttnkmbopwcuioxidkkwe
```

`db push` applique les migrations PostgreSQL. `config push` synchronise notamment API et Auth : examiner son diff interactif avant de confirmer chaque bloc.

Le 27 août 2026, les quatre migrations ont été appliquées au projet `ttnkmbopwcuioxidkkwe`. `migration list` confirme que les historiques local et distant correspondent, et `config push` confirme que les configurations API, base et Auth sont synchronisées.

Vérifications effectuées contre le projet distant :

- linter SQL : aucune erreur dans `extensions`, `private` ou `public` ;
- pgTAP : 43 assertions sur 43 réussies, puis rollback ;
- API anonyme : lecture directe des deux tables et appel de `current_user_is_researcher()` refusés ;
- RPC publiques : payload invalide refusé, soumissions étudiante et spécialiste valides acceptées, rejeu identique idempotent et conflit d’identifiant refusé ;
- données synthétiques de vérification supprimées puis absence confirmée ;
- Auth : fournisseur e-mail activé pour les comptes administrés, inscriptions publiques fermées, confirmation d’e-mail obligatoire, mot de passe d’au moins 12 caractères avec lettres minuscules, majuscules et chiffres ;
- advisor de performance : aucun problème détecté.

L’advisor de sécurité conserve deux catégories d’avertissements documentées :

- les RPC de soumission sont volontairement `SECURITY DEFINER` et exécutables publiquement, car le navigateur n’a aucun droit d’`INSERT` direct ; leurs arguments sont strictement validés, leur `search_path` est vide et les écritures réelles passent par des fonctions privées ;
- `current_user_is_researcher()` est volontairement `SECURITY DEFINER` pour consulter l’allowlist privée, mais ne renvoie qu’un booléen et n’est accordée qu’au rôle `authenticated`.

La protection Supabase contre les mots de passe compromis est réservée au plan Pro ou supérieur et reste donc indisponible sur ce projet Free. Elle devra être activée dans **Authentication → Providers → Email** si le projet passe sur une offre compatible.

## Verrouiller Auth et autoriser un chercheur

Dans Supabase Dashboard :

1. Ouvrir **Authentication → Providers → Email** et désactiver les nouvelles inscriptions publiques.
2. Dans **Authentication → URL Configuration**, définir le Site URL sur `https://abdelmac.github.io/Q-pro/` et conserver les URL localhost uniquement pour le développement.
3. Exiger la confirmation d’e-mail, définir une politique de mot de passe forte et activer la MFA pour les chercheurs. Les limites serveur de durée/inactivité des sessions et la protection contre les mots de passe compromis nécessitent un plan Supabase payant ; le dashboard applique déjà une déconnexion locale après 30 minutes d’inactivité.
4. Créer ou inviter manuellement le compte du chercheur.
5. Dans SQL Editor, avec un rôle administrateur, exécuter :

```sql
select private.add_researcher_by_email(
  'chercheur@exemple.org',
  'Nom affiché facultatif'
);
```

Cette fonction n’est exécutable ni par `anon`, ni par `authenticated`. Retirer un accès sans supprimer le compte :

```sql
update private.researchers
set enabled = false
where user_id = (
  select id from auth.users where lower(email) = lower('chercheur@exemple.org')
);
```

Le simple fait d’être connecté ne donne aucun accès. Le dashboard appelle `current_user_is_researcher()` puis RLS applique la même allowlist sur chaque ligne.

Au 27 août 2026, le projet distant contient un seul compte Auth confirmé et ce compte est l’unique chercheur actif dans l’allowlist. Son mot de passe n’est stocké ni dans le dépôt ni dans la configuration Vite.

## Exploiter les données dans le dashboard

Le dashboard privilégie les réponses spécialistes pour la calibration tout en donnant le même niveau d’accès brut aux réponses étudiantes :

- liste paginée avec filtres de spécialité, expérience, satisfaction, rechoix, intention de changer, volontariat, complétude, langue et période ;
- détail d’une soumission avec ses 81 notes regroupées en sept sections, ses valeurs, ses métadonnées et toutes ses versions ;
- recalcul canonique du profil de traits et du classement avec la version courante du moteur et les priorités neutres par défaut ;
- contrôle d’éligibilité strict avant tout calcul : schéma v1, versions et consentement courants, 81 IDs exacts, notes entières de 1 à 10, valeurs uniques du catalogue et spécialité canonique ;
- les lignes legacy ou incompatibles restent consultables et exportables, mais sont exclues des métriques avec leurs motifs d’exclusion ;
- pour les spécialistes, rang minimal/maximal avec gestion explicite des ex æquo, rappels descriptifs top 1/3/5 inclusifs et conservateurs, dénominateurs visibles, agrégats par spécialité et comparaison profil observé/profil cible ;
- distinction entre traits issus des notes seules, traits ajustés par les valeurs, traits mesurés seulement sur un sous-groupe et cibles actuellement non mesurées ;
- export complet de la cohorte filtrée par pagination keyset stable face aux nouvelles insertions, par lots de 250 lignes, en JSON fidèle, CSV large, CSV long pour R/Python et CSV analytique avec provenance ;
- neutralisation des cellules susceptibles d’être interprétées comme des formules par un tableur ;
- pour les étudiants, affichage séparé du classement navigateur enregistré — non vérifié — et du classement canonique recalculé.

Les curseurs de priorité personnalisés utilisés avant l’affichage des résultats n’étaient pas enregistrés dans le schéma actuel. Le classement canonique du dashboard est donc reproductible à partir des données stockées, mais il ne faut pas le présenter comme la reproduction exacte du classement vu par le participant. Le CSV analytique expose explicitement cette limite (`participant_priority_weights_recorded=false`).

Chaque analyse/export enregistre une version du dashboard, une révision explicite du moteur et un checksum déterministe des versions, mappings de traits, valeurs, profils cibles et paramètres de rang. Une modification des équations de `scoring.ts` exige néanmoins d’incrémenter manuellement `SCORING_ENGINE_REVISION`.

Limite structurelle connue du modèle v1 : `manual_orientation` n’existe que pour les personnes ayant choisi la valeur manuelle, tandis que `prevention_orientation` est ciblé par un profil sans être produit par un item. Le dashboard expose leur couverture et affiche un avertissement bloquant toute interprétation forte des Top-k. Avant une calibration décisionnelle, il faut mesurer ces traits, les retirer des profils concernés ou définir une baseline constante, puis incrémenter les versions du moteur/protocole.

Les rappels top-k mesurent la présence de la spécialité autodéclarée parmi les recommandations canoniques ; ils ne constituent ni une précision diagnostique ni une validation clinique. Les indicateurs restent descriptifs et ne modifient jamais automatiquement les profils cibles. Les critères d’inclusion, une cohorte de validation indépendante et le traitement des soumissions multiples doivent être définis dans le protocole de recherche ; les petits effectifs sont explicitement signalés.

## Matrice d’accès

| Opération | `anon` | compte Auth ordinaire | chercheur autorisé | administrateur serveur |
|---|---:|---:|---:|---:|
| RPC de soumission validée | oui | oui | oui | oui |
| `INSERT` direct | non | non | non | selon le rôle serveur |
| lecture des réponses | non | aucune ligne | oui | oui |
| mise à jour / suppression | non | non | non | selon le rôle serveur |
| gestion des chercheurs | non | non | non | oui |

## Limites à traiter avant une campagne publique

- Une base seule ne peut pas limiter correctement les appels anonymes par IP. Les RPC bornent et valident les payloads, mais un attaquant peut encore envoyer beaucoup de soumissions valides. Pour une collecte publique importante, placer l’ingestion derrière une Supabase Edge Function avec Turnstile/hCaptcha et rate limiting.
- Définir avec le responsable du projet une durée de conservation et une procédure de purge. Aucun délai arbitraire n’est appliqué par la migration.
- Le formulaire ne demande aucun identifiant direct, mais les journaux techniques de l’hébergeur peuvent contenir des métadonnées réseau. Ne pas promettre un anonymat absolu sans revue juridique et opérationnelle.
- Mettre à jour `DATA_VERSIONS` et créer de nouvelles fonctions/migrations versionnées si les questions, spécialités, valeurs, consentements ou l’algorithme changent. Ne pas modifier rétroactivement la signification d’une version existante.

Documentation officielle utile :

- [Workflow CLI Supabase](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Clés API Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
- [Génération des types TypeScript](https://supabase.com/docs/guides/api/rest/generating-types)
- [Tests Supabase en CI](https://supabase.com/docs/guides/deployment/ci/testing)
- [Sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security)
