/**
 * @file idleGame.js
 * @description UI panel and controls for the Space Colony Builder idle game.
 *
 * Opens when clicking on Earth. Provides interface for:
 * - Resource display
 * - Manual mineral gathering
 * - Building purchase/sale
 * - Research management
 * - Spaceship progress tracking
 */

import { windowManager } from '../WindowManager.js';
import { gameStateManager } from '../../game/GameState.js';
import {
  gameLoop,
  gatherMinerals,
  purchaseBuilding,
  sellBuilding,
  hireScientist,
  startResearch,
  cancelResearch,
  buildSpaceship,
  getProductionRates,
} from '../../game/GameLoop.js';
import {
  RESOURCES,
  formatResource,
  formatRate,
  getSpaceshipProgress,
  SPACESHIP_COST,
  canBuildSpaceship,
  canAfford,
} from '../../game/Resources.js';
import {
  BUILDINGS,
  getBuildingCost,
  isBuildingUnlocked,
  getMaxScientists,
  getResearchSlots,
} from '../../game/Buildings.js';
import {
  RESEARCH,
  getResearchCost,
  getResearchBaseTime,
  getScientistHireCost,
  isResearchUnlocked,
  getActualResearchTime,
  distributeScientists,
} from '../../game/Research.js';
import { isResearchTabUnlocked } from '../../game/Unlocks.js';

let gameWindow = null;
let currentTab = 'buildings';
let initialized = false;
let needsFullRender = true;
let lastActiveResearchCount = 0;

/**
 * Initialize the idle game UI
 */
export async function initIdleGame() {
  if (initialized) return;

  // Initialize game state
  await gameStateManager.init();

  // Start game loop
  gameLoop.start();

  // Create the game window
  createGameWindow();

  // Add state listener to update UI
  gameStateManager.addListener(updateGameUI);

  initialized = true;
}

/**
 * Create the game window using WindowManager
 */
function createGameWindow() {
  gameWindow = windowManager.createWindow('idle-game', 'Earth Colony', {
    x: 50,
    y: 50,
    width: '400px',
    onClose: () => {
      // Window closed, game continues in background
    },
  });

  // Add idle-game class for specific styling
  gameWindow.element.classList.add('idle-game-window');

  // Initial render
  needsFullRender = true;
  renderGameUI();

  // Start hidden
  windowManager.hideWindow('idle-game');
}

/**
 * Show the game window
 */
export function showIdleGame() {
  if (!initialized) {
    initIdleGame().then(() => {
      windowManager.showWindow('idle-game');
      needsFullRender = true;
      renderGameUI();
    });
  } else {
    windowManager.showWindow('idle-game');
    needsFullRender = true;
    renderGameUI();
  }
}

/**
 * Hide the game window
 */
export function hideIdleGame() {
  windowManager.hideWindow('idle-game');
}

/**
 * Toggle the game window visibility
 */
export function toggleIdleGame() {
  if (!initialized) {
    initIdleGame().then(() => {
      windowManager.showWindow('idle-game');
      needsFullRender = true;
      renderGameUI();
    });
  } else {
    windowManager.toggleWindow('idle-game');
    if (gameWindow.element.style.display !== 'none') {
      needsFullRender = true;
      renderGameUI();
    }
  }
}

/**
 * Request a full re-render on next update
 */
function requestFullRender() {
  needsFullRender = true;
  renderGameUI();
}

/**
 * Main render function - does full render or incremental update
 */
function renderGameUI() {
  if (!gameWindow) return;

  const state = gameStateManager.getState();
  if (!state) return;

  if (needsFullRender) {
    fullRender(state);
    needsFullRender = false;
  } else {
    incrementalUpdate(state);
  }
}

/**
 * Full render of the entire UI
 */
function fullRender(state) {
  const rates = getProductionRates();
  const hasResearch = isResearchTabUnlocked(state);

  // Track active research count to detect completions
  lastActiveResearchCount = state.research.activeResearches.length;

  const html = `
    <div class="idle-game-container">
      ${renderResourceBar(state, rates)}
      ${renderTabs(hasResearch)}
      <div class="idle-game-content">
        ${currentTab === 'buildings' ? renderBuildingsTab(state) : ''}
        ${currentTab === 'research' ? renderResearchTab(state) : ''}
      </div>
      ${renderSpaceshipProgress(state)}
      ${renderFooter(state)}
    </div>
  `;

  gameWindow.content.innerHTML = html;
  attachEventListeners();
}

