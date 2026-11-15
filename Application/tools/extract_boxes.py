#!/usr/bin/env python3
r"""
Minibox (façon Birds of Prey, comme dans Warbirds Digital) de chaque avion, fabriquées d'après les « 3 vues » des ADC.

Utilisation :  python tools/extract_boxes.py [id …]      (sans id : toutes les fiches de build/data/adc.js)
Il faut pdftoppm (poppler) et build/data/adc.js (python tools/extract_adc.py).
Sortie : build/boxes/<id>.json = { dims: [longueur, envergure, hauteur] (pixels), faces: { face, arriere, dessus, dessous,
         droite, gauche : data URL PNG } } ; tools/build.py → build/dist/boxes/<id>.js. Hors dépôt (dessins des fiches).

Repris de WarbirdsDigital\tools\extract_boxes.py, avec deux différences pour les fiches Tiger Wings / Fighting Wings :
  - la zone des 3 vues est en haut à droite de la page (vue de dessus à gauche, profil en haut à droite, face en dessous) ;
  - les dessins sont AU TRAIT, en noir et blanc : l'intérieur est peint (mode « produit ») avec une couleur de camouflage
    selon le pays (table PAINT), les traits restent noirs ; le dessous est la silhouette du dessus remplie de la couleur
    de dessous du pays.
Découpage (repris tel quel) : fond = blanc relié au bord de la zone ; blanc enfermé > BIG_WHITE pixels (entre deux mâts,
un fil d'antenne et le fuselage…) = fond aussi ; taches de pixels → dessus = la plus grande, profil = la plus haute des
autres, face = la plus large du reste. Les fiches dessinent le profil côté GAUCHE nez à gauche et le dessus nez à gauche.
"""
import base64
import json
import os
import struct
import subprocess
import sys
import tempfile
import zlib
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "boxes")
DPI = 150
ZONE = (3.75, 0.95, 8.35, 3.6)           # zone des 3 vues sur la page (pouces : gauche, haut, droite, bas)
BG = (233, 243, 250)                     # fond bleu très clair des box BoP
PAD = 0.05
MIN_H = 0.45
BIG_WHITE = 9000                        # dessins au trait : les ailes sont de grandes zones blanches enfermées (gardées)
# couleurs (dessus, dessous) par pays : camouflages 1937-1942 en Extrême-Orient (approximatifs, pour la lisibilité)
PAINT = {"Russia": ((112, 132, 82), (150, 182, 204)), "Japan": ((200, 200, 172), (206, 206, 184)),
         "U.S.A.": ((122, 116, 82), (178, 180, 182)), "United Kingdom": ((118, 112, 80), (196, 206, 176)),
         "China": ((150, 158, 128), (186, 192, 196)), "Netherlands": ((112, 118, 86), (190, 196, 186))}
for a, b in (("USSR", "Russia"), ("Soviet", "Russia"), ("USA", "U.S.A."), ("United States", "U.S.A."), ("UK", "United Kingdom"),
             ("Britain", "United Kingdom"), ("Australia", "United Kingdom"), ("Imperial Japan", "Japan"), ("Thailand", "Japan")):
    PAINT[a] = PAINT[b]
PAINT_OTHER = ((160, 164, 146), (190, 194, 194))
# couleurs propres à une fiche (id) : Pacifique 1943 (scénario Jolly Rogers)
PAINT_ID = {"a6m3": ((70, 88, 64), (196, 196, 176)),          # Marine japonaise : vert foncé, dessous gris clair
            "d3a2-val": ((70, 88, 64), (196, 196, 176)),
            "f4u-1d": ((58, 76, 112), (226, 228, 230))}       # US Navy : bleu de mer, dessous blanc


def lib():
    t = open(os.path.join(ROOT, "build", "data", "adc.js"), encoding="utf-8").read()
    return {c["id"]: (c["file"], c["country"]) for c in json.loads(t[t.index("["):t.rindex("]") + 1])}


