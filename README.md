# Portfolio Matis

Backend et interface d'administration qui deviennent la source unique du contenu de mes deux sites : un jeu en pixel art et un site classique. Je modifie mon contenu à un seul endroit, je publie d'un geste, et chaque site se reconstruit à partir du même contenu.

**État actuel :** l'API et l'interface sont terminées et testées. Reste à les mettre en ligne et à brancher les sites.

## Fonctionnement

```text
Interface d'administration
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

- **TypeScript partout**, exécuté directement par Node 24 côté serveur, sans étape de compilation
- **Fastify 5** et **Zod 4** : un seul schéma valide les requêtes, les formulaires et génère la documentation Swagger
- **SQLite** avec **Drizzle**
- **React 19**, **Vite**, **TanStack Query** et **React Router** pour l'interface
- **Vitest** et **Testing Library** pour les tests, **Docker** et **GitHub Actions** pour le déploiement

| Dossier | Rôle |
|---|---|
| `packages/content` | Schéma du contenu et règles de publication, partagés |
| `packages/import` | Reprise du contenu des deux sites et trace de leurs différences |
| `packages/site-classique` | Génération du site classique depuis le dernier contenu publié |
| `apps/api` | L'API : brouillon, médias, connexion, publication, lecture publique |
| `apps/admin` | L'interface d'administration |

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

Puis, dans un second terminal :

```sh
pnpm dev:admin
```

L'interface s'ouvre sur <http://localhost:5173>, et la documentation de l'API sur <http://localhost:3000/docs>. Cette documentation sert à découvrir les routes et leurs schémas : ses boutons d'essai répondent 403 sur les écritures, qui n'acceptent que l'origine de l'interface.

`pnpm import:jeu` suppose que les dépôts `jeu` et `classique` sont à côté de celui-ci. Il écrit dans `import/`, ignoré par Git : `proposition.json` reprend le contenu du jeu, complété par le stage Smart Informatique, les missions des expériences et le détail des formations du site classique, dont les savoir-être deviennent des façons de travailler avec chacune sa phrase, et avec un texte « À propos » et une carte « La Chambre du Dev » réécrits pour valoir sur les deux sites. `ecarts.md` garde la trace de ce qui diffère entre les deux sites.

## Générer le site classique

Le site classique reste statique : à son déploiement, le générateur lit le dernier contenu publié et remplit les sections de son `index.html`, entre les marqueurs `<!-- content:x -->`. Pour l'essayer en local, avec le dépôt `classique` à côté de celui-ci et après avoir cliqué sur Publier :

```sh
node packages/site-classique/src/cli.ts --site ../classique --api http://localhost:3000 --out ../classique/dist
```

Sans API, `--snapshot ../classique/content/snapshot.json` remplace `--api`. Le site généré est dans `dist/`, la seule partie envoyée sur le serveur. Si l'API est injoignable, si le contenu est invalide ou si un média manque, rien n'est écrit.

## L'interface

- Une liste et un formulaire pour les projets, les expériences, les formations et les compétences ; une fiche pour la présentation et le contact
- L'envoi des captures et du CV, et une page pour supprimer les médias devenus inutiles
- Un aperçu de relecture, un bouton Publier, et l'état du dernier déploiement de chaque site
- Aucune saisie perdue sans avertissement : une session expirée se rouvre par-dessus le formulaire, puis l'enregistrement repart tout seul

Le style reprend les couleurs et la police du jeu. Tout est en graisse normale, parce qu'en gras le C de Pixelify Sans se lit comme un O et le 2 comme un 8.

## L'API

| Routes | Accès | Rôle |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | | Connexion |
| `/admin/projects`, `experiences`, `educations`, `skill-categories`, `project-categories` | Session | Lire, créer, modifier, supprimer, réordonner ; une catégorie qui contient des projets ne se supprime pas |
| `/admin/profile`, `contact`, `draft` | Session | Fiches uniques, brouillon complet |
| `/admin/media` | Session | Envoyer, lister, lire, supprimer un média |
| `POST /admin/publish`, `GET /admin/status` | Session | Publier, voir l'état des déploiements |
| `GET /public/snapshot`, `GET /public/media/:file` | Public | Dernier contenu publié, sans brouillon ni projet masqué |
| `POST /public/contact` | Site seulement | Formulaire de contact : envoie le message par mail, sans rien garder, 5 envois par heure |
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
