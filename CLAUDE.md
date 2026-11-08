# Instructions du projet

Ce dépôt contient deux applications web installables (PWA), publiées par GitHub Pages depuis la branche `main` :

- **BakeScale** (racine) : recettes, doseur, tâches d'équipe, stock et matériel de l'atelier de pâtisserie.
  - Application : https://adjoubar-glitch.github.io/Application-Claude/
  - Interface : `index.html` (un seul fichier). Installation : `manifest.webmanifest`, `sw.js`, `icons/`.
  - Serveur : `apps-script/Code.gs`, script Google Apps Script relié à la Google Sheet `1ZRWyzaKoa19PQx4Ysn1gs2aUc9KRMtXa87s9thydQiU`. L'interface l'appelle en `POST {fn, args}` sur l'URL `/exec` (`API_URL` dans `index.html`) ; seules les fonctions de `API_NAMES_` sont accessibles.
- **FIT ROUTE** (`fitroute/`) : application indépendante, ne pas la modifier en travaillant sur BakeScale.

## Liens d'installation BakeScale

- Le lien d'installation est le lien personnel : `https://adjoubar-glitch.github.io/Application-Claude/?k=<clé>` pour le Chef (cellule H2 de `App_Invites`), `?i=<jeton>` pour un invité (créé dans l'application : Accueil, Inviter).
- Le dépôt est public : n'y écrire **jamais** une clé, un jeton ou un lien personnel complet.
- Ouvert dans le navigateur, l'application affiche un bandeau « Installer BakeScale sur ce téléphone » adapté à Android, iPhone et aux navigateurs intégrés (WhatsApp…). Le jeton est gardé dans `localStorage` (`bk_token`).

## Règles de travail

- Répondre en français, simplement : l'utilisateur n'est pas développeur.
- Toute modification de `apps-script/Code.gs` demande une action de l'utilisateur sur ordinateur : copier le fichier dans le projet Apps Script, puis Déployer, Gérer les déploiements, crayon, Nouvelle version, Déployer. Le dire clairement à chaque fois.
- Après une modification de `index.html`, incrémenter `CACHE` dans `sw.js` (`bakescale-vN`) pour que les téléphones reçoivent la mise à jour.
- Droits : `need_(token, true)` = Chef seulement ; `need_(token, 'dose' | 'stock' | 'mat')` = Chef ou invité ayant cet onglet (colonne I « Onglets » de `App_Invites`).
