/**
 * @file GameState.js
 * @description State management and IndexedDB persistence for the idle game.
 *
 * Features:
 * - IndexedDB persistence with auto-save
 * - Offline progress calculation
 * - State validation and migration
 * - Reset functionality
 */

import { createResources } from './Resources.js';
import {
  BUILDINGS,
  createBuildingsState,
  getBuildingProduction,
  getBuildingConsumption,
  getBuildingEnergyCost,
} from './Buildings.js';
import { createResearchState, getAllProductionBonuses } from './Research.js';
import { createUnlocksState } from './Unlocks.js';
import { Logger } from '../utils/logger.js';

const DB_NAME = 'WhiteRabbitIdleGame';
const DB_VERSION = 1;
const STORE_NAME = 'gameState';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * Current state version for migrations
 */
const STATE_VERSION = 1;

/**
 * Creates a fresh game state
 * @returns {Object} New game state
 */
export function createGameState() {
  return {
    version: STATE_VERSION,
    lastSaved: Date.now(),
    resources: createResources(),
    buildings: createBuildingsState(),
    stats: {
      totalClicks: 0,
      totalMineralsGathered: 0,
      totalScienceGathered: 0,
      totalMoneyGathered: 0,
      playTime: 0,
    },
    unlocks: createUnlocksState(),
    research: createResearchState(),
  };
}

/**
 * Opens IndexedDB connection
 * @returns {Promise<IDBDatabase>} Database connection
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      Logger.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves game state to IndexedDB
 * @param {Object} state - Game state to save
 * @returns {Promise<void>}
 */
export async function saveGameState(state) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const saveData = {
      id: 'current',
      ...state,
      lastSaved: Date.now(),
    };

    store.put(saveData);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (error) {
    Logger.error('Failed to save game state:', error);
    throw error;
  }
}

/**
 * Loads game state from IndexedDB
 * @returns {Promise<Object|null>} Loaded state or null if not found
 */
export async function loadGameState() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('current');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const data = request.result;
        if (data) {
          // Remove the 'id' key used for IndexedDB
          const state = { ...data };
          delete state.id;
          resolve(validateAndMigrateState(state));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    Logger.error('Failed to load game state:', error);
    return null;
  }
}

/**
 * Deletes game state from IndexedDB (reset)
 * @returns {Promise<void>}
 */
export async function deleteGameState() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete('current');

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (error) {
    Logger.error('Failed to delete game state:', error);
    throw error;
  }
}

/**
 * Validates and migrates saved state to current version
 * @param {Object} state - Loaded state
 * @returns {Object} Validated/migrated state
 */
function validateAndMigrateState(state) {
  const fresh = createGameState();

  // Ensure all top-level properties exist
  const validated = {
    version: state.version || STATE_VERSION,
    lastSaved: state.lastSaved || Date.now(),
    resources: { ...fresh.resources, ...state.resources },
    buildings: { ...fresh.buildings },
    stats: { ...fresh.stats, ...state.stats },
    unlocks: { ...fresh.unlocks, ...state.unlocks },
    research: { ...fresh.research },
  };

  // Merge buildings carefully
  if (state.buildings) {
    for (const [id, data] of Object.entries(state.buildings)) {
      if (validated.buildings[id]) {
        validated.buildings[id] = { ...validated.buildings[id], ...data };
      }
    }
  }

  // Merge research carefully
  if (state.research) {
    validated.research = {
      scientists: state.research.scientists || 0,
      activeResearches: state.research.activeResearches || [],
      completed: { ...fresh.research.completed, ...state.research.completed },
    };
  }

  return validated;
}

/**
 * Calculates offline progress
 * @param {Object} state - Current game state
 * @param {number} offlineSeconds - Seconds spent offline
 * @returns {Object} Updated state with offline progress
 */
