/**
 * @file Buildings.js
 * @description Building definitions, costs, and production logic for the idle game.
 *
 * All building costs scale with the number owned: baseCost * (1.15 ^ owned)
 * Buildings can be sold at any time with no refund.
 */

/**
 * Building definitions with base costs and production rates
 */
export const BUILDINGS = {
  mine: {
    id: 'mine',
    name: 'Mine',
    description: 'Extracts minerals from the earth',
    baseCost: { minerals: 10 },
    production: { minerals: 1 }, // per second
    energyCost: 0,
    unlockCondition: null, // Available from start
  },
  tradingPost: {
    id: 'tradingPost',
    name: 'Trading Post',
    description: 'Converts minerals into money',
    baseCost: { minerals: 50 },
    production: { money: 1 }, // per second
    consumption: { minerals: 2 }, // per second
    energyCost: 0,
    unlockCondition: null, // Available from start
  },
  solarPanel: {
    id: 'solarPanel',
    name: 'Solar Panel',
    description: 'Generates clean energy',
    baseCost: { minerals: 25, money: 10 },
    production: { energy: 2 }, // per second
    energyCost: 0, // Produces energy, doesn't consume
    unlockCondition: null, // Available from start
  },
  researchCenter: {
    id: 'researchCenter',
    name: 'Research Center',
    description: 'Conducts scientific research',
    baseCost: { minerals: 100, money: 50 },
    production: { science: 0.5 }, // per second
    energyCost: 3, // per second
    unlockCondition: { building: 'solarPanel', count: 1 },
    special: {
      maxScientistsPerCenter: 2,
      parallelResearchSlots: 1,
    },
  },
  factory: {
    id: 'factory',
    name: 'Factory',
    description: 'Manufactures spaceship parts',
    baseCost: { minerals: 200, money: 100, science: 10 },
    production: { spaceshipParts: 0.1 }, // 1 per 10 seconds
    energyCost: 5, // per second
    unlockCondition: { totalResource: 'science', amount: 50 }, // Unlocks when 50 science ever reached
  },
};

/**
 * Cost scaling factor per building owned
 */
export const COST_SCALE_FACTOR = 1.15;

/**
 * Calculates the cost of the next building purchase
 * @param {string} buildingId - Building type ID
 * @param {number} owned - Number already owned
 * @returns {Object} Cost object {resource: amount}
 */
export function getBuildingCost(buildingId, owned) {
  const building = BUILDINGS[buildingId];
  if (!building) return null;

  const cost = {};
  const multiplier = COST_SCALE_FACTOR ** owned;

  for (const [resource, baseCost] of Object.entries(building.baseCost)) {
    cost[resource] = Math.ceil(baseCost * multiplier);
  }

  return cost;
}

/**
 * Calculates the total production of all buildings of a type
 * @param {string} buildingId - Building type ID
 * @param {number} count - Number of buildings
 * @param {Object} bonuses - Production bonuses from research {buildingId: multiplier}
 * @returns {Object} Production rates {resource: amount/sec}
 */
export function getBuildingProduction(buildingId, count, bonuses = {}) {
  const building = BUILDINGS[buildingId];
  if (!building || count === 0) return {};

  const production = {};
  const bonus = bonuses[buildingId] || 1;

  if (building.production) {
    for (const [resource, rate] of Object.entries(building.production)) {
      production[resource] = rate * count * bonus;
    }
  }

  return production;
}

/**
 * Calculates the total consumption of a building type
 * @param {string} buildingId - Building type ID
 * @param {number} count - Number of buildings
 * @returns {Object} Consumption rates {resource: amount/sec}
 */
export function getBuildingConsumption(buildingId, count) {
  const building = BUILDINGS[buildingId];
  if (!building || count === 0) return {};

  const consumption = {};

  if (building.consumption) {
    for (const [resource, rate] of Object.entries(building.consumption)) {
      consumption[resource] = rate * count;
    }
  }

  return consumption;
}

/**
 * Calculates the total energy cost of a building type
 * @param {string} buildingId - Building type ID
 * @param {number} count - Number of buildings
 * @returns {number} Total energy cost per second
 */
export function getBuildingEnergyCost(buildingId, count) {
  const building = BUILDINGS[buildingId];
  if (!building || count === 0) return 0;
  return (building.energyCost || 0) * count;
}

/**
 * Checks if a building type is unlocked
 * @param {string} buildingId - Building type ID
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if unlocked
 */
export function isBuildingUnlocked(buildingId, gameState) {
  const building = BUILDINGS[buildingId];
  if (!building) return false;

  const condition = building.unlockCondition;
  if (!condition) return true;

  // Check building requirement
  if (condition.building) {
    const required = condition.count || 1;
    const owned = gameState.buildings[condition.building]?.count || 0;
    if (owned < required) return false;
  }

  // Check current resource requirement
  if (condition.resource) {
    const current = gameState.resources[condition.resource] || 0;
    if (current < condition.amount) return false;
  }

  // Check total resource ever gathered (for factory unlock)
  if (condition.totalResource) {
    const total = gameState.stats[`total${capitalize(condition.totalResource)}Gathered`] || 0;
    // Also check current resources as fallback
    const current = gameState.resources[condition.totalResource] || 0;
    if (total < condition.amount && current < condition.amount) return false;
  }

  return true;
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Gets max scientists allowed based on research centers
 * @param {number} researchCenterCount - Number of research centers
 * @returns {number} Maximum scientists
 */
export function getMaxScientists(researchCenterCount) {
  return researchCenterCount * BUILDINGS.researchCenter.special.maxScientistsPerCenter;
}

/**
 * Gets number of parallel research slots
 * @param {number} researchCenterCount - Number of research centers
 * @returns {number} Number of slots
 */
export function getResearchSlots(researchCenterCount) {
  return researchCenterCount * BUILDINGS.researchCenter.special.parallelResearchSlots;
}

/**
 * Creates initial buildings state
 * @returns {Object} Buildings state object
 */
export function createBuildingsState() {
  const buildings = {};
  for (const id of Object.keys(BUILDINGS)) {
    buildings[id] = { count: 0 };
  }
  return buildings;
}
