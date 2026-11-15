/**
 * launchScene.js — Phase 4 Launch Sequence Manager for The Legacy Tour
 * Integrates the AI Studio-generated WebGL 3D launch scene (LegacyDepartureScene).
 *
 * Provides:
 * - 3D scene lifecycle (initialization, resize, render loop, cleanup)
 * - Mission Control telemetry HUD (Clock, Altitude, Velocity, Stage Status)
 * - Chapter / shot transitions and active labels
 * - 5 NASA Space Apps educational insight panels with navigation and dismiss
 * - Ambient soundscape toggle via procedural Web Audio API
 * - Interactive transport controls (Play, Pause, Replay, Scrub, 1x/1.5x/2x Speed, Chapter jumps)
 * - Post-ascent Earth-from-space transition with "EARTH IS JUST THE BEGINNING"
 * - Handover pose export for Phase 5 Moon transition
 */

import {
  createLegacyDepartureScene,
  SHOTS,
  TOTAL_DURATION,
} from '../scene/index.js';

// Educational Insight Cards
export const EDUCATIONAL_TOPICS = [
  {
    id: 'vertical-launch',
    number: '01',
    category: 'AERODYNAMICS & ASCENT',
    title: 'WHY DO ROCKETS LAUNCH VERTICALLY?',
    body: "Rockets initially travel straight upward to gain altitude and punch through the thickest, densest layers of Earth's atmosphere as quickly as possible. Once in thinner air, they pitch horizontally to build the massive sideways speed (~28,000 km/h) needed to stay in orbit.",
    startSec: 3,
    endSec: 16,
  },
  {
    id: 'how-liftoff-works',
    number: '02',
    category: 'PROPULSION DYNAMICS',
    title: 'HOW DOES A ROCKET LIFT OFF?',
    body: "Newton's Third Law of Motion: For every action, there is an equal and opposite reaction. High-pressure rocket combustion chambers expel superheated exhaust gases downward at over 2,500 m/s, generating millions of pounds of upward thrust.",
    startSec: 18,
    endSec: 28,
  },
  {
    id: 'fuel-mass-fraction',
    number: '03',
    category: 'ROCKET EQUATION & STAGING',
    title: 'WHY DOES A ROCKET NEED SO MUCH FUEL?',
    body: "Over 90% of a rocket's total liftoff mass is propellant! Because every kilogram of fuel requires more fuel to lift it, massive propellant tanks are needed to overcome Earth's gravitational well and atmospheric resistance until empty stages can be jettisoned.",
    startSec: 29,
    endSec: 40,
  },
  {
    id: 'after-liftoff-trajectory',
    number: '04',
    category: 'ORBITAL TRAJECTORY',
    title: 'WHAT HAPPENS AFTER LIFTOFF?',
    body: "Rockets don't simply fly straight up—they perform a precision 'gravity turn', tilting eastward to harness Earth's rotational momentum. Achieving orbit means falling around the curvature of the Earth at sideways velocity, balancing gravity with centrifugal inertia.",
    startSec: 41,
    endSec: 52,
  },
  {
    id: 'microgravity-concept',
    number: '05',
    category: 'ORBITAL MECHANICS',
    title: 'WHAT IS MICROGRAVITY?',
    body: "In low Earth orbit, gravity is still roughly 90% as strong as on Earth's surface! Astronauts float not because gravity is absent, but because the spacecraft and its crew are in continuous, perpetual free-fall together around Earth, never colliding with the planet.",
    startSec: 53,
    endSec: 68,
  },
];

export class LaunchSceneManager {
  constructor(options = {}) {
    this.options = options; // onContinueToMoon, onReturnToCabin, onReturnToArchive
    this.handle = null;
    this.container = null;
    this.isMounted = false;
    this.audioEnabled = false;
    this.hudCollapsed = false;
    this.currentSpeed = 1;
    this.activeTopicIndex = 0;
    this.dismissedTopics = new Set();
    this.isEduCardManuallyClosed = false;
    this._eventsBound = false;

    // Cache DOM Elements
    this._initElements();
  }

