  // ---- sélection / placement à la souris ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  function castAt(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  renderer.domElement.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener("pointerup", e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    castAt(e);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit) select(hit.object.userData.plane);
  });
  // Placement direct (onglet Map) : double-clic dans un hex ; près d'un côté d'hex, le pion va sur ce côté (2.7),
  //  avec le cap parallèle au côté, le plus proche du cap actuel
  renderer.domElement.addEventListener("dblclick", e => {
    if (currentTab !== "map") return;
    castAt(e); if (ray.intersectObjects(pickables, false).length) return;
    const hit = ray.intersectObject(mapMesh, false)[0]; if (!hit) return;
    const h = hexAt(hit.point.x, hit.point.z); if (!h) return;
    const o = hexCenter(h.c, h.r), dx = hit.point.x - o.x, dz = hit.point.z - o.z, p = selected;
    p.c = h.c; p.r = h.r; p.hex2 = null;
    if (Math.hypot(dx, dz) > 0.62) {
      const a = norm360(Math.round(deg(Math.atan2(dx, -dz)) / 60) * 60), n = neighbour(h, a);
      if (n) {
        p.hex2 = n;
        if (!sideHeadingOk(p)) {
          const cands = [a + 90, a + 270].map(s => ((Math.round(norm360(s - state.scen.north) / 30) % 12) + 12) % 12);
          const turn = k => Math.min((k - p.head + 12) % 12, (p.head - k + 12) % 12);
          p.head = turn(cands[0]) <= turn(cands[1]) ? cands[0] : cands[1];
        }
      }
    }
    refresh();
  });

  // ================= Caméra =================
  let tween = null;
  const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function goTo(pos, target) { tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, k: 0 }; }
  function groupCenter() {
    const c = new THREE.Vector3(); state.planes.forEach(p => { const h = planeXZ(p); c.x += h.x; c.z += h.z; });
    c.divideScalar(state.planes.length); c.y = 0; return c;
  }
  // Vues orientées par le Nord de la partie (state.scen.north) : le Nord est en haut de l'écran (FW : carte « Blue N is UP »)
  //  back = vers le Sud (la caméra se place au Sud du point visé), side = vers l'Est
  const camAxes = () => { const n = mapVec(state.scen.north), e = mapVec(state.scen.north + 90); return { bx: -n.x, bz: -n.z, ex: e.x, ez: e.z }; };
  const camOff = (c, back, side, y) => { const A = camAxes(); return new THREE.Vector3(c.x + A.bx * back + A.ex * side, y, c.z + A.bz * back + A.ez * side); };
  const view3d = () => { const c = groupCenter(), y = Math.max(...state.planes.filter(p => !p.status).map(planeY).concat([0.6])) / 2; return [camOff(c, 36, -8, y + 30), new THREE.Vector3(c.x, y, c.z)]; };
  $("camAll").onclick = () => {
    const ns = state.scen.north % 180 === 0, wScr = ns ? MAP_W : MAP_H, hScr = ns ? MAP_H : MAP_W;   // largeur / hauteur de la carte à l'écran
    const d = Math.max(wScr / Math.max(camera.aspect, 0.6), hScr) * 1.2; goTo(camOff({ x: 0, z: 0 }, d * 0.6, 0, d), new THREE.Vector3(0, 0, 0));
  };
  $("cam3d").onclick = () => goTo(...view3d());
  $("camTop").onclick = () => { const c = groupCenter(); goTo(camOff(c, 0.01, 0, 90), new THREE.Vector3(c.x, 0, c.z)); };
  $("camModel").value = modelMode;
  $("camModel").onchange = e => { modelMode = e.target.value; try { localStorage.setItem("fwd-model", modelMode); } catch (err) {} refresh(); };
  $("camFollow").onclick = () => {
    const h = planeXZ(selected), y = planeY(selected);
    goTo(camOff(h, 5.5, -4, y + 3.5), new THREE.Vector3(h.x, y, h.z));
  };
  // Avion sélectionné : la vue glisse jusqu'à lui en gardant l'angle et la distance (point visé à mi-hauteur de sa tige)
  function centerOn(p) {
    const h = planeXZ(p), t = new THREE.Vector3(h.x, planeY(p) / 2, h.z), d = t.clone().sub(controls.target);
    goTo(camera.position.clone().add(d), t);
  }
  { const [p, t] = view3d(); camera.position.copy(p); controls.target.copy(t); }

  // Flèches du clavier : déplacement de la vue (souris sur la carte, ou aucun champ actif) ; Maj = pas ×4
  let overMap = false;
  view.addEventListener("pointerenter", () => (overMap = true));
  view.addEventListener("pointerleave", () => (overMap = false));
  document.addEventListener("keydown", e => {
    const dirs = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }, d = dirs[e.key];
    if (!d || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    if (a && a.closest && a.closest("input, textarea, select")) return;
    if (!overMap && a && a !== document.body && a !== renderer.domElement) return;
    e.preventDefault();
    const fwd = controls.target.clone().sub(camera.position); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x), stepLen = (e.shiftKey ? 16 : 4) * Math.max(1, camera.position.distanceTo(controls.target) / 40);
    const mv = fwd.multiplyScalar(d[1] * stepLen).add(right.multiplyScalar(d[0] * stepLen));
    const nt = controls.target.clone().add(mv);
    nt.x = clamp(nt.x, -MAP_W / 2, MAP_W / 2); nt.z = clamp(nt.z, -MAP_H / 2, MAP_H / 2);
    const real = nt.sub(controls.target);
    tween = null; controls.target.add(real); camera.position.add(real);
  });
  function resize() { const w = view.clientWidth, h = view.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(view); resize();
  function loop() {
    if (tween) {
      tween.k = instant ? 1 : Math.min(1, tween.k + 0.05);
      const s = tween.k * tween.k * (3 - 2 * tween.k);
      camera.position.lerpVectors(tween.p0, tween.p1, s); controls.target.lerpVectors(tween.t0, tween.t1, s);
      if (tween.k >= 1) tween = null;
    }
    controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop);
  }
  showTab(currentTab);
  refresh(); loop();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildCompass(); refresh(); });
  window.__twd = { state, hexName, parseHex, hexDist, rangeHex, parseLine, lineOf, bandOf, ADC_LIB, COUNTERS, simulate, logText, endLineOf, parseCarry, cleanGame, shotOf, fire, deflection, oddsOf, inHArc, endChecks, mpOf, ordersData, importOrders, resolveDeclared, initOf, orderOf, tailCheck, formationCheck, blindTo, isUnsighted, relBearing, defOf, defFire, critCount, baseLH, hitsAt, hitChance, doCheck };
