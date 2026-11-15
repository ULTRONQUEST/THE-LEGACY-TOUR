/**
 * navigation.js — Screen flow and interaction manager for Phase 1, Phase 2, and Phase 3
 * Manages transitions between:
 * - Landing Page (#landing-page)
 * - Registration Screen (#registration-page)
 * - Personalized Digital Boarding Pass (#boarding-page)
 * - Spacecraft Cabin Flight Deck (#spacecraft-page)
 * - Launch Sequence Authorized Placeholder (#launch-placeholder-page)
 */
import {
  getPassenger,
  savePassenger,
  updatePassengerName,
  resetPassenger,
} from './storage.js';
import { SpacecraftCabin } from './cabin.js';
import { LaunchSceneManager } from './launchScene.js';
import { TourController } from './tourController.js';

export class Navigation {
  constructor() {
    // Screens
    this.landingPage = document.getElementById('landing-page');
    this.registrationPage = document.getElementById('registration-page');
    this.boardingPage = document.getElementById('boarding-page');
    this.spacecraftPage = document.getElementById('spacecraft-page');
    this.launchPlaceholderPage = document.getElementById('launch-placeholder-page');
    this.launchScenePage = document.getElementById('launch-scene-page');
    this.moonPage = document.getElementById('moon-page');

    // Landing controls
    this.unlockBtn = document.getElementById('unlock-btn');

    // Registration controls
    this.registrationForm = document.getElementById('registration-form');
    this.passengerInput = document.getElementById('passenger-name-input');
    this.charCounter = document.getElementById('registration-counter');
    this.validationBox = document.getElementById('registration-validation-msg');
    this.validationText = document.getElementById('validation-text');
    this.registrationReturnBtn = document.getElementById('registration-return-btn');

    // Boarding Pass elements & controls
    this.passNameEl = document.getElementById('pass-passenger-name');
    this.passMissionIdEl = document.getElementById('pass-mission-id');
    this.passBarcodeTextEl = document.getElementById('pass-barcode-text');
    this.enterSpacecraftBtn = document.getElementById('enter-spacecraft-btn');
    this.passEditBtn = document.getElementById('pass-edit-btn');
    this.passResetBtn = document.getElementById('pass-reset-btn');
    this.returnBtn = document.getElementById('return-btn');

    // Phase 4 Launch Placeholder controls
    this.launchPassengerEl = document.getElementById('launch-passenger-name');
    this.launchMissionIdEl = document.getElementById('launch-mission-id');
    this.launchStartCinematicBtn = document.getElementById('launch-start-cinematic-btn');
    this.launchAutoProgressEl = document.getElementById('launch-auto-timer-progress');
    this.launchAutoLabelEl = document.getElementById('launch-auto-timer-label');
    this.launchReturnCabinBtn = document.getElementById('launch-return-cabin-btn');
    this.launchReturnArchiveBtn = document.getElementById('launch-return-archive-btn');

    // Phase 5 Moon screen elements & controls
    this.moonPassengerEl = document.getElementById('moon-passenger-name');
    this.moonMissionIdEl = document.getElementById('moon-mission-id');
    this.moonReplayBtn = document.getElementById('moon-replay-launch-btn');
    this.moonReturnCabinBtn = document.getElementById('moon-return-cabin-btn');
    this.moonReturnArchiveBtn = document.getElementById('moon-return-archive-btn');

    // Auto-launch timer state
    this._autoLaunchTimeout = null;
    this._autoLaunchInterval = null;

    // Track active screen
    this.activeScreen = 'landing';
    this.isEditing = false;

    // Initialize Phase 3 Spacecraft Cabin Controller
    this.cabin = new SpacecraftCabin({
      onLaunchAuthorized: () => {
        const passenger = getPassenger();
        this.showLaunchPlaceholder(passenger);
      },
      onReturnToBoarding: () => {
        const passenger = getPassenger();
        this.showBoarding(passenger);
      },
    });

    // Initialize Phase 4 Launch Scene Manager (ignition only — legacy)
    this.launchManager = new LaunchSceneManager({
      onContinueToMoon: () => {
        const passenger = getPassenger();
        this.showMoonPage(passenger);
      },
      onReturnToCabin: () => {
        const passenger = getPassenger();
        this.showSpacecraft(passenger);
      },
      onReturnToArchive: () => {
        this.showLanding();
      },
    });

    // Initialize Phase 4 Multi-Scene Tour Controller (all 5 scenes)
    this.tourController = new TourController({
      onContinueToPhase5: () => {
        const passenger = getPassenger();
        this.showMoonPage(passenger);
      },
      onReturnToCabin: () => {
        const passenger = getPassenger();
        this.showSpacecraft(passenger);
      },
      onReturnToArchive: () => {
        this.showLanding();
      },
    });

    this._bindEvents();
    this._checkInitialStorage();
  }

