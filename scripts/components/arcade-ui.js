const ICONS = "./assets/components/atoms/icons/";

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createKey(value, className = "") {
  return createElement("kbd", className, value);
}

class ArcadeButton extends HTMLElement {
  connectedCallback() {
    const variant = this.getAttribute("variant") || "default";
    const label = this.getAttribute("label") || "";
    const link = createElement("a", "action-link");
    link.href = this.getAttribute("href") || "#";

    if (variant === "launch") {
      link.classList.add("launch-button");
      link.setAttribute("aria-label", "Launch Space Attack, wave " + (this.getAttribute("wave") || "1"));
      link.append(
        createElement("span", "launch-button__prompt", label),
        createElement("span", "launch-button__wave", "WAVE ")
      );
      link.querySelector(".launch-button__wave").append(
        createElement("span", "launch-button__wave-number", this.getAttribute("wave") || "01")
      );
      const icon = document.createElement("img");
      icon.className = "launch-button__arrow";
      icon.src = ICONS + "arrow-right.svg";
      icon.alt = "";
      link.append(icon);
    } else if (variant === "pause") {
      link.classList.add("pause-menu__item");
      if (this.hasAttribute("active")) link.classList.add("pause-menu__item--active");
      link.setAttribute("aria-label", this.getAttribute("index") + " " + label + " " + (this.getAttribute("hint") || ""));
      link.append(
        createElement("span", "pause-menu__index", this.getAttribute("index") || ""),
        createElement("span", "pause-menu__action", label),
        createKey(this.getAttribute("hint") || "")
      );
    } else if (variant === "game-over-primary" || variant === "game-over-secondary") {
      link.classList.add("game-over-action");
      if (variant === "game-over-primary") link.classList.add("game-over-action--primary");
      link.setAttribute("aria-label", label + " " + (this.getAttribute("hint") || ""));
      link.append(createElement("span", "", label), createKey(this.getAttribute("hint") || ""));
    }

    this.replaceChildren(link);
  }
}

class ScoreReadout extends HTMLElement {
  static get observedAttributes() { return ["zeros", "value", "live", "suffix", "high-score", "high-zeros"]; }

  attributeChangedCallback() { if (this.isConnected) this.connectedCallback(); }

  connectedCallback() {
    const mode = this.getAttribute("mode") || "simple";
    const label = this.getAttribute("label") || "SCORE";
    const zeros = this.getAttribute("zeros") || "";
    const value = this.getAttribute("value") ?? "0";

    if (mode === "header") {
      const record = createElement("p", "start-screen__record");
      record.append(createElement("span", "start-screen__record-label", label));
      const score = createElement("span", "start-screen__record-score");
      score.setAttribute("aria-label", zeros + (this.getAttribute("live") || "") + (this.getAttribute("suffix") || ""));
      score.append(
        createElement("span", "start-screen__leading-zero", zeros),
        createElement("span", "start-screen__record-value", this.getAttribute("live") || ""),
        createElement("span", "start-screen__record-value", this.getAttribute("suffix") || "")
      );
      record.append(score);
      this.replaceChildren(record);
      return;
    }

    const isGameplay = mode === "gameplay";
    const wrapperClass = isGameplay ? "readout readout--score" : mode === "pause" ? "pause-readout pause-readout--score" : "new-wave-score";
    const wrapper = createElement(isGameplay ? "section" : "div", wrapperClass);
    const visibleLabel = isGameplay ? createElement("h1", "readout__label", label) : createElement("p", "pause-readout__label", label);
    const score = createElement("p", isGameplay ? "score-value" : mode === "pause" ? "pause-readout__score" : "new-wave-score__value");
    score.setAttribute("aria-label", label + " " + value);
    score.append(createElement("span", isGameplay ? "score-value__zeros" : "", zeros), createElement("span", isGameplay ? "score-value__live" : "", value));
    wrapper.append(visibleLabel, score);

    if (isGameplay && this.hasAttribute("high-score")) {
      const best = createElement("p", "score-best");
      best.append(
        createElement("span", "readout__label", this.getAttribute("high-label") || "HI"),
        createElement("span", "score-value__zeros", this.getAttribute("high-zeros") || "0"),
        createElement("span", "score-value__live", this.getAttribute("high-score"))
      );
      wrapper.append(best);
    }

    this.replaceChildren(wrapper);
  }
}

