document.addEventListener("keydown", (event) => {
  const inPauseMenu = Boolean(document.querySelector(".pause-screen"));
  if (inPauseMenu && !event.repeat) {
    if (event.key.toLowerCase() === "p") {
      if (window.spaceAttackNavigate) window.spaceAttackNavigate("./gameplay.html");
      else window.location.href = "./gameplay.html";
      return;
    }
    if (event.key === "Escape") {
      if (window.spaceAttackNavigate) window.spaceAttackNavigate("./index.html");
      else window.location.href = "./index.html";
      return;
    }
  }
  if (!document.querySelector(".play-screen")) return;
  if (event.key.toLowerCase() !== "p" || event.repeat || event.defaultPrevented) return;

  const focusedControl = event.target instanceof Element
    ? event.target.closest("a, button, input, select, textarea, [contenteditable='true']")
    : null;

  if (!focusedControl) {
    if (window.spaceAttackNavigate) window.spaceAttackNavigate("./pause.html");
    else window.location.href = "./pause.html";
  }
});
