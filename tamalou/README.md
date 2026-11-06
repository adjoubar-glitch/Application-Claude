# Tamalou 🐒🍌

Le jeu de cartes Tamalou en ligne entre amis, chacun sur son téléphone. Thème jungle, singes moqueurs, bananes pourries.

Projet en cours de construction, étape par étape. L'architecture et le modèle d'état sont décrits dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```bash
npm install
npm run typecheck
```

## Tests du moteur

```bash
npm test
```

47 tests : mise en place, anti-triche de la vue, les 3 options de tour, chaque pouvoir,
jeu hors tour, placement des pénalités, fenêtre de doublon de 1,5 s (vrais, faux, mélange,
départage à la milliseconde), Tamalou, égalités, pioche vide, multi-manches, et 300 parties
jouées au hasard sans perdre une seule carte.