/**
 * Incremental update - only update values, not structure
 */
function incrementalUpdate(state) {
  const rates = getProductionRates();
  const content = gameWindow.content;

  // Check if active research count changed (research completed or started)
  const currentActiveCount = state.research.activeResearches.length;
  if (currentActiveCount !== lastActiveResearchCount) {
    lastActiveResearchCount = currentActiveCount;
    needsFullRender = true;
    fullRender(state);
    return;
  }

  // Update resource values
  updateElementText(
    content,
    '[data-resource="minerals"] .resource-value',
    formatResource(state.resources.minerals)
  );
  updateElementText(
    content,
    '[data-resource="minerals"] .resource-rate',
    formatRate(rates.minerals)
  );
  updateElementText(
    content,
    '[data-resource="money"] .resource-value',
    formatResource(state.resources.money)
  );
  updateElementText(content, '[data-resource="money"] .resource-rate', formatRate(rates.money));
  updateElementText(content, '[data-resource="energy"] .resource-value', formatRate(rates.energy));
  updateElementText(
    content,
    '[data-resource="science"] .resource-value',
    formatResource(state.resources.science, 1)
  );
  updateElementText(content, '[data-resource="science"] .resource-rate', formatRate(rates.science));
  updateElementText(
    content,
    '[data-resource="spaceshipParts"] .resource-value',
    formatResource(state.resources.spaceshipParts, 1)
  );
  updateElementText(
    content,
    '[data-resource="spaceshipParts"] .resource-rate',
    formatRate(rates.spaceshipParts)
  );

  // Update energy class for negative
  const energyEl = content.querySelector('[data-resource="energy"]');
  if (energyEl) {
    energyEl.classList.toggle('negative', rates.energy < 0);
  }

  // Update building counts and costs
  for (const buildingId of Object.keys(BUILDINGS)) {
    const owned = state.buildings[buildingId]?.count || 0;
    const cost = getBuildingCost(buildingId, owned);
    const affordable = canAfford(state.resources, cost);

    updateElementText(content, `[data-building="${buildingId}"] .building-count`, `(${owned})`);

    const buyBtn = content.querySelector(`[data-building="${buildingId}"].building-buy-btn`);
    if (buyBtn) {
      buyBtn.textContent = formatCost(cost);
      buyBtn.disabled = !affordable;
      buyBtn.classList.toggle('disabled', !affordable);
    }

    // Show/hide sell button
    const sellBtn = content.querySelector(`[data-building="${buildingId}"].building-sell-btn`);
    if (sellBtn) {
      sellBtn.style.display = owned > 0 ? '' : 'none';
    }
  }

  // Update spaceship progress
  const progress = getSpaceshipProgress(state.resources);
  updateElementText(content, '.spaceship-percent', `${progress.toFixed(0)}%`);
  const progressFill = content.querySelector('.spaceship-progress-fill');
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }

  // Update spaceship resource details
  for (const [resource, required] of Object.entries(SPACESHIP_COST)) {
    const current = state.resources[resource] || 0;
    const el = content.querySelector(`[data-spaceship-resource="${resource}"]`);
    if (el) {
      el.textContent = `${RESOURCES[resource].icon} ${formatResource(current)}/${required}`;
      el.classList.toggle('complete', current >= required);
    }
  }

  // Update footer stats
  updateElementText(content, '.stat-clicks', `Clicks: ${state.stats.totalClicks}`);
  updateElementText(content, '.stat-time', `Time: ${formatPlayTime(state.stats.playTime)}`);

  // Update research progress bars if on research tab
  if (currentTab === 'research') {
    updateResearchProgress(content, state);
  }

  // Show/hide launch button
  const canLaunch = canBuildSpaceship(state.resources);
  const launchBtn = content.querySelector('#launch-btn');
  if (launchBtn) {
    launchBtn.style.display = canLaunch ? '' : 'none';
  } else if (canLaunch) {
    // Need full render to add the button
    needsFullRender = true;
  }
}

/**
 * Helper to update text content of an element
 */
function updateElementText(container, selector, text) {
  const el = container.querySelector(selector);
  if (el && el.textContent !== text) {
    el.textContent = text;
  }
}

/**
 * Update research progress bars
 */