  _bindEvents() {
    // Landing CTA -> Check storage & route
    this.unlockBtn.addEventListener('click', () => {
      const passenger = getPassenger();
      if (passenger) {
        this.showBoarding(passenger);
      } else {
        this.showRegistration();
      }
    });

    // Registration input character counter
    this.passengerInput.addEventListener('input', () => {
      const len = this.passengerInput.value.length;
      this.charCounter.textContent = `${len} / 30`;
      if (this.validationBox.classList.contains('is-visible')) {
        this._hideValidation();
      }
    });

    // Registration form submission
    this.registrationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleRegistrationSubmit();
    });

    // Return to Landing from Registration
    this.registrationReturnBtn.addEventListener('click', () => {
      this.showLanding();
    });

    // Boarding Pass: Edit Passenger Name
    this.passEditBtn.addEventListener('click', () => {
      const current = getPassenger();
      this.isEditing = true;
      this.showRegistration(current ? current.name : '');
    });

    // Boarding Pass: Reset Registration
    this.passResetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset your expedition registration?')) {
        resetPassenger();
        this.isEditing = false;
        this.showRegistration();
      }
    });

    // Boarding Pass: Return to Landing
    this.returnBtn.addEventListener('click', () => {
      this.showLanding();
    });

    // Boarding Pass: Enter Spacecraft
    this.enterSpacecraftBtn.addEventListener('click', () => {
      const passenger = getPassenger();
      if (!passenger) {
        this.showRegistration();
        return;
      }
      this.showSpacecraft(passenger);
    });

    // Launch Authorization Gate: Commence Liftoff
    if (this.launchStartCinematicBtn) {
      this.launchStartCinematicBtn.addEventListener('click', () => {
        this._clearAutoLaunchTimer();
        const passenger = getPassenger();
        this.showLaunchScene(passenger);
      });
    }

    // Launch Authorization Gate: Return to Cabin
    if (this.launchReturnCabinBtn) {
      this.launchReturnCabinBtn.addEventListener('click', () => {
        this._clearAutoLaunchTimer();
        const passenger = getPassenger();
        this.showSpacecraft(passenger);
      });
    }

    // Launch Authorization Gate: Return to Archive
    if (this.launchReturnArchiveBtn) {
      this.launchReturnArchiveBtn.addEventListener('click', () => {
        this._clearAutoLaunchTimer();
        this.showLanding();
      });
    }

    // Phase 5 Moon Screen: Replay Launch Sequence
    if (this.moonReplayBtn) {
      this.moonReplayBtn.addEventListener('click', () => {
        const passenger = getPassenger();
        this.showLaunchScene(passenger);
      });
    }

    // Phase 5 Moon Screen: Return to Cabin
    if (this.moonReturnCabinBtn) {
      this.moonReturnCabinBtn.addEventListener('click', () => {
        const passenger = getPassenger();
        this.showSpacecraft(passenger);
      });
    }

    // Phase 5 Moon Screen: Return to Archive
    if (this.moonReturnArchiveBtn) {
      this.moonReturnArchiveBtn.addEventListener('click', () => {
        this.showLanding();
      });
    }

    // Global Keyboard: Escape key to navigate back
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.activeScreen === 'launch-scene') {
          const passenger = getPassenger();
          this.showSpacecraft(passenger);
        } else if (this.activeScreen === 'moon') {
          const passenger = getPassenger();
          this.showSpacecraft(passenger);
        } else if (this.activeScreen === 'launch-placeholder') {
          this._clearAutoLaunchTimer();
          const passenger = getPassenger();
          this.showSpacecraft(passenger);
        } else if (this.activeScreen === 'spacecraft') {
          const passenger = getPassenger();
          this.showBoarding(passenger);
        } else if (this.activeScreen === 'boarding' || this.activeScreen === 'registration') {
          this.showLanding();
        }
      }
    });
  }

  _checkInitialStorage() {
    const passenger = getPassenger();
    if (passenger) {
      this._populatePassData(passenger);
    }
  }

  _showValidation(message) {
    this.validationText.textContent = message;
    this.validationBox.classList.add('is-visible');
    this.passengerInput.classList.add('is-invalid');
    this.passengerInput.focus();
  }

  _hideValidation() {
    this.validationBox.classList.remove('is-visible');
    this.passengerInput.classList.remove('is-invalid');
  }

  _handleRegistrationSubmit() {
    const rawVal = this.passengerInput.value;
    const trimmed = rawVal.trim();

    if (!trimmed) {
      this._showValidation('Please enter your name to proceed with mission registration.');
      return;
    }

    if (trimmed.length > 30) {
      this._showValidation('Passenger name must be 30 characters or fewer.');
      return;
    }

    this._hideValidation();

    let passenger;
    if (this.isEditing) {
      passenger = updatePassengerName(trimmed);
      this.isEditing = false;
    } else {
      passenger = savePassenger(trimmed);
    }

    this.showBoarding(passenger);
  }

  _populatePassData(passenger) {
    if (!passenger) return;
    const nameUpper = (passenger.name || 'EXPLORER').toUpperCase();
    const missionId = passenger.missionId || 'EXP-2026-X';

    this.passNameEl.textContent = nameUpper;
    this.passMissionIdEl.textContent = missionId;
    this.passBarcodeTextEl.textContent = `TLT-${missionId}`;

    if (this.launchPassengerEl) {
      this.launchPassengerEl.textContent = nameUpper;
    }
    if (this.launchMissionIdEl) {
      this.launchMissionIdEl.textContent = missionId;
    }
  }

  _clearAutoLaunchTimer() {
    if (this._autoLaunchTimeout) {
      clearTimeout(this._autoLaunchTimeout);
      this._autoLaunchTimeout = null;
    }
    if (this._autoLaunchInterval) {
      clearInterval(this._autoLaunchInterval);
      this._autoLaunchInterval = null;
    }
    if (this.launchAutoProgressEl) {
      this.launchAutoProgressEl.style.width = '0%';
    }
  }

  _hideAllScreens() {
    this._clearAutoLaunchTimer();

    // If launch scene was active, pause/cleanup audio and render loop
    if (this.activeScreen === 'launch-scene') {
      if (this.tourController) this.tourController.pauseAndCleanup();
      if (this.launchManager)  this.launchManager.pauseAndCleanup();
    }

    [
      this.landingPage,
      this.registrationPage,
      this.boardingPage,
      this.spacecraftPage,
      this.launchPlaceholderPage,
      this.launchScenePage,
      this.moonPage,
    ].forEach((screen) => {
      if (screen) {
        screen.hidden = true;
        screen.style.display = 'none';
        screen.classList.remove('is-entering');
      }
    });
  }

  showLanding() {
    this._hideAllScreens();
    this.landingPage.hidden = false;
    this.landingPage.style.display = '';
    this.landingPage.style.opacity = '1';
    document.body.classList.remove('boarding-active');
    this.activeScreen = 'landing';
    this.unlockBtn.focus();
  }

  showRegistration(prefillName = '') {
    this._hideAllScreens();
    document.body.classList.add('boarding-active');
    this.registrationPage.hidden = false;
    this.registrationPage.style.display = 'flex';
    this.registrationPage.classList.add('is-entering');
    this.activeScreen = 'registration';

    this.passengerInput.value = prefillName;
    this.charCounter.textContent = `${prefillName.length} / 30`;
    this._hideValidation();

    setTimeout(() => {
      this.passengerInput.focus();
      this.registrationPage.classList.remove('is-entering');
    }, 400);
  }

  showBoarding(passenger) {
    if (!passenger) {
      passenger = getPassenger();
      if (!passenger) {
        this.showRegistration();
        return;
      }
    }

    this._populatePassData(passenger);
    this._hideAllScreens();
    document.body.classList.add('boarding-active');
    this.boardingPage.hidden = false;
    this.boardingPage.style.display = 'flex';
    this.boardingPage.classList.add('is-entering');
    this.activeScreen = 'boarding';

    setTimeout(() => {
      this.enterSpacecraftBtn.focus();
      this.boardingPage.classList.remove('is-entering');
    }, 400);
  }

  showSpacecraft(passenger) {
    if (!passenger) {
      passenger = getPassenger();
      if (!passenger) {
        // Fallback gracefully to registration if missing
        this.showRegistration();
        return;
      }
    }

    this._populatePassData(passenger);
    this._hideAllScreens();
    document.body.classList.add('boarding-active');
    this.spacecraftPage.hidden = false;
    this.spacecraftPage.style.display = 'flex';
    this.spacecraftPage.classList.add('is-entering');
    this.activeScreen = 'spacecraft';

    // Populate cabin displays & run pre-departure sequence
    this.cabin.populatePassengerData(passenger);
    this.cabin.startPreDepartureSequence();

    setTimeout(() => {
      this.spacecraftPage.classList.remove('is-entering');
    }, 400);
  }

  showLaunchPlaceholder(passenger) {
    if (!passenger) {
      passenger = getPassenger();
    }
    this._populatePassData(passenger);
    this._hideAllScreens();
    document.body.classList.add('boarding-active');
    this.launchPlaceholderPage.hidden = false;
    this.launchPlaceholderPage.style.display = 'flex';
    this.launchPlaceholderPage.classList.add('is-entering');
    this.activeScreen = 'launch-placeholder';

    // Start 3.5s auto-commence countdown
    let remainingMs = 3500;
    const intervalMs = 50;
    const totalMs = 3500;

    if (this.launchAutoProgressEl) {
      this.launchAutoProgressEl.style.width = '0%';
    }
    if (this.launchAutoLabelEl) {
      this.launchAutoLabelEl.textContent = 'AUTO-COMMENCING IN 3s...';
    }

    this._autoLaunchInterval = setInterval(() => {
      remainingMs -= intervalMs;
      const progress = Math.min(100, Math.max(0, ((totalMs - remainingMs) / totalMs) * 100));
      if (this.launchAutoProgressEl) {
        this.launchAutoProgressEl.style.width = `${progress}%`;
      }
      if (this.launchAutoLabelEl) {
        const secs = Math.ceil(remainingMs / 1000);
        this.launchAutoLabelEl.textContent = secs > 0 ? `AUTO-COMMENCING IN ${secs}s...` : 'IGNITION INITIATING...';
      }
    }, intervalMs);

    this._autoLaunchTimeout = setTimeout(() => {
      this._clearAutoLaunchTimer();
      this.showLaunchScene(passenger);
    }, totalMs);

    setTimeout(() => {
      if (this.launchStartCinematicBtn) {
        this.launchStartCinematicBtn.focus();
      } else if (this.launchReturnCabinBtn) {
        this.launchReturnCabinBtn.focus();
      }
      this.launchPlaceholderPage.classList.remove('is-entering');
    }, 400);
  }

  showLaunchScene(passenger) {
    if (!passenger) {
      passenger = getPassenger();
    }
    this._populatePassData(passenger);
    this._hideAllScreens();
    document.body.classList.add('boarding-active');

    if (this.launchScenePage) {
      this.launchScenePage.hidden = false;
      this.launchScenePage.style.display = 'block';
      this.launchScenePage.classList.add('is-entering');
    }
    this.activeScreen = 'launch-scene';

    // Mount and start 5-scene continuous journey
    if (this.tourController) {
      this.tourController.mountAndStart(passenger);
    }

    setTimeout(() => {
      if (this.launchScenePage) {
        this.launchScenePage.classList.remove('is-entering');
      }
    }, 400);
  }

  showMoonPage(passenger) {
    if (!passenger) {
      passenger = getPassenger();
    }
    this._populatePassData(passenger);
    this._hideAllScreens();
    document.body.classList.add('boarding-active');

    if (this.moonPassengerEl) {
      this.moonPassengerEl.textContent = (passenger && passenger.name ? passenger.name : 'EXPLORER').toUpperCase();
    }
    if (this.moonMissionIdEl) {
      this.moonMissionIdEl.textContent = passenger && passenger.missionId ? passenger.missionId : 'EXP-0000-XX';
    }

    if (this.moonPage) {
      this.moonPage.hidden = false;
      this.moonPage.style.display = 'flex';
      this.moonPage.classList.add('is-entering');
    }
    this.activeScreen = 'moon';

    setTimeout(() => {
      if (this.moonReplayBtn) {
        this.moonReplayBtn.focus();
      }
      if (this.moonPage) {
        this.moonPage.classList.remove('is-entering');
      }
    }, 400);
  }
}
