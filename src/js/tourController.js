/**
 * tourController.js — Master 5-scene continuous journey controller for The Legacy Tour.
 *
 * Journey sequence:
 *   0: IGNITION     (createLegacyDepartureScene  — src/scene/index.ts   — 78 s)
 *   1: APOLLO       (ApolloDirector               — src/scenes/apollo/   — 48 s)
 *   2: MARS ROVER   (MarsEngine                   — src/scenes/mars/     — 54 s)
 *   3: VOYAGER 1    (VoyagerDirector              — src/scenes/voyager/  — 56 s)
 *   4: WAY HOME     (TheWayHomeDirector            — src/scenes/way-home/ — 162 s)
 *
 * Each scene fires an onComplete / onPlaybackEnd callback which automatically
 * advances to the next scene.  A cross-fade curtain covers every transition.
 * After Way Home the Grand Tribute overlay is shown.
 */

import { createLegacyDepartureScene, SHOTS as IGNITION_SHOTS, TOTAL_DURATION as IGNITION_DURATION } from '../scene/index.js';
import { ApolloDirector }        from '../scenes/apollo/ApolloDirector';
import { MarsEngine }            from '../scenes/mars/MarsEngine';
import { VoyagerDirector }       from '../scenes/voyager/VoyagerDirector';
import { TheWayHomeDirector }    from '../scenes/way-home/TheWayHomeDirector';
import { CinematicScoreEngine }   from '../scenes/way-home/audio/cinematicAudio';
import { SHOTS as APOLLO_SHOTS, TOTAL_FILM_DURATION_SEC as APOLLO_DURATION } from '../scenes/apollo/constants';
import { SHOTS as MARS_SHOTS, TOTAL_DURATION_SECONDS as MARS_DURATION }      from '../scenes/mars/constants';
import { ENCOUNTER_SHOTS, TOTAL_DURATION_SECONDS as VOYAGER_DURATION }        from '../scenes/voyager/encounterDirector';
import { SHOTS as WAY_HOME_SHOTS, TOTAL_DURATION as WAY_HOME_DURATION }       from '../scenes/way-home/types';

// ─── Destination metadata ───────────────────────────────────────────────────

const DESTINATIONS = [
  {
    index: 0,
    code: '01',
    label: 'IGNITION',
    title: 'EARTH LAUNCH COMPLEX 39',
    subtitle: 'Coastal Launch Facility · Kennedy Space Centre',
    destination: 'DESTINATION: EARTH ORBIT → THE MOON',
    status: 'ENGINES IGNITED // LIFTOFF CONFIRMED',
  },
  {
    index: 1,
    code: '02',
    label: 'THE MOON',
    title: 'TRANQUILITY BASE · APOLLO 11',
    subtitle: 'Mare Tranquillitatis · 0°40′N 23°28′E',
    destination: 'DESTINATION: THE MOON',
    status: 'LUNAR ORBIT INSERTION // DESCENT INITIATED',
  },
  {
    index: 2,
    code: '03',
    label: 'MARS',
    title: 'MERIDIANI PLANUM · OPPORTUNITY',
    subtitle: 'MER-B Rover · 2004 – 2018',
    destination: 'DESTINATION: MARS',
    status: 'ORBITAL INSERTION CONFIRMED // SURFACE APPROACH',
  },
  {
    index: 3,
    code: '04',
    label: 'INTERSTELLAR',
    title: 'VOYAGER 1 · 163 AU',
    subtitle: 'Beyond the Heliopause · Interstellar Space',
    destination: 'DESTINATION: INTERSTELLAR SPACE',
    status: 'MATCHING INTERSTELLAR VELOCITY // ENCOUNTER NOMINAL',
  },
  {
    index: 4,
    code: '05',
    label: 'THE WAY HOME',
    title: 'RETURN TO EARTH',
    subtitle: 'Pale Blue Dot · Home',
    destination: 'DESTINATION: EARTH',
    status: 'RETURN VECTOR CONFIRMED // APPROACHING HOME',
  },
];

