  // ================= Onglet Maneuver : le tour de l'avion sélectionné (règles FW 3.5 à 7.0) =================
  //  En haut : puissance, transition (FATT), changement d'altitude optionnel (OC), fin du mouvement ; au milieu : les lignes
  //  (HFPs, VFPs, action) ; en bas : accel / decel, ligne de fin, « Apply end of turn » (barre collée en bas du panneau).
  const ACTS = [["fly", "Fly straight"], ["rollL", "Roll left"], ["rollR", "Roll right"], ["snapL", "Snap roll left"], ["snapR", "Snap roll right"],
    ["turn", "Turn (bank side)"], ["ngturn", "NG turn (away from bank)"], ["slipL", "Slip left (set-up)"], ["slipR", "Slip right (set-up)"],
    ["skid", "Skid (set-up)"], ["skidturn", "Skid with facing (set-up)"], ["exec", "Execute slip / skid"], ["rv", "Reversal (FATT « RV », 0 FP)"],
    ["free", "Free facing (6.6, 0 FP)"]];
  let lastR = null;
  const opt = (v, t, sel, dis) => '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? " selected" : "") + (dis ? " disabled" : "") + ">" + esc(t) + "</option>";
  const isVertEnd = R => R && (R.endAtt === 3 || R.endAtt === 9);
  function facOpts(L, R) {
    if (L.act === "turn" || L.act === "ngturn") return [[0, "no facing (extend)"], [1, "30°"], [2, "60°"], [3, "90°"]];
    if (L.act === "rv") return [[5, "150° (banked)"], [4, "120° (banked)"], [6, "180° (LV / IV)"]];
    if (L.act === "exec") return [[1, "with facing change (skid)"], [0, "no facing change"]];
    if (/^(roll|snap)/.test(L.act || "") && isVertEnd(R)) return [[0, "no vertical roll facing"], [1, "VR 30°"], [2, "VR 60°"], [3, "VR 90°"]];
    return null;
  }
  function lineRow(L, i, R) {
    const fo = facOpts(L, R), vr = /^(roll|snap)/.test(L.act || "") && isVertEnd(R);
    const rates = L.act === "ngturn" ? RATES.slice(0, 4) : RATES;
    return '<tr data-i="' + i + '"><td>' + (i + 1) + '</td><td><input data-k="h" type="number" min="0" step="1" value="' + (L.h || 0) + '"></td>' +
      '<td><input data-k="v" type="number" min="0" step="1" value="' + (L.v || 0) + '"></td>' +
      '<td><select data-k="act">' + ACTS.map(([v, t]) => opt(v, t, L.act || "fly")).join("") + "</select>" +
      (L.act === "turn" || L.act === "ngturn" ? ' <select data-k="rate">' + rates.map(r => opt(r, (L.act === "ngturn" ? "NG " : "") + r, L.rate || "EZ")).join("") + "</select>" : "") + "</td>" +
      "<td>" + (fo ? '<select data-k="fac">' + fo.map(([v, t]) => opt(v, t, L.fac === undefined ? fo[0][0] : L.fac)).join("") + "</select>" : "") +
      (vr ? ' <select data-k="keep">' + opt("", "keep new bank", L.keep || "") + opt("back", "back to old bank", L.keep || "") + "</select>" : "") + "</td>" +
      '<td class="mvtxt" data-txt></td><td><button type="button" class="mini" data-del="' + i + '" title="Remove this line">✕</button></td></tr>';
  }
  const ruleTxt = (R) => {
    const r = R.rule || { vLo: 0, vHi: 0 };
    return (r.vLo === r.vHi ? r.vLo + " VFP" + (r.vLo === 1 ? "" : "s") : r.vLo + " to " + r.vHi + " VFPs") + (R.vDir > 0 ? " up" : R.vDir < 0 ? " down" : "") +
      (r.first && r.first.n ? ", first " + r.first.n + " FP" + (r.first.n > 1 ? "s" : "") + " as " + (r.first.type === "H" ? "HFPs" : "VFPs") : "");
  };
  function renderMv() {
    const p = selected, mv = planOf(p), R = simulate(p), a = adcOf(p);
    lastR = R;
    $("mvTurn").textContent = "Game turn " + state.turn + (state.scen.len ? " / " + state.scen.len : "") + " · moved " +
      alive().filter(q => q.moved === state.turn).length + " / " + alive().length;
    $("mvStart").textContent = lineOf(p);
    const sp = R.s, info = [];
    info.push("<b>" + R.fps + " FP" + (R.fps > 1 ? "s" : "") + "</b> to play (speed " + fmt1(sp) + (p.half ? ", half FP carried" : "") + ")" + (p.load ? " · " + p.load : ""));
    info.push("band <b>" + R.band + "</b> · max attainable " + (R.maxL === null || R.maxL === undefined ? "–" : fmt1(R.maxL)) + " · adj. min " + (R.minS === null || R.minS === undefined ? "–" : fmt1(R.minS)) +
      " · safe dive " + (R.maxD === null || R.maxD === undefined ? "–" : fmt1(R.maxD)));
    if (!R.spin) info.push("attitude <b>" + attLabel(R.sPos, R.sInv) + "</b>" + (R.trans ? " → <b>" + esc(attLabel(R.trans.endPos, invSide(R.trans.endPos) || ((R.trans.endPos === 3 || R.trans.endPos === 9) && R.sInv !== !!R.trans.e.rv))) + "</b>" : "") +
      ": " + ruleTxt(R) + (R.mc ? " · MC " + (R.mc > 0 ? "+" : "−") + Math.abs(R.mc) + " ft" : "") + (R.pureV ? " · pure vertical flight" : ""));
    if (a && !R.spin) info.push("banking FPs " + bankNeed(p, sp, "L") + (a.bankFPsR ? " L / " + bankNeed(p, sp, "R") + " R" : "") + " · side slip FPs " + slipNeed(p, sp) +
      " · turns" + (R.chartS !== sp ? " (as speed " + fmt1(R.chartS) + ": " + R.steepBonus + ")" : "") + " " + RATES.map(r => { const E = chartEntry(R.chartS, r), m = r === "EZ" ? 0 : perfVal(p, R.band, r); return r + " " + (!E || m === null || sp < m ? "–" : E.txt); }).join(", "));
    const cs = parseCarry(p.mcarry);
    if (cs.turn || cs.roll || cs.slip) info.push("carried: " + carryText(Object.assign({}, cs, { notes: [], idle: false, ng: 0, dd: 0, comp: 0, gloc: 0 })));
    $("mvInfo").innerHTML = info.join("<br>");
    // puissance (4.1) : Military (> 1/3 à toute), Emergency, Cruise (0 à 1/3), Idle
    const pm = R.pmax === null || R.pmax === undefined ? 0 : R.pmax, third = R.cruiseMax || 0;
    const pw = [opt("max", "Military, max (" + num(pm) + ")", mv.power)];
    if (R.pemer !== null && R.pemer !== undefined) pw.push(opt("emer", "Emergency (" + num(R.pemer) + ")", mv.power));
    for (let v = pm - 0.5; v > third + 1e-9; v -= 0.5) pw.push(opt(String(v), "Military " + num(v), mv.power));
    for (let v = third; v >= 0; v -= 0.5) pw.push(opt(String(v), "Cruise " + num(v), mv.power));
    pw.push(opt("idle", "Idle (speed −0.5)", mv.power));
    $("mvPower").innerHTML = pw.join("");
    // transitions (FATT) depuis l'attitude de départ
    const tr = [opt("keep", "None (stay " + attLabel(R.sPos || 0, R.sInv) + ")", mv.trans || "keep")];
    ["pull", "push"].forEach(d => {
      const L = (R.opts || []).filter(o => o.dir === d);
      if (L.length) tr.push('<optgroup label="' + (d === "pull" ? "Pull (FATT 1, nose up)" : "Push (FATT 2, nose down)") + '">' + L.map(o =>
        opt(o.id, (d === "pull" ? "Pull " : "Push ") + o.e.label + " → " + attLabel(o.endPos, invSide(o.endPos) || ((o.endPos === 3 || o.endPos === 9) && R.sInv !== !!o.e.rv)) + ": " + o.e.code + (o.ok ? "" : " — " + o.why), mv.trans, !o.ok && mv.trans !== o.id)).join("") + "</optgroup>");
    });
    $("mvPitch").innerHTML = tr.join("");
    $("mvPitch").disabled = !!(R.stall || R.spin || R.comp || R.recovered);
    // OC (6.1.3)
    const ocs = []; for (let v = R.ocUp || 0; v >= -(R.ocDn || 0); v -= 100) ocs.push(v);
    $("mvOc").innerHTML = ocs.map(v => opt(String(v), v ? (v > 0 ? "+" : "−") + Math.abs(v) + " ft" : "None", String(R.ocForced ? -(R.ocDn || 0) : (mv.oc || 0)))).join("");
    $("mvOc").disabled = !!R.ocForced;
    const ends = [["", "None"], ["or180", "Optional reverse 180° (LV / IV)"], ["or150", "Optional reverse 150° (banked)"], ["or120", "Optional reverse 120° (banked)"], ["fh", "Free HFP (pure vertical)"]];
    $("mvEndM").innerHTML = ends.map(([v, t]) => opt(v, t, mv.freeH ? "fh" : (mv.end || ""))).join("");
    // réglages en plus : correction après virage NG / inversé, aérofreins, attitude de sortie de vrille
    const ex = [];
    if (R.fixNeed) ex.push('<label title="5.5, 5.9">After ' + esc(R.fixNeed) + ' <select data-x="fix">' + opt("nose", "nose one step toward the earth", mv.fix || "nose") + opt("alt", "lose 100 ft per 30°", mv.fix || "nose") + "</select></label>");
    if (a && /dive brakes/i.test(a.notes || "")) ex.push('<label title="4.2: 5 to 10 decel, declared at the start of the move">Dive brakes <select data-x="brakes">' +
      [0, 5, 6, 7, 8, 9, 10].map(v => opt(String(v), v ? v + " decel" : "closed", String(mv.brakes || 0))).join("") + "</select></label>");
    if (cs.spin) ex.push('<label title="4.5.2">On spin recovery <select data-x="rec">' + opt("STD", "steep dive", mv.rec || "STD") + opt("VD", "vertical dive", mv.rec || "STD") + "</select></label>");
    $("mvExtra").innerHTML = ex.join(""); $("mvExtra").hidden = !ex.length;
    // lignes : refaites seulement si leur nombre ou leurs actions changent (sinon la saisie en cours garde le curseur)
    const sig = mv.lines.map(L => (L.act || "fly") + (L.rate || "")).join("|") + (isVertEnd(R) ? "v" : "");
    const tb = $("mvLines");
    if (tb.dataset.sig !== sig || tb.dataset.pid !== p.id) { tb.innerHTML = mv.lines.map((L, i) => lineRow(L, i, R)).join(""); tb.dataset.sig = sig; tb.dataset.pid = p.id; }
    Array.from(tb.rows).forEach((tr2, i) => {
      const x = R.lines[i], L = mv.lines[i];
      tr2.querySelectorAll("input[data-k]").forEach(inp => { if (document.activeElement !== inp) inp.value = L[inp.dataset.k] || 0; });
      tr2.querySelector("[data-txt]").innerHTML = x ? esc(x.note) + x.errs.map(e => '<span class="neg"><br>' + esc(e) + "</span>").join("") : "";
    });
    const autoMove = !!(R.stall || R.spin || R.comp);
    $("mvNoLines").hidden = mv.lines.length > 0 || autoMove;
    // décrochage / vrille / piqué dangereux / compressibilité : jets au percentile, mouvement joué par la page
    const btn = (id, t) => '<button type="button" data-ooc="' + id + '">' + t + "</button>";
    const M = (L) => modTxt(modsSum(L)) + modsTxt2(L);
    const oo = [];
    if (p.status) oo.push('<p class="warnline">' + esc(callsign(p)) + " is " + p.status + ": removed from play.</p>");
    if (R.oocNeed === "stall" && !mv.ooc) oo.push('<p class="warnline">Start speed below the adjusted minimum: stall, % dice' + esc(M(stallMods(p, mv, cs, false))) + " (≥ 60: spin, 4.5).</p>" + btn("stall", "Stall / spin check (%)"));
    if (R.oocNeed === "recover" && !mv.ooc) oo.push('<p class="warnline">Spinning: spin recovery, % dice' + esc(M(stallMods(p, mv, cs, true))) + " (≤ 50: recovered, 4.5.2). Choose the power first.</p>" + btn("recover", "Spin recovery (%)"));
    if (R.ddNeed && !mv.dd) oo.push('<p class="warnline">Start speed above the adjusted safe dive speed: % dice' + esc(M(R.ddMods || [])) + " (≥ 95: destroyed, 4.7).</p>" + btn("dd", "Dangerous dive (%)"));
    if (R.compNeed && !mv.comp) oo.push('<p class="warnline">' + (R.compNeed === "recover" ? "Compressibility: recovery, % dice" : "Transonic above the max level speed: compressibility, % dice") + esc(M(R.compMods || [])) +
      (R.compNeed === "recover" ? " (≤ 50: recovered, 4.7)" : " (≥ 60: loss of control, 4.7)") + ".</p>" + btn("comp", "Compressibility (%)"));
    $("mvOoc").innerHTML = oo.join("");
    $("mvLinesWrap").hidden = autoMove;
    $("mvAuto").hidden = !autoMove;
    $("mvAuto").innerHTML = autoMove ? '<p class="note">' + (R.spin ? "Spin move: no FPs, the page turns and drops the aircraft (4.5.2)." : esc(R.transTxt || "") +
      " — the page flies the move: max diving VFPs first, then HFPs; no turns, rolls or maneuvers.") + "</p>" + '<pre class="lines">' + esc(R.lines.map(x => x.note).join("\n")) + "</pre>" : "";
    // messages, accel / decel
    $("mvMsgs").innerHTML = R.errs.map(e => '<p class="warnline">' + esc(e) + "</p>").join("") + R.warns.map(e => '<p class="note warn">' + esc(e) + "</p>").join("") +
      R.notes.map(e => '<p class="note">' + esc(e) + "</p>").join("");
    const row = (x, s) => "<tr><td>" + s + num(x.v) + "</td><td>" + x.k + "</td><td>" + esc(x.t) + "</td></tr>";
    $("mvAD").innerHTML = R.acc.map(x => row(x, "+")).join("") + R.dec.map(x => row(x, "−")).join("") +
      '<tr><td colspan="3"><b>' + esc(formula(R)) + "</b></td></tr>";
    if (p.moved === state.turn) $("pfEnd").innerHTML = esc(lineOf(p)) + "<small>moved this game turn (Undo apply to change it; Next game turn to plan the next move)</small>";
    else $("pfEnd").innerHTML = esc(endLineOf(p, R)) + "<small>" + (R.errs.length ? R.errs.length + " problem" + (R.errs.length > 1 ? "s" : "") + " to fix before applying" : "speed " + fmt1(R.s) + " → " + fmt1(R.end) + ", altitude " + altName(p.alt) + " → " + altName(R.endAlt)) + "</small>";
    $("pfApply").disabled = !!R.errs.length || p.moved === state.turn || !!p.status;
    $("pfApply").textContent = p.moved === state.turn ? "Moved this turn" : "Apply end of turn";
    $("pfUndo").disabled = !p.undo;
  }
  // ---- saisie ----
  function mvChanged() { refresh(); }
  $("mvPower").addEventListener("change", e => { planOf(selected).power = e.target.value; mvChanged(); });
  $("mvPitch").addEventListener("change", e => { planOf(selected).trans = e.target.value; mvChanged(); });
  $("mvOc").addEventListener("change", e => { planOf(selected).oc = +e.target.value; mvChanged(); });
  $("mvEndM").addEventListener("change", e => { const mv = planOf(selected); mv.freeH = e.target.value === "fh"; mv.end = mv.freeH ? "" : e.target.value; mvChanged(); });
  $("mvExtra").addEventListener("change", e => { const k = e.target.dataset.x; if (!k) return; planOf(selected)[k] = k === "brakes" ? +e.target.value : e.target.value; mvChanged(); });
  $("mvLines").addEventListener("input", e => {
    const tr = e.target.closest("tr[data-i]"), k = e.target.dataset.k; if (!tr || !k || e.target.tagName !== "INPUT") return;
    planOf(selected).lines[+tr.dataset.i][k] = Math.max(0, Math.round(+e.target.value || 0)); mvChanged();
  });
  $("mvLines").addEventListener("change", e => {
    const tr = e.target.closest("tr[data-i]"), k = e.target.dataset.k; if (!tr || !k || e.target.tagName !== "SELECT") return;
    const L = planOf(selected).lines[+tr.dataset.i];
    L[k] = k === "fac" ? +e.target.value : e.target.value;
    if (k === "act") {
      delete L.fac; delete L.keep;
      if ((L.act === "turn" || L.act === "ngturn") && !L.rate) L.rate = "EZ";
      if (L.act === "ngturn" && L.rate === "ET") L.rate = "BT";
      if (L.act === "turn" || L.act === "ngturn") L.fac = 1;
      if (L.act === "rv") { L.h = 0; L.v = 0; L.fac = selected.bank && selected.bank !== 3 ? 5 : 6; }
      if (L.act === "free") { L.h = 0; L.v = 0; }
      if (L.act === "exec") { L.h = 1; L.v = 0; L.fac = 1; }
    }
    mvChanged();
  });
  $("mvLines").addEventListener("click", e => { const b = e.target.closest("[data-del]"); if (!b) return; planOf(selected).lines.splice(+b.dataset.del, 1); mvChanged(); });
  // nouvelle ligne : les FPs qui restent ; la première ligne reçoit les HFPs et les VFPs les plus bas permis
  $("mvAdd").addEventListener("click", () => {
    const mv = planOf(selected), R = lastR || simulate(selected);
    const usedH = mv.lines.reduce((t, L) => t + (+L.h || 0), 0), usedV = mv.lines.reduce((t, L) => t + (+L.v || 0), 0);
    const left = Math.max(0, R.fps - usedH - usedV);
    let h, v;
    if (!mv.lines.length) { v = Math.min(left, R.vLo || 0); h = left - v; }
    else { h = Math.min(1, Math.max(0, R.hMax - usedH)); v = h ? 0 : Math.min(1, left); }
    mv.lines.push({ h: Math.max(0, h), v: Math.max(0, v), act: "fly" }); mvChanged();
  });
  // « Clear » garde les jets déjà faits (décrochage, vrille, piqué dangereux, compressibilité)
  $("mvClear").addEventListener("click", () => { const o = planOf(selected); selected.mv = Object.assign(defaultPlan(selected), { ooc: o.ooc, dd: o.dd, comp: o.comp, power: o.power, rec: o.rec }); mvChanged(); });
  $("mvOoc").addEventListener("click", e => {
    const k = e.target.dataset.ooc, p = selected, mv = planOf(p), cs = parseCarry(p.mcarry); if (!k) return;
    const spinRolls = o => Object.assign(o, { fac: dieRoll(10, "spin facing changes (4.5.2)", p), fall: dieRoll(10, "spin altitude loss D5 (4.5.2)", p) });
    if (k === "stall" && !mv.ooc) {
      const d = dieRoll(100, "stall into spin check (4.5)", p), mod = modsSum(stallMods(p, mv, cs, false));
      if (d + mod >= 60) { const dr = dieRoll(10, "spin direction (odd left, even right)", p); mv.ooc = spinRolls({ kind: "spin", d, mod, dirRoll: dr, dir: dr % 2 ? "L" : "R" }); }
      else mv.ooc = { kind: "stall", d, mod, bankRoll: dieRoll(10, "stall bank change (4.5.1)", p) };
    }
    if (k === "recover" && !mv.ooc) {
      const d = dieRoll(100, "spin recovery (4.5.2)", p), mod = modsSum(stallMods(p, mv, cs, true));
      mv.ooc = d + mod <= 50 ? { kind: "recover", d, mod } : spinRolls({ kind: "spin", d, mod });
    }
    if (k === "dd" && !mv.dd) {
      const R = lastR || simulate(p), d = dieRoll(100, "dangerous dive (4.7)", p), mod = modsSum(R.ddMods || []);
      mv.dd = { d, mod, destroyed: d + mod >= 95 };
    }
    if (k === "comp" && !mv.comp) {
      const R = lastR || simulate(p), d = dieRoll(100, cs.comp ? "compressibility recovery (4.7)" : "compressibility (4.7)", p), mod = modsSum(R.compMods || []);
      mv.comp = { d, mod, yes: cs.comp ? d + mod > 50 : d + mod >= 60 };
    }
    mvChanged();
  });

  // ---- fin du tour de l'avion : position, vitesse, reports ; contrôles d'overstress et de black / red out ; Log et trace ; Undo ----
  const UNDO_KEYS = ["c", "r", "hex2", "head", "alt", "speed", "half", "acc", "pitch", "bank", "mcarry", "mv", "logs", "trail", "moved", "status", "crits", "mvT", "lastV", "fixOut", "form"];
  function applyMove() {
    const p = selected, R = simulate(p); if (R.errs.length || p.moved === state.turn || p.status) return;
    p.undo = JSON.stringify(UNDO_KEYS.reduce((o, k) => (o[k] = p[k] === undefined ? null : p[k], o), {}));
    let text = logText(p, R), carry = R.carry;
    // overstress (5.6) : % ≥ 95 → D10 (−2 par longeron, +2 par queue déjà touchés) ≤ 7 longeron, ≥ 8 structure de queue
    if (R.osN && !R.destroyed) {
      const M = [], add = (v, t) => { if (v) M.push({ v, t }); };
      add(5 * Math.max(0, R.osN - 1), "facings and steps at overstress rates beyond the first");
      add(10 * (sparHits(p) + tailHits(p)), "wing spar / tail structure hits");
      if (isSevere(p)) add(20, "severe damage");
      const d = dieRoll(100, "overstress check (5.6)", p), mod = modsSum(M), res = d + mod;
      let t = "Overstress check: % " + d + modTxt(mod) + modsTxt2(M) + " = " + res;
      if (res >= 95) {
        const d2 = dieRoll(10, "overstress damage (5.6)", p), m2 = 2 * tailHits(p) - 2 * sparHits(p), hit = d2 + m2 <= 7 ? "Wing spar" : "Tail structure";
        p.crits = (p.crits || []).concat(hit);
        t += " ≥ 95: damage, D10 " + d2 + modTxt(m2) + " = " + (d2 + m2) + ": " + hit.toLowerCase() + " hit";
        if (count(p, hit) >= 2) { R.destroyed = true; t += " — second " + hit.toLowerCase() + " hit: aircraft destroyed"; }
      } else t += ": no damage";
      text += "\n" + t;
    }
    // black out / red out (5.7) : % ≥ 95 par membre d'équipage ; 1 + D5 tours (red out : 2 tours)
    if (R.glocN && !R.destroyed) {
      const M = [], add = (v, t) => { if (v) M.push({ v, t }); };
      if (p.wia) add(20, "crewman wounded");
      add(2 * Math.max(0, R.glocN - 1), "facings and steps at GLOC rates beyond the first");
      let worst = 0; const parts = [];
      for (let c = 0; c < crewOf(p); c++) {
        const d = dieRoll(100, (R.redOut ? "red-out" : "black-out") + " check, crewman " + (c + 1) + " (5.7)", p), res = d + modsSum(M);
        if (res >= 95) { const n = R.redOut ? 2 : 1 + Math.ceil(dieRoll(10, "black-out duration D5 (5.7)", p) / 2); worst = Math.max(worst, n); parts.push("crewman " + (c + 1) + ": % " + res + " ≥ 95, out " + n + " turns"); }
        else parts.push("crewman " + (c + 1) + ": % " + res + ", no effect");
      }
      text += "\n" + (R.redOut ? "Red-out" : "Black-out") + " check" + modsTxt2(M) + ": " + parts.join("; ");
      if (worst) { const cs = parseCarry(carry); cs.gloc = Math.max(cs.gloc || 0, worst); carry = carryText(cs); }
    }
    if (R.fixViol) { p.fixOut = state.turn + 1; if (wingmenOf(p).length) p.form = "flexible"; text += "\nFixed formation limits exceeded (" + R.fixViol.join(", ") + "): out of formation (8.5.1)"; }
    if (R.oilStarve) { p.crits = (p.crits || []).concat("Power loss"); text += "\nOil starvation: one step power loss critical hit (3.6)"; }
    p.logs = (p.logs || []).filter(x => x.turn !== state.turn).concat({ turn: state.turn, text });
    p.trail = (p.trail || []).filter(e => e.turn !== state.turn && e.turn > state.turn - 3).concat({ turn: state.turn, pts: R.track.map(q => ({ c: q.c, r: q.r, hex2: q.hex2, alt: q.alt })) });
    // VFPs joués (exception VFP de la transition suivante, 6.1.4) ; pas d'exception après un reversal, un décrochage, une sortie de vrille ou une correction NG
    const noExc = (R.trans && R.trans.e.rv) || R.stall || R.recovered || R.fixNeed || R.spin;
    Object.assign(p, { c: R.endPos.c, r: R.endPos.r, hex2: R.endPos.hex2, head: R.endHead, alt: R.endAlt, speed: R.end, half: R.newHalf, acc: R.rem,
      pitch: R.endPitch, bank: R.endBank, mcarry: carry, mv: null, moved: state.turn, lastV: noExc ? null : R.vTot });
    if (R.destroyed) p.status = "destroyed"; else if (R.crash) p.status = "crashed";
    // ce que le combat doit savoir du mouvement : un point par FP (cap, virage en cours), rythme le plus haut, snap rolls,
    //  slip / skid, ET, NG, arc de fin, rang d'arrivée (le dernier entré dans un hex est décalé en arrière)
    state.seq = (state.seq || 0) + 1;
    p.mvT = { turn: state.turn, seq: state.seq, fps: R.fps, rateMax: R.rateMax, snaps: R.snaps, slip: R.slipKind, et: !!R.et, ng: !!R.ng, fof: R.fofDir || "", setting: R.setting || "", emer: R.setting === "emer", anyInv: !!R.anyInv,
      jink: (R.gUse || []).filter(u => RATES.indexOf(u.rate) >= 2).reduce((t, u) => t + u.n, 0),
      ooc: !!(R.stall || R.spin || R.comp), pts: R.track.filter(q => q.fp).map(q => ({ c: q.c, r: q.r, hex2: q.hex2, alt: q.alt, head: q.head, trn: q.trn || "" })),
      before: state.planes.filter(q => q !== p && q.moved === state.turn).map(q => q.id) };
    const O = orderOf(), next = O && O.list.find(q => q.moved !== state.turn && !q.status);
    if (next) select(next); else { refresh(); centerOn(p); }
  }
  function undoMove() {
    const p = selected; if (!p.undo) return;
    const u = JSON.parse(p.undo); UNDO_KEYS.forEach(k => { p[k] = u[k] === null && k !== "hex2" && k !== "lastV" && k !== "form" ? undefined : u[k]; });
    if (!p.logs) p.logs = []; if (!p.trail) p.trail = [];
    p.undo = null; refresh(); centerOn(p);
  }
  $("pfApply").addEventListener("click", applyMove);
  $("pfUndo").addEventListener("click", undoMove);
  $("mvNextTurn").addEventListener("click", () => {
    const left = alive().filter(q => q.moved !== state.turn).length;
    if (left && !$("mvNextTurn").dataset.armed) { $("mvNextTurn").dataset.armed = "1"; $("mvNextTurn").textContent = left + " not moved: click again"; setTimeout(() => { delete $("mvNextTurn").dataset.armed; $("mvNextTurn").textContent = "Next game turn"; }, 6000); return; }
    delete $("mvNextTurn").dataset.armed; $("mvNextTurn").textContent = "Next game turn";
    state.turn++; state.planes.forEach(q => { q.undo = null; }); refresh();
  });
