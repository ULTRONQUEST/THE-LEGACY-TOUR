/**
 * Main entry point — initializes modules for Phase 1 (Landing), Phase 2 (Registration & Boarding), and Phase 3 (Spacecraft Cabin)
 */
import { StarField } from './starfield.js';
import { Parallax } from './parallax.js';
import { Navigation } from './navigation.js';

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  // Initialize star field
  const canvas = document.getElementById('star-canvas');
  if (canvas) {
    const starField = new StarField(canvas);
    starField.start();
  }

  // Initialize parallax
  new Parallax();

  // Initialize navigation
  new Navigation();
});