  _initElements() {
    this.screen = document.getElementById('launch-scene-page');
    this.canvasMount = document.getElementById('launch-canvas-mount');

    // Header & Brand
    this.chapterKicker = document.getElementById('launch-chapter-kicker');
    this.chapterSubtitle = document.getElementById('launch-chapter-subtitle');
    this.statusIndicator = document.getElementById('launch-status-indicator');
    this.hudPassenger = document.getElementById('launch-hud-passenger');
    this.hudMissionId = document.getElementById('launch-hud-mission-id');
    this.hudMission = document.getElementById('launch-hud-mission');
    this.hudDestination = document.getElementById('launch-hud-destination');
    this.hudSystems = document.getElementById('launch-hud-systems');
    this.audioToggleBtn = document.getElementById('launch-audio-toggle');
    this.audioText = document.getElementById('launch-audio-text');
    this.abortBtn = document.getElementById('launch-abort-btn');
    this.skipBtn = document.getElementById('launch-skip-btn');

    // Telemetry HUD
    this.telemetryClock = document.getElementById('launch-telemetry-clock');
    this.telemetryAltitude = document.getElementById('launch-telemetry-altitude');
    this.telemetryVelocity = document.getElementById('launch-telemetry-velocity');
    this.telemetryPhase = document.getElementById('launch-telemetry-phase');

    // Educational Card
    this.eduCard = document.getElementById('launch-edu-card');
    this.eduBadge = document.getElementById('launch-edu-topic');
    this.eduTitle = document.getElementById('launch-edu-title');
    this.eduBody = document.getElementById('launch-edu-body');
    this.eduCloseBtn = document.getElementById('launch-edu-close');
    this.eduNextBtn = document.getElementById('launch-edu-next');
    this.eduDotsContainer = document.getElementById('launch-edu-dots');
    this.eduPill = document.getElementById('launch-edu-pill');
    this.eduPillCount = document.getElementById('edu-pill-count');

    // Transport & Controls Dock
    this.bottomDock = document.getElementById('launch-bottom-dock');
    this.dockToggleBtn = document.getElementById('launch-dock-toggle');
    this.scrubber = document.getElementById('launch-scrubber');
    this.playBtn = document.getElementById('launch-play-btn');
    this.playIcon = document.getElementById('launch-play-icon');
    this.replayBtn = document.getElementById('launch-replay-btn');
    this.speedBtns = document.querySelectorAll('.launch-speed-btn');
    this.shotJumperGroup = document.getElementById('launch-shot-jumper-group');

    // Completion Screen
    this.completionOverlay = document.getElementById('launch-completion-overlay');
    this.continueMoonBtn = document.getElementById('launch-continue-moon-btn');
    this.completionReplayBtn = document.getElementById('completion-replay-btn');
    this.completionCabinBtn = document.getElementById('completion-cabin-btn');

    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
    this._renderEduDots();
    this._renderShotJumpers();
  }

  _bindEvents() {
    // Audio Toggle
    if (this.audioToggleBtn) {
      this.audioToggleBtn.addEventListener('click', () => this.toggleAudio());
    }

    // Skip to Orbit / Space view
    if (this.skipBtn) {
      this.skipBtn.addEventListener('click', () => {
        if (!this.handle) return;
        const currentT = this.scrubber ? parseFloat(this.scrubber.value || '0') : 0;
        if (currentT < 45) {
          // Jump to Shot 6: Earth from Space (orbital insertion)
          this.handle.seekToShot(5);
        } else {
          // Jump to Lunar approach handover & completion
          this.handle.seekToShot(8);
          this._showCompletionOverlay();
        }
      });
    }

    // Abort / Return to Cabin
    if (this.abortBtn) {
      this.abortBtn.addEventListener('click', () => {
        if (this.options.onReturnToCabin) this.options.onReturnToCabin();
      });
    }

    // Play / Pause
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }

