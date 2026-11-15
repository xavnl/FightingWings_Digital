#!/usr/bin/env python3
r"""
Bibliothèque d'avions de Fighting Wings Digital : lit les Aircraft Data Cards (PDF) du dossier ADC\ (et de ses sous-dossiers
par pays : ADC\JAP, ADC\USA…) et écrit build/data/adc.js (const ADC_LIB = [...]), inclus dans la page par tools/build.py.

Utilisation :  python tools/extract_adc.py [mot …]
  sans argument : toutes les fiches lisibles ; avec des mots : seulement les fichiers dont le nom contient un des mots
  (ex. « python tools/extract_adc.py A6M3 D3A2 F4U-1D »).
Il faut pdftotext (poppler) dans le PATH. Les fiches restent sur l'ordinateur (droit d'auteur) : build/ est hors dépôt.

Repris de Tiger Wings Digital ; différences des fiches Fighting Wings (3e édition, « JDW Jan06 ») :
  - nom de l'avion sur la 1re ligne (« Mitsubishi A6M3 "Zero" ») OU sur la 2e (1re ligne = « Country: … ») ;
  - puissance « normale / urgence » (« 8/9 » ; « 1/– » = pas d'urgence) : cellule { v, emer } (2.1 D, 4.x Emergency Power) ;
  - Banking FPs « gauche / droite » (« 2/2 » du Zero, meilleur roulis à gauche) : bankFPs (gauche) et bankFPsR (droite) ;
  - facteurs d'attaque « 13 / 16 » (2e valeur = variante, ex. A6M3a canons longs) : cellule { v, alt } ;
  - munitions « (10x5)* » des armes défensives (chargeurs, ch. 10) : ammo = 50, mags = [10, 5] ;
  - champs en plus : weight / load (Weight and Load Limit), stations, dgCover (DEFENSIVE GUN COVERAGE).
Une fiche donne :
  name, country, entry, type, engine, enginePower, crew, maxSpeed, ceiling, def, size, dmg [sévère, détruit], endurance,
  view, blind, prot { cockpit, fuel, engine }, climbDecel, diveAccel, cls, vp, turnDecel { TT, HT, BT, ET },
  perf { bande: { min, max, dive, TT, HT, BT, ET, roc } }, powerCols, power { bande: [cellule] }, bankFPs, bankFPsR, slipFPs,
  guns [{ id, weapon, ammo, crit, mags? }], gunAF { groupe: [portée 0-7] }, gunTotal, notes, edition, file.
"""
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(os.path.dirname(ROOT), "Documents originaux")   # documents du jeu, à côté du dossier Application
ADC_DIR = os.path.join(DOCS, "ADC")
OUT = os.path.join(ROOT, "build", "data", "adc.js")
BANDS = ["UH", "EH", "VH", "HI", "MH", "ML", "LO", "VL"]
D = "–—\\-"
DASH = re.compile(r"^[" + D + r"]{1,}$")
NUM = r"\d[\d,]*(?:\.\d+)?"
# cellule : « 2.5 », « 6.5 (7.0) », « 8/9 », « 13 / 16 », « 1/– », « –/2 », « ––– »
CELL = re.compile(r"(?:" + NUM + r"|[" + D + r"])\s*/\s*(?:" + NUM + r"|[" + D + r"]+)|\(" + NUM + r"\)|" + NUM + r"(?:\s*\(" + NUM + r"\))?|[" + D + r"]{2,}")


def text_of(pdf):
    r = subprocess.run(["pdftotext", "-layout", "-f", "1", "-l", "1", pdf, "-"], capture_output=True)
    if r.returncode:
        raise RuntimeError("pdftotext : " + r.stderr.decode("utf-8", "replace"))
    return r.stdout.decode("utf-8", "replace").replace("\t", "    ")


def num(s):
    return float(s.replace(",", ""))


def cell(tok, slash="emer"):
    """« 2.5 » → {v} ; « 6.5 (7.0) » → {v, alt} ; « 8/9 » → {v: 8, <slash>: 9} ; « 1/– » → {v: 1} ; « ––– » → null."""
    tok = tok.strip()
    if not tok or DASH.match(tok):
        return None
    m = re.match(r"^(\S+)\s*/\s*(\S+)$", tok)
    if m:
        a, b = (None if DASH.match(x) else num(x) for x in m.groups())
        if a is None and b is None:
            return None
        out = {"v": a}
        if b is not None:
            out[slash] = b
        return out
    m = re.match(r"^(" + NUM + r")?\s*(?:\((" + NUM + r")\))?$", tok)
    if not m or (m.group(1) is None and m.group(2) is None):
        return {"v": None, "txt": tok}
    out = {"v": num(m.group(1)) if m.group(1) else None}
    if m.group(2):
        out["alt"] = num(m.group(2))
    return out


