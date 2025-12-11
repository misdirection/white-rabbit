/**
 * @file Research.js
 * @description Research tree, scientists, and technology unlocks for the idle game.
 *
 * Features:
 * - Research tree with levelable technologies
 * - Scientists that speed up research
 * - Parallel research based on Research Centers
 * - Research bonuses affect building production
 */

/**
 * Research definitions with scaling costs and bonuses
 */
export const RESEARCH = {
  efficientMining: {
    id: 'efficientMining',
    name: 'Efficient Mining',
    description: '+10% Mine production per level',
    baseCost: 10, // Science
    baseTime: 30, // seconds
    bonusPerLevel: 0.1, // +10%
    bonusType: 'production',
    affectedBuilding: 'mine',
    unlockCondition: null, // Available from start
  },
  solarEfficiency: {
    id: 'solarEfficiency',
    name: 'Solar Efficiency',
    description: '+15% Solar Panel output per level',
    baseCost: 15,
    baseTime: 45,
    bonusPerLevel: 0.15, // +15%
    bonusType: 'production',
    affectedBuilding: 'solarPanel',
    unlockCondition: null,
  },
  advancedTrading: {
    id: 'advancedTrading',
    name: 'Advanced Trading',
    description: '+10% Money from trades per level',
    baseCost: 20,
    baseTime: 60,
    bonusPerLevel: 0.1, // +10%
    bonusType: 'production',
    affectedBuilding: 'tradingPost',
    unlockCondition: null,
  },
  factoryAutomation: {
    id: 'factoryAutomation',
    name: 'Factory Automation',
    description: '+20% Spaceship Parts production per level',
    baseCost: 25,
    baseTime: 90,
    bonusPerLevel: 0.2, // +20%
    bonusType: 'production',
    affectedBuilding: 'factory',
    unlockCondition: { building: 'factory', count: 1 },
  },
  efficientResearching: {
    id: 'efficientResearching',
    name: 'Efficient Researching',
    description: '+10% Science production per level',
    baseCost: 20,
    baseTime: 60,
    bonusPerLevel: 0.1, // +10%
    bonusType: 'production',
    affectedBuilding: 'researchCenter',
    unlockCondition: null,
  },
  scientificMethod: {
    id: 'scientificMethod',
    name: 'Scientific Method',
    description: '-10% research time per level (all researches)',
    baseCost: 30,
    baseTime: 120,
    bonusPerLevel: 0.1, // -10% time
    bonusType: 'researchSpeed',
    affectedBuilding: null, // Global effect
    unlockCondition: null,
  },
};

/**
 * Scientist hiring cost scaling
 */
export const SCIENTIST_BASE_COST = 50; // Money
export const SCIENTIST_COST_SCALE = 1.5;

/**
 * Calculates the cost to hire the next scientist
 * @param {number} currentScientists - Number of scientists already hired
 * @returns {number} Cost in money
 */
export function getScientistHireCost(currentScientists) {
  return Math.ceil(SCIENTIST_BASE_COST * SCIENTIST_COST_SCALE ** currentScientists);
}

/**
 * Calculates the science cost for a research level
 * Cost per level: baseCost * (level ^ 1.5)
 * @param {string} researchId - Research type ID
 * @param {number} level - Target level (1-based)
 * @returns {number} Science cost
 */
export function getResearchCost(researchId, level) {
  const research = RESEARCH[researchId];
  if (!research) return 0;
  return Math.ceil(research.baseCost * level ** 1.5);
}

/**
 * Calculates the base time for a research level
 * Time per level: baseTime * (level ^ 1.2)
 * @param {string} researchId - Research type ID
 * @param {number} level - Target level (1-based)
 * @returns {number} Base time in seconds
 */
export function getResearchBaseTime(researchId, level) {
  const research = RESEARCH[researchId];
  if (!research) return 0;
  return Math.ceil(research.baseTime * level ** 1.2);
}

/**
 * Calculates actual research time with scientist and research speed bonuses
 * Formula: baseTime / (1 + (scientists * 0.5)) * (1 - scientificMethodBonus)
 * @param {number} baseTime - Base time in seconds
 * @param {number} scientists - Number of scientists working on this research
 * @param {number} scientificMethodLevel - Level of Scientific Method research
 * @returns {number} Actual time in seconds
 */
export function getActualResearchTime(baseTime, scientists, scientificMethodLevel = 0) {
  const scientistMultiplier = 1 + scientists * 0.5;
  const speedBonus = 1 - scientificMethodLevel * 0.1;
  return Math.max(1, Math.ceil((baseTime / scientistMultiplier) * speedBonus));
}

/**
 * Calculates the cumulative bonus for a research at a given level
 * Bonuses are multiplicative: (1 + bonus)^level
 * @param {string} researchId - Research type ID
 * @param {number} level - Current level
 * @returns {number} Multiplier (e.g., 1.331 for level 3 at 10% per level)
 */
export function getResearchBonus(researchId, level) {
  const research = RESEARCH[researchId];
  if (!research || level === 0) return 1;
  return (1 + research.bonusPerLevel) ** level;
}

/**
 * Gets all production bonuses for buildings from completed research
 * @param {Object} completedResearch - {researchId: level}
 * @returns {Object} {buildingId: multiplier}
 */
export function getAllProductionBonuses(completedResearch) {
  const bonuses = {};

  for (const [researchId, level] of Object.entries(completedResearch)) {
    const research = RESEARCH[researchId];
    if (!research || research.bonusType !== 'production' || !research.affectedBuilding) continue;

    const multiplier = getResearchBonus(researchId, level);
    bonuses[research.affectedBuilding] = (bonuses[research.affectedBuilding] || 1) * multiplier;
  }

  return bonuses;
}

/**
 * Checks if a research is unlocked
 * @param {string} researchId - Research type ID
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if unlocked
 */
export function isResearchUnlocked(researchId, gameState) {
  const research = RESEARCH[researchId];
  if (!research) return false;

  const condition = research.unlockCondition;
  if (!condition) return true;

  // Check building requirement
  if (condition.building) {
    const required = condition.count || 1;
    const owned = gameState.buildings[condition.building]?.count || 0;
    if (owned < required) return false;
  }

  return true;
}

/**
 * Distributes scientists across active researches
 * @param {number} totalScientists - Total hired scientists
 * @param {number} activeResearchCount - Number of active researches
 * @returns {number} Scientists per research
 */
export function distributeScientists(totalScientists, activeResearchCount) {
  if (activeResearchCount === 0) return 0;
  return Math.floor(totalScientists / activeResearchCount);
}

/**
 * Creates initial research state
 * @returns {Object} Research state object
 */
export function createResearchState() {
  return {
    scientists: 0,
    activeResearches: [],
    completed: {
      efficientMining: 0,
      solarEfficiency: 0,
      advancedTrading: 0,
      factoryAutomation: 0,
      efficientResearching: 0,
      scientificMethod: 0,
    },
  };
}