    // Replay
    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => this.replay());
    }
    if (this.completionReplayBtn) {
      this.completionReplayBtn.addEventListener('click', () => this.replay());
    }

    // Completion navigation
    if (this.continueMoonBtn) {
      this.continueMoonBtn.addEventListener('click', () => {
        if (this.options.onContinueToMoon) this.options.onContinueToMoon();
      });
    }
    if (this.completionCabinBtn) {
      this.completionCabinBtn.addEventListener('click', () => {
        if (this.options.onReturnToCabin) this.options.onReturnToCabin();
      });
    }

    // Speed Controls
    this.speedBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed || '1');
        this.setSpeed(speed);
      });
    });

    // Scrubber
    if (this.scrubber) {
      this.scrubber.addEventListener('input', (e) => {
        const time = parseFloat(e.target.value);
        if (this.handle) this.handle.seek(time);
      });
    }

    // Dock Collapse Toggle
    if (this.dockToggleBtn) {
      this.dockToggleBtn.addEventListener('click', () => this.toggleDock());
    }

    // Educational Card Interactions
    if (this.eduCloseBtn) {
      this.eduCloseBtn.addEventListener('click', () => this.dismissCurrentEduCard());
    }
    if (this.eduNextBtn) {
      this.eduNextBtn.addEventListener('click', () => this.advanceEduCard());
    }
    if (this.eduPill) {
      this.eduPill.addEventListener('click', () => this.openEduCard());
    }

    // Keyboard controls
    this._onKeyDown = (e) => {
      if (!this.isMounted) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.replay();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.toggleAudio();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.toggleDock();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _renderEduDots() {
    if (!this.eduDotsContainer) return;
    this.eduDotsContainer.innerHTML = '';
    EDUCATIONAL_TOPICS.forEach((topic, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `edu-dot ${i === this.activeTopicIndex ? 'is-active' : ''}`;
      dot.setAttribute('aria-label', `Topic ${i + 1}: ${topic.title}`);
      dot.addEventListener('click', () => {
        this.showEduTopic(i);
      });
      this.eduDotsContainer.appendChild(dot);
    });
  }

  _renderShotJumpers() {
    if (!this.shotJumperGroup) return;
    this.shotJumperGroup.innerHTML = '';
    SHOTS.forEach((shot, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `launch-shot-chip ${i === 0 ? 'is-active' : ''}`;
      btn.dataset.shotIndex = String(i);
      btn.title = `${shot.title}: ${shot.subtitle}`;
      btn.innerHTML = `<span class="shot-chip-idx">${String(i + 1).padStart(2, '0')}</span>`;
      btn.addEventListener('click', () => {
        if (this.handle) this.handle.seekToShot(i);
      });
      this.shotJumperGroup.appendChild(btn);
    });
  }

  mountAndStart(passenger) {
    if (this.isMounted) return;

    if (!this.screen || !this.canvasMount) {
      this._initElements();
    }

    this.isMounted = true;
    this.isEduCardManuallyClosed = false;

    // Reset overlay visibility
    if (this.completionOverlay) {
      this.completionOverlay.hidden = true;
      this.completionOverlay.classList.remove('is-visible');
    }

    // Set passenger name & mission ID in HUD
    if (this.hudPassenger) {
      const name = passenger && passenger.name ? passenger.name.toUpperCase() : 'EXPLORER';
      this.hudPassenger.textContent = name;
    }
    if (this.hudMissionId) {
      this.hudMissionId.textContent = passenger && passenger.missionId ? passenger.missionId : 'EXP-0000-XX';
    }

    // Set initial audio mute state
    this._updateAudioUI(false);

    // Initialize 3D WebGL scene
    if (this.canvasMount) {
      try {
        this.handle = createLegacyDepartureScene(this.canvasMount, {
          onTimelineUpdate: (state) => this._onTimelineUpdate(state),
          onHandoverReady: (pose) => {
            window.__LEGACY_TOUR_MOON_HANDOVER__ = pose;
          },
          onComplete: (pose) => {
            window.__LEGACY_TOUR_MOON_HANDOVER__ = pose;
            this._showCompletionOverlay();
          },
        });
      } catch (err) {
        console.error('Failed to initialize 3D launch scene:', err);
      }
    }

    // Reset scrubber & speed
    if (this.scrubber) this.scrubber.value = '0';
    this.setSpeed(1);
    this.showEduTopic(0);
  }

  _onTimelineUpdate(state) {
    // 1. Scrubber & Telemetry
    if (this.scrubber) {
      this.scrubber.value = String(state.currentTime);
    }
    if (this.telemetryClock) {
      this.telemetryClock.textContent = state.missionClockLabel;
    }
    if (this.telemetryAltitude) {
      this.telemetryAltitude.textContent = `${state.altitudeKm.toFixed(1)} km`;
    }
    if (this.telemetryVelocity) {
      this.telemetryVelocity.textContent = `${state.velocityKms.toFixed(2)} km/s`;
    }

    // 2. Mission Phase Badge & Status Indicator
    let phaseText = 'PAD SECURE';
    let statusText = 'SYSTEMS NOMINAL';
    const t = state.currentTime;

    if (t < 9) {
      phaseText = 'PAD PREPARATION';
      statusText = 'SYSTEMS NOMINAL // COUNTDOWN IN PROGRESS';
    } else if (t < 17) {
      phaseText = 'STACK INSPECTION';
      statusText = 'CRYOGENIC LOX LOADED // PRESSURES STABLE';
    } else if (t < 24) {
      phaseText = 'IGNITION SEQUENCE';
      statusText = 'F-1 GAS GENERATOR IGNITION // THRUST RAMPING';
    } else if (t < 34) {
      phaseText = 'LIFTOFF // CLIMB';
      statusText = 'TOWER CLEARANCE CONFIRMED // VEHICLE CLEAR';
    } else if (t < 45) {
      phaseText = 'MAX-Q & STAGING';
      statusText = 'FIRST STAGE SEPARATION // J-2 IGNITION';
    } else if (t < 55) {
      phaseText = 'ORBITAL INSERTION';
      statusText = 'LOW EARTH ORBIT // SYSTEMS NOMINAL';
    } else if (t < 63) {
      phaseText = 'TRANS-LUNAR INJECTION';
      statusText = 'SPS PROPULSION FIRING // LEAVING EARTH';
    } else if (t < 71) {
      phaseText = 'LUNAR TRANSIT';
      statusText = 'MOON ACQUISITION // FREE-RETURN VECTOR';
    } else {
      phaseText = 'LUNAR HANDOVER';
      statusText = 'LUNAR ORBIT INSERTION POSTURE';
    }

    if (this.telemetryPhase) this.telemetryPhase.textContent = phaseText;
    if (this.statusIndicator) this.statusIndicator.textContent = statusText;

    // 3. Chapter Title & Subtitle
    if (this.chapterKicker) {
      this.chapterKicker.textContent = state.activeShot.title;
    }
    if (this.chapterSubtitle) {
      this.chapterSubtitle.textContent = state.activeShot.subtitle;
    }

    // 4. Update Shot Jumpers active state
    if (this.shotJumperGroup) {
      const activeIdx = state.activeShot.index;
      Array.from(this.shotJumperGroup.children).forEach((el, idx) => {
        el.classList.toggle('is-active', idx === activeIdx);
      });
    }

    // 5. Update Play/Pause Icon
    if (this.playIcon) {
      this.playIcon.textContent = state.isPlaying ? '❚❚' : '▶';
    }

    // 6. Educational Cards Dynamic Triggers
    this._syncEducationalTopic(state.currentTime);

    // 7. Show Completion Overlay during final deep-space handover (t >= 71s)
    if (state.currentTime >= 71 && (!this.completionOverlay || this.completionOverlay.hidden)) {
      this._showCompletionOverlay();
    } else if (state.currentTime < 71 && this.completionOverlay && !this.completionOverlay.hidden) {
      this.completionOverlay.classList.remove('is-visible');
      this.completionOverlay.hidden = true;
    }
  }

  _syncEducationalTopic(currentTime) {
    if (this.isEduCardManuallyClosed) return;

    for (let i = 0; i < EDUCATIONAL_TOPICS.length; i++) {
      const topic = EDUCATIONAL_TOPICS[i];
      if (currentTime >= topic.startSec && currentTime <= topic.endSec) {
        if (this.activeTopicIndex !== i) {
          this.showEduTopic(i);
        }
        return;
      }
    }
  }

  showEduTopic(index) {
    this.activeTopicIndex = Math.max(0, Math.min(EDUCATIONAL_TOPICS.length - 1, index));
    const topic = EDUCATIONAL_TOPICS[this.activeTopicIndex];

    if (this.eduBadge) this.eduBadge.textContent = topic.category;
    if (this.eduTitle) this.eduTitle.textContent = topic.title;
    if (this.eduBody) this.eduBody.textContent = topic.body;
    if (this.eduPillCount) this.eduPillCount.textContent = `${this.activeTopicIndex + 1}/5`;

    // Update dot indicators
    if (this.eduDotsContainer) {
      Array.from(this.eduDotsContainer.children).forEach((dot, idx) => {
        dot.classList.toggle('is-active', idx === this.activeTopicIndex);
      });
    }

    // Show card, hide pill
    if (this.eduCard) {
      this.eduCard.hidden = false;
      this.eduCard.classList.add('is-visible');
    }
    if (this.eduPill) {
      this.eduPill.hidden = true;
    }
    this.isEduCardManuallyClosed = false;
  }

  advanceEduCard() {
    const nextIdx = (this.activeTopicIndex + 1) % EDUCATIONAL_TOPICS.length;
    this.showEduTopic(nextIdx);
  }

  dismissCurrentEduCard() {
    this.isEduCardManuallyClosed = true;
    if (this.eduCard) {
      this.eduCard.classList.remove('is-visible');
      setTimeout(() => {
        if (this.isEduCardManuallyClosed && this.eduCard) this.eduCard.hidden = true;
      }, 300);
    }
    if (this.eduPill) {
      this.eduPill.hidden = false;
    }
  }

  openEduCard() {
    this.isEduCardManuallyClosed = false;
    this.showEduTopic(this.activeTopicIndex);
  }

  _showCompletionOverlay() {
    if (!this.completionOverlay) return;
    this.completionOverlay.hidden = false;
    setTimeout(() => {
      this.completionOverlay.classList.add('is-visible');
    }, 50);
  }

  togglePlay() {
    if (!this.handle) return;
    const isPlaying = this.playIcon && this.playIcon.textContent === '❚❚';
    if (isPlaying) {
      this.handle.pause();
      if (this.playIcon) this.playIcon.textContent = '▶';
    } else {
      this.handle.play();
      if (this.playIcon) this.playIcon.textContent = '❚❚';
    }
  }

  replay() {
    if (this.completionOverlay) {
      this.completionOverlay.classList.remove('is-visible');
      setTimeout(() => {
        if (this.completionOverlay) this.completionOverlay.hidden = true;
      }, 400);
    }
    this.isEduCardManuallyClosed = false;
    this.showEduTopic(0);
    if (this.handle) this.handle.replay();
  }

  setSpeed(speed) {
    this.currentSpeed = speed;
    if (this.handle) this.handle.setPlaybackSpeed(speed);
    this.speedBtns.forEach((btn) => {
      btn.classList.toggle('is-active', parseFloat(btn.dataset.speed || '1') === speed);
    });
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    if (this.handle) this.handle.setAudioEnabled(this.audioEnabled);
    this._updateAudioUI(this.audioEnabled);
  }

  _updateAudioUI(enabled) {
    if (!this.audioToggleBtn) return;
    this.audioToggleBtn.classList.toggle('is-active', enabled);
    if (this.audioText) {
      this.audioText.textContent = enabled ? 'SOUND ON' : 'MUTED';
    }
    this.audioToggleBtn.setAttribute(
      'aria-label',
      enabled ? 'Launch soundscape active. Click to mute.' : 'Launch soundscape muted. Click to enable sound.'
    );
  }

  toggleDock() {
    this.hudCollapsed = !this.hudCollapsed;
    if (this.bottomDock) {
      this.bottomDock.classList.toggle('is-collapsed', this.hudCollapsed);
    }
    if (this.dockToggleBtn) {
      const toggleText = this.dockToggleBtn.querySelector('.toggle-text');
      const toggleIcon = this.dockToggleBtn.querySelector('.toggle-icon');
      if (toggleText) toggleText.textContent = this.hudCollapsed ? 'SHOW CONTROLS' : 'HIDE CONTROLS';
      if (toggleIcon) toggleIcon.textContent = this.hudCollapsed ? '▲' : '▼';
    }
  }

  pauseAndCleanup() {
    if (this.handle) {
      this.handle.pause();
      this.handle.setAudioEnabled(false);
      this.handle.dispose();
      this.handle = null;
    }
    this.isMounted = false;
  }
}

