  // ================= Relevé des jets (repris de Warbirds Digital : les joueurs peuvent vérifier les jets) =================
  //  dieRoll(n, ce qui est jeté, avion) : 1 à n (D10 : 1 à 10, le 0 lu 10, règle 2.0) ; chaque jet est noté dans state.dice
  //  (gardé dans le fichier de partie) avec le tour, l'avion et la raison ; rien n'est jamais retiré.
  function dieRoll(n, what, p) {
    const v = 1 + Math.floor(Math.random() * n);
    (state.dice = state.dice || []).push({ turn: state.turn, ac: p ? callsign(p) : "", what, n, v: [v] });
    return v;
  }
  function renderDice() {
    const sel = $("dcSel"), turns = [...new Set((state.dice || []).map(d => d.turn))].sort((a, b) => b - a);
    const cur = sel.value || "this";
    sel.innerHTML = '<option value="this">This turn</option>' + turns.map(t => '<option value="' + t + '">Turn ' + t + "</option>").join("") + '<option value="all">All turns</option>';
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : "this";
    const L = (state.dice || []).filter(d => sel.value === "all" || d.turn === (sel.value === "this" ? state.turn : +sel.value));
    $("dcText").textContent = L.length ? L.map(d => "T" + pad2(d.turn) + "  " + (d.ac ? d.ac + " — " : "") + d.what + ": D" + d.n + " = " + d.v.join(", ")).join("\n") : "No roll.";
  }
  $("dcSel").addEventListener("change", renderDice);
  $("dcCopy").addEventListener("click", () => copyText($("dcText").textContent, $("dcCopy"), "Copy"));
