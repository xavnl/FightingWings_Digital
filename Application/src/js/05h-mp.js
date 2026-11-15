  // ================= Multijoueur PBEM (arbitre + joueurs ; repris de Warbirds Digital, simplifié pour Tiger Wings) =================
  //  Déroulé d'un tour :
  //   DEC (joueurs : déclarations d'initiative de leurs avions — tailing 8.4, wingman qui suit son leader 8.5 — renvoyées à
  //        l'arbitre dans un fichier d'ORDRES) → arbitre : import des ordres, « Roll initiative » →
  //   MPH (le fichier de partie passe de joueur en joueur dans l'ordre de mouvement ; chaque joueur joue son avion (Maneuver ›
  //        Apply end of turn) et peut déclarer son tir (Combat › Declare attack), puis « Done: pass to next aircraft ») →
  //   END (arbitre : Combat Phase — « Request combat orders » si besoin (→ CPO), « Resolve declared attacks », contrôles de fin
  //        de tour, « Next game turn » → DEC du tour suivant) ;
  //   CPO (joueurs : confirment, changent ou ajoutent le tir de leurs avions, renvoient leurs ordres) → arbitre : import, résolution → END.
  //  Sauvegarde : envoyer / garder le fichier de partie à la fin de chaque phase (règle de l'utilisateur dans Warbirds).
  const MP_ME_KEY = "fwd-me:" + PAGE_DIR;
  const STEPS = { DEC: "Initiative declarations — players", MPH: "Movement Phase", END: "Combat Phase — referee", CPO: "Combat orders — players" };
  const ORD_NAME = { DEC: "declarations", CPO: "combat orders" };
  function mpOf() {                                       // complète l'objet EN PLACE (toujours la même référence)
    if (!state.mp) state.mp = {};
    const d = { on: false, players: [], referee: "", gid: "g" + Date.now(), step: "DEC", got: {}, order: [], idx: 0, sent: "" };
    Object.keys(d).forEach(k => { if (state.mp[k] === undefined) state.mp[k] = d[k]; });
    return state.mp;
  }
  const mpOn = () => !!(state.mp && state.mp.on);
  function meName() { try { return localStorage.getItem(MP_ME_KEY) || ""; } catch (e) { return ""; } }
  const isRef = () => !mpOn() || meName() === state.mp.referee;
  const ownsP = p => !mpOn() || isRef() || p.owner === meName();
  const players = () => mpOf().players.filter(Boolean);
  const curMover = () => { const M = mpOf(); return M.step === "MPH" ? state.planes.find(p => p.id === M.order[M.idx]) : null; };
  function download(obj, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" }));
    a.download = name.replace(/[\\\/:*?"<>|]+/g, " "); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const scenName = () => state.scen.name || "FW game";
  function sendGame(to) {
    download(Object.assign({ app: "Fighting Wings Digital", exported: new Date().toISOString() }, gameData()),
      scenName() + " - GT" + state.turn + " - " + mpOf().step + " - to " + (to || "players") + ".json");
    $("gmMsg").textContent = "Game file saved to your downloads: send it" + (to ? " to " + to : "") + ".";
  }
  // ---- ordres d'un joueur (ses avions seulement) : déclarations d'initiative ou tirs déclarés ----
  function ordersData() {
    const M = mpOf(), me = meName(), I = initOf(), planes = {};
    state.planes.filter(p => p.owner === me && !p.status).forEach(p => {
      planes[p.id] = M.step === "DEC" ? { tail: I.tails[p.id] || "", follow: I.follow[p.id] !== false } :
        { decl: p.decl && p.decl.turn === state.turn ? p.decl : null, defDecl: p.defDecl && p.defDecl.turn === state.turn ? p.defDecl : null, jett: p.jettDecl === state.turn };
    });
    return { app: "Fighting Wings Digital orders", gid: M.gid, turn: state.turn, step: M.step, player: me, planes };
  }
  function sendOrders() {
    const M = mpOf(), me = meName();
    download(ordersData(), scenName() + " - GT" + state.turn + " - " + ORD_NAME[M.step] + " - " + me + ".json");
    M.sent = M.step + state.turn; save(); renderMP();
  }
  function importOrders(o) {
    const M = mpOf(), I = initOf();
    if (!o || o.app !== "Fighting Wings Digital orders") return "not an orders file";
    if (o.gid !== M.gid) return "orders from another game";
    if (o.turn !== state.turn || o.step !== M.step) return "orders for GT" + o.turn + " " + o.step + " (now GT" + state.turn + " " + M.step + ")";
    let n = 0;
    Object.keys(o.planes || {}).forEach(id => {
      const p = state.planes.find(x => x.id === id), d = o.planes[id];
      if (!p || p.owner !== o.player) return;                   // un joueur ne donne d'ordres qu'à ses avions
      n++;
      if (o.step === "DEC") { if (d.tail) I.tails[id] = d.tail; else delete I.tails[id]; I.follow[id] = d.follow !== false; }
      else {                                                      // tir déjà résolu : pas touché
        if (!(state.shots || []).some(s => s.turn === state.turn && s.sh === id && isFixedShot(s))) p.decl = d.decl || null;
        if (!(state.shots || []).some(s => s.turn === state.turn && s.sh === id && s.def)) p.defDecl = d.defDecl || null;
        if (!(state.shots || []).some(s => s.turn === state.turn && s.sh === id && s.jett)) p.jettDecl = d.jett ? state.turn : 0;
      }
    });
    M.got[o.player] = true;
    return o.player + ": orders for " + n + " aircraft merged";
  }
  function mpAdvance(step) { const M = mpOf(); M.step = step; M.got = {}; M.sent = ""; }
  function passMover() {
    const M = mpOf(), cur = curMover(); if (!cur) return;
    M.idx++;
    while (M.idx < M.order.length && (() => { const p = state.planes.find(x => x.id === M.order[M.idx]); return !p || p.status; })()) M.idx++;
    if (M.idx >= M.order.length) { mpAdvance("END"); sendGame(M.referee + " (referee)"); return; }
    const nx = curMover();
    if (nx.owner !== cur.owner) sendGame(nx.owner || M.referee);   // même joueur : pas de changement de fichier
  }
  // ---- tirs déclarés (Combat › Declare attack) : résolus par l'arbitre, dans l'ordre de mouvement ----
  const declaredAttacks = () => state.planes.filter(p => p.decl && p.decl.turn === state.turn && canFire(p) && !(state.shots || []).some(s => s.turn === state.turn && s.sh === p.id && isFixedShot(s)));
  const declaredDef = () => state.planes.filter(p => p.defDecl && p.defDecl.turn === state.turn && canFire(p));
  const declaredJett = () => state.planes.filter(p => p.jettDecl === state.turn && !p.status && p.bomb);
  function resolveDeclared() {
    const O = orderOf(), ord = O ? O.list : state.planes, msgs = [];
    // 8.3 : tir défensif d'abord, puis tirs air-air, puis largages
    declaredDef().sort((a, b) => ord.indexOf(a) - ord.indexOf(b)).forEach(p => {
      const d = p.defDecl, tg = state.planes.find(q => q.id === d.tgt);
      const G = tg ? defGunners(p).filter(x => (d.sel || {})[x.p.id + ":" + x.g.id] && defGunOn(x.p, x.g, tg).ok && !defFireWhy(x.p).length) : [];
      const S = defOf(tg, G); p.defDecl = null;
      if (!G.length || S.errs.length) { msgs.push(callsign(p) + ": no defensive fire (" + (S.errs[0] || "no gun can fire") + ")"); return; }
      defFire(tg, G); msgs.push(callsign(p) + ": defensive fire at " + callsign(tg));
    });
    declaredAttacks().sort((a, b) => ord.indexOf(a) - ord.indexOf(b)).forEach(p => {
      const S = shotOf(p, p.decl);
      if (S.errs.length) { msgs.push(callsign(p) + ": no attack (" + S.errs[0] + ")"); p.decl = null; return; }
      fire(p, p.decl); p.decl = null; msgs.push(callsign(p) + " fired");
    });
    declaredJett().forEach(p => { const r = jettison(p); msgs.push(callsign(p) + (r ? " jettisons its stores" : ": no jettison (" + jettWhy(p).join("; ") + ")")); p.jettDecl = 0; });
    return msgs.length ? msgs : ["No declared attack to resolve."];
  }

  // ---- barre multijoueur (sous les onglets) ----
  function renderMP() {
    const bar = $("mpBar"), M = mpOf();
    bar.hidden = !M.on;
    if (!M.on) return;
    const me = meName(), ref = isRef(), step = M.step, mover = curMover();
    let h = '<div class="mpline"><b>GT ' + state.turn + " · " + STEPS[step] + "</b> · this copy: " + (me ? esc(me) + (ref ? " (referee)" : "") : '<span class="warn">choose who plays this copy (Game tab)</span>') + "</div>";
    const btn = (id, t) => '<button type="button" data-mp="' + id + '">' + t + "</button>";
    const wait = players().filter(n => n !== M.referee && !M.got[n] && state.planes.some(p => p.owner === n && !p.status));
    const acts = [];
    if (step === "DEC" || step === "CPO") {
      const what = step === "DEC" ? "declare tailing and formations for your aircraft (Initiative tab)" : "declare, change or cancel the attacks of your aircraft (Combat tab: fixed guns, defensive fire, jettison)";
      h += '<div class="mpline">' + (ref ? "Orders received from: " + (Object.keys(M.got).map(esc).join(", ") || "nobody yet") + (wait.length ? ' · <span class="warn">waiting for ' + wait.map(esc).join(", ") + "</span>" : "") :
        what[0].toUpperCase() + what.slice(1) + ", then send your orders to the referee." + (M.sent === step + state.turn ? ' <span class="ok">Orders sent.</span>' : "")) + "</div>";
      if (ref) acts.push(btn("orders", "Import orders…"), step === "DEC" ? btn("init", "Roll initiative and start the moves") : btn("cbres", "Resolve declared attacks"), btn("send", "Send game file to players"));
      else acts.push(btn("myorders", "Send my orders"));
    }
    if (step === "MPH") {
      h += '<div class="mpline mporder">' + M.order.map((id, i) => { const p = state.planes.find(x => x.id === id); return p ? '<span class="mpchip' + (i === M.idx ? " cur" : i < M.idx ? " done" : "") + '">' + esc(callsign(p)) + " <small>" + esc(p.owner || "") + "</small></span>" : ""; }).join('<span class="mpsep">›</span>') + "</div>";
      if (mover) {
        const mine = ref || mover.owner === me;
        h += '<div class="mpline">Moving: <b>' + esc(callsign(mover)) + "</b> (" + esc(mover.owner || "?") + ")" + (mine ? " — plot the move (Maneuver › Apply end of turn), declare its attack if you wish (Combat tab), then pass on: the game file goes to the next player." : " — waiting.") + "</div>";
        if (mine) acts.push(btn("mv", "Maneuver tab"), btn("pass", "Done: pass to next aircraft"));
      }
    }
    if (step === "END") {
      const nd = declaredAttacks().length + declaredDef().length + declaredJett().length;
      h += '<div class="mpline">' + (ref ? "Combat Phase: request the players' combat orders if needed, resolve the declared attacks" + (nd ? " (" + nd + " to resolve)" : "") + ", roll the end of turn checks (Combat tab), then start the next game turn." : "Waiting for the referee (Combat Phase, end of turn).") + "</div>";
      if (ref) acts.push(btn("cpo", "Request combat orders"), btn("cbres", "Resolve declared attacks"), btn("cbtab", "Combat tab"), btn("next", "Next game turn"));
    }
    acts.push(btn("import", "Import game file…"));
    bar.innerHTML = h + '<div class="actions">' + acts.join("") + "</div>";
  }
  let mpMsg = "";
  $("mpBar").addEventListener("click", e => {
    const k = e.target.dataset.mp; if (!k) return;
    const M = mpOf();
    if (k === "send") sendGame("players");
    if (k === "orders") $("mpOrdersFile").click();
    if (k === "myorders") sendOrders();
    if (k === "init") {
      rollInitiative(); const O = orderOf(); M.order = O ? O.list.map(p => p.id) : []; M.idx = 0; mpAdvance("MPH");
      const first = curMover(); sendGame(first ? first.owner || M.referee : "players"); if (first) select(first);
    }
    if (k === "pass") passMover();
    if (k === "mv") showTab("mv");
    if (k === "cpo") { mpAdvance("CPO"); sendGame("players"); }
    if (k === "cbres") { mpMsg = resolveDeclared().join("\n"); if (M.step === "CPO") mpAdvance("END"); showTab("cb"); $("cbResult").textContent = mpMsg; }
    if (k === "cbtab") showTab("cb");
    if (k === "next") { state.turn++; state.planes.forEach(q => { q.undo = null; }); mpAdvance("DEC"); sendGame("players"); }
    if (k === "import") $("gmFile").click();
    refresh();
  });
  $("mpOrdersFile").addEventListener("change", e => {
    const fs = [...e.target.files]; e.target.value = "";
    Promise.all(fs.map(f => f.text().then(t => { try { return importOrders(JSON.parse(t)); } catch (err) { return f.name + ": unreadable"; } })))
      .then(msgs => { $("gmMsg").textContent = msgs.join(" · "); alert(msgs.join("\n")); refresh(); });
  });

  // ---- réglages (onglet Game) ----
  function renderMPSetup() {
    const M = mpOf(), me = meName();
    $("mpOn").checked = M.on;
    $("mpSetup").hidden = !M.on;
    if (document.activeElement !== $("mpPlayers")) $("mpPlayers").value = M.players.join(", ");
    const opts = cur => '<option value="">—</option>' + players().map(n => "<option" + (n === cur ? " selected" : "") + ">" + esc(n) + "</option>").join("");
    $("mpRef").innerHTML = opts(M.referee); $("mpMe").innerHTML = opts(me);
    $("mpOwners").innerHTML = bySide(state.planes).map(p => "<label>" + dotHtml(p) + esc(callsign(p)) + ' <select data-own="' + p.id + '">' + opts(p.owner) + "</select></label>").join("");
  }
  $("mpOn").addEventListener("change", e => { mpOf().on = e.target.checked; refresh(); });
  $("mpPlayers").addEventListener("change", e => { mpOf().players = e.target.value.split(",").map(s => s.trim()).filter(Boolean); refresh(); });
  $("mpRef").addEventListener("change", e => { mpOf().referee = e.target.value; refresh(); });
  $("mpMe").addEventListener("change", e => { try { localStorage.setItem(MP_ME_KEY, e.target.value); } catch (err) {} refresh(); });
  $("mpOwners").addEventListener("change", e => { const id = e.target.dataset.own; if (!id) return; state.planes.find(p => p.id === id).owner = e.target.value; refresh(); });

  // ---- verrous : un joueur ne touche qu'à ses avions, à son tour ; les boutons de l'arbitre sont cachés ----
  function applyLocks() {
    const lock = mpOn() && !isRef(), p = selected, mine = ownsP(p), mover = curMover(), M = mpOf();
    ["inRoll", "addPlane", "delPlane", "mvNextTurn", "gmPrev", "gmNext", "gmScenGo", "gmNew", "cbFire", "cbDFire", "cbJett", "sStatus"].forEach(id => { $(id).hidden = lock; });
    $("inDecl").querySelectorAll("select, input").forEach(el => {
      const id = el.dataset.tail || el.dataset.follow, q = id && state.planes.find(x => x.id === id);
      if (lock && q && (q.owner !== meName() || M.step !== "DEC")) el.disabled = true;
    });
    // mouvement : à l'étape MPH, seulement l'avion dont c'est le tour (le joueur qui le pilote, ou l'arbitre)
    const canMove = !mpOn() || (isRef() ? true : (M.step === "MPH" && mover === p && mine));
    $("pfApply").disabled = $("pfApply").disabled || !canMove;
    $("tab-mv").querySelectorAll("#mvLines input, #mvLines select, #mvLines button, .mvtop select, #mvAdd, #mvClear, #mvOoc button").forEach(el => { el.disabled = !canMove; });
    // combat : un joueur DÉCLARE le tir de ses avions (pendant son mouvement ou à l'étape CPO) ; l'arbitre tire
    const canDecl = mpOn() && mine && (isRef() || (M.step === "MPH" && mover === p) || M.step === "CPO");
    $("cbDeclare").hidden = !mpOn(); $("cbDeclare").disabled = !canDecl || !!$("cbFire").dataset.bad;
    $("cbUndecl").hidden = !(mpOn() && p.decl && p.decl.turn === state.turn); $("cbUndecl").disabled = !canDecl;
    $("cbDDecl").hidden = !mpOn(); $("cbDDecl").disabled = !canDecl;
    $("cbJettDecl").hidden = !mpOn() || !p.bomb; $("cbJettDecl").disabled = !canDecl;
    $("cbDGuns").querySelectorAll("input").forEach(el => { if (!mine) el.disabled = true; }); $("cbDTgt").disabled = !mine;
    $("tab-cb").querySelectorAll("#cbTgt, #cbFof, #cbRate, #cbSlip, #cbSnaps, #cbTs, #cbBurst, #cbOvr, #cbTail, #cbCrack, #cbArea").forEach(el => { el.disabled = !mine; });
    if (!mine) $("cbGuns").querySelectorAll("input").forEach(el => { el.disabled = true; });
    $("sLine").disabled = lock && !mine;
  }
