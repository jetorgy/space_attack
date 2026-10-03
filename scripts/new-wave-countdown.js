const countdown = document.querySelector("[data-countdown]");
const countdownLabel = document.querySelector("[data-countdown-label]");

if (countdown && countdownLabel) {
  let secondsRemaining = 5;

  const tick = () => {
    secondsRemaining = Math.max(0, secondsRemaining - 1);
    countdown.textContent = String(secondsRemaining).padStart(2, "0");
    countdown.parentElement?.setAttribute(
      "aria-label",
      secondsRemaining === 0 ? "Wave 4 ready" : "Wave begins in " + secondsRemaining + " seconds"
    );

    if (secondsRemaining === 0) {
      countdownLabel.textContent = "WAVE 04 READY";
      window.clearInterval(timer);
    }
  };

  const timer = window.setInterval(tick, 1000);
}
