import Game from '../models/Game.js';

/**
 * Gets the single active game (if any)
 * Since we're enforcing single-game mode, there should only be one active game at a time
 */
export async function getSingleActiveGame() {
  try {
    const activeGame = await Game.findOne({ status: 'active' });
    return activeGame;
  } catch (error) {
    console.error('Error fetching active game:', error);
    return null;
  }
}

/**
 * Gets the single game in any state (active, pending, registration, completed)
 * Returns the most recent game first
 */
export async function getSingleGame() {
  try {
    const game = await Game.findOne().sort({ createdAt: -1 });
    return game;
  } catch (error) {
    console.error('Error fetching game:', error);
    return null;
  }
}

/**
 * Gets the single pending game (if any)
 */
export async function getSinglePendingGame() {
  try {
    const pendingGame = await Game.findOne({ status: 'pending' });
    return pendingGame;
  } catch (error) {
    console.error('Error fetching pending game:', error);
    return null;
  }
}

/**
 * Gets the single registration game (if any)
 */
export async function getSingleRegistrationGame() {
  try {
    const registrationGame = await Game.findOne({ status: 'registration' });
    return registrationGame;
  } catch (error) {
    console.error('Error fetching registration game:', error);
    return null;
  }
}

/**
 * Gets any game that isn't completed (pending, registration, or active)
 */
export async function getCurrentGame() {
  try {
    const currentGame = await Game.findOne({
      status: { $in: ['pending', 'registration', 'active'] }
    }).sort({ createdAt: -1 });
    return currentGame;
  } catch (error) {
    console.error('Error fetching current game:', error);
    return null;
  }
}

/**
 * Checks if there's any non-completed game (enforces single game rule)
 */
export async function hasActiveOrPendingGame() {
  try {
    const existingGame = await Game.findOne({
      status: { $in: ['pending', 'registration', 'active'] }
    });
    return !!existingGame;
  } catch (error) {
    console.error('Error checking for active/pending game:', error);
    return false;
  }
}
