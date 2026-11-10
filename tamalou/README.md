# Tamalou 🐒🍌

Le jeu de cartes Tamalou en ligne entre amis, chacun sur son téléphone. Thème jungle, singes moqueurs, bananes pourries.
Appli web installable (PWA), jouable de 2 à 6, avec des bots pour compléter la table.

- **Jouer** : ouvre l'adresse du site, choisis un pseudo, « Créer une partie », puis « Inviter des amis ».
- **Installer sur le téléphone** : Android (Chrome) menu ⋮ puis « Installer l'application » ; iPhone (Safari) bouton Partager puis « Sur l'écran d'accueil ».
- **Admin** : `https://<ton-site>/admin` (sons, images de cartes, animations, effets).

---

## Mettre le jeu en ligne (Render, gratuit) — pas à pas

Compte 10 minutes. Tu n'as rien à installer sur ton ordinateur.

### 1. Créer le service

1. Va sur <https://render.com> et crée un compte avec **« Sign in with GitHub »** (ton compte `adjoubar-glitch`).
2. Accepte que Render accède au dépôt **Application-Claude**.
3. Dans Render : **New +** → **Blueprint**.
4. Choisis le dépôt **adjoubar-glitch/Application-Claude**, puis la **branche** qui contient Tamalou
   (`main` une fois la branche de travail fusionnée, sinon `ccr-316a24a0-blz10s`).
5. Render lit le fichier `render.yaml` et propose un service **tamalou** (Docker, offre Free). Il te demande trois valeurs :

   | Variable | Quoi mettre |
   | --- | --- |
   | `ADMIN_PASSWORD` | Le mot de passe de ton espace Admin (choisis-le long). |
   | `DRIVE_BRIDGE_URL` | L'adresse du script Drive (étape 2). Tu peux laisser vide pour l'instant. |
   | `DRIVE_BRIDGE_KEY` | La clé secrète du script Drive (étape 2). Idem. |

6. **Apply**. Render construit l'image (3 à 5 minutes) puis affiche l'adresse du jeu, du type
   `https://tamalou-xxxx.onrender.com`. **C'est le lien à partager et à installer sur les téléphones.**

> Offre gratuite : le service s'endort après 15 minutes sans joueur. La première ouverture suivante prend
> environ 50 secondes (le singe se réveille), ensuite tout est instantané. Les parties en cours sont en
> mémoire : un redéploiement ou un réveil les efface (pas les réglages Admin, qui sont dans ton Drive).

### 2. Stockage dans Google Drive (dossier « Tamaloo »)

Tout ce que tu charges dans l'Admin (sons, cartes, animations, effets) est rangé dans **ton** Google Drive,
dans un dossier **Tamaloo**. Sans cette étape, l'Admin fonctionne mais oublie tout à chaque redémarrage.

1. Va sur <https://script.google.com> → **Nouveau projet**. Nomme-le « Tamaloo Drive ».
2. Remplace tout le contenu par celui du fichier [`apps-script/TamalooDrive.gs`](apps-script/TamalooDrive.gs), enregistre.
3. ⚙️ **Paramètres du projet** → **Propriétés du script** → **Ajouter** :
   `TAMALOU_KEY` = une longue phrase secrète (ex. `les-bananes-pourries-de-Sami-2026`).