// ─── Tour Controller ─────────────────────────────────────────────────────────

export class TourController {
  constructor(options = {}) {
    // Callbacks from Navigation
    this.options = options; // { onReturnToCabin, onReturnToArchive }

    // Runtime state
    this.currentDestination = -1;
    this.activeEngine = null;      // current scene engine instance
    this.isMounted = false;
    this.audioEnabled = false;
    this.isTransitioning = false;
    this.passenger = null;

    // DOM references
    this.canvasMount   = null;
    this.curtain       = null;
    this.curtainStatus = null;
    this.tributeOverlay = null;

    // HUD elements
    this.hudKicker     = null;
    this.hudSubtitle   = null;
    this.hudDestEl     = null;
    this.hudStatusEl   = null;
    this.hudPassenger  = null;
    this.hudMissionId  = null;
    this.hudAudioBtn   = null;
    this.hudAudioText  = null;
    this.hudAbortBtn   = null;
    this.hudSkipBtn    = null;

    // Bottom dock
    this.destPills    = null;
    this.telClock     = null;
    this.telAltitude  = null;
    this.telVelocity  = null;
    this.telPhase     = null;
    this.playBtn      = null;
    this.playIcon     = null;
    this.replayBtn    = null;
    this.speedBtns    = null;

    // Ignition-specific
    this.scrubber        = null;
    this.shotJumperGroup = null;
    this.ignitionHandle  = null;

    this._eventsBound = false;
  }

  // ─── DOM Initialisation ───────────────────────────────────────────────────

  _initElements() {
    this.canvasMount    = document.getElementById('launch-canvas-mount');
    this.curtain        = document.getElementById('tour-transition-curtain');
    this.curtainStatus  = document.getElementById('tour-curtain-status');
    this.tributeOverlay = document.getElementById('grand-tribute-overlay');

    // Top HUD header
    this.hudKicker     = document.getElementById('launch-chapter-kicker');
    this.hudSubtitle   = document.getElementById('launch-chapter-subtitle');
    this.hudDestEl     = document.getElementById('launch-hud-destination');
    this.hudStatusEl   = document.getElementById('launch-status-indicator');
    this.hudPassenger  = document.getElementById('launch-hud-passenger');
    this.hudMissionId  = document.getElementById('launch-hud-mission-id');
    this.hudAudioBtn   = document.getElementById('launch-audio-toggle');
    this.hudAudioText  = document.getElementById('launch-audio-text');
    this.hudAbortBtn   = document.getElementById('launch-abort-btn');
    this.hudSkipBtn    = document.getElementById('launch-skip-btn');

    // Destination pills
    this.destPills = document.querySelectorAll('.tour-dest-pill');

    // Telemetry
    this.telClock    = document.getElementById('launch-telemetry-clock');
    this.telAltitude = document.getElementById('launch-telemetry-altitude');
    this.telVelocity = document.getElementById('launch-telemetry-velocity');
    this.telPhase    = document.getElementById('launch-telemetry-phase');

    // Transport
    this.playBtn   = document.getElementById('launch-play-btn');
    this.playIcon  = document.getElementById('launch-play-icon');
    this.replayBtn = document.getElementById('launch-replay-btn');
    this.speedBtns = document.querySelectorAll('.launch-speed-btn');

    // Ignition-only controls
    this.scrubber        = document.getElementById('launch-scrubber');
    this.shotJumperGroup = document.getElementById('launch-shot-jumper-group');

    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
  }