class StatusMeter extends HTMLElement {
  static get observedAttributes() { return ["value"]; }

  attributeChangedCallback() { if (this.isConnected) this.connectedCallback(); }

  connectedCallback() {
    const kind = this.getAttribute("kind") || "hull";
    const value = Number(this.getAttribute("value") || 0);
    const max = Number(this.getAttribute("max") || (kind === "hull" ? 10 : 5));
    const scaledSegments = (value / 100) * max;
    const active = Math.max(0, Math.min(max, kind === "hull" ? Math.round(scaledSegments) : Math.ceil(scaledSegments)));
    const wrapper = createElement("section", "readout readout--" + kind);
    const label = createElement("p", "readout__label");
    label.append(document.createTextNode(kind === "hull" ? "HULL " : "THREAT"));

    if (kind === "hull") {
      label.append(createElement("span", "readout__value", value + "%"));
      const meter = createElement("div", "hull-meter");
      meter.setAttribute("role", "img");
      meter.setAttribute("aria-label", "Hull meter, " + value + " percent");
      const depleted = max - active;
      const warnings = active <= 2 ? active : Math.min(2, active);
      if (active <= 2) meter.classList.add("hull-meter--critical");
      for (let index = 0; index < max; index += 1) {
        const segment = createElement("span", "hull-meter__segment");
        if (index < depleted) segment.classList.add("hull-meter__segment--depleted");
        else if (index >= max - warnings) segment.classList.add("hull-meter__segment--warning");
        else segment.classList.add("hull-meter__segment--live");
        meter.append(segment);
      }
      wrapper.append(label, meter);
    } else {
      const meter = createElement("div", "threat-meter");
      meter.setAttribute("role", "img");
      meter.setAttribute("aria-label", "Threat meter, " + active + " of " + max + " segments");
      for (let index = 0; index < max; index += 1) {
        const segment = createElement("span", "threat-meter__segment");
        if (index < active) segment.classList.add("threat-meter__segment--active");
        meter.append(segment);
      }
      wrapper.append(label, meter);
    }

    this.replaceChildren(wrapper);
  }
}

class LifeIndicator extends HTMLElement {
  static get observedAttributes() { return ["lives"]; }

  attributeChangedCallback() { if (this.isConnected) this.connectedCallback(); }

  connectedCallback() {
    const lives = Number(this.getAttribute("lives") || 0);
    const total = Number(this.getAttribute("total") || 3);
    const section = createElement("section", "readout readout--lives");
    section.append(createElement("p", "readout__label", "LIVES"));
    const icons = createElement("div", "life-icons");
    icons.setAttribute("role", "img");
    icons.setAttribute("aria-label", lives + " of " + total + " lives");
    for (let index = 0; index < total; index += 1) {
      const icon = document.createElement("img");
      icon.src = ICONS + (index < lives ? "life-full.svg" : "life-empty.svg");
      icon.alt = "";
      icons.append(icon);
    }
    section.append(icons);
    this.replaceChildren(section);
  }
}

class ControlPanel extends HTMLElement {
  connectedCallback() {
    const mode = this.getAttribute("mode") || "compact";
    if (mode === "start") {
      const panel = createElement("aside", "controls");
      const heading = createElement("h2", "controls__title", "CONTROLS");
      heading.id = "controls-title";
      panel.setAttribute("aria-labelledby", "controls-title");
      panel.append(heading);
      const rows = [
        ["MOVE", ["A", "D"]],
        ["FIRE", ["SPACE"]],
        ["PAUSE", ["P"]]
      ];
      rows.forEach(([label, keys]) => {
        const row = createElement("div", "controls__row");
        row.append(createElement("span", "controls__label", label));
        const group = createElement("span", keys.length > 1 ? "controls__keys" : "");
        group.setAttribute("aria-label", keys.join(" and ") + " keys");
        keys.forEach((key) => group.append(createKey(key, "controls__key" + (key === "SPACE" ? " controls__key--wide" : ""))));
        row.append(group);
        panel.append(row);
      });
      this.replaceChildren(panel);
      return;
    }

    const panel = createElement("section", "play-controls");
    panel.setAttribute("aria-label", "Controls");
    const rows = [["A", "D", "MOVE"], ["SPACE", "", "FIRE"], ["P", "", "PAUSE"]];
    rows.forEach(([first, second, label]) => {
      const row = createElement("div", "play-controls__row");
      const keys = createElement("span", first === "A" ? "play-controls__keys" : "");
      keys.append(createKey(first, first === "SPACE" ? "play-controls__space" : ""));
      if (second) keys.append(createKey(second));
      row.append(keys, createElement("span", "", label));
      panel.append(row);
    });
    this.replaceChildren(panel);
  }
}

