  // ================= Mouvement Fighting Wings (règles 3.5 à 7.0 ; Flight Tables pages 1 à 4) : moteur =================
  //  Repris du moteur Tiger Wings et mis aux règles FW (lot 2, 15/11/2026). Le tour d'un avion = un plan
  //  p.mv = { power, trans, oc, end, fix, brakes, rec, freeH, lines: [{ h, v, act, rate, fac, keep }], ooc, dd, comp } ;
  //  simulate(p) rejoue le tour FP par FP depuis la ligne de position et les reports (p.half, p.acc, p.mcarry) et donne la
  //  position et la vitesse de fin, les accel / decel, les erreurs et le texte du Log.

  // ---- A/C Turn Rate Chart (5.2, Flight Tables page 3) : [vitesse mini de la ligne, EZ, TT, HT, BT, ET] ----
  const RATES = ["EZ", "TT", "HT", "BT", "ET"];
  const TURN_CHART = [[0, "1", "60", "90", "NA", "NA"], [2, "2", "1", "60", "90", "NA"], [3, "3", "2", "1", "60", "90"], [4, "4", "3", "2", "1", "60"],
    [5, "6", "4", "3-2", "2-1", "1"], [6, "8", "6", "3", "2", "2-1"], [7, "10", "7", "4", "3-2", "2"], [8, "12", "8", "5", "3", "3-2"],
    [9, "15", "9", "6", "4", "3"], [10, "18", "10", "8", "5", "3"], [11, "22", "12", "9", "6", "4"], [12, "26", "14", "11", "7", "5"],
    [13, "30", "16", "13", "8", "6"], [14, "34", "18", "14", "10", "7"], [15, "38", "20", "15", "11", "8"]];
  //  entrée : null (NA) ; { deg: 60 | 90 } (de 30° à deg par FP joué) ; { req: [n] } ou { req: [a, b] } (« split » 3-2)
  function chartEntry(speed, rate) {
    let row = TURN_CHART[0]; TURN_CHART.forEach(r => { if (speed >= r[0]) row = r; });
    const t = row[1 + RATES.indexOf(rate)];
    if (t === "NA") return null;
    if (t === "60" || t === "90") return { deg: +t, txt: t };
    return { req: t.split("-").map(Number), txt: t };
  }
  // ---- Fractional Values Table (3.5.1, Flight Tables page 3) : nombre → [1/4, 1/3, 1/2, 2/3] ----
  const FVT = { 0.5: [0, 0, 0, 0.5], 1: [0, 0.5, 0.5, 0.5], 1.5: [0.5, 0.5, 0.5, 1], 2: [0.5, 0.5, 1, 1.5], 2.5: [0.5, 1, 1, 1.5], 3: [0.5, 1, 1.5, 2],
    3.5: [1, 1, 1.5, 2.5], 4: [1, 1.5, 2, 2.5], 4.5: [1, 1.5, 2, 3], 5: [1, 1.5, 2.5, 3.5], 5.5: [1.5, 2, 2.5, 3.5], 6: [1.5, 2, 3, 4], 6.5: [1.5, 2, 3, 4.5],
    7: [1.5, 2.5, 3.5, 4.5], 7.5: [2, 2.5, 3.5, 5], 8: [2, 2.5, 4, 5.5], 8.5: [2, 3, 4, 5.5], 9: [2, 3, 4.5, 6], 9.5: [2.5, 3, 4.5, 6.5], 10: [2.5, 3.5, 5, 6.5],
    10.5: [2.5, 3.5, 5, 7], 11: [2.5, 3.5, 5.5, 7.5], 11.5: [3, 4, 5.5, 7.5], 12: [3, 4, 6, 8], 12.5: [3, 4, 6, 8.5], 13: [3, 4.5, 6.5, 8.5],
    13.5: [3.5, 4.5, 6.5, 9], 14: [3.5, 4.5, 7, 9.5], 14.5: [3.5, 5, 7, 9.5], 15: [3.5, 5, 7.5, 10] };
  function fvt(x, k) {                                      // k : 0 = 1/4, 1 = 1/3, 2 = 1/2, 3 = 2/3
    const v = Math.round(x * 2) / 2; if (v <= 0) return 0;
    if (FVT[v]) return FVT[v][k];
    return Math.round(v * [0.25, 1 / 3, 0.5, 2 / 3][k] * 2) / 2;
  }
  const up1 = x => Math.ceil(x - 1e-9), dn1 = x => Math.floor(x + 1e-9);
  // ---- données de la fiche à la bande d'altitude de départ (valeurs entre parenthèses si p.var : variante des notes) ----
  const cellVal = (p, x) => !x ? null : (p.var && x.alt !== undefined) ? x.alt : (x.v === undefined ? null : x.v);
  // ---- charge (12.0) et dégâts (11.0) : Flight Tables page 1 (A/C Load Effects, Severe Damage Effects) ----
  const count = (p, c) => (p.crits || []).filter(x => x === c).length;
  const isSevere = p => { const a = adcOf(p); return !!(a && a.dmg && (p.hits || 0) > a.dmg[0]); };
  //  chargé : maxi et piqué −0.5, mini (palier et virages) +0.5, puissance 2/3 ; surchargé : −1.0, +1.0, +1 bank / slip, puissance 1/2
  //  (le +1 bank / slip des avions chargés qui portent ≥ 1/2 de la charge sous les ailes n'est pas appliqué : à cocher plus tard)
  const loadOf = p => p.load === "overloaded" ? { k: "overloaded", max: -1, min: 1, dive: -1, bank: 1, pw: 2, ceil: 2 } :
    p.load === "loaded" ? { k: "loaded", max: -0.5, min: 0.5, dive: -0.5, bank: 0, pw: 3, ceil: 1 } : { k: "", max: 0, min: 0, dive: 0, bank: 0, pw: -1, ceil: 0 };
  //  critiques (Combat Tables page 2) : longeron / queue −1.0 au piqué sûr chacun ; ailerons « +1 Bank / Slip » (pas de snap) ;
  //  gouvernail (pas de snap, slip, skid, sortie de vrille) ; profondeur (TT au plus) ; commandes molles (un rythme de moins) ;
  //  manette des gaz (cruise au plus) ; peau déchirée « +1 Decel » ; plus d'un pas de puissance perdu : pas d'urgence (11.3)
  function dmgOf(p) {
    const sev = isSevere(p), pl = count(p, "Power loss"), L = loadOf(p), bs = count(p, "+1 Bank / Slip"), rud = count(p, "Rudder out") > 0;
    return { sev, L, minAdd: (sev ? 0.5 : 0) + L.min, maxAdd: (sev ? -1 : 0) - 0.5 * pl + L.max,
      diveAdd: (sev ? -1 : 0) + L.dive - count(p, "Wing spar") - count(p, "Tail structure"),
      bankAdd: bs + (sev ? 1 : 0) + L.bank, slipAdd: bs + (sev ? 1 : 0) + L.bank, decel: count(p, "+1 Decel"),
      noBT: count(p, "No BTs, ETs") > 0, powerLoss: pl, seized: count(p, "Engine seizes") > 0,
      noSnap: bs > 0 || rud, noSlip: rud, rudder: rud, maxRate: count(p, "Elevators") ? 1 : 4, sluggish: count(p, "Sluggish controls") > 0,
      cruiseOnly: count(p, "Throttle: cruise max") > 0, noEmer: pl > 1 };
  }
  // valeur de la fiche à la bande, ajustée de la charge et des dégâts (4.3.1) : mini et virages, maxi, piqué maxi
  const perfRaw = (p, band, k) => { const a = adcOf(p); return a && a.perf[band] ? cellVal(p, a.perf[band][k]) : null; };
  function perfVal(p, band, k) {
    const v = perfRaw(p, band, k); if (v === null) return null;
    const D = dmgOf(p);
    if (k === "max") return v + D.maxAdd;
    if (k === "dive") return v + D.diveAdd;
    if (k === "min" || RATES.includes(k)) return v + D.minAdd;
    return v;
  }
  // puissance (4.1) : militaire = nombre à gauche de la barre, urgence (emer) = à droite ; pertes de puissance (11.3, FVT),
  //  puis dommages sévères (−1/4), puis charge (2/3, 1/2) : « step loss first, then severe damage and load status in that order »
  function powerMax(p, band, speed, emer) {
    const a = adcOf(p); if (!a || !a.power[band]) return null;
    const i = powerCol(a, speed); if (i < 0) return null;
    const x = a.power[band][i];
    let v = emer && x && x.emer !== undefined && !dmgOf(p).noEmer ? x.emer : cellVal(p, x); if (v === null) return null;
    const D = dmgOf(p);
    if (D.seized || D.powerLoss >= 5) return 0;
    if (D.powerLoss) v = fvt(v, [3, 2, 1, 0][D.powerLoss - 1]);
    if (D.sev) v = v - fvt(v, 0);
    if (D.L.pw >= 0) v = fvt(v, D.L.pw);
    return v;
  }
  // vitesse de palier maxi atteignable (4.3.1) selon le réglage : idle = 1/2 maxi listée ; cruise F / MF : −1.0 (HI et au-dessus) ou
  //  −1.5 (MH et au-dessous) ; cruise autres : le plus petit de maxi atteignable −0.5 ou maxi listée −1.0
  function maxAttain(p, band, setting) {
    const listed = perfRaw(p, band, "max"); if (listed === null) return null;
    const att = listed + dmgOf(p).maxAdd, cls = (adcOf(p) || {}).cls || "F";
    if (setting === "idle") return fvt(listed, 2);
    if (setting === "cruise") return /^(F|MF)/.test(cls) ? att - (["HI", "VH", "EH", "UH"].includes(band) ? 1 : 1.5) : Math.min(att - 0.5, listed - 1);
    return att;
  }
  const bankNeed = (p, s, dir) => { const a = adcOf(p); return (fpsOf(a && (dir === "R" && a.bankFPsR ? a.bankFPsR : a.bankFPs), s) || 1) + dmgOf(p).bankAdd; };   // « 2/2 » : roulis gauche / droite (Zero)
  const slipNeed = (p, s) => (fpsOf(adcOf(p) && adcOf(p).slipFPs, s) || 1) + dmgOf(p).slipAdd;
  const fpsOf = (L, speed) => L && L.length ? L[Math.max(0, Math.min(L.length - 1, speedCol(speed)))] : null;
  const speedCol = speed => speed < 5 ? 0 : speed < 8 ? 1 : speed < 10 ? 2 : 3;   // colonnes 1.0-4.5, 5.0-7.5, 8.0-9.5, 10.0+
  const turnDecel = (p, rate) => {                          // decel par 30° (4.2) ; EZ = moitié du TT (FVT)
    const a = adcOf(p), td = (a && a.turnDecel) || { TT: 1, HT: 2, BT: 2, ET: 3 };
    return rate === "EZ" ? fvt(td.TT, 2) : td[rate];
  };
  // 5.5.1 : à grande vitesse, decel d'un rythme plus bas (5.0+ : un cran, 8.0+ : deux, 10.0+ : trois ; jamais sous EZ)
  const decelRate = (rate, s) => RATES[Math.max(0, RATES.indexOf(rate) - (s >= 10 ? 3 : s >= 8 ? 2 : s >= 5 ? 1 : 0))];
  // accel / decel par 100 ft gagnés ou perdus (4.1, 4.2), selon la vitesse de départ
  const per100Of = s => s >= 9 ? 0.5 : s >= 5 ? 1 : s >= 3.5 ? 1.5 : s >= 3 ? 2 : s >= 2.5 ? 2.5 : s >= 2 ? 3 : s >= 1.5 ? 4 : 6;
  const signedAlt = ft => (ft < 0 ? "-" : "+") + (Math.abs(ft) / 1000).toFixed(1);
  const num = v => Number.isInteger(v) ? String(v) : fmt1(v);                       // « 4 » plutôt que « 4.0 » dans les formules
  const flipBank = b => ({ 0: 3, 3: 0, 1: 2, 2: 1, "-1": -2, "-2": -1 })[norm6(b)];   // reversal (6.4.1) : LB ↔ IL, RB ↔ IR, LV ↔ IV
  const noFI = p => /No\s*F\.?\s*I/i.test((adcOf(p) || {}).engine || "");
  const engCount = p => { const m = /^(One|Two|Three|Four|Six)\b/i.exec((adcOf(p) || {}).engine || ""); return m ? ({ one: 1, two: 2, three: 3, four: 4, six: 6 })[m[1].toLowerCase()] : 1; };
  const crewOf = p => Math.max(1, String((adcOf(p) || {}).crew || "Pilot").split(/,|\band\b/).filter(x => x.trim()).length);

  // ---- FATT (6.1, Flight Tables page 4) : cercle des 12 attitudes dans le sens « pull » (nez vers le haut pour le pilote) ----
  //  0 LVL, 1 SHC, 2 STC, 3 VC / (VC), 4 (STC), 5 (SHC), 6 (INV), 7 (SHD), 8 (STD), 9 VD / (VD), 10 STD, 11 SHD ; « ( ) » = inversé.
  //  Pull : on avance dans ce sens ; push : en arrière. Vertical : deux jeux de codes, selon le bank (à l'endroit / inversé).
  //  Codes recopiés des diagrammes (page lue en image, 15/11/2026) ; « V+ » / « V- » = VFPs en montée / en descente ;
  //  « RV … 2/3+ » = reversal, la fraction est arrondie au-dessus (+) ou au-dessous (−).
  const ATT = ["LVL", "SHC", "STC", "VC", "(STC)", "(SHC)", "(INV)", "(SHD)", "(STD)", "VD", "STD", "SHD"];
  const ATT_PITCH = [0, 1, 2, 3, 2, 1, 0, -1, -2, -3, -2, -1];
  const invSide = i => i >= 4 && i <= 8;
  const attOf = (pitch, bank) => { const inv = isInv(bank); return ({ 0: inv ? 6 : 0, 1: inv ? 5 : 1, 2: inv ? 4 : 2, 3: 3, "-1": inv ? 7 : 11, "-2": inv ? 8 : 10, "-3": 9 })[pitch]; };
  const attKey = (i, inv) => i === 3 ? (inv ? "(VC)" : "VC") : i === 9 ? (inv ? "(VD)" : "VD") : ATT[i];
  const attLabel = (i, inv) => pitchName(ATT_PITCH[i], (i === 3 || i === 9) ? (inv ? 3 : 0) : invSide(i) ? 3 : 0);
  const FATT = {
    pull: {
      LVL: "EZ 1: All H | TT 1: 2/3H, 1V | HT 1: 1/2H, 1V to 1/4V | HT 2: 1/2H, 1V to 1/3V | BT 2: 1/3H, 1V to 1/2V | ET 3: 1H, 1/3V to 1/2V",
      SHC: "EZ 1: 1V | TT 1: 1V to 1/3V | HT 1: 1/3V to 1/2V | HT 2: 1/2V | BT 2: 1/2V to 2/3V | ET 3: 1/2V to 2/3V RV after 1/2+",
      STC: "EZ 1: 1/2V | TT 1: 1/2V to 2/3V | HT 2: 2/3V to All -1V RV after 2/3- | BT 2: 2/3V RV from 1/2+ | BT 3: 1/2V to 2/3V RV by 1/3+ | ET 3: 1/2V RV by 1/3+",
      VC: "EZ 1: 2/3V RV at end | TT 1: 2/3V to 1/2V RV after 2/3- | HT 2: 2/3V to 1/2V RV after 1/2+ | BT 2: 1/2V RV by 1/2+ | BT 3: 1/2V to 1/3V RV by 1/3+ | ET 4: 1/3V RV at start",
      "(VC)": "Free 1: 2/3V | EZ 1: 1/2V to 2/3V | TT 2: 1/3V to 1/2V | HT 2: 1V to 1/3V | BT 3: 1V to 1/3V | ET 4: 1V",
      "(STC)": "Free 1: 1/2V to 1/3V | EZ 1: 1/3V to 1V | TT 2: 1V | HT 3: All H | BT 3: All -1H, 1V- | ET 4: 1/2H, 1V- to 1/3V-",
      "(SHC)": "Free 1: 1V | EZ 1: All H | TT 2: All -1H, 0V to 1V- | HT 3: 2/3H, 1V- to 1/3V- | BT 3: 1/2H, 1/3V- to 1/2V- | ET 4: 1/3H, 1/2V- to 2/3V-",
      "(INV)": "Free 1: All H | EZ 1: 2/3H, 1V | TT 2: 1/2H, 1V to 1/2V | HT 3: 1/2H, 1/3V to 1/2V | BT 3: 1/4H, 1/2V to 2/3V | ET 4: 1H, 2/3V RV at end",
      "(SHD)": "Free 1: 1V | EZ 1: 1V to 1/2V | TT 2: 1/3V to 2/3V | HT 2: 1/2V to All -1V | BT 3: 2/3V to All -1V RV after 2/3+ | ET 4: 2/3V to 1/2V RV after 1/2+",
      "(STD)": "Free 1: 1/3V to 1/2V | EZ 1: 1/2V to 2/3V | TT 2: 2/3V to All -1V RV from 2/3+ | HT 2: 2/3V to All V RV from 1/2+ | BT 2: 2/3V RV after 1/3+ | BT 3: 2/3V to 1/2V RV by 1/3+ | ET 3: 1/2V RV at start",
      "(VD)": "EZ 1: All V RV at end | TT 1: 2/3V to All -1V RV after 1/2+ | HT 2: 2/3V to 1/2V RV from 1/2+ | BT 2: 1/2V to 1/3V RV by 1/3+ | ET 3: 1/3V to 1V RV at start",
      VD: "EZ 1: All V to All -1V | TT 1: All -1V to 2/3V | HT 1: 2/3V to 1/2V | HT 2: 1/2V | BT 2: 1/2V to 1/3V | ET 2: 1/3V to 1V | ET 3: 1V",
      STD: "EZ 1: 1/2V | TT 1: 1/2V to 1/3V | HT 1: 1/3V to 1V | HT 2: 1/3V to 1V, no OC+ | BT 2: 1/4V to 1V | ET 3: All H",
      SHD: "EZ 1: 1V, no OC+ | TT 1: 1V to 0V | HT 2: All H | BT 2: 2/3H, 0V to 1V+ | ET 3: 1/2H, 1V+ to 1/3V+" },
    push: {
      LVL: "Free 1: All H | EZ 1: All -1H, 1V | NG TT 2: 1/2H, 1V to 1/3V | NG HT 2: 1/3H, 1/3V to 1/2V | NG BT 3: 1/3H, 1/2V to 2/3V",
      SHD: "Free 1: 1V | EZ 1: 1V to 1/2V | NG TT 2: 1/3V to 2/3V | NG HT 2: 1/2V to All -1V | NG BT 3: 2/3V RV after 1/2+",
      STD: "Free 1: 1/2V | EZ 1: 1/2V to 2/3V | TT 1: 2/3V to All -1V | NG HT 2: 2/3V to All -1V RV from 1/2- | NG BT 2: 2/3V to 1/2V RV by 1/2- | NG BT 3: 1/2V RV by 1/3-",
      VD: "NG EZ 1: All -1V to All V RV by 2/3+ | NG TT 1: 2/3V to All V RV by 1/2+ | NG HT 1: 2/3V to 1/2V RV by 1/3+ | NG BT 2: 1/2V RV after 1",
      "(VD)": "NG EZ 1: All V to 2/3V | NG TT 1: 2/3V | NG HT 1: 2/3V to 1/2V | NG BT 2: 1/2V to 1/3V",
      "(STD)": "NG EZ 1: 1/2V, +Max OC- | NG TT 1: 1/2V | NG HT 1: 1/2V to 1/3V | NG BT 1: 1/3V | NG BT 2: 1/3V to 1V, no OC+",
      "(SHD)": "NG EZ 1: 1V or >1 to 1/4V, Max OC- | NG TT 1: 1V, no OC+ | NG HT 1: 0V to 1V, no OC+ | NG BT 1: All H | NG BT 2: All -1H, 1V+",
      "(INV)": "NG TT 1: All H, no OC+ | NG HT 1: 2/3H, 0V to 1V | NG BT 1: 2/3H, 1V or >1 to 1/4V | NG BT 2: 1/2H, 1V to 1/3V",
      "(SHC)": "NG TT 1: 0V to 1V | NG HT 1: 1V to 1/3V | NG BT 1: 1/3V to 1/2V | NG BT 2: 1/2V",
      "(STC)": "NG TT 1: 1/2V | NG HT 1: 1/2V to 2/3V | NG BT 1: 2/3V to All V | NG BT 2: 2/3V to All V RV after 1/2+",
      "(VC)": "NG TT 1: 2/3V to All V RV after 2/3- | NG HT 1: 2/3V RV after 1/2- | NG BT 1: 1/2V to 2/3V RV from 1/3- | NG BT 2: 1/2V RV by 1/3+",
      VC: "EZ 1: 2/3V to All V | TT 1: 2/3V to 1/2V | NG TT 2: 2/3V to 1/2V | NG HT 2: 1/2V to 1/3V | NG BT 3: 1/3V",
      STC: "Free 1: 1/2V to 1/3V | EZ 1: 1/3V to 1V | NG TT 2: 1/3V to 1V | NG HT 2: 1V | NG BT 3: All H",
      SHC: "Free 1: 1V+, All -1H | EZ 1: All H | NG TT 2: All H | NG HT 2: All -1H, 0V to 1V- | NG BT 3: 1/2H, 1V- to 1/3V-" } };
  const FRACS = { "1/4": 0, "1/3": 1, "1/2": 2, "2/3": 3 };
  // montant d'un code : « All », « All -1 », « 1 », « 1/3 »… ; fractions par la FVT, arrondies (6.1.2) : départ en palier ou
  //  shallow = VFPs arrondis au-dessous, HFPs au-dessus ; départ steep ou vertical = l'inverse
  function fattAmt(term, fps, type, low) {
    const t = term.replace(/\s+/g, ""); let m;
    if ((m = /^All-(\d+)$/.exec(t))) return Math.max(0, fps - +m[1]);
    if (t === "All") return fps;
    if (/^\d+$/.test(t)) return +t;
    if (FRACS[t] !== undefined) { const x = fvt(fps, FRACS[t]); return (type === "V" ? low : !low) ? dn1(x) : up1(x); }
    return NaN;
  }
  // une entrée « NG HT 2: 1/2H, 1V to 1/3V RV after 1/2+ » → { ng, rate, steps, code, rv, noOcUp, maxOcDown, parts }
  function parseFatt(txt) {
    const t = txt.replace(/[–—]/g, "-").trim(), m = /^(NG\s+)?(Free|EZ|TT|HT|BT|ET)\s+(\d):\s*(.*)$/.exec(t);
    if (!m) return null;
    const e = { ng: !!m[1], rate: m[2], steps: +m[3], code: m[4].trim(), rv: null, noOcUp: false, maxOcDown: false };
    let c = e.code;
    const rv = /\s*RV\s+(at start|at end|by|from|after)\s*([\d/]+[+-]?)?\s*$/.exec(c);
    if (rv) { e.rv = { when: rv[1], f: rv[2] || "" }; c = c.slice(0, rv.index); }
    if (/no OC\+/i.test(c)) { e.noOcUp = true; c = c.replace(/,?\s*no OC\+/i, ""); }
    if (/Max OC-/i.test(c)) { e.maxOcDown = true; c = c.replace(/,?\s*\+?\s*Max OC-/i, ""); }
    e.parts = c.split(/\s*,\s*/).filter(Boolean);
    e.label = (e.ng ? "NG " : "") + e.rate + " " + e.steps;
    return e;
  }
  // FPs permis par une entrée : { vLo, vHi, first: { type, n } | null, sign } ; low = départ en palier ou shallow ; fps = FPs à jouer
  function fattRule(e, fps, low) {
    const one = part => {
      let t = part.trim(); const atLeast1 = /\bor\s*>\s*1/.test(t);
      t = t.replace(/\s+or\s+>\s*1V?\s+to\s+/, " to ");
      const type = /H/.test(t) ? "H" : "V", sign = /V\+/.test(t) ? 1 : /V-/.test(t) ? -1 : 0;
      const terms = t.split(/\s+to\s+/).map(x => x.replace(/[HV][+-]?/g, "").trim());
      let vals = terms.map(x => fattAmt(x, fps, type, low));
      if (fps < 2 && low && type === "V") vals = vals.map((v, i) => terms[i] === "1" ? 0 : v);   // « If total FPs < 2.0 »
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (atLeast1) { lo = Math.min(1, fps); hi = Math.max(lo, hi); }
      return { type, sign, lo: Math.max(0, Math.min(fps, lo)), hi: Math.max(0, Math.min(fps, hi)) };
    };
    const P = e.parts.map(one), last = P[P.length - 1];
    const r = { first: P.length > 1 ? { type: P[0].type, n: P[0].lo } : null, sign: (P.find(x => x.type === "V" && x.sign) || {}).sign || 0 };
    if (last.type === "V") { r.vLo = last.lo; r.vHi = last.hi; } else { r.vLo = fps - last.hi; r.vHi = fps - last.lo; }
    if (r.first && r.first.type === "V") { r.vLo = Math.max(r.vLo, r.first.n); r.vHi = Math.max(r.vHi, r.first.n); }
    return r;
  }
  // FP d'un reversal obligatoire : « at start » (avant le 1er FP), « at end », « by f » (≤), « from f » (≥), « after f » (>)
  function rvLimit(rv, fps) {
    if (!rv.f) return null;
    const m = /^([\d/]+)([+-]?)$/.exec(rv.f); if (!m) return null;
    if (FRACS[m[1]] === undefined) return +m[1];
    const x = fvt(fps, FRACS[m[1]]); return m[2] === "-" ? dn1(x) : up1(x);
  }
  const rvText = rv => "RV " + rv.when + (rv.f ? " " + rv.f : "");
  // vitesse mini d'un rythme (4.4, 5.2) ; NG : celle du rythme au-dessus (sinon le plus haut listé + 1.0, 6.5) ; Free et EZ : toujours
  function rateMin(p, band, rate, ng) {
    if (rate === "Free" || (rate === "EZ" && !ng)) return 0;
    if (!ng) return perfVal(p, band, rate);
    const i = RATES.indexOf(rate), up = RATES[i + 1], v = up ? perfVal(p, band, up) : null;
    if (v !== null) return v;
    const hi = RATES.slice(1).reverse().map(r => perfVal(p, band, r)).find(x => x !== null);
    return hi === undefined || hi === null ? null : hi + 1;
  }
  // transitions possibles depuis l'attitude de départ : [{ id, dir, e, endPos, rule, ok, why }]
  // rythme le plus haut permis par les dégâts (index de RATES) : profondeur TT ; commandes molles : un de moins que la vitesse permet
  function rateCap(p, band, s) {
    const D = dmgOf(p); let cap = D.maxRate;
    if (D.sluggish) { let hi = 0; RATES.forEach((r, i) => { const m = i ? perfVal(p, band, r) : 0; if (m !== null && s >= m) hi = i; }); cap = Math.min(cap, Math.max(0, hi - 1)); }
    return cap;
  }
  function fattOptions(p, s, fps, band) {
    const sPos = attOf(p.pitch, p.bank), sInv = isInv(p.bank), low = Math.abs(p.pitch) <= 1, cls = ((adcOf(p) || {}).cls || "F");
    const out = [];
    ["pull", "push"].forEach(dir => {
      String(FATT[dir][attKey(sPos, sInv)] || "").split("|").map(x => parseFatt(x)).filter(Boolean).forEach(e => {
        const endPos = dir === "pull" ? (sPos + e.steps) % 12 : (sPos - e.steps + 12) % 12;
        const o = { id: dir + ":" + (e.ng ? "NG" : "") + e.rate + ":" + e.steps, dir, e, endPos, rule: fattRule(e, fps, low), ok: true, why: "" };
        const m = rateMin(p, band, e.rate, e.ng);
        if (m === null) { o.ok = false; o.why = (e.ng ? "NG " : "") + e.rate + " rate: none on the data card at this band"; }
        else if (s < m) { o.ok = false; o.why = (e.ng ? "NG " : "") + e.rate + " transition needs speed " + fmt1(m) + " (start speed " + fmt1(s) + ", " + (e.ng ? "6.5" : "6.1") + ")"; }
        else if (e.rate === "ET" && p.pq === "Recruit") { o.ok = false; o.why = "recruits may not use the ET rate (13.1)"; }
        else if ((e.rate === "BT" || e.rate === "ET") && dmgOf(p).noBT) { o.ok = false; o.why = "critical hit « No BTs, ETs »"; }
        else if (e.rate !== "Free" && RATES.indexOf(e.rate) + (e.ng ? 1 : 0) > rateCap(p, band, s)) { o.ok = false; o.why = (e.ng ? "NG " : "") + e.rate + " rate: not allowed by the damage (elevators: TT at most; sluggish controls: one rate less)"; }
        else if (/^(M|H)/.test(cls) && !/^MF/.test(cls) && (invSide(endPos) || endPos === 3 || (endPos === 9 && !/^MD/.test(cls)))) { o.ok = false; o.why = "M and H class: no inverted or vertical attitudes (6.1.4)"; }
        out.push(o);
      });
    });
    return out;
  }

  // ---- reports écrits entre crochets dans la ligne de position (p.mcarry) ----
  //  virage « 2HTR » (FPs, rythme, sens ; « 2NHTR » = virage NG, 5.9), roulis « 1RL » / « 1SRL » (snap), slip « 3SSR », skid « 3SKL »,
  //  skidding turn « 3STL » ; vrille « SPIN2L » ; idle forcé « IDLE » (4.3.1) ; tours d'effets NG « NG2 » (3.6) ; tours de piqué
  //  dangereux « DD1 » (4.7) ; compressibilité « COMP1 » (4.7) ; black / red out « GLOC3 » (5.7) ; le reste (« MF », « SD ») est gardé.
  function parseCarry(t) {
    const cs = { turn: null, roll: null, slip: null, spin: null, idle: false, ng: 0, dd: 0, comp: 0, gloc: 0, notes: [] };
    String(t || "").replace(/\b(S[SKT])([LR])\s+(\d+)\s*\/\s*\d+/gi, "$3$1$2").split(/[\s,]+/).filter(Boolean).forEach(tok => {
      let m;
      if ((m = /^SPIN(\d+)([LR])$/i.exec(tok))) cs.spin = { n: +m[1], dir: m[2].toUpperCase() };
      else if ((m = /^(\d+)(N)?(EZ|TT|HT|BT|ET)([LR])(\*)?$/i.exec(tok))) cs.turn = { fps: +m[1], ng: !!m[2], rate: m[3].toUpperCase(), dir: m[4].toUpperCase(), second: !!m[5] };
      else if ((m = /^(\d+)(S)?R([LR])$/i.exec(tok))) cs.roll = { fps: +m[1], snap: !!m[2], dir: m[3].toUpperCase() };
      else if ((m = /^(\d+)(SS|SK|ST)([LR])$/i.exec(tok))) cs.slip = { fps: +m[1], kind: { SS: "slip", SK: "skid", ST: "skidturn" }[m[2].toUpperCase()], side: m[3].toUpperCase() };
      else if (/^IDLE$/i.test(tok)) cs.idle = true;
      else if ((m = /^(NG|DD|COMP|GLOC)(\d+)$/i.exec(tok))) cs[m[1].toLowerCase()] = +m[2];
      else cs.notes.push(tok);
    });
    return cs;
  }
  const SLIP_CODE = { slip: "SS", skid: "SK", skidturn: "ST" };
  function carryText(cs) {
    const out = [];
    if (cs.spin) out.push("SPIN" + cs.spin.n + cs.spin.dir);
    if (cs.turn) out.push(cs.turn.fps + (cs.turn.ng ? "N" : "") + cs.turn.rate + cs.turn.dir + (cs.turn.second ? "*" : ""));
    if (cs.roll) out.push(cs.roll.fps + (cs.roll.snap ? "S" : "") + "R" + cs.roll.dir);
    if (cs.slip) out.push(cs.slip.fps + SLIP_CODE[cs.slip.kind] + cs.slip.side);
    if (cs.idle) out.push("IDLE");
    ["ng", "dd", "comp", "gloc"].forEach(k => { if (cs[k]) out.push(k.toUpperCase() + cs[k]); });
    return out.concat(cs.notes || []).join(" ");
  }

  // ---- position sur la carte ----
  const scr = head => norm360(state.scen.north + 30 * head);
  const parallelAt = (pos, head) => !pos.hex2 || [90, 270].includes(norm360(scr(head) - dirBetween(pos, pos.hex2)));
  // facing sur un côté d'hex : le pion passe d'abord dans l'hex du côté du virage (5.2 ; side −1 gauche, +1 droite)
  function shiftToSide(pos, a, side) {
    if (!pos.hex2) return pos;
    const P = posPoint(pos), v = mapVec(a), right = { x: -v.z, z: v.x };
    const A = hexCenter(pos.c, pos.r), sA = Math.sign((A.x - P.x) * right.x + (A.z - P.z) * right.z);
    return sA === side ? { c: pos.c, r: pos.r, hex2: null } : { c: pos.hex2.c, r: pos.hex2.r, hex2: null };
  }
  // slip / skid (5.4, diagramme 5.4) : l'HFP d'exécution déplace le pion d'un hex en avant, du côté du slip, cap inchangé
  function slipStep(pos, a, side) {
    const P = posPoint(pos), v = mapVec(norm360(a + (isSideDir(a) ? 60 : 30) * side));
    return posAt(P.x + SQ3 * v.x, P.z + SQ3 * v.z);
  }
  const pName = pos => posName(pos);

  // ---- plan par défaut : puissance militaire maxi, pas de transition, pas de ligne ----
  function defaultPlan(p) { return { power: "max", trans: "keep", oc: 0, end: "", fix: "nose", brakes: 0, lines: [] }; }
  const planOf = p => (p.mv = p.mv && Array.isArray(p.mv.lines) ? p.mv : defaultPlan(p));

  const modTxt = m => m ? (m > 0 ? " + " : " − ") + Math.abs(m) : "";
  const sparHits = p => (p.crits || []).filter(c => c === "Wing spar").length;
  const tailHits = p => (p.crits || []).filter(c => c === "Tail structure").length;
  // modificateurs des jets de décrochage en vrille et de sortie de vrille (4.5, Flight Tables page 2), en points de percentile
  function stallMods(p, mv, cs, spinning) {
    const M = [], add = (v, t) => { if (v) M.push({ v, t }); }, a = adcOf(p) || {}, multi = engCount(p) > 1;
    if (!spinning && cs.turn) add(5, "turn carry");
    if (/slat/i.test(a.notes || "")) add(-15, "slatted wings");
    if (/contra/i.test(a.notes || "")) add(-15, "contra-rotating props");
    const pw = mv.power === "emer" ? "emer" : mv.power === "idle" ? "idle" : mv.power === "max" || +mv.power > fvt(powerMax(p, bandOf(p.alt), p.speed) || 0, 1) ? "mil" : "cruise";
    if (pw === "mil") add(multi ? 5 : 10, (multi ? "multi" : "single") + "-engine, military power");
    if (pw === "emer") add(multi ? 10 : 15, (multi ? "multi" : "single") + "-engine, emergency power");
    add({ Recruit: 10, Green: 5, Veteran: -10 }[p.pq] || 0, p.pq.toLowerCase() + " pilot");
    if (p.wia) add(20, "pilot wounded");
    if (spinning && dmgOf(p).rudder) add(30, "rudder knocked out");
    if (isSevere(p)) add(10, "severe damage");
    return M;
  }
  const modsSum = M => M.reduce((t, m) => t + m.v, 0);
  const modsTxt2 = M => M.length ? " (" + M.map(m => (m.v > 0 ? "+" : "−") + Math.abs(m.v) + " " + m.t).join(", ") + ")" : "";
  // modificateurs du piqué dangereux (4.7) : +5 par 0.5 au-dessus, +5 par tour de suite après le premier, +20 sévère, +10 par longeron / queue
  function ddMods(p, s, maxD, cs) {
    const M = [], add = (v, t) => { if (v) M.push({ v, t }); };
    add(5 * Math.round((s - maxD) * 2), "each 0.5 above the safe dive speed");
    add(5 * (cs.dd || 0), "continuous turns of dangerous dive");
    if (isSevere(p)) add(20, "severe damage");
    add(10 * (sparHits(p) + tailHits(p)), "wing spar / tail structure hits");
    return M;
  }
  // compressibilité (4.7) : vitesse transsonique (Turn Chart : 10.0 si ≥ ML, 11.0 si ≥ LO, 12.0 partout) et au-dessus de la maxi listée
  const bandIdx = b => BANDS.findIndex(x => x[0] === b);
  const transonic = (s, band) => s >= 12 || (s >= 11 && bandIdx(band) >= 1) || (s >= 10 && bandIdx(band) >= 2);
  function compMods(p, mv, cs, band, recovery) {
    const M = [], add = (v, t) => { if (v) M.push({ v, t }); };
    add(5 * (cs.comp || 0), "turns at compressibility speed after the first");
    if (+mv.brakes) add(-20, "dive brakes");
    if (recovery) add(5 * bandIdx(band), "altitude bands above VL");
    return M;
  }

  // ---- mouvement en vrille (4.5.2) : vitesse 0, pas de FP, accel / decel à 0, reports perdus ; D10 facings dans le sens de la vrille ;
  //  chute = (tours de vrille × vitesse mini listée arrondie au-dessus + D5) × 100 ft ; bank LB ou RB du côté de la vrille ----
  function spinMove(p, R, ooc, cs) {
    const band = R.band, minL = perfRaw(p, band, "min") || 0;
    let pos = { c: p.c, r: p.r, hex2: p.hex2 ? { c: p.hex2.c, r: p.hex2.r } : null }, head = p.head, alt = p.alt;
    Object.assign(R, { s: 0, fps: 0, newHalf: false, power: 0, pmax: powerMax(p, band, p.speed), pemer: null, maxL: perfVal(p, band, "max"), minS: perfVal(p, band, "min"),
      vLo: 0, vHi: 0, hTot: 0, vTot: 0, oc: 0, mc: 0, A: 0, D: 0, net: 0, dSpeed: 0, rem: 0, end: 0, spin: true, transTxt: "Spin" });
    R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head });
    const keep = () => Object.assign(R, { endPos: pos, endHead: head, endAlt: alt, endPitch: p.pitch, endBank: p.bank, vChange: 0, carry: carryText(cs), powerTxt: "-" });
    R.oocNeed = cs.spin ? "recover" : "stall";
    if (!ooc || ooc.kind !== "spin") { R.errs.push(cs.spin ? "spinning: roll for spin recovery before moving (4.5.2)" : "roll the stall / spin check before moving (4.5)"); return keep(); }
    const n = cs.spin ? cs.spin.n + 1 : 1, dir = cs.spin ? cs.spin.dir : ooc.dir, d5 = Math.ceil(ooc.fall / 2), fall = (n * Math.ceil(minL) + d5) * 100;
    const old = scr(head), side = dir === "L" ? -1 : 1;
    head = ((head + side * ooc.fac) % 12 + 12) % 12;
    if (pos.hex2 && !parallelAt(pos, head)) pos = shiftToSide(pos, old, side);
    alt -= fall;
    R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head });
    const ncs = { spin: { n, dir }, notes: cs.notes.slice(), gloc: cs.gloc ? cs.gloc - 1 : 0 };
    Object.assign(R, { endPos: pos, endHead: head, endAlt: alt, endPitch: -3, endBank: side, vChange: -fall, carry: carryText(ncs), powerTxt: "-", transTxt: "Spin, turn " + n + " of spin" });
    if (!cs.spin) R.notes.push("Stall: spin check % " + ooc.d + modTxt(ooc.mod) + " = " + (ooc.d + ooc.mod) + " ≥ 60: spin (4.5); direction D10 " + ooc.dirRoll + " = " + (dir === "L" ? "left (odd)" : "right (even)"));
    else R.notes.push("Spin recovery: % " + ooc.d + modTxt(ooc.mod) + " = " + (ooc.d + ooc.mod) + " > 50: still spinning (4.5.2)");
    R.lines.push({ h: 0, v: 0, act: "spin", errs: [], txt: "", pos, head, alt,
      note: "Spin " + dir + " " + (30 * ooc.fac) + " (D10 " + ooc.fac + ") to " + HEADINGS[head] + ", fall " + n + "×" + Math.ceil(minL) + " + " + d5 + " (D5) = " + fall + " ft (" + posName(pos) + ")" });
    if (alt <= 0) { R.crash = true; R.notes.push("Altitude 0.0 or below: crashed"); }
    return R;
  }

  function simulate(p) {
    const a = adcOf(p), R = { errs: [], warns: [], lines: [], acc: [], dec: [], notes: [], track: [], gUse: [] };
    let mv = planOf(p);
    const err = t => R.errs.push(t), warn = t => R.warns.push(t);
    const addA = (v, k, t) => { if (v) R.acc.push({ v, k, t }); }, addD = (v, k, t) => { if (v) R.dec.push({ v, k, t }); };
    const band = bandOf(p.alt), cs = parseCarry(p.mcarry), ooc = mv.ooc || null;
    R.band = band;
    if (!a) err("no data card: choose one in the Aircraft tab");
    if (cs.gloc) warn("crew incapacitated (black / red out, " + cs.gloc + " turn" + (cs.gloc > 1 ? "s" : "") + " left): random flight, Random Flight Table (5.7.1) — no combat actions");
    // ---- vrille en cours (4.5.2) : jet de sortie ; sorti → STD ou VD au choix, bank LV, vitesse mini ajustée + 0.5, puis vol normal ----
    if (cs.spin) {
      if (ooc && ooc.kind === "recover") {
        const m0 = perfVal(p, band, "min") || 0;
        const p0 = Object.assign({}, p, { pitch: mv.rec === "VD" ? -3 : -2, bank: 0, speed: m0 + 0.5, acc: 0, half: false, lastV: null,
          mcarry: carryText({ notes: cs.notes, gloc: cs.gloc }), mv: Object.assign({}, mv, { ooc: null, trans: "keep" }) });
        const R0 = simulate(p0);
        R0.notes.unshift("Spin recovery: % " + ooc.d + modTxt(ooc.mod) + " = " + (ooc.d + ooc.mod) + " ≤ 50: recovered — " + (mv.rec === "VD" ? "VD" : "STD") +
          ", wings LV, speed " + fmt1(m0 + (mv.power === "idle" ? 0 : 0.5)) + " (4.5.2)");
        if (mv.trans && mv.trans !== "keep") R0.errs.push("the spin recovery counts as the transition this turn (4.5.2)");
        R0.recovered = true; R0.transTxt = "Spin recovery to " + (mv.rec === "VD" ? "VD" : "STD");
        return R0;
      }
      return spinMove(p, R, ooc, cs);
    }
    // ---- A. puissance (4.1, 4.3.1) : Idle, Cruise (0 à 1/3 de la militaire), Military (> 1/3 à toute), Emergency (toute l'urgence) ----
    const idle = mv.power === "idle";
    if (dmgOf(p).cruiseOnly && (mv.power === "max" || mv.power === "emer" || (+mv.power > fvt(powerMax(p, bandOf(p.alt), p.speed) || 0, 1)))) err("throttle hit: cruise power or less (Combat Tables page 2)");
    if (cs.idle && !idle) err("No F.I. engine: idle power is forced this turn (negative-G effects last turn, 4.3.1)");
    const s = Math.max(0, p.speed - (idle ? 0.5 : 0));        // vitesse de départ pour tout le tour (idle : −0.5 avant de bouger)
    R.s = s;
    const pmil = powerMax(p, band, p.speed), pemer = powerMax(p, band, p.speed, true);
    R.pmax = pmil; R.pemer = pemer !== pmil ? pemer : null;
    const third = pmil === null ? 0 : fvt(pmil, 1);
    R.cruiseMax = third;
    let setting = idle ? "idle" : mv.power === "emer" ? "emer" : mv.power === "max" ? "mil" : +mv.power <= third + 1e-9 ? "cruise" : "mil";
    if (setting === "emer" && R.pemer === null) { warn("no emergency power listed at this speed and band: military power used"); setting = "mil"; }
    R.setting = setting;
    const maxL = maxAttain(p, band, setting), listedMax = perfRaw(p, band, "max"), minS = perfVal(p, band, "min"), maxD = perfVal(p, band, "dive");
    R.maxL = maxL; R.minS = minS; R.maxD = maxD;
    if (a && listedMax === null) err("the data card has no performance at this altitude band (" + band + ")");
    // plafond (6.3) : chargé / surchargé = 2e / 3e plafond de la fiche ; au-dessus : puissance ÷ 2, decel de montée, virages, manœuvres × 2
    const ceils = String((a && a.ceiling) || "").replace(/,/g, "").match(/\d{4,6}/g) || [];
    const ceil = ceils.length ? +(ceils[dmgOf(p).L.ceil] || ceils[0]) : null, above = ceil !== null && p.alt > ceil;
    const k2 = above ? 2 : 1;
    if (above) warn("above the " + (dmgOf(p).L.k || "normal") + " ceiling (" + ceil + " ft): power halved, climb / turn / maneuver decel doubled (6.3)");
    // ---- B. contrôle : décrochage (4.5), piqué dangereux et compressibilité (4.7) ----
    let stall = false, comp = 0;
    if (minS !== null && s < minS) {
      R.oocNeed = "stall";
      if (!ooc || !["stall", "spin"].includes(ooc.kind)) err("start speed " + fmt1(s) + " below the adjusted minimum speed " + fmt1(minS) + ": roll the stall / spin check before moving (4.5)");
      else if (ooc.kind === "spin") return spinMove(p, R, ooc, cs);
      else stall = true;
    }
    if (maxD !== null && s > maxD) {
      R.ddNeed = true; R.ddMods = ddMods(p, s, maxD, cs);
      if (!mv.dd) err("start speed " + fmt1(s) + " above the adjusted safe dive speed " + fmt1(maxD) + ": roll for dangerous dive (4.7)");
      else if (mv.dd.destroyed) { R.destroyed = true; R.notes.push("Dangerous dive: % " + mv.dd.d + modTxt(mv.dd.mod) + " = " + (mv.dd.d + mv.dd.mod) + " ≥ 95: aircraft destroyed (4.7)"); }
      else R.notes.push("Dangerous dive: % " + mv.dd.d + modTxt(mv.dd.mod) + " = " + (mv.dd.d + mv.dd.mod) + ", no structural failure (4.7)");
    }
    if (listedMax !== null && transonic(s, band) && s > listedMax) {
      R.compNeed = cs.comp ? "recover" : "check"; R.compMods = compMods(p, mv, cs, band, !!cs.comp);
      if (!mv.comp) err(cs.comp ? "compressibility: roll for recovery before moving (4.7)" : "transonic speed above the max level speed: roll for compressibility (4.7)");
      else if (mv.comp.yes) { comp = (cs.comp || 0) + 1; R.notes.push((cs.comp ? "Compressibility recovery: % " : "Compressibility: % ") + mv.comp.d + modTxt(mv.comp.mod) + " = " + (mv.comp.d + mv.comp.mod) + (cs.comp ? " > 50: no recovery" : " ≥ 60: loss of control") + ", turn " + comp + " (4.7)"); }
      else R.notes.push((cs.comp ? "Compressibility recovery: % " + mv.comp.d + modTxt(mv.comp.mod) + " = " + (mv.comp.d + mv.comp.mod) + " ≤ 50: recovered" : "Compressibility: % " + mv.comp.d + modTxt(mv.comp.mod) + " = " + (mv.comp.d + mv.comp.mod) + " < 60: no effect") + " (4.7)");
    } else if (cs.comp) R.notes.push("Compressibility ends: speed no longer transonic above the max level speed (4.7)");
    // ---- C. accel du moteur (4.1, 4.4) : 0 si la vitesse de départ dépasse la maxi atteignable ; excès de vitesse = 2 × l'écart ----
    let power = 0;
    const startOver = idle ? s : p.speed;
    if (maxL !== null && startOver > maxL + 1e-9) {
      const v = 2 * (startOver - maxL);
      addD(v, idle ? "iovs" : "os", (idle ? "idle " : "") + "excess speed 2 × (" + fmt1(startOver) + " − " + fmt1(maxL) + " max attainable) (4.2)");
      R.notes.push("Excess speed decel = 2*(" + fmt1(startOver) + "-" + fmt1(maxL) + ") = " + num(v));
    }
    if (idle) R.powerTxt = "I, Speed " + fmt1(s);
    else if (maxL !== null && startOver > maxL + 1e-9) R.powerTxt = { mil: "M", emer: "E", cruise: "C" }[setting] + " 0 (start speed above max attainable)";
    else {
      power = setting === "emer" ? (pemer || 0) : setting === "mil" ? (mv.power === "max" ? (pmil || 0) : Math.min(+mv.power || 0, pmil || 0)) : Math.min(+mv.power || 0, third);
      if (above) power = fvt(power, 2);
      addA(power, "p", { mil: "military", emer: "emergency", cruise: "cruise" }[setting] + " power (4.1)" + (above ? ", halved above ceiling" : ""));
      R.powerTxt = { mil: "M", emer: "E", cruise: "C" }[setting] + " " + num(power);
    }
    R.power = power;
    // ---- D. FPs à jouer (3.5) : demi-FP reporté + nouveau demi-FP = un FP de plus ; décroché : demi-FP reporté perdu (4.5.1) ----
    const full = Math.floor(s + 1e-9), hasHalf = Math.abs(s - full - 0.5) < 1e-9, half = stall ? false : p.half;
    let fps = full + (hasHalf && half ? 1 : 0);
    const newHalf = hasHalf ? !half : half;
    if (stall && s < 1) fps = Math.max(fps, 1);
    R.fps = fps; R.newHalf = newHalf;
    // ---- E. attitude : transition (FATT, 6.1) ou vol standard (6.2) ; décrochage et compressibilité joués par la page ----
    const sPos = attOf(p.pitch, p.bank), sInv = isInv(p.bank), low = Math.abs(p.pitch) <= 1;
    R.sPos = sPos; R.sInv = sInv;
    const opts = a ? fattOptions(p, s, fps, band) : [];
    R.opts = opts;
    let endPos = sPos, trans = null, auto = null, rule = null;
    if (stall) {                                                 // 4.5.1 : nez 3 pas vers VD (push à l'endroit, pull inversé), sans decel
      for (let k = 0; k < 3 && endPos !== 9; k++) endPos = sInv ? (endPos + 1) % 12 : (endPos + 11) % 12;
      auto = { why: "Stalled (% " + ooc.d + modTxt(ooc.mod) + " = " + (ooc.d + ooc.mod) + " < 60): nose 3 steps toward VD, no decel (4.5.1)" };
    } else if (comp) {                                           // 4.7 : 1er tour, attitude gardée ; ensuite un pas vers VD (EZ, sans decel)
      if (comp > 1 && endPos !== 9) endPos = (9 - endPos + 12) % 12 <= (endPos - 9 + 12) % 12 ? (endPos + 1) % 12 : (endPos + 11) % 12;   // le plus court vers VD
      auto = { why: "Compressibility: controls useless" + (comp > 1 ? ", nose one step toward VD" : ", attitude kept") + "; max VFPs and OC (4.7)" };
    } else if (mv.trans && mv.trans !== "keep") {
      trans = opts.find(o => o.id === mv.trans) || null;
      if (!trans) err("this transition is not possible from " + attLabel(sPos, sInv) + ": choose again (6.1)");
      else { if (!trans.ok) err(trans.why); endPos = trans.endPos; }
    }
    const endPitch0 = ATT_PITCH[endPos];
    const ng = !!(trans && trans.e.ng), pull = !!(trans && trans.dir === "pull");
    R.trans = trans; R.ngTrans = ng;
    if (trans) {
      const e = trans.e;
      rule = Object.assign({}, trans.rule);
      // 6.1.4 : vers une attitude moins raide, pas besoin de plus de VFPs qu'au tour précédent
      if (Math.abs(endPitch0) < Math.abs(p.pitch) && p.lastV !== null && p.lastV !== undefined && rule.vLo > p.lastV) { R.notes.push("Transition VFP exception: " + p.lastV + " VFP" + (p.lastV > 1 ? "s" : "") + " last turn (6.1.4)"); rule.vLo = p.lastV; }
      if (e.rate !== "Free") {
        const r2 = decelRate(e.rate, s), d = turnDecel(p, r2) * e.steps * k2;
        addD(d, pull ? "pt" : "pu", (e.ng ? "NG " : "") + e.rate + " transition, " + e.steps + " step" + (e.steps > 1 ? "s" : "") + " × " + num(turnDecel(p, r2)) + (r2 !== e.rate ? " (" + r2 + " decel at speed " + fmt1(s) + ", 5.5.1)" : "") + " (4.2, 6.1.4)");
        R.transDecel = d;
      }
      R.gUse.push({ rate: e.rate === "Free" ? "EZ" : e.rate, ng: e.ng, n: e.steps });
      R.transTxt = (pull ? "Pull " : "Push ") + e.label + " to " + attLabel(endPos, invSide(endPos) || ((endPos === 3 || endPos === 9) && (sInv !== !!e.rv))) + ": " + e.code;
    } else if (auto) R.transTxt = auto.why;
    else R.transTxt = "None, " + attLabel(sPos, sInv);
    R.stall = stall; R.comp = comp;
    // FPs permis sans transition : Standard Altitude Change Table (6.2)
    if (!rule) {
      const st = Math.abs(auto ? endPitch0 : p.pitch);
      if (st === 0) rule = { vLo: 0, vHi: 0 };
      else if (st === 1) rule = { vLo: 0, vHi: Math.min(fps - 1, Math.max(1, dn1(fvt(fps, 0)))) };   // shallow : 0, 1 ou >1 à 1/4, au moins un HFP
      else if (st === 2) rule = { vLo: Math.min(1, fps), vHi: up1(fvt(fps, 2)) };
      else rule = { vLo: Math.floor(fps / 2) + 1, vHi: fps };
      rule.vLo = Math.max(0, Math.min(fps, rule.vLo)); rule.vHi = Math.max(rule.vLo, Math.min(fps, rule.vHi)); rule.first = null; rule.sign = 0;
      if (auto) { const dive = (auto ? endPitch0 : p.pitch) < 0; rule.vLo = rule.vHi = dive ? rule.vHi : 0; }   // décroché : piqué maxi, pas de VFP en montée
    }
    R.vLo = rule.vLo; R.vHi = rule.vHi; R.rule = rule;
    R.hMin = fps - rule.vHi; R.hMax = fps - rule.vLo;
    const vDir = rule.sign || Math.sign(endPitch0) || Math.sign(p.pitch);
    R.vDir = vDir;
    if (auto) mv = Object.assign({}, mv, { trans: "keep", end: "", lines: [rule.vHi ? { h: 0, v: rule.vHi, act: "fly" } : null, fps - rule.vHi ? { h: fps - rule.vHi, v: 0, act: "fly" } : null].filter(Boolean) });
    // ---- attitude de départ : decel de montée / accel de piqué de la fiche (4.1, 4.2) ----
    if (p.pitch > 0 && a) addD(a.climbDecel * k2, "ca", "start attitude is a climb: ADC climb decel (4.2)");
    if (p.pitch < 0 && a) addA(a.diveAccel, "da", "start attitude is a dive: ADC dive accel (4.1)");
    if (+mv.brakes && /dive brakes/i.test((a && a.notes) || "")) addD(clamp(+mv.brakes, 5, 10), "db", "dive brakes (4.2)");

    // ---- F. vol standard pur vertical (6.2) et MC (6.1.3) : changement imposé par l'attitude de DÉPART, appliqué au début ----
    const planV = mv.lines.reduce((t, L) => t + Math.max(0, Math.round(+L.v || 0)), 0), planH = mv.lines.reduce((t, L) => t + Math.max(0, Math.round(+L.h || 0)), 0);
    const pureV = !auto && Math.abs(p.pitch) === 3 && Math.abs(endPitch0) === 3 && fps > 0 && planV === fps && planH === 0;
    R.pureV = pureV;
    let mc = 0;
    const sSt = Math.abs(p.pitch);
    if (stall && s < 1) mc = -3;
    else if (sSt === 1) mc = up1(fvt(fps, 1)); else if (sSt === 2) mc = up1(fvt(fps, 2)); else if (sSt === 3 && !pureV) mc = up1(fvt(fps, 1));
    if (sSt && !(stall && s < 1)) mc *= Math.sign(p.pitch);
    R.mc = mc * 100;
    let pos = { c: p.c, r: p.r, hex2: p.hex2 ? { c: p.hex2.c, r: p.hex2.r } : null }, head = p.head, bank = p.bank, alt = p.alt;
    R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head });
    if (mc) { alt += mc * 100; R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head }); }

    // ---- G. les lignes du mouvement ----
    let roll = cs.roll ? Object.assign({}, cs.roll, { carried: true, h: 0, v: 0 }) : null;
    let turn = cs.turn ? Object.assign({}, cs.turn, { prog: cs.turn.fps, paid: true, carried: true }) : null;
    let slip = cs.slip ? Object.assign({}, cs.slip, { prog: cs.slip.fps, paid: true, carried: true, ready: cs.slip.fps >= slipNeed(p, s) }) : null;
    if ((auto) && (roll || turn || slip)) { R.notes.push((stall ? "Stalled" : "Compressibility") + ": carried roll / turn / slip lost (4.5.1)"); roll = turn = slip = null; }
    if (ng && turn && !turn.ng) { R.notes.push("NG transition: positive-G turn carry lost (6.5)"); turn = null; }
    if (pull && turn && turn.ng) { R.notes.push("pull transition: NG turn carry lost (6.1.4)"); turn = null; }
    // stall : bank D10 (≤ 6 : LV ou IV ; 7+ : un pas à gauche si impair, à droite si pair)
    if (stall) {
      const b0 = bank; bank = ooc.bankRoll <= 6 ? (isInv(bank) ? 3 : 0) : norm6(bank + (ooc.bankRoll % 2 ? -1 : 1));
      R.notes.push("Stall bank D10 " + ooc.bankRoll + ": " + BANKS[b0] + " to " + BANKS[bank] + " (4.5.1)");
    }
    R.etFac = 0; R.snaps = 0; R.slipKind = cs.slip && !auto ? (cs.slip.kind === "slip" ? "slip" : "skid") : "";
    R.rateMax = Math.max(turn ? RATES.indexOf(turn.rate) : -1, trans ? Math.max(0, RATES.indexOf(trans.e.rate)) : -1);
    const vertical = Math.abs(endPitch0) === 3, intoVertBad = trans && vertical && Math.abs(p.pitch) !== 3 && (trans.e.rate === "Free" || trans.e.rate === "EZ" || trans.e.steps > 1);
    const halfUp = up1(fvt(fps, 2));
    let anyInv = false, abandons = 0, used = 0, hTot = 0, vTot = 0, maneuvers = 0, lastFace = false, rvDone = false, freeDone = false;
    let everUpright = !sInv, sameSide = bank === 1 || bank === 2 ? 1 : bank === -1 || bank === -2 ? -1 : 0, posTurns = 0, ngTurns = 0, ngUprightFac = 0, invPosFac = 0;
    const startSide = sameSide;
    const turnTot = { pos: 0, ng: 0 };
    const seq = [];
    const chartS = (() => {                                     // 5.5 : steep / vertical tout le tour, ou pull inversé ≥ 2 pas → vitesse −1.0
      if (s < 2) return s;
      const path = []; if (trans) for (let k = 0; k <= trans.e.steps; k++) path.push(trans.dir === "pull" ? (sPos + k) % 12 : (sPos - k + 12) % 12); else path.push(sPos);
      if (path.every(i => Math.abs(ATT_PITCH[i]) >= 2)) { R.steepBonus = "steep / vertical attitudes all turn"; return s - 1; }
      if (pull && trans.e.steps >= 2 && sInv && (invSide(trans.endPos) || ((trans.endPos === 3 || trans.endPos === 9) && !trans.e.rv))) { R.steepBonus = "inverted pull transition with gravity"; return s - 1; }
      return s;
    })();
    R.chartS = chartS;
    const cap = rateCap(p, band, s);
    const legalRate = (r, ngT) => {
      if (RATES.indexOf(r) + (ngT ? 1 : 0) > cap && !(r === "EZ" && !ngT)) return false;
      if (r === "EZ" && !ngT) return true;
      if ((r === "BT" || r === "ET") && dmgOf(p).noBT) return false;
      const m = rateMin(p, band, r, ngT); return m !== null && s >= m && !!chartEntry(chartS, r);
    };
    if (turn && !legalRate(turn.rate, turn.ng)) {                  // vitesse changée : rythme permis le plus proche au-dessous
      const lower = RATES.slice(0, RATES.indexOf(turn.rate)).reverse().find(r => legalRate(r, turn.ng)) || "EZ";
      R.notes.push("Carried " + turn.rate + " turn: rate not allowed at the new speed, continued at " + lower); turn.rate = lower;
    }
    const sideOf = d => d === "L" ? -1 : 1;
    const bankDir = () => bank < 0 ? "L" : bank > 0 && bank < 3 ? "R" : "";   // 5.1 : IL / LB à gauche, RB / IR à droite, LV / IV : pas de virage
    function abandonTurn(why) {
      if (!turn || (!turn.prog && !turn.paid)) { turn = null; return; }
      abandons++; if (abandons > 1) err("only one declared or carried turn may be abandoned per game turn (5.2)");
      R.notes.push((turn.carried ? "Carried " : "") + (turn.ng ? "NG " : "") + turn.rate + turn.dir + " turn abandoned" + (why ? " (" + why + ")" : "") + ", " + turn.prog + " FP lost (5.2)");
      turn = null;
    }
    function face(n, dir) {
      const old = scr(head);
      head = ((head + n * sideOf(dir)) % 12 + 12) % 12;
      if (pos.hex2 && !parallelAt(pos, head)) pos = shiftToSide(pos, old, sideOf(dir));
      lastFace = dir;
    }
    mv.lines.forEach((L, i) => {
      const h = Math.max(0, Math.round(+L.h || 0)), v = Math.max(0, Math.round(+L.v || 0)), n = h + v, act = L.act || "fly";
      const out = { h, v, act, txt: "", errs: [] };
      const lerr = t => { out.errs.push(t); err("line " + (i + 1) + ": " + t); };
      const zero = act === "rv" || act === "free";
      lastFace = false;
      if (!n && !zero) lerr("no FP on this line");
      if (n && zero) lerr("this action uses no FP: put the FPs on other lines");
      const turning = act === "turn" ? bankDir() : act === "ngturn" ? (bankDir() ? (bankDir() === "L" ? "R" : "L") : "") : "";
      for (let k = 0; k < h; k++) {
        const nx = stepFrom(pos, scr(head));
        if (!nx) { lerr("off the map"); break; }
        pos = nx; seq.push("H"); R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head, fp: true, trn: turning });
      }
      if (v) {
        if (!vDir) lerr("VFPs are not allowed in level flight without a transition (3.6)");
        for (let k = 0; k < v; k++) { alt += vDir * 300; seq.push("V"); R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head, fp: true, trn: turning }); }
      }
      const before = used;
      used += n; hTot += h; vTot += v;
      const rolling = ["rollL", "rollR", "snapL", "snapR"].includes(act);
      if (auto && act !== "fly") lerr("no turns, rolls or maneuvers while " + (stall ? "stalled (4.5.1)" : "in compressibility (4.7)"));
      if (roll && !rolling) lerr("the roll started must be finished first, or abandoned (5.1)");
      if (slip && !slip.ready && !["slipL", "slipR", "skid", "skidturn"].includes(act)) { R.notes.push((slip.carried ? "Carried " : "") + "slip / skid set-up abandoned (5.4)"); slip = null; }
      if (turn && !["turn", "ngturn", "rv", "free"].includes(act) && !rolling) abandonTurn("");
      let txt = "";
      if (rolling) {
        const dir = act.endsWith("L") ? "L" : "R", snap = act.startsWith("snap"), target = norm6(bank + sideOf(dir));
        const sameSideRoll = target !== 0 && target !== 3 && Math.sign(target) === Math.sign(bank) && bank !== 3;
        if (turn && !(sameSideRoll && !snap && !turn.ng && turn.dir === bankDir())) abandonTurn(target === 0 || target === 3 ? "rolling toward " + BANKS[target] : "rolled");
        else if (turn) turn.prog += n;                            // 5.2 : roulis entre LB et IL (ou RB et IR) compté pour le virage
        if (roll && roll.dir !== dir) lerr("a roll to the " + (roll.dir === "L" ? "left" : "right") + " is in progress");
        else {
          if (!roll) {
            roll = { dir, snap, fps: 0, h: 0, v: 0, start: before };
            if (snap && dmgOf(p).noSnap) lerr("no snap rolls: ailerons or rudder hit");
            if (snap) {
              const cls = (a && a.cls) || "F";
              if (p.pq === "Recruit") lerr("recruits may not snap roll (13.1)");
              if (/^(M|H)/.test(cls) && !/^MF/.test(cls)) lerr("M and H class may not snap roll (7.0)");
              if (bankNeed(p, s, dir) <= 1) lerr("snap roll: banking FPs already 1 (7.0)");
              addD(3 * k2, "sn", "snap roll (7.0)"); maneuvers++;
            }
          } else if (snap !== roll.snap) lerr("a roll started may not be changed into a snap roll (7.0)");
          const need = Math.max(1, bankNeed(p, s, roll.dir) - (roll.snap ? 1 : 0));
          roll.fps += n; roll.h += h; roll.v += v;
          if (roll.fps > need) lerr("the roll needs " + need + " FP" + (need > 1 ? "s" : "") + " (Banking FPs" + (roll.snap ? " − 1, snap roll" : "") + "): put the other FPs on another line");
          const done = roll.fps >= need;
          txt = (roll.snap ? "S" : "") + "R" + roll.dir + " " + Math.min(roll.fps, need) + "/" + need;
          if (done) {
            const b0 = bank; bank = norm6(bank + sideOf(roll.dir)); txt += " to " + BANKS[bank];
            // roll vertical (5.3) : en vertical, le roulis change le facing (montée : sens opposé au roulis ; piqué : même sens)
            const vf = Math.max(0, Math.round(+L.fac || 0));
            if (vertical && vf) {
              const maxF = roll.v === 0 ? 1 : roll.h === 0 ? 3 : 2, fdir = endPitch0 > 0 ? (roll.dir === "L" ? "R" : "L") : roll.dir;
              if (p.pq === "Recruit") lerr("recruits may not do vertical rolls (13.1)");
              else if (roll.carried) lerr("normal roll carry may not be used for a vertical roll (5.3)");
              else if (vf > maxF) lerr("vertical roll: " + (maxF * 30) + "° at most (" + (maxF === 1 ? "only HFPs" : maxF === 2 ? "HFPs and VFPs" : "only VFPs") + " in the roll, 5.3)");
              else if (intoVertBad && roll.start < halfUp) lerr("transitioned to vertical at Free / EZ rate or with more than one step: no vertical roll FPs in the first half of the move (first " + halfUp + " FPs, 5.3)");
              else {
                face(vf, fdir); txt += ", VR " + fdir + (30 * vf) + " to " + HEADINGS[head];
                if (L.keep === "back") { bank = b0; txt += ", bank back to " + BANKS[bank]; }
                maneuvers++;
              }
            }
            roll = null;
          }
        }
      } else if (act === "turn" || act === "ngturn") {
        const isNG = act === "ngturn", rate = L.rate || "EZ", fac = Math.max(0, Math.round(+L.fac || 0));
        const dir = isNG ? (bankDir() === "L" ? "R" : bankDir() === "R" ? "L" : "") : bankDir();
        const cls = (a && a.cls) || "F";
        R.rateMax = Math.max(R.rateMax, RATES.indexOf(rate));
        if (!dir) lerr("wings LV or IV: bank first (5.1)");
        else if (pureV) lerr("pure vertical flight: no turning, only vertical rolls (5.3)");
        else if (isNG && pull) lerr("NG turns are not allowed with a pull transition (5.9)");
        else if (!isNG && ng) lerr("positive-G turns are not allowed with an NG transition (6.5)");
        else if (isNG && (p.pq === "Recruit" || p.pq === "Green")) lerr("only regular or veteran pilots may do NG turns (5.9, 13.1)");
        else if (isNG && !/^(F|L|MF)/.test(cls)) lerr("NG turns: F, L or MF class only (5.9)");
        else if (isNG && rate === "ET") lerr("NG turns: up to the BT rate (5.9)");
        else if (!legalRate(rate, isNG)) lerr((isNG ? "NG " : "") + rate + " rate not allowed at speed " + fmt1(s) + " in band " + band + (rate === "EZ" && !isNG ? "" : " (minimum " + (rateMin(p, band, rate, isNG) === null ? "–" : fmt1(rateMin(p, band, rate, isNG))) + (isNG ? ", one rate higher for NG" : "") + ", 5.2)"));
        else if (p.pq === "Recruit" && rate === "ET") lerr("recruits may not use the ET rate (13.1)");
        else {
          if (turn && (turn.dir !== dir || turn.rate !== rate || !!turn.ng !== isNG)) {
            if (turn.prog || turn.paid) abandonTurn(turn.dir !== dir ? "other direction" : "new rate " + rate); else turn = null;
          }
          if (isNG && slip) { R.notes.push("NG turn started: slip / skid carry lost (5.9)"); slip = null; }
          if (!turn) turn = { rate, dir, ng: isNG, prog: 0, paid: false, second: false };
          const E = chartEntry(chartS, rate), dr = decelRate(rate, s), dd = turnDecel(p, dr) * k2, key = (isNG ? "n" : "") + rate.toLowerCase();
          const dtxt = (isNG ? "NG " : "") + rate + " turn" + (dr !== rate ? " (" + dr + " decel at speed " + fmt1(s) + ", 5.5.1)" : "");
          if (!turn.paid) { addD(dd, key, dtxt + ", 30° (4.2)"); turn.paid = true; turnTot[isNG ? "ng" : "pos"] += dd; }
          turn.prog += n;
          const req = E.deg ? 1 : E.req[turn.second && E.req.length > 1 ? 1 : 0];
          txt = (isNG ? "NG " : "") + rate + " " + Math.min(turn.prog, Math.max(req, turn.prog)) + "/" + req;
          if (fac) {
            const maxFac = E.deg ? E.deg / 30 : 1;
            if (turn.prog < req) lerr(rate + " at speed " + fmt1(chartS) + " needs " + req + " FP" + (req > 1 ? "s" : "") + " before the facing change (" + turn.prog + " so far, 5.2)");
            else if (fac > maxFac) lerr(E.deg ? "at most " + E.deg + "° per FP at this rate and speed (5.2)" : "one 30° facing per " + req + " FP" + (req > 1 ? "s" : "") + ": put the next one on another line (5.2)");
            else {
              for (let k = 1; k < fac; k++) { addD(dd, key, dtxt + ", extra 30° (4.2)"); turnTot[isNG ? "ng" : "pos"] += dd; }
              if (!isNG && isInv(bank)) invPosFac += fac;
              if (isNG && !isInv(bank)) ngUprightFac += fac;
              face(fac, dir);
              R.gUse.push({ rate, ng: isNG, n: fac });
              if (rate === "ET") R.etFac += fac;
              txt = (isNG ? "NG " : "") + rate + " " + req + "/" + req + " " + dir + (30 * fac) + " to " + HEADINGS[head];
              turn = { rate, dir, ng: isNG, prog: 0, paid: false, second: E.req && E.req.length > 1 };
              maneuvers++;
            }
          }
          if (isNG) ngTurns++; else posTurns++;
          if (rate === "ET") R.et = true;
        }
      } else if (["slipL", "slipR", "skid", "skidturn"].includes(act)) {
        const kind = act.startsWith("slip") ? "slip" : act;
        const side = kind === "slip" ? (act === "slipL" ? "L" : "R") : (bank < 0 ? "R" : "L");
        if (ng) lerr("no slips or skids with an NG transition (5.4)");
        else if (dmgOf(p).noSlip) lerr("rudder knocked out: no slips or skids");
        else if (isInv(bank)) lerr("slips need an upright bank (LV, LB or RB), skids LB or RB (5.4)");
        else if (kind !== "slip" && !bank) lerr("wings level: only slips (5.4)");
        else if (kind === "slip" && bank && sideOf(side) !== Math.sign(bank)) lerr("banked: slip toward the bank, or skid away from it (5.4)");
        else {
          if (slip && (slip.kind !== kind || slip.side !== side)) { R.notes.push("slip / skid set-up changed: the first one is abandoned (5.4)"); slip = null; }
          if (!slip) {
            slip = { kind, side, prog: 0 };
            const base = kind === "skidturn" ? "BT" : "HT";
            let d = legalRate(base, false) ? turnDecel(p, base) : null;
            if (d === null) { const hi = RATES.slice().reverse().find(r => legalRate(r, false)) || "EZ"; d = turnDecel(p, hi) + 1; }
            addD(d * k2, kind === "slip" ? "ss" : kind === "skid" ? "sk" : "st", (kind === "slip" ? "slip" : kind === "skid" ? "skid" : "skid with facing change") + " started (5.4)");
            maneuvers++;
          }
          const need = slipNeed(p, s);
          slip.prog += n; slip.ready = slip.prog >= need;
          txt = SLIP_CODE[kind] + side + " " + Math.min(slip.prog, need) + "/" + need;
        }
      } else if (act === "exec") {
        if (!slip || !slip.ready) lerr("no slip or skid ready to execute (set-up FPs not met, 5.4)");
        else if (h !== 1 || v !== 0) lerr("the slip or skid is executed with one HFP (5.4): 1H on this line");
        else {
          const back = R.track[R.track.length - 2], from = { c: back.c, r: back.r, hex2: back.hex2 };
          const nx = slipStep(from, scr(head), sideOf(slip.side));
          if (!nx) lerr("off the map");
          else { pos = nx; R.track[R.track.length - 1] = { c: pos.c, r: pos.r, hex2: pos.hex2, alt, head, fp: true, trn: "" }; }
          txt = "X" + SLIP_CODE[slip.kind] + slip.side;
          if (slip.kind === "skidturn" && +L.fac !== 0) { face(1, bankDir()); txt += " " + bankDir() + "30 to " + HEADINGS[head]; }
          slip = null;
        }
      } else if (act === "rv") {                                // reversal obligatoire du code FATT (6.4)
        const rv = trans && trans.e.rv;
        if (!rv) lerr("no mandatory reversal in this transition (optional reverse: « End of move »)");
        else if (rvDone) lerr("only one reversal");
        else {
          const lim = rvLimit(rv, fps), k = used;
          const okT = rv.when === "at start" ? k === 0 : rv.when === "at end" ? k === fps : rv.when === "by" ? k >= 1 && k <= lim : rv.when === "from" ? k >= lim : k > lim;
          if (!okT) lerr(rvText(rv) + (lim !== null ? " (FP " + lim + " of " + fps + ")" : "") + ": this reversal comes after FP " + k + " (6.4)");
          const banked = bank !== 0 && bank !== 3, fac = banked ? (+L.fac === 4 ? 4 : 5) : 6;
          const dir = banked ? (pull ? bankDir() : (bankDir() === "L" ? "R" : "L")) : "R";
          face(fac, dir); bank = flipBank(bank); rvDone = true; maneuvers++;
          if (!banked) lastFace = "N";
          txt = "RV " + (30 * fac) + (banked ? dir : "") + " to " + HEADINGS[head] + ", bank " + BANKS[bank];
        }
      } else if (act === "free") {                              // facing induit par la transition (6.6)
        const steepPath = trans && (() => { for (let k = 0; k <= trans.e.steps; k++) { const q = trans.dir === "pull" ? (sPos + k) % 12 : (sPos - k + 12) % 12; if (Math.abs(ATT_PITCH[q]) >= 2) return true; } return false; })();
        const dir = pull ? bankDir() : (bankDir() === "L" ? "R" : "L");
        if (freeDone) lerr("one free facing only (6.6)");
        else if (!trans || trans.e.steps < 2 || !steepPath) lerr("free facing: transition of 2 or more steps into, through or out of steep or vertical attitudes (6.6)");
        else if (!startSide || !bankDir() || Math.sign(bank) !== startSide) lerr("free facing: banked left or right to the same side all the move (6.6)");
        else if (used <= halfUp) lerr("free facing: only after an FP in the second half of the move (after FP " + halfUp + ", 6.6)");
        else { face(1, dir); freeDone = true; txt = "Free facing " + dir + "30 to " + HEADINGS[head] + " (6.6)"; }
      }
      // bank pendant le tour : vol inversé tout le tour (3.6), même côté pour le facing gratuit (6.6)
      if (!isInv(bank)) everUpright = true; else anyInv = true;
      if (bank === 0 || bank === 3 || Math.sign(bank) !== startSide) sameSide = 0;
      if (lastFace) { const t = R.track[R.track.length - 1]; Object.assign(t, { c: pos.c, r: pos.r, hex2: pos.hex2, head, trn: lastFace === "N" ? "" : lastFace }); }
      if (act === "snapL" || act === "snapR") R.snaps++;
      if (["slipL", "slipR", "skid", "skidturn", "exec"].includes(act)) R.slipKind = act.startsWith("slip") || (act === "exec" && !/SK|ST/.test(txt)) ? (R.slipKind === "skid" ? "skid" : "slip") : "skid";
      R.lastFaceDir = lastFace && lastFace !== "N" ? lastFace : "";
      out.txt = txt; out.pos = { c: pos.c, r: pos.r, hex2: pos.hex2 }; out.head = head; out.alt = alt;
      out.note = (zero ? "" : (h && v ? h + "H/" + v + "V" : h ? h + "H" : v + "V") + (txt ? " " : "")) + txt + " (" + pName(pos) + ")";
      R.lines.push(out);
    });
    // ---- H. contrôles de fin : FPs, VFPs du code, ordre en deux parties, reversal ----
    if (used !== fps) err("the lines use " + used + " FP" + (used > 1 ? "s" : "") + ", " + fps + " to play: all full FPs must be expended (3.5)");
    else {
      if (vTot < rule.vLo || vTot > rule.vHi) err((trans ? trans.e.label + " transition (" + trans.e.code + ")" : "Standard Altitude Change Table, " + attLabel(sPos, sInv)) + ": " +
        (rule.vLo === rule.vHi ? rule.vLo + " VFP" + (rule.vLo > 1 ? "s" : "") : rule.vLo + " to " + rule.vHi + " VFPs") + " with " + fps + " FPs, the lines have " + vTot + " (6.1, 6.2)");
      if (rule.first && rule.first.n) {
        const T = rule.first.type, idx = seq.findIndex(x => x !== T);
        if (idx >= 0 && idx < rule.first.n) err("two-part code: the first " + rule.first.n + " FP" + (rule.first.n > 1 ? "s" : "") + " must be " + (T === "H" ? "HFPs" : "VFPs") + " (6.1.1)");
      }
    }
    if (trans && trans.e.rv && !rvDone) err("this transition needs a mandatory reversal (" + rvText(trans.e.rv) + "): add a « Reversal » line (6.4)");
    // ---- I. fin du mouvement : corrections NG / inversé (5.5, 5.9), OC (6.1.3), reverse optionnel (6.4), HFP gratuit (6.2) ----
    let endPos2 = endPos, fixFt = 0;
    const invLevelTurn = !trans && !auto && p.pitch === 0 && invPosFac > 0;
    const fixFac = ngUprightFac + (invLevelTurn ? invPosFac : 0);
    R.fixNeed = fixFac ? (ngUprightFac ? "upright NG turns (5.9)" : "inverted level turns (5.5)") : "";
    if (fixFac) {
      if (mv.fix === "alt") { fixFt = -Math.min(fixFac, up1(fvt(fps, 1))) * 100; R.fixTxt = "lose " + (-fixFt) + " ft (100 ft per 30°, at most 1/3 of the FPs)"; }
      else {
        if (invLevelTurn && !ngUprightFac) endPos2 = 7;          // (INV) → (SHD)
        else if (endPos2 !== 9) endPos2 = isInv(bank) ? (endPos2 + 1) % 12 : (endPos2 + 11) % 12;
        R.fixTxt = "nose one step toward the earth, to " + attLabel(endPos2, isInv(bank)) + " (no cost)";
      }
      R.notes.push("After " + R.fixNeed + ": " + R.fixTxt);
      alt += fixFt;
      if (fixFt) R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head });
    }
    const endPitch = ATT_PITCH[endPos2];
    // OC permis par l'attitude de fin (Standard Altitude Change Table) ; « no OC+ », « Max OC– » des codes FATT
    const eSt = Math.abs(endPitch);
    let ocUp = 0, ocDn = 0;
    if (pureV || (eSt === 0)) { const q = up1(fvt(fps, 0)); ocUp = q; ocDn = q; }
    else { const q = dn1(fvt(fps, [0, 1, 2, 1][eSt])); if (endPitch > 0) ocUp = q; else ocDn = q; }
    if ((trans && trans.e.noOcUp) || invLevelTurn || auto) ocUp = 0;
    const ocForced = (trans && trans.e.maxOcDown) || (auto && endPitch <= 0);
    R.ocUp = ocUp * 100; R.ocDn = ocDn * 100; R.ocForced = ocForced;
    let oc = Math.round(+mv.oc || 0);
    if (ocForced) oc = -ocDn * 100;
    if (oc > ocUp * 100) err("optional altitude change: up to " + (ocUp ? "+" + ocUp * 100 + " ft" : "no climb") + " (6.1.3)");
    if (oc < -ocDn * 100) err("optional altitude change: down to " + (ocDn ? "−" + ocDn * 100 + " ft" : "no descent") + " (6.1.3)");
    alt += oc;
    // reverse optionnel (6.4) : fin en vertical, plus de VFPs que d'HFPs, pas de reversal obligatoire ; 180° (LV, IV) ou 120 / 150° ;
    //  vers le bank (pull, ou sans transition) ou à l'opposé (push) ; le bank passe à l'envers
    const endM = mv.end || "";
    if (pureV && mv.freeH) {
      if (s < 3) err("free HFP in pure vertical flight: speed 3.0 or more (6.2)");
      else { const nx = stepFrom(pos, scr(head)); if (nx) { pos = nx; R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head }); R.endTxt = "Free HFP (pure vertical, 6.2)"; } }
    } else if (mv.freeH) err("free HFP: only in pure vertical flight (all FPs as VFPs, 6.2)");
    if (/^or/.test(endM)) {
      const deg = +endM.slice(2), banked = bank !== 0 && bank !== 3;
      if (Math.abs(endPitch) !== 3) err("optional reverse: end attitude must be vertical (6.4)");
      if (vTot <= hTot) err("optional reverse: more VFPs than HFPs needed (6.4)");
      if (trans && trans.e.rv) err("optional reverse: not with a mandatory reversal (6.4)");
      if (auto) err("optional reverse: not while out of control (6.4)");
      if (!banked && deg !== 180) err("bank " + BANKS[bank] + ": the reverse is 180° (6.4.1)");
      if (banked && deg === 180) err("banked: the reverse is 120° or 150° (6.4.1)");
      const dir = banked ? ((trans && !pull) ? (bankDir() === "L" ? "R" : "L") : bankDir()) : "R";
      face(deg / 30, dir); bank = flipBank(bank);
      R.endTxt = (R.endTxt ? R.endTxt + ", " : "") + "Optional reverse " + deg + (banked ? dir : "") + " to " + HEADINGS[head] + ", bank " + BANKS[bank];
      R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head });
    }
    if (oc) R.track.push({ c: pos.c, r: pos.r, hex2: pos.hex2, alt, head });
    const vChange = alt - p.alt - oc - mc * 100 - fixFt;
    if (alt <= 0) { R.crash = true; warn("altitude 0.0 or below: the aircraft crashes"); R.notes.push("Altitude 0.0 or below: crashed"); }
    if (pureV && mv.lines.some(L => L.act === "turn" || L.act === "ngturn")) err("pure vertical flight: no turning, only vertical rolls (5.3)");
    // ---- J. vol inversé tout le tour (3.6), effets NG (4.3.1, 6.5) ----
    const invAll = sInv && !everUpright && isInv(bank);
    let ngEff = ng || ngTurns > 0;
    if (invAll && !pull && !posTurns) {
      ngEff = true;
      if (p.pitch === 0 && !trans) addD(3, "inv", "inverted level flight all the turn without pull transition or positive-G turn (3.6)");
      R.notes.push("Inverted all the turn without a pull transition or positive-G turn: negative-G effects (3.6)");
    }
    R.ng = ngEff; R.anyInv = anyInv || sInv || isInv(bank);
    // ---- K. reports pour le tour suivant ----
    const ncs = { turn: null, roll: null, slip: null, notes: cs.notes.slice(), idle: false, ng: 0, dd: 0, comp: comp, gloc: cs.gloc ? cs.gloc - 1 : 0 };
    if (turn && (turn.prog || turn.paid)) {
      const E = chartEntry(chartS, turn.rate), req = E ? (E.deg ? 1 : E.req[turn.second && E.req.length > 1 ? 1 : 0]) : 99;
      if (turn.carried && turn.prog >= req && !mv.lines.some(L => L.act === "turn" || L.act === "ngturn")) warn("carried turn met its FP requirement: it must face or be abandoned this move (5.2)");
      if (turn.prog) ncs.turn = { fps: turn.prog, ng: turn.ng, rate: turn.rate, dir: turn.dir, second: turn.second };
    }
    if (roll) ncs.roll = { fps: roll.fps, dir: roll.dir, snap: roll.snap };
    if (slip) ncs.slip = { fps: slip.prog, kind: slip.kind, side: slip.side };
    if (ngEff) {
      ncs.ng = (cs.ng || 0) + 1;
      if (noFI(p)) { ncs.idle = true; R.notes.push("No F.I. engine and negative-G effects: idle power forced next turn (4.3.1)"); }
      if (ncs.ng > 3) { R.oilStarve = true; R.notes.push("Negative-G effects " + ncs.ng + " turns in a row: engine oil starvation, one step power loss critical hit (3.6)"); }
    }
    if (R.ddNeed && mv.dd && !mv.dd.destroyed) ncs.dd = (cs.dd || 0) + 1;
    R.carry = carryText(ncs);
    // arc de tir à la fin du mouvement (Combat Tables) : en virage si le dernier FP a changé le facing ou si un virage est reporté
    if (/^or/.test(endM)) R.fofDir = bank && bank !== 3 ? (bank < 0 ? "L" : "R") : "";
    else R.fofDir = R.lastFaceDir || (ncs.turn ? ncs.turn.dir : "");
    // ---- L. contrôles après le mouvement (5.6, 5.7) : overstress, black / red out ; faits à « Apply » ----
    const D0 = dmgOf(p), weak = D0.sev || sparHits(p) || tailHits(p);
    const osRate = u => u.rate === "ET" || (u.ng && u.rate === "BT") || (weak && (u.rate === "BT" || (u.ng && ["HT", "BT"].includes(u.rate))));
    const glocRate = u => u.rate === "ET" || (u.ng && u.rate === "BT") || ((p.pq === "Recruit" || p.wia) && (u.rate === "BT" || (u.ng && u.rate === "HT")));
    R.osN = R.gUse.filter(osRate).reduce((t, u) => t + u.n, 0);
    R.glocN = R.gUse.filter(glocRate).reduce((t, u) => t + u.n, 0);
    R.redOut = R.gUse.some(u => u.ng && (u.rate === "BT" || ((p.pq === "Recruit" || p.wia) && u.rate === "HT")));
    if (D0.sev && R.gUse.some(u => u.rate === "ET" || (u.ng && u.rate === "BT"))) { R.destroyed = true; R.notes.push("Severely damaged and ET or NG-BT rate used: aircraft destroyed (5.6)"); }
    else if (R.osN) R.notes.push("Overstress check at « Apply » (% ≥ 95: damage, 5.6)");
    if (R.glocN) R.notes.push((R.redOut ? "Red-out" : "Black-out") + " check for each crewman at « Apply » (% ≥ 95, 5.7)");
    if (R.et) R.notes.push("ET rate used: no gun fire or stores release this turn (5.2)");
    if (ngEff && (ng || ngTurns)) R.notes.push("NG rates used: no tracking shots, long bursts or defensive fire; fixed guns +30 (5.9, 6.5)");
    // ---- M. transition : crédit de decel (6.1.4) — la moitié du pull (push) compte pour les virages positifs (NG) ----
    if (R.transDecel && (pull ? turnTot.pos : turnTot.ng)) {
      const cr = Math.min(fvt(R.transDecel, 2), pull ? turnTot.pos : turnTot.ng);
      addA(cr, "tc", "transition decel credit: half the " + (pull ? "pull" : "push") + " decel toward " + (pull ? "turn" : "NG turn") + " decel (6.1.4)");
    }
    // ---- N. altitude : accel de piqué / decel de montée par 100 ft (4.1, 4.2), sur le changement net (MC, VFPs, OC) ----
    const per100 = per100Of(s), upFt = Math.max(0, alt - p.alt), downFt = Math.max(0, p.alt - alt);
    if (upFt) addD(upFt / 100 * per100 * k2, "cl", "climb " + upFt + " ft × " + per100 + " per 100 ft at speed " + fmt1(s) + " (4.2)");
    if (downFt) addA(downFt / 100 * per100, "d", "dive " + downFt + " ft × " + per100 + " per 100 ft at speed " + fmt1(s) + " (4.1)");
    // ---- O. vitesse de fin (4.3, 4.4) ----
    if (D0.decel) addD(D0.decel, "dm", D0.decel + " × « +1 Decel » critical hit");
    if (p.acc > 0) addA(p.acc, "c", "accel carry (4.3)");
    if (p.acc < 0) addD(-p.acc, "c", "decel carry (4.3)");
    const A = R.acc.reduce((t, x) => t + x.v, 0), Dd = R.dec.reduce((t, x) => t + x.v, 0), net = A - Dd;
    let steps5 = net >= 0 ? Math.floor(net / 5 + 1e-9) : -Math.floor(-net / 5 + 1e-9), rem = Math.round((net - steps5 * 5) * 10) / 10;
    let end = s + steps5 * 0.5;
    const diving = p.pitch < 0 || endPitch < 0;
    R.forfeit = 0;
    if (!diving && maxL !== null && s <= maxL + 1e-9) {           // 4.4 : pas au-delà de la maxi atteignable sans piqué au départ ou à la fin
      if (end > maxL) { R.forfeit = Math.round(((end - maxL) * 10 + Math.max(0, rem)) * 10) / 10; end = maxL; rem = 0; }
      else if (Math.abs(end - maxL) < 1e-9 && rem > 0) { R.forfeit = rem; rem = 0; }
    }
    if (end < 0) { end = 0; rem = 0; }
    Object.assign(R, { A, D: Dd, net, dSpeed: end - s, rem, end, endAlt: alt, endHead: head, endBank: bank, endPos: pos, endPitch, endAtt: endPos2, vChange, oc, hTot, vTot });
    // formation fixe (8.5.1) : limites de vol ; dépassées → hors de formation ce tour et le suivant (et vol flexible pour de bon si leader)
    if (typeof inFixed === "function" && inFixed(p, initOf())) {
      const w = fixedLimits(p, R);
      if (w.length) { R.fixViol = w; warn("fixed formation limits exceeded (" + w.join(", ") + "): out of formation this turn and the next" + (wingmenOf(p).length ? "; as a leader, his flight becomes a flexible formation for good" : "") + " (8.5.1)"); }
    }
    if (R.forfeit) R.notes.push("Accel past the max attainable speed " + fmt1(maxL) + " forfeit (" + num(R.forfeit) + "): no dive at the start or end of the move (4.4)");
    return R;
  }

  // ---- ligne de position de fin, texte du Log ----
  function endLineOf(p, R) {
    const q = Object.assign({}, p, { c: R.endPos.c, r: R.endPos.r, hex2: R.endPos.hex2, head: R.endHead, alt: R.endAlt, speed: R.end, half: R.newHalf,
      acc: R.rem, pitch: R.endPitch, bank: R.endBank, mcarry: R.carry });
    return lineOf(q);
  }
  function formula(R) {
    const part = L => {
      const G = []; L.forEach(x => { const g = G.find(y => y.k === x.k); if (g) g.v += x.v; else G.push({ k: x.k, v: x.v }); });
      return G.length ? G.map(x => num(x.v) + x.k).join(" + ") : "0";
    };
    let t = "(" + part(R.acc) + ") - (" + part(R.dec) + ") = " + num(R.A) + " - " + num(R.D) + " = " + (R.net > 0 ? "+" : "") + num(R.net);
    if (R.dSpeed) t += " = " + (R.dSpeed > 0 ? "+" : "") + fmt1(R.dSpeed) + " speed" + (R.rem ? " " + (R.rem > 0 ? "+" : "") + fmt1(R.rem) + (R.rem > 0 ? " accel" : " decel") + " carry" : "");
    return t;
  }
  function logText(p, R) {
    const L = [];
    L.push("TURN" + pad2(state.turn));
    L.push(lineOf(p));
    const fpTxt = R.hTot + "H" + (R.vTot ? "+" + R.vTot + "V" : "");
    L.push("Power = " + R.powerTxt + ", " + (R.transTxt || "") + ", " + fpTxt);
    L.push("MC=" + signedAlt(R.mc || 0) + ", V=" + signedAlt(R.vChange) + ", OC=" + signedAlt(R.oc));
    L.push("");
    R.lines.forEach(x => L.push(x.note));
    if (R.endTxt) L.push(R.endTxt + " (" + pName(R.endPos) + ")");
    L.push("");
    R.notes.forEach(n => L.push(n));
    L.push(formula(R));
    L.push(endLineOf(p, R));
    return L.join("\n");
  }
