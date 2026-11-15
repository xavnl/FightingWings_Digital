  // ================= Onglet Combat : tir aux armes fixes et tir défensif de l'avion sélectionné, tirs du tour, contrôles de fin de tour =================
  const cbOpt = {};                                             // réglages du tir en préparation, par tireur (non gardés)
  const optOf = p => (cbOpt[p.id] = cbOpt[p.id] || {});
  const dfOpt = {};                                             // tir défensif en préparation, par avion
  const crewTxt = p => { const C = crewSt(p), N = crewNames(p); return C.map((s, i) => s ? (N[i] || "crew " + (i + 1)) + " " + s : "").filter(Boolean).join(", "); };
  function renderCombat() {
    const p = selected, o = optOf(p), a = adcOf(p), mvt = thisMove(p);
    $("cbWho").textContent = callsign(p);
    // cibles : ennemis en jeu (ou abattus pendant ce combat), du plus proche au plus loin ; ✓ = dans les champs de tir
    const T = state.planes.filter(q => q.side !== p.side && canFire(q)).map(q => ({ q, S: shotOf(p, Object.assign({}, o, { tgt: q.id, burst: "normal", ts: false })) }))
      .sort((x, y) => (x.S.range === undefined ? 99 : x.S.range) - (y.S.range === undefined ? 99 : y.S.range));
    if (!o.tgt || !T.some(t => t.q.id === o.tgt)) o.tgt = (T.find(t => t.S.hOk && t.S.vOk && t.S.af) || T[0] || { q: {} }).q.id;
    $("cbTgt").innerHTML = T.map(t => '<option value="' + t.q.id + '"' + (t.q.id === o.tgt ? " selected" : "") + ">" + esc(callsign(t.q)) + " — range " + t.S.range +
      (t.S.hOk && t.S.vOk && t.S.af ? " ✓ in the fields of fire" : "") + "</option>").join("") || "<option>(no enemy)</option>";
    // armes fixes
    $("cbGuns").innerHTML = a ? a.guns.filter(g => !isDefGun(g)).map(g => {
      const out = gunOut(p, g), am = ammoLeft(p, g), on = !out && am > 0 && (!o.groups || o.groups.includes(g.id));
      return '<label title="' + esc(g.weapon) + '"><input type="checkbox" data-g="' + g.id + '"' + (on ? " checked" : "") + (out || am <= 0 ? " disabled" : "") + "> " + g.id +
        " <small>" + esc(g.weapon) + " · ammo " + num(am) + (out ? " · OUT" : "") + " · crit " + g.crit + "</small></label>";
    }).join("") || '<small class="note">no fixed gun</small>' : "";
    // le mouvement du tireur ce tour-ci (rempli d'après Maneuver, modifiable ; à régler à la main pour un mouvement sur papier)
    const fof = o.fof !== undefined ? o.fof : (mvt ? mvt.fof : ""), rate = o.rate !== undefined ? +o.rate : (mvt ? mvt.rateMax : -1);
    const slip = o.slip !== undefined ? o.slip : (mvt ? mvt.slip : ""), snaps = o.snaps !== undefined ? +o.snaps : (mvt ? mvt.snaps : 0);
    $("cbFof").value = fof; $("cbRate").value = String(rate < 1 ? -1 : Math.min(3, rate)); $("cbSlip").value = slip; if (document.activeElement !== $("cbSnaps")) $("cbSnaps").value = snaps;
    $("cbMvNote").textContent = mvt ? "From this turn's move (Maneuver tab); change only if needed." : "Not moved with the Maneuver tab this turn (moved on paper?): set these by hand.";
    $("cbOvrRow").hidden = !!mvt; $("cbOvr").checked = !!o.ovr;
    const S = shotOf(p, o);
    $("cbBurst").value = o.burst || "normal"; $("cbTs").checked = !!o.ts; $("cbTail").checked = !!o.tail;
    $("cbLbNote").textContent = S.tg ? (S.paper ? (S.lbOk ? "tracking / long burst allowed (checked on paper)" : "tick « checked on paper » if the move allows a tracking shot or a long burst") :
      "target " + (S.movedBefore ? "moved before you" : "has NOT moved before you") + "; in your horizontal field of fire on " + S.fpIn + " of " + S.fpN + " FPs (2/3 = " + S.fpNeed + "), the last " + S.fpTail + " in a row" +
      (S.lbAmmo ? "" : "; not 2 ammo points in every group (no long burst)")) : "";
    $("cbCrackRow").hidden = !(p.crack && S.range <= 2);
    $("cbArea").hidden = p.crack !== 2;
    const fired = (state.shots || []).some(s => s.turn === state.turn && s.sh === p.id && isFixedShot(s));
    $("cbPreview").textContent = S.tg && S.defl ? shotText(S) : "";
    $("cbErrs").innerHTML = S.errs.map(e => '<p class="warnline">' + esc(e) + "</p>").join("") + S.warns.map(e => '<p class="note warn">' + esc(e) + "</p>").join("") +
      (fired ? '<p class="note">' + esc(callsign(p)) + " has already fired its fixed guns this turn.</p>" : "");
    $("cbFire").disabled = !!S.errs.length || fired;
    $("cbFire").dataset.bad = S.errs.length || fired ? "1" : "";
    // tir déclaré (multijoueur) : résolu par l'arbitre à la Combat Phase
    const dc = p.decl && p.decl.turn === state.turn ? p.decl : null, dt = dc && state.planes.find(q => q.id === dc.tgt);
    const allDecl = state.planes.filter(q => q.decl && q.decl.turn === state.turn && !(state.shots || []).some(s => s.turn === state.turn && s.sh === q.id && isFixedShot(s)));
    $("cbDecl").textContent = (dc ? "Declared: " + callsign(p) + " at " + (dt ? callsign(dt) : "?") + (dc.ts ? ", tracking shot" : "") + (dc.burst && dc.burst !== "normal" ? ", " + dc.burst + " burst" : "") + (dc.groups ? ", guns " + dc.groups.join(" ") : "") + ". " : "") +
      (mpOn() && allDecl.length ? "Declared attacks waiting for the referee: " + allDecl.map(q => callsign(q)).join(", ") + "." : "");
    if (S.col !== undefined && !S.errs.length) {
      const c = hitChance(S.mod, S.col);
      $("cbChance").textContent = c ? "Chance to hit: " + num(c) + " % (" + ODDS_COLS[S.col] + ", LH mods " + (S.mod > 0 ? "+" : "") + S.mod + ")" : "No chance to hit at these odds.";
    } else $("cbChance").textContent = "";
    renderDefFire(); renderStores();
    // tirs du tour, contrôles de fin de tour
    const shots = (state.shots || []).filter(s => s.turn === state.turn);
    $("cbShots").textContent = shots.length ? shots.map(s => s.text).join("\n\n") : "No shot this turn.";
    const done = (state.checks || []).filter(c => c.turn === state.turn), C = endChecks();
    const todo = C.map((c, i) => {
      const key = c.kind + ":" + c.p.id + ":" + (c.f || c.why); if (done.some(x => x.key === key)) return "";
      const what = c.kind === "fire" ? c.f.toLowerCase() + " — D10 fire progress (Combat Tables page 2)" : c.kind === "leak" ? "oil / coolant leak — D10 ≤ 2: another leak" :
        c.kind === "recharge" ? c.f + " jammed — recharge D10 ≤ 7" : "collision check (" + c.why + ") — % ≥ 85 (3.3)";
      return '<p class="note">' + esc(callsign(c.p)) + ": " + esc(what) + ' <button type="button" class="mini" data-chk="' + i + '">Roll</button></p>';
    }).join("");
    $("cbChecks").innerHTML = (todo || '<p class="note">Nothing (more) to check now.</p>') + done.map(d => '<pre class="lines">' + esc(d.text) + "</pre>").join("");
    const hb = p.hits || 0, dm = a && a.dmg, ct = crewTxt(p);
    $("cbState").textContent = "Hits " + hb + (dm ? " (severe above " + dm[0] + ", destroyed above " + dm[1] + ")" : "") + (isSevere(p) ? " — SEVERELY DAMAGED" : "") +
      " · critical hits: " + ((p.crits || []).join(", ") || "none") + (ct ? " · crew: " + ct : "") + (p.status ? " · " + p.status.toUpperCase() : "");
  }
  // ---- tir défensif : armes défensives de l'avion sélectionné et des avions de sa formation ----
  function defGunners(p) {
    const root = q => chainUp(q).slice(-1)[0], mates = alive().filter(q => q.side === p.side && root(q) === root(p));
    return [p].concat(mates.filter(q => q !== p)).flatMap(q => ((adcOf(q) || {}).guns || []).filter(isDefGun).map(g => ({ p: q, g })));
  }
  function renderDefFire() {
    const p = selected, G = defGunners(p), sec = $("cbDefSec");
    sec.hidden = !G.length; if (!G.length) return;
    const o = dfOpt[p.id] = dfOpt[p.id] || {};
    const E = state.planes.filter(q => q.side !== p.side && canFire(q)).sort((x, y) => totalRange(p, x) - totalRange(p, y));
    if (!o.tgt || !E.some(q => q.id === o.tgt)) o.tgt = (E[0] || {}).id;
    const tg = E.find(q => q.id === o.tgt);
    $("cbDTgt").innerHTML = E.map(q => '<option value="' + q.id + '"' + (q.id === o.tgt ? " selected" : "") + ">" + esc(callsign(q)) + " — range " + totalRange(p, q) + "</option>").join("") || "<option>(no enemy)</option>";
    const key = x => x.p.id + ":" + x.g.id;
    if (!o.sel) o.sel = {};
    $("cbDGuns").innerHTML = G.map(x => {
      const d = tg ? defGunOn(x.p, x.g, tg) : { ok: false, why: [] }, w = defFireWhy(x.p), ok = d.ok && !w.length;
      if (o.sel[key(x)] === undefined) o.sel[key(x)] = x.p === p;
      return '<label><input type="checkbox" data-dg="' + key(x) + '"' + (o.sel[key(x)] && ok ? " checked" : "") + (ok ? "" : " disabled") + "> " + esc(callsign(x.p)) + " " + x.g.id +
        " <small>ammo " + num(ammoLeft(x.p, x.g)) + (ok ? " · range " + d.range + ", AF " + num(d.af) + " × " + defMultTxt(d.mult) : " · " + esc(w.concat(d.why).join("; "))) + "</small></label>";
    }).join("");
    const chosen = G.filter(x => o.sel[key(x)] && tg && defGunOn(x.p, x.g, tg).ok && !defFireWhy(x.p).length);
    const S = defOf(tg, chosen);
    $("cbDPreview").textContent = S.parts && S.parts.length ? defText(S) : "";
    $("cbDErrs").innerHTML = (chosen.length ? S.errs : []).map(e => '<p class="warnline">' + esc(e) + "</p>").join("");
    $("cbDFire").disabled = !chosen.length || !!S.errs.length;
    const dd = p.defDecl && p.defDecl.turn === state.turn ? p.defDecl : null, ddt = dd && state.planes.find(q => q.id === dd.tgt);
    $("cbDDecl").textContent = dd ? "Cancel defensive fire" : "Declare defensive fire";
    $("cbDDeclTxt").textContent = dd ? "Declared: defensive fire at " + (ddt ? callsign(ddt) : "?") + " with " + Object.keys(dd.sel || {}).filter(k => dd.sel[k]).map(k => { const q = state.planes.find(x => x.id === k.split(":")[0]); return (q ? callsign(q) : "?") + " " + k.split(":")[1]; }).join(", ") + "." : "";
    $("cbDChance").textContent = S.col !== undefined && !S.errs.length && chosen.length ? "Chance to hit: " + num(hitChance(S.mod, S.col)) + " %" : "";
  }
  // ---- emports : largage (immédiat hors multijoueur ; déclaré en multijoueur, fait par l'arbitre à la Combat Phase) ----
  function renderStores() {
    const p = selected, done = (state.shots || []).find(s => s.turn === state.turn && s.sh === p.id && s.jett), w = jettWhy(p);
    $("cbStoreSec").hidden = !p.bomb && !done;
    $("cbStore").textContent = done ? done.text : callsign(p) + " carries " + p.bomb + (p.load ? " (" + p.load + ")" : "") + (w.length ? " — no jettison now: " + w.join("; ") : "") +
      (p.jettDecl === state.turn ? " — jettison declared for this Combat Phase" : "");
    $("cbJett").disabled = !!w.length;
    $("cbJettDecl").textContent = p.jettDecl === state.turn ? "Cancel jettison" : "Declare jettison";
  }
  $("cbJett").addEventListener("click", () => { const rec = jettison(selected); if (rec) { $("cbResult").textContent = rec.text; refresh(); } });
  $("cbJettDecl").addEventListener("click", () => { const p = selected; p.jettDecl = p.jettDecl === state.turn ? 0 : state.turn; refresh(); });
  $("cbDDecl").addEventListener("click", () => { const p = selected, o = dfOpt[p.id] || {}; p.defDecl = p.defDecl && p.defDecl.turn === state.turn ? null : { turn: state.turn, tgt: o.tgt, sel: Object.assign({}, o.sel) }; refresh(); });
  $("cbDTgt").addEventListener("change", e => { (dfOpt[selected.id] = dfOpt[selected.id] || {}).tgt = e.target.value; refresh(); });
  $("cbDGuns").addEventListener("change", e => { const k = e.target.dataset.dg; if (!k) return; const o = dfOpt[selected.id] = dfOpt[selected.id] || {}; (o.sel = o.sel || {})[k] = e.target.checked; refresh(); });
  $("cbDFire").addEventListener("click", () => {
    const p = selected, o = dfOpt[p.id] || {}, tg = state.planes.find(q => q.id === o.tgt); if (!tg) return;
    const G = defGunners(p).filter(x => (o.sel || {})[x.p.id + ":" + x.g.id] && defGunOn(x.p, x.g, tg).ok && !defFireWhy(x.p).length);
    const rec = defFire(tg, G); if (!rec) return;
    $("cbDResult").textContent = rec.text; refresh();
  });
  $("cbTgt").addEventListener("change", e => { optOf(selected).tgt = e.target.value; refresh(); });
  $("cbGuns").addEventListener("change", e => {
    const a = adcOf(selected), o = optOf(selected), all = a.guns.filter(g => !isDefGun(g));
    o.groups = [...$("cbGuns").querySelectorAll("input[data-g]")].filter(i => i.checked).map(i => i.dataset.g); if (o.groups.length === all.length) delete o.groups;
    refresh();
  });
  [["cbFof", "fof", v => v], ["cbRate", "rate", v => +v], ["cbSlip", "slip", v => v], ["cbCrack", "crack", v => +v], ["cbArea", "area", v => v], ["cbBurst", "burst", v => v]]
    .forEach(([id, k, f]) => $(id).addEventListener("change", e => { optOf(selected)[k] = f(e.target.value); refresh(); }));
  $("cbSnaps").addEventListener("input", e => { optOf(selected).snaps = Math.max(0, Math.round(+e.target.value || 0)); refresh(); });
  [["cbTs", "ts"], ["cbTail", "tail"], ["cbOvr", "ovr"]].forEach(([id, k]) => $(id).addEventListener("change", e => { optOf(selected)[k] = e.target.checked; refresh(); }));
  $("cbFire").addEventListener("click", () => {
    const p = selected, rec = fire(p, optOf(p)); if (!rec) return;
    delete cbOpt[p.id].burst; delete cbOpt[p.id].ts;
    $("cbResult").textContent = rec.text; refresh();
  });
  $("cbDeclare").addEventListener("click", () => { const p = selected; p.decl = Object.assign({}, optOf(p), { turn: state.turn }); refresh(); });
  $("cbUndecl").addEventListener("click", () => { selected.decl = null; refresh(); });
  $("cbChecks").addEventListener("click", e => { const b = e.target.closest("[data-chk]"); if (!b) return; const c = endChecks()[+b.dataset.chk]; if (c) { doCheck(c); refresh(); } });
  $("cbCopy").addEventListener("click", () => copyText($("cbShots").textContent, $("cbCopy"), "Copy the shots"));
