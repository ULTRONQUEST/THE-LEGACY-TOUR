/**
 * cabin.js — Spacecraft Cabin Interactive Experience Controller
 * Manages:
 * - Ambient synthesized cabin audio (Web Audio API with mute control)
 * - Clickable seatbelt toggle (UNFASTENED <-> SECURED)
 * - Observation window view filters (CLEAR, TINT, HUD)
 * - Collapsible Mission Control Telemetry drawer
 * - Pre-departure boot sequence
 * - Launch authorization readiness
 */

class CabinAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = true; // Default to muted for polite browser policy
    this.ambientGain = null;
    this.osc1 = null;
    this.osc2 = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.isInitialized = true;
    } catch (e) {
      console.warn('[CabinAudio] Web Audio API unavailable:', e);
    }
  }

  startAmbient() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.ambientGain) return;

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      // Master ambient gain
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, this.ctx.currentTime);

      // Lowpass filter for deep spacecraft interior resonance
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      // Oscillator 1: 55Hz (sub-bass engine hum)
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sine';
      this.osc1.frequency.setValueAtTime(55, this.ctx.currentTime);

      // Oscillator 2: 110Hz (harmonic cabin vibration)
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'triangle';
      this.osc2.frequency.setValueAtTime(110, this.ctx.currentTime);

      this.osc1.connect(filter);
      this.osc2.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      this.osc1.start();
      this.osc2.start();
    } catch (err) {
      console.warn('[CabinAudio] Failed to start ambient drone:', err);
    }
  }

  toggleMute() {
    this.init();
    this.isMuted = !this.isMuted;

    if (!this.ambientGain) {
      this.startAmbient();
    }

    if (this.ambientGain && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const targetGain = this.isMuted ? 0 : 0.08;
      this.ambientGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.15);
    }

    if (!this.isMuted) {
      this.playChime();
    }

    return this.isMuted;
  }

  playChime(freq1 = 587.33, freq2 = 880, duration = 0.25) {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, now);
      osc.frequency.exponentialRampToValueAtTime(freq2, now + duration);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio autoplay restrictions or errors
    }
  }

  playLockSound() {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(640, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }
}

export class SpacecraftCabin {
  constructor(callbacks = {}) {
    this.callbacks = callbacks; // e.g. onLaunchAuthorized, onReturnToBoarding
    this.audio = new CabinAudio();

    // State
    this.isSeatbeltFastened = false;
    this.currentViewMode = 'clear'; // 'clear' | 'tint' | 'hud'
    this.isTelemetryOpen = false;
    this.bootTimeoutIds = [];

    // DOM Elements
    this.screenEl = document.getElementById('spacecraft-page');
    this.welcomeBannerEl = document.getElementById('cabin-welcome-text');
    this.missionIdBadgeEl = document.getElementById('cabin-mission-id-badge');
    this.destinationsBadgeEl = document.getElementById('cabin-destinations-badge');

    // Seatbelt controls
    this.seatbeltBtn = document.getElementById('cabin-seatbelt-toggle');
    this.seatbeltStatusText = document.getElementById('cabin-seatbelt-status-text');
    this.seatbeltIcon = document.getElementById('cabin-seatbelt-icon');

    // Departure Readiness & Launch Button
    this.departureStatusBadge = document.getElementById('cabin-departure-status');
    this.departureStatusText = document.getElementById('cabin-departure-status-text');
    this.launchBtn = document.getElementById('cabin-launch-btn');
    this.launchHint = document.getElementById('cabin-launch-hint');

    // Window Viewport & Controls
    this.viewportEl = document.getElementById('cabin-observation-viewport');
    this.windowFilterBtns = document.querySelectorAll('.cabin-window-filter-btn');

    // Telemetry Drawer
    this.telemetryToggleBtn = document.getElementById('cabin-telemetry-toggle-btn');
    this.telemetryDrawerEl = document.getElementById('cabin-telemetry-drawer');

    // Audio Mute Toggle
    this.audioToggleBtn = document.getElementById('cabin-audio-toggle-btn');
    this.audioToggleIcon = document.getElementById('cabin-audio-toggle-icon');
    this.audioToggleText = document.getElementById('cabin-audio-toggle-text');

    // Return Buttons
    this.returnToBoardingBtn = document.getElementById('cabin-return-boarding-btn');

    this._bindEvents();
  }