function updateResearchProgress(content, state) {
  const scientists = state.research.scientists;
  const maxScientists = getMaxScientists(state.buildings.researchCenter?.count || 0);
  const slots = getResearchSlots(state.buildings.researchCenter?.count || 0);
  const usedSlots = state.research.activeResearches.length;

  updateElementText(content, '.scientists-count', `Scientists: ${scientists}/${maxScientists}`);
  updateElementText(content, '.slots-info', `Research Slots: ${usedSlots}/${slots}`);

  // Update hire button
  const hireCost = getScientistHireCost(scientists);
  const canHire = scientists < maxScientists && canAfford(state.resources, { money: hireCost });
  const hireBtn = content.querySelector('#hire-scientist-btn');
  if (hireBtn) {
    hireBtn.textContent = `Hire (+$${formatResource(hireCost)})`;
    hireBtn.disabled = !canHire;
    hireBtn.classList.toggle('disabled', !canHire);
  }

  // Update active research progress
  for (const research of state.research.activeResearches) {
    const progress = (research.progress / research.totalTime) * 100;
    const remaining = Math.ceil(research.totalTime - research.progress);

    const progressFill = content.querySelector(`[data-research-progress="${research.id}"]`);
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    updateElementText(content, `[data-research-time="${research.id}"]`, `${remaining}s left`);
  }
}

/**
 * Render the resource bar
 */
function renderResourceBar(state, rates) {
  const resources = state.resources;

  return `
    <div class="idle-resource-bar">
      <div class="idle-resource" data-resource="minerals" title="${RESOURCES.minerals.description}">
        <span class="resource-icon">${RESOURCES.minerals.icon}</span>
        <span class="resource-value">${formatResource(resources.minerals)}</span>
        <span class="resource-rate">${formatRate(rates.minerals)}</span>
      </div>
      <div class="idle-resource" data-resource="money" title="${RESOURCES.money.description}">
        <span class="resource-icon">${RESOURCES.money.icon}</span>
        <span class="resource-value">${formatResource(resources.money)}</span>
        <span class="resource-rate">${formatRate(rates.money)}</span>
      </div>
      <div class="idle-resource ${rates.energy < 0 ? 'negative' : ''}" data-resource="energy" title="${RESOURCES.energy.description}">
        <span class="resource-icon">${RESOURCES.energy.icon}</span>
        <span class="resource-value">${formatRate(rates.energy)}</span>
      </div>
      <div class="idle-resource" data-resource="science" title="${RESOURCES.science.description}">
        <span class="resource-icon">${RESOURCES.science.icon}</span>
        <span class="resource-value">${formatResource(resources.science, 1)}</span>
        <span class="resource-rate">${formatRate(rates.science)}</span>
      </div>
      <div class="idle-resource" data-resource="spaceshipParts" title="${RESOURCES.spaceshipParts.description}">
        <span class="resource-icon">${RESOURCES.spaceshipParts.icon}</span>
        <span class="resource-value">${formatResource(resources.spaceshipParts, 1)}</span>
        <span class="resource-rate">${formatRate(rates.spaceshipParts)}</span>
      </div>
    </div>
  `;
}

/**
 * Render tab navigation
 */
function renderTabs(hasResearch) {
  return `
    <div class="idle-tabs">
      <button class="idle-tab ${currentTab === 'buildings' ? 'active' : ''}" data-tab="buildings">
        Buildings
      </button>
      ${
        hasResearch
          ? `
        <button class="idle-tab ${currentTab === 'research' ? 'active' : ''}" data-tab="research">
          Research
        </button>
      `
          : ''
      }
    </div>
  `;
}

/**
 * Render the buildings tab
 */
function renderBuildingsTab(state) {
  return `
    <div class="idle-buildings-tab">
      <div class="idle-gather-section">
        <button class="idle-gather-btn" id="gather-btn">
          <span class="gather-icon">${RESOURCES.minerals.icon}</span>
          <span class="gather-text">GATHER MINERALS</span>
          <span class="gather-amount">+1</span>
        </button>
      </div>
      <div class="idle-buildings-list">
        ${renderBuildingsList(state)}
      </div>
    </div>
  `;
}

/**
 * Render the list of buildings
 */