def field(t, pat, conv=str.strip, default=None):
    m = re.search(pat, t)
    return conv(m.group(1)) if m else default


def sint(s):
    return int(s.replace(" ", "").replace("–", "-").replace("—", "-"))


def parse(pdf):
    t = text_of(pdf)
    lines = t.split("\n")
    card = {"file": os.path.relpath(pdf, ADC_DIR).replace("\\", "/"),
            "id": re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(pdf))[0].lower()).strip("-")}
    # nom : texte de la 1re ligne avant « Country: », sinon 1re ligne qui ne contient ni Country ni Date
    name = ""
    for l in lines[:4]:
        s = re.split(r"\s{2,}Country:|^\s*Country:", l.strip())[0].strip()
        s = re.split(r"\s{3,}", s)[0].strip()
        if s and not re.search(r"Service Entry|A/C Type", s):
            name = s
            break
    card["name"] = name.replace("“", '"').replace("”", '"')
    card["country"] = field(t, r"Country:\s*(.+?)(?:\s{2,}|$)", default="")
    card["entry"] = field(t, r"(?m)Service Entry Date:[ ]*(.+?)[ ]*$", default="").strip()
    for k, lab in [("type", "A/C Type"), ("engine", "Engine\\(s\\)"), ("enginePower", "Eng\\. Pwr"), ("crew", "A/C Crew"),
                   ("maxSpeed", "Max Speed"), ("ceiling", "Max Ceiling")]:
        card[k] = field(t, lab + r":\s*(.+?)(?:\s{3,}|\n)", default="")
    card["def"] = field(t, r"Defense Factor:\s*(\d+)", int)
    card["size"] = field(t, r"Size Modifier:\s*([+\-–]?\s*\d+)", sint, 0)
    m = re.search(r"Damage Factor:\s*(\d+)\s*/\s*(\d+)", t)
    card["dmg"] = [int(m.group(1)), int(m.group(2))] if m else None
    card["endurance"] = field(t, r"Endurance:\s*([\d /]+?)(?:\s{2,}|\n)", default="").strip()
    card["view"] = field(t, r"Cockpit View:\s*(\w+)", default="")
    card["blind"] = field(t, r"Blind Area:[ ]*([^\n]*?)(?:\s{3,}|\s*\n)", default="")
    m = re.search(r"Protection:\s*(?:\w\s*=\s*)?Cockpit\s*([+\-–]\s*\d)\s*Fuel\s*([+\-–]\s*\d)\s*Engine\s*([+\-–]\s*\d)", t)
    card["prot"] = {"cockpit": sint(m.group(1)), "fuel": sint(m.group(2)), "engine": sint(m.group(3))} if m else {"cockpit": 0, "fuel": 0, "engine": 0}
    m = re.search(r"Climb Decel / Dive Accel:\s*(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)", t)
    card["climbDecel"], card["diveAccel"] = (float(m.group(1)), float(m.group(2))) if m else (None, None)
    m = re.search(r"Weight and Load Limit:\s*([\d,]+)\s*/\s*(\S+\s*-\s*\S+)", t)
    card["weight"], card["load"] = (num(m.group(1)), re.sub(r"\s+", "", m.group(2))) if m else (None, "")
    card["cls"] = field(t, r"Class:\s*([A-Z]+)", default="F")
    card["vp"] = field(t, r"Victory Points:\s*(\d+\s*[–\-]\s*\d+)", lambda s: s.replace("–", "-").replace(" ", ""), "")
    m = re.search(r"TT\s*\((\d+(?:\.\d+)?)\)\s*HT\s*\((\d+(?:\.\d+)?)\)\s*BT\s*\((\d+(?:\.\d+)?)\)\s*ET\s*\((\d+(?:\.\d+)?)\)", t)
    card["turnDecel"] = {k: float(m.group(i + 1)) for i, k in enumerate(["TT", "HT", "BT", "ET"])} if m else None

    # ---- performances (une ligne par bande) et puissance (bande répétée en fin de ligne) ----
    lv = r"(?:43\+|\d{1,2}\s*-\s*\d{1,2})"
    perf, power = {}, {}
    for l in lines:
        m = re.match(r"^\s*" + lv + r"\s+(UH|EH|VH|HI|MH|ML|LO|VL)\s+(.*?)\s+\1\s+" + lv + r"\s+(\S.*?)\s*$", l)
        if m:
            toks = CELL.findall(m.group(2))
            if len(toks) >= 7:
                c = [cell(x) for x in toks[:7]]
                roc = m.group(3).strip()
                perf[m.group(1)] = dict(zip(["min", "max", "dive", "TT", "HT", "BT", "ET"], c), roc=None if DASH.match(roc) else roc)
            continue
        m = re.search(lv + r"\s+(UH|EH|VH|HI|MH|ML|LO|VL)\s+(.*?)\s+\1\s*$", l)
        if m:
            power[m.group(1)] = [cell(x) for x in CELL.findall(m.group(2))][:4]
    card["perf"] = perf
    card["power"] = power
    m = re.search(r"Levels\s+Band\s+(\d+\.\d\s*-\s*\d+\.\d.*?)\s+Band\s*$", t, re.M)
    card["powerCols"] = [re.sub(r"\s+", " ", x.strip()) for x in re.findall(r"\d+\.\d\s*(?:-\s*\d+\.\d|\+)", m.group(1))] if m else []
    for k, lab in [("bankFPs", "Banking FPs:"), ("slipFPs", "Side Slip FPs:")]:
        m = re.search(re.escape(lab) + r"\s*((?:\d+(?:\s*/\s*\d+)?\s*){1,4})", t)
        vals = re.findall(r"\d+(?:\s*/\s*\d+)?", m.group(1)) if m else []
        card[k] = [int(v.split("/")[0]) for v in vals]
        if k == "bankFPs" and any("/" in v for v in vals):
            card["bankFPsR"] = [int(v.split("/")[-1]) for v in vals]

    # ---- armes : groupes (N1, W1-L, DG…), munitions, critiques, facteurs d'attaque par portée ----
    guns, af, total, gun_hdr = [], {}, [], None
    for l in lines:
        # colonne de gauche seulement : la ligne continue par le tableau de puissance (« 31 - 36   VH … »)
        lft = re.sub(r"\s{3,}(?:43\+|\d{1,2}\s*-\s*\d{1,2})\s+(?:UH|EH|VH|HI|MH|ML|LO|VL)\b.*$", "", l)
        m = re.match(r"^\s*([A-Z]{1,2}\d?(?:-[LR])?)\s+(One|Two|Three|Four|Five|Six|Twin|Quad|\d)\s+(\S.*?)\s+(\(\d+x\d+\)\*?|\d+(?:\.\d+)?)\s+(\d+)\s*$", lft)
        if m and not gun_hdr:
            g = {"id": m.group(1), "weapon": (m.group(2) + " " + m.group(3)).strip(), "crit": int(m.group(5))}
            a = m.group(4)
            mm = re.match(r"\((\d+)x(\d+)\)", a)
            if mm:
                g["mags"] = [int(mm.group(1)), int(mm.group(2))]
                g["ammo"] = float(int(mm.group(1)) * int(mm.group(2)))
            else:
                g["ammo"] = float(a)
            guns.append(g)
            continue
        m = re.match(r"^\s*Range\s+(.*?)\(?Total\)?", l)
        if m:                               # « W1 » dans l'en-tête = groupe « W1-L » de la liste des armes
            gun_hdr = [next((g["id"] for g in guns if g["id"].split("-")[0] == h), h) for h in m.group(1).split()]
            continue
        m = gun_hdr and re.match(r"^\s*([0-7])\s+(\S.*)$", l)
        if m and int(m.group(1)) == len(total):   # portées 0 à 7 dans l'ordre (pas les numéros d'emport du dessin)
            seg = l[m.start(2):63]                # colonne de gauche seulement (le reste = notes)
            toks = CELL.findall(seg)[:len(gun_hdr) + 1]
            for i, g in enumerate(gun_hdr):
                if not DASH.match(g):
                    af.setdefault(g, []).append(cell(toks[i], "alt") if i < len(toks) else None)
            total.append(cell(toks[len(gun_hdr)], "alt") if len(toks) > len(gun_hdr) else None)
    # facteurs : nombre (v), variante après la barre gardée à part (gunAFalt)
    card["guns"] = guns
    card["gunAF"] = {g: [(c or {}).get("v") for c in v] for g, v in af.items()}
    alt = {g: [(c or {}).get("alt") for c in v] for g, v in af.items() if any((c or {}).get("alt") is not None for c in v)}
    if alt:
        card["gunAFalt"] = alt
    card["gunTotal"] = [(c or {}).get("v") for c in total]

    # ---- couverture des armes défensives (colonne à gauche des notes, fiches de bombardiers) ----
    hdr = next((l for l in lines if "DEFENSIVE GUN COVERAGE" in l and re.search(r"NOTES\s*&\s*VARIANTS", l)), None)
    if hdr:
        lc = hdr.index("DEFENSIVE GUN COVERAGE") - 6
        rc = re.search(r"NOTES\s*&\s*VARIANTS", hdr).start() - 14
        # couverture = « DG: … » puis ses lignes en retrait ; ensuite, colonne de gauche = notes (« Note: … ») ;
        # lignes longues (> 50 car.) = paragraphe sur toute la largeur, sous les deux colonnes
        cov, right, left, full, on, c0 = [], [], [], [], False, None
        for l in lines:
            if l is hdr:
                on = True
                continue
            if not on:
                continue
            if re.search(r"JDW\s+\w+\d\d\s*$", l):
                break
            for s, x in [(mm.start(), mm.group(0)) for mm in re.finditer(r"\S+(?: {1,2}\S+)*", l)]:
                if s >= rc:
                    right.append(x)
                elif s >= lc:
                    if full or len(x) > 50:
                        full.append(x)
                    elif re.match(r"^[A-Z]{2}\d?:", x) or (cov and c0 is not None and s > c0 and not left):
                        cov.append(x)
                        c0 = s if re.match(r"^[A-Z]{2}\d?:", x) else c0
                    else:
                        left.append(x)
        card["dgCover"] = re.sub(r"\s+", " ", " ".join(cov)).strip()
        txt = re.sub(r"(\w)- (\w)", r"\1\2", " ".join(right + left + full))
        card["notes"] = re.sub(r"\s+", " ", txt).strip()

    # ---- notes et variantes (colonne de droite, sous « NOTES & VARIANTS ») ----
    notes, col, on = [], None, bool(hdr)
    for l in lines:
        mm = not hdr and re.search(r"NOTES\s*&\s*VARIANTS", l, re.I)
        if mm:
            on = True
            continue
        if hdr:
            break
        if not on:
            continue
        if re.search(r"(ADC\s+\d+\.\d+|JDW\s+\w+\d\d)\s*$", l):
            break
        if col is None:
            m2 = re.search(r"\S", l[58:]) if len(l) > 58 else None
            if not m2:
                continue
            col = 58 + m2.start()
        seg = (l[col - 3:] if len(l) > col - 3 else "").strip()
        if seg and not re.match(r"^[\d\s()to]+$", seg):
            notes.append(seg)
    if not hdr:
        txt = re.sub(r"(\w)- (\w)", r"\1\2", " ".join(notes))
        card["notes"] = re.sub(r"\s+", " ", txt).strip()
    m = re.search(r"((?:TW|FW)\s*[-–]\s*.*?ADC\s+\d+\.\d+|JDW\s+\w+\d\d)\s*$", t, re.M)
    card["edition"] = m.group(1).replace("–", "-") if m else ""
    return card


