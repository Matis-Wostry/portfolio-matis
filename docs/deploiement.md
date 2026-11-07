# Déploiement de l'API

Ce qu'il reste à faire sur le serveur pour mettre l'API en ligne. Aucune de ces étapes ne touche aux sites existants.

> **Pas encore de sauvegardes.** Tant qu'elles n'existent pas, les brouillons et les médias ne sont que sur le serveur. Seul le dernier contenu publié aura une copie, dans le dépôt du site, une fois celui-ci branché. À sauvegarder : le fichier `data.db` et le dossier `media/`, tous deux dans le volume Docker `portfolio_matis_data`.

## 1. DNS

Créer une entrée pointant vers le serveur :

- `api.matis-wostry.com`
- `admin.matis-wostry.com` (pour l'interface, quand elle existera)

## 2. Dossier et configuration

Sur le serveur, créer un dossier pour l'API, par exemple `/srv/portfolio-matis`, puis y écrire un fichier `.env` :

```dotenv
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
ADMIN_ORIGIN=https://admin.matis-wostry.com
```

- `ADMIN_PASSWORD_HASH` : sur ton poste, `pnpm --filter @portfolio-matis/api hash-password`, puis coller le résultat.
- `SESSION_SECRET` : `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- Le fichier ne doit jamais être commité.
- Pour changer de mot de passe, remplacer le hash puis exécuter `docker compose up -d` : toutes les sessions ouvertes sont fermées.

Le conteneur doit partager un réseau Docker avec Caddy. S'il ne s'appelle pas `caddy`, ajouter à ce même `.env` :

```dotenv
CADDY_NETWORK=nom-du-reseau
```

## 3. Caddy

```caddyfile
api.matis-wostry.com {
	reverse_proxy portfolio-matis-api:3000
}
```

Puis recharger Caddy : `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`.

L'API suppose que Caddy est le seul proxy devant elle : elle lit l'adresse du visiteur dans le dernier élément de `X-Forwarded-For`, pour limiter les tentatives de connexion.

## 4. Secrets GitHub

Dans le dépôt `Matis-Wostry/portfolio-matis`, ajouter :

| Secret | Valeur |
|---|---|
| `SSH_PRIVATE_KEY` | clé de déploiement |
| `SSH_KNOWN_HOSTS` | empreinte du serveur |
| `SSH_PORT` | port SSH |
| `SSH_LOGIN` | `utilisateur@serveur` |
| `API_DIR` | le dossier de l'étape 2 |

Les quatre premiers portent le même nom que ceux du dépôt du site classique. L'image est publique, le serveur n'a pas besoin de se connecter au registre, à condition de rendre le paquet public dans GitHub après le premier envoi.

## 5. Premier déploiement

Lancer le workflow **Déploie l'API** depuis l'onglet Actions, sur la branche `main` (une autre branche est ignorée), puis vérifier :

```sh
curl https://api.matis-wostry.com/health
```

La réponse attendue est `{"ok":true}`, et la documentation s'ouvre sur `https://api.matis-wostry.com/docs`.

## 6. Reprise du contenu

Une seule fois, sur une base vide. Sur ton poste, `pnpm import:jeu` produit `import/proposition.json`. Ensuite :

```sh
scp import/proposition.json serveur:/srv/portfolio-matis/
ssh serveur
cd /srv/portfolio-matis
docker compose cp proposition.json api:/tmp/proposition.json
docker compose exec api node apps/api/src/seed.ts /tmp/proposition.json
```

Le contenu arrive dans le **brouillon** : rien n'est publié. La commande refuse une base qui contient déjà du contenu.

> **À relire avant de publier.** `import/ecarts.md` liste ce qui diffère entre les deux sites. Le texte « À propos » vient du site classique tel quel : il peut contredire la recherche reprise du jeu. Le projet « Création de mon portfolio » et les compétences absentes du jeu ne sont pas repris.

## 7. Plus tard : déclencher les sites

Quand un site saura se générer depuis l'instantané, ajouter à `.env` :

```dotenv
DEPLOY_SITES=[{"name":"classique","repo":"Matis-Wostry/cv","workflow":"deploy.yml","ref":"main"}]
GITHUB_DISPATCH_TOKEN=
```

Le jeton est un jeton GitHub à portée fine, limité aux dépôts de la liste, avec **Actions : lecture et écriture**. Sans jeton, l'API refuse de démarrer si la liste contient un site. Redémarrer ensuite : `docker compose up -d`.
