(() => {
  const ROOT = "./assets/sfx/";
  const CLIPS = {
    music: { file: "cyberpunk_song.mp3", volume: 0.2, loop: true },
    enemyAmbience: { file: "engine_ambience_movement.mp3", volume: 0.3, loop: true },
    laser: { file: "laser_shot.mp3", volume: 0.42 },
    hit: { file: "hit.mp3", volume: 0.125 },
    pause: { file: "menu_pause.mp3", volume: 0.65 },
    gameOver: { file: "game_over.mp3", volume: 0.3 },
    newWave: { file: "new_wave.mp3", volume: 0.7 },
    waveRiser: { file: "next_wave_build_up_riser.mp3", volume: 0.275 },
    click: { file: "on_click.mp3", volume: 0.5 },
    hover: { file: "on_hover.mp3", volume: 0.45 }
  };

  // The supplied laser recording contains six distinct shot accents.
  const LASER_CLIPS = [
    [0.03, 0.43], [1.06, 1.59], [2.96, 3.49],
    [4.88, 5.24], [6.23, 6.96], [8.56, 9.49]
  ];

  class SoundEngine {
    constructor() {
      this.unlocked = false;
      this.oneShots = new Set();
      this.music = null;
      this.enemyAmbience = null;
      this.audioContext = null;
      this.laserBuffer = null;
      this.laserLoad = null;
      this.lastLaserClip = -1;
      this.screenCuePlayed = false;
      this.pendingScreenCue = null;

      document.addEventListener("pointerdown", (event) => {
        this.unlock();
        if (this.actionFromEvent(event)) this.play("click");
      }, { passive: true });
      document.addEventListener("keydown", () => this.unlock());
      document.addEventListener("click", (event) => {
        if (event.detail === 0 && this.actionFromEvent(event)) this.play("click");
      }, true);
      document.addEventListener("pointerover", (event) => {
        const action = this.actionFromEvent(event);
        if (this.unlocked && action && !action.contains(event.relatedTarget)) this.play("hover");
      });

      this.connectGameplayControls();
      this.connectScreenCue();
      window.addEventListener("pagehide", () => this.rememberMusicPosition());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.stopEnemyAmbience();
        else if (document.querySelector(".play-screen enemy-formation img")) this.startEnemyAmbience();
      });
    }

    actionFromEvent(event) {
      return event.composedPath().find((node) => node instanceof Element && node.matches("a, button, [role='button']")) || null;
    }

    unlock() {
      if (!this.unlocked) {
        this.unlocked = true;
        try { sessionStorage.setItem("space-attack-audio-enabled", "1"); } catch { /* storage is optional */ }
      }
      this.startMusic();
      if (document.querySelector(".play-screen enemy-formation img")) this.startEnemyAmbience();
      this.loadLaserBuffer();
      if (this.pendingScreenCue) {
        const cue = this.pendingScreenCue;
        this.pendingScreenCue = null;
        cue();
      }
    }

    play(name, { fadeOutSeconds = 0 } = {}) {
      const clip = CLIPS[name];
      if (!clip) return null;
      const audio = new Audio(ROOT + clip.file);
      audio.preload = "auto";
      audio.volume = clip.volume;
      audio.loop = Boolean(clip.loop);
      if (fadeOutSeconds > 0) {
        const fadeTail = () => {
          if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
          const remaining = audio.duration - audio.currentTime;
          if (remaining <= fadeOutSeconds) {
            audio.volume = clip.volume * Math.max(0, Math.min(1, remaining / fadeOutSeconds));
          }
        };
        audio.addEventListener("loadedmetadata", fadeTail);
        audio.addEventListener("timeupdate", fadeTail);
      }
      // Keep one-shot clips alive across screen swaps; they leave this set when they finish naturally.
      this.oneShots.add(audio);
      audio.addEventListener("ended", () => this.oneShots.delete(audio), { once: true });
      audio.addEventListener("error", () => this.oneShots.delete(audio), { once: true });
      audio.play().catch(() => this.oneShots.delete(audio));
      return audio;
    }

    startMusic() {
      if (this.music && !this.music.paused) return;
      const clip = CLIPS.music;
      const track = new Audio(ROOT + clip.file);
      track.loop = true;
      track.volume = clip.volume;
      try {
        const position = Number(sessionStorage.getItem("space-attack-music-time"));
        if (Number.isFinite(position) && position > 0) track.currentTime = position;
      } catch { /* storage is optional */ }
      this.music = track;
      track.play().catch(() => {});
    }

    rememberMusicPosition() {
      if (!this.music || this.music.paused) return;
      try { sessionStorage.setItem("space-attack-music-time", String(this.music.currentTime)); } catch { /* storage is optional */ }
    }

    startEnemyAmbience() {
      if (!this.unlocked || this.enemyAmbience || !document.querySelector(".play-screen enemy-formation img")) return;
      const clip = CLIPS.enemyAmbience;
      this.enemyAmbience = new Audio(ROOT + clip.file);
      this.enemyAmbience.loop = true;
      this.enemyAmbience.volume = clip.volume;
      this.enemyAmbience.play().catch(() => { this.enemyAmbience = null; });
    }

    stopEnemyAmbience() {
      if (!this.enemyAmbience) return;
      this.enemyAmbience.pause();
      this.enemyAmbience.currentTime = 0;
      this.enemyAmbience = null;
    }

    setHostilesRemaining(count) {
      if (count > 0) this.startEnemyAmbience();
      else this.stopEnemyAmbience();
    }

    loadLaserBuffer() {
      if (this.laserBuffer || this.laserLoad || !window.AudioContext) return this.laserLoad;
      this.audioContext ||= new AudioContext();
      this.audioContext.resume().catch(() => {});
      this.laserLoad = fetch(ROOT + "laser_shot.mp3")
        .then((response) => {
          if (!response.ok) throw new Error("Laser audio could not be loaded");
          return response.arrayBuffer();
        })
        .then((data) => this.audioContext.decodeAudioData(data))
        .then((buffer) => { this.laserBuffer = buffer; return buffer; })
        .catch(() => null);
      return this.laserLoad;
    }

    async playLaser() {
      const index = this.chooseLaserClip();
      const [start, end] = LASER_CLIPS[index];
      const buffer = this.laserBuffer || await this.loadLaserBuffer();
      if (!buffer || !this.audioContext) {
        this.playLaserFallback(start, end);
        return;
      }
      try {
        await this.audioContext.resume();
      } catch {
        this.playLaserFallback(start, end);
        return;
      }
      const source = this.audioContext.createBufferSource();
      const gain = this.audioContext.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.42;
      source.connect(gain).connect(this.audioContext.destination);
      source.start(0, start, Math.min(end, buffer.duration) - start);
    }

    chooseLaserClip() {
      let index = Math.floor(Math.random() * LASER_CLIPS.length);
      if (LASER_CLIPS.length > 1 && index === this.lastLaserClip) index = (index + 1 + Math.floor(Math.random() * (LASER_CLIPS.length - 1))) % LASER_CLIPS.length;
      this.lastLaserClip = index;
      return index;
    }

    playLaserFallback(start, end) {
      const audio = new Audio(ROOT + CLIPS.laser.file);
      audio.preload = "auto";
      audio.volume = CLIPS.laser.volume;
      audio.addEventListener("loadedmetadata", () => {
        audio.currentTime = start;
        audio.play().then(() => window.setTimeout(() => audio.pause(), (end - start) * 1000)).catch(() => {});
      }, { once: true });
      audio.load();
    }

    connectGameplayControls() {
      if (!document.querySelector(".play-screen")) return;
      document.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        if ((event.code === "Space" || key === " ") && !event.repeat) this.playLaser();
      });
    }

    playScreenCue(screen) {
      if (screen === "pause") this.play("pause");
      if (screen === "game-over") this.play("gameOver");
      if (screen === "new-wave") {
        this.play("newWave");
        // The new-wave cue is allowed to finish after gameplay begins.
        window.setTimeout(() => this.play("waveRiser", { fadeOutSeconds: 3 }), 180);
      }
    }

    enterScreen(screen) {
      document.body.dataset.audioScreen = screen;
      if (screen === "gameplay") this.startEnemyAmbience();
      else if (screen !== "pause") this.stopEnemyAmbience();
      if (this.unlocked) this.playScreenCue(screen);
      else this.pendingScreenCue = () => this.playScreenCue(screen);
    }

    connectScreenCue() {
      const screen = document.body.dataset.audioScreen;
      let enabled = false;
      try { enabled = sessionStorage.getItem("space-attack-audio-enabled") === "1"; } catch { /* storage is optional */ }
      if (enabled) {
        this.unlocked = true;
        this.startMusic();
        this.loadLaserBuffer();
        if (screen === "gameplay" && document.querySelector(".play-screen enemy-formation img")) this.startEnemyAmbience();
        this.playScreenCue(screen);
      } else {
        this.pendingScreenCue = () => this.playScreenCue(screen);
      }
    }
  }

  window.spaceAttackAudio = new SoundEngine();
})();