4. **Déployer** → **Nouveau déploiement** → type **Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde** (la clé secrète protège l'accès)
5. **Déployer**, autorise l'accès à ton Drive, puis copie l'**URL de l'application Web** (elle finit par `/exec`).
6. Dans Render → service **tamalou** → **Environment** :
   - `DRIVE_BRIDGE_URL` = l'URL copiée
   - `DRIVE_BRIDGE_KEY` = la même phrase que `TAMALOU_KEY`
7. **Save changes** : Render redémarre. Le dossier **Tamaloo** apparaît dans ton Drive au premier fichier chargé.

Pour vérifier : ouvre l'URL `/exec` dans ton navigateur, tu dois lire « Pont Drive Tamalou actif ».

### 3. Personnaliser (Admin)

`https://<ton-site>/admin`, avec `ADMIN_PASSWORD` :

- **Effets** : pour chaque situation (pénalité mauvais tour, mauvais doublon, doublon trop lent, chaque pouvoir,
  Tamalou, fin de manche) et chaque rôle (celui qui joue, la victime, les autres) : son, animation, texte,
  durée, vibration, plein écran, secousse. Bouton **Tester**, bouton **Par défaut**, puis **Enregistrer**.
- **Sons** : remplacer n'importe lequel des 12 sons (mp3, ogg, wav, m4a ; 3 Mo maximum).
- **Cartes** : remplacer une carte ou le dos par une image (png, jpg, webp, svg ; 2 Mo maximum). Chargement en lot si
  les fichiers s'appellent `hearts-1.png` … `spades-13.png` et `back.png` (1 = As, 11 = Valet, 12 = Dame, 13 = Roi).
- **Animations** : charger tes animations (GIF, WebP animé, WebM, MP4 ou Lottie `.json` ; 5 Mo maximum), puis les
  choisir dans l'onglet Effets.

Les téléphones reçoivent les changements tout de suite, même en pleine partie.

### Alternative : Fly.io

Depuis le dossier `tamalou/`, avec la CLI `flyctl` : `fly launch --copy-config --no-deploy`, puis
`fly secrets set ADMIN_PASSWORD=… DRIVE_BRIDGE_URL=… DRIVE_BRIDGE_KEY=…` et `fly deploy`.

---

## Personnaliser sans l'Admin

- **Sons par défaut** : remplace les fichiers de `client/public/sounds/` en gardant les mêmes noms
  (`monkey-laugh.mp3`, `jungle-yell.mp3`, `fail-jingle.mp3`, `gorilla-slow.mp3`, `duplicate-win.mp3`,
  `spy-whistle.mp3`, `swap-swoosh.mp3`, `king-roar.mp3`, `draw.mp3`, `discard.mp3`, `tamalou.mp3`, `round-win.mp3`).
  Ils sont générés par `node scripts/gen-sounds.mjs` (synthèse originale, nécessite ffmpeg).
- **Noms des bots** : `server/config/bot-names.json`.

---

## Développement

```bash
cd tamalou
npm install
npm run dev -w server      # serveur sur http://localhost:3000
npm run dev -w client      # appli sur http://localhost:5173 (relayée vers le serveur)
npm test                   # 80 tests
```

Pour l'Admin en local : `ADMIN_PASSWORD=test npm run dev -w server`.

| Dossier | Rôle |
| --- | --- |
| `shared/` | Types communs : cartes, actions, vues filtrées, protocole Socket.IO, effets |
| `server/src/engine/` | Moteur de règles pur (aucun réseau, aucune horloge) et vue filtrée par joueur |
| `server/src/rooms/` | Salons en mémoire, codes à 4 lettres, reconnexion, tchat |
| `server/src/bots/` | Bots IA : mémoire par niveau, décisions, doublons, remplaçant après 60 s |
| `server/src/assets/` | Ressources de l'Admin, pont Google Drive |
| `client/src/` | Appli React : écrans, cartes et singes SVG, animations, sons, PWA |
| `apps-script/` | Script Google pour le dossier Drive « Tamaloo » |

### Tests

80 tests Vitest :

- **Moteur** :
  - mise en place et vue filtrée sans fuite ;
  - les 3 options de tour et chaque pouvoir ;
  - jeu hors tour et placement des pénalités ;
  - fenêtre de doublon de 1,5 s (vrais, faux, mélange, départage à la milliseconde) ;
  - Tamalou, égalités, pioche vide, multi-manches ;
  - 300 parties au hasard sans perdre une carte.
- **Serveur** : salons, reconnexion, remplaçant, tchat, test de bout en bout Socket.IO.
- **Bots** : décisions, réflexes, et **200 parties 100 % bots** qui se terminent toutes.
- **Admin** : connexion, fichiers, paramétrage, rechargement depuis Drive.

L'architecture détaillée est dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
