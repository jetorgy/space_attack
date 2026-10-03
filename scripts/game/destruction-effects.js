(() => {
  const fragments = [];
  const shakeTimers = new WeakMap();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frameId = 0;
  let previousFrame = 0;

  function shake(element) {
    if (!element) return;
    window.clearTimeout(shakeTimers.get(element));
    element.classList.remove("is-shaking");
    void element.offsetWidth;
    element.classList.add("is-shaking");
    shakeTimers.set(element, window.setTimeout(() => element.classList.remove("is-shaking"), 220));
  }

  function createShard(field, left, top, width, height, directionX, directionY, accent = false) {
    const element = document.createElement("span");
    element.className = "enemy-fragment" + (accent ? " enemy-fragment--signal" : "");
    element.setAttribute("aria-hidden", "true");
    element.style.left = left + "px";
    element.style.top = top + "px";
    element.style.width = Math.max(3, width) + "px";
    element.style.height = Math.max(3, height) + "px";
    field.append(element);

    if (prefersReducedMotion.matches) {
      window.setTimeout(() => element.remove(), 150);
      return;
    }

    fragments.push({
      element,
      field,
      x: left,
      y: top,
      vx: directionX * (55 + Math.random() * 70) + (Math.random() - 0.5) * 35,
      vy: directionY * (45 + Math.random() * 75) - 20,
      gravity: 440 + Math.random() * 220,
      drag: 0.18 + Math.random() * 0.28,
      rotation: (Math.random() - 0.5) * 24,
      spin: (Math.random() - 0.5) * 600,
      age: 0,
      life: 0.8 + Math.random() * 0.45,
      fadeStart: 0.48 + Math.random() * 0.12
    });
    if (!frameId) frameId = requestAnimationFrame(stepFragments);
  }

  function stepFragments(now) {
    const delta = previousFrame ? Math.min(0.04, (now - previousFrame) / 1000) : 0;
    previousFrame = now;

    for (let index = fragments.length - 1; index >= 0; index -= 1) {
      const shard = fragments[index];
      if (!shard.field.isConnected || !shard.element.isConnected) {
        shard.element.remove();
        fragments.splice(index, 1);
        continue;
      }

      shard.age += delta;
      shard.vx *= Math.exp(-shard.drag * delta);
      shard.x += shard.vx * delta;
      shard.y += shard.vy * delta;
      shard.vy += shard.gravity * delta;
      shard.rotation += shard.spin * delta;
      shard.element.style.left = shard.x + "px";
      shard.element.style.top = shard.y + "px";
      shard.element.style.transform = "rotate(" + shard.rotation + "deg)";

      const fadeProgress = Math.max(0, (shard.age / shard.life - shard.fadeStart) / (1 - shard.fadeStart));
      shard.element.style.opacity = String(1 - fadeProgress);
      if (shard.age >= shard.life || shard.y > shard.field.clientHeight + 30) {
        shard.element.remove();
        fragments.splice(index, 1);
      }
    }

    if (fragments.length) frameId = requestAnimationFrame(stepFragments);
    else { frameId = 0; previousFrame = 0; }
  }

  function explode(element, field) {
    if (!element || !field) return;
    const target = element.getBoundingClientRect();
    const boundary = field.getBoundingClientRect();
    const left = target.left - boundary.left;
    const top = target.top - boundary.top;
    const width = target.width;
    const height = target.height;
    const flash = document.createElement("span");
    flash.className = "enemy-break-flash";
    flash.setAttribute("aria-hidden", "true");
    Object.assign(flash.style, { left: left + "px", top: top + "px", width: width + "px", height: height + "px" });
    field.append(flash);
    window.setTimeout(() => flash.remove(), prefersReducedMotion.matches ? 40 : 75);

    const shards = [
      { x: 0.02, y: 0.02, w: 0.42, h: 0.42, dx: -1, dy: -0.8 },
      { x: 0.56, y: 0.02, w: 0.42, h: 0.4, dx: 1, dy: -0.8 },
      { x: 0.04, y: 0.56, w: 0.4, h: 0.42, dx: -0.9, dy: 1 },
      { x: 0.56, y: 0.56, w: 0.42, h: 0.42, dx: 1, dy: 1 }
    ];
    window.setTimeout(() => {
      if (!field.isConnected) return;
      shards.forEach((shard) => createShard(
        field,
        left + width * shard.x,
        top + height * shard.y,
        width * shard.w,
        height * shard.h,
        shard.dx,
        shard.dy
      ));
      createShard(field, left + width * 0.43, top + height * 0.4, width * 0.14, height * 0.2, 0, 0.2, true);
    }, prefersReducedMotion.matches ? 40 : 75);
  }

  window.spaceAttackEffects = Object.freeze({ explode, shake });
})();
