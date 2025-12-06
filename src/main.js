/**
 * @file main.js
 * @description Main entry point for the White Rabbit solar system simulator.
 *
 * This file instantiates the Simulation class which orchestrates the application.
 */

import { Simulation } from './core/Simulation.js';
import './ui/styles/ui.css'; // Import UI styles

// --- Init ---
window.onerror = (message, source, lineno, colno, error) => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.textContent = `Error: ${message} at ${source}:${lineno}`;
    loading.style.color = 'red';
  }
};
(async () => {
  const sim = new Simulation();
  await sim.init();
})();