function renderBuildingsList(state) {
  let html = '';

  for (const [buildingId, building] of Object.entries(BUILDINGS)) {
    const owned = state.buildings[buildingId]?.count || 0;
    const unlocked = isBuildingUnlocked(buildingId, state);
    const cost = getBuildingCost(buildingId, owned);
    const affordable = canAfford(state.resources, cost);

    if (!unlocked) {
      html += `
        <div class="idle-building locked">
          <div class="building-header">
            <span class="building-name">${building.name}</span>
            <span class="building-locked-icon">🔒</span>
          </div>
          <div class="building-info">
            <span class="building-unlock">${getUnlockText(building)}</span>
          </div>
        </div>
      `;
    } else {
      const rates = getBuildingRatesText(buildingId, owned);

      html += `
        <div class="idle-building" data-building="${buildingId}">
          <div class="building-header">
            <span class="building-name">${building.name}</span>
            <span class="building-count">(${owned})</span>
          </div>
          <div class="building-info">
            <span class="building-rates">${rates}</span>
          </div>
          <div class="building-actions">
            <button class="building-buy-btn ${affordable ? '' : 'disabled'}" 
                    data-building="${buildingId}" 
                    ${affordable ? '' : 'disabled'}>
              ${formatCost(cost)}
            </button>
            <button class="building-sell-btn" data-building="${buildingId}" 
                    style="${owned > 0 ? '' : 'display:none'}">
              Sell
            </button>
          </div>
        </div>
      `;
    }
  }

  return html;
}

/**
 * Get unlock requirement text for a building
 */
function getUnlockText(building) {
  const condition = building.unlockCondition;
  if (!condition) return 'Available';

  if (condition.building) {
    const reqBuilding = BUILDINGS[condition.building];
    return `Requires ${condition.count || 1} ${reqBuilding.name}`;
  }

  if (condition.resource) {
    const reqResource = RESOURCES[condition.resource];
    return `Requires ${condition.amount} ${reqResource.name}`;
  }

  if (condition.totalResource) {
    const reqResource = RESOURCES[condition.totalResource];
    return `Requires ${condition.amount} ${reqResource.name} (total)`;
  }

  return 'Locked';
}

/**
 * Get production rates text for a building
 * Shows total if count > 0, or per-building rate if count is 0
 */
function getBuildingRatesText(buildingId, count) {
  const building = BUILDINGS[buildingId];
  const parts = [];
  const multiplier = count > 0 ? count : 1;
  const suffix = count > 0 ? '' : ' each';

  if (building.production) {
    for (const [resource, rate] of Object.entries(building.production)) {
      parts.push(`+${rate * multiplier} ${RESOURCES[resource].icon}/s${suffix}`);
    }
  }

  if (building.consumption) {
    for (const [resource, rate] of Object.entries(building.consumption)) {
      parts.push(`-${rate * multiplier} ${RESOURCES[resource].icon}/s${suffix}`);
    }
  }

  if (building.energyCost > 0) {
    parts.push(`-${building.energyCost * multiplier} ${RESOURCES.energy.icon}/s${suffix}`);
  }

  return parts.join(' | ') || 'No production';
}

/**
 * Format a cost object for display
 */
function formatCost(cost) {
  const parts = [];
  for (const [resource, amount] of Object.entries(cost)) {
    const res = RESOURCES[resource];
    parts.push(`${formatResource(amount)} ${res?.icon || resource}`);
  }
  return parts.join(', ');
}

/**
 * Render the research tab
 */
function renderResearchTab(state) {
  const scientists = state.research.scientists;
  const maxScientists = getMaxScientists(state.buildings.researchCenter?.count || 0);
  const slots = getResearchSlots(state.buildings.researchCenter?.count || 0);
  const usedSlots = state.research.activeResearches.length;
  const hireCost = getScientistHireCost(scientists);
  const canHire = scientists < maxScientists && canAfford(state.resources, { money: hireCost });

  return `
    <div class="idle-research-tab">
      <div class="idle-research-header">
        <div class="scientists-info">
          <span class="scientists-count">Scientists: ${scientists}/${maxScientists}</span>
          <button class="hire-btn ${canHire ? '' : 'disabled'}" 
                  id="hire-scientist-btn"
                  ${canHire ? '' : 'disabled'}>
            Hire (+$${formatResource(hireCost)})
          </button>
        </div>
        <div class="slots-info">
          Research Slots: ${usedSlots}/${slots}
        </div>
      </div>
      
      ${renderActiveResearches(state)}
      ${renderAvailableResearches(state)}
    </div>
  `;
}