  _bindEvents() {
    // 1. Seatbelt Toggle
    if (this.seatbeltBtn) {
      this.seatbeltBtn.addEventListener('click', () => this.toggleSeatbelt());
    }

    // 2. Window View Filter Buttons
    this.windowFilterBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = btn.dataset.viewMode;
        if (mode) this.setWindowViewMode(mode);
      });
    });

    // 3. Telemetry Drawer Toggle
    if (this.telemetryToggleBtn) {
      this.telemetryToggleBtn.addEventListener('click', () => this.toggleTelemetry());
    }

    // 4. Audio Mute Toggle
    if (this.audioToggleBtn) {
      this.audioToggleBtn.addEventListener('click', () => {
        const isMuted = this.audio.toggleMute();
        this._updateAudioButtonUI(isMuted);
      });
    }

    // 5. Launch Button
    if (this.launchBtn) {
      this.launchBtn.addEventListener('click', () => {
        if (!this.isSeatbeltFastened) {
          this._shakeSeatbeltPrompt();
          return;
        }
        this.audio.playChime(660, 1320, 0.4);
        if (this.callbacks.onLaunchAuthorized) {
          this.callbacks.onLaunchAuthorized();
        }
      });
    }

    // 6. Return Button
    if (this.returnToBoardingBtn) {
      this.returnToBoardingBtn.addEventListener('click', () => {
        if (this.callbacks.onReturnToBoarding) {
          this.callbacks.onReturnToBoarding();
        }
      });
    }
  }

  _updateAudioButtonUI(isMuted) {
    if (this.audioToggleText) {
      this.audioToggleText.textContent = isMuted ? 'CABIN AUDIO: MUTED' : 'CABIN AUDIO: ACTIVE';
    }
    if (this.audioToggleBtn) {
      this.audioToggleBtn.classList.toggle('is-active', !isMuted);
      this.audioToggleBtn.setAttribute('aria-pressed', !isMuted);
    }
  }

  toggleSeatbelt() {
    this.isSeatbeltFastened = !this.isSeatbeltFastened;

    if (this.isSeatbeltFastened) {
      this.audio.playLockSound();
      this.seatbeltBtn.classList.add('is-secured');
      this.seatbeltBtn.classList.remove('is-unfastened');
      if (this.seatbeltStatusText) this.seatbeltStatusText.textContent = 'SECURED';
      this.seatbeltBtn.setAttribute('aria-label', 'Seatbelt secured. Click to unfasten.');

      // Update departure status
      if (this.departureStatusBadge) {
        this.departureStatusBadge.classList.add('status--ready');
        this.departureStatusBadge.classList.remove('status--warning');
      }
      if (this.departureStatusText) {
        this.departureStatusText.textContent = 'READY FOR LAUNCH';
      }

      // Enable Launch Button
      if (this.launchBtn) {
        this.launchBtn.removeAttribute('disabled');
        this.launchBtn.classList.add('is-enabled');
      }
      if (this.launchHint) {
        this.launchHint.textContent = 'SEATBELT SECURED // LAUNCH AUTHORIZED';
        this.launchHint.classList.add('hint--authorized');
      }
    } else {
      this.audio.playChime(440, 220, 0.2);
      this.seatbeltBtn.classList.remove('is-secured');
      this.seatbeltBtn.classList.add('is-unfastened');
      if (this.seatbeltStatusText) this.seatbeltStatusText.textContent = 'UNFASTENED';
      this.seatbeltBtn.setAttribute('aria-label', 'Seatbelt unfastened. Click to secure.');

      // Update departure status
      if (this.departureStatusBadge) {
        this.departureStatusBadge.classList.remove('status--ready');
        this.departureStatusBadge.classList.add('status--warning');
      }
      if (this.departureStatusText) {
        this.departureStatusText.textContent = 'PRE-FLIGHT CHECKS';
      }

      // Disable Launch Button
      if (this.launchBtn) {
        this.launchBtn.setAttribute('disabled', 'true');
        this.launchBtn.classList.remove('is-enabled');
      }
      if (this.launchHint) {
        this.launchHint.textContent = 'SECURE SEATBELT TO AUTHORIZE LAUNCH';
        this.launchHint.classList.remove('hint--authorized');
      }
    }
  }

  setWindowViewMode(mode) {
    this.currentViewMode = mode;
    this.audio.playChime(800, 1000, 0.1);

    if (this.viewportEl) {
      this.viewportEl.classList.remove('view--clear', 'view--tint', 'view--hud');
      this.viewportEl.classList.add(`view--${mode}`);
    }

    this.windowFilterBtns.forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.viewMode === mode);
    });
  }

  toggleTelemetry() {
    this.isTelemetryOpen = !this.isTelemetryOpen;
    this.audio.playChime(600, 750, 0.15);

    if (this.telemetryDrawerEl) {
      this.telemetryDrawerEl.classList.toggle('is-open', this.isTelemetryOpen);
    }
    if (this.telemetryToggleBtn) {
      this.telemetryToggleBtn.classList.toggle('is-active', this.isTelemetryOpen);
      const label = this.telemetryToggleBtn.querySelector('.telemetry-btn-label');
      if (label) {
        label.textContent = this.isTelemetryOpen ? 'MISSION TELEMETRY [CLOSE]' : 'MISSION TELEMETRY [OPEN]';
      }
    }
  }

  _shakeSeatbeltPrompt() {
    this.audio.playChime(220, 220, 0.3);
    if (this.seatbeltBtn) {
      this.seatbeltBtn.classList.add('shake-alert');
      setTimeout(() => this.seatbeltBtn.classList.remove('shake-alert'), 600);
    }
  }

  populatePassengerData(passenger) {
    if (!passenger) return;
    const nameUpper = (passenger.name || 'EXPLORER').toUpperCase();
    const missionId = passenger.missionId || 'EXP-2026-X';

    if (this.welcomeBannerEl) {
      this.welcomeBannerEl.textContent = `WELCOME ABOARD, ${nameUpper}`;
    }
    if (this.missionIdBadgeEl) {
      this.missionIdBadgeEl.textContent = missionId;
    }
    if (this.destinationsBadgeEl) {
      this.destinationsBadgeEl.textContent = 'MOON → MARS → INTERSTELLAR';
    }

    // Telemetry passenger readout
    const telemetryPassEl = document.getElementById('cabin-telemetry-passenger');
    if (telemetryPassEl) telemetryPassEl.textContent = nameUpper;
    const telemetryMissionEl = document.getElementById('cabin-telemetry-mission');
    if (telemetryMissionEl) telemetryMissionEl.textContent = missionId;
  }

  startPreDepartureSequence() {
    // Clear previous timers if any
    this.bootTimeoutIds.forEach((id) => clearTimeout(id));
    this.bootTimeoutIds = [];

    // Reset cabin interactive states
    this.isSeatbeltFastened = false;
    this.isTelemetryOpen = false;
    if (this.seatbeltBtn) {
      this.seatbeltBtn.classList.remove('is-secured', 'shake-alert');
      this.seatbeltBtn.classList.add('is-unfastened');
    }
    if (this.seatbeltStatusText) this.seatbeltStatusText.textContent = 'UNFASTENED';
    if (this.departureStatusBadge) {
      this.departureStatusBadge.classList.remove('status--ready');
      this.departureStatusBadge.classList.add('status--warning');
    }
    if (this.departureStatusText) this.departureStatusText.textContent = 'INITIALIZING...';
    if (this.launchBtn) {
      this.launchBtn.setAttribute('disabled', 'true');
      this.launchBtn.classList.remove('is-enabled');
    }
    if (this.launchHint) {
      this.launchHint.textContent = 'SECURE SEATBELT TO AUTHORIZE LAUNCH';
      this.launchHint.classList.remove('hint--authorized');
    }
    if (this.telemetryDrawerEl) this.telemetryDrawerEl.classList.remove('is-open');

    // Stage 1: Cabin Lights Activate (0ms - 500ms)
    this.screenEl.classList.add('cabin--booting');
    this.screenEl.classList.remove('cabin--online');

    const t1 = setTimeout(() => {
      // Stage 2: Observation Viewport Opens (Earth visible)
      if (this.viewportEl) this.viewportEl.classList.add('viewport--illuminated');
    }, 600);

    const t2 = setTimeout(() => {
      // Stage 3: Systems Online
      this.screenEl.classList.remove('cabin--booting');
      this.screenEl.classList.add('cabin--online');
      if (this.departureStatusText) this.departureStatusText.textContent = 'SYSTEMS ONLINE · STANDBY';
    }, 1400);

    const t3 = setTimeout(() => {
      // Stage 4: Prompt for seatbelt
      if (this.departureStatusText) this.departureStatusText.textContent = 'ACTION: SECURE SEATBELT';
      if (!this.audio.isMuted) {
        this.audio.playChime(520, 680, 0.3);
      }
    }, 2200);

    this.bootTimeoutIds.push(t1, t2, t3);
  }
}

