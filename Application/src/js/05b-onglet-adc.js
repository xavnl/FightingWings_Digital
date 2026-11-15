  // ================= Onglet ADC : fiche de l'avion sélectionné (2.4), bande et colonne de vitesse actuelles surlignées =================
  const cellTxt = x => !x ? "–" : x.v === null || x.v === undefined ? (x.alt !== undefined ? "(" + x.alt + ")" : (x.txt || "–"))
    : (Number.isInteger(x.v) && x.v >= 100 ? x.v.toLocaleString("en") : fmt1(x.v).replace(/\.0$/, x.v < 20 ? ".0" : "")) + (x.alt !== undefined ? " (" + fmt1(x.alt) + ")" : "") + (x.emer !== undefined ? " / " + fmt1(x.emer) : "");
  // colonne du tableau Power vs Speed pour une vitesse (« 1.0 - 4.5 », « 5.0 - 7.5 », …, « 10.0 + »)
  function powerCol(a, speed) {
    const i = a.powerCols.findIndex(t => { const m = /([\d.]+)\s*(?:-\s*([\d.]+)|\+)/.exec(t); return m && speed >= +m[1] - 1e-9 && (!m[2] || speed <= +m[2] + 1e-9); });
    return i >= 0 ? i : speed < 1 ? 0 : -1;
  }
  const signedInt = v => (v > 0 ? "+" : "") + v;
  function renderAdc() {
    const p = selected, a = adcOf(p), box = $("adcBody");
    $("adcWho").textContent = callsign(p);
    if (!a) { box.innerHTML = '<p class="note">No data card for this aircraft: choose one in the Aircraft tab. Data cards are read from the ADC folder (python tools/extract_adc.py).</p>'; return; }
    const band = bandOf(p.alt), col = powerCol(a, p.speed);
    const kv = (k, v, t) => '<div' + (t ? ' title="' + esc(t) + '"' : "") + "><dt>" + k + "</dt><dd>" + v + "</dd></div>";
    const td = a.turnDecel || {};
    const perfRows = BANDS.slice().reverse().map(([b]) => {
      const r = a.perf[b] || {};
      return '<tr class="' + (b === band ? "cur" : "") + '"><td>' + b + "</td>" + ["min", "max", "dive", "TT", "HT", "BT", "ET"].map(k => "<td>" + cellTxt(r[k]) + "</td>").join("") +
        "<td>" + esc(r.roc || "–") + "</td></tr>";
    }).join("");
    const pwrRows = BANDS.slice().reverse().filter(([b]) => a.power[b]).map(([b]) =>
      '<tr class="' + (b === band ? "cur" : "") + '"><td>' + b + "</td>" + a.powerCols.map((c, i) => '<td class="' + (i === col ? "cur" : "") + '">' + cellTxt(a.power[b][i]) + "</td>").join("") + "</tr>").join("");
    const fpRow = (lab, L) => "<tr><td>" + lab + "</td>" + a.powerCols.map((c, i) => '<td class="' + (i === col ? "cur" : "") + '">' + (L[i] === undefined ? "–" : L[i]) + "</td>").join("") + "</tr>";
    const gIds = a.guns.map(g => g.id), ranges = [0, 1, 2, 3, 4, 5, 6, 7];
    const afRows = ranges.map(r => "<tr><td>" + r + "</td>" + gIds.map(g => "<td>" + ((a.gunAF[g] || [])[r] == null ? "–" : (a.gunAF[g] || [])[r]) + "</td>").join("") +
      "<td><b>" + (a.gunTotal[r] == null ? "–" : a.gunTotal[r]) + "</b></td></tr>").join("");
    box.innerHTML =
      '<section><h2>' + esc(a.name) + ' <small>' + esc(a.country) + " · " + esc(a.entry) + " · " + esc(a.edition) + "</small></h2>" +
      '<dl class="adc"><dt>Type</dt><dd>' + esc(a.type) + "</dd><dt>Engine</dt><dd>" + esc(a.engine) + "</dd><dt>Power</dt><dd>" + esc(a.enginePower || "") +
      "</dd><dt>Crew</dt><dd>" + esc(a.crew) + "</dd><dt>Max speed</dt><dd>" + esc(a.maxSpeed) + "</dd><dt>Max ceiling</dt><dd>" + esc(a.ceiling) + "</dd></dl>" +
      '<p class="note" style="margin-top:8px"><a href="../../../Documents%20originaux/ADC/' + encodeURI(a.file) + '" target="_blank" rel="noopener">Open the data card (PDF)</a> — the page reads the card; check it in case of doubt.</p></section>' +
      '<section><h2>Combat data</h2><dl class="kv">' +
      kv("Class", esc(a.cls), "Agility class (3.1.1): H, M, L or F") + kv("Defense factor", a.def + ' <small>size ' + signedInt(a.size) + "</small>") +
      kv("Damage factor", a.dmg ? a.dmg[0] + " / " + a.dmg[1] : "–", "More hits than the first number: severely damaged; more than the second: destroyed (7.4)") +
      kv("Victory points", esc(a.vp)) +
      kv("Protection", "C " + signedInt(a.prot.cockpit) + " · F " + signedInt(a.prot.fuel) + " · E " + signedInt(a.prot.engine), "Added to critical hit effect rolls in the area (8.2)") +
      kv("Climb decel / dive accel", fmt1(a.climbDecel) + " / " + fmt1(a.diveAccel), "Start pitch climb / dive (6.2.4, 6.2.5)") +
      kv("Cockpit view", esc(a.view) + (a.blind ? ' <small>blind ' + esc(a.blind) + "</small>" : "")) + kv("Endurance", esc(a.endurance)) +
      "</dl></section>" +
      '<section><h2>Aircraft performance chart <small>current band ' + band + " (" + altName(p.alt) + ")</small></h2><div class=\"table-wrap\"><table class=\"adct\"><thead><tr><th>Band</th><th>Min speed</th><th>Max speed</th><th>Max dive</th>" +
      ["TT", "HT", "BT", "ET"].map(k => "<th>Min " + k + " (" + (td[k] === undefined ? "?" : fmt1(td[k]).replace(/\.0$/, "")) + ")</th>").join("") + "<th>Rate of climb</th></tr></thead><tbody>" + perfRows + "</tbody></table></div>" +
      '<p class="note" style="margin-top:6px">Numbers in ( ) next to the turn rates: decel points per 30° of facing change started at that rate (6.2.10); EZ = half the TT decel. Numbers in ( ) in the cells: variant given in the notes. Power « 8 / 9 »: normal / emergency power.</p></section>' +
      '<section><h2>Power versus speed chart <small>speed ' + speedText(p) + "</small></h2><div class=\"table-wrap\"><table class=\"adct\"><thead><tr><th>Band</th>" +
      a.powerCols.map((c, i) => '<th class="' + (i === col ? "cur" : "") + '">' + esc(c) + "</th>").join("") + "</tr></thead><tbody>" + pwrRows +
      fpRow("Banking FPs" + (a.bankFPsR ? " (left / right)" : ""), a.bankFPsR ? a.bankFPs.map((v, i) => v + " / " + a.bankFPsR[i]) : a.bankFPs) + fpRow("Side slip FPs", a.slipFPs) + "</tbody></table></div></section>" +
      '<section><h2>Fire power chart</h2><div class="table-wrap"><table class="adct arm"><thead><tr><th>Guns</th><th>Type weapons</th><th>Ammo</th><th>Criticals</th></tr></thead><tbody>' +
      a.guns.map(g => "<tr><td>" + g.id + "</td><td>" + esc(g.weapon) + "</td><td>" + (g.mags ? "(" + g.mags[0] + "×" + g.mags[1] + ")" : g.ammo) + "</td><td>" + g.crit + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="table-wrap" style="margin-top:10px"><table class="adct"><thead><tr><th>Range</th>' + gIds.map(g => "<th>" + g + "</th>").join("") + "<th>Total</th></tr></thead><tbody>" + afRows + "</tbody></table></div></section>" +
      (a.dgCover ? '<section><h2>Defensive gun coverage</h2><p class="adcnotes">' + esc(a.dgCover) + "</p></section>" : "") + '<section><h2>Notes &amp; variants</h2><p class="adcnotes">' + esc(a.notes) + "</p></section>";
  }
