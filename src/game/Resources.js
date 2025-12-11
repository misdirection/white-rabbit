/**
 * @file Resources.js
 * @description Resource definitions and calculations for the idle game.
 *
 * Resources:
 * - Minerals: Raw materials gathered by clicking or from mines
 * - Money: Currency earned through trading
 * - Energy: Power for buildings (net production minus consumption)
 * - Science: Research points for unlocking technologies
 * - Spaceship Parts: Manufactured by factories, needed for spaceship
 */

/**
 * Resource type definitions with metadata
 */
export const RESOURCES = {
  minerals: {
    id: 'minerals',
    name: 'Minerals',
    icon: '\u26CF', // Pick icon
    description: 'Raw materials gathered by clicking or from mines',
    color: '#a0522d',
  },
  money: {
    id: 'money',
    name: 'Money',
    icon: '$',
    description: 'Currency earned through trading',
    color: '#ffd700',
  },
  energy: {
    id: 'energy',
    name: 'Energy',
    icon: '\u26A1', // Lightning bolt
    description: 'Power for buildings',
    color: '#00bfff',
  },
  science: {
    id: 'science',
    name: 'Science',
    icon: '\u269B', // Atom symbol
    description: 'Research points for unlocking technologies',
    color: '#9370db',
  },
  spaceshipParts: {
    id: 'spaceshipParts',
    name: 'Spaceship Parts',
    icon: '\uD83D\uDE80', // Rocket
    description: 'Manufactured by factories, needed for spaceship',
    color: '#708090',
  },
};

/**
 * Initial resource amounts
 */
export const INITIAL_RESOURCES = {
  minerals: 0,
  money: 0,
  energy: 0,
  science: 0,
  spaceshipParts: 0,
};

/**
 * Spaceship requirements for Phase 1 win condition
 */
export const SPACESHIP_COST = {
  minerals: 1000,
  money: 500,
  science: 100,
  spaceshipParts: 50,
};

/**
 * Creates a new resources object with initial values
 * @returns {Object} Fresh resources object
 */
export function createResources() {
  return { ...INITIAL_RESOURCES };
}

/**
 * Checks if the player can afford a cost
 * @param {Object} resources - Current resources
 * @param {Object} cost - Cost object {resource: amount}
 * @returns {boolean} True if affordable
 */
export function canAfford(resources, cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    if ((resources[resource] || 0) < amount) {
      return false;
    }
  }
  return true;
}

/**
 * Subtracts cost from resources (mutates in place)
 * @param {Object} resources - Current resources
 * @param {Object} cost - Cost object {resource: amount}
 * @returns {boolean} True if successful
 */
export function spendResources(resources, cost) {
  if (!canAfford(resources, cost)) {
    return false;
  }
  for (const [resource, amount] of Object.entries(cost)) {
    resources[resource] -= amount;
  }
  return true;
}

/**
 * Adds resources (mutates in place)
 * @param {Object} resources - Current resources
 * @param {Object} amounts - Amounts to add {resource: amount}
 */
export function addResources(resources, amounts) {
  for (const [resource, amount] of Object.entries(amounts)) {
    resources[resource] = (resources[resource] || 0) + amount;
  }
}

/**
 * Checks if spaceship can be built
 * @param {Object} resources - Current resources
 * @returns {boolean} True if spaceship can be built
 */
export function canBuildSpaceship(resources) {
  return canAfford(resources, SPACESHIP_COST);
}

/**
 * Calculates progress towards spaceship (0-100%)
 * @param {Object} resources - Current resources
 * @returns {number} Progress percentage
 */
export function getSpaceshipProgress(resources) {
  let total = 0;
  let count = 0;
  for (const [resource, required] of Object.entries(SPACESHIP_COST)) {
    const current = resources[resource] || 0;
    const progress = Math.min(current / required, 1);
    total += progress;
    count++;
  }
  return (total / count) * 100;
}

/**
 * Formats a resource value for display
 * @param {number} value - Resource value
 * @param {number} decimals - Max decimal places
 * @returns {string} Formatted string
 */
export function formatResource(value, decimals = 0) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  if (Number.isInteger(value) || decimals === 0) {
    return Math.floor(value).toString();
  }
  return value.toFixed(decimals);
}

/**
 * Formats a rate value for display (per second)
 * @param {number} rate - Rate per second
 * @returns {string} Formatted string with +/- prefix
 */
export function formatRate(rate) {
  const prefix = rate >= 0 ? '+' : '';
  return `${prefix}${formatResource(rate, 1)}/s`;
}
