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

## Liens d'installation

Le lien d'installation est le **lien personnel** de chaque personne : il ouvre l'application, la connecte au bon compte et propose de l'installer sur l'écran d'accueil. L'adresse seule (sans `?k=` ni `?i=`) affiche « Ce lien n'est pas valide ».

| Pour qui | Forme du lien | Où le trouver |
| --- | --- | --- |
| Chef | `https://adjoubar-glitch.github.io/Application-Claude/?k=<clé>` | Cellule H2 de `App_Invites`. Ne le partage jamais : il donne tous les droits. |
| Invité | `https://adjoubar-glitch.github.io/Application-Claude/?i=<jeton>` | Créé depuis l'application : Accueil, Inviter. Aussi en colonne H de `App_Invites`. |

Les clés et jetons ne doivent jamais être écrits dans ce dépôt : il est public.

## Installer sur un téléphone

1. Ouvrir son lien personnel dans **Chrome** (Android) ou **Safari** (iPhone). Si le lien s'ouvre dans WhatsApp ou Gmail, choisir « Ouvrir dans Chrome » ou « Ouvrir dans Safari ».
2. Un bandeau « Installer BakeScale sur ce téléphone » s'affiche en haut de l'application :
   - **Android** : bouton **Installer l'application**. S'il n'apparaît pas : menu **⋮**, puis **Installer l'application** ou **Ajouter à l'écran d'accueil**.
   - **iPhone** : bouton **Partager** (carré avec une flèche), puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Ouvrir ensuite BakeScale depuis l'icône : elle démarre en plein écran, déjà connectée.

Le lien reste mémorisé sur le téléphone. Pour changer de compte sur le même téléphone, rouvrir le nouveau lien personnel dans le navigateur.

## Gérer les accès

Accueil, panneau **Qui a accès** :
- **Renvoyer le lien** : renvoie le lien personnel par WhatsApp ou Gmail.
- **Retirer l'accès** / **Rendre l'accès** : coupe ou rétablit le lien (colonne Actif de `App_Invites`).
- **Supprimer** : efface la personne ; son lien ne marchera plus jamais.
- **Onglets** : chaque invité voit ses Tâches, plus les onglets cochés parmi Doseur, Stocks et Matériel (colonne I « Onglets » de `App_Invites`, par exemple `dose,stock`). L'Accueil reste réservé au Chef. Les droits sont vérifiés par le script Google.

---

# FIT ROUTE

Fitness Park le plus proche, temps de trajet vers les salles, adresses et drives favoris, programme du jour. Dossier `fitroute/`, indépendant de BakeScale.

- **Application** : https://adjoubar-glitch.github.io/Application-Claude/fitroute/
- **Config** : clé Google Maps (Places API (New) + Routes API) à saisir dans Réglages ; lieux pré-chargés depuis `fitroute-config.json` v1.0.
- **Lancement au déverrouillage** : MacroDroid, déclencheur « Appareil déverrouillé », action « Ouvrir un site web » vers l'adresse ci-dessus.