def main():
    words = [w.lower() for w in sys.argv[1:]]
    pdfs = sorted(glob.glob(os.path.join(ADC_DIR, "**", "*.pdf"), recursive=True))
    if words:
        pdfs = [p for p in pdfs if any(w in os.path.basename(p).lower() for w in words)]
    if not pdfs:
        sys.exit("Aucune fiche dans ADC\\")
    cards, ids = [], set()
    for pdf in pdfs:
        try:
            c = parse(pdf)
        except Exception as e:                       # fiche illisible (scan, autre mise en page) : ignorée
            print("ignorée : %s (%s)" % (os.path.relpath(pdf, ADC_DIR), e))
            continue
        if len(c["perf"]) < 4 or not c["name"]:
            print("ignorée : %s (tableau de performances non lu)" % os.path.relpath(pdf, ADC_DIR))
            continue
        if c["id"] in ids:
            continue
        ids.add(c["id"])
        miss = [b for b in BANDS if b not in c["perf"]]
        print("%-34s def %s dmg %s  perf %d, puissance %d, armes %s%s" % (
            c["name"][:34], c["def"], c["dmg"], len(c["perf"]), len(c["power"]), ",".join(g["id"] for g in c["guns"]),
            "  (manque : " + " ".join(miss) + ")" if miss else ""))
        cards.append(c)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("const ADC_LIB = " + json.dumps(cards, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("écrit : build/data/adc.js (" + str(len(cards)) + " fiches)")


if __name__ == "__main__":
    main()
