document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.repeat || event.defaultPrevented) return;

  const focusedControl = event.target instanceof Element
    ? event.target.closest("a, button, input, select, textarea, [contenteditable='true']")
    : null;

  if (!focusedControl) document.querySelector(".launch-button")?.click();
});
