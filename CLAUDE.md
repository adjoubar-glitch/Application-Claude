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

## Ajouter une recette BakeScale

Les recettes sont les onglets de la Google Sheet (`1ZRWyzaKoa19PQx4Ysn1gs2aUc9KRMtXa87s9thydQiU`) ; l'application les lit à chaque synchronisation, sans changement de code.
- Nom d'onglet : `R. <Nom>` pour une recette, `Base <Nom>` pour une recette de base.
- Modèle à recopier : `Base Dacquoise` (lu par `parseRecipe` dans `index.html`). A1 commence par `Fiche Recette :` ; une ligne `Recette de base calibrée pour : …` ; `Lien Tutoriel / Source :` avec l'URL en B ; une ligne `Saisir le nombre de tournées (…) :` avec 1 en D et `tournée(s)` en E ; l'en-tête `Sous-Ensemble / Ingrédient | Qté Recette de base (1 tournée) | Unité | Poids Ajusté… | Timestamp Vidéo (t=XXs) | Procédé / Remarques`.
- Un titre de bloc est une ligne avec seulement la colonne A remplie. Un ingrédient a une quantité numérique en B (pas de « QS » : le mettre dans le texte d'une étape). Unité `g` pour ce qui se pèse, `pièce(s)` pour les œufs comptés.
- Puis `Guide de Fabrication & Conseils du Chef` et les étapes `1. Titre : texte`. Le titre d'étape qui reprend un mot du bloc rattache l'étape à ce bloc.
- La Sheet est en français : les formules séparent les arguments par `;` (ex. `=SUMIF(C9:C16;"g";B9:B16)`).
- Vérifier ensuite avec le parseur (extraire le bloc `/*PARSER-START*/…/*PARSER-END*/` d'`index.html` dans Node) : aucun `issues`, bon nombre d'ingrédients et d'étapes.

## Inventaire (`App_Stock`) et prix fournisseurs

Colonnes : A nom, B autres noms (`;`), C quantité, D unité, E seuil, F fournisseur, G pas, H grand pas, I ASIN, J prix Amazon, K prix Metro, L prix KORO, M prix Leclerc (TTC, par paquet ; au kilo si les tailles diffèrent, et le dire dans le nom). L'écran Stocks affiche un lien de recherche par fournisseur et met en vert le moins cher des prix connus. Le lien Leclerc utilise `LECLERC_SEARCH` dans `index.html` (recherche nationale par défaut).
