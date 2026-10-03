(() => {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function forWave(wave) {
    const current = Math.max(1, Math.floor(wave));
    const step = current - 1;
    const total = Math.min(80, 12 + step);
    const mediumShare = 0.55 * clamp((current - 2) / 18, 0, 1);
    const hardShare = 0.3 * clamp((current - 5) / 30, 0, 1);
    const medium = current < 3 ? 0 : Math.min(Math.floor(total * 0.58), Math.max(1, Math.floor(total * mediumShare)));
    const hard = current < 6 ? 0 : Math.min(Math.floor(total * 0.3), Math.max(1, Math.floor(total * hardShare)));

    return {
      hard,
      medium,
      easy: total - hard - medium,
      total,
      speed: 42 + step * 0.055,
      fireInterval: Math.max(0.42, 1.45 - step * 0.001),
      drop: Math.min(34, 16 + Math.floor(step / 70))
    };
  }

  function rosterRows(wave) {
    const { hard, medium, easy } = forWave(wave);
    const rows = [
      { type: "hard", count: hard },
      { type: "medium", count: Math.ceil(medium / 2) },
      { type: "medium", count: Math.floor(medium / 2) },
      { type: "easy", count: easy }
    ];
    const offset = (Math.max(1, wave) - 1) % rows.length;
    return rows.slice(offset).concat(rows.slice(0, offset)).filter((row) => row.count > 0);
  }

  window.spaceAttackProgression = Object.freeze({ maxWaves: 1000, forWave, rosterRows });
})();