class EnemyFormation extends HTMLElement {
  setRows(rows) {
    this.setAttribute("rows", rows);
    this.connectedCallback();
  }

  connectedCallback() {
    const formation = createElement("div", "enemy-formation");
    formation.setAttribute("aria-label", "Enemy formation");
    const rows = (this.getAttribute("rows") || "hard:8,medium:10,medium:10,easy:10").split(",");
    rows.forEach((rowSpec) => {
      const [type, countText] = rowSpec.split(":");
      const row = createElement("div", "enemy-formation__row" + (type === "hard" ? " enemy-formation__row--hard" : ""));
      row.setAttribute("aria-label", "Enemy row with " + countText + " units");
      for (let index = 0; index < Number(countText); index += 1) {
        const enemy = document.createElement("img");
        enemy.src = ICONS + "enemies/enemy-" + type + ".svg";
        enemy.dataset.type = type;
        enemy.dataset.health = type === "hard" ? "3" : type === "medium" ? "2" : "1";
        enemy.setAttribute("aria-label", type + " enemy");
        enemy.alt = "";
        row.append(enemy);
      }
      formation.append(row);
    });
    this.replaceChildren(formation);
  }
}

class BunkerRow extends HTMLElement {
  setCount(count) {
    this.setAttribute("count", String(count));
    this.connectedCallback();
  }

  connectedCallback() {
    const count = Number(this.getAttribute("count") || 4);
    const row = createElement("div", "bunker-row");
    row.setAttribute("aria-label", count + " bunker placeholders");
    for (let index = 0; index < count; index += 1) {
      const bunker = document.createElement("img");
      bunker.src = ICONS + "bunker.svg";
      bunker.alt = "";
      row.append(bunker);
    }
    this.replaceChildren(row);
  }
}

class PlayerShip extends HTMLElement {
  connectedCallback() {
    const ship = document.createElement("img");
    ship.className = "player-ship";
    ship.src = ICONS + "player-triangle.svg";
    ship.alt = "Player ship placeholder";
    this.replaceChildren(ship);
  }
}

class WaveUpdates extends HTMLElement {
  static get observedAttributes() { return ["speed", "fire-rate", "clear-bonus"]; }

  attributeChangedCallback() { if (this.isConnected) this.connectedCallback(); }

  connectedCallback() {
    const list = createElement("dl", "wave-updates");
    list.setAttribute("aria-label", "Placeholder wave updates");
    [["SPEED", this.getAttribute("speed") || "+15%"], ["FIRE RATE", this.getAttribute("fire-rate") || "+10%"], ["CLEAR BONUS", this.getAttribute("clear-bonus") || "+500"]].forEach(([label, value]) => {
      const row = createElement("div", "wave-updates__row");
      row.append(createElement("dt", "", label), createElement("dd", "", value));
      list.append(row);
    });
    this.replaceChildren(list);
  }
}

class CountdownTimer extends HTMLElement {
  static get observedAttributes() { return ["seconds", "wave"]; }

  attributeChangedCallback() {
    if (this.isConnected) this.connectedCallback();
  }

  disconnectedCallback() { window.clearInterval(this.interval); }

