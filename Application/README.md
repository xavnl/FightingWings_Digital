# Fighting Wings Digital

Table de vol numérique (interface en anglais) pour **Fighting Wings** (3e édition), reprise de Tiger Wings Digital : carte
hexagonale en 3D (carte « Blue » du module Vassal, Nord en haut), Minibox des avions, fiches ADC, lignes de position PBEM,
mouvement, initiative et combat aux règles FW, multijoueur par email. Premier scénario : The Jolly Rogers (1er novembre 1943).

Les documents du jeu (règles, fiches, scénarios, module Vassal) sont protégés par le droit d'auteur et restent sur l'ordinateur.

## Dossier

```
FightingWings digital\
  CLAUDE.md, .claude\       consignes et réglages pour Claude Code
  Documents originaux\      les documents du jeu, jamais modifiés
    ADC\                    fiches des avions (PDF, par pays)
    Exemples de mouvement\  règles FW 3e édition + aides de jeu, format PBEM
    Régles, aides\
    Scénarios\              scénarios (PDF)
    Vassal\                 module Vassal Fighting Wings (fw V60b.vmod)
  Application\              l'application
    scenarios\              parties de départ (fichiers de partie .json), proposées dans Game › Scenarios
    src\                    les sources de la page : page.html, body.html, style.css, js\01-… à 06-…, manuels
    tools\                  les scripts : extract_vassal.py, extract_adc.py, extract_boxes.py, build.py
    build\                  tout ce que produisent les scripts (peut être effacé et refait) ; la page est dans build\dist\
```

## Construire la page (depuis le dossier Application)

Il faut Python 3, Pillow (`python -m pip install pillow`) et poppler (pdftotext, pdftoppm).

1. Carte et pions (une fois) : `python tools/extract_vassal.py`
2. Fiches ADC : `python tools/extract_adc.py A6M3 D3A2 F4U-1D` (sans argument : toutes les fiches lisibles, non vérifiées)
3. Minibox : `python tools/extract_boxes.py`
4. Page : `python tools/build.py` → `build/dist/flight-table.html`
5. Ouvrir `build/dist/flight-table.html` dans un navigateur. Pour jouer depuis un autre dossier, copier la page **et** les
   dossiers `maps`, `counters`, `boxes` et `Manuals` qui sont à côté.