def render(pdf):
    x0, y0, x1, y1 = (round(v * DPI) for v in ZONE)
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, "p")
        subprocess.run(["pdftoppm", "-f", "1", "-l", "1", "-r", str(DPI), "-x", str(x0), "-y", str(y0),
                        "-W", str(x1 - x0), "-H", str(y1 - y0), "-singlefile", pdf, base], check=True)
        data = open(base + ".ppm", "rb").read()
    parts, i = [], 0
    while len(parts) < 4:
        while data[i:i + 1].isspace(): i += 1
        j = i
        while not data[j:j + 1].isspace(): j += 1
        parts.append(data[i:j]); i = j
    return int(parts[1]), int(parts[2]), data[i + 1:]


def light(px, o):
    r, g, b = px[o], px[o + 1], px[o + 2]
    return min(r, g, b) >= 225 and max(r, g, b) - min(r, g, b) <= 20


def background(w, h, px):
    bg = bytearray(w * h)
    q = deque()
    for y in range(h):
        for x in range(w):
            if x < 4 or y < 4 or x >= w - 4 or y >= h - 4:
                bg[y * w + x] = 1
    for y in range(4, h - 4):
        for x in (4, w - 5):
            q.append(y * w + x)
    for x in range(4, w - 4):
        for y in (4, h - 5):
            q.append(y * w + x)
    while q:
        k = q.popleft()
        if bg[k] or not light(px, 3 * k):
            continue
        bg[k] = 2
        for n in (k - 1, k + 1, k - w, k + w):
            if 0 <= n < w * h and not bg[n] and 0 < n % w < w - 1:
                q.append(n)
    for s in range(w * h):
        if not bg[s] and light(px, 3 * s):
            pts = []
            q = deque([s])
            while q:
                k = q.popleft()
                if bg[k] or not light(px, 3 * k):
                    continue
                bg[k] = 3; pts.append(k)
                for n in (k - 1, k + 1, k - w, k + w):
                    if 0 <= n < w * h and not bg[n]:
                        q.append(n)
            for k in pts:
                bg[k] = 2 if len(pts) > BIG_WHITE else 4
    return bytes(1 if v in (1, 2) else 0 for v in bg)


def clusters(w, h, bg, gap=3):
    seen = bytearray(w * h)
    out = []
    for s in range(w * h):
        if bg[s] or seen[s]:
            continue
        seen[s] = 1
        q, pts = deque([s]), []
        while q:
            k = q.popleft(); pts.append(k)
            x, y = k % w, k // w
            for dy in range(-gap, gap + 1):
                yy = y + dy
                if not 0 <= yy < h: continue
                for dx in range(-gap, gap + 1):
                    xx = x + dx
                    if 0 <= xx < w:
                        n = yy * w + xx
                        if not bg[n] and not seen[n]:
                            seen[n] = 1; q.append(n)
        out.append(pts)
    return out


