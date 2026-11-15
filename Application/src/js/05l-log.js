  // ================= Onglet Log : les coups de l'avion sélectionné au format PBEM de l'utilisateur (Docs\Moves.txt) =================
  //  Tour en cours (pas encore appliqué) puis tours passés (p.logs, gardés par « Apply end of turn »). Bouton Copy.
  function renderLog() {
    const p = selected, R = lastR || simulate(p);
    const cur = p.moved === state.turn ? "" : (R.errs.length ? "TURN" + pad2(state.turn) + " — not ready:\n" + R.errs.map(e => "  " + e).join("\n") : logText(p, R));
    const past = (p.logs || []).slice().sort((a, b) => b.turn - a.turn).map(x => x.text);
    $("logCur").textContent = cur || "Moved this turn (see below).";
    $("logPast").textContent = past.length ? past.join("\n\n\n") : "No turn applied yet.";
    $("logWho").textContent = callsign(p);
  }
  $("logCopy").addEventListener("click", () => copyText($("logCur").textContent, $("logCopy"), "Copy this turn"));
  $("logCopyAll").addEventListener("click", () => copyText($("logPast").textContent, $("logCopyAll"), "Copy previous turns"));
