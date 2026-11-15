  // ================= Combat air-air Fighting Wings (ch. 9 à 11 ; Combat Tables pages 1 à 5) =================
  //  Lot 4 (15/11/2026) : repris du combat Tiger Wings et mis aux règles FW. Tir aux armes fixes (shotOf / fire), tir défensif
  //  (defOf / defFire), coups critiques FW (zones et 7 tables d'effets), contrôles de fin de tour (feux, fuites, collisions).

  // ---- champs de tir horizontaux (9.2, Combat Tables page 3, mêmes dessins qu'en Tiger Wings), sur la grille régulière (idealPt) ----
  //  Sans virage : la rangée d'hex dans l'axe du nez ; en virage : secteur de 30° entre la ligne 12:00 et la ligne 11:00 / 01:00.
  function inHArc(from, head, trn, to) {
    const A = idealPt(from), T = idealPt(to), a = rad(norm360(state.scen.north + 30 * head)), u = { x: Math.sin(a), z: -Math.cos(a) };
    const vx = T.x - A.x, vz = T.z - A.z; if (vx * vx + vz * vz < 1e-6) return true;
    if (!trn) { const f = vx * u.x + vz * u.z, d = Math.abs(vx * u.z - vz * u.x); return f > 0.01 && d <= 0.87; }
    let b = norm360(deg(Math.atan2(vx, -vz)) - deg(a)); if (b > 180) b -= 360;
    return trn === "L" ? b >= -30 - 0.01 && b <= 0.01 : b <= 30 + 0.01 && b >= -0.01;
  }
  // ---- champ de tir vertical (Combat Tables page 4, « Flight Attitude Fixed Gun Field-of-Fire Limits ») : par 100 ft (incréments) ----
  //  palier : même hex même altitude, ± 1 incr. par 2 hex ; shallow : même hex 0-1, de 1 incr. par 3 hex à 2 par hex ; steep : 1-3,
  //  de 2 à 6 par hex ; vertical : 1 à tout, au moins 6 par hex. Sens : celui du nez (attitude inversée : même chose, ISTC = nez en haut).
  function inVArc(pitch, h, dAlt) {
    const up = pitch >= 0 ? dAlt : -dAlt, ad = Math.abs(dAlt);
    if (pitch === 0) return h === 0 ? dAlt === 0 : ad <= 100 * Math.ceil(h / 2);
    if (Math.abs(pitch) === 1) return h === 0 ? up >= 0 && up <= 100 : up >= 100 * Math.ceil(h / 3) && up <= 200 * h;
    if (Math.abs(pitch) === 2) return h === 0 ? up >= 100 && up <= 300 : up >= 200 * h && up <= 600 * h;
    return h === 0 ? up >= 100 : up >= 600 * h;
  }
  const vArcTxt = (pitch, h) => {
    const dir = pitch > 0 ? "higher" : "lower";
    if (pitch === 0) return h === 0 ? "same altitude" : "±" + 100 * Math.ceil(h / 2) + " ft";
    if (Math.abs(pitch) === 1) return h === 0 ? "0 to 100 ft " + dir : 100 * Math.ceil(h / 3) + " to " + 200 * h + " ft " + dir;
    if (Math.abs(pitch) === 2) return h === 0 ? "100 to 300 ft " + dir : 200 * h + " to " + 600 * h + " ft " + dir;
    return h === 0 ? "100 ft or more " + dir : 600 * h + " ft or more " + dir;
  };

  // ---- déflexion (Fixed Gunfire Deflection Determination Play Aid, Combat Tables page 4) ----
  //  Départ : différence de cap (0 à 180°) ; on déplace le repère selon les attitudes (pas de nez : 0 palier … 3 vertical) ;
  //  les déplacements traversent 0° et 180° (rebond). Facteurs : 0° ×1, 30° ×2, 60° ×3, 90° ×5, 120° ×6, 150° ×4, 180° ×3.
  const DEFL_MULT = { 0: 1, 30: 2, 60: 3, 90: 5, 120: 6, 150: 4, 180: 3 };
  const isSpin = p => !!parseCarry(p.mcarry).spin;
  function deflection(sh, tg) {
    const k = Math.min((sh.head - tg.head + 12) % 12, (tg.head - sh.head + 12) % 12), init = 30 * k;
    if (isSpin(tg)) return { init, fin: 60, how: "spinning target: 60° ×3", mult: 3 };
    const a = sh.pitch, b = tg.pitch, sa = Math.abs(a), sb = Math.abs(b), diff = Math.abs(a - b);
    let mv = 0, to90 = 0, how;
    if (!a && !b) how = "both level: no adjustment";
    else if ((a > 0 && b > 0) || (a < 0 && b < 0)) {
      if (k === 0) { mv = diff; how = "both " + (a > 0 ? "climbing" : "diving") + ", " + diff + " step difference: away from 0°"; }
      else if (k <= 2) { mv = Math.floor(diff / 2); how = "both " + (a > 0 ? "climbing" : "diving") + ": one move away from 0° per two steps of difference (" + diff + ")"; }
      else if (k === 3) { mv = -Math.floor((sa + sb) / 3); how = "both " + (a > 0 ? "climbing" : "diving") + ": toward 0° per three steps from level (sum " + (sa + sb) + ")"; }
      else if (k <= 5) { mv = -Math.floor((sa + sb) / 2); how = "both " + (a > 0 ? "climbing" : "diving") + ": toward 0° per two steps from level (sum " + (sa + sb) + ")"; }
      else { mv = -(sa + sb); how = "both " + (a > 0 ? "climbing" : "diving") + ": toward 0° per step from level (sum " + (sa + sb) + ")"; }
    } else if (!a || !b) {
      if (k === 0) { mv = diff; how = "one level: away from 0° per step of difference (" + diff + ")"; }
      else if (k === 3) how = "one level, 90°: no adjustment";
      else if (k === 6) { mv = -diff; how = "one level, 180°: toward 0° per step of difference (" + diff + ")"; }
      else { to90 = Math.floor(diff / 2); how = "one level: toward 90° per two steps of difference (" + diff + ")"; }
    } else {
      const d2 = Math.abs(sa - sb);
      if (k === 0) { mv = diff; how = "climber and diver: away from 0° per step of difference (" + diff + ")"; }
      else if (k <= 2) { mv = Math.max(0, diff - 1); how = "climber and diver: away from 0° per step of difference beyond one (" + diff + ")"; }
      else if (k <= 4) { mv = Math.floor(diff / 2); how = "climber and diver: away from 0° per two steps of difference (" + diff + ")"; }
      else if (k === 5) { mv = -Math.max(0, d2 - 1); how = "climber and diver, 150°: toward 0° per step beyond one between their steps from level (" + d2 + ")"; }
      else { mv = -d2; how = "climber and diver, 180°: toward 0° per step between their steps from level (" + d2 + ")"; }
    }
    let pos = k;
    if (to90) pos = k < 3 ? Math.min(3, k + to90) : Math.max(3, k - to90);
    else { pos = k + mv; for (let i = 0; i < 4 && (pos < 0 || pos > 6); i++) pos = pos < 0 ? -pos : 12 - pos; }
    const fin = 30 * pos;
    return { init, fin, how, mult: DEFL_MULT[fin] };
  }

  // ---- Base LH Table (1.8, Combat Tables page 1) : % → LH de base ; 00 : D10 pair +130, impair −130 ----
  const LH_HI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 29, 30, 32, 33, 35, 36, 38, 40, 41, 43, 45, 48, 50, 52, 55, 58, 61, 65, 69, 74, 79, 87, 97, 115];   // % 51 à 99
  const baseLH = (r, odd) => r === 100 ? (odd ? -130 : 130) : r === 50 ? 0 : r > 50 ? LH_HI[r - 51] : -LH_HI[49 - r];
  // ---- Combat Odds Table (9.4) : colonnes 1-6 … 10-1 ; lignes de LH final (plus bas = mieux) ----
  const ODDS_COLS = ["1-6", "1-4", "1-2", "1-1", "2-1", "3-1", "4-1", "5-1", "6-1", "7-1", "8-1", "9-1", "10-1"];
  const HIT_ROWS = [[-91, [4, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20]], [-71, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18]], [-51, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16]],
    [-31, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14]], [-11, [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]], [9, [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
    [29, [0, 0, 0, 0, 1, 2, 3, 5, 5, 6, 7, 8, 9]], [49, [0, 0, 0, 0, 0, 1, 3, 4, 5, 5, 6, 7, 8]], [69, [0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 5, 6, 7]],
    [89, [0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 4, 5, 6]], [109, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 5]], [Infinity, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]];
  const hitsAt = (lh, col) => HIT_ROWS.find(r => lh <= r[0])[1][col];
  // chance de toucher : sur les 100 résultats du % (00 compté moitié +130, moitié −130)
  const hitChance = (mod, col) => { let n = 0; for (let r = 1; r <= 99; r++) if (hitsAt(baseLH(r) + mod, col) > 0) n++; return n + (hitsAt(-130 + mod, col) > 0 ? 0.5 : 0) + (hitsAt(130 + mod, col) > 0 ? 0.5 : 0); };
  // odds (9.4) : fractions arrondies vers le bas (37:10 = 3-1 ; 1:3 → 1-4 ; 1:5 → 1-6) ; au-delà de 10-1 : −10 LH par odds ; sous 1-6 : +5 par odds
  function oddsOf(af, ds) {
    if (af <= 0 || ds <= 0) return null;
    const r = af / ds;
    if (r >= 1 - 1e-9) { const n = Math.floor(r + 1e-9); return { col: 3 + Math.min(n, 10) - 1, n, over: Math.max(0, n - 10), excess: af - n * ds }; }
    const k = Math.ceil(ds / af - 1e-9); return { col: k <= 2 ? 2 : k <= 4 ? 1 : 0, under: Math.max(0, k - 6), k };
  }
  const gunCount = w => { const m = /^\s*(one|two|three|four|five|six|twin|quad|\d+)\b/i.exec(w); return m ? ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twin: 2, quad: 4 }[m[1].toLowerCase()] || +m[1] || 1) : 1; };
  const engines = a => { const m = /^\s*(one|two|three|four|\d+)\b/i.exec((a && a.engine) || ""); return m ? ({ one: 1, two: 2, three: 3, four: 4 }[m[1].toLowerCase()] || +m[1] || 1) : 1; };
  const ammoLeft = (p, g) => p.ammo && p.ammo[g.id] !== undefined ? p.ammo[g.id] : g.ammo;
  const gunOut = (p, g) => (p.gunsOut || []).includes(g.id);
  const DEF_IDS = /^(FG|DG|VG|TG|RG|LG|WG|WT|FT|TT|BT|RT|TS)\d?/;
  const isDefGun = g => DEF_IDS.test(g.id);
  const hitsBefore = p => (p.hitsLog || []).filter(x => x.turn < state.turn).reduce((t, x) => t + x.n, 0);
  const severeBefore = p => { const a = adcOf(p); return !!(a && a.dmg && hitsBefore(p) > a.dmg[0]); };
  const thisMove = p => p.mvT && p.mvT.turn === state.turn ? p.mvT : null;
  const canFire = p => !p.status || p.killedTurn === state.turn;
  const pad2s = v => (v < 0 ? "-" : "") + pad2(Math.abs(v));
  const modsSumC = L => L.reduce((t, m) => t + m.v, 0);
  const modsTxt = S => S.mods.length ? S.mods.map(m => (m.v > 0 ? "+" : "") + pad2s(m.v) + "(" + m.t + ")").join(", ") + " = " + (S.mod > 0 ? "+" : "") + pad2s(S.mod) : "none";
  // anneau des banks (10.2, LVMM) : LV, RB, IR, IV, IL, LB ; écart maxi 3 pas
  const BANK_RING = { 0: 0, 1: 1, 2: 2, 3: 3, "-2": 4, "-1": 5 };
  const bankDist = (x, y) => { const d = Math.abs(BANK_RING[norm6(x)] - BANK_RING[norm6(y)]); return Math.min(d, 6 - d); };
  const bankSide = b => { b = norm6(b); return b === 1 || b === 2 ? "R" : b === -1 || b === -2 ? "L" : ""; };
  function lvMatch(sb, tb, fin) {
    sb = norm6(sb); tb = norm6(tb);
    if (fin <= 60) return sb === tb;
    if (fin === 90) return (bankSide(sb) && bankSide(sb) === bankSide(tb)) || (sb === 0 && tb === 0) || (sb === 3 && tb === 3);
    const si = isInv(sb), ti = isInv(tb);
    if (sb === 0 && tb === 0) return true; if (sb === 3 && tb === 3) return true;
    if (si === ti) return !!bankSide(sb) && !!bankSide(tb) && bankSide(sb) !== bankSide(tb);
    return !!bankSide(sb) && bankSide(sb) === bankSide(tb);
  }
  // vitesse combinée (10.2) / vitesse relative (10.5) selon la déflexion finale
  function combSpeed(fin, ss, ts) {
    const f = Math.max(ss, ts), sl = Math.min(ss, ts);
    return fin >= 150 ? ss + ts : fin === 120 ? f + sl / 2 : fin === 90 ? f : fin === 60 ? f - sl / 2 : ts - ss;
  }
  // rythme G le plus haut utilisé ou reporté ce tour (index RATES, −1 = aucun)
  function rateUsed(p, ov) {
    const mvt = thisMove(p), cs = parseCarry(p.mcarry);
    const m = ov !== undefined ? +ov : mvt ? mvt.rateMax : -1;
    return Math.max(m, cs.turn ? RATES.indexOf(cs.turn.rate) : -1);
  }
  const heavy = p => ["M", "H"].includes(clsOf(p));
  const gMod = (p, r) => r < 1 || r > 3 ? 0 : heavy(p) ? [10, 20, 30][r - 1] : [0, 10, 20][r - 1];
  // viseur (Combat Tables page 1) : télescope / simple +15 si déflexion > 30°, anneau et guidon +20, gyroscopique (tracking : facteur −1)
  function sightOf(p) {
    const n = ((adcOf(p) || {}).notes || "");
    if ((p.crits || []).some(c => c === "Gunsight lost" || c === "Oil on canopy")) return "none";
    if (/gyro/i.test(n)) return "gyro";
    if (/ring\s*(&|and)\s*bead/i.test(n) && !/backup/i.test(n)) return "ring";
    if (/telescop|simple gun ?sight/i.test(n)) return "telescope";
    return "reflector";
  }

  // ---- modificateurs universels (Combat Tables page 1) de l'avion qui tire (tireur ou mitrailleur principal) ----
  function universalMods(p, M, ov) {
    const mvt = thisMove(p), a = adcOf(p) || {};
    if (mvt && mvt.ng) M(30, "negative-G used");
    if (isInv(p.bank)) M(20, "inverted");
    const slip = ov && ov.slip !== undefined ? ov.slip : mvt ? mvt.slip : "";
    M(slip === "slip" ? 15 : slip === "skid" ? 30 : 0, slip);
    M(severeBefore(p) ? 15 : 0, "severely damaged");
    const mn = perfVal(p, bandOf(p.alt), "min"); M(mn !== null && p.speed < mn ? 15 : 0, "below the adjusted min speed");
    const snaps = ov && ov.snaps !== undefined ? +ov.snaps : mvt ? mvt.snaps : 0; M(10 * snaps, snaps + " snap roll" + (snaps > 1 ? "s" : ""));
    M({ Recruit: 30, Green: 15, Veteran: -5 }[p.pq] || 0, p.pq.toLowerCase() + " crew");
    M(p.hero ? -5 : 0, "hero"); M(p.ace ? -10 : 0, "ace"); M(p.crack ? -10 : 0, (p.crack === 2 ? "double " : "") + "crack shot");
  }

  // ---- le tir aux armes fixes préparé : tout ce qui se calcule avant le jet ----
  //  opt = { tgt, groups, burst ("normal" | "half" | "long" ; lb = long, compatibilité), ts, rate, slip, snaps, fof, ovr, crack, area, tail }
  function shotOf(sh, opt) {
    const a = adcOf(sh), tg = state.planes.find(q => q.id === opt.tgt), S = { errs: [], warns: [], mods: [], sh, tg, notes: [] };
    if (!a) { S.errs.push("no data card for " + callsign(sh)); return S; }
    if (!tg) { S.errs.push("choose a target"); return S; }
    const ta = adcOf(tg); if (!ta) { S.errs.push("no data card for the target"); return S; }
    const mvt = thisMove(sh), I = initOf(), burst = opt.burst || (opt.lb ? "long" : "normal");
    if (!canFire(sh)) S.errs.push(callsign(sh) + " is out of play");
    if (tg.status && tg.killedTurn !== state.turn) S.errs.push(callsign(tg) + " is out of play");
    if (mvt && mvt.et) S.errs.push("ET rate used this turn: no gun fire (5.2)");
    if (mvt && mvt.ooc) S.errs.push("stalled, spinning or in compressibility: no attacks (4.5, 4.7)");
    if (I.fixed && I.fixed[sh.id]) S.errs.push("started the turn in fixed formation: no fixed gun fire (8.5.1)");
    if (I.unsighted && I.unsighted[tg.id]) S.errs.push(callsign(tg) + " started the turn unsighted: no attack (8.1.2)");
    if ((sh.crew || [])[0] === "KIA" || (sh.crew || [])[0] === "OUT") S.errs.push("pilot out of action");
    // ---- position : même hex → l'avion arrivé en dernier est reculé d'un hex le long de son cap (8.2, 10.2) ----
    const h0 = rangeHex(sh, tg);
    let from = { c: sh.c, r: sh.r, hex2: sh.hex2 }, to = { c: tg.c, r: tg.r, hex2: tg.hex2 };
    const sSeq = mvt ? mvt.seq : 0, tSeq = thisMove(tg) ? thisMove(tg).seq : 0;
    if (h0 === 0) {
      const back = q => stepFrom(q, norm360(scr(q.head) + 180)) || q;
      if (sSeq >= tSeq) from = back(sh); else to = back(tg);
      S.shifted = sSeq >= tSeq ? callsign(sh) : callsign(tg);
    }
    S.fof = mvt && mvt.ng ? "" : opt.fof !== undefined ? opt.fof : (mvt ? mvt.fof : "");      // NG : arc sans virage (5.9)
    S.hOk = inHArc(from, sh.head, S.fof, to);
    S.h = h0; S.dAlt = tg.alt - sh.alt; S.vOk = inVArc(sh.pitch, h0, S.dAlt); S.vTxt = vArcTxt(sh.pitch, h0);
    S.v = vertRange(S.dAlt); S.range = Math.max(S.h, S.v) + Math.floor(Math.min(S.h, S.v) / 2);
    if (!S.hOk) S.errs.push("target not in the horizontal field of fire (" + (S.fof ? "turning " + (S.fof === "L" ? "left" : "right") : "not turning") + ", 9.2)");
    if (!S.vOk) S.errs.push("target not in the vertical field of fire (" + pitchName(sh.pitch, sh.bank) + ": " + S.vTxt + "; it is " + Math.abs(S.dAlt) + " ft " + (S.dAlt >= 0 ? "higher" : "lower") + ", 9.2)");
    if (S.range === 0) {                                                  // 10.2 : range 0
      if (!(sSeq > tSeq)) S.errs.push("range 0 attack: the shooter must have entered the position after the target (10.2)");
      if (Math.abs(S.dAlt) > 200 && h0 === 0) S.errs.push("range 0 attack: within 200 ft of the target (10.2)");
    }
    // ---- armes fixes ----
    const want = opt.groups || a.guns.filter(g => !isDefGun(g)).map(x => x.id);
    const use = a.guns.filter(g => !isDefGun(g) && want.includes(g.id) && !gunOut(sh, g) && ammoLeft(sh, g) > 0);
    S.use = use;
    if (!use.length) S.errs.push("no fixed gun group with ammunition selected");
    S.af = use.reduce((t, g) => t + (((a.gunAF[g.id] || [])[S.range]) || 0), 0);
    if (use.length && !S.af) S.errs.push("no attack factor at range " + S.range + " (9.1)");
    // ---- déflexion, défense ----
    const b1 = relBearing(sh, tg), b2 = relBearing(tg, sh), spin = isSpin(tg);
    S.defl = deflection(sh, tg);
    if (S.defl.fin === 0 && !inHArc(from, sh.head, "", to)) { S.defl = Object.assign({}, S.defl, { fin: 30, mult: 2, how: S.defl.how + "; 0° only in the non-turning arc: 30°" }); }
    S.headOnLine = !spin && b1 !== null && Math.abs(b1) < 0.01 && b2 !== null && Math.abs(b2) < 0.01 && S.defl.fin >= 150;
    S.mult = Math.max(1, S.defl.mult - (S.headOnLine ? 1 : 0));
    S.ds = ta.def * S.mult;
    S.on12 = b2 !== null && Math.abs(b2) < 0.01;                            // tireur sur la ligne 12:00 de la cible (critiques)
    S.beam = !spin && S.defl.fin === 90 && b2 !== null && Math.abs(Math.abs(b2) - 90) < 0.01;
    S.headOn = S.defl.fin >= 150 && b2 !== null && Math.abs(b2) <= 30.01;
    if (S.headOn && S.range === 0) S.errs.push("head-on attacks at range 0 are not allowed (10.3)");
    // ---- tracking shot et long burst (10.1) : la cible a bougé avant le tireur ; points du mouvement dans le champ horizontal ----
    const tMv = thisMove(tg), movedBefore = !!(mvt && tMv && tMv.seq < mvt.seq);
    S.lbAmmo = use.every(g => ammoLeft(sh, g) >= 2);
    if (mvt && mvt.pts && mvt.pts.length) {
      const inF = mvt.pts.map(q => inHArc(q, q.head, mvt.ng ? "" : q.trn, to)), n = inF.length, need = Math.ceil(fvt(mvt.fps || n, 3) - 1e-9);
      let tail = 0; for (let i = n - 1; i >= 0 && inF[i]; i--) tail++;
      S.fpIn = inF.filter(Boolean).length; S.fpTail = tail; S.fpNeed = need; S.fpN = n;
      S.lbOk = movedBefore && S.lbAmmo && S.fpIn >= need;
      S.tsOk = movedBefore && tail >= need && S.defl.fin <= 60;
    } else { S.lbOk = !!opt.ovr && S.lbAmmo; S.tsOk = !!opt.ovr && S.defl.fin <= 60; S.paper = true; }
    if (mvt && mvt.ng) { S.lbOk = false; S.tsOk = false; }
    if (spin) S.tsOk = false;
    S.movedBefore = movedBefore;
    if (burst === "long" && !S.lbOk) S.errs.push("long burst not allowed (10.1: target moved first, 2 ammo points in every group fired, target in the field of fire for 2/3 of the FPs; not with NG rates)");
    if (opt.ts && !S.tsOk) S.errs.push("tracking shot not allowed (10.1: target moved first, in the field of fire for the last 2/3 of the FPs, final deflection 60° or less; not with NG rates or against a spinning aircraft)");
    // gyro : tracking → facteur −1
    S.sight = sightOf(sh);
    if (opt.ts && S.tsOk && S.sight === "gyro") { S.mult = Math.max(1, S.mult - 1); S.ds = ta.def * S.mult; S.notes.push("gyro gunsight with tracking shot: deflection factor −1"); }
    // demi-point de munitions (10.1) : normal à −1 colonne si au moins la moitié des armes ont un point ; sinon demi-burst
    const nAll = use.reduce((t, g) => t + gunCount(g.weapon), 0), nHalf = use.filter(g => ammoLeft(sh, g) < 1).reduce((t, g) => t + gunCount(g.weapon), 0);
    S.burst = burst; S.ammoShift = 0;
    if (burst === "normal" && nHalf) { if (nHalf * 2 > nAll) { S.burst = "half"; S.notes.push("more than half the guns have only 0.5 ammo: half burst (10.1)"); } else if (!sh.crack) { S.ammoShift = -1; S.notes.push("some groups have only 0.5 ammo: one column left (10.1)"); } }
    S.odds = oddsOf(S.af, S.ds);
    // ---- modificateurs du LH (Combat Tables page 1 ; un LH plus BAS est meilleur) ----
    const M = (v, t) => { if (v) S.mods.push({ v, t }); };
    universalMods(sh, M, opt);
    M(sh.wia ? 20 : 0, "pilot wounded");
    M(-5 * (ta.size || 0), "target size " + (ta.size > 0 ? "+" : "") + ta.size);
    if (S.odds && S.odds.col >= 3) { const e = S.odds.excess, d = S.ds; M(e >= 2 / 3 * d ? -15 : e >= d / 2 ? -10 : e >= d / 3 ? -5 : 0, "excess firepower " + num(e) + " of " + d); }
    if (S.odds && S.odds.under) M(5 * S.odds.under, "odds under 1-6");
    const rate = rateUsed(sh, opt.rate); M(gMod(sh, rate), rate >= 1 ? RATES[rate] + " rate" : "");
    M(S.sight === "none" ? 40 : S.sight === "ring" ? 20 : (S.sight === "telescope" && S.defl.fin > 30) ? 15 : 0, S.sight === "none" ? "no gunsight" : S.sight + " gunsight");
    // harmonisation (10.2) : armes réelles dans les ailes
    const nW = use.filter(g => /^W/.test(g.id)).reduce((t, g) => t + gunCount(g.weapon), 0);
    if (nW && nW * 2 >= nAll) M(S.range === 2 ? -15 : S.range === 3 ? -10 : S.range > 3 ? 10 * (S.range - 3) : 0, "wing gun harmony A, range " + S.range);
    else if (nW) M(S.range === 2 || S.range === 3 ? -5 : S.range > 3 ? 5 * (S.range - 3) : 0, "wing gun harmony B, range " + S.range);
    // armes d'aile déséquilibrées (10.2) : feu à portée 0 d'une aile ≥ 2 × l'autre (sauf fiche déséquilibrée d'origine)
    const af0 = (L, side) => L.filter(g => /^W/.test(g.id) && g.id.endsWith("-" + side)).reduce((t, g) => t + ((a.gunAF[g.id] || [])[0] || 0), 0);
    const uL = af0(use, "L"), uR = af0(use, "R"), dL = af0(a.guns, "L"), dR = af0(a.guns, "R");
    if ((uL || uR) && Math.max(uL, uR) >= 2 * Math.min(uL, uR) && !(Math.max(dL, dR) >= 2 * Math.min(dL, dR))) M(15, "unbalanced wing guns");
    // déflexion presque nulle (10.2) : ligne 12:00 du tireur sur la ligne 6:00 de la cible, déflexion ≤ 30°
    if (!spin && b1 !== null && Math.abs(b1) < 0.01 && b2 !== null && Math.abs(b2) >= 179.99 && S.defl.fin <= 30) M(-20, "near zero deflection (12:00 on the 6:00 line)");
    // lift-vector mismatch (10.2) : +5 par pas d'écart de bank et par avion ayant utilisé HT+
    if (!spin && !lvMatch(sh.bank, tg.bank, S.defl.fin)) {
      const n = (rate >= 2 ? 1 : 0) + (rateUsed(tg) >= 2 ? 1 : 0), d = bankDist(sh.bank, tg.bank);
      M(5 * n * d, "lift-vector mismatch " + BANKS[norm6(sh.bank)] + " / " + BANKS[norm6(tg.bank)] + " (" + d + " step" + (d > 1 ? "s" : "") + " × " + n + " aircraft at HT+)");
    }
    // vitesses combinées > 6.0 (10.2) : +5 par point (ou fraction) au-delà
    S.cs = combSpeed(S.defl.fin, sh.speed, tg.speed);
    if (S.cs > 6) M(5 * Math.ceil(S.cs - 6 - 1e-9), "combined speed " + fmt1(S.cs));
    S.mod = S.mods.reduce((t, m) => t + m.v, 0);
    // ---- colonne : tracking +1, long burst +1, demi-burst −2 (crack shot −1), beam −1, demi-point de munitions −1 ----
    if (S.odds) {
      const sh2 = (opt.ts && S.tsOk ? 1 : 0) + (S.burst === "long" && S.lbOk ? 1 : 0) - (S.burst === "half" ? (sh.crack ? 1 : 2) : 0) - (S.beam ? 1 : 0) + S.ammoShift;
      let col = S.odds.col + sh2;
      const over = (S.odds.over || 0) + Math.max(0, col - 12), under = Math.max(0, -col);
      col = clamp(col, 0, 12);
      if (over) { S.mods.push({ v: -10 * over, t: "odds over 10-1" }); S.mod -= 10 * over; }
      if (under) { S.mods.push({ v: 5 * under, t: "odds under 1-6" }); S.mod += 5 * under; }
      S.col = col; S.shift = sh2;
    }
    S.ts = !!(opt.ts && S.tsOk);
    // tir frontal (10.3) : distance dans le CRR (1/3 de la vitesse combinée, arrondi au-dessus) → jet de détermination
    if (S.headOn) {
      S.crr = Math.ceil((sh.speed + tg.speed) / 3 - 1e-9); S.inside = S.crr + 1 - S.range;
      if (S.inside >= 1) {
        S.detNeed = [90, 80, 70, 50, 30][Math.min(5, S.inside) - 1];
        S.detMods = ({ Recruit: 10, Green: 5, Veteran: -5 }[sh.pq] || 0) + (sh.hero || sh.ace ? -5 : 0);
        S.warns.push("head-on attack inside the collision risk range (CRR " + S.crr + ", " + S.inside + " hex" + (S.inside > 1 ? "es" : "") + " inside): pilot determination % roll" + modTxt(S.detMods) + " ≤ " + S.detNeed + " to fire; danger zone: collision check if either enters 1 hex / ±300 ft of the other (10.3)");
      }
    }
    if (S.range === 0 && !opt.tail) S.warns.push("range 0 attack: collision check at the end of the turn unless the shooter tails the target (10.2)");
    return S;
  }
  function shotText(S) {
    const L = [];
    L.push(callsign(S.sh) + " firing at " + callsign(S.tg));
    L.push(lineOf(S.tg)); L.push(lineOf(S.sh));
    if (S.shifted) L.push("Same hex: " + S.shifted + " entered last, moved back one hex for the field of fire (10.2)");
    L.push("Range: " + S.h + "H + " + S.v + "V = " + Math.max(S.h, S.v) + " + " + Math.floor(Math.min(S.h, S.v) / 2) + " (smaller halved, rounded down) = " + S.range);
    L.push("Initial Deflection: " + S.defl.init + "° (x" + DEFL_MULT[S.defl.init] + "), " + S.defl.how);
    L.push("Final Deflection: " + S.defl.fin + "° (x" + S.defl.mult + ")" + (S.mult !== S.defl.mult ? ", factor x" + S.mult + (S.headOnLine ? " (12:00 on the 12:00 line)" : "") : "") + (S.beam ? ", beam attack" : "") + (S.headOn ? ", head-on" : ""));
    const base = S.odds ? ODDS_COLS[S.odds.col] : "–";
    L.push("Attack: " + num(S.af) + ":(" + adcOf(S.tg).def + "x" + S.mult + ") = " + num(S.af) + ":" + S.ds + " = " + base + (S.shift ? ", " + (S.shift > 0 ? "+" : "") + S.shift + " column" + (Math.abs(S.shift) > 1 ? "s" : "") + " (" +
      [S.ts ? "tracking" : "", S.burst === "long" ? "long burst" : "", S.burst === "half" ? "half burst" : "", S.beam ? "beam" : "", S.ammoShift ? "0.5 ammo" : ""].filter(Boolean).join(", ") + ")" : "") + " Mods: " + modsTxt(S));
    S.notes.forEach(n => L.push(n));
    L.push("Final: " + (S.col !== undefined ? ODDS_COLS[S.col] : "–") + "; " + (S.mod > 0 ? "+" : "") + pad2s(S.mod));
    return L.join("\n");
  }

  // ---- coups critiques (11.2, Combat Tables page 2) ----
  //  nombre : une critique par multiple de la note des groupes ; notes différentes : hits distribués en cycle, de la note la plus basse
  function critCount(hits, ratings) {
    const R = ratings.slice().sort((x, y) => x - y); if (!R.length) return 0;
    if (R.every(r => r === R[0])) return Math.floor(hits / R[0] + 1e-9);
    let left = hits, n = 0;
    for (let guard = 0; left > 1e-9 && guard < 100; guard++) for (const r of R) { if (left + 1e-9 >= r) { n++; left -= r; } else { left = 0; break; } }
    return n;
  }
  const AREA = d => d <= 2 ? "Engine" : d <= 4 ? "Fuel tanks" : d === 5 ? "Hollow space" : d === 6 ? "Cockpit" : d <= 8 ? "Wings" : d === 9 ? "Equipment" : "Flight controls";
  const crewNames = p => String((adcOf(p) || {}).crew || "Pilot").split(/,|\band\b/).map(x => x.trim()).filter(Boolean);
  const crewSt = p => { const n = crewNames(p).length; p.crew = Array.from({ length: n }, (_, i) => (p.crew || [])[i] || (i === 0 && p.wia ? "WIA" : "")); return p.crew; };
  const radial = a => /radial/i.test((a && a.enginePower) || "");
  const destroysAt = (p, k) => ["M", "H"].includes(clsOf(p)) ? 3 : 2;            // deux longerons / queues : F, L ; trois : M et plus
  function shotDown(tg, sh, why, L) {
    if (tg.status) return;
    tg.status = "destroyed"; tg.killedTurn = state.turn; L.push(callsign(tg) + " is shot down (" + why + ")");
    if (sh && sh.side !== tg.side) { state.boost = Object.assign({}, state.boost, { [sh.side]: state.turn + 2 }); L.push(SIDES[sh.side].name + " side: +2 to initiative rolls for the next two game turns (8.1)"); }
  }
  // un critique : zone (D10 + mods), puis effet ; ctx = { sh, defl, on12, beam, range, crack, area, dc (double crack), def (tir défensif), frontArc, rearArc }
  function applyCrit(tg, ctx, L, i) {
    const ta = adcOf(tg), sh = ctx.sh;
    let am = 0; const why = [];
    if (ctx.front) { am--; why.push("−1 front"); if (ctx.on12) { am--; why.push("−1 12:00 line"); } }
    if (ctx.rear) { am++; why.push("+1 rear"); }
    if (engines(ta) > 1) { am--; why.push("−1 multi-engine"); }
    const ad = dieRoll(10, "critical area", sh), cr = ctx.range <= 2 && sh && sh.crack ? (+ctx.crack || 0) : 0;
    let area = AREA(ad + am + cr);
    if (ctx.area && sh && sh.crack === 2 && ctx.range <= 2) area = ctx.area;
    L.push("  Crit " + i + ": area D10 " + ad + (why.length ? " " + why.join(" ") : "") + (cr ? " " + (cr > 0 ? "+" : "") + cr + " crack shot" : "") + " → " + area);
    critEffect(tg, area, ctx, L, 0);
  }
  function critEffect(tg, area, ctx, L, depth) {
    const ta = adcOf(tg), sh = ctx.sh, add = c => { tg.crits = (tg.crits || []).concat(c); }, has = c => count(tg, c);
    const d10 = what => dieRoll(10, what, sh), out = t => L.push("    " + t);
    const kill = why => shotDown(tg, sh, why, L);
    if (area === "Hollow space") { out("no effect"); return; }
    if (area === "Engine") {
      const prior = tg.engHits || 0, m = (radial(ta) ? 2 : 0) + (ta.prot.engine || 0) - (prior ? 2 : 0) - ((thisMove(tg) || {}).emer ? 1 : 0);
      const d = d10("critical effect (engine)"), r = d + m; tg.engHits = prior + 1;
      out("engine D10 " + d + modTxt(m) + " = " + r);
      const leak = () => { const liq = !radial(ta); add(liq ? "Coolant leak" : "Oil leak"); out(liq ? "coolant leak (white smoke)" : "oil leak (white smoke)");
        if ((liq && has("Coolant leak") + has("Oil leak") >= 2) || (!liq && has("Oil leak") >= 3)) { add("Engine seizes"); out("too many leaks: engine seized"); } };
      if (r <= 1) { add("Engine seizes"); out("engine seized: no power, synchronized guns lost");
        if (engines(ta) === 1) ta.guns.filter(g => /^N/.test(g.id) && !gunOut(tg, g)).forEach(g => { tg.gunsOut = (tg.gunsOut || []).concat(g.id); }); }
      else if (r <= 3) leak();
      else if (r === 4) { add("Minor fire"); out("minor fire breaks out"); }
      else if (r <= 6) { add("Power loss"); out("lose 1 step of power"); }
      else if (r === 7) { const e = d10("engine: odd minor fire, even 2 power steps"); if (e % 2) { add("Minor fire"); out("D10 " + e + ": minor fire"); } else { add("Power loss"); add("Power loss"); out("D10 " + e + ": lose 2 steps of power"); } }
      else if (r === 8) { add("Oil leak"); const e = d10("oil leak: odd oil on canopy, even smoldering oil"); if (e % 2 && engines(ta) === 1) { add("Oil on canopy"); out("oil leak, D10 " + e + ": oil on canopy (no tailing, gunsight useless, −2 initiative)"); } else { add("Smoldering oil"); out("oil leak, D10 " + e + ": smoldering oil"); }
        if (radial(ta) && has("Oil leak") >= 3) { add("Engine seizes"); out("third oil leak: engine seized"); } }
      else { const e = d10("engine: odd 1 power step, even no effect"); if (e % 2) { add("Power loss"); out("D10 " + e + ": lose 1 step of power"); } else out("D10 " + e + ": no effect"); }
      if (has("Power loss") >= 5 && !has("Engine seizes")) { add("Engine seizes"); out("five power steps lost: engine disabled"); }
      return;
    }
    if (area === "Fuel tanks") {
      const prior = tg.fuelHits || 0, m = (ta.prot.fuel || 0) - (prior ? 2 : 0) - has("Major fuel leak");
      const d = d10("critical effect (fuel)"), r = d + m; tg.fuelHits = prior + 1;
      out("fuel D10 " + d + modTxt(m) + " = " + r);
      if (r <= 1) { out("the aircraft explodes"); kill("fuel tank explosion"); }
      else if (r === 2 || (r === 3 && (ta.prot.fuel || 0) <= 0)) { add("Fuel fire"); out("fuel fed fire (major fire, large flames)"); }
      else if (r <= 4) { add("Major fuel leak"); out("major fuel leak"); }
      else if (r <= 8) { add("Fuel leak"); out("steady fuel leak"); }
      else out("minor fuel loss: no effect at combat scale");
      return;
    }
    if (area === "Cockpit") {
      const m = Math.max(0, (ta.prot.cockpit || 0) - (ctx.beam ? 1 : 0));
      const d = d10("critical effect (cockpit)"), r = d + m;
      out("cockpit D10 " + d + modTxt(m) + " = " + r);
      if (r <= 3) crewHit(tg, "KIA", ctx, L);
      else if (r <= 6) crewHit(tg, "WIA", ctx, L);
      else if (r <= 8) { out("equipment and flight controls:"); if (depth < 2) { critEffect(tg, "Equipment", ctx, L, depth + 1); critEffect(tg, "Flight controls", ctx, L, depth + 1); } }
      else { out("equipment:"); if (depth < 2) critEffect(tg, "Equipment", ctx, L, depth + 1); }
      return;
    }
    if (area === "Wings") {
      const m = (clsOf(tg) === "H" ? 1 : 0) - (isSevere(tg) ? 1 : 0), d = d10("critical effect (wing)"), r = d + m;
      out("wing D10 " + d + modTxt(m) + " = " + r);
      const wingGuns = n => { const G = ta.guns.filter(g => /^W/.test(g.id) && !gunOut(tg, g)).slice(0, n); if (!G.length) { out("no wing weapon left: hollow space"); return; } G.forEach(g => { tg.gunsOut = (tg.gunsOut || []).concat(g.id); }); out(G.map(g => g.id).join(", ") + " disabled"); };
      if (r <= 1) { out("wing spar fails: the wing rips off"); kill("wing ripped off"); }
      else if (r <= 3) { add("Wing spar"); out("wing spar damaged (−1.0 safe dive speed, BT+ overstress risk)"); if (has("Wing spar") >= destroysAt(tg)) kill(has("Wing spar") + " wing spar hits"); }
      else if (r === 4) { add("+1 Bank / Slip"); out("ailerons hit: +1 bank and slip / skid FPs, no snap rolls"); }
      else if (r === 5) wingGuns(2);
      else if (r === 6) { const e = d10("wing: odd gear, even flaps"); add(e % 2 ? "Landing gear damaged" : "Flaps jammed"); out("D10 " + e + ": " + (e % 2 ? "landing gear damaged" : "flaps jammed")); }
      else if (r === 7) { const e = d10("wing: odd wing engine, even fuel"); if (e % 2) { if (engines(ta) > 1) { out("D10 " + e + ": wing engine critical"); critEffect(tg, "Engine", ctx, L, depth + 1); } else out("D10 " + e + ": no wing engine, no effect"); } else { out("D10 " + e + ": fuel critical"); critEffect(tg, "Fuel tanks", ctx, L, depth + 1); } }
      else if (r === 8) { if (tg.bomb) { const e = d10("bombs carried: explosion ≥ 6"); out("bombs carried, D10 " + e + (e >= 6 ? ": the aircraft explodes" : ": no explosion")); if (e >= 6) kill("bomb load explodes"); } else out("no bombs carried: no effect"); }
      else if (r === 9) wingGuns(1);
      else { add("+1 Decel"); out("torn surface skin: +1 decel per game turn"); }
      return;
    }
    if (area === "Equipment") {
      const d = d10("critical effect (equipment)");
      out("equipment D10 " + d);
      if (d === 1) crewHit(tg, "WIA", ctx, L);
      else if (d === 2) { add("Landing gear damaged"); out("landing gear jammed / damaged"); }
      else if (d === 3) { add("Gear / flap systems hit"); out("gear / flap systems hit (fixed gear damaged)"); }
      else if (d === 4) { add("Gunsight lost"); out("fixed gunsight lost (+40 to its shots)"); }
      else if (d === 5) { const e = d10("equipment: odd oxygen, even radios"); if (e % 2) { add("Oxygen out"); out("D10 " + e + ": oxygen out"); } else { add("Radio out"); tg.noRadio = true; out("D10 " + e + ": radios and radar lost"); } }
      else if (d === 6) { if (ta.guns.some(g => /^N/.test(g.id))) { add("Gun synchronization failed"); out("gun synchronization fails: if the nose guns are fired, D10 ≤ 3 = propeller shot off, engine out"); } else crewHit(tg, "WIA", Object.assign({}, ctx, { nonPilot: true }), L); }
      else if (d === 7) { add("Flight instruments out"); out("flight instruments out"); }
      else if (d === 8) { const g = ta.guns.find(x => !gunOut(tg, x)); if (g) { tg.gunsOut = (tg.gunsOut || []).concat(g.id); out(g.id + " disabled"); } else { add("Oxygen out"); out("no weapon: oxygen out"); } }
      else if (d === 9) { add("Radio out"); tg.noRadio = true; out("navigation instruments, radios and radar knocked out"); }
      else { add("Exit jammed"); out("one exit / canopy jammed (+30 to bail out)"); }
      return;
    }
    if (area === "Flight controls") {
      const big = ["M", "H"].includes(clsOf(tg)), d = d10("critical effect (flight controls)"), r = d + (big ? 1 : 0);
      out("flight controls D10 " + d + (big ? " + 1" : "") + " = " + r);
      const tail = () => { add("Tail structure"); out("tail structure hit (−1.0 safe dive speed)"); if (has("Tail structure") >= destroysAt(tg)) kill(has("Tail structure") + " tail structure hits"); };
      if (r <= 2) tail();
      else if (r === 3) { if (big && !has("Cables severed")) { add("Cables severed"); out("key control cables severed: no effect on the first hit for M class and larger"); } else { out("key control cables severed: aircraft permanently out of control"); kill("control cables severed"); } }
      else if (r === 4) { if (has("Rudder out") || has("Elevators")) tail(); else { add("Rudder out"); out("rudder knocked out: no snap rolls, slips, skids or spin recovery"); } }
      else if (r === 5) { if (has("Rudder out") || has("Elevators")) tail(); else { add("Elevators"); out("elevators hit: TT rates or less"); } }
      else if (r === 6) { add("+1 Bank / Slip"); out("ailerons hit: +1 bank and slip / skid FPs, no snap rolls"); }
      else if (r === 7) { const e = d10("throttle: odd cruise, even jammed"); add(e % 2 ? "Throttle: cruise max" : "Throttle jammed"); out("D10 " + e + ": " + (e % 2 ? "engine limited to cruise power or less" : "throttle jammed in place")); }
      else if (r === 8) { add("Cables jamming"); out("control cables jamming: D10 at the start of each move, odd = TT rates or less"); }
      else if (r === 9) { add("Sluggish controls"); out("controls sluggish: allowed rates reduced by one (EZ always)"); }
      else { const g = ta.guns.find(x => !gunOut(tg, x) && (isDefGun(x) || /^W/.test(x.id))); if (g) { tg.gunsOut = (tg.gunsOut || []).concat(g.id); out(g.id + " disabled"); } else out("no defensive or wing gun: no effect"); }
    }
  }
  // membre d'équipage touché : au hasard parmi les vivants ; 1re blessure du pilote = blessé (+20…), 2e = hors de combat (D10 : ≤ 5,
  //  encore 2 × D10 tours, sinon tué) ; non-pilote blessé = hors de combat ; deux blessures tuent ; pilote tué ou hors de combat = abattu
  function crewHit(tg, kind, ctx, L) {
    const C = crewSt(tg), names = crewNames(tg), alive = C.map((s, i) => i).filter(i => C[i] !== "KIA" && !(ctx.nonPilot && i === 0));
    if (!alive.length) { L.push("    no living crew member: no effect"); return; }
    const i = alive.length > 1 ? alive[dieRoll(alive.length, "which crew member", ctx.sh) - 1] : alive[0], who = names[i] || "crew " + (i + 1);
    if (kind === "KIA" || (i > 0 && C[i]) || (i === 0 && C[0] === "OUT")) {
      C[i] = "KIA"; L.push("    " + who + " killed" + (kind === "WIA" ? " (second wound)" : ""));
      if (i === 0) shotDown(tg, ctx.sh, "pilot killed", L);
      return;
    }
    if (i === 0) {
      if (C[0] === "") { C[0] = "WIA"; tg.wia = true; L.push("    pilot wounded (+20 to his shots and stall / spin rolls)"); return; }
      const d = dieRoll(10, "disabled pilot", ctx.sh);
      if (d <= 5) { C[0] = "OUT"; L.push("    pilot wounded again and disabled: D10 " + d + " → can fly " + 2 * d + " more combat turns"); }
      else { C[0] = "KIA"; L.push("    pilot wounded again: D10 " + d + " ≥ 6, killed"); shotDown(tg, ctx.sh, "pilot killed", L); }
      return;
    }
    C[i] = "OUT"; L.push("    " + who + " wounded: out of action");
  }
  // dégâts d'un tir réussi (11.1, 11.2) : hits, critiques, sévère / détruit ; L reçoit le texte
  function applyHits(tg, sh, hits, ratings, ctx, L) {
    const ta = adcOf(tg);
    tg.hits = (tg.hits || 0) + hits;
    tg.hitsLog = (tg.hitsLog || []).concat({ turn: state.turn, n: hits, by: sh ? sh.id : "" });
    const nc = critCount(hits, ratings);
    if (nc) L.push("Critical hits: " + hits + " hits, ratings " + ratings.join(" / ") + " → " + nc);
    for (let i = 0; i < nc; i++) applyCrit(tg, ctx, L, i + 1);              // toutes les critiques sont jouées, même si l'avion est déjà abattu (11.2)
    if (!tg.status && tg.hits > ta.dmg[1]) shotDown(tg, sh, tg.hits + " hits > " + ta.dmg[1], L);
    else if (!tg.status && tg.hits > ta.dmg[0]) L.push(callsign(tg) + ": " + tg.hits + " hits > " + ta.dmg[0] + ", severely damaged (11.1)");
  }
  function rollLH(p, what) {
    const r = dieRoll(100, what, p), odd = r === 100 ? dieRoll(10, "00: even +130, odd −130", p) % 2 === 1 : false;
    return { r, base: baseLH(r, odd), txt: r === 100 ? "00 (" + (odd ? "odd" : "even") + ")" : pad2(r) };
  }
  function logShot(sh, rec) {
    state.shots = (state.shots || []).concat(rec);
    const lg = (sh.logs || []).find(x => x.turn === state.turn);
    if (lg) lg.text += "\n\n" + rec.text; else sh.logs = (sh.logs || []).concat({ turn: state.turn, text: "TURN" + pad2(state.turn) + "\n" + rec.text });
  }
  function fire(sh, opt) {
    const S = shotOf(sh, opt); if (S.errs.length) return null;
    const a = adcOf(sh), tg = S.tg, L = [shotText(S)];
    // détermination du tir frontal (10.3)
    if (S.detNeed) {
      const d = dieRoll(100, "head-on pilot determination", sh), r = d + S.detMods;
      L.push("Head-on determination: % " + pad2(d) + modTxt(S.detMods) + " = " + r + (r <= S.detNeed ? " ≤ " + S.detNeed + ": fires" : " > " + S.detNeed + ": the pilot aborts the shot"));
      if (r > S.detNeed) { const rec = { turn: state.turn, sh: sh.id, tg: tg.id, text: L.join("\n"), range: S.range, tail: !!opt.tail, ts: false, aborted: true }; logShot(sh, rec); return rec; }
    }
    const R = rollLH(sh, "gun attack % vs " + callsign(tg)), fin = R.base + S.mod;
    let hits = hitsAt(fin, S.col);
    const nNose = S.use.filter(g => /^N/.test(g.id) && ((a.gunAF[g.id] || [])[S.range] || 0) > 0).reduce((t, g) => t + gunCount(g.weapon), 0);
    if (hits > 1 && nNose >= 4) { const b = Math.floor(nNose / 4); hits += b; L.push("Concentrated nose guns: +" + b + " hit" + (b > 1 ? "s" : "") + " (10.2)"); }
    L.push("Roll: " + R.txt + " → base LH " + (R.base > 0 ? "+" : "") + R.base + (S.mod ? " " + (S.mod > 0 ? "+ " : "- ") + Math.abs(S.mod) : "") + " = " + (fin > 0 ? "+" : "") + fin + " → " + (hits ? hits + " hit" + (hits > 1 ? "s" : "") : "miss"));
    // munitions : normal 1, demi 0.5, long 2 ; enrayage : % brut ≥ 85 en long burst, ≥ 98 sinon (10.1)
    sh.ammo = Object.assign({}, sh.ammo);
    const use1 = S.burst === "long" ? 2 : S.burst === "half" ? 0.5 : 1;
    S.use.forEach(g => { sh.ammo[g.id] = Math.max(0, ammoLeft(sh, g) - use1); });
    if (R.r !== 100 && R.r >= (S.burst === "long" ? 85 : 98)) {
      const g = S.use[dieRoll(S.use.length, "gun jam: which group", sh) - 1];
      sh.gunsOut = (sh.gunsOut || []).concat(g.id); L.push("Gun jam (roll " + R.txt + "): " + g.id + " jammed (10.1)");
    }
    L.push("Ammo after the shot: " + a.guns.filter(g => !isDefGun(g)).map(g => g.id + " " + num(ammoLeft(sh, g)) + (gunOut(sh, g) ? " (out)" : "")).join(", "));
    if (hits) applyHits(tg, sh, hits, S.use.map(g => g.crit), { sh, front: S.defl.fin >= 150, rear: S.defl.fin <= 30, on12: S.on12, beam: S.beam, range: S.range, crack: opt.crack, area: opt.area }, L);
    const rec = { turn: state.turn, sh: sh.id, tg: tg.id, text: L.join("\n"), range: S.range, tail: !!opt.tail, ts: S.ts };
    logShot(sh, rec);
    return rec;
  }

  // ---- tir défensif (10.5, Combat Tables page 5) ----
  //  Couverture des armes défensives : codes FW 3.0. Fiche D3A2 « Rear +30, high to low » convertie par le scénario Jolly Rogers :
  //  « 04 - 08 ; 6+ to -6, except 6 line U+ to (1/2)+ (at least 100 feet per ≤ 2 hexes) ».
  const DEF_ARCS = { "d3a2-val": { DG: { from: 4, to: 8, up: 6, down: 6, line6: { up: "U", low: 0.5 }, manual: true } } };
  const VZERO = { 1: 100, 2: 100, 3: 200, 4: 200, 5: 300, 6: 300, 7: 400, 8: 400, 9: 500, U: 600 };
  function defArcOf(p, g) { const A = DEF_ARCS[(adcOf(p) || {}).id]; return A && A[g.id.replace(/-.*/, "")] || null; }
  // facteur selon la ligne d'horloge de la CIBLE par laquelle le tir arrive (Defensive Firepower Strength Modifiers)
  const defMult = b => { if (b === null) return 1 / 2; const x = Math.abs(b); return x < 0.01 ? 1 : x <= 30.01 ? 2 / 3 : x <= 90.01 ? 1 / 2 : x < 149.99 ? 1 / 3 : 1 / 2; };
  const defMultTxt = m => m === 1 ? "full" : m > 0.6 ? "2/3" : m === 0.5 ? "1/2" : "1/3";
  // un avion peut-il tirer avec ses armes défensives ce tour-ci (10.5) ?
  function defFireWhy(p) {
    const mvt = thisMove(p), cls = (adcOf(p) || {}).cls || "F", fmd = /^(F|MF)/.test(cls) || /D/.test(cls), why = [];
    if (!canFire(p)) why.push("out of play");
    if (mvt && mvt.ng) why.push("negative-G this turn");
    if (mvt && mvt.snaps) why.push("snap roll this turn");
    if ((mvt && mvt.anyInv) || isInv(p.bank)) why.push("inverted during the turn");
    if (Math.abs(p.pitch) === 3 && !fmd) why.push("ended in a vertical attitude");
    if (mvt && mvt.ooc) why.push("out of control");
    const r = rateUsed(p), lim = heavy(p) ? 0 : fmd ? 2 : 1;
    if (r > lim) why.push(RATES[r] + " rate used (manual guns: " + RATES[lim] + " at most)");
    return why;
  }
  // un mitrailleur g de l'avion p peut-il tirer sur t ? { ok, why, range, af, mult }
  function defGunOn(p, g, t) {
    const A = defArcOf(p, g), a = adcOf(p), why = [];
    const C = crewSt(p); if (C.length > 1 && C.slice(1).every(s => s === "KIA" || s === "OUT")) why.push("gunner out of action");
    if (gunOut(p, g)) why.push(g.id + " out of action");
    if (ammoLeft(p, g) <= 0) why.push("no ammunition");
    if ((p.reload || {})[g.id] >= state.turn) why.push("reloading until the end of turn " + p.reload[g.id]);
    if (!A) { why.push("no field of fire known for " + g.id); return { ok: false, why }; }
    const b = relBearing(p, t), h = rangeHex(p, t), dAlt = t.alt - p.alt, line6 = b !== null && Math.abs(b) >= 179.99;
    const inH = b === null || Math.abs(b) >= 30 * A.from - 0.01;          // arc arrière symétrique 04 à 08 (lignes comprises)
    if (!inH) why.push("not in the " + pad2(A.from) + " to " + pad2(A.to) + " clock lines (" + clockOf(b) + ")");
    let vOk;
    if (line6 && A.line6) vOk = dAlt >= 100 * Math.ceil(h / 2);            // ligne 6:00 : plus haut seulement, au moins 100 ft par 2 hex
    else vOk = h === 0 ? Math.abs(dAlt) <= VZERO[A.up] : dAlt <= A.up * 100 * h && dAlt >= -A.down * 100 * h;
    if (!vOk) why.push("not in the vertical field of fire (" + (line6 && A.line6 ? "6:00 line: higher only, at least 100 ft per 2 hexes" : A.up + "+ to " + A.down + "− per hex") + "; it is " + Math.abs(dAlt) + " ft " + (dAlt >= 0 ? "higher" : "lower") + ")");
    const range = totalRange(p, t), af = ((a.gunAF[g.id] || [])[range]) || 0;
    if (!af) why.push("range " + range + ": out of range");
    const mult = defMult(relBearing(t, p));
    return { ok: !why.length, why, range, af, mult, fp: Math.round(af * mult * 100) / 100 };
  }
  // tir défensif combiné : gunners = [{ p, g }] ; règles de formation et de portée (8.5.3, 10.5)
  function defOf(target, gunners) {
    const S = { errs: [], warns: [], mods: [], notes: [], tg: target, parts: [] };
    if (!target) { S.errs.push("choose a target"); return S; }
    const ta = adcOf(target); if (!ta) { S.errs.push("no data card for the target"); return S; }
    if ((initOf().unsighted || {})[target.id]) S.errs.push(callsign(target) + " started the turn unsighted (8.1.2)");
    gunners.forEach(({ p, g }) => {
      const w = defFireWhy(p), d = defGunOn(p, g, target);
      if (w.length || !d.ok) S.errs.push(callsign(p) + " " + g.id + ": " + w.concat(d.why).join("; "));
      else S.parts.push(Object.assign({ p, g }, d));
    });
    const planes = [...new Set(S.parts.map(x => x.p))];
    if (!planes.length) { if (!S.errs.length) S.errs.push("no defensive gun selected"); return S; }
    // formations : 2 hors formation, 3 en flexible, 6 en fixe (même formation)
    const I = initOf(), root = p => chainUp(p).slice(-1)[0], sameForm = planes.every(q => root(q) === root(planes[0]));
    const fixed = sameForm && planes.every(q => I.fixed ? I.fixed[q.id] : inFixed(q)), flex = sameForm && !fixed && planes.every(q => formTypeOf(q) === "flexible" && (!leaderOf(q) || formationCheck(q, leaderOf(q)).ok));
    const maxN = fixed ? 6 : flex ? 3 : 2;
    if (planes.length > maxN) S.errs.push(planes.length + " aircraft combining: at most " + maxN + (fixed ? " in the same fixed formation" : flex ? " in the same flexible formation" : " not in the same formation") + " (8.5.3)");
    const near = Math.min(...planes.map(q => totalRange(q, target)));
    S.parts.forEach(x => { if (x.range > near + 1 && planes.length > 1) S.errs.push(callsign(x.p) + ": range " + x.range + " > shortest formation range " + near + " + 1 (10.5)"); });
    // une seule attaque par note de critique (10.5)
    const crits = [...new Set(S.parts.map(x => x.g.crit))]; if (crits.length > 1) S.errs.push("combine only guns with the same critical rating (10.5)");
    const prev = (state.shots || []).filter(s => s.turn === state.turn && s.def && s.tg === target.id && crits.includes(s.crit));
    if (prev.length) S.errs.push(callsign(target) + " already attacked this turn by defensive fire of critical rating " + crits.join(" / ") + " (10.5)");
    S.fp = Math.round(S.parts.reduce((t, x) => t + x.fp, 0) * 100) / 100;
    const byPlane = planes.map(q => ({ q, fp: S.parts.filter(x => x.p === q).reduce((t, x) => t + x.fp, 0), r: totalRange(q, target) })).sort((x, y) => y.fp - x.fp || x.r - y.r);
    const ps = byPlane[0].q; S.prime = ps; S.range = byPlane[0].r;
    S.ds = ta.def; S.odds = oddsOf(S.fp, S.ds);
    const M = (v, t) => { if (v) S.mods.push({ v, t }); };
    universalMods(ps, M);
    const C = crewSt(ps); M(C.slice(1).some(s => s === "WIA") ? 20 : 0, "gunner wounded");
    M(-5 * (ta.size || 0), "target size " + (ta.size > 0 ? "+" : "") + ta.size);
    if (S.odds && S.odds.col >= 3) { const e = S.odds.excess, d = S.ds; M(e >= 2 / 3 * d ? -15 : e >= d / 2 ? -10 : e >= d / 3 ? -5 : 0, "excess firepower " + num(e) + " of " + d); }
    if (S.odds && S.odds.under) M(5 * S.odds.under, "odds under 1-6");
    const r = rateUsed(ps); M(gMod(ps, r), r >= 1 ? RATES[r] + " rate (gunner's aircraft)" : "");
    const D = deflection(ps, target), rel = combSpeed(D.fin, ps.speed, target.speed);
    S.rel = rel; M(rel < 2 ? -10 : Math.max(0, Math.round(2 * (rel - 2))), "relative speed " + fmt1(rel) + (rel < 2 ? " (target hanging)" : ""));
    const tm = thisMove(target); M(tm && tm.jink ? 5 * tm.jink : 0, "target jinks (" + (tm ? tm.jink : 0) + " × 30° at HT+)");
    M((state.shots || []).some(s => s.turn === state.turn && s.sh === target.id && s.tg === ps.id && s.ts) ? -10 : 0, "target used a tracking shot against the prime shooter");
    // tir à fort angle : cible qui s'éloigne en altitude et attitudes à 2 pas ou plus
    const dAlt = target.alt - ps.alt, away = (dAlt > 0 && target.pitch > 0) || (dAlt < 0 && target.pitch < 0) || (target.pitch === 0 && ((dAlt > 0 && ps.pitch < 0) || (dAlt < 0 && ps.pitch > 0)));
    if (away && Math.abs(target.pitch - ps.pitch) >= 2) { const hft = rangeHex(ps, target) * 300, vft = Math.abs(dAlt); M(vft - hft >= 100 ? 20 : 10, "high aspect shot"); }
    S.mod = S.mods.reduce((t, m) => t + m.v, 0);
    if (S.odds) { let col = S.odds.col; if (S.odds.over) { S.mods.push({ v: -10 * S.odds.over, t: "odds over 10-1" }); S.mod -= 10 * S.odds.over; } S.col = clamp(col, 0, 12); }
    const bT = relBearing(target, ps); S.front = bT !== null && Math.abs(bT) <= 30.01; S.rear = bT !== null && Math.abs(bT) >= 149.99; S.on12 = bT !== null && Math.abs(bT) < 0.01;
    S.crit = crits[0];
    return S;
  }
  function defText(S) {
    const L = ["Defensive fire at " + callsign(S.tg) + (S.prime ? " (prime shooter " + callsign(S.prime) + ")" : "")];
    L.push(lineOf(S.tg));
    S.parts.forEach(x => L.push("  " + callsign(x.p) + " " + x.g.id + ": range " + x.range + ", AF " + num(x.af) + " × " + defMultTxt(x.mult) + " = " + num(x.fp)));
    L.push("Attack: " + num(S.fp) + ":" + S.ds + " = " + (S.odds ? ODDS_COLS[S.odds.col] : "–") + " Mods: " + modsTxt(S));
    L.push("Final: " + (S.col !== undefined ? ODDS_COLS[S.col] : "–") + "; " + (S.mod > 0 ? "+" : "") + pad2s(S.mod));
    return L.join("\n");
  }
  function defFire(target, gunners) {
    const S = defOf(target, gunners); if (S.errs.length) return null;
    const ps = S.prime, L = [defText(S)], R = rollLH(ps, "defensive fire % vs " + callsign(target)), fin = R.base + S.mod, hits = hitsAt(fin, S.col);
    L.push("Roll: " + R.txt + " → base LH " + (R.base > 0 ? "+" : "") + R.base + (S.mod ? " " + (S.mod > 0 ? "+ " : "- ") + Math.abs(S.mod) : "") + " = " + (fin > 0 ? "+" : "") + fin + " → " + (hits ? hits + " hit" + (hits > 1 ? "s" : "") : "miss"));
    S.parts.forEach(x => {
      const p = x.p, g = x.g; p.ammo = Object.assign({}, p.ammo); p.ammo[g.id] = Math.max(0, ammoLeft(p, g) - 1);
      // chargeurs « (D x N) » (10.6) : chargeur vide → rechargement D5 tours
      if (g.mags && p.ammo[g.id] > 0 && (g.ammo - p.ammo[g.id]) % g.mags[1] === 0) { const d = Math.ceil(dieRoll(10, "reload time D5 (" + g.id + ")", p) / 2); p.reload = Object.assign({}, p.reload, { [g.id]: state.turn + d }); L.push(callsign(p) + " " + g.id + ": drum empty, reloading " + d + " turn" + (d > 1 ? "s" : "") + " (10.6)"); }
    });
    if (R.r !== 100 && R.r >= 98) { const x = S.parts[dieRoll(S.parts.length, "defensive gun jam: which gun", ps) - 1]; x.p.gunsOut = (x.p.gunsOut || []).concat(x.g.id); x.p.jamDef = Object.assign({}, x.p.jamDef, { [x.g.id]: state.turn }); L.push("Gun jam (roll " + R.txt + "): " + callsign(x.p) + " " + x.g.id + " jammed; recharge D10 ≤ 7 at the end of the turn (10.1)"); }
    if (hits) applyHits(target, ps, hits, [S.crit], { sh: ps, front: S.front, rear: S.rear, on12: S.on12, beam: false, range: S.range, def: true }, L);
    const rec = { turn: state.turn, sh: ps.id, tg: target.id, text: L.join("\n"), range: S.range, def: true, crit: S.crit };
    logShot(ps, rec);
    return rec;
  }

  // ---- fin du tour : feux, fuites, recharge des armes défensives, collisions (3.2, 3.3, 10.1, Combat Tables page 2) ----
  function endChecks() {
    const out = [];
    alive().forEach(p => {
      ["Minor fire", "Major fire", "Fuel fire"].forEach(f => { if (count(p, f) && !(p.fireNew || {})[f + state.turn]) out.push({ kind: "fire", p, f }); });
      const mvt = thisMove(p);
      if ((count(p, "Oil leak") || count(p, "Coolant leak")) && !(mvt && ["cruise", "idle"].includes(mvt.setting))) out.push({ kind: "leak", p, f: "leak" });
      Object.keys(p.jamDef || {}).forEach(g => { if (p.jamDef[g] === state.turn) out.push({ kind: "recharge", p, f: g }); });
    });
    // empilements (3.2) : même position, même altitude ; limites sûres selon la formation et la classe
    const A = alive(), seen = new Set(), I = initOf();
    A.forEach(p => {
      const key = posName(p) + "@" + p.alt; if (seen.has(key)) return; seen.add(key);
      const st = A.filter(q => posName(q) + "@" + q.alt === key); if (st.length < 2) return;
      const enemy = st.some(q => q.side !== st[0].side), FL = st.every(q => ["F", "L"].includes(clsOf(q))), root = q => chainUp(q).slice(-1)[0];
      const sameF = st.every(q => root(q) === root(st[0])), fixed = sameF && st.every(q => I.fixed ? I.fixed[q.id] : inFixed(q));
      const facing = st.length === 2 && Math.min((st[0].head - st[1].head + 12) % 12, (st[1].head - st[0].head + 12) % 12) <= 2;
      const safe = !enemy && (fixed ? st.length <= (FL ? 3 : 2) : FL && st.length <= 2 && (sameF || facing));
      if (safe) return;
      const last = st.slice().sort((x, y) => ((thisMove(y) || {}).seq || 0) - ((thisMove(x) || {}).seq || 0))[0];
      out.push({ kind: "stack", p: last, pool: st.filter(q => q !== last), why: enemy ? "enemy in the stack" : "over the safe stacking limit (" + st.length + ")" });
    });
    (state.shots || []).filter(s => s.turn === state.turn && s.range === 0 && !s.tail && !s.def && !s.jett && !s.aborted).forEach(s => {
      const p = state.planes.find(q => q.id === s.sh), t = state.planes.find(q => q.id === s.tg);
      if (p && !p.status && t) out.push({ kind: "shot0", p, pool: [t], why: "range 0 attack on " + callsign(t) });
    });
    return out;
  }
  function collideDamage(p, q, L) {
    const D = deflection(p, q), ang = D.fin;
    [p, q].forEach(x => {
      const n = ang >= 150 ? 4 : ang >= 60 ? 3 : 2, rolls = Array.from({ length: n }, () => dieRoll(10, "collision damage", x));
      let hits = rolls.reduce((t, v) => t + v, 0); if (n === 2) hits += Math.round(Math.abs(p.speed - q.speed) * 2);
      L.push("  " + callsign(x) + ": " + n + "D10 (" + rolls.join("+") + ")" + (n === 2 ? " + " + Math.round(Math.abs(p.speed - q.speed) * 2) + " for the speed difference" : "") + " = " + hits + " hits (angle " + ang + "°)");
      const ta = adcOf(x); x.hits = (x.hits || 0) + hits; x.hitsLog = (x.hitsLog || []).concat({ turn: state.turn, n: hits, by: "collision" });
      const nc = Math.floor(hits / 3); for (let i = 0; i < nc; i++) applyCrit(x, { sh: null, range: 9 }, L, i + 1);
      if (!x.status && ta && x.hits > ta.dmg[1]) { x.status = "destroyed"; x.killedTurn = state.turn; L.push("  " + callsign(x) + " destroyed (" + x.hits + " hits)"); }
    });
  }
  function doCheck(c) {
    const L = [], p = c.p;
    if (c.kind === "fire") {
      const major = c.f !== "Minor fire", fuel = c.f === "Fuel fire", mvt = thisMove(p) || {};
      const m = fuel ? 0 : (mvt.emer ? -1 : 0) + (c.f === "Minor fire" && count(p, "Smoldering oil") ? -1 : 0) + (mvt.setting === "idle" ? 1 : 0);
      const ms = (c.f === "Minor fire" ? p.speed >= 6 : p.speed >= 8) ? 1 : 0, d = dieRoll(10, c.f.toLowerCase() + " progress", p), r = d + m + ms;
      L.push(callsign(p) + " " + c.f.toLowerCase() + ": D10 " + d + modTxt(m + ms) + " = " + r);
      const drop = f => { const i = p.crits.indexOf(f); if (i >= 0) p.crits.splice(i, 1); };
      if (!major) { if (r <= 2) { drop("Minor fire"); p.crits.push("Major fire"); L.push("  → becomes a major fire"); } else if (r >= 10) { drop("Minor fire"); L.push("  → fire goes out"); } else L.push("  → fire continues"); }
      else {
        if (r <= 2) { L.push("  → the aircraft explodes"); shotDown(p, null, c.f.toLowerCase(), L); }
        else if (r === 3) { L.push("  → one flight controls critical"); critEffect(p, "Flight controls", { sh: null }, L, 0); }
        else if (r <= 5) { const n = ["F", "L"].includes(clsOf(p)) ? 1 : 2; p.hits = (p.hits || 0) + n; L.push("  → " + n + " hit" + (n > 1 ? "s" : "")); const ta = adcOf(p); if (ta && p.hits > ta.dmg[1]) shotDown(p, null, "fire damage", L); }
        else if (r <= 9) L.push("  → fire continues");
        else { drop(c.f); if (!fuel) p.crits.push("Minor fire"); L.push("  → " + (fuel ? "fire goes out (fuel fed fire diminishes)" : "diminishes to a minor fire")); if (fuel) p.crits.push("Major fuel leak"); }
      }
    } else if (c.kind === "leak") {
      const d = dieRoll(10, "extra leakage", p);
      L.push(callsign(p) + " leak check: D10 " + d + (d <= 2 ? " ≤ 2: another leak" : ": no change"));
      if (d <= 2) { const liq = !radial(adcOf(p)); p.crits.push(liq ? "Coolant leak" : "Oil leak"); if ((liq && count(p, "Coolant leak") + count(p, "Oil leak") >= 2) || (!liq && count(p, "Oil leak") >= 3)) { p.crits.push("Engine seizes"); L.push("  → engine seized"); } }
    } else if (c.kind === "recharge") {
      const d = dieRoll(10, "recharge " + c.f, p);
      L.push(callsign(p) + " recharge " + c.f + ": D10 " + d + (d <= 7 ? " ≤ 7: back in action" : ": jammed until landing"));
      if (d <= 7) p.gunsOut = (p.gunsOut || []).filter(g => g !== c.f);
      p.jamDef = Object.assign({}, p.jamDef, { [c.f]: -1 });
    } else {
      // collision (3.3) : % ≥ 85 ; mods : taille la plus grande ×5, qualité du pilote, entrée par l'arrière / l'avant, plus lent
      const pool = c.pool.filter(q => !q.status || q.killedTurn === state.turn), all = [p].concat(pool), M = [];
      const big = Math.max(...all.map(q => (adcOf(q) && adcOf(q).size) || 0)); if (big) M.push([5 * big, "size"]);
      const pq = { Recruit: 10, Green: 5, Veteran: -5 }[p.pq] || 0; if (pq) M.push([pq, p.pq.toLowerCase()]); if (p.hero || p.ace) M.push([-5, "hero / ace"]);
      if (c.kind === "shot0") M.push([5, "range 0 shot"]);
      const t0 = pool[0], b = t0 ? relBearing(t0, p) : null;
      if (b !== null && Math.abs(b) > 90.01) M.push([-5, "entered from aft of the 3 / 9 line"]);
      else if (b !== null && t0) M.push([Math.round(combSpeed(deflection(p, t0).fin, p.speed, t0.speed)), "entered from the front: combined speed"]);
      if (pool.length && pool.every(q => p.speed < q.speed)) M.push([-5, "slower than all others"]);
      const m = M.reduce((t, x) => t + x[0], 0), d = dieRoll(100, "collision check", p), r = d + m;
      L.push(callsign(p) + " collision check (" + c.why + "): % " + pad2(d % 100) + (M.length ? " " + M.map(x => (x[0] > 0 ? "+" : "") + x[0] + " " + x[1]).join(", ") : "") + " = " + r + (r >= 85 ? " ≥ 85: collision" : ": no collision"));
      if (r >= 85 && pool.length) {
        const v = pool.length > 1 ? pool[dieRoll(pool.length, "collision: which aircraft", p) - 1] : pool[0];
        L.push("  → collides with " + callsign(v));
        collideDamage(p, v, L);
      }
    }
    state.checks = (state.checks || []).concat({ turn: state.turn, key: c.kind + ":" + p.id + ":" + (c.f || c.why), text: L.join("\n") });
  }
