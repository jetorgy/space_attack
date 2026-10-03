(() => {
  const RUN_KEY = "space-attack-run";
  const BEST_KEY = "space-attack-high-score";
  const read = (key, fallback) => { try { const value = sessionStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  const write = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* browser storage may be disabled */ } };
  const readBest = () => { try { return Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0); } catch { return 0; } };
  const writeBest = (value) => { try { localStorage.setItem(BEST_KEY, String(value)); } catch { /* browser storage may be disabled */ } };
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  const formatScore = (value) => String(Math.max(0, value)).padStart(6, "0");

  let run = read(RUN_KEY, null);
  let devOneHit = new URLSearchParams(location.search).get("dev") === "1";
  let highScore = readBest();
  let initialized = false;
  let running = false;
  let raf = 0;
  let lastFrame = 0;
  let frameDelta = 0;
  let enemyFireAt = 0;
  let formationX = 0;
  let formationY = 0;
  let direction = 1;
  let playerX = 0.5;
  let fireAt = 0;
  let enemies = [];
  let enemiesTotal = 0;
  let shots = [];
  let bunkers = [];
  const keys = { left: false, right: false };

  function newRun() {
    run = { score: 0, wave: 1, lives: 3, hull: 100, wavesCleared: 0, status: "active" };
    write(RUN_KEY, run);
  }

  function progression(wave) {
    return window.spaceAttackProgression.forWave(wave);
  }

  function screen() { return document.body.dataset.audioScreen || "start"; }
  function field() { return document.querySelector(".playfield"); }
  function formation() { return document.querySelector("enemy-formation .enemy-formation"); }
  function ship() { return document.querySelector(".player-ship"); }

  function getEnemyRoster() {
    return window.spaceAttackProgression.rosterRows(run.wave).map(({ type, count }) => type + ":" + count).join(",");
  }

  function showHighScore() {
    highScore = readBest();
    const digits = formatScore(highScore);
    const zeros = digits.match(/^0+/)?.[0] || "";
    const header = document.querySelector('score-readout[mode="header"]');
    if (header) {
      // Only the zeroes before the first significant digit use the muted color.
      header.setAttribute("zeros", zeros);
      const significant = digits.slice(zeros.length);
      header.setAttribute("live", significant.slice(0, -3));
      header.setAttribute("suffix", significant.slice(-3));
    }
    return highScore;
  }

  function updateScore() {
    const score = document.querySelector('.play-screen score-readout[mode="gameplay"]');
    const digits = formatScore(run.score);
    const zeros = digits.match(/^0+/)?.[0] || "";
    const bestDigits = formatScore(highScore);
    const bestZeros = bestDigits.match(/^0+/)?.[0] || "";
    if (score) {
      score.setAttribute("zeros", zeros);
      score.setAttribute("value", digits.slice(zeros.length));
      score.setAttribute("high-score", bestDigits.slice(bestZeros.length));
      score.setAttribute("high-zeros", bestZeros);
    }
    const pauseScore = document.querySelector('score-readout[mode="pause"]');
    if (pauseScore) { pauseScore.setAttribute("zeros", zeros); pauseScore.setAttribute("value", digits.slice(zeros.length)); }
    const newWaveScore = document.querySelector('score-readout[mode="new-wave"]');
    if (newWaveScore) { newWaveScore.setAttribute("zeros", zeros); newWaveScore.setAttribute("value", digits.slice(zeros.length)); }
  }

  function updateHud() {
    if (!run) return;
    const waveNode = document.querySelector(".wave-value");
    if (waveNode) waveNode.textContent = pad(run.wave);
    const waveReadout = document.querySelector(".readout--wave");
    waveReadout?.setAttribute("aria-label", "Wave " + run.wave);
    const count = enemies.filter((enemy) => enemy.element.isConnected).length;
    const threat = document.querySelector('status-meter[kind="threat"]');
    const remainingPercent = enemiesTotal > 0 ? (count / enemiesTotal) * 100 : 0;
    threat?.setAttribute("value", String(remainingPercent));
    document.querySelector('status-meter[kind="hull"]')?.setAttribute("value", String(run.hull));
    document.querySelector("lives-indicator")?.setAttribute("lives", String(run.lives));
    const hostileNode = document.querySelector("hostile-readout");
    hostileNode?.setAttribute("count", String(count));
    hostileNode?.setAttribute("total", String(enemiesTotal));
    updateScore();
    showHighScore();
    const pauseHull = document.querySelector(".pause-readout--hull span");
    if (pauseHull) pauseHull.textContent = run.hull + "%";
    const waveHull = document.querySelector(".new-wave-hull span");
    if (waveHull) waveHull.textContent = run.hull + "%";
    window.spaceAttackAudio?.setHostilesRemaining(count);
    write(RUN_KEY, run);
  }

  function updateHighScore() {
    if (run.score <= highScore) return;
    highScore = run.score;
    writeBest(highScore);
  }

  function setupBunkers(saved = null) {
    const row = document.querySelector("bunker-row");
    if (!row) return;
    const count = saved ? saved.length : run.wave < 6 ? 0 : run.wave < 10 ? 1 : run.wave === 10 ? (Math.random() < 0.5 ? 1 : 2) : Math.min(4, 2 + Math.floor((run.wave - 10) / 5));
    row.setCount(count);
    const wrapper = row.querySelector(".bunker-row");
    wrapper.classList.toggle("bunker-row--active", count > 0);
    const positions = [];
    for (let index = 0; index < count; index += 1) {
      let candidate = saved?.[index]?.x ?? 0.5;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        candidate = 0.12 + Math.random() * 0.76;
        if (positions.every((position) => Math.abs(position - candidate) >= 0.15)) break;
      }
      positions.push(candidate);
    }
    bunkers = [...wrapper.querySelectorAll("img")].map((element, index) => {
      const x = positions[index];
      element.style.left = (x * 100) + "%";
      const health = saved?.[index]?.health ?? 4;
      element.dataset.health = String(health);
      if (health < 4) element.classList.add("is-damaged");
      return { element, x, health };
    });
  }

  function setupWave(restore = false) {
    const host = document.querySelector("enemy-formation");
    if (!host || !run) return;
    const world = restore ? run.world : null;
    let rows = getEnemyRoster();
    if (world?.enemies?.length) {
      const segments = [];
      world.enemies.forEach(({ type }) => {
        const last = segments[segments.length - 1];
        if (last?.type === type) last.count += 1;
        else segments.push({ type, count: 1 });
      });
      rows = segments.map(({ type, count }) => type + ":" + count).join(",");
    }
    host.setRows(rows);
    const total = [...host.querySelectorAll("img")].length;
    enemiesTotal = world?.enemiesTotal ?? total;
    enemies = [...host.querySelectorAll("img")].map((element) => ({ element, health: Number(element.dataset.health), type: element.dataset.type }));
    formationX = world?.formationX ?? 0;
    formationY = world?.formationY ?? 0;
    direction = world?.direction ?? 1;
    playerX = world?.playerX ?? 0.5;
    if (world?.enemies?.length) world.enemies.forEach((enemy, index) => { if (enemies[index]) { enemies[index].health = enemy.health; enemies[index].type = enemy.type; } });
    if (ship()) ship().style.left = (playerX * 100) + "%";
    shots.forEach((shot) => shot.element.remove());
    shots = [];
    setupBunkers(world?.bunkers || null);
    const hostile = document.querySelector("hostile-readout");
    hostile?.setAttribute("total", String(total));
    hostile?.setAttribute("count", String(total));
    enemyFireAt = performance.now() + (devOneHit ? 250 : 1500);
    if (restore && world) run.world = null;
    updateHud();
  }

  function setRunSummary() {
    updateHighScore();
    const summary = document.querySelector("run-summary");
    const scoreDigits = formatScore(run.score);
    summary?.setAttribute("final-score", scoreDigits.slice(0, 3) + " " + scoreDigits.slice(3));
    summary?.setAttribute("waves-cleared", pad(run.wavesCleared));
    const bestDigits = formatScore(highScore);
    summary?.setAttribute("hi-score", bestDigits.slice(0, 3) + " " + bestDigits.slice(3));
    const wave = document.querySelector(".game-over-header__wave");
    if (wave) wave.textContent = pad(run.wave);
  }

  function gameOver() {
    if (run.status === "over") return;
    run.status = "over";
    running = false;
    cancelAnimationFrame(raf);
    updateHighScore();
    write(RUN_KEY, run);
    setRunSummary();
    window.spaceAttackNavigate?.("./game-over.html");
  }

  function nextWave() {
    running = false;
    cancelAnimationFrame(raf);
    run.score += 500;
    run.wavesCleared += 1;
    updateHighScore();
    if (run.wave >= window.spaceAttackProgression.maxWaves) {
      newRun();
      window.spaceAttackNavigate?.("./new-wave.html?wave=01&complete=1");
      return;
    }
    run.wave += 1;
    run.status = "active";
    write(RUN_KEY, run);
    window.spaceAttackNavigate?.("./new-wave.html?wave=" + pad(run.wave));
  }

  function prepareNewWavePage() {
    const n = document.querySelector(".new-wave-banner__number");
    if (n) n.textContent = pad(run.wave);
    const timer = document.querySelector("countdown-timer");
    timer?.setAttribute("wave", pad(run.wave));
    timer?.setAttribute("seconds", "5");
    const stats = document.querySelector("wave-updates");
    const p = progression(run.wave);
    stats?.setAttribute("speed", "+" + Math.round((p.speed / 42 - 1) * 100) + "%");
    stats?.setAttribute("fire-rate", "+" + Math.round((1.45 / p.fireInterval - 1) * 100) + "%");
    stats?.setAttribute("clear-bonus", "+500");
    updateHud();
  }

  function currentScreenChanged({ screen: next, previous, url }) {
    if (next === "start") { running = false; cancelAnimationFrame(raf); showHighScore(); return; }
    if (next === "gameplay") {
      const target = new URL(url, location.href);
      devOneHit = target.searchParams.get("dev") === "1";
      if (target.searchParams.has("restart") || !run || run.status === "over" || previous === "start") newRun();
      run.status = "active";
      if (!initialized || previous === "new-wave" || previous === "pause" || target.searchParams.has("restart") || previous === "start") setupWave(previous === "pause" && !target.searchParams.has("restart"));
      initialized = true;
      running = true;
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
      updateHud();
      return;
    }
    running = false;
    cancelAnimationFrame(raf);
    if (next === "pause") updateHud();
    if (next === "new-wave") prepareNewWavePage();
    if (next === "game-over") setRunSummary();
  }

  function rect(el) { return el?.getBoundingClientRect(); }
  function overlaps(a, b) { return a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }

  function fire(isEnemy = false, source = ship()) {
    const playfield = field();
    const sourceRect = rect(source);
    const fieldRect = rect(playfield);
    if (!playfield || !sourceRect || !fieldRect) return;
    const bullet = document.createElement("span");
    bullet.className = "game-shot game-shot--" + (isEnemy ? "enemy" : "player");
    bullet.setAttribute("aria-hidden", "true");
    const targetShipRect = isEnemy && devOneHit ? rect(ship()) : null;
    const x = (targetShipRect || sourceRect).left + (targetShipRect || sourceRect).width / 2 - fieldRect.left;
    const y = isEnemy ? sourceRect.bottom - fieldRect.top : sourceRect.top - fieldRect.top;
    bullet.style.left = x + "px";
    bullet.style.top = y + "px";
    playfield.append(bullet);
    shots.push({ element: bullet, x, y, velocity: isEnemy ? 270 : -530, enemy: isEnemy });
  }

  function bunkerHit(shot, bunker) {
    bunker.health -= 1;
    bunker.element.dataset.health = String(bunker.health);
    bunker.element.classList.add("is-damaged");
    if (bunker.health <= 0) {
      bunker.element.remove();
      bunkers = bunkers.filter((item) => item !== bunker);
    }
    shot.element.remove();
    shots = shots.filter((item) => item !== shot);
  }

  function enemyHit(enemy, shot) {
    window.spaceAttackAudio?.play("hit");
    enemy.health -= 1;
    shot.element.remove();
    shots = shots.filter((item) => item !== shot);
    if (enemy.health <= 0) {
      window.spaceAttackEffects?.explode(enemy.element, field());
      window.spaceAttackEffects?.shake(field());
      enemy.element.remove();
      run.score += enemy.type === "hard" ? 30 : enemy.type === "medium" ? 20 : 10;
      updateHighScore();
      updateHud();
      if (!enemies.some((item) => item.element.isConnected)) nextWave();
      return;
    }
    enemy.type = enemy.health === 3 ? "hard" : enemy.health === 2 ? "medium" : "easy";
    enemy.element.dataset.health = String(enemy.health);
    enemy.element.dataset.type = enemy.type;
    enemy.element.src = "./assets/components/atoms/icons/enemies/enemy-" + enemy.type + ".svg";
    enemy.element.setAttribute("aria-label", enemy.type + " enemy, " + enemy.health + " hits remaining");
    enemy.element.closest(".enemy-formation__row")?.setAttribute("aria-label", "Enemy row, units may have taken damage");
  }

  function collideShots() {
    const playfield = field();
    const f = rect(playfield);
    const active = [...shots];
    for (const shot of active) {
      shot.y += shot.velocity * frameDelta;
      shot.element.style.top = shot.y + "px";
      const bulletRect = rect(shot.element);
      if (!bulletRect || shot.y < -20 || shot.y > f.height + 20) { shot.element.remove(); shots = shots.filter((item) => item !== shot); continue; }
      const bunker = bunkers.find((item) => item.element.isConnected && overlaps(bulletRect, rect(item.element)));
      if (bunker) { bunkerHit(shot, bunker); continue; }
      if (shot.enemy && overlaps(bulletRect, rect(ship()))) {
        shot.element.remove(); shots = shots.filter((item) => item !== shot);
        window.spaceAttackAudio?.play("hit");
        window.spaceAttackEffects?.shake(field());
        if (devOneHit) {
          run.hull = 0;
          run.lives = 0;
          gameOver();
          return;
        }
        run.hull = Math.max(0, run.hull - 20);
        if (run.hull === 0) {
          window.spaceAttackEffects?.explode(ship(), field());
          run.lives -= 1;
          if (run.lives <= 0) { gameOver(); return; }
          run.hull = 100;
        }
        updateHud();
        continue;
      }
      if (!shot.enemy) {
        const target = enemies.find((enemy) => enemy.element.isConnected && overlaps(bulletRect, rect(enemy.element)));
        if (target) enemyHit(target, shot);
      }
    }
  }

  function formationBottom() {
    const node = formation();
    return node ? rect(node).bottom : 0;
  }

  function frame(now) {
    if (!running || screen() !== "gameplay") return;
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    frameDelta = dt;
    const f = rect(field());
    const form = formation();
    const player = ship();
    if (!f || !form || !player) { raf = requestAnimationFrame(frame); return; }
    const pace = progression(run.wave);
    const playerSpeed = Math.max(250, f.width * 0.48);
    if (keys.left) playerX -= playerSpeed * dt / f.width;
    if (keys.right) playerX += playerSpeed * dt / f.width;
    playerX = Math.max(0.04, Math.min(0.96, playerX));
    player.style.left = (playerX * 100) + "%";
    const livingRects = enemies.filter((enemy) => enemy.element.isConnected).map((enemy) => rect(enemy.element));
    if (!livingRects.length) { raf = requestAnimationFrame(frame); return; }
    const currentLeft = Math.min(...livingRects.map((bounds) => bounds.left - f.left));
    const currentRight = Math.max(...livingRects.map((bounds) => bounds.right - f.left));
    const baseLeft = currentLeft - formationX;
    const baseRight = currentRight - formationX;
    let leftLimit = 2 - baseLeft;
    let rightLimit = f.width - 2 - baseRight;
    if (leftLimit > rightLimit) leftLimit = rightLimit = (leftLimit + rightLimit) / 2;
    const previousX = formationX;
    formationX += direction * pace.speed * dt;
    if (formationX >= rightLimit || formationX <= leftLimit) {
      direction *= -1;
      formationX = Math.max(leftLimit, Math.min(rightLimit, formationX));
      const shift = formationX - previousX;
      const projectedLeft = f.left + currentLeft + shift;
      const projectedRight = f.left + currentRight + shift;
      const newBottom = formationBottom() + pace.drop;
      const bunkerBand = rect(document.querySelector(".bunker-row--active"));
      const blocker = bunkers.find((bunker) => bunker.element.isConnected && bunkerBand && newBottom >= bunkerBand.top && overlaps({ left: projectedLeft, right: projectedRight, top: newBottom, bottom: newBottom + 4 }, rect(bunker.element)));
      if (blocker) {
        bunkerHit({ element: { remove() {} } }, blocker);
      } else formationY += pace.drop;
    }
    form.style.translate = formationX + "px " + formationY + "px";
    if (formationBottom() >= rect(player).top) { gameOver(); return; }

    if (now >= enemyFireAt && enemies.length && enemies.some((enemy) => enemy.element.isConnected)) {
      const living = enemies.filter((enemy) => enemy.element.isConnected);
      const shooter = living[Math.floor(Math.random() * living.length)];
      fire(true, shooter.element);
      enemyFireAt = now + (devOneHit ? 0.25 : pace.fireInterval) * 1000;
    }
    collideShots();
    raf = requestAnimationFrame(frame);
  }

  function firePlayer() {
    if (!running || screen() !== "gameplay" || performance.now() < fireAt) return;
    fireAt = performance.now() + 250;
    fire(false);
  }

  function saveWorld() {
    if (!running || !field()) return;
    run.world = {
      formationX, formationY, direction, playerX,
      enemiesTotal,
      enemies: enemies.filter((enemy) => enemy.element.isConnected).map(({ health, type }) => ({ health, type })),
      bunkers: bunkers.filter((bunker) => bunker.element.isConnected).map(({ health, x }) => ({ health, x }))
    };
    write(RUN_KEY, run);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    const inPlay = screen() === "gameplay";
    if (inPlay && (key === "a" || key === "arrowleft")) {
      keys.left = true;
      if (!event.repeat) playerX = Math.max(0.04, playerX - 0.035);
      event.preventDefault();
    }
    if (inPlay && (key === "d" || key === "arrowright")) {
      keys.right = true;
      if (!event.repeat) playerX = Math.min(0.96, playerX + 0.035);
      event.preventDefault();
    }
    if (inPlay && event.code === "Space") { event.preventDefault(); firePlayer(); }
    if (inPlay && key === "p" && !event.repeat) saveWorld();
    if (screen() === "game-over" && !event.repeat && key === "enter") window.spaceAttackNavigate?.("./gameplay.html?restart=1");
    if (screen() === "game-over" && !event.repeat && key === "escape") window.spaceAttackNavigate?.("./index.html");
  }
  function onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") keys.left = false;
    if (key === "d" || key === "arrowright") keys.right = false;
  }

  function boot() {
    showHighScore();
    if (screen() === "gameplay") {
      const restart = new URL(location.href).searchParams.has("restart");
      if (restart || !run || run.status === "over") newRun();
      run ||= { score: 0, wave: 1, lives: 3, hull: 100, wavesCleared: 0, status: "active" };
      setupWave();
      initialized = true;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    if (screen() === "new-wave") {
      run ||= { score: 0, wave: 1, lives: 3, hull: 100, wavesCleared: 0, status: "active" };
      const requestedWave = Number(new URL(location.href).searchParams.get("wave"));
      if (requestedWave) run.wave = requestedWave;
      prepareNewWavePage();
    }
    if (screen() === "game-over" && run) setRunSummary();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => { keys.left = false; keys.right = false; });
  window.addEventListener("spaceattack:screenchange", (event) => currentScreenChanged(event.detail));
  window.addEventListener("storage", (event) => { if (event.key === BEST_KEY) { highScore = readBest(); showHighScore(); updateHud(); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
