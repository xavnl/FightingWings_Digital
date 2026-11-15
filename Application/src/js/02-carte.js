  // ================= Carte : « Blue N is UP » du module Vassal « Fighting Wings » (fw V60b.vmod) =================
  //  Le module n'a pas d'image pour cette carte (couleur unie + grille dessinée par Vassal) : tools/extract_vassal.py la dessine
  //  (build/maps/blue.jpg), dans l'orientation des cartes Tiger Wings (Nord vers la DROITE de l'image) ; la caméra la montre
  //  Nord en haut (06-souris-camera.js). Même grille que la carte Blue Sky de Tiger Wings : hex à côté plat en haut (dans
  //  l'image), colonnes 10 à 50 (41) × lignes 01 à 54, hex numérotés CCLL (1001 à 5054), colonnes impaires décalées d'un
  //  demi-hex vers le bas de l'image (= vers l'Est). dx, dy, x0, y0 en pixels de l'image d'ORIGINE (x0, y0 = centre de l'hex 1001).
  //  Coordonnées internes : c (colonne, 0 = colonne 10) et r (ligne, 0 = ligne 01).
  //  Monde 3D : rayon d'hex = 1 (hex = √3 d'un côté à l'autre = 300 ft ; FW 1.5 : 1 hex = 100 yards).
  const SQ3 = Math.sqrt(3);
  const BOARDS = {
    blue: { label: "Blue (North is up)", w: 7170, h: 10907, dx: 173.20508075688772, dy: 200, x0: 120, y0: 104, bg: "#99cdff", line: "#28466e", text: "#142846" },
  };
  const GRID = { cols: 41, rows: 54, col0: 10 };
  const COLS = GRID.cols, ROWS = GRID.rows;
  const HEX_FT = 300, TURN_S = 4;                             // échelle (2.1) : 1 hex = 300 ft, 1 tour = 4 s
  const ftUnit = SQ3 / HEX_FT;                                // unités monde par pied
  let B, PPU, MAP_W, MAP_H;
  function setBoard(id) {
    B = BOARDS[id] || BOARDS.blue; PPU = B.dx / 1.5; MAP_W = B.w / PPU; MAP_H = B.h / PPU;
  }
  setBoard("blue");
  const hexPx = (c, r) => ({ px: B.x0 + B.dx * c, py: B.y0 + B.dy * r + ((c & 1) ? B.dy / 2 : 0) });
  function hexCenter(c, r) {
    const { px, py } = hexPx(c, r);
    return { x: px / PPU - MAP_W / 2, z: py / PPU - MAP_H / 2 };
  }
  function hexAt(x, z) {
    const px = (x + MAP_W / 2) * PPU, py = (z + MAP_H / 2) * PPU;
    const c0 = Math.round((px - B.x0) / B.dx); let best = null, bd = Infinity;
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (c < 0 || c >= COLS) continue;
      const r0 = Math.round((py - B.y0 - ((c & 1) ? B.dy / 2 : 0)) / B.dy);
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        if (r < 0 || r >= ROWS) continue;
        const p = hexCenter(c, r), d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bd) { bd = d; best = { c, r }; }
      }
    }
    return best && bd < 1.2 ? best : null;
  }
  const hexName = (c, r) => pad2(GRID.col0 + c) + pad2(1 + r);
  // Lit « 2921 » ; renvoie { c, r } ou { err }
  function parseHex(t) {
    const m = /^(\d{2})(\d{2})$/.exec(String(t).trim());
    if (!m) return { err: "invalid hex (expected 4 digits, e.g. 2921)" };
    const c = +m[1] - GRID.col0, r = +m[2] - 1;
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return { err: "hex " + m[0] + " is not on the map (1001 to 5054)" };
    return { c, r };
  }
  // Distance en hex (grille « odd-q » : colonnes c impaires décalées vers le bas)
  function hexDist(a, b) {
    const cube = h => { const x = h.c, z = h.r - (h.c - (h.c & 1)) / 2; return [x, -x - z, z]; };
    const p = cube(a), q = cube(b);
    return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
  }

  // ---- Directions sur la carte : angle « écran » en degrés, sens horaire depuis le HAUT de la carte ----
  //  Hex à côté plat en haut : côtés d'hex à 0, 60, 120… ; sommets à 30, 90, 150…
  const mapVec = a => ({ x: Math.sin(rad(a)), z: -Math.cos(rad(a)) });
  const isSideDir = a => Math.round(norm360(a)) % 60 === 0;
  function neighbour(h, a) {                       // hex voisin à travers le côté situé dans la direction a (multiple de 60)
    const o = hexCenter(h.c, h.r), v = mapVec(a);
    return hexAt(o.x + SQ3 * v.x, o.z + SQ3 * v.z);
  }
  function dirBetween(a, b) {                      // direction de a vers b (hex voisins), arrondie à 60°
    const p = hexCenter(a.c, a.r), q = hexCenter(b.c, b.r);
    return norm360(Math.round(deg(Math.atan2(q.x - p.x, -(q.z - p.z))) / 60) * 60);
  }
  // Position = { c, r, hex2 } (hex2 : 2e hex si le pion est sur un côté d'hex, règle 2.7)
  function posPoint(pos) {
    const A = hexCenter(pos.c, pos.r); if (!pos.hex2) return A;
    const Q = hexCenter(pos.hex2.c, pos.hex2.r); return { x: (A.x + Q.x) / 2, z: (A.z + Q.z) / 2 };
  }
  function posAt(x, z) {                           // centre d'hex, ou côté d'hex (deux hexes) au point donné
    const h = hexAt(x, z); if (!h) return null;
    const o = hexCenter(h.c, h.r);
    if ((o.x - x) ** 2 + (o.z - z) ** 2 < 0.09) return { c: h.c, r: h.r, hex2: null };
    const a = norm360(Math.round(deg(Math.atan2(x - o.x, -(z - o.z))) / 60) * 60), n = neighbour(h, a);
    return n ? { c: h.c, r: h.r, hex2: { c: n.c, r: n.r } } : null;
  }
  // un HFP en avant (4.2.2) : vers un côté d'hex, l'hex voisin ; vers un sommet (cap le long d'un côté d'hex), le pion avance de
  //  1,5 (centre → milieu d'un côté → centre…). Renvoie null au bord de la carte.
  function stepFrom(pos, a) {
    const P = posPoint(pos), v = mapVec(a), d = isSideDir(a) ? SQ3 : 1.5;
    return posAt(P.x + d * v.x, P.z + d * v.z);
  }

  // 12 caps (2.7), 30° entre deux caps ; la rose est orientée par la partie (state.scen.north = angle écran du Nord).
  //  Carte du module (non tournée) : Nord vers la DROITE (exemple 10.0 : le Ki.51 vole plein Est de 2921 à 2924, vers le bas).
  const HEADINGS = ["N", "NNE", "NE", "E", "SE", "SSE", "S", "SSW", "SW", "W", "NW", "NNW"];
  const NORTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30, name = { 0: "Up", 90: "Right", 180: "Down", 270: "Left" }[a];
    return { a, label: (name ? name + " (" + a + "°)" : a + "° clockwise from up") + " — along a hex " + (isSideDir(a) ? "side" : "spine") + (a === 90 ? " (Blue map: shown North up)" : "") };
  });

  // ---- altitude (2.6) : bandes de 6 niveaux de 1 000 ft ; écriture « milliers.centaines » (9.4 = 9 400 ft) ----
  const BANDS = [["VL", 0], ["LO", 7], ["ML", 13], ["MH", 19], ["HI", 25], ["VH", 31], ["EH", 37], ["UH", 43]];
  const bandOf = alt => { const lv = Math.floor(alt / 1000); let b = "VL"; BANDS.forEach(([k, v]) => { if (lv >= v) b = k; }); return b; };
  const altName = alt => (Math.floor(alt / 1000)) + "." + Math.floor((alt % 1000) / 100);
