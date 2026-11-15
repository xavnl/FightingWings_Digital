  // ================= Emports (12.0) et points de victoire =================
  //  Largage (« jettison ») : déclaré et fait à la Combat Phase, après les tirs air-air (8.3, étape 6) ; interdit si l'avion finit
  //  le tour sur le dos (attitude inversée) ou a subi des G négatifs ; les bombes larguées tombent sans dégâts (12.0).
  //  L'avion n'est plus « loaded » (Jolly Rogers : chaque Val est chargé par sa seule bombe T-99 No.25).
  const isFixedShot = s => !s.def && !s.jett;                       // tir aux armes fixes (pas un tir défensif, pas un largage)
  function jettWhy(p) {
    const why = [], mvt = thisMove(p);
    if (!p.bomb) why.push("no stores carried");
    if (p.status) why.push("out of play");
    if (isInv(p.bank)) why.push("inverted attitude at the end of the move");
    if (mvt && mvt.ng) why.push("negative-G this turn");
    if ((state.shots || []).some(s => s.turn === state.turn && s.sh === p.id && s.jett)) why.push("already jettisoned this turn");
    return why;
  }
  function jettison(p) {
    if (jettWhy(p).length) return null;
    const what = p.bomb, L = [callsign(p) + " jettisons " + what + " (12.0): unaimed, no damage"];
    p.bomb = ""; if (p.load === "loaded") { p.load = ""; L.push(callsign(p) + " is no longer loaded: normal speeds and power from next turn"); }
    p.jettDecl = 0;
    const rec = { turn: state.turn, sh: p.id, tg: "", text: L.join("\n"), jett: true };
    logShot(p, rec);
    return rec;
  }
  // ---- points de victoire (livret de scénarios absent du dossier : HYPOTHÈSE à confirmer) ----
  //  avion abattu : 2e nombre « Victory Points » de sa fiche à l'adversaire ; sévèrement endommagé (non abattu) : 1er nombre ;
  //  pilote tué (13.2) : vétéran 5, regular 3, green 1, recrue 0, + 2 par as / héros ; bonus du scénario par avion qui garde sa bombe.
  const PILOT_VP = { Veteran: 5, Regular: 3, Green: 1, Recruit: 0 };
  function vpOf() {
    const out = {}; Object.keys(SIDES).forEach(sd => { out[sd] = { total: 0, lines: [] }; });
    const other = sd => Object.keys(SIDES).find(x => x !== sd);
    state.planes.forEach(p => {
      const a = adcOf(p), m = /(\d+)\s*-\s*(\d+)/.exec((a && a.vp) || ""), to = out[other(p.side)];
      if (!m) return;
      if (p.status) { to.total += +m[2]; to.lines.push(callsign(p) + " " + p.status + ": " + m[2]); }
      else if (isSevere(p)) { to.total += +m[1]; to.lines.push(callsign(p) + " severely damaged: " + m[1]); }
      const C = p.crew || [];
      if (C[0] === "KIA") { const v = (PILOT_VP[p.pq] || 0) + (p.ace ? 2 : 0) + (p.hero ? 2 : 0); if (v) { to.total += v; to.lines.push(callsign(p) + " pilot killed (" + p.pq.toLowerCase() + (p.ace ? ", ace" : "") + (p.hero ? ", hero" : "") + "): " + v); } }
    });
    const B = state.scen.bombVP;
    if (B) {
      const n = state.planes.filter(p => p.side === B.side && !p.status && p.bomb).length;
      if (n) { out[B.side].total += n * B.per; out[B.side].lines.push(n + " aircraft still carrying their bomb × " + B.per + " (scenario special rule): " + n * B.per); }
    }
    return out;
  }
  function renderVP() {
    const V = vpOf();
    $("vpBox").innerHTML = Object.keys(SIDES).map(sd => '<p class="note"><b>' + dotHtml({ side: sd }) + SIDES[sd].name + ": " + V[sd].total + " VP</b>" +
      (V[sd].lines.length ? "<br>" + V[sd].lines.map(esc).join("<br>") : "") + "</p>").join("") +
      '<p class="note">Assumed from the data cards (the scenario booklet is not in the game folder): an aircraft shot down gives the second « Victory Points » number of its card,' +
      " a severely damaged one the first; a pilot killed gives his crew VP (13.2: veteran 5, regular 3, green 1, recruit 0, +2 per ace or hero). Bail-outs are not handled.</p>";
  }
