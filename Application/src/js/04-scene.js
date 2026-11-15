  // ================= Scène 3D =================
  const view = $("view");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  view.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dfe8ee");
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.minDistance = 3; controls.maxDistance = 600;
  // Molette fine : 2,5 % par cran, Shift = 0,8 % (écoutée sur #view en capture, avant OrbitControls)
  view.addEventListener("wheel", e => {
    if (e.target !== renderer.domElement) return;
    const d = e.deltaY || e.deltaX; if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const px = e.deltaMode === 1 ? d * 33 : e.deltaMode === 2 ? d * 400 : d;
    const f = Math.pow(e.shiftKey ? 1.008 : 1.025, Math.max(-4, Math.min(4, px / 100)));
    const off = camera.position.clone().sub(controls.target);
    const len = Math.max(controls.minDistance, Math.min(controls.maxDistance, off.length() * f));
    camera.position.copy(controls.target).add(off.setLength(len)); controls.update();
  }, { capture: true, passive: false });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa4ad, 0.85));
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.45); sunLight.position.set(-20, 40, 25); scene.add(sunLight);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  // carte ou pion ouvert par la page en un seul fichier (plus tard : partage) : images incluses dans window.TWD_INLINE
  const INLINE = window.TWD_INLINE || { maps: {}, counters: {} };

  // ---- carte : image du module Vassal (maps/<id>.js à côté de la page, chargé à la demande), sinon grille dessinée ----
  const gridCanvas = {};
  function drawnBoard(id) {                        // grille de remplacement (mêmes hex et numéros que la carte Vassal)
    if (gridCanvas[id]) return gridCanvas[id];
    const Bd = BOARDS[id], k = 0.25, cv = document.createElement("canvas");
    cv.width = Math.round(Bd.w * k); cv.height = Math.round(Bd.h * k);
    const ctx = cv.getContext("2d"), R = Bd.dx / 1.5 * k;
    ctx.fillStyle = Bd.bg; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = Bd.line; ctx.lineWidth = 1; ctx.fillStyle = Bd.text;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "500 " + (0.3 * R).toFixed(1) + "px Arial, Helvetica, sans-serif";
    for (let c = -1; c <= COLS; c++) for (let r = -1; r <= ROWS; r++) {
      const cx = (Bd.x0 + Bd.dx * c) * k, cy = (Bd.y0 + Bd.dy * r + ((c & 1) ? Bd.dy / 2 : 0)) * k;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; i ? ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)) : ctx.moveTo(cx + R, cy); }
      ctx.closePath(); ctx.stroke();
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) ctx.fillText(hexName(c, r), cx, cy - 0.68 * R);
    }
    ctx.font = "700 " + (1.2 * R).toFixed(0) + "px Arial, sans-serif"; ctx.textAlign = "left"; ctx.globalAlpha = 0.35;
    ctx.fillText(Bd.label + " (grid only)", 0.6 * R, cv.height - 1.2 * R); ctx.globalAlpha = 1;
    return (gridCanvas[id] = cv);
  }
  const texCache = {}, mapState = {};
  let mapMat = null, mapMesh = null;
  window.TWD_MAP = (id, url) => {
    new THREE.TextureLoader().load(url, t => {
      t.anisotropy = maxAniso; texCache[id] = t; mapState[id] = "ok";
      if (mapMat && state.scen.board === id) { mapMat.map = t; mapMat.needsUpdate = true; }
    });
  };
  function requestBoard(id) {
    if (mapState[id]) return;
    if (INLINE.maps[id]) { mapState[id] = "loading"; window.TWD_MAP(id, INLINE.maps[id]); return; }
    if (!MAPS.includes(id)) { mapState[id] = "missing"; return; }
    mapState[id] = "loading";
    const s = document.createElement("script"); s.src = "maps/" + id + ".js";
    s.onerror = () => { mapState[id] = "missing"; s.remove(); renderScenario(); };
    document.head.appendChild(s);
  }
  function boardTexture(id) {
    if (texCache[id]) return texCache[id];
    if (!texCache["grid:" + id]) { const g = new THREE.CanvasTexture(drawnBoard(id)); g.anisotropy = maxAniso; texCache["grid:" + id] = g; }
    requestBoard(id);
    return texCache["grid:" + id];
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshLambertMaterial({ color: 0x55606a })); scene.add(slab);
  const compass = new THREE.Group(); scene.add(compass);
  function buildMap() {
    if (mapMesh) { mapMesh.geometry.dispose(); mapMat.dispose(); scene.remove(mapMesh); }
    mapMat = new THREE.MeshBasicMaterial({ map: boardTexture(state.scen.board) });
    mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), mapMat);
    mapMesh.rotation.x = -Math.PI / 2; scene.add(mapMesh);
    slab.scale.set(MAP_W + 0.4, 1, MAP_H + 0.4); slab.position.y = -0.155;
    buildCompass();
  }
  // Rose des caps autour de la carte, orientée par la partie (Nord = state.scen.north)
  function buildCompass() {
    compass.children.slice().forEach(s => { s.material.map.dispose(); s.material.dispose(); compass.remove(s); });
    [["N", 0], ["E", 90], ["S", 180], ["W", 270]].forEach(([t, a]) => {
      const v = mapVec(state.scen.north + a);
      const sp = textSprite(t === "N" ? "N ▲" : t, { w: 128, h: 64, scale: 4, plain: true, color: t === "N" ? "#b8402e" : "#2d5fae", font: "700 44px 'Barlow Condensed', sans-serif" });
      const ex = MAP_W / 2 + 3, ez = MAP_H / 2 + 2.5, k = Math.min(ex / Math.max(Math.abs(v.x), 1e-6), ez / Math.max(Math.abs(v.z), 1e-6));
      sp.position.set(v.x * k, 0.6, v.z * k); compass.add(sp);
    });
  }

  // ---- sprites texte ----
  function textSprite(text, o) {
    o = o || {};
    const cv = document.createElement("canvas"); cv.width = o.w || 320; cv.height = o.h || 72;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
    sp.renderOrder = 10; sp.userData = { cv, o };
    drawLabel(sp, text); const s = o.scale || 2.4; sp.scale.set(s, s * cv.height / cv.width, 1);
    return sp;
  }
  function drawLabel(sp, text, accent) {
    const { cv, o } = sp.userData, ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = o.font || "700 30px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    const tw = Math.min(ctx.measureText(text).width, cv.width - 36), bw = tw + 28, bh = cv.height - 16, x0 = (cv.width - bw) / 2, y0 = 8;
    if (!o.plain) {
      ctx.fillStyle = "rgba(246,246,242,0.94)"; ctx.strokeStyle = accent || "rgba(28,38,49,0.45)"; ctx.lineWidth = accent ? 5 : 2;
      ctx.beginPath(); ctx.moveTo(x0 + 8, y0); ctx.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, 8); ctx.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, 8);
      ctx.arcTo(x0, y0 + bh, x0, y0, 8); ctx.arcTo(x0, y0, x0 + bw, y0, 8); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = o.color || "#1c2631"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, cv.width / 2, cv.height / 2 + 1, cv.width - 36);
    sp.material.map.needsUpdate = true;
  }

  // ---- pions des avions (counters/<id>.js à côté de la page, chargé à la demande ; tools/extract_vassal.py) ----
  //  Image du pion : losange, nez de l'avion vers le haut de l'image ; posée à plat, nez vers −Z.
  const ctrTex = {}, ctrState = {};
  window.TWD_CTR = (id, url) => {
    new THREE.TextureLoader().load(url, t => { t.anisotropy = maxAniso; ctrTex[id] = t; ctrState[id] = "ok"; state.planes.forEach(updatePlane); });
  };
  function requestCounter(id) {
    if (!id || ctrState[id]) return;
    if (INLINE.counters[id]) { ctrState[id] = "loading"; window.TWD_CTR(id, INLINE.counters[id]); return; }
    if (!COUNTER_IMGS.includes(id)) { ctrState[id] = "missing"; return; }
    ctrState[id] = "loading";
    const s = document.createElement("script"); s.src = "counters/" + id + ".js";
    s.onerror = () => { ctrState[id] = "missing"; s.remove(); };
    document.head.appendChild(s);
  }
  const CTR_SIZE = 1.9;                              // côté du pion (un hex fait √3 ≈ 1,73 d'un côté à l'autre)

  // ---- Minibox façon Birds of Prey (boxes/<fiche>.js, chargé à la demande ; tools/extract_boxes.py, comme Warbirds Digital) ----
  //  b = { dims: [longueur, envergure, hauteur], faces: { face, arriere, dessus, dessous, droite, gauche } } ;
  //  faces de BoxGeometry dans l'ordre +X (aile droite), −X, +Y (dessus), −Y, +Z (queue), −Z (nez)
  const boxData = {}, boxState = {}, boxMats = {};
  window.TWD_BOX = (id, b) => { boxData[id] = b; boxState[id] = "ok"; state.planes.forEach(updatePlane); };
  function requestBox(id) {
    if (!id || boxState[id]) return;
    if ((INLINE.boxes || {})[id]) { boxState[id] = "loading"; setTimeout(() => window.TWD_BOX(id, INLINE.boxes[id])); return; }
    if (!BOXES.includes(id)) { boxState[id] = "missing"; return; }
    boxState[id] = "loading";
    const s = document.createElement("script"); s.src = "boxes/" + id + ".js";
    s.onerror = () => { boxState[id] = "missing"; s.remove(); };
    document.head.appendChild(s);
  }
  const BOX_FACES = ["droite", "gauche", "dessus", "dessous", "arriere", "face"];
  const matsOf = id => boxMats[id] || (boxMats[id] = BOX_FACES.map(f => {
    const t = new THREE.TextureLoader().load(boxData[id].faces[f]); t.anisotropy = maxAniso;
    return new THREE.MeshLambertMaterial({ map: t });
  }));
  const BOX_LEN = 1.6;
  // modèle des avions (barre de la caméra, gardé dans ce navigateur) : « box » = Minibox si la fiche en a une, sinon le pion ;
  //  « counter » = pion Vassal si l'image existe, sinon la Minibox
  let modelMode = "box"; try { if (localStorage.getItem("fwd-model") === "counter") modelMode = "counter"; } catch (e) {}
  function modelOf(p) {
    const bx = p.adc && boxData[p.adc] ? "box:" + p.adc : null, ct = p.ctr && ctrTex[p.ctr] ? "ctr:" + p.ctr : null;
    return modelMode === "counter" ? (ct || bx) : (bx || ct);
  }

  // ---- avions : pion du module si l'image est là, sinon maquette simple (nez vers −Z, dessus +Y, aile droite +X) ----
  const pickables = [];
  function buildPlane(p) {
    const col = new THREE.Color(SIDES[p.side].color), mat = new THREE.MeshLambertMaterial({ color: col });
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); scene.add(root);
    const model = modelOf(p), tex = model && model.startsWith("ctr:") ? ctrTex[p.ctr] : null, bx = model && model.startsWith("box:") ? p.adc : null;
    let ow = 1.75, oh = 0.45, ol = 1.6, nose = 0.7;
    if (bx) {
      const [L, S, H] = boxData[bx].dims, k = BOX_LEN / L;
      const m = new THREE.Mesh(new THREE.BoxGeometry(S * k, H * k, BOX_LEN), matsOf(bx));
      m.userData.plane = p; pickables.push(m); body.add(m);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S * k, H * k, BOX_LEN)), new THREE.LineBasicMaterial({ color: col }));
      body.add(edge);                                                         // arêtes de la couleur du camp
      ow = S * k * 1.08; oh = H * k * 1.2; ol = BOX_LEN * 1.06; nose = BOX_LEN / 2;
    } else if (tex) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(CTR_SIZE, CTR_SIZE), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.userData.plane = p; pickables.push(m); body.add(m);
      const edge = new THREE.Mesh(new THREE.RingGeometry(CTR_SIZE * 0.49, CTR_SIZE * 0.55, 4, 1), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      edge.rotation.x = -Math.PI / 2; edge.position.y = -0.01; body.add(edge);       // liseré du camp autour du losange
      ow = CTR_SIZE * 0.8; oh = 0.2; ol = CTR_SIZE * 0.8; nose = CTR_SIZE * 0.55;
    } else {
      const parts = [[0.24, 0.22, 1.4, 0, 0, 0], [1.6, 0.05, 0.36, 0, 0, -0.12], [0.62, 0.04, 0.2, 0, 0, 0.6], [0.04, 0.3, 0.24, 0, 0.15, 0.6]];
      parts.forEach(([w, h, d, x, y, z]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.userData.plane = p; pickables.push(m); body.add(m); });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.3), new THREE.MeshLambertMaterial({ color: 0xc98316 })); canopy.position.set(0, 0.15, -0.2); body.add(canopy);
    }
    body.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.05, -nose), 0.6, col, 0.2, 0.13));
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(ow, oh, ol)), new THREE.LineBasicMaterial({ color: 0xc98316 }));
    if (tex) outline.rotation.y = Math.PI / 4;
    body.add(outline);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), mat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.9, 6, 1), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.16), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    bar.rotation.x = -Math.PI / 2; bar.position.y = 0.02;
    const barPivot = new THREE.Group(); barPivot.add(bar);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.1), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    track.rotation.x = -Math.PI / 2; track.position.set(1.15, 0.025, 0);
    const trackPivot = new THREE.Group(); trackPivot.add(track);
    const label = textSprite(p.name, { w: 400, scale: 3 });
    root.add(rod, ring, barPivot, trackPivot, label);
    p.obj = { root, body, rod, ring, barPivot, trackPivot, outline, label, model };
  }
  function destroyPlane(p) {
    scene.remove(p.obj.root);
    p.obj.root.traverse(o => { const i = pickables.indexOf(o); if (i >= 0) pickables.splice(i, 1); if (o.geometry) o.geometry.dispose(); });
  }
  const planeY = p => Math.max(0, p.alt - state.scen.base) * ftUnit + 0.6;
  const planeXZ = p => posPoint(p);
  const PITCH_DEG = [-80, -55, -25, 0, 25, 55, 80];      // angle montré en 3D pour chaque pitch (le vertical reste lisible)
  const BANK_DEG = { "-2": -135, "-1": -40, "0": 0, "1": 40, "2": 135, "3": 180 };   // FW 5.1 : LB / RB, IL / IR, IV (sur le dos)
  function updatePlane(p) {
    requestCounter(p.ctr); requestBox(p.adc);
    if (p.obj.model !== modelOf(p)) { destroyPlane(p); buildPlane(p); }   // fiche, pion ou modèle changé, ou image arrivée
    const { root, body, rod, ring, barPivot, trackPivot, outline, label } = p.obj;
    root.visible = !p.status;                                                  // détruit / écrasé : retiré de la carte
    const pos = planeXZ(p), y = planeY(p), s = screenHead(p);
    root.position.set(pos.x, 0, pos.z);
    body.rotation.set(rad(PITCH_DEG[p.pitch + 3]), -rad(s), -rad(BANK_DEG[norm6(p.bank)]), "YXZ");   // cap, puis pitch, puis bank (droite = aile droite en bas)
    body.position.y = y;
    rod.scale.y = y; rod.position.y = y / 2;
    ring.visible = !p.hex2; barPivot.visible = !!p.hex2;
    if (p.hex2) barPivot.rotation.y = -rad(dirBetween(p, p.hex2));            // trait le long du côté d'hex
    trackPivot.visible = Math.abs(p.pitch) !== 3; trackPivot.rotation.y = rad(90 - s);
    label.position.y = y + 1.5;
    drawLabel(label, p.name + "  ·  " + altName(p.alt) + "  ·  " + speedText(p), p === selected ? "#c98316" : null);
    outline.visible = p === selected;
  }
  // ---- trajet prévu du tour (onglet Maneuver) : dans l'air, un point par FP, trait vers le sol et flèche du cap à la fin ----
  const trackGroup = new THREE.Group(); scene.add(trackGroup);
  const altY = alt => Math.max(0, alt - state.scen.base) * ftUnit + 0.6;
  const clearGroup = g => g.children.slice().forEach(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); g.remove(o); });
  function drawTrack(track, color) {
    clearGroup(trackGroup);
    if (!track || track.length < 2) return;
    const col = new THREE.Color(color);
    const pts = track.map(t => { const P = posPoint(t); return new THREE.Vector3(P.x, altY(t.alt), P.z); });
    trackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: col, dashSize: 0.3, gapSize: 0.15 })));
    trackGroup.children[0].computeLineDistances();
    const dotGeo = new THREE.SphereGeometry(0.12, 10, 8), dotMat = new THREE.MeshBasicMaterial({ color: col });
    pts.slice(1).forEach(v => { const d = new THREE.Mesh(dotGeo, dotMat); d.position.copy(v); trackGroup.add(d); });
    const last = track[track.length - 1], end = pts[pts.length - 1], vv = mapVec(norm360(state.scen.north + 30 * last.head));
    trackGroup.add(new THREE.ArrowHelper(new THREE.Vector3(vv.x, 0, vv.z), end, 1.4, col, 0.45, 0.3));
    trackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([end, new THREE.Vector3(end.x, 0.03, end.z)]), new THREE.LineDashedMaterial({ color: col, dashSize: 0.2, gapSize: 0.2 })));
    trackGroup.children[trackGroup.children.length - 1].computeLineDistances();
  }
  // ---- traces des 3 derniers tours joués (p.trail, « Apply end of turn ») : tube dans l'air, plus pâle quand le tour est ancien ----
  const trailGroup = new THREE.Group(); scene.add(trailGroup);
  function drawTrails() {
    clearGroup(trailGroup);
    state.planes.forEach(p => {
      const col = new THREE.Color(SIDES[p.side].color);
      (p.trail || []).filter(e => e.turn > state.turn - 4).forEach(e => {
        const age = state.turn - e.turn, op = [0.95, 0.95, 0.6, 0.35][age] || 0.3;
        const pts = e.pts.map(q => { const P = posPoint(q); return new THREE.Vector3(P.x, altY(q.alt), P.z); });
        const path = new THREE.CurvePath();
        for (let k = 1; k < pts.length; k++) if (pts[k].distanceTo(pts[k - 1]) > 1e-6) path.add(new THREE.LineCurve3(pts[k - 1], pts[k]));
        if (path.curves.length) trailGroup.add(new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, path.curves.length * 6), 0.045, 6, false),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op })));
      });
    });
  }
  buildMap();
  state.planes.forEach(buildPlane);
