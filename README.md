# Portfolio Matis

Backend qui devient la source unique du contenu de mes deux sites : un jeu en pixel art et un site classique. Je modifie mon contenu à un seul endroit, je publie d'un geste, et chaque site se reconstruit à partir du même contenu.

**État actuel :** l'API est terminée et testée. L'interface d'administration et le branchement des sites restent à faire.

## Fonctionnement

```text
Interface d'administration (à venir)
   |  modifie le brouillon (session)
   v
API Fastify --- SQLite + dossier des médias
   |  Publier : fige un instantané, puis déclenche les déploiements
   v
GitHub Actions de chaque site
   |  récupère l'instantané publié et les médias, puis construit le site
   v
Sites statiques, sans appel à l'API au chargement
```

Une panne de l'API ne peut donc pas casser un site en ligne : au pire, un déploiement échoue et le site reste tel quel.

## Stack

- **TypeScript partout**, exécuté directement par Node 24, sans étape de compilation
- **Fastify 5** et **Zod 4** : un seul schéma valide les requêtes et génère la documentation Swagger
- **SQLite** avec **Drizzle**
- **Vitest** pour les tests, **Docker** et **GitHub Actions** pour le déploiement

| Dossier | Rôle |
|---|---|
| `packages/content` | Schéma du contenu et règles de publication, partagés |
| `packages/import` | Reprise du contenu du jeu, comparaison avec le site classique |
| `apps/api` | L'API : brouillon, médias, connexion, publication, lecture publique |

## Lancer en local

Il faut Node 24 ou plus et pnpm 10.

```sh
pnpm install
cp .env.example apps/api/.env
pnpm --filter @portfolio-matis/api hash-password
```

Dans `apps/api/.env`, renseigner `ADMIN_PASSWORD_HASH` avec le résultat, et `SESSION_SECRET` avec au moins 32 caractères aléatoires. Ensuite :

```sh
pnpm import:jeu
pnpm --filter @portfolio-matis/api seed ../../import/proposition.json
pnpm dev:api
```

La documentation s'ouvre sur <http://localhost:3000/docs>. Elle sert à découvrir les routes et leurs schémas : ses boutons d'essai répondent 403 sur les écritures, qui n'acceptent que l'origine de l'interface. En attendant l'interface, on écrit avec `curl`, en remplaçant le mot de passe (sous Windows, dans Git Bash, car PowerShell 5 traite `curl` différemment) :

```sh
curl -c cookies.txt -H "Origin: http://localhost:5173" -H "Content-Type: application/json" \
  -d '{"password":"ton-mot-de-passe"}' http://localhost:3000/auth/login

curl -b cookies.txt http://localhost:3000/admin/projects
curl -b cookies.txt -X POST -H "Origin: http://localhost:5173" http://localhost:3000/admin/publish
curl http://localhost:3000/public/snapshot
```

`pnpm import:jeu` suppose que les dépôts `jeu` et `classique` sont à côté de celui-ci. Il écrit dans `import/`, ignoré par Git : `proposition.json` reprend le contenu du jeu, complété par le stage Smart Informatique, le détail des formations et les savoir-être du site classique, avec un texte « À propos » et une carte « La Chambre du Dev » réécrits pour valoir sur les deux sites. `ecarts.md` garde la trace de ce qui diffère entre les deux sites.

## L'API

| Routes | Accès | Rôle |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | | Connexion |
| `/admin/projects`, `experiences`, `educations`, `skill-categories` | Session | Lire, créer, modifier, supprimer, réordonner |
| `/admin/project-categories`, `profile`, `contact`, `draft` | Session | Catégories fixes, fiches uniques, brouillon complet |
| `/admin/media` | Session | Envoyer, lister, lire, supprimer un média |
| `POST /admin/publish`, `GET /admin/status` | Session | Publier, voir l'état des déploiements |
| `GET /public/snapshot`, `GET /public/media/:file` | Public | Dernier contenu publié, sans brouillon ni projet masqué |
| `GET /docs` | Public | Documentation Swagger |

## Sécurité

- Mot de passe haché avec scrypt, secrets uniquement dans l'environnement : sans eux, le serveur refuse de démarrer
- Cookie de session `HttpOnly`, `Secure`, `SameSite=Strict`, dont seule une empreinte est stockée ; changer le mot de passe ferme toutes les sessions
- Écritures limitées à l'origine de l'interface, tentatives de connexion limitées à 5 par 15 minutes
- Médias vérifiés sur leur contenu réel, limités en taille, et enregistrés sous un nom généré par le serveur
- Un test parcourt toutes les routes d'écriture et vérifie que chacune exige une session

## Tests

```sh
pnpm test
pnpm typecheck
```

## Déploiement

Voir [docs/deploiement.md](docs/deploiement.md).

> **Pas encore de sauvegardes.** Tant qu'elles n'existent pas, les brouillons et les médias ne sont que sur le serveur. Ce qu'il faudra sauvegarder : `data.db` et le dossier `media/`.