  connectedCallback() {
    window.clearInterval(this.interval);
    let secondsRemaining = Number(this.getAttribute("seconds") || 5);
    const wave = this.getAttribute("wave") || "04";
    const timer = createElement("p", "wave-countdown");
    timer.setAttribute("role", "timer");
    const label = createElement("span", "wave-countdown__label", "STARTS IN");
    const value = createElement("span", "wave-countdown__value", String(secondsRemaining).padStart(2, "0"));
    timer.setAttribute("aria-label", "Wave begins in " + secondsRemaining + " seconds");
    timer.append(label, value);
    this.replaceChildren(timer);

    this.interval = window.setInterval(() => {
      secondsRemaining = Math.max(0, secondsRemaining - 1);
      value.textContent = String(secondsRemaining).padStart(2, "0");
      if (secondsRemaining === 0) {
        label.textContent = "WAVE " + wave + " READY";
        timer.setAttribute("aria-label", "Wave " + wave + " ready");
        window.clearInterval(this.interval);
        window.setTimeout(() => window.spaceAttackNavigate?.("./gameplay.html"), 650);
      } else {
        timer.setAttribute("aria-label", "Wave begins in " + secondsRemaining + " seconds");
      }
    }, 1000);
  }
}

class RunSummary extends HTMLElement {
  static get observedAttributes() { return ["final-score", "waves-cleared", "hi-score"]; }

  attributeChangedCallback() { if (this.isConnected) this.connectedCallback(); }

  connectedCallback() {
    const stats = createElement("dl", "run-stats");
    const rows = [
      ["FINAL SCORE", this.getAttribute("final-score") || "012 460", true],
      ["WAVES CLEARED", this.getAttribute("waves-cleared") || "06", false],
      ["HI-SCORE", this.getAttribute("hi-score") || "015 300", false]
    ];
    rows.forEach(([label, rawValue, isFinal]) => {
      const value = String(rawValue);
      const leadingZero = value.match(/^0+/)?.[0] || "";
      const liveValue = value.slice(leadingZero.length);
      const row = createElement("div", "run-stats__row" + (isFinal ? " run-stats__row--final" : ""));
      const labelNode = createElement("dt", "", label);
      const valueNode = createElement("dd");
      valueNode.append(createElement("span", "run-stats__leading-zero", leadingZero), createElement("span", "", liveValue));
      row.append(labelNode, valueNode);
      stats.append(row);
    });
    this.replaceChildren(stats);
  }
}

class ArcadeTitle extends HTMLElement {
  connectedCallback() {
    const variant = this.getAttribute("variant") || "start";
    const lines = variant === "game-over"
      ? [["GAME", "game-over-title__line"], ["OVER", "game-over-title__line game-over-title__line--signal"]]
      : [["SPACE", "start-screen__title-line start-screen__title-line--paper"], ["ATTACK", "start-screen__title-line start-screen__title-line--signal"]];
    const title = createElement("h1", variant === "game-over" ? "game-over-title" : "start-screen__title");
    lines.forEach(([text, className]) => title.append(createElement("span", className, text)));
    this.replaceChildren(title);
  }
}

class HostileReadout extends HTMLElement {
  static get observedAttributes() { return ["count", "total"]; }

  attributeChangedCallback() { if (this.isConnected) this.connectedCallback(); }

  connectedCallback() {
    const count = this.getAttribute("count") || "0";
    const total = this.getAttribute("total") || "0";
    const section = createElement("section", "readout readout--hostiles");
    section.setAttribute("aria-label", count + " of " + total + " hostiles");
    section.append(createElement("p", "readout__label", "HOSTILES"));
    const value = createElement("p", "hostile-value");
    value.append(createElement("span", "", count), createElement("span", "hostile-value__total", "/" + total));
    section.append(value);
    this.replaceChildren(section);
  }
}

customElements.define("arcade-button", ArcadeButton);
customElements.define("score-readout", ScoreReadout);
customElements.define("status-meter", StatusMeter);
customElements.define("lives-indicator", LifeIndicator);
customElements.define("control-panel", ControlPanel);
customElements.define("enemy-formation", EnemyFormation);
customElements.define("bunker-row", BunkerRow);
customElements.define("player-ship", PlayerShip);
customElements.define("wave-updates", WaveUpdates);
customElements.define("countdown-timer", CountdownTimer);
customElements.define("run-summary", RunSummary);
customElements.define("arcade-title", ArcadeTitle);
customElements.define("hostile-readout", HostileReadout);
