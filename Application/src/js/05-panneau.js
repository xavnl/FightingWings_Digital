  // ================= Panneau =================
  const TABS = ["init", "mv", "cb", "log", "adc", "scen", "acft", "game", "map"];
  let currentTab = "acft";
  try { if (TABS.includes(localStorage.getItem("fwd-tab"))) currentTab = localStorage.getItem("fwd-tab"); } catch (e) {}
  function showTab(t) {
    currentTab = t;
    TABS.forEach(k => { $("tab-" + k).hidden = k !== t; $("tabbtn-" + k).setAttribute("aria-selected", String(k === t)); });
    // largeur carte / panneau selon l'onglet (comme Warbirds Digital) : Map 80/20 ; ADC, Aircraft, Game : panneau sur toute la largeur
    const app = document.querySelector(".app");
    app.classList.toggle("mapmode", t === "map");
    app.classList.toggle("full", ["adc", "acft", "game", "log"].includes(t));
    app.classList.toggle("split", t === "init" || t === "cb");                                // Initiative : carte 40 % (positions pour le tailing)
    app.classList.toggle("mv30", t === "mv");                                    // Maneuver : carte 30 %, panneau 70 % (comme Warbirds)
    document.querySelector(".acbar").hidden = t === "game" || t === "acft" || t === "scen";
    $("endBar").hidden = t !== "mv";
    requestAnimationFrame(resize);
    $("mapHint").textContent = "Click: select" + (t === "map" ? " · double-click a hex: place the selected aircraft" : "") + " · drag: orbit · right-drag: pan · wheel: zoom (Shift + wheel: fine zoom)";
    try { localStorage.setItem("fwd-tab", t); } catch (e) {}
    renderWho();
  }
  TABS.forEach(k => $("tabbtn-" + k).addEventListener("click", () => showTab(k)));
  const renderWho = () => { $("who").textContent = ["acft", "game", "scen"].includes(currentTab) ? "" : lineOf(selected); };
  const bySide = L => Object.keys(SIDES).flatMap(sd => L.filter(p => p.side === sd));   // listes d'avions : Blue puis Red
  const dotHtml = q => '<span class="dot" style="background:' + SIDES[q.side].color + '"></span>';

  function renderPanel() {
    const p = selected;
    if (document.activeElement !== $("sName")) $("sName").value = p.name;
    $("sAdc").value = p.adc || "";
    $("sCtr").value = p.ctr || "";
    $("sVar").checked = p.var;
    $("sLead").innerHTML = '<option value="">— none —</option>' + state.planes.filter(q => q !== p && q.side === p.side).map(q => '<option value="' + q.id + '"' + (q.id === p.lead ? " selected" : "") + ">" + esc(callsign(q)) + "</option>").join("");
    $("sForm").value = selected.form || ""; $("sNoRadio").checked = !!selected.noRadio;
    $("sCrits").textContent = "hits " + (p.hits || 0) + (isSevere(p) ? " (severe)" : "") + " · " + ((p.crits || []).length ? p.crits.join(", ") : "no critical hit") +
      (p.wia ? " · pilot WIA" : "") + ((p.gunsOut || []).length ? " · out: " + p.gunsOut.join(", ") : "");
    $("sStatus").textContent = p.status ? "Back in play (now " + p.status + ")" : "Remove from play (destroyed)"; $("sPq").value = p.pq; $("sAce").checked = p.ace; $("sHero").checked = p.hero; $("sCrack").value = String(p.crack);
    if (document.activeElement !== $("sNotes")) $("sNotes").value = p.notes || "";
    $("sSide").textContent = SIDES[p.side].name; $("sSide").className = "chip " + p.side;
    if (document.activeElement !== $("sLine")) $("sLine").value = lineOf(p);
    $("lines").textContent = bySide(state.planes).map(lineOf).join("\n");
    $("delPlane").disabled = state.planes.length <= 1;
    $("roster").innerHTML = bySide(state.planes).map(q =>
      '<tr class="row' + (q === p ? " sel" : "") + '" data-id="' + q.id + '" tabindex="0"><td>' + dotHtml(q) + esc(q.name) + "</td><td>" + posName(q) +
      "</td><td>" + HEADINGS[q.head] + "</td><td>" + altName(q.alt) + " <small>" + bandOf(q.alt) + "</small></td><td>" + speedText(q) + "</td><td>" + pitchName(q.pitch, q.bank) +
      "</td><td>" + BANKS[q.bank] + "</td><td>" + esc(q.pq) + "</td><td>" + (q === p ? "—" : rangeHex(p, q)) + "</td></tr>").join("");
    $("mapRoster").innerHTML = bySide(state.planes).map(q =>
      '<tr class="row' + (q === p ? " sel" : "") + '" data-id="' + q.id + '" tabindex="0"><td>' + dotHtml(q) + esc(q.name) + "</td><td>" + posName(q) + "</td><td>" + altName(q.alt) + "</td></tr>").join("");
    renderChips();
    renderScenario();
    renderGame();
  }
  // sélecteur d'avion permanent : une ligne par camp, Blue puis Red ; ◀ ▶ dans cet ordre
  // dans chaque camp, ordre de mouvement dès que l'initiative est jetée (rang devant le nom) ; ✓ = déplacé ce tour, ✕ = hors jeu
  function chipOrder() { const O = typeof orderOf === "function" ? orderOf() : null; return O ? O.list : null; }
  function renderChips() {
    const ord = chipOrder();
    $("acChips").innerHTML = Object.keys(SIDES).map(sd => {
      let L = state.planes.filter(q => q.side === sd);
      if (ord) L = L.slice().sort((a, b) => (ord.indexOf(a) < 0 ? 99 : ord.indexOf(a)) - (ord.indexOf(b) < 0 ? 99 : ord.indexOf(b)));
      return L.length ? '<div class="acside">' + L.map(q => '<button type="button" class="acchip' + (q === selected ? " sel" : "") + (q.moved === state.turn || q.status ? " moved" : "") +
        '" data-id="' + q.id + '" title="' + (q.status || (q.moved === state.turn ? "moved this turn" : "")) + '">' + (ord && ord.includes(q) ? '<span class="acrank">' + (ord.indexOf(q) + 1) + "</span>" : "") +
        dotHtml(q) + esc(q.name) + (q.status ? " ✕" : q.moved === state.turn ? " ✓" : "") + "</button>").join("") + "</div>" : "";
    }).join("");
  }
  $("acChips").addEventListener("click", e => { const b = e.target.closest(".acchip"); if (b) select(state.planes.find(q => q.id === b.dataset.id)); });
  const stepSel = d => { const L = chipOrder() || bySide(state.planes), i = L.indexOf(selected); select(L[(i + d + L.length) % L.length]); };
  $("acPrev").addEventListener("click", () => stepSel(-1));
  $("acNext").addEventListener("click", () => stepSel(1));

  function renderScenario() {
    const S = state.scen;
    if (document.activeElement !== $("scName")) $("scName").value = S.name;
    if (document.activeElement !== $("scBase")) $("scBase").value = S.base;
    if (document.activeElement !== $("scLen")) $("scLen").value = S.len || "";
    if (document.activeElement !== $("scNotes")) $("scNotes").value = S.notes || "";
    $("scNorth").value = String(S.north);
    $("scBoard").value = S.board;
    $("scBoardNote").textContent = mapState[S.board] === "missing" ? "image not found: grid only (python tools/extract_vassal.py, then tools/build.py)" : "41 × 54 hexes, 1001 to 5054";
  }
  $("scNorth").innerHTML = NORTH_OPTIONS.map(o => '<option value="' + o.a + '">' + o.label + "</option>").join("");
  $("scBoard").innerHTML = Object.keys(BOARDS).map(k => '<option value="' + k + '">' + BOARDS[k].label + "</option>").join("");

  function renderGame() {
    $("gmTurn").textContent = state.turn + (state.scen.len ? " of " + state.scen.len : "");
    $("turnName").textContent = "Game turn " + state.turn + (state.scen.len ? " / " + state.scen.len : "") + (state.scen.name ? " · " + state.scen.name : "");
    if ($("gmScen").options.length !== SCENARIOS.length)
      $("gmScen").innerHTML = SCENARIOS.length ? SCENARIOS.map((s, i) => '<option value="' + i + '">' + esc(s.name) + "</option>").join("") : "<option>(no scenario in scenarios/)</option>";
    $("gmScenGo").disabled = !SCENARIOS.length;
    renderVP();
  }

  function refresh() {
    state.planes.forEach(updatePlane); renderPanel(); renderInit(); renderMv(); renderCombat(); renderLog(); renderAdc(); renderDice(); renderWho();
    drawTrack(currentTab === "mv" && lastR && planOf(selected).lines.length ? lastR.track : null, SIDES[selected.side].color);
    drawTrails(); renderMP(); renderMPSetup(); applyLocks(); save();
  }
  function select(p) { selected = p; refresh(); centerOn(p); }

  // ---- avion sélectionné ----
  $("sAdc").innerHTML = adcOptions(""); $("newType").innerHTML = adcOptions("");
  $("sCtr").innerHTML = counterOptions("");
  $("sName").addEventListener("input", e => { selected.name = e.target.value || "Unnamed"; refresh(); });
  $("sAdc").addEventListener("change", e => {
    const a = ADC_BY_ID[e.target.value] || null, p = selected;
    p.adc = a ? a.id : null;
    const k = counterFor(a); if (k) p.ctr = k;                     // pion de la fiche, s'il existe
    refresh();
  });
  $("sCtr").addEventListener("change", e => { selected.ctr = e.target.value; refresh(); });
  $("sPq").addEventListener("change", e => { selected.pq = e.target.value; refresh(); });
  $("sVar").addEventListener("change", e => { selected.var = e.target.checked; refresh(); });
  $("sLead").addEventListener("change", e => { selected.lead = e.target.value; refresh(); });
  $("sForm").addEventListener("change", e => { selected.form = e.target.value; refresh(); });
  $("sNoRadio").addEventListener("change", e => { selected.noRadio = e.target.checked; refresh(); });
  $("sStatus").addEventListener("click", () => { selected.status = selected.status ? "" : "destroyed"; refresh(); });
  $("sAce").addEventListener("change", e => { selected.ace = e.target.checked; refresh(); });
  $("sHero").addEventListener("change", e => { selected.hero = e.target.checked; refresh(); });
  $("sCrack").addEventListener("change", e => { selected.crack = +e.target.value; refresh(); });
  $("sNotes").addEventListener("input", e => { selected.notes = e.target.value; save(); });
  $("sSide").addEventListener("click", () => { const p = selected; p.side = p.side === "blue" ? "red" : "blue"; destroyPlane(p); buildPlane(p); refresh(); });
  function applySelLine() {
    const r = parseLine($("sLine").value), msg = $("sLineMsg");
    if (r.err) { msg.textContent = r.err; return; }
    const clash = state.planes.find(q => q !== selected && sameName(q.name, r.id));
    if (clash) { msg.textContent = "callsign " + r.id + " is already taken"; return; }
    const w = applyParsed(selected, r.data);
    if (w) { msg.textContent = w; return; }
    if (r.id && !sameAircraft(r.id, selected)) selected.name = r.id;
    msg.textContent = "";
    $("sLine").blur(); refresh(); centerOn(selected);
  }
  $("sLine").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); applySelLine(); }
    if (e.key === "Escape") { $("sLine").value = lineOf(selected); $("sLineMsg").textContent = ""; $("sLine").blur(); }
  });
  $("sLine").addEventListener("input", () => { $("sLineMsg").textContent = ""; });

  // ---- avions en jeu ----
  const pickRow = e => { const tr = e.target.closest("tr.row"); if (tr) select(state.planes.find(q => q.id === tr.dataset.id)); };
  ["roster", "mapRoster"].forEach(id => {
    $(id).addEventListener("click", pickRow);
    $(id).addEventListener("keydown", e => { if (e.key === "Enter") pickRow(e); });
  });
  $("addPlane").addEventListener("click", () => {
    const a = ADC_BY_ID[$("newType").value] || null, side = $("newSide").value;
    const prefix = a ? prefixOf(a) : "Acft";
    const taken = new Set(state.planes.map(q => callsign(q).toLowerCase()));
    let n = 1; while (taken.has((prefix + " #" + n).toLowerCase())) n++;
    const near = hexAt(controls.target.x, controls.target.z) || { c: Math.floor(COLS / 2), r: Math.floor(ROWS / 2) };
    const p = cleanGame({ planes: [{ id: "p" + Date.now(), name: prefix + " #" + n, adc: a ? a.id : null, side, c: near.c, r: near.r, head: 0,
      alt: selected ? selected.alt : 6000, speed: 4.0 }] }).planes[0];
    $("sLine").blur();
    state.planes.push(p); buildPlane(p); select(p); $("sLine").focus(); $("sLine").select();
  });
  $("delPlane").addEventListener("click", () => {
    if (state.planes.length <= 1) return;
    const i = state.planes.indexOf(selected); destroyPlane(selected); state.planes.splice(i, 1);
    select(state.planes[Math.min(i, state.planes.length - 1)]);
  });
  function copyText(txt, btn, label) {
    const done = ok => { btn.textContent = ok ? "Copied" : "Copy failed: select and press Ctrl+C"; setTimeout(() => (btn.textContent = label), 1600); };
    try { navigator.clipboard.writeText(txt).then(() => done(true), () => done(false)); } catch (e) { done(false); }
  }
  $("copyLines").addEventListener("click", () => copyText($("lines").textContent, $("copyLines"), "Copy lines"));
  $("applyImport").addEventListener("click", () => {
    $("importMsg").textContent = applyLines($("fImport").value) || "No lines.";
    state.planes.forEach(p => { if (!sideHeadingOk(p)) p.hex2 = null; }); refresh();
  });

  // ---- scénario : nom, carte, Nord, altitude du niveau de la carte, durée, notes ----
  $("scName").addEventListener("input", e => { state.scen.name = e.target.value; renderGame(); save(); });
  $("scNotes").addEventListener("input", e => { state.scen.notes = e.target.value; save(); });
  $("scLen").addEventListener("input", e => { const v = Math.round(+e.target.value); if (isFinite(v)) { state.scen.len = Math.max(0, v); renderGame(); save(); } });
  $("scBase").addEventListener("input", e => { const v = Math.round(+e.target.value); if (e.target.value !== "" && isFinite(v)) { state.scen.base = Math.max(0, v); refresh(); } });
  $("scNorth").addEventListener("change", e => {
    state.scen.north = +e.target.value; buildCompass();
    state.planes.forEach(p => { if (!sideHeadingOk(p)) p.hex2 = null; }); refresh();
  });
  $("scBoard").addEventListener("change", e => { state.scen.board = e.target.value; setBoard(state.scen.board); buildMap(); refresh(); });

  // ---- partie : tour, scénarios, export / import / nouvelle partie ----
  $("gmPrev").addEventListener("click", () => { state.turn = Math.max(1, state.turn - 1); refresh(); });
  $("gmNext").addEventListener("click", () => { state.turn++; refresh(); });
  function loadGame(g, msg) {
    const ok = g && cleanGame(clone(g));
    if (!ok) { $("gmMsg").textContent = msg; return false; }
    try { localStorage.setItem(GAME_KEY, JSON.stringify(ok)); } catch (err) {}
    location.reload();
    return true;
  }
  let scenArmed = 0;
  $("gmScenGo").addEventListener("click", () => {
    const s = SCENARIOS[+$("gmScen").value]; if (!s) return;
    if (Date.now() - scenArmed > 10000) { scenArmed = Date.now(); $("gmMsg").textContent = "Click « Start scenario » again within 10 s to replace this game by « " + s.name + " »."; return; }
    loadGame(s.game, "This scenario file is not readable.");
  });
  $("gmExport").addEventListener("click", () => {
    const g = Object.assign({ app: "Fighting Wings Digital", exported: new Date().toISOString() }, gameData());
    const name = (state.scen.name || state.planes.map(callsign).join(" vs ")).replace(/[\\\/:*?"<>|]+/g, " ").slice(0, 80);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(g, null, 1)], { type: "application/json" }));
    a.download = "FW game - " + name + " - turn " + state.turn + " - " + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $("gmMsg").textContent = "Game file saved to your downloads.";
  });
  $("gmImport").addEventListener("click", () => $("gmFile").click());
  $("gmFile").addEventListener("change", e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    f.text().then(t => { let g = null; try { g = JSON.parse(t); } catch (err) {} loadGame(g, "Not a Fighting Wings Digital game file."); });
  });
  let newArmed = 0;
  $("gmNew").addEventListener("click", () => {
    if (Date.now() - newArmed > 10000) { newArmed = Date.now(); $("gmMsg").textContent = "Click « New game… » again within 10 s to erase this game."; return; }
    try { localStorage.removeItem(GAME_KEY); } catch (e) {}
    location.reload();
  });
