  // ================= Avions et partie =================
  const SIDES = { blue: { name: "Blue", color: "#2d5fae" }, red: { name: "Red", color: "#b8402e" } };
  // Attitude (FW 6.0) : angle du nez, -3 = vertical dive … 0 = level … +3 = vertical climb ; vol inversé = bank IR, IV ou IL.
  //  Codes FW : LVL, SHC, STC, VTC, SHD, STD, VTD ; inversé : INV, (SHC), (STC)… écrits ISHC, ISTC, ISHD, ISTD (lignes de l'utilisateur)
  const PITCHES = { "-3": "VTD", "-2": "STD", "-1": "SHD", "0": "LVL", "1": "SHC", "2": "STC", "3": "VTC" };
  const PITCH_LONG = { "-3": "Vertical Dive", "-2": "Steep Dive", "-1": "Shallow Dive", "0": "Level", "1": "Shallow Climb", "2": "Steep Climb", "3": "Vertical Climb" };
  // Bank (FW 5.1) : six angles en cercle LV → RB → IR → IV → IL → LB → LV ; stockés 0, 1, 2, 3, -2, -1 (gauche négatif)
  const BANKS = { "-3": "IV", "-2": "IL", "-1": "LB", "0": "LV", "1": "RB", "2": "IR", "3": "IV" };
  const BANK_LONG = { "-2": "Inverted Left Bank", "-1": "Upright Left Bank", "0": "Upright Level", "1": "Upright Right Bank", "2": "Inverted Right Bank", "3": "Inverted Level" };
  const norm6 = b => { const x = ((Math.round(+b || 0) % 6) + 6) % 6; return x > 3 ? x - 6 : x; };
  const isInv = b => Math.abs(norm6(b)) >= 2;
  const parseBank = t => ({ LV: 0, LB: -1, RB: 1, L: -1, R: 1, IR: 2, IV: 3, IL: -2 })[String(t).trim().toUpperCase()];
  const pitchName = (pt, bank) => isInv(bank) ? (+pt === 0 ? "INV" : "I" + PITCHES[pt]) : PITCHES[pt];
  //  écritures acceptées : LVL ; SHC, CL, NC ; STC, SC ; VTC, VC ; SHD, DV, ND ; STD, SD ; VTD, VD ; inversé : INV, ISHD… ou (SHD)…
  const PITCH_ALIASES = { LVL: 0, LEVEL: 0, CL: 1, NC: 1, SHC: 1, CLIMB: 1, STC: 2, SC: 2, VC: 3, VTC: 3, DV: -1, ND: -1, SHD: -1, DIVE: -1, STD: -2, SD: -2, VD: -3, VTD: -3 };
  const INV_PITCH = { INV: 0, ISHC: 1, ISTC: 2, IVTC: 3, ISHD: -1, ISTD: -2, IVTD: -3 };
  const parsePitch = t => { const v = PITCH_ALIASES[String(t).trim().toUpperCase()]; return v === undefined ? null : v; };
  // Charge (FW 12) : "" normal, "loaded", "overloaded" (Flight Tables : vitesses maxi −0.5 / −1, mini +0.5 / +1…)
  const LOADS = ["", "loaded", "overloaded"];
  const PQ = ["Recruit", "Green", "Regular", "Veteran"];

  // Dossier de la page : une partie par dossier
  const PAGE_DIR = location.protocol === "file:" ? decodeURIComponent(location.pathname).replace(/\/[^\/]*$/, "")
    : location.origin + location.pathname.replace(/\/[^\/]*$/, "");
  const GAME_KEY = "fwd-game-v1:" + PAGE_DIR;

  // Partie de départ (sans partie gardée) : le premier scénario (Jolly Rogers), sinon deux avions au milieu de la carte Blue
  const DEFAULT = (SCENARIOS[0] && SCENARIOS[0].game) || {
    turn: 1,
    scen: { name: "", board: "blue", north: 90, base: 0, len: 30 },
    sel: "p1",
    planes: [
      { id: "p1", name: "F4U-1D #1", adc: "f4u-1d", side: "blue", c: 19, r: 27, head: 0, alt: 10000, speed: 6.0 },
      { id: "p2", name: "A6M3 #1", adc: "a6m3", side: "red", c: 25, r: 24, head: 6, alt: 10000, speed: 5.0 }
    ]
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  // Corrige une partie lue (fichier, navigateur ou scénario) : valeurs manquantes, avions hors carte
  function cleanGame(g) {
    if (!g || !Array.isArray(g.planes) || !g.planes.length) return null;
    const s = g.scen || {};
    const out = { turn: Math.max(1, Math.round(+g.turn || 1)),
      scen: { name: String(s.name || ""), board: BOARDS[s.board] ? s.board : "blue", north: norm360(Math.round((s.north === undefined ? 90 : +s.north) / 30) * 30),
        base: Math.max(0, Math.round(+s.base || 0)), len: Math.max(0, Math.round(+s.len || 0)), notes: String(s.notes || ""),
        // formations de chaque camp (8.5) : "" (aucune), "basic", "advanced" ; portée de contrôle du leader (vide = 4 / 6)
        form: { blue: ["basic", "advanced"].includes((s.form || {}).blue) ? s.form.blue : "", red: ["basic", "advanced"].includes((s.form || {}).red) ? s.form.red : "" },
        // points de victoire du scénario : bonus par avion qui garde sa bombe (Jolly Rogers, règle spéciale 4)
        bombVP: s.bombVP && SIDES[s.bombVP.side] ? { side: s.bombVP.side, per: +s.bombVP.per || 1 } : null,
        formRange: { blue: Math.max(0, Math.round(+((s.formRange || {}).blue) || 0)), red: Math.max(0, Math.round(+((s.formRange || {}).red) || 0)) } },
      sel: g.sel, planes: [] };
    g.planes.forEach((p, i) => {
      if (!p || typeof p !== "object") return;
      const q = { id: String(p.id || "p" + Date.now() + i), name: String(p.name || "Aircraft" + (i + 1)),
        adc: ADC_BY_ID[p.adc] ? p.adc : null, side: SIDES[p.side] ? p.side : "blue",
        c: clamp(Math.round(+p.c || 0), 0, COLS - 1), r: clamp(Math.round(+p.r || 0), 0, ROWS - 1), hex2: null,
        head: ((Math.round(+p.head || 0) % 12) + 12) % 12, alt: Math.max(0, Math.round((+p.alt || 0) / 100) * 100),
        speed: Math.max(0, Math.round((+p.speed || 0) * 2) / 2), half: !!p.half, acc: Math.round((+p.acc || 0) * 2) / 2,
        pitch: clamp(Math.round(+p.pitch || 0), -3, 3), bank: norm6(p.bank), mcarry: String(p.mcarry || ""), load: LOADS.includes(p.load) ? p.load : "",
        pq: PQ.includes(p.pq) ? p.pq : "Regular", ace: !!p.ace, hero: !!p.hero, crack: clamp(Math.round(+p.crack || 0), 0, 2),
        notes: String(p.notes || ""), var: !!p.var,                   // var : valeurs entre parenthèses de la fiche (variante des notes)
        mv: p.mv && typeof p.mv === "object" && Array.isArray(p.mv.lines) ? p.mv : null,   // plan du tour (05d, 05e)
        logs: Array.isArray(p.logs) ? p.logs.filter(x => x && typeof x.text === "string") : [],   // tours passés au format PBEM (05l)
        trail: Array.isArray(p.trail) ? p.trail.filter(e => e && Array.isArray(e.pts)) : [],      // trajets des derniers tours
        moved: Math.round(+p.moved || 0), lastV: p.lastV === null || p.lastV === undefined || p.lastV === "" ? null : Math.max(0, Math.round(+p.lastV)), undo: typeof p.undo === "string" ? p.undo : null,
        lead: String(p.lead || ""), form: ["fixed", "flexible"].includes(p.form) ? p.form : "", noRadio: !!p.noRadio,   // formation menée (8.5), sans radio
        fixOut: Math.round(+p.fixOut || 0),                             // hors de la formation fixe jusqu'à ce tour inclus (limites dépassées, 8.5.1)                                     // leader de formation (8.5) : id d'un avion du même camp
        status: ["destroyed", "crashed"].includes(p.status) ? p.status : "",   // hors jeu
        crits: Array.isArray(p.crits) ? p.crits.map(String) : [],        // coups critiques reçus (« Wing spar »… ; combat au lot 4)
        wia: !!p.wia, severe: !!p.severe,
        // combat FW (05p) : état de l'équipage ("", "WIA", "OUT", "KIA" par membre), critiques moteur / carburant déjà reçus,
        //  rechargement des armes défensives (fin au tour), armes défensives enrayées (tour de l'enrayage)
        // emports (12.0) : bombe portée (texte, "" = rien), tir défensif et largage déclarés (multijoueur)
        bomb: String(p.bomb || ""), defDecl: p.defDecl && typeof p.defDecl === "object" ? p.defDecl : null, jettDecl: Math.round(+p.jettDecl || 0),
        crew: Array.isArray(p.crew) ? p.crew.map(String) : [], engHits: Math.round(+p.engHits || 0), fuelHits: Math.round(+p.fuelHits || 0),
        reload: p.reload && typeof p.reload === "object" ? p.reload : {}, jamDef: p.jamDef && typeof p.jamDef === "object" ? p.jamDef : {},
        // combat (05p) : hits reçus, munitions restantes par groupe, groupes hors d'usage, tour où l'avion a été abattu
        hits: Math.max(0, Math.round(+p.hits || 0)), hitsLog: Array.isArray(p.hitsLog) ? p.hitsLog : [],
        ammo: p.ammo && typeof p.ammo === "object" ? p.ammo : {}, gunsOut: Array.isArray(p.gunsOut) ? p.gunsOut.map(String) : [],
        killedTurn: Math.round(+p.killedTurn || 0), mvT: p.mvT && typeof p.mvT === "object" ? p.mvT : null,
        owner: String(p.owner || ""), decl: p.decl && typeof p.decl === "object" ? p.decl : null };   // multijoueur : joueur, tir déclaré (05h)
      q.ctr = p.ctr === "" ? "" : (CTR_BY_ID[p.ctr] ? p.ctr : counterFor(ADC_BY_ID[q.adc]) || "");
      const h2 = p.hex2 && { c: Math.round(+p.hex2.c), r: Math.round(+p.hex2.r) };
      if (h2 && h2.c >= 0 && h2.c < COLS && h2.r >= 0 && h2.r < ROWS && hexDist(q, h2) === 1) q.hex2 = h2;
      out.planes.push(q);
    });
    out.dice = Array.isArray(g.dice) ? g.dice.filter(x => x && Array.isArray(x.v)) : [];
    out.init = g.init && typeof g.init === "object" && g.init.rolls ? g.init : null;   // jets d'initiative du tour (05g)
    out.boost = g.boost && typeof g.boost === "object" ? g.boost : {};                 // +2 d'initiative après une victoire (8.7)
    out.shots = Array.isArray(g.shots) ? g.shots.filter(s => s && s.text) : [];       // tirs (05p)
    out.checks = Array.isArray(g.checks) ? g.checks.filter(s => s && s.text) : [];    // feux, collisions de fin de tour
    out.mp = g.mp && typeof g.mp === "object" ? g.mp : null;                         // multijoueur (05h-mp.js)
    out.seq = Math.round(+g.seq || 0);                                                // ordre d'arrivée des mouvements (7.1.5)
    return out.planes.length ? out : null;
  }
  let state = null;
  try { state = cleanGame(JSON.parse(localStorage.getItem(GAME_KEY))); } catch (e) { state = null; }
  if (!state) state = cleanGame(clone(DEFAULT));
  setBoard(state.scen.board);
  let selected = state.planes.find(p => p.id === state.sel) || state.planes[0];
  const gameData = () => ({ v: 1, turn: state.turn, scen: state.scen, sel: selected.id, dice: state.dice || [], init: state.init || null, boost: state.boost || {}, shots: state.shots || [], checks: state.checks || [], seq: state.seq || 0, mp: state.mp || null,
    planes: state.planes.map(p => { const q = Object.assign({}, p); delete q.obj; return q; }) });
  function save() { try { localStorage.setItem(GAME_KEY, JSON.stringify(gameData())); } catch (e) {} }

  // ---- position des pions ----
  const hexesOf = p => p.hex2 ? [{ c: p.c, r: p.r }, p.hex2] : [{ c: p.c, r: p.r }];
  // Portée horizontale (7.2.1) : nombre d'hex ; un pion sur un côté d'hex compte dans l'hex le plus proche de l'autre pion
  function rangeHex(p, q) {
    let best = Infinity;
    hexesOf(p).forEach(a => hexesOf(q).forEach(b => { best = Math.min(best, hexDist(a, b)); }));
    return best;
  }
  const screenHead = p => norm360(state.scen.north + 30 * p.head);      // angle écran du cap de l'avion
  // Pion sur un côté d'hex : seulement s'il est parallèle au côté (2.7), donc cap perpendiculaire à la direction hex → hex voisin
  function sideHeadingOk(p) {
    if (!p.hex2) return true;
    const d = norm360(screenHead(p) - dirBetween(p, p.hex2));
    return d === 90 || d === 270;
  }
  // côté d'hex écrit dans l'ordre des numéros (« 3631/3632 »), quel que soit l'hex gardé en premier
  const posName = p => !p.hex2 ? hexName(p.c, p.r) : [hexName(p.c, p.r), hexName(p.hex2.c, p.hex2.r)].sort().join("/");

  // ---- ligne de position, format PBEM Tiger Wings (« PBEM move and firing formats ») et exemple de jeu (10.0) ----
  //  « Ar196A-3 #1, 4424/4425, N, 0.6, 3.0, LB, -3.5, LVL, [1TTL] » :
  //  Avion, Hex, Cap, Altitude (milliers.centaines), Vitesse (« + » = demi-FP reporté, 4.2.1), Bank, Accel/Decel carry, Pitch,
  //  [manœuvres reportées]. Lu aussi : « Ki.51 = 2924, E, 3.3, 3.5 (+0.5 FP), LV, +0.0, LVL » (exemple 10.0) et la ligne
  //  d'un tableau de scénario sans virgules « 3237 NW 9.8 4.5 LB SHD ».
  const callsign = p => p.name.trim().replace(/\s+/g, " ") || "Unnamed";
  const sameName = (a, b) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
  const signed = v => (v < 0 ? "-" : "+") + fmt1(Math.abs(v));
  const speedText = p => fmt1(p.speed) + (p.half ? "+" : "");
  const lineOf = p => callsign(p) + " = " + posName(p) + ", " + HEADINGS[p.head] + ", " + altName(p.alt) + ", " + speedText(p) + ", " +
    BANKS[p.bank] + ", " + signed(p.acc) + ", " + pitchName(p.pitch, p.bank) + ", [" + ([p.load, p.mcarry].filter(Boolean).join(" ") || " ") + "]";
  // même avion malgré une autre écriture du nom (« I-16 Type 5 #01 » = « I-16 #1 ») : même numéro, début du nom commun
  function sameAircraft(name, p) {
    if (sameName(p.name, name)) return true;
    const nn = t => String(t).toLowerCase().replace(/#.*$/, "").replace(/[^a-z0-9]/g, ""), num = t => (/#\s*0*(\d+)/.exec(t) || [])[1];
    const a = nn(name), b = nn(callsign(p));
    return !!num(name) && num(name) === num(callsign(p)) && !!a && !!b && (a.startsWith(b) || b.startsWith(a));
  }
  const HEX_RE = /^(.*?)\s*[=,:]?\s*(\d{4}(?:\s*[\/|]\s*\d{4})?)(?:[a-z]{1,4})?\s*[,\s]\s*(NNE|NNW|SSE|SSW|NE|NW|SE|SW|N|E|S|W)(?![A-Za-z])\s*(.*)$/i;
  const CARRY_TOK = /^(\d+(N?(EZ|TT|HT|BT|ET)[LR]|S?R[LR]|SS[LR]|SK[LR]|ST[LR])\*?|SPIN\d+[LR]|IDLE|(NG|DD|COMP|GLOC)\d+)$/i;   // reports écrits sans crochets (« CL, 3SSR »)
  function parseLine(line) {
    let s = line.trim().replace(/(^|[^\d])(\d{1,2}),(\d)(?!\d)/g, "$1$2.$3");   // virgule décimale (« 9,4 »), pas « #1,4424 »
    s = s.replace(/\s*\(\s*\+?\s*0?\.5\s*(?:FP)?\s*\)/i, "+");          // « 3.5 (+0.5 FP) » = « 3.5+ »
    s = s.replace(/\((SHC|SHD|STC|STD|VTC|VTD)\)/gi, "I$1");             // attitude inversée écrite « (SHD) » (FW 6.0) = « ISHD »
    const m = HEX_RE.exec(s);
    if (!m) return { err: "unreadable line, expected: Aircraft, Hex, Heading, Altitude, Speed, Bank, Carry, Pitch, [Maneuvers]" };
    // « D3A2 #1 (Tapper) » : le nom entre parenthèses est le joueur (lignes PBEM de l'utilisateur)
    const own = /\(([^)]*)\)\s*[\s=,:]*$/.exec(m[1]);
    const id = m[1].replace(/[\s=,:]+$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    const hx = m[2].replace(/\s+/g, "").split(/[\/|]/), a = parseHex(hx[0]);
    if (a.err) return { id, err: a.err };
    let b = null;
    if (hx[1]) { b = parseHex(hx[1]); if (b.err) return { id, err: "second hex: " + b.err }; if (hexDist(a, b) !== 1) return { id, err: "a hex side needs two adjacent hexes" }; }
    const head = HEADINGS.indexOf(m[3].toUpperCase());
    // reports et notes : entre crochets ou parenthèses (« [1TTL] », « (1MG) (SSR 3/3) »), ou jetons de report sans crochets
    const mcs = [];
    const rest = m[4].replace(/\[([^\]]*)\]|\(([^)]*)\)/g, (x, b1, b2) => { const t = (b1 !== undefined ? b1 : b2).trim(); if (t) mcs.push(t); return " "; });
    const toks = rest.split(/[\s,]+/).filter(Boolean);
    const d = { c: a.c, r: a.r, hex2: b ? { c: b.c, r: b.r } : null, head };
    if (own && own[1].trim()) d.owner = own[1].trim();
    const nums = [];
    let invPitch = false;
    for (const t of toks) {
      const T = t.toUpperCase();
      if (CARRY_TOK.test(t)) { mcs.push(t); continue; }
      if (T in { LV: 1, LB: 1, RB: 1, IR: 1, IV: 1, IL: 1 } && d.bank === undefined) { d.bank = parseBank(T); continue; }
      if (PITCH_ALIASES[T] !== undefined && d.pitch === undefined) { d.pitch = PITCH_ALIASES[T]; continue; }
      if (INV_PITCH[T] !== undefined && d.pitch === undefined) { d.pitch = INV_PITCH[T]; invPitch = true; continue; }
      if (/^[+-]?\d*\.?\d+\+?$/.test(t)) { nums.push(t); continue; }
      return { id, err: "unknown value « " + t + " »" };
    }
    if (nums.length < 2) return { id, err: "altitude and speed are needed (e.g. 9.4, 4.0)" };
    // nombres dans l'ordre : altitude, vitesse, report d'accel / decel ; un nombre signé est toujours le report
    const sgn = nums.findIndex(t => /^[+-]/.test(t)), plain = nums.filter((t, i) => i !== sgn);
    const altT = plain[0], spT = plain[1], accT = sgn >= 0 ? nums[sgn] : plain[2];
    const altV = parseFloat(altT);
    if (!isFinite(altV) || altV < 0) return { id, err: "invalid altitude" };
    d.alt = altV >= 100 ? Math.round(altV / 100) * 100 : Math.round(altV * 10) * 100;   // « 9.4 » (milliers.centaines) ou « 9400 » (pieds)
    if (!spT) return { id, err: "speed missing" };
    d.half = /\+$/.test(spT);
    d.speed = Math.round(parseFloat(spT) * 2) / 2;
    if (!isFinite(d.speed)) return { id, err: "invalid speed" };
    d.acc = accT ? Math.round(parseFloat(accT) * 2) / 2 : 0;
    // charge (« [loaded] ») mise à part ; le reste des crochets = reports et notes (« MF », « SD », « 2HTR »…)
    d.load = "";
    const rest2 = mcs.join(" ").replace(/\b(over-?loaded|loaded)\b/gi, x => { d.load = /over/i.test(x) ? "overloaded" : "loaded"; return " "; });
    d.mcarry = rest2.replace(/\s+/g, " ").trim();
    if (d.bank === undefined) d.bank = 0;
    if (d.pitch === undefined) d.pitch = 0;
    // attitude inversée (ISHD, INV…) avec un bank à l'endroit : le bank passe à l'envers (LV → IV, LB → IL, RB → IR)
    if (invPitch && !isInv(d.bank)) d.bank = d.bank === 0 ? 3 : d.bank * 2;
    return { id, data: d };
  }
  // Applique une ligne lue ; refusée (avion inchangé) si le pion est sur un côté d'hex sans lui être parallèle
  const applyParsed = (p, d) => {
    if (!sideHeadingOk(Object.assign({}, p, d))) return "on a hex side the counter must be parallel to the side (rule 2.7): line not applied";
    Object.assign(p, d);
    return "";
  };
  function applyLines(text) {
    const done = [], errs = [];
    text.split(/\n+/).map(s => s.trim()).filter(s => s && !/^[A-Za-z ]+:?$/.test(s)).forEach(line => {   // titres « Moved: », « UP: » ignorés
      const r = parseLine(line);
      if (r.err) { errs.push((r.id ? r.id + ": " : "") + r.err); return; }
      const L = state.planes.filter(q => sameAircraft(r.id, q)), p = L.find(q => sameName(q.name, r.id)) || (L.length === 1 ? L[0] : null);
      if (!p) { errs.push(r.id + " unknown"); return; }
      const w = applyParsed(p, r.data);
      if (w) errs.push(r.id + ": " + w); else done.push(r.id);
    });
    return (done.length ? done.length + " aircraft updated. " : "") + errs.join(" · ");
  }
