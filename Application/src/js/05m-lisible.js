  // ---- « Readable text » (repris de Warbirds Digital) : chiffres bien distincts, panneau agrandi ; choix gardé dans le navigateur ----
  const READ_KEY = "fwd-readable";
  function setReadable(on) {
    document.body.classList.toggle("readable", on);
    $("readableBtn").textContent = "Readable text: " + (on ? "on" : "off");
    $("readableBtn").setAttribute("aria-pressed", String(on));
    try { localStorage.setItem(READ_KEY, on ? "1" : "0"); } catch (e) {}
  }
  { let on = false; try { on = localStorage.getItem(READ_KEY) === "1"; } catch (e) {} setReadable(on); }
  $("readableBtn").addEventListener("click", () => setReadable(!document.body.classList.contains("readable")));