/**
 * Render active researches
 */
function renderActiveResearches(state) {
  const active = state.research.activeResearches;

  if (active.length === 0) {
    return `
      <div class="idle-research-section">
        <div class="research-section-title">Active Research</div>
        <div class="no-research">No active research</div>
      </div>
    `;
  }

  let html = `
    <div class="idle-research-section">
      <div class="research-section-title">Active Research</div>
  `;

  for (const research of active) {
    const def = RESEARCH[research.id];
    const progress = (research.progress / research.totalTime) * 100;
    const remaining = Math.ceil(research.totalTime - research.progress);

    html += `
      <div class="research-item active">
        <div class="research-header">
          <span class="research-name">${def.name} Lv.${research.level}</span>
          <span class="research-time" data-research-time="${research.id}">${remaining}s left</span>
        </div>
        <div class="research-progress-bar">
          <div class="research-progress-fill" data-research-progress="${research.id}" style="width: ${progress}%"></div>
        </div>
        <button class="research-cancel-btn" data-research="${research.id}">Cancel</button>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

/**
 * Render available researches
 */
function renderAvailableResearches(state) {
  const slots = getResearchSlots(state.buildings.researchCenter?.count || 0);
  const usedSlots = state.research.activeResearches.length;
  const hasSlot = usedSlots < slots;

  let html = `
    <div class="idle-research-section">
      <div class="research-section-title">Available Research</div>
  `;

  for (const [researchId, research] of Object.entries(RESEARCH)) {
    const unlocked = isResearchUnlocked(researchId, state);
    const currentLevel = state.research.completed[researchId] || 0;
    const nextLevel = currentLevel + 1;
    const isActive = state.research.activeResearches.some((r) => r.id === researchId);

    if (!unlocked) {
      html += `
        <div class="research-item locked">
          <div class="research-header">
            <span class="research-name">${research.name}</span>
            <span class="research-locked-icon">🔒</span>
          </div>
          <div class="research-unlock">${getResearchUnlockText(research)}</div>
        </div>
      `;
      continue;
    }

    if (isActive) continue;

    const cost = getResearchCost(researchId, nextLevel);
    const baseTime = getResearchBaseTime(researchId, nextLevel);
    const scientificMethodLevel = state.research.completed.scientificMethod || 0;
    const scientistsPerResearch = distributeScientists(state.research.scientists, usedSlots + 1);
    const actualTime = getActualResearchTime(
      baseTime,
      scientistsPerResearch,
      scientificMethodLevel
    );
    const affordable = canAfford(state.resources, { science: cost });
    const canStart = hasSlot && affordable;

    html += `
      <div class="research-item">
        <div class="research-header">
          <span class="research-name">${research.name}</span>
          <span class="research-level">Lv.${currentLevel} -> ${nextLevel}</span>
        </div>
        <div class="research-desc">${research.description}</div>
        <div class="research-info">
          <span class="research-cost">${cost} ${RESOURCES.science.icon}</span>
          <span class="research-time">${actualTime}s</span>
        </div>
        <button class="research-start-btn ${canStart ? '' : 'disabled'}"
                data-research="${researchId}"
                ${canStart ? '' : 'disabled'}>
          ${!hasSlot ? 'No Slot' : !affordable ? 'Need Science' : 'Start'}
        </button>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

/**
 * Get unlock text for research
 */
function getResearchUnlockText(research) {
  const condition = research.unlockCondition;
  if (!condition) return 'Available';

  if (condition.building) {
    const reqBuilding = BUILDINGS[condition.building];
    return `Requires ${condition.count || 1} ${reqBuilding.name}`;
  }

  return 'Locked';
}

/**
 * Render spaceship progress
 */
function renderSpaceshipProgress(state) {
  const progress = getSpaceshipProgress(state.resources);
  const canBuild = canBuildSpaceship(state.resources);

  let detailsHtml = '';
  for (const [resource, required] of Object.entries(SPACESHIP_COST)) {
    const current = state.resources[resource] || 0;
    const res = RESOURCES[resource];
    const complete = current >= required;
    detailsHtml += `
      <span class="spaceship-resource ${complete ? 'complete' : ''}" data-spaceship-resource="${resource}">
        ${res.icon} ${formatResource(current)}/${required}
      </span>
    `;
  }

  return `
    <div class="idle-spaceship-section">
      <div class="spaceship-header">
        <span class="spaceship-title">SPACESHIP PROGRESS</span>
        <span class="spaceship-percent">${progress.toFixed(0)}%</span>
      </div>
      <div class="spaceship-progress-bar">
        <div class="spaceship-progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="spaceship-details">
        ${detailsHtml}
      </div>
      <button class="spaceship-launch-btn" id="launch-btn" style="${canBuild ? '' : 'display:none'}">
        LAUNCH SPACESHIP
      </button>
    </div>
  `;
}

/**
 * Render footer with stats and controls
 */
function renderFooter(state) {
  const playTime = formatPlayTime(state.stats.playTime);

  return `
    <div class="idle-footer">
      <div class="idle-stats">
        <span class="stat-clicks">Clicks: ${state.stats.totalClicks}</span>
        <span class="stat-time">Time: ${playTime}</span>
      </div>
      <div class="idle-controls">
        <button class="idle-save-btn" id="save-btn">Save</button>
        <button class="idle-reset-btn" id="reset-btn">Reset</button>
      </div>
    </div>
  `;
}

/**
 * Format play time as HH:MM:SS
 */
function formatPlayTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
  if (!gameWindow) return;

  const content = gameWindow.content;

  // Tab switching
  content.querySelectorAll('.idle-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      currentTab = e.target.dataset.tab;
      requestFullRender();
    });
  });

  // Gather button
  const gatherBtn = content.querySelector('#gather-btn');
  if (gatherBtn) {
    gatherBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      gatherMinerals();
      // Add visual feedback
      gatherBtn.classList.add('clicked');
      setTimeout(() => gatherBtn.classList.remove('clicked'), 100);
    });
  }

  // Building buy buttons
  content.querySelectorAll('.building-buy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const buildingId = e.currentTarget.dataset.building;
      if (purchaseBuilding(buildingId)) {
        requestFullRender(); // Rebuild to update unlock states
      }
    });
  });

  // Building sell buttons
  content.querySelectorAll('.building-sell-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const buildingId = e.currentTarget.dataset.building;
      sellBuilding(buildingId);
    });
  });

  // Hire scientist button
  const hireBtn = content.querySelector('#hire-scientist-btn');
  if (hireBtn) {
    hireBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hireScientist();
    });
  }

  // Research start buttons
  content.querySelectorAll('.research-start-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const researchId = e.currentTarget.dataset.research;
      if (startResearch(researchId)) {
        requestFullRender();
      }
    });
  });

  // Research cancel buttons
  content.querySelectorAll('.research-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const researchId = e.currentTarget.dataset.research;
      if (cancelResearch(researchId)) {
        requestFullRender();
      }
    });
  });

  // Launch button
  const launchBtn = content.querySelector('#launch-btn');
  if (launchBtn) {
    launchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (buildSpaceship()) {
        showWinScreen();
      }
    });
  }

  // Save button
  const saveBtn = content.querySelector('#save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await gameStateManager.save();
      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveBtn.textContent = 'Save';
      }, 1000);
    });
  }

  // Reset button
  const resetBtn = content.querySelector('#reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        gameStateManager.reset();
        requestFullRender();
      }
    });
  }
}

/**
 * Update the game UI (called on state changes)
 */
function updateGameUI() {
  // Only update if window is visible
  if (!gameWindow || gameWindow.element.style.display === 'none') {
    return;
  }

  renderGameUI();
}

/**
 * Show win screen when spaceship is launched
 */
function showWinScreen() {
  if (!gameWindow) return;

  gameWindow.content.innerHTML = `
    <div class="idle-win-screen">
      <div class="win-rocket">🚀</div>
      <h2>CONGRATULATIONS!</h2>
      <p>You have successfully built and launched your spaceship!</p>
      <p>Phase 1 Complete</p>
      <p class="win-subtitle">Space exploration awaits...</p>
      <button class="win-continue-btn" id="continue-btn">Continue Playing</button>
    </div>
  `;

  const continueBtn = gameWindow.content.querySelector('#continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      requestFullRender();
    });
  }
}

/**
 * Check if the game window is currently visible
 * @returns {boolean} True if visible
 */
export function isIdleGameVisible() {
  return gameWindow && gameWindow.element.style.display !== 'none';
}
