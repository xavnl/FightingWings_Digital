  // ================= Initiative Fighting Wings (8.1, 8.1.1, 8.1.2, 8.5, 13) : jets, tailing, formations, observation, ordre =================

  // ---- géométrie : clock lines, portée totale (3.1.2) ----
  //  Relèvement de q vu de p, par rapport au nez de p, en degrés (−180, 180] ; les clock lines tombent sur les multiples de 30°.
  //  Calculé sur une grille d'hex régulière (la grille de l'image a de petits écarts qui feraient manquer une clock line exacte).
  const idealPt = pos => { const f = h => ({ x: 1.5 * h.c, z: SQ3 * (h.r + ((h.c & 1) ? 0.5 : 0)) }), A = f(pos);
    if (!pos.hex2) return A; const Q = f(pos.hex2); return { x: (A.x + Q.x) / 2, z: (A.z + Q.z) / 2 }; };
  function relBearing(p, q) {
    const A = idealPt(p), Q = idealPt(q), dx = Q.x - A.x, dz = Q.z - A.z;
    if (dx * dx + dz * dz < 1e-6) return null;
    let b = norm360(deg(Math.atan2(dx, -dz)) - screenHead(p)); if (b > 180) b -= 360;
    return Math.round(b * 100) / 100;
  }
  const clockOf = b => b === null ? "–" : (() => { const c = b / 30, k = Math.round(c); const h = ((k % 12) + 12) % 12 || 12;
    return Math.abs(c - k) < 0.01 ? pad2(h) + ":00" : "between " + pad2(((Math.floor(c) % 12) + 12) % 12 || 12) + " and " + pad2(((Math.ceil(c) % 12) + 12) % 12 || 12); })();
  const EPS = 0.01;
  const inFront = b => b !== null && Math.abs(b) <= 30 + EPS;          // clock lines 11 à 01 inclus
  const inRear = b => b !== null && Math.abs(b) >= 150 - EPS;          // clock lines 05 à 07 inclus
  const behind39 = b => b !== null && Math.abs(b) >= 90 - EPS;         // sur ou derrière la ligne 03:00 / 09:00
  // portée verticale (3.1.2) : 300 ft = 1 ; au-delà de 1, 200 ft restants arrondis au-dessus, 100 ft au-dessous ; < 300 ft = 0
  function vertRange(dAlt) { const d = Math.abs(dAlt); if (d < 300) return 0; return Math.floor(d / 300) + (d % 300 >= 200 ? 1 : 0); }
  function totalRange(p, q) {
    const h = rangeHex(p, q), v = vertRange(q.alt - p.alt);
    return Math.max(h, v) + Math.floor(Math.min(h, v) / 2);
  }
  const alive = () => state.planes.filter(p => !p.status);
  const enemies = (p, q) => p.side !== q.side;
  const minSpeedOf = p => perfVal(p, bandOf(p.alt), "min");
  // hors de contrôle (classe U, 8.1) : en vrille, décroché, en compressibilité
  const isOoc = p => { const cs = parseCarry(p.mcarry); return !!cs.spin || !!cs.comp || (minSpeedOf(p) !== null && p.speed < minSpeedOf(p)); };
  const isSpinning = p => !!parseCarry(p.mcarry).spin;
  // classe d'agilité de la fiche (8.1) : « LD » = L (bombardier en piqué), « MF » = M (chasseur), « SH » = H
  const cardCls = p => ((adcOf(p) && adcOf(p).cls) || "F").toUpperCase();
  const clsOf = p => { const c = cardCls(p); return /^SH/.test(c) ? "H" : /^MF/.test(c) ? "M" : c[0] || "F"; };
  const AGI = { U: 0, X: 1, H: 2, M: 3, L: 4, F: 4 };
  const loadRank = p => p.load === "overloaded" ? 2 : p.load === "loaded" ? 1 : 0;

  // ---- formations (8.5) : leader, type (fixe / flexible), paramètres ----
  const planeById = id => state.planes.find(q => q.id === id);
  const leaderOf = p => { const l = p.lead && planeById(p.lead); return l && !l.status && l !== p && l.side === p.side ? l : null; };
  const wingmenOf = l => alive().filter(q => q.lead === l.id && q !== l);
  function chainUp(p) { const out = []; let q = p, seen = new Set(); while (q && !seen.has(q.id)) { seen.add(q.id); out.push(q); q = leaderOf(q); } return out; }
  // type : le premier « form » trouvé en remontant (l'avion lui-même s'il mène des wingmen, puis ses leaders) ; flexible par défaut
  const formTypeOf = p => { const c = chainUp(p); const f = c.find((q, i) => q.form && (i > 0 || wingmenOf(q).length)); return f ? f.form : "flexible"; };
  // paramètres d'un avion par rapport à son leader : wingman (2-1-3 / 6-6-6) ou leader subordonné (3-3-3 / 9-9-9)
  function formationCheck(w, l) {
    const type = formTypeOf(w), sub = wingmenOf(w).length > 0, why = [];
    const h = rangeHex(w, l), same = h === 0, dAlt = Math.abs(w.alt - l.alt), bLW = relBearing(l, w);
    const dHead = Math.min((w.head - l.head + 12) % 12, (l.head - w.head + 12) % 12) * 30;
    const P = type === "fixed" ? (sub ? { h: 3, ft: 300, deg: 30, name: "3-3-3", perHex: true } : { h: 2, ft: 100, deg: 30, name: "2-1-3", stack: true })
      : (sub ? { h: 9, ft: 900, deg: 90, name: "9-9-9", notSame: true } : { h: 6, ft: 600, deg: 60, name: "6-6-6", same: { ft: 300, deg: 30 } });
    if (w.noRadio && type === "flexible" && !sub) Object.assign(P, { h: 3, ft: 300, deg: 30, name: "3-3-3 (no radio)", perHex: true, same: null, noRadio: true });
    if (same) {
      if (P.notSame) why.push("a junior flight leader may not share the squadron leader's hex (8.5.2)");
      else if (P.stack) { if (w.alt !== l.alt || JSON.stringify(w.hex2) !== JSON.stringify(l.hex2)) why.push("same hex: must be stacked with the leader (same position and altitude)"); }
      else if (P.same) { if (dAlt > P.same.ft) why.push("same hex: more than " + P.same.ft + " ft from the leader"); if (dHead > P.same.deg) why.push("same hex: facing more than " + P.same.deg + "° off the leader's"); }
      else { if (dAlt > P.ft) why.push("more than " + P.ft + " ft from the leader"); if (dHead > P.deg) why.push("facing more than " + P.deg + "° off the leader's"); }
    } else {
      if (!behind39(bLW)) why.push("not on or behind the leader's 03:00 / 09:00 line (" + clockOf(bLW) + ")");
      if (h > P.h) why.push("more than " + P.h + " hexes from the leader");
      if (dAlt > P.ft) why.push("more than " + P.ft + " ft from the leader's altitude");
      if (P.perHex && dAlt > 100 * h) why.push("more than 100 ft higher or lower per hex from the leader");
      if (dHead > P.deg) why.push("facing more than " + P.deg + "° off the leader's");
    }
    if (type === "fixed" && (w.fixOut || 0) >= state.turn) why.push("fixed formation limits exceeded: out of formation until the end of turn " + w.fixOut + " (8.5.1)");
    return { ok: !why.length, why, type, name: P.name, sub, noRadio: !!P.noRadio };
  }
  // dans une formation fixe en ce moment (classe X) : membre dans les paramètres de son leader, ou leader d'au moins un membre dans les paramètres
  function inFixed(p, I) {
    const memo = (I && I.fixed) || null; if (memo && memo[p.id] !== undefined) return memo[p.id];
    if (formTypeOf(p) !== "fixed" || (p.fixOut || 0) >= state.turn) return false;
    const l = leaderOf(p);
    if (l && formTypeOf(l) === "fixed") return formationCheck(p, l).ok;
    return wingmenOf(p).some(w => formTypeOf(w) === "fixed" && formationCheck(w, p).ok);
  }

  // ---- observation (8.1.2) : un avion ennemi est vu sauf s'il est dans les angles morts de TOUS les avions adverses ----
  //  angles morts de la fiche : « 6:00 line low », « Rear », « Rear low », « None » ; vue « Poor » : aveugle aussi sur les lignes 05 / 07
  function blindTo(v, q) {
    const a = adcOf(v); if (!a) return false;
    const t = String(a.blind || "").toLowerCase(), b = relBearing(v, q); if (b === null || !t || /none/.test(t)) return false;
    const dAlt = q.alt - v.alt, hft = rangeHex(v, q) * 300, vft = Math.abs(dAlt), inv = isInv(v.bank), poor = /poor/i.test(a.view || "");
    const rear = poor ? inRear(b) : Math.abs(b) > 150 + EPS;              // vue Fair / Good : voit sur les lignes 05 et 07
    const line6 = Math.abs(b) >= 180 - EPS;
    const low = /low/.test(t);
    if (!low) {                                                      // « Rear »
      if (!rear) return false;
      if (v.pitch === 3 && dAlt > 0 && vft - hft >= 100) return false;    // en VC, voit au-dessus
      if (v.pitch === -3 && dAlt < 0 && vft - hft >= 100) return false;   // en VD, voit au-dessous
      return true;
    }
    const inArc = /6:00|six/.test(t) ? line6 : rear;
    if (!inArc) return false;
    if (Math.abs(v.pitch) === 3) {                                   // vertical : table 8.1.2
      const below = v.pitch === 3 ? dAlt < 0 : dAlt > 0;
      if (!below) return false;
      const vGtH = vft > hft;
      return (v.pitch === 3) === !inv ? vGtH : !vGtH;
    }
    return inv ? dAlt > 0 : dAlt < 0;
  }
  const isUnsighted = q => { const V = alive().filter(v => enemies(v, q)); return V.length > 0 && V.every(v => blindTo(v, q)); };

  // ---- tailing (8.1.1) : test simple ou test de déflexion ; renvoie { ok, why[], test } ----
  function tailCheck(t, q) {
    const why = [], b1 = relBearing(t, q), b2 = relBearing(q, t), h = rangeHex(t, q), dAlt = q.alt - t.alt, vft = Math.abs(dAlt), hft = h * 300, tr = totalRange(t, q), en = enemies(t, q);
    if (isOoc(t)) why.push("out-of-control aircraft may not tail (4.5)");
    if (isSpinning(q)) why.push("a spinning aircraft cannot be tailed (4.5.2)");
    if (en && t.pq === "Recruit") why.push("recruits may not tail enemy aircraft (13.1)");
    if (en && t.pq === "Green" && !(b1 !== null && Math.abs(b1) < EPS && b2 !== null && Math.abs(b2) >= 180 - EPS))
      why.push("green pilots tail an enemy only with their 12:00 line on its 6:00 line (13.1)");
    if (inFixed(t, initOf())) why.push("aircraft in fixed formation may not tail (8.1.1)");
    const ct = clsOf(t), cq = clsOf(q);
    if ((ct === "M" || ct === "H") && !/^MF/.test(cardCls(t)) && AGI[cq] > AGI[ct]) why.push("M and H class may not tail a more agile aircraft (8.1.1)");
    if (!en && ["F", "L"].includes(ct) && ["F", "L"].includes(cq) && loadRank(q) < loadRank(t)) why.push("may not tail a friendly F / L aircraft with a lighter load (8.1.1)");
    if (vft - hft >= 100 && t.pitch === 3 && dAlt < 0) why.push("in a vertical climb: may not tail a lower aircraft (8.1.1)");
    if (vft - hft >= 100 && t.pitch === -3 && dAlt > 0) why.push("in a vertical dive: may not tail a higher aircraft (8.1.1)");
    if (h === 0) {                                                   // même hex / côté d'hex (8.1.1)
      const vr = vertRange(dAlt);
      if (t.pitch === -3 && dAlt >= 0) why.push("same hex: in a VD the tailed aircraft must be below");
      if (t.pitch === 3 && dAlt <= 0) why.push("same hex: in a VC the tailed aircraft must be above");
      if (vr > 1 && Math.abs(t.pitch) !== 3) why.push("same hex at vertical range " + vr + ": the tailer must be in a VC or VD");
      if (vr <= 1) {
        const mt = t.mvT && t.mvT.turn === state.turn ? t.mvT : null, mq = q.mvT && q.mvT.turn === state.turn ? q.mvT : null;
        if (!(mt && mq && mt.seq > mq.seq)) why.push("same hex at vertical range ≤ 1: the tailer must have entered the hex after the tailed aircraft this turn");
        if (t.speed > q.speed) why.push("same hex at vertical range ≤ 1: speed " + fmt1(t.speed) + " above the tailed aircraft's " + fmt1(q.speed));
      }
      return { ok: !why.length, why, test: "same hex" };
    }
    const simple = [], defl = [];
    if (!inFront(b1)) { simple.push("not in the front arc (" + clockOf(b1) + ")"); defl.push("not in the front arc"); }
    if (!inRear(b2)) simple.push("not in its rear arc (" + clockOf(b2) + ")");
    if (tr > 8) { simple.push("range " + tr + " > 8"); defl.push("range " + tr + " > 8"); }
    if (q.pitch < 0 && dAlt >= 0) defl.push("the tailed aircraft dives: the tailer must be above");
    if (q.pitch > 0 && dAlt <= 0) defl.push("the tailed aircraft climbs: the tailer must be below");
    const D = typeof deflection === "function" ? deflection(t, q) : null, lim = vft - hft >= 100 ? 60 : 30;
    if (!D || D.fin > lim) defl.push("final deflection " + (D ? D.fin + "°" : "?") + " > " + lim + "°");
    if (t.pitch === 0 && !(hft - vft >= 100)) defl.push("tailer level: the horizontal range must exceed the vertical range by 100 ft");
    const test = !simple.length ? "simple test" : !defl.length ? "deflection test" : "";
    if (!test) why.push("simple test: " + simple.join(", ") + " — deflection test: " + defl.join(", "));
    return { ok: !why.length, why, test };
  }

  // ---- jets et ordre ----
  //  state.init = { turn, rolls: { id: { d, mod, fin, tb: [] } }, sides: { X, H, M, U: { blue, red } }, tails: { id: cible }, follow: { id: bool },
  //                 ooc, unsighted, fixed, inForm : constatés au jet (figés pour le tour) }
  const initOf = () => (state.init && state.init.turn === state.turn) ? state.init : (state.init = { turn: state.turn, rolls: {}, sides: {}, tails: {}, follow: {} });
  const boostOf = side => ((state.boost || {})[side] || 0) >= state.turn ? 2 : 0;      // 8.1 : +2 pendant deux tours après une victoire
  function initMods(p) {
    const L = [];
    if (p.pq === "Recruit") L.push([-4, "recruit"]); if (p.pq === "Green") L.push([-2, "green"]); if (p.pq === "Veteran") L.push([1, "veteran"]);
    if (p.ace) L.push([1, "ace"]); if (p.hero) L.push([1, "hero"]);
    const l = leaderOf(p); if (l && l.hero && formationCheck(p, l).ok) L.push([1, "hero leader"]);
    if (isSevere(p)) L.push([-1, "severely damaged"]);
    if ((p.crits || []).some(c => /oil on canopy/i.test(c))) L.push([-2, "oil on canopy"]);
    const lost = state.planes.filter(q => q.side === p.side && q.status && (q.hero || q.ace)).reduce((t, q) => t + (q.hero ? 1 : 0) + (q.ace ? 1 : 0), 0);
    if (lost) L.push([-lost, "own hero / ace shot down"]);
    if (boostOf(p.side)) L.push([2, "enemy shot down"]);
    if (p.noRadio && !(l && formationCheck(p, l).ok)) {               // 8.5.2 : sans radio, plus de la moitié des ennemis dans l'angle mort
      const E = alive().filter(q => enemies(p, q)), blind = E.filter(q => blindTo(p, q)).length;
      if (E.length && blind > Math.ceil(E.length / 2)) L.push([p.pq === "Veteran" || p.ace || p.hero ? -1 : -2, "no radio, enemies in blind arc"]);
    }
    return L;
  }
  function rollInitiative() {
    const I = initOf(); I.rolls = {}; I.sides = {};
    // état au début du tour, figé : hors de contrôle, non repéré, formations
    I.ooc = {}; I.unsighted = {}; I.fixed = {}; I.inForm = {};
    alive().forEach(p => { I.ooc[p.id] = isOoc(p); I.unsighted[p.id] = isUnsighted(p); });
    alive().forEach(p => { I.fixed[p.id] = inFixed(p); const l = leaderOf(p); I.inForm[p.id] = !!(l && formationCheck(p, l).ok); });
    alive().forEach(p => {
      const d = dieRoll(10, "initiative", p), mods = initMods(p), mod = mods.reduce((t, m) => t + m[0], 0);
      I.rolls[p.id] = { d, mod, fin: d + mod, tb: [] };
    });
    // égalités : D10 sans modificateur, autant qu'il faut (8.1)
    const key = id => [I.rolls[id].fin].concat(I.rolls[id].tb).join(",");
    for (let guard = 0; guard < 20; guard++) {
      const groups = {}; Object.keys(I.rolls).forEach(id => { (groups[key(id)] = groups[key(id)] || []).push(id); });
      const ties = Object.values(groups).filter(g => g.length > 1); if (!ties.length) break;
      ties.forEach(g => g.forEach(id => I.rolls[id].tb.push(dieRoll(10, "initiative tie-break", planeById(id)))));
    }
    // classes X, H, M et avions U des deux camps : un D10 par camp, le plus bas déplace d'abord (8.1)
    const groupOf = p => I.fixed[p.id] ? "X" : clsOf(p);
    ["X", "H", "M", "U"].forEach(c => {
      const has = sd => alive().some(p => p.side === sd && (c === "U" ? I.ooc[p.id] : groupOf(p) === c));
      const sides = Object.keys(SIDES).filter(has);
      if (sides.length < 2) return;
      const r = {}; do { sides.forEach(sd => { r[sd] = dieRoll(10, "class " + c + " side roll (" + SIDES[sd].name + ")"); }); } while (r.blue === r.red);
      I.sides[c] = r;
    });
    refresh();
  }
  const cmpRoll = I => (a, b) => { const A = I.rolls[a.id], B = I.rolls[b.id]; if (!A || !B) return 0; const x = [A.fin].concat(A.tb), y = [B.fin].concat(B.tb);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  // Ordre (8.1) : X (formations fixes, camp par camp), H, M, puis F / L par charge (surchargés, L chargés, le reste), non repérés en dernier ;
  //  dans chaque groupe, U d'abord ; suiveurs (tailing, membres de formation fixe, wingmen flexibles « follow ») juste après celui qu'ils suivent
  function orderOf() {
    const I = initOf(); if (!Object.keys(I.rolls).length) return null;
    const L = alive().filter(p => I.rolls[p.id]), cmp = cmpRoll(I), follows = {};
    const fixed = p => I.fixed ? !!I.fixed[p.id] : inFixed(p), uns = p => I.unsighted ? !!I.unsighted[p.id] : isUnsighted(p), isO = p => I.ooc ? !!I.ooc[p.id] : isOoc(p);
    const radioUsed = {};
    L.forEach(p => {
      const t = I.tails[p.id] && L.find(q => q.id === I.tails[p.id]);
      if (t && t !== p) { follows[p.id] = { to: t.id, why: "tails " + callsign(t) + " (8.1.1)" }; return; }
      const l = leaderOf(p); if (!l || !L.includes(l)) return;
      if (fixed(p) && fixed(l)) { follows[p.id] = { to: l.id, why: "fixed formation, " + callsign(l) }; return; }
      const fc = formationCheck(p, l), inF = I.inForm ? !!I.inForm[p.id] : fc.ok;
      if (!inF || fc.type !== "flexible" || I.follow[p.id] === false || cmp(l, p) <= 0) return;
      if (fc.sub) {                                                   // radio : un seul leader subordonné par camp et par tour (8.5.2)
        if (l.noRadio || p.noRadio) return;
        if (radioUsed[p.side]) return; radioUsed[p.side] = p.id;
      }
      follows[p.id] = { to: l.id, why: (fc.sub ? "junior leader, radio initiative from " : "wingman of ") + callsign(l) };
    });
    // pas de boucle (A suit B qui suit A) : la dernière déclaration est ignorée
    Object.keys(follows).forEach(id => { const seen = new Set([id]); let k = follows[id].to; while (follows[k]) { if (seen.has(k)) { delete follows[id]; break; } seen.add(k); k = follows[k].to; } });
    const free = L.filter(p => !follows[p.id]);
    const sideOrder = c => { const S = I.sides[c]; return S ? Object.keys(S).sort((a, b) => S[a] - S[b]) : Object.keys(SIDES); };
    const withU = P => { const U = P.filter(isO), R = P.filter(p => !isO(p)); const sU = sideOrder("U"); return sU.flatMap(s => U.filter(p => p.side === s).sort(cmp)).concat(R.sort(cmp)); };
    const groups = [];
    const X = free.filter(fixed);
    groups.push(["X", sideOrder("X").flatMap(s => withU(X.filter(p => p.side === s)))]);
    const rest = free.filter(p => !fixed(p)), seen = rest.filter(p => !uns(p)), hidden = rest.filter(uns);
    ["H", "M"].forEach(c => groups.push([c, sideOrder(c).flatMap(s => withU(seen.filter(p => p.side === s && clsOf(p) === c)))]));
    const FL = seen.filter(p => ["F", "L"].includes(clsOf(p)) || !["H", "M"].includes(clsOf(p)));
    groups.push(["F / L overloaded", withU(FL.filter(p => p.load === "overloaded"))]);
    groups.push(["L loaded", withU(FL.filter(p => p.load === "loaded" && clsOf(p) === "L"))]);
    groups.push(["F / L", withU(FL.filter(p => p.load !== "overloaded" && !(p.load === "loaded" && clsOf(p) === "L")))]);
    groups.push(["unsighted", withU(hidden)]);
    const out = [], grp = {};
    // ordre de rang (8.5.2) : le leader, ses wingmen (et les avions qui le suivent en tailing), puis les leaders subordonnés et leurs wingmen
    const rankKey = q => wingmenOf(q).length && leaderOf(q) && follows[q.id] && follows[q.id].to === (leaderOf(q) || {}).id ? 1 : 0;
    const put = (p, g) => { out.push(p); grp[p.id] = g; L.filter(q => follows[q.id] && follows[q.id].to === p.id).sort((a, b) => rankKey(a) - rankKey(b) || cmp(a, b)).forEach(q => put(q, g)); };
    groups.forEach(([g, P]) => P.forEach(p => put(p, g)));
    return { list: out, follows, isO, grp, fixed, uns };
  }
  // fixed formation : limites (8.5.1) — appelé par le moteur de mouvement (05d) pour avertir
  function fixedLimits(p, R) {
    const why = [], cls = clsOf(p), maxRate = cls === "H" || cls === "M" ? 0 : 1;
    if (R.rateMax > maxRate) why.push("rate above " + (maxRate ? "TT" : "EZ"));
    if (R.snaps || R.slipKind === "skid" || (R.trans && R.trans.e.rv) || R.ngTrans || (R.lines || []).some(x => ["ngturn", "rv", "free", "skid", "skidturn", "snapL", "snapR"].includes(x.act))) why.push("maneuver other than a slip");
    if (Math.abs(R.endPitch) > 1 || Math.abs(p.pitch) > 1 || isInv(R.endBank) || isInv(p.bank)) why.push("attitude other than upright level or shallow");
    return why;
  }
  function renderInit() {
    const I = initOf(), O = orderOf(), A = alive();
    $("inTurn").textContent = "Game turn " + state.turn + (state.scen.len ? " / " + state.scen.len : "");
    ["blue", "red"].forEach(sd => { const el = $("inBoost-" + sd); if (document.activeElement !== el) el.value = (state.boost || {})[sd] || ""; });
    // déclarations : tailing et formations
    $("inDecl").innerHTML = A.map(p => {
      const tl = I.tails[p.id] ? planeById(I.tails[p.id]) : null, chk = tl ? tailCheck(p, tl) : null;
      const opts = '<option value="">—</option>' + A.filter(q => q !== p).map(q => {
        const c = tailCheck(p, q); return '<option value="' + q.id + '"' + (tl === q ? " selected" : "") + ">" + esc(callsign(q)) + (c.ok ? " ✓" : "") + "</option>"; }).join("");
      const ld = leaderOf(p), fc = ld ? formationCheck(p, ld) : null, wm = wingmenOf(p).length;
      const tags = (isOoc(p) ? ' <small class="neg">U: out of control</small>' : "") + (isUnsighted(p) ? ' <small class="neg">unsighted</small>' : "") + (p.load ? " <small>" + p.load + "</small>" : "");
      const fTxt = ld ? esc(callsign(ld)) + " · " + fc.type + " " + fc.name + (fc.ok ? ' <span class="ok">in formation</span>' + (fc.type === "flexible" ? ' <label><input type="checkbox" data-follow="' + p.id + '"' + (I.follow[p.id] !== false ? " checked" : "") + "> follow</label>" : "")
        : '<br><small class="neg">' + fc.why.map(esc).join("; ") + "</small>" + (fc.type === "fixed" && p.bomb && !isSevere(p) ? '<br><small class="neg">scenario: bombers keep their fixed formation unless damaged or after jettisoning their bombs</small>' : "")) : wm ? "leads " + wm + " · " + formTypeOf(p) : "—";
      return '<tr><td>' + dotHtml(p) + esc(callsign(p)) + tags + "</td><td>" + esc(cardCls(p)) + (inFixed(p, I) ? " → X" : "") + "</td><td>" + esc(p.pq) + (p.ace ? " ace" : "") + (p.hero ? " hero" : "") +
        '</td><td><select data-tail="' + p.id + '">' + opts + "</select>" + (chk ? (chk.ok ? ' <span class="ok">OK, ' + chk.test + "</span>" : '<br><small class="neg">' + chk.why.map(esc).join("; ") + "</small>") : "") +
        "</td><td>" + fTxt + "</td></tr>";
    }).join("");
    // jets et ordre
    $("inRoll").textContent = Object.keys(I.rolls).length ? "Roll again" : "Roll initiative";
    if (!O) { $("inOrder").innerHTML = '<tr><td colspan="6" class="note">Not rolled yet for this turn.</td></tr>'; $("inSides").textContent = ""; return; }
    $("inOrder").innerHTML = O.list.map((p, i) => {
      const r = I.rolls[p.id], mods = initMods(p);
      return "<tr" + (p === selected ? ' class="row sel"' : ' class="row"') + ' data-id="' + p.id + '"><td>' + (i + 1) + "</td><td>" + dotHtml(p) + esc(callsign(p)) + "</td><td>" + esc(O.grp[p.id]) + (O.isO(p) ? " · U" : "") +
        "</td><td>" + r.d + (mods.length ? " " + mods.map(m => (m[0] > 0 ? "+" : "") + m[0] + " " + m[1]).join(", ") : "") + " = <b>" + r.fin + "</b>" + (r.tb.length ? " <small>tie-break " + r.tb.join(", ") + "</small>" : "") +
        "</td><td>" + (O.follows[p.id] ? esc(O.follows[p.id].why) : O.isO(p) ? "out of control: first in its class (8.1)" : O.uns(p) ? "unsighted: moves last (8.1.2)" : "") + "</td><td>" + (p.moved === state.turn ? "✓ moved" : "") + "</td></tr>";
    }).join("");
    $("inSides").textContent = Object.keys(I.sides).map(c => "Class " + c + ": " + Object.keys(I.sides[c]).map(s => SIDES[s].name + " " + I.sides[c][s]).join(", ") + " (lower moves first)").join(" · ");
  }
  $("inRoll").addEventListener("click", rollInitiative);
  $("inDecl").addEventListener("change", e => {
    const I = initOf();
    if (e.target.dataset.tail) { if (e.target.value) I.tails[e.target.dataset.tail] = e.target.value; else delete I.tails[e.target.dataset.tail]; }
    if (e.target.dataset.follow) I.follow[e.target.dataset.follow] = e.target.checked;
    refresh();
  });
  $("inOrder").addEventListener("click", e => { const tr = e.target.closest("tr[data-id]"); if (tr) select(planeById(tr.dataset.id)); });
  ["blue", "red"].forEach(sd => $("inBoost-" + sd).addEventListener("input", e => {
    const v = Math.round(+e.target.value || 0); state.boost = Object.assign({}, state.boost, { [sd]: v > 0 ? v : 0 }); refresh();
  }));
