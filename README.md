# Puissance 4

Un Puissance 4 néon, jouable à deux ou contre une IA, sans dépendance ni étape de build : ouvrez `index.html` (ou lancez Live Server).

## Fonctionnalités

- **Contre l'IA** (4 niveaux : Facile, Moyen, Difficile, Expert) ou **à deux** sur le même écran
- IA negamax avec élagage alpha-beta et approfondissement itératif (l'Expert calcule plus de 12 coups d'avance)
- Jetons qui tombent avec rebonds, aperçu de la case d'arrivée, ligne gagnante animée, confettis
- **Annuler** un coup, demander un **indice**, alternance automatique du premier joueur
- Scores sauvegardés dans le navigateur (par mode et par niveau), matchs nuls comptés
- Deux thèmes : *Coucher de soleil* et *Minuit*
- Effets sonores synthétisés (Web Audio, aucun fichier audio)
- Responsive, navigable au clavier, respecte `prefers-reduced-motion`

## Raccourcis clavier

| Touche | Action |
| --- | --- |
| `←` `→` | Choisir la colonne |
| `Entrée` / `Espace` / `↓` | Lâcher le jeton |
| `1` – `7` | Jouer directement dans une colonne |
| `U` | Annuler |
| `H` | Indice |
| `R` | Rejouer |
| `T` | Changer de thème |
| `M` | Couper / activer le son |
| `Échap` | Menu |

## Structure

```
index.html
assets/css/style.css         thèmes, plateau, animations, responsive
assets/javascript/engine.js  règles + IA (sans DOM, testable avec Node)
assets/javascript/sound.js   effets sonores Web Audio
assets/javascript/script.js  interface, animations, menu, raccourcis
assets/img/                  fonds d'écran (WebP)
```
