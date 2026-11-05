# BakeScale, application installable

Doseur de recettes, tâches d'équipe, stock et matériel de l'atelier, installable sur téléphone (icône, plein écran).

- **Application** : https://adjoubar-glitch.github.io/Application-Claude/
- **Données** : la Google Sheet de recettes, lue et écrite par le script Google Apps Script du dossier `apps-script/`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | L'application (interface complète) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Ce qui la rend installable sur l'écran d'accueil |
| `apps-script/Code.gs` | Le script Google : à coller dans le projet Apps Script BakeScale |
| `apps-script/appsscript.json` | Le manifeste du projet Apps Script |

## Mise en service

1. Dans le projet Apps Script BakeScale, remplace tout le contenu de `Code.gs` par celui de `apps-script/Code.gs`, puis enregistre.
2. Déployer, Gérer les déploiements, le crayon, Nouvelle version, Déployer.
3. Lance une fois la fonction `installer` : la cellule H2 de `App_Invites` contient alors ton lien Chef, `https://adjoubar-glitch.github.io/Application-Claude/?k=…`.

## Liens

- Chef : `…/Application-Claude/?k=<clé>`. Ne le partage pas.
- Invités : créés depuis l'application (Accueil, Inviter), sous la forme `…/Application-Claude/?i=<jeton>`. Pour retirer un accès, bouton Retirer, ou colonne Actif à FALSE dans `App_Invites`.
