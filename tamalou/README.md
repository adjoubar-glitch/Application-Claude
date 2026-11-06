# Tamalou 🐒🍌

Le jeu de cartes Tamalou en ligne entre amis, chacun sur son téléphone. Thème jungle, singes moqueurs, bananes pourries.

Projet en cours de construction, étape par étape. L'architecture et le modèle d'état sont décrits dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```bash
npm install
npm run typecheck
```

## Lancer le serveur en local

```bash
npm install
npm run dev -w server     # http://localhost:3000/health
```

## Tests

```bash
npm test
```

63 tests. Serveur : salons, codes à 4 lettres, hôte, options, reconnexion par jeton,
remplaçant après 60 s, timers du moteur, et un test de bout en bout avec de vrais
clients Socket.IO. Moteur : mise en place, anti-triche de la vue, les 3 options de tour, chaque pouvoir,
jeu hors tour, placement des pénalités, fenêtre de doublon de 1,5 s (vrais, faux, mélange,
départage à la milliseconde), Tamalou, égalités, pioche vide, multi-manches, et 300 parties
jouées au hasard sans perdre une seule carte.
