/**
 * storage.js — LocalStorage manager for Passenger Registration & Mission ID
 * Handles persistence, unique ID generation, validation, and safe data recovery.
 */

const STORAGE_KEY = 'legacy_tour_passenger';

/**
 * Generate a unique fictional mission ID.
 * Format: EXP-[random 4 digits]-[2 random letters] e.g., EXP-7491-AX
 */
export function generateMissionId() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const char1 = letters[Math.floor(Math.random() * letters.length)];
  const char2 = letters[Math.floor(Math.random() * letters.length)];
  return `EXP-${digits}-${char1}${char2}`;
}

/**
 * Retrieve passenger details from localStorage safely.
 * Returns { name, missionId, registeredAt } or null if absent/corrupted.
 */
export function getPassenger() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;

    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const missionId = typeof data.missionId === 'string' ? data.missionId.trim() : '';

    if (!name || !missionId) return null;

    return {
      name: name.slice(0, 30),
      missionId,
      registeredAt: data.registeredAt || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[Storage] Error reading passenger record:', err);
    return null;
  }
}

/**
 * Save new or updated passenger details.
 * If missionId is not provided, generates a new one.
 */
export function savePassenger(name, existingMissionId = null) {
  try {
    const trimmed = (name || '').trim().slice(0, 30);
    if (!trimmed) {
      throw new Error('Passenger name cannot be empty');
    }

    const missionId = existingMissionId || generateMissionId();
    const record = {
      name: trimmed,
      missionId,
      registeredAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return record;
  } catch (err) {
    console.error('[Storage] Error saving passenger record:', err);
    throw err;
  }
}

/**
 * Update passenger name while preserving the existing mission ID.
 */
export function updatePassengerName(newName) {
  const current = getPassenger();
  const missionId = current ? current.missionId : generateMissionId();
  return savePassenger(newName, missionId);
}

/**
 * Reset registration by removing passenger record from localStorage.
 */
export function resetPassenger() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[Storage] Error resetting passenger record:', err);
  }
}