  _bindEvents() {
    // Audio toggle
    if (this.hudAudioBtn) {
      this.hudAudioBtn.addEventListener('click', () => this._toggleAudio());
    }

    // Abort → return to cabin
    if (this.hudAbortBtn) {
      this.hudAbortBtn.addEventListener('click', () => {
        if (this.options.onReturnToCabin) this.options.onReturnToCabin();
      });
    }

    // Skip → advance to next scene immediately
    if (this.hudSkipBtn) {
      this.hudSkipBtn.addEventListener('click', () => this._skipToNext());
    }

    // Play / Pause
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this._togglePlay());
    }

    // Restart current scene
    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => this._restartCurrent());
    }

    // Playback speed
    if (this.speedBtns) {
      this.speedBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const speed = parseFloat(btn.dataset.speed || '1');
          this._setSpeed(speed);
        });
      });
    }

    // Destination pills — jump to specific scene
    if (this.destPills) {
      this.destPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          const idx = parseInt(pill.dataset.dest || '0', 10);
          if (!isNaN(idx)) this._jumpToDestination(idx);
        });
      });
    }

    // Scrubber (ignition only)
    if (this.scrubber) {
      this.scrubber.addEventListener('input', (e) => {
        if (this.currentDestination === 0 && this.ignitionHandle) {
          this.ignitionHandle.seek(parseFloat(e.target.value));
        }
      });
    }

    // Tribute overlay buttons
    const phase5Btn   = document.getElementById('tribute-phase5-btn');
    const replayBtn   = document.getElementById('tribute-replay-btn');
    const cabinBtn    = document.getElementById('tribute-cabin-btn');
    const archiveBtn  = document.getElementById('tribute-archive-btn');

    if (phase5Btn) {
      phase5Btn.addEventListener('click', () => {
        this._hideTribute();
        if (this.options.onContinueToPhase5) {
          this.options.onContinueToPhase5();
        } else if (this.options.onReturnToCabin) {
          this.options.onReturnToCabin();
        }
      });
    }

    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        this._hideTribute();
        this._startDestination(0);
      });
    }
    if (cabinBtn) {
      cabinBtn.addEventListener('click', () => {
        this._hideTribute();
        if (this.options.onReturnToCabin) this.options.onReturnToCabin();
      });
    }
    if (archiveBtn) {
      archiveBtn.addEventListener('click', () => {
        this._hideTribute();
        if (this.options.onReturnToArchive) this.options.onReturnToArchive();
      });
    }

    // Keyboard shortcuts
    this._onKeyDown = (e) => {
      if (!this.isMounted) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); this._togglePlay(); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); this._toggleAudio(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); this._skipToNext(); }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  // ─── Public API called by Navigation ─────────────────────────────────────

  mountAndStart(passenger) {
    if (this.isMounted) return;
    this.isMounted = true;
    this.passenger = passenger;

    this._initElements();
    this._updatePassengerHUD(passenger);
    this._updateAudioUI(false);
    this._startDestination(0);
  }

  pauseAndCleanup() {
    this._disposeActive();
    this.isMounted = false;
  }

  // ─── Transition / Scene Control ───────────────────────────────────────────

  async _startDestination(index) {
    if (index >= DESTINATIONS.length) {
      // All 5 scenes completed — seamlessly continue to Phase 5
      if (this.options.onContinueToPhase5) {
        this.options.onContinueToPhase5();
      } else {
        this._showTribute();
      }
      return;
    }

    this.isTransitioning = true;

    // Show curtain (if not first scene)
    if (this.currentDestination >= 0) {
      await this._showCurtain(DESTINATIONS[index]);
    }

    // Dispose previous engine
    this._disposeActive();

    this.currentDestination = index;
    const dest = DESTINATIONS[index];

    // Update HUD metadata
    this._updateDestinationHUD(dest);
    this._updateDestPills(index);
    this._updateIgnitionControls(index);

    // Mount new engine
    this._mountEngine(index);

    // Hide curtain after a short pause (let engine start render)
    if (this.currentDestination > 0) {
      await this._delay(600);
      await this._hideCurtain();
    }

    this.isTransitioning = false;
  }

  _mountEngine(index) {
    const mount = this.canvasMount;
    if (!mount) return;

    switch (index) {
      // ── 0: IGNITION ──────────────────────────────────────────────────────
      case 0: {
        try {
          this.ignitionHandle = createLegacyDepartureScene(mount, {
            onTimelineUpdate: (state) => this._onIgnitionUpdate(state),
            onHandoverReady: (pose) => { window.__LEGACY_TOUR_MOON_HANDOVER__ = pose; },
            onComplete: (pose) => {
              window.__LEGACY_TOUR_MOON_HANDOVER__ = pose;
              this._advanceToNext();
            },
          });
          this.activeEngine = {
            type: 'ignition',
            play: ()        => this.ignitionHandle?.play(),
            pause: ()       => this.ignitionHandle?.pause(),
            replay: ()      => { this.ignitionHandle?.replay(); },
            setSpeed: (s)   => this.ignitionHandle?.setPlaybackSpeed(s),
            setAudio: (on)  => this.ignitionHandle?.setAudioEnabled(on),
            dispose: ()     => { this.ignitionHandle?.dispose(); this.ignitionHandle = null; },
          };
        } catch (err) {
          console.error('[TourController] Ignition scene init failed:', err);
        }
        break;
      }

      // ── 1: APOLLO ─────────────────────────────────────────────────────────
      case 1: {
        try {
          const director = new ApolloDirector(mount, {
            onComplete: () => this._advanceToNext(),
            onProgressChange: (p) => this._onApolloProgress(p),
            onReady: () => {},
            onError: (msg) => console.warn('[TourController] Apollo error:', msg),
          });
          this.activeEngine = {
            type: 'apollo',
            _dir: director,
            play: ()       => director.resumeAutoCamera(),
            pause: ()      => director.pause(),
            replay: ()     => director.seekTo(0, true),
            setSpeed: (s)  => director.setPlaybackSpeed(s),
            setAudio: ()   => {},     // Apollo uses procedural audio w/ no toggle
            dispose: ()    => director.dispose(),
          };
        } catch (err) {
          console.error('[TourController] Apollo scene init failed:', err);
        }
        break;
      }

      // ── 2: MARS ───────────────────────────────────────────────────────────
      case 2: {
        try {
          const engine = new MarsEngine(mount, {
            onLoadProgress: (pct) => this._onLoadProgress(pct),
            onReady: () => {},
            onProgressChange: (p) => this._onMarsProgress(p),
            onPlayStateChange: (playing) => { if (this.playIcon) this.playIcon.textContent = playing ? '❚❚' : '▶'; },
            onUserOrbitChange: () => {},
            onContextLost: () => {},
            onComplete: () => this._advanceToNext(),
          });
          this.activeEngine = {
            type: 'mars',
            _eng: engine,
            play: ()      => engine.setPlaying(true),
            pause: ()     => engine.setPlaying(false),
            replay: ()    => { engine.scrubTo(0); engine.setPlaying(true); },
            setSpeed: ()  => {},      // MarsEngine drives its own rate
            setAudio: (on) => { if (on) engine.soundscape.toggle(); else if (engine.soundscape.isEnabled()) engine.soundscape.toggle(); },
            dispose: ()   => engine.dispose(),
          };
        } catch (err) {
          console.error('[TourController] Mars scene init failed:', err);
        }
        break;
      }

      // ── 3: VOYAGER 1 ─────────────────────────────────────────────────────
      case 3: {
        try {
          const director = new VoyagerDirector(mount, {
            onPlaybackEnd: () => this._advanceToNext(),
            onTelemetryUpdate: (snap) => this._onVoyagerTelemetry(snap),
            onSceneReady: () => {},
            onWebGLError: (msg) => console.warn('[TourController] Voyager error:', msg),
          });
          this.activeEngine = {
            type: 'voyager',
            _dir: director,
            play: ()      => director.play(),
            pause: ()     => director.pause(),
            replay: ()    => { director.seek(0); director.play(); },
            setSpeed: (s) => director.setPlaybackSpeed(s),
            setAudio: (on) => { const a = director.audio; if (on !== a.isEnabled()) a.toggle(); },
            dispose: ()   => director.dispose(),
          };
        } catch (err) {
          console.error('[TourController] Voyager scene init failed:', err);
        }
        break;
      }

      // ── 4: WAY HOME ───────────────────────────────────────────────────────
      case 4: {
        try {
          const score = new CinematicScoreEngine();
          score.initAndStart();
          score.setMuted(!this.audioEnabled);

          const director = new TheWayHomeDirector(mount, {
            onTimeUpdate: (t) => {
              this._onWayHomeTime(t);
              score.update(t, true);
            },
            onComplete: () => this._advanceToNext(),
            onWebGLContextLost: () => {},
          });
          this.activeEngine = {
            type: 'way-home',
            _dir: director,
            _score: score,
            play: () => {
              director.setPlaying(true);
              score.update(director.getTime(), true);
            },
            pause: () => {
              director.setPlaying(false);
              score.update(director.getTime(), false);
            },
            replay: () => {
              director.seek(0);
              director.setPlaying(true);
              score.update(0, true);
            },
            setSpeed: (s)  => director.setSpeed(s),
            setAudio: (on) => {
              if (on) score.initAndStart();
              score.setMuted(!on);
            },
            dispose: () => {
              score.dispose();
              director.dispose();
            },
          };
        } catch (err) {
          console.error('[TourController] Way Home scene init failed:', err);
        }
        break;
      }
    }

    // Apply current audio state
    if (this.activeEngine) {
      this.activeEngine.setAudio(this.audioEnabled);
    }
  }

  _disposeActive() {
    if (this.activeEngine) {
      try { this.activeEngine.dispose(); } catch (_) {}
      this.activeEngine = null;
    }
    this.ignitionHandle = null;
  }

  _advanceToNext() {
    if (this.isTransitioning) return;
    this._startDestination(this.currentDestination + 1);
  }

  _skipToNext() {
    if (this.isTransitioning) return;
    this._startDestination(this.currentDestination + 1);
  }

  _jumpToDestination(index) {
    if (this.isTransitioning) return;
    if (index === this.currentDestination) return;
    this._startDestination(index);
  }

  _restartCurrent() {
    if (this.activeEngine) this.activeEngine.replay();
  }

  _togglePlay() {
    if (!this.activeEngine) return;
    // Determine current playing state from icon
    const isPlaying = this.playIcon && this.playIcon.textContent === '❚❚';
    if (isPlaying) {
      this.activeEngine.pause();
      if (this.playIcon) this.playIcon.textContent = '▶';
    } else {
      this.activeEngine.play();
      if (this.playIcon) this.playIcon.textContent = '❚❚';
    }
  }

  _setSpeed(speed) {
    if (this.activeEngine) this.activeEngine.setSpeed(speed);
    if (this.speedBtns) {
      this.speedBtns.forEach((btn) => {
        btn.classList.toggle('is-active', parseFloat(btn.dataset.speed || '1') === speed);
      });
    }
  }

  _toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    if (this.activeEngine) this.activeEngine.setAudio(this.audioEnabled);
    this._updateAudioUI(this.audioEnabled);
  }

  // ─── HUD Update Helpers ───────────────────────────────────────────────────

  _updatePassengerHUD(passenger) {
    const name = (passenger && passenger.name ? passenger.name : 'EXPLORER').toUpperCase();
    const id   = (passenger && passenger.missionId) ? passenger.missionId : 'EXP-0000-XX';
    if (this.hudPassenger) this.hudPassenger.textContent = name;
    if (this.hudMissionId) this.hudMissionId.textContent = id;
  }

  _updateDestinationHUD(dest) {
    if (this.hudKicker)   this.hudKicker.textContent   = dest.title;
    if (this.hudSubtitle) this.hudSubtitle.textContent = dest.subtitle;
    if (this.hudDestEl)   this.hudDestEl.textContent   = dest.destination;
    if (this.hudStatusEl) this.hudStatusEl.textContent = dest.status;
    if (this.telClock)    this.telClock.textContent     = 'T+00:00';
    if (this.telAltitude) this.telAltitude.textContent  = '0.0 km';
    if (this.telVelocity) this.telVelocity.textContent  = '0.00 km/s';
    if (this.telPhase)    this.telPhase.textContent     = dest.label;
    if (this.playIcon)    this.playIcon.textContent     = '❚❚';
  }

  _updateDestPills(activeIndex) {
    if (!this.destPills) return;
    this.destPills.forEach((pill) => {
      const idx = parseInt(pill.dataset.dest || '0', 10);
      pill.classList.toggle('is-active', idx === activeIndex);
    });
  }

  _updateIgnitionControls(index) {
    // Show scrubber & shot jumpers only for scene 0
    const ignitionControls = document.getElementById('ignition-only-controls');
    if (ignitionControls) {
      ignitionControls.hidden = (index !== 0);
    }
    // Update skip button label
    if (this.hudSkipBtn) {
      const span = this.hudSkipBtn.querySelector('span');
      if (span) {
        span.textContent = index < 4 ? 'NEXT DESTINATION' : 'SKIP TO END';
      }
    }
  }

  _updateAudioUI(enabled) {
    if (this.hudAudioBtn) {
      this.hudAudioBtn.classList.toggle('is-active', enabled);
      this.hudAudioBtn.setAttribute('aria-pressed', String(enabled));
      this.hudAudioBtn.setAttribute('aria-label', enabled
        ? 'Scene audio active. Click to mute.'
        : 'Scene audio muted. Click to enable.'
      );
    }
    if (this.hudAudioText) {
      this.hudAudioText.textContent = enabled ? 'SOUND ON' : 'MUTED';
    }
  }

  // ─── Per-Scene Telemetry Callbacks ────────────────────────────────────────

  _onIgnitionUpdate(state) {
    if (this.scrubber) this.scrubber.value = String(state.currentTime);
    if (this.telClock) this.telClock.textContent = state.missionClockLabel;
    if (this.telAltitude) this.telAltitude.textContent = `${state.altitudeKm.toFixed(1)} km`;
    if (this.telVelocity) this.telVelocity.textContent = `${state.velocityKms.toFixed(2)} km/s`;
    if (this.hudKicker)   this.hudKicker.textContent   = state.activeShot.title;
    if (this.hudSubtitle) this.hudSubtitle.textContent = state.activeShot.subtitle;
    if (this.playIcon)    this.playIcon.textContent    = state.isPlaying ? '❚❚' : '▶';

    // Shot jumper active state
    if (this.shotJumperGroup) {
      const idx = state.activeShot.index;
      Array.from(this.shotJumperGroup.children).forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
      });
    }

    // Phase label
    const t = state.currentTime;
    let phase = 'PAD PREPARATION';
    if (t >= 17) phase = 'IGNITION SEQUENCE';
    if (t >= 24) phase = 'LIFTOFF // CLIMB';
    if (t >= 34) phase = 'MAX-Q & STAGING';
    if (t >= 45) phase = 'ORBITAL INSERTION';
    if (t >= 55) phase = 'TRANS-LUNAR INJECTION';
    if (t >= 63) phase = 'LUNAR TRANSIT';
    if (t >= 71) phase = 'LUNAR APPROACH';
    if (this.telPhase) this.telPhase.textContent = phase;

    // Status indicator
    let status = 'SYSTEMS NOMINAL // COUNTDOWN IN PROGRESS';
    if (t >= 24) status = 'TOWER CLEARANCE CONFIRMED // VEHICLE CLEAR';
    if (t >= 55) status = 'SPS PROPULSION FIRING // LEAVING EARTH';
    if (t >= 71) status = 'LUNAR ORBIT INSERTION POSTURE';
    if (this.hudStatusEl) this.hudStatusEl.textContent = status;
  }

  _onApolloProgress(p) {
    if (this.telClock) {
      const t = Math.round(p * 48);
      const m = Math.floor(t / 60), s = t % 60;
      this.telClock.textContent = `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    // Map progress (0–1) to shot
    const shot = this._shotForProgress01(APOLLO_SHOTS, p);
    if (shot) {
      if (this.hudKicker)   this.hudKicker.textContent   = shot.title;
      if (this.hudSubtitle) this.hudSubtitle.textContent = shot.subtitle;
      if (this.telPhase)    this.telPhase.textContent    = `SHOT ${shot.code} // LUNAR APPROACH`;
    }
  }

  _onMarsProgress(p) {
    // p is 0–6 for Mars
    if (this.telClock) {
      const t = Math.round((p / 6) * MARS_DURATION);
      const m = Math.floor(t / 60), s = t % 60;
      this.telClock.textContent = `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const normalised = p / 6;
    const shot = this._shotForProgress01(MARS_SHOTS.map(s => ({ ...s, start: s.start / 6, end: s.end / 6 })), normalised);
    if (shot) {
      if (this.hudKicker)   this.hudKicker.textContent   = shot.title;
      if (this.hudSubtitle) this.hudSubtitle.textContent = shot.subtitle;
      if (this.telPhase)    this.telPhase.textContent    = `SHOT ${shot.code} // MARTIAN SURFACE`;
    }
  }

  _onVoyagerTelemetry(snap) {
    if (this.telClock) {
      const t = Math.round(snap.progress * VOYAGER_DURATION);
      const m = Math.floor(t / 60), s = t % 60;
      this.telClock.textContent = `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    if (this.telVelocity) this.telVelocity.textContent = `${snap.relativeVelocityKms.toFixed(2)} km/s`;
    if (snap.activeShot) {
      if (this.hudKicker)   this.hudKicker.textContent   = snap.activeShot.title;
      if (this.hudSubtitle) this.hudSubtitle.textContent = snap.activeShot.subtitle;
      if (this.telPhase)    this.telPhase.textContent    = `SHOT ${snap.activeShot.code} // INTERSTELLAR`;
    }
  }

  _onWayHomeTime(t) {
    if (this.telClock) {
      const m = Math.floor(t / 60), s = Math.floor(t % 60);
      this.telClock.textContent = `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const shot = this._shotForProgress01(
      WAY_HOME_SHOTS.map(s => ({ ...s, start: s.startTime / 162, end: s.endTime / 162 })),
      t / 162
    );
    if (shot) {
      if (this.hudKicker)   this.hudKicker.textContent   = shot.title;
      if (this.hudSubtitle) this.hudSubtitle.textContent = shot.subtitle;
    }
    if (this.telPhase) this.telPhase.textContent = 'RETURNING HOME // EARTH APPROACH';
  }

  _onLoadProgress(pct) {
    if (this.curtainStatus) {
      this.curtainStatus.textContent = `LOADING SCENE... ${Math.round(pct)}%`;
    }
  }

  // ─── Transition Curtain ───────────────────────────────────────────────────

  _showCurtain(nextDest) {
    return new Promise((resolve) => {
      if (!this.curtain) { resolve(); return; }
      if (this.curtainStatus) {
        this.curtainStatus.textContent = `PREPARING ${nextDest.label}...`;
      }
      this.curtain.classList.add('is-visible');
      setTimeout(resolve, 700); // wait for fade-in
    });
  }

  _hideCurtain() {
    return new Promise((resolve) => {
      if (!this.curtain) { resolve(); return; }
      this.curtain.classList.remove('is-visible');
      setTimeout(resolve, 700); // wait for fade-out
    });
  }

  // ─── Grand Tribute ───────────────────────────────────────────────────────

  _showTribute() {
    this._disposeActive();
    if (!this.tributeOverlay) return;
    this.tributeOverlay.hidden = false;
    setTimeout(() => {
      this.tributeOverlay.classList.add('is-visible');
    }, 100);
  }

  _hideTribute() {
    if (!this.tributeOverlay) return;
    this.tributeOverlay.classList.remove('is-visible');
    setTimeout(() => {
      this.tributeOverlay.hidden = true;
    }, 500);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _shotForProgress01(shots, p) {
    if (!shots || !shots.length) return null;
    for (let i = shots.length - 1; i >= 0; i--) {
      if (p >= (shots[i].start || 0)) return shots[i];
    }
    return shots[0];
  }
}
