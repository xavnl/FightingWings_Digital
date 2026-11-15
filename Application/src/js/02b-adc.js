  // ================= Fiches ADC (tools/extract_adc.py → ADC_LIB) et pions Vassal (tools/extract_vassal.py → COUNTERS) =================
  const ADC_BY_ID = {}; ADC_LIB.forEach(a => { ADC_BY_ID[a.id] = a; });
  const adcOf = p => (p && p.adc && ADC_BY_ID[p.adc]) || null;
  const shortName = a => a.name.replace(/^(Polikarpov|Nakajima|Mitsubishi|Kawasaki|Curtiss|Brewster|Hawker|Bristol|Lockheed|Boeing|Seversky|Republic|Douglas|Vickers|Commonwealth|Tachikawa|Aichi)\s+/, "").replace(/\s*["“][^"”]*["”]\s*$/, "");
  // préfixe des noms d'avions : « I-16 Type 5 #1 », « Ki.27 #1 »
  const prefixOf = a => shortName(a);
  function adcOptions(sel) {
    return '<option value="">— no data card —</option>' + ADC_LIB.slice().sort((a, b) => shortName(a).localeCompare(shortName(b)))
      .map(a => '<option value="' + a.id + '"' + (a.id === sel ? " selected" : "") + ">" + esc(shortName(a)) + " · " + esc(a.country) + "</option>").join("");
  }
  // Pions : COUNTERS = [{ name : « Ki-27 », imgs : [« ki-27-1 », …] }] ; un pion par image (variantes de peinture)
  const CTR_LIST = COUNTERS.flatMap(k => k.imgs.map((id, i) => ({ id, label: k.name + (k.imgs.length > 1 ? " (" + (i + 1) + ")" : "") })));
  const CTR_BY_ID = {}; CTR_LIST.forEach(k => { CTR_BY_ID[k.id] = k; });
  // pion d'une fiche : nom du pion qui commence le nom de la fiche (« Ki.27 Nate » → « Ki-27 », « I-16 Type 5 » → « I-16 tip 5 »)
  const normName = s => String(s).toLowerCase().replace(/\btype\b/g, "tip").replace(/[^a-z0-9]/g, "");
  function counterFor(a) {
    if (!a) return null;
    const n = normName(shortName(a)); let best = null;
    COUNTERS.forEach(k => { const m = normName(k.name); if (m && n.startsWith(m) && (!best || m.length > normName(best.name).length)) best = k; });
    return best ? best.imgs[0] : null;
  }
  function counterOptions(sel) {
    return '<option value="">— simple model —</option>' + CTR_LIST.map(k => '<option value="' + k.id + '"' + (k.id === sel ? " selected" : "") + ">" + esc(k.label) + "</option>").join("");
  }
