/**
 * @file GameLoop.js
 * @description Tick-based resource generation and game update loop for the idle game.
 *
 * Handles:
 * - Resource production from buildings
 * - Resource consumption (trading posts, energy)
 * - Research progress updates
 * - Energy deficit handling
 */

import { gameStateManager } from './GameState.js';
import {
  BUILDINGS,
  getBuildingCost,
  getBuildingProduction,
  getBuildingConsumption,
  getBuildingEnergyCost,
  getMaxScientists,
  getResearchSlots,
  isBuildingUnlocked,
} from './Buildings.js';
import {
  getAllProductionBonuses,
  getActualResearchTime,
  distributeScientists,
  getScientistHireCost,
  getResearchCost,
  getResearchBaseTime,
  isResearchUnlocked,
} from './Research.js';
import { updateUnlocks } from './Unlocks.js';
import { spendResources, canAfford, canBuildSpaceship, SPACESHIP_COST } from './Resources.js';

/**
 * Game loop controller
 */
class GameLoop {
  constructor() {
    this.running = false;
    this.lastTick = 0;
    this.tickRate = 1000 / 10; // 10 ticks per second
    this.animationFrameId = null;
  }

  /**
   * Start the game loop
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTick = performance.now();
    this.loop();
  }

  /**
   * Stop the game loop
   */
  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main game loop
   */
  loop = () => {
    if (!this.running) return;

    const now = performance.now();
    const elapsed = now - this.lastTick;

    if (elapsed >= this.tickRate) {
      const deltaSeconds = elapsed / 1000;
      this.tick(deltaSeconds);
      this.lastTick = now;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Process a single game tick
   * @param {number} deltaSeconds - Time since last tick in seconds
   */
  tick(deltaSeconds) {
    const state = gameStateManager.getState();
    if (!state) return;

    // Calculate production bonuses from research
    const bonuses = getAllProductionBonuses(state.research.completed);

    // Calculate net energy
    const netEnergy = this.calculateNetEnergy(state, bonuses);
    const hasEnergy = netEnergy >= 0;

    // Update resources based on buildings
    this.updateResourceProduction(state, deltaSeconds, bonuses, hasEnergy);

    // Update research progress
    this.updateResearchProgress(state, deltaSeconds);

    // Update unlocks
    state.unlocks = updateUnlocks(state);

    // Update playtime
    state.stats.playTime += deltaSeconds;

    // Store net energy for display
    state.resources.energy = netEnergy;

    // Notify state change
    gameStateManager.updateState(state);
  }

  /**
   * Calculate net energy (production - consumption)
   * @param {Object} state - Game state
   * @param {Object} bonuses - Production bonuses
   * @returns {number} Net energy per second
   */
  calculateNetEnergy(state, bonuses) {
    let production = 0;
    let consumption = 0;

    for (const [buildingId, buildingState] of Object.entries(state.buildings)) {
      const count = buildingState.count || 0;
      if (count === 0) continue;

      // Energy production (only solar panels produce energy)
      const prod = getBuildingProduction(buildingId, count, bonuses);
      if (prod.energy) {
        production += prod.energy;
      }

      // Energy consumption
      consumption += getBuildingEnergyCost(buildingId, count);
    }

    return production - consumption;
  }

  /**
   * Update resource production from buildings
   * @param {Object} state - Game state
   * @param {number} deltaSeconds - Time elapsed
   * @param {Object} bonuses - Production bonuses
   * @param {boolean} hasEnergy - Whether there's enough energy
   */
  updateResourceProduction(state, deltaSeconds, bonuses, hasEnergy) {
    const resources = state.resources;

    for (const [buildingId, buildingState] of Object.entries(state.buildings)) {
      const count = buildingState.count || 0;
      if (count === 0) continue;

      const building = BUILDINGS[buildingId];
      if (!building) continue;

      // Check if building requires energy and we have none
      if (building.energyCost > 0 && !hasEnergy) {
        continue; // Skip this building's production
      }

      // Get production rates
      const production = getBuildingProduction(buildingId, count, bonuses);
      const consumption = getBuildingConsumption(buildingId, count);

      // Handle Trading Post special case - needs minerals to produce money
      if (buildingId === 'tradingPost') {
        const mineralsNeeded = (consumption.minerals || 0) * deltaSeconds;
        if (resources.minerals >= mineralsNeeded) {
          // Consume minerals and produce money
          resources.minerals -= mineralsNeeded;
          if (production.money) {
            const moneyGained = production.money * deltaSeconds;
            resources.money += moneyGained;
            state.stats.totalMoneyGathered = (state.stats.totalMoneyGathered || 0) + moneyGained;
          }
        }
        // If not enough minerals, don't produce
        continue;
      }

      // Normal production (no consumption check needed for other buildings)
      for (const [resource, rate] of Object.entries(production)) {
        if (resource !== 'energy') {
          // Energy is calculated separately
          const gained = rate * deltaSeconds;
          resources[resource] = (resources[resource] || 0) + gained;

          // Track totals for unlock conditions
          if (resource === 'science') {
            state.stats.totalScienceGathered = (state.stats.totalScienceGathered || 0) + gained;
          }
        }
      }
    }
  }

  /**
   * Update research progress
   * @param {Object} state - Game state
   * @param {number} deltaSeconds - Time elapsed
   */
  updateResearchProgress(state, deltaSeconds) {
    const activeResearches = state.research.activeResearches;
    if (activeResearches.length === 0) return;

    // Check energy - research centers need energy
    const netEnergy = this.calculateNetEnergy(
      state,
      getAllProductionBonuses(state.research.completed)
    );
    if (netEnergy < 0) return; // No energy, no research progress

    // Distribute scientists across active researches (for future use in dynamic time adjustment)
    distributeScientists(state.research.scientists, activeResearches.length);

    // Update each active research
    const completedIndices = [];

    for (let i = 0; i < activeResearches.length; i++) {
      const research = activeResearches[i];

      // Progress is based on time
      research.progress += deltaSeconds;

      // Check if complete
      if (research.progress >= research.totalTime) {
        completedIndices.push(i);

        // Increment completed level
        const currentLevel = state.research.completed[research.id] || 0;
        state.research.completed[research.id] = currentLevel + 1;
      }
    }

    // Remove completed researches (in reverse order to preserve indices)
    for (let i = completedIndices.length - 1; i >= 0; i--) {
      activeResearches.splice(completedIndices[i], 1);
    }
  }
}

/**
 * Click to gather minerals
 * @param {Object} state - Game state (optional, uses manager if not provided)
 * @returns {number} Minerals gathered
 */
export function gatherMinerals(state = null) {
  const gameState = state || gameStateManager.getState();
  if (!gameState) return 0;

  const amount = 1; // Base click amount
  gameState.resources.minerals += amount;
  gameState.stats.totalClicks++;
  gameState.stats.totalMineralsGathered += amount;

  if (!state) {
    gameStateManager.updateState(gameState);
  }

  return amount;
}

/**
 * Purchase a building
 * @param {string} buildingId - Building type ID
 * @returns {boolean} True if purchase successful
 */
export function purchaseBuilding(buildingId) {
  const state = gameStateManager.getState();
  if (!state) return false;

  // Check if unlocked
  if (!isBuildingUnlocked(buildingId, state)) {
    return false;
  }

  // Get cost
  const owned = state.buildings[buildingId]?.count || 0;
  const cost = getBuildingCost(buildingId, owned);

  // Check if can afford
  if (!canAfford(state.resources, cost)) {
    return false;
  }

  // Spend resources
  spendResources(state.resources, cost);

  // Add building
  state.buildings[buildingId].count = owned + 1;

  // Update state
  gameStateManager.updateState(state);

  return true;
}

/**
 * Sell a building
 * @param {string} buildingId - Building type ID
 * @returns {boolean} True if sale successful
 */
export function sellBuilding(buildingId) {
  const state = gameStateManager.getState();
  if (!state) return false;

  const owned = state.buildings[buildingId]?.count || 0;
  if (owned === 0) return false;

  // Remove building (no refund per spec)
  state.buildings[buildingId].count = owned - 1;

  // Update state
  gameStateManager.updateState(state);

  return true;
}

/**
 * Hire a scientist
 * @returns {boolean} True if hire successful
 */
export function hireScientist() {
  const state = gameStateManager.getState();
  if (!state) return false;

  const currentScientists = state.research.scientists;
  const maxScientists = getMaxScientists(state.buildings.researchCenter?.count || 0);

  // Check max scientists
  if (currentScientists >= maxScientists) {
    return false;
  }

  // Get cost
  const cost = { money: getScientistHireCost(currentScientists) };

  // Check if can afford
  if (!canAfford(state.resources, cost)) {
    return false;
  }

  // Spend resources
  spendResources(state.resources, cost);

  // Add scientist
  state.research.scientists = currentScientists + 1;

  // Update state
  gameStateManager.updateState(state);

  return true;
}

/**
 * Start a research
 * @param {string} researchId - Research type ID
 * @returns {boolean} True if research started
 */
export function startResearch(researchId) {
  const state = gameStateManager.getState();
  if (!state) return false;

  // Check if unlocked
  if (!isResearchUnlocked(researchId, state)) {
    return false;
  }

  // Check available slots
  const slots = getResearchSlots(state.buildings.researchCenter?.count || 0);
  if (state.research.activeResearches.length >= slots) {
    return false;
  }

  // Check if already researching this
  if (state.research.activeResearches.some((r) => r.id === researchId)) {
    return false;
  }

  // Calculate cost and time for next level
  const currentLevel = state.research.completed[researchId] || 0;
  const nextLevel = currentLevel + 1;
  const cost = { science: getResearchCost(researchId, nextLevel) };

  // Check if can afford
  if (!canAfford(state.resources, cost)) {
    return false;
  }

  // Spend science
  spendResources(state.resources, cost);

  // Calculate actual time with bonuses
  const baseTime = getResearchBaseTime(researchId, nextLevel);
  const scientificMethodLevel = state.research.completed.scientificMethod || 0;
  const scientistsPerResearch = distributeScientists(
    state.research.scientists,
    state.research.activeResearches.length + 1
  );
  const actualTime = getActualResearchTime(baseTime, scientistsPerResearch, scientificMethodLevel);

  // Add to active researches
  state.research.activeResearches.push({
    id: researchId,
    level: nextLevel,
    progress: 0,
    totalTime: actualTime,
  });

  // Update state
  gameStateManager.updateState(state);

  return true;
}

/**
 * Cancel an active research
 * @param {string} researchId - Research type ID
 * @returns {boolean} True if cancelled
 */
export function cancelResearch(researchId) {
  const state = gameStateManager.getState();
  if (!state) return false;

  const index = state.research.activeResearches.findIndex((r) => r.id === researchId);
  if (index === -1) return false;

  // Remove from active (no refund per spec)
  state.research.activeResearches.splice(index, 1);

  // Update state
  gameStateManager.updateState(state);

  return true;
}

/**
 * Build the spaceship (win condition)
 * @returns {boolean} True if spaceship built
 */
export function buildSpaceship() {
  const state = gameStateManager.getState();
  if (!state) return false;

  if (!canBuildSpaceship(state.resources)) {
    return false;
  }

  // Spend resources
  spendResources(state.resources, SPACESHIP_COST);

  // Mark as complete
  state.unlocks.spaceship = true;

  // Update state
  gameStateManager.updateState(state);

  return true;
}

/**
 * Get production rates summary
 * @returns {Object} Production rates for all resources
 */
export function getProductionRates() {
  const state = gameStateManager.getState();
  if (!state) return {};

  const bonuses = getAllProductionBonuses(state.research.completed);
  const rates = {
    minerals: 0,
    money: 0,
    energy: 0,
    science: 0,
    spaceshipParts: 0,
  };

  // Calculate net energy first
  const netEnergy = gameLoop.calculateNetEnergy(state, bonuses);
  rates.energy = netEnergy;
  const hasEnergy = netEnergy >= 0;

  for (const [buildingId, buildingState] of Object.entries(state.buildings)) {
    const count = buildingState.count || 0;
    if (count === 0) continue;

    const building = BUILDINGS[buildingId];
    if (!building) continue;

    // Skip if building needs energy and there's none
    if (building.energyCost > 0 && !hasEnergy) {
      continue;
    }

    const production = getBuildingProduction(buildingId, count, bonuses);
    const consumption = getBuildingConsumption(buildingId, count);

    // Trading post special case
    if (buildingId === 'tradingPost') {
      // Show potential rate (actual depends on minerals available)
      rates.money += production.money || 0;
      rates.minerals -= consumption.minerals || 0;
      continue;
    }

    // Add production rates
    for (const [resource, rate] of Object.entries(production)) {
      if (resource !== 'energy') {
        rates[resource] += rate;
      }
    }
  }

  return rates;
}

// Create singleton instance
const gameLoop = new GameLoop();

export { gameLoop };
