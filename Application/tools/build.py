#!/usr/bin/env python3
"""
Assemble la table de vol Tiger Wings Digital (interface en anglais) :
  build/dist/flight-table.html   la page
  build/dist/maps/<id>.js        une image de carte par fichier (chargée seulement si la partie l'utilise)
  build/dist/counters/<id>.js    un pion d'avion par fichier (chargé à la demande)

Utilisation :  python tools/build.py
Avant (une fois) : python tools/extract_vassal.py (cartes, pions) et python tools/extract_adc.py (fiches ADC).

Ce que fait le script :
  1. part de src/page.html, le squelette de la page ;
  2. y insère src/style.css, src/body.html et tous les fichiers src/js/*.js (dans l'ordre de leur nom : 01-…, 02-…) ;
  3. y insère les données de build/data/ (fiches ADC, liste des pions) et les scénarios de scenarios/*/*.json ;
  4. transforme chaque image (carte, pion) en petit script qui la donne en data URL (marche aussi quand la page est ouverte
     par double-clic, contrairement à une image lue directement par la 3D) ;
  5. inclut la bibliothèque 3D (three.js r128, OrbitControls), téléchargée une fois dans build/vendor/ : pas besoin d'Internet.
Tout build/ (comme ADC/, Docs/, Vassal/, scenarios/) reste HORS du dépôt Git (droit d'auteur).
Pour jouer ailleurs : copier flight-table.html ET les dossiers maps/ et counters/ qui sont à côté (dans build/dist/).
"""
import base64
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "build", "dist")
MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def include(name):
    files = sorted(glob.glob(os.path.join(SRC, name)))
    if not files:
        sys.exit("Fichier introuvable : src/" + name)
    return "\n\n".join(read(f).strip("\n") for f in files)


def images(kind, fn):
    """build/<kind>/<id>.<ext> → build/dist/<kind>/<id>.js = window.<fn>(id, data URL) ; renvoie la liste des id."""
    out_dir = os.path.join(DIST, kind)
    os.makedirs(out_dir, exist_ok=True)
    ids = []
    for path in sorted(glob.glob(os.path.join(ROOT, "build", kind, "*"))):
        iid, ext = os.path.splitext(os.path.basename(path))
        mime = MIME.get(ext.lower())
        if not mime or iid in ids:
            continue
        with open(path, "rb") as f:
            url = "data:" + mime + ";base64," + base64.b64encode(f.read()).decode("ascii")
        with open(os.path.join(out_dir, iid + ".js"), "w", encoding="ascii") as f:
            f.write("window." + fn + "(" + json.dumps(iid) + "," + json.dumps(url) + ");\n")
        ids.append(iid)
    return ids


def build_boxes():
    """build/boxes/<id>.json (python tools/extract_boxes.py) → build/dist/boxes/<id>.js = window.TWD_BOX(id, box) ; renvoie les id."""
    out_dir = os.path.join(DIST, "boxes")
    os.makedirs(out_dir, exist_ok=True)
    ids = []
    for path in sorted(glob.glob(os.path.join(ROOT, "build", "boxes", "*.json"))):
        bid = os.path.splitext(os.path.basename(path))[0]
        with open(os.path.join(out_dir, bid + ".js"), "w", encoding="ascii") as f:
            f.write("window.TWD_BOX(" + json.dumps(bid) + "," + read(path).strip() + ");\n")
        ids.append(bid)
    return ids


def build_manuals():
    """src/manuals/ → build/dist/Manuals/ (« Player manual.html », « Referee manual.html », style.css)."""
    import shutil
    out = os.path.join(DIST, "Manuals")
    os.makedirs(out, exist_ok=True)
    for src, dst in (("player.html", "Player manual.html"), ("referee.html", "Referee manual.html"), ("style.css", "style.css")):
        shutil.copyfile(os.path.join(SRC, "manuals", src), os.path.join(out, dst))


def data_file(name, fallback):
    path = os.path.join(ROOT, "build", "data", name)
    if os.path.exists(path):
        return read(path).strip("\n")
    print("attention : build/data/" + name + " absent (" + fallback + ")")
    return fallback


def scenarios():
    """Scénarios et parties de départ : scenarios/<nom>/<nom>.json (fichiers de partie), proposés dans Game › Scenarios."""
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, "scenarios", "*", "*.json"))):
        try:
            g = json.loads(read(path))
        except ValueError as e:
            print("attention : " + path + " illisible (" + str(e) + ")")
            continue
        out.append({"name": (g.get("scen") or {}).get("name") or os.path.splitext(os.path.basename(path))[0], "game": g})
    return "const SCENARIOS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";"


def vendor_script(url):
    import urllib.request
    path = os.path.join(ROOT, "build", "vendor", url.rsplit("/", 1)[1])
    if not os.path.exists(path):
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with urllib.request.urlopen(url, timeout=30) as r, open(path, "wb") as f:
                f.write(r.read())
        except Exception as e:
            print("attention : " + url + " non téléchargé (" + str(e) + ") : la page garde le lien")
            return None
    return "<script>/* " + url + " */\n" + read(path).replace("</script", "<\\/script") + "\n</script>"


def build_page(maps, counters, boxes):
    lines = []
    for line in read(os.path.join(SRC, "page.html")).split("\n"):
        s = line.strip()
        if s.startswith('<script src="https://') and s.endswith('"></script>'):
            lines.append(vendor_script(s[len('<script src="'):-len('"></script>')]) or line)
        elif s.startswith("<!-- @include ") and s.endswith(" -->"):
            lines.append(include(s[len("<!-- @include "):-len(" -->")]))
        elif s == "<!-- @data adc.js -->":
            lines.append(data_file("adc.js", "const ADC_LIB = [];"))
        elif s == "<!-- @data counters.js -->":
            lines.append(data_file("counters.js", "const COUNTERS = [];"))
        elif s == "<!-- @scenarios -->":
            lines.append(scenarios())
        else:
            lines.append(line)
    return "\n".join(lines).replace("<!-- @maps -->", json.dumps(maps)).replace("<!-- @counters -->", json.dumps(counters)).replace("<!-- @boxes -->", json.dumps(boxes))


def wrap(page):
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
            + page + '\n</body>\n</html>\n')


def main():
    os.makedirs(DIST, exist_ok=True)
    maps = images("maps", "TWD_MAP")
    counters = images("counters", "TWD_CTR")
    boxes = build_boxes()
    build_manuals()
    page = build_page(maps, counters, boxes)
    with open(os.path.join(DIST, "flight-table.html"), "w", encoding="utf-8") as f:
        f.write(wrap(page))
    print("écrit : build/dist/flight-table.html (" + str(len(page) // 1024) + " Ko), maps/ (" + str(len(maps)) + " cartes"
          + ("" if maps else " : aucune image, grille de remplacement ; lancer tools/extract_vassal.py") + "), counters/ ("
          + str(len(counters)) + " pions), boxes/ (" + str(len(boxes)) + " Minibox)")


if __name__ == "__main__":
    main()