class View:
    def __init__(self, w, px, pts):
        xs = [k % w for k in pts]; ys = [k // w for k in pts]
        self.x0, self.y0 = min(xs), min(ys)
        self.w, self.h = max(xs) - self.x0 + 1, max(ys) - self.y0 + 1
        self.rgb = [[None] * self.w for _ in range(self.h)]
        for k in pts:
            o = 3 * k
            self.rgb[k // w - self.y0][k % w - self.x0] = (px[o], px[o + 1], px[o + 2])

    def _new(self, w, h, rgb):
        v = object.__new__(View); v.w, v.h, v.rgb = w, h, rgb; return v

    def mirror(self): return self._new(self.w, self.h, [row[::-1] for row in self.rgb])
    def flip(self): return self._new(self.w, self.h, self.rgb[::-1])
    def rot_cw(self): return self._new(self.h, self.w, [[self.rgb[self.h - 1 - x][y] for x in range(self.h)] for y in range(self.w)])

    def paint(self, col):
        """Dessin au trait peint : blanc → couleur, noir → noir, gris → couleur assombrie (mode « produit »)."""
        return self._new(self.w, self.h, [[None if c is None else tuple(int(col[i] * c[i] / 255) for i in range(3)) for c in row] for row in self.rgb])


def underside(top, col):
    v = object.__new__(View); v.w, v.h = top.w, top.h
    dark = tuple(int(c * 0.45) for c in col)
    v.rgb = []
    for y in range(top.h):
        row = []
        for x in range(top.w):
            c = top.rgb[y][x]
            if c is None:
                row.append(None); continue
            edge = any(not (0 <= x + dx < top.w and 0 <= y + dy < top.h) or top.rgb[y + dy][x + dx] is None
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            row.append(dark if edge else col)
        v.rgb.append(row)
    return v


def png(w, h, rows):
    raw = b"".join(b"\x00" + bytes(v for c in row for v in c) for row in rows)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def face(view, fw, fh):
    W, H = round(fw * (1 + 2 * PAD)), round(fh * (1 + 2 * PAD))
    ox, oy = (W - view.w) // 2, (H - view.h) // 2
    rows = [[BG] * W for _ in range(H)]
    for y in range(view.h):
        for x in range(view.w):
            c = view.rgb[y][x]
            if c and 0 <= oy + y < H and 0 <= ox + x < W:
                rows[oy + y][ox + x] = c
    return "data:image/png;base64," + base64.b64encode(png(W, H, rows)).decode("ascii")


def box(pdf, country, bid=""):
    w, h, px = render(pdf)
    bg = background(w, h, px)
    cl = sorted(clusters(w, h, bg), key=len, reverse=True)
    cl = [c for c in cl if len(c) >= 0.03 * len(cl[0])]
    views = [v for v in (View(w, px, c) for c in cl) if min(v.w, v.h) >= 20]   # traits du cadre de la fiche écartés
    if len(views) < 3:
        raise ValueError("moins de 3 vues trouvées")
    top = max(views, key=lambda v: v.w * v.h)                # vue de dessus : la plus grande surface
    rest = [v for v in views if v is not top]
    prof = min(rest, key=lambda v: v.y0)                     # profil : la plus haute des autres
    front = max((v for v in rest if v is not prof), key=lambda v: v.w)
    topU = top.rot_cw()
    L = max(prof.w, topU.h); S = max(topU.w, front.w); H = max(prof.h, front.h, round(MIN_H * L))
    up, under = PAINT_ID.get(bid) or PAINT.get(country, PAINT_OTHER)
    warn = []
    if abs(prof.w - topU.h) > 0.12 * L: warn.append("longueur profil %d / dessus %d" % (prof.w, topU.h))
    if abs(topU.w - front.w) > 0.12 * S: warn.append("envergure dessus %d / face %d" % (topU.w, front.w))
    if prof.w < 1.8 * prof.h: warn.append("profil peu allongé %dx%d" % (prof.w, prof.h))
    if front.w < 1.8 * front.h: warn.append("face peu large %dx%d" % (front.w, front.h))
    return {
        "warn": warn, "dims": [L, S, H], "under": "#%02x%02x%02x" % under,
        "faces": {
            "gauche": face(prof.paint(up), L, H),
            "droite": face(prof.mirror().paint(up), L, H),
            "dessus": face(topU.paint(up), S, L),
            "dessous": face(underside(topU.flip(), under), S, L),
            "face": face(front.paint(up), S, H),
            "arriere": face(front.mirror().paint(up), S, H),
        },
    }


def main():
    files = lib()
    ids = sys.argv[1:] or sorted(files)
    os.makedirs(OUT, exist_ok=True)
    for i in ids:
        if i not in files:
            print("inconnu : " + i); continue
        try:
            b = box(os.path.join(os.path.dirname(ROOT), "Documents originaux", "ADC", files[i][0]), files[i][1], i)
        except Exception as e:
            print("ÉCHEC " + i + " : " + str(e)); continue
        if any(w.startswith(("longueur", "envergure")) for w in b["warn"]):
            if os.path.exists(os.path.join(OUT, i + ".json")): os.remove(os.path.join(OUT, i + ".json"))
            print(i + " : PAS DE MINIBOX (vues mal découpées : " + " ; ".join(b["warn"]) + ")"); continue
        with open(os.path.join(OUT, i + ".json"), "w", encoding="ascii") as f:
            json.dump(b, f)
        print(i + " : dims " + str(b["dims"]) + ("  À VÉRIFIER : " + " ; ".join(b["warn"]) if b["warn"] else ""))


if __name__ == "__main__":
    main()
