/**
 * @file Unlocks.js
 * @description Unlock condition checks for buildings, research, and features.
 *
 * Manages what content is available to the player based on their progress.
 */

import { isBuildingUnlocked } from './Buildings.js';
import { isResearchUnlocked } from './Research.js';

/**
 * Initial unlocks state
 */
export const INITIAL_UNLOCKS = {
  researchTab: false, // Unlocked when first Research Center is built
  factory: false, // Unlocked when 50 science is reached
  spaceship: false, // Unlocked when spaceship is built (win condition)
};

/**
 * Creates initial unlocks state
 * @returns {Object} Unlocks state object
 */
export function createUnlocksState() {
  return { ...INITIAL_UNLOCKS };
}

/**
 * Updates unlocks based on current game state
 * @param {Object} gameState - Current game state
 * @returns {Object} Updated unlocks
 */
export function updateUnlocks(gameState) {
  const unlocks = { ...gameState.unlocks };

  // Research Tab - unlocked when first Research Center is built
  if (!unlocks.researchTab && gameState.buildings.researchCenter?.count > 0) {
    unlocks.researchTab = true;
  }

  // Factory unlock - tracked for UI purposes
  if (!unlocks.factory && isBuildingUnlocked('factory', gameState)) {
    unlocks.factory = true;
  }

  return unlocks;
}

/**
 * Gets all available buildings for the current game state
 * @param {Object} gameState - Current game state
 * @returns {Array<string>} Array of building IDs that are available
 */
export function getAvailableBuildings(gameState) {
  const buildings = ['mine', 'tradingPost', 'solarPanel', 'researchCenter', 'factory'];
  return buildings.filter((id) => isBuildingUnlocked(id, gameState));
}

/**
 * Gets all available research for the current game state
 * @param {Object} gameState - Current game state
 * @returns {Array<string>} Array of research IDs that are available
 */
export function getAvailableResearch(gameState) {
  const research = [
    'efficientMining',
    'solarEfficiency',
    'advancedTrading',
    'factoryAutomation',
    'efficientResearching',
    'scientificMethod',
  ];
  return research.filter((id) => isResearchUnlocked(id, gameState));
}

/**
 * Checks if the research tab should be shown
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if research tab is available
 */
export function isResearchTabUnlocked(gameState) {
  return gameState.unlocks?.researchTab || gameState.buildings?.researchCenter?.count > 0;
}

/**
 * Gets a summary of unlock progress
 * @param {Object} gameState - Current game state
 * @returns {Object} Progress summary
 */
export function getUnlockProgress(gameState) {
  const availableBuildings = getAvailableBuildings(gameState);
  const totalBuildings = 5;

  return {
    buildingsUnlocked: availableBuildings.length,
    totalBuildings,
    researchUnlocked: gameState.unlocks?.researchTab || false,
    spaceshipReady: gameState.unlocks?.spaceship || false,
  };
}
