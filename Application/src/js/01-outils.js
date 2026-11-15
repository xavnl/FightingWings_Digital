  "use strict";
  const $ = id => document.getElementById(id);
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const norm360 = a => ((a % 360) + 360) % 360;
  const pad2 = n => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const fmt1 = v => (Math.round(v * 10) / 10).toFixed(1);