export function calculateOfflineProgress(state, offlineSeconds) {
  // Cap offline progress at 24 hours
  const maxOfflineSeconds = 24 * 60 * 60;
  const seconds = Math.min(offlineSeconds, maxOfflineSeconds);

  if (seconds <= 0) return state;

  // Deep clone the state
  const updatedState = JSON.parse(JSON.stringify(state));

  // Calculate production bonuses from research
  const bonuses = getAllProductionBonuses(updatedState.research.completed);

  // Calculate net energy
  let energyProduction = 0;
  let energyConsumption = 0;

  for (const [buildingId, buildingState] of Object.entries(updatedState.buildings)) {
    const count = buildingState.count || 0;
    if (count === 0) continue;

    const prod = getBuildingProduction(buildingId, count, bonuses);
    if (prod.energy) {
      energyProduction += prod.energy;
    }
    energyConsumption += getBuildingEnergyCost(buildingId, count);
  }

  const hasEnergy = energyProduction >= energyConsumption;

  // Apply offline production for each building
  for (const [buildingId, buildingState] of Object.entries(updatedState.buildings)) {
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

    // Handle Trading Post - needs minerals
    if (buildingId === 'tradingPost') {
      const mineralsAvailable = updatedState.resources.minerals;
      const consumptionRate = consumption.minerals || 1;
      const actualSeconds = Math.min(seconds, mineralsAvailable / consumptionRate);

      if (actualSeconds > 0) {
        updatedState.resources.minerals -= (consumption.minerals || 0) * actualSeconds;
        const moneyGained = (production.money || 0) * actualSeconds;
        updatedState.resources.money += moneyGained;
        updatedState.stats.totalMoneyGathered =
          (updatedState.stats.totalMoneyGathered || 0) + moneyGained;
      }
      continue;
    }

    // Normal production
    for (const [resource, rate] of Object.entries(production)) {
      if (resource !== 'energy') {
        const gained = rate * seconds;
        updatedState.resources[resource] = (updatedState.resources[resource] || 0) + gained;

        // Track totals
        if (resource === 'minerals') {
          updatedState.stats.totalMineralsGathered += gained;
        } else if (resource === 'science') {
          updatedState.stats.totalScienceGathered =
            (updatedState.stats.totalScienceGathered || 0) + gained;
        }
      }
    }
  }

  // Update research progress
  for (const research of updatedState.research.activeResearches) {
    research.progress += seconds;
    if (research.progress >= research.totalTime) {
      research.progress = research.totalTime; // Cap at completion
    }
  }

  // Complete any finished researches
  const completedIndices = [];
  for (let i = 0; i < updatedState.research.activeResearches.length; i++) {
    const research = updatedState.research.activeResearches[i];
    if (research.progress >= research.totalTime) {
      completedIndices.push(i);
      const currentLevel = updatedState.research.completed[research.id] || 0;
      updatedState.research.completed[research.id] = currentLevel + 1;
    }
  }

  // Remove completed researches
  for (let i = completedIndices.length - 1; i >= 0; i--) {
    updatedState.research.activeResearches.splice(completedIndices[i], 1);
  }

  // Add playtime
  updatedState.stats.playTime += seconds;

  // Store net energy for display
  updatedState.resources.energy = energyProduction - energyConsumption;

  Logger.log(`Calculated offline progress for ${seconds} seconds`);

  return updatedState;
}

/**
 * GameStateManager class for managing game state with auto-save
 */
export class GameStateManager {
  constructor() {
    this.state = null;
    this.autoSaveInterval = null;
    this.listeners = new Set();
    this.initialized = false;
  }

  /**
   * Initialize the state manager
   * @returns {Promise<Object>} Initial game state
   */
  async init() {
    if (this.initialized) return this.state;

    // Try to load saved state
    const savedState = await loadGameState();

    if (savedState) {
      // Calculate offline progress
      const offlineSeconds = Math.floor((Date.now() - savedState.lastSaved) / 1000);
      this.state = calculateOfflineProgress(savedState, offlineSeconds);
      Logger.log('Loaded saved game state');
    } else {
      this.state = createGameState();
      Logger.log('Created new game state');
    }

    // Setup auto-save
    this.startAutoSave();

    // Save on page hide/close
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.save();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.save();
    });

    this.initialized = true;
    return this.state;
  }

  /**
   * Get current state
   * @returns {Object} Current game state
   */
  getState() {
    return this.state;
  }

  /**
   * Update state and notify listeners
   * @param {Object} newState - New state (partial or full)
   */
  updateState(newState) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  /**
   * Add a state change listener
   * @param {Function} listener - Callback function
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove a state change listener
   * @param {Function} listener - Callback function
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        Logger.error('Error in state listener:', error);
      }
    }
  }

  /**
   * Save current state to IndexedDB
   * @returns {Promise<void>}
   */
  async save() {
    if (this.state) {
      await saveGameState(this.state);
    }
  }

  /**
   * Start auto-save interval
   */
  startAutoSave() {
    if (this.autoSaveInterval) return;

    this.autoSaveInterval = setInterval(() => {
      this.save();
    }, AUTO_SAVE_INTERVAL);
  }

  /**
   * Stop auto-save interval
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Reset game to initial state
   * @returns {Promise<Object>} Fresh game state
   */
  async reset() {
    await deleteGameState();
    this.state = createGameState();
    this.notifyListeners();
    return this.state;
  }
}

/**
 * Singleton instance of GameStateManager
 */
export const gameStateManager = new GameStateManager();
