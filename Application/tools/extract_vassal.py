#!/usr/bin/env python3
r"""
Carte et pions du module Vassal « Fighting Wings » (Vassal\fw V60b.vmod, fichier zip lu tel quel, jamais modifié) :
  build/maps/blue.jpg            carte « Blue » (fond bleu uni du module + grille d'hex numérotée, dessinée ici)
  build/counters/<id>.png        pions des avions (images du module, vue de dessus)
  build/data/counters.js         const COUNTERS = [{ name, imgs: [id, …] }, …]

Utilisation :  python tools/extract_vassal.py
Il faut Pillow (pip install pillow). Tout build/ reste hors dépôt (images protégées par le droit d'auteur).

La carte « Blue N is UP » du module n'a pas d'image : c'est une couleur (153, 205, 255) de 10907 × 7170 pixels sur laquelle
Vassal dessine la grille (dx 173.205, dy 200, « sideways », numéros « CCRR »). C'est la même grille que la carte « Blue Sky »
de Tiger Wings : colonnes 10 à 50 (41) × lignes 01 à 54, colonnes impaires décalées d'un demi-hex vers le SUD... dans
l'orientation Tiger Wings (Nord vers la DROITE de l'image). L'image est donc dessinée dans cette orientation (7170 × 10907,
hex à côté plat en haut), et la page tourne la caméra pour mettre le Nord en haut. Vérifié avec les positions du scénario
Jolly Rogers (côtés d'hex 3130/3231, 4012/3911 : colonnes impaires décalées vers le bas ; les Val volent SE de 3425 à 2735).
Valeurs recopiées dans src/js/02-carte.js (BOARDS.blue), en pixels de l'image d'ORIGINE (avant réduction).
"""
import json
import math
import os
import re
import sys
import zipfile

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Il faut Pillow : python -m pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(os.path.dirname(ROOT), "Documents originaux")   # documents du jeu, à côté du dossier Application
VMOD = os.path.join(DOCS, "Vassal", "fw V60b.vmod")
BUILD = os.path.join(ROOT, "build")
SCALE = 0.5
BLUE = {"w": 7170, "h": 10907, "dx": 173.20508075688772, "dy": 200.0, "x0": 120.0, "y0": 104.0, "cols": 41, "rows": 54}
COLOR = (153, 205, 255)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def blue_map():
    g = BLUE
    s = SCALE
    w, h = round(g["w"] * s), round(g["h"] * s)
    im = Image.new("RGB", (w, h), COLOR)
    d = ImageDraw.Draw(im)
    R = g["dx"] / 1.5 * s                            # rayon de l'hex (centre → sommet)
    try:
        font = ImageFont.truetype("arial.ttf", round(30 * s))
    except OSError:
        font = ImageFont.load_default()
    line = (40, 70, 110)
    for c in range(g["cols"]):
        for r in range(g["rows"]):
            cx = (g["x0"] + g["dx"] * c) * s
            cy = (g["y0"] + g["dy"] * r + (g["dy"] / 2 if c & 1 else 0)) * s
            pts = [(cx + R * math.cos(math.radians(60 * k)), cy + R * math.sin(math.radians(60 * k))) for k in range(7)]
            d.line(pts, fill=line, width=2)
            d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=line)
            # numéro écrit pour être lu Nord en haut (l'image sera vue tournée de 90° : on écrit le texte tourné)
            txt = "%02d%02d" % (10 + c, r + 1)
            tw, th = d.textbbox((0, 0), txt, font=font)[2:]
            t = Image.new("RGBA", (tw + 4, th + 6), (0, 0, 0, 0))
            ImageDraw.Draw(t).text((2, 0), txt, font=font, fill=(20, 40, 70, 255))
            t = t.rotate(-90, expand=True)           # lisible quand le Nord (droite de l'image) est en haut
            im.paste(t, (round(cx + R * 0.30), round(cy - t.height / 2)), t)   # côté Nord de l'hex, comme dans Vassal
    out = os.path.join(BUILD, "maps")
    os.makedirs(out, exist_ok=True)
    im.save(os.path.join(out, "blue.jpg"), quality=86, optimize=True)
    print("écrit : build/maps/blue.jpg (%d × %d)" % (w, h))


def counters():
    z = zipfile.ZipFile(VMOD)
    names = set(z.namelist())
    xml = z.read("buildFile.xml").decode("utf-8", "replace")
    out = os.path.join(BUILD, "counters")
    os.makedirs(out, exist_ok=True)
    lst = []

    def add(name, img):
        if "images/" + img not in names:
            return
        cid = slug(os.path.splitext(img)[0])
        with open(os.path.join(out, cid + ".png"), "wb") as f:
            f.write(z.read("images/" + img))
        e = next((x for x in lst if x["name"] == name), None)
        if e:
            if cid not in e["imgs"]:
                e["imgs"].append(cid)
        else:
            lst.append({"name": name, "imgs": [cid]})

    # autres avions : PieceSlot avec le prototype « AC DataLabel », image de dessus « …Top.png » ou « …T.png »
    for m in re.finditer(r'<VASSAL\.build\.widget\.PieceSlot[^>]*entryName="([^"]*)"[^>]*>([^<]*)', xml):
        name, body = m.group(1), m.group(2)
        if "AC DataLabel" not in body:
            continue
        tops = [i for i in dict.fromkeys(re.findall(r"[\w .#\-]+\.png", body)) if re.search(r"(Top|T)\.png$", i)]
        if tops:
            add(name.strip(), tops[0].strip())
    os.makedirs(os.path.join(BUILD, "data"), exist_ok=True)
    with open(os.path.join(BUILD, "data", "counters.js"), "w", encoding="utf-8") as f:
        f.write("const COUNTERS = " + json.dumps(lst, ensure_ascii=False) + ";\n")
    print("écrit : build/counters/ (%d pions d'avions) et build/data/counters.js" % sum(len(x["imgs"]) for x in lst))


if __name__ == "__main__":
    blue_map()
    counters()
