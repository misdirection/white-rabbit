import * as THREE from 'three';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { focusOnObject } from './focusMode.js';

/**
 * Solar Eclipse Events (2020-2030)
 */
export const events = [
  // Total Solar Eclipses
  { type: 'Total', date: new Date('2020-12-14T16:00:00Z') },
  { type: 'Total', date: new Date('2021-12-04T07:00:00Z') },
  { type: 'Total', date: new Date('2023-04-20T04:00:00Z') },
  { type: 'Total', date: new Date('2024-04-08T18:00:00Z') },
  { type: 'Total', date: new Date('2026-08-12T17:00:00Z') },
  { type: 'Total', date: new Date('2027-08-02T10:00:00Z') },
  { type: 'Total', date: new Date('2028-07-22T02:00:00Z') },
  { type: 'Total', date: new Date('2030-11-25T06:00:00Z') },
  // Annular Solar Eclipses
  { type: 'Annular', date: new Date('2020-06-21T06:00:00Z') },
  { type: 'Annular', date: new Date('2021-06-10T10:00:00Z') },
  { type: 'Annular', date: new Date('2023-10-14T18:00:00Z') },
  { type: 'Annular', date: new Date('2024-10-02T18:00:00Z') },
  { type: 'Annular', date: new Date('2026-02-17T12:00:00Z') },
  { type: 'Annular', date: new Date('2027-02-06T16:00:00Z') },
  { type: 'Annular', date: new Date('2028-01-26T15:00:00Z') },
  { type: 'Annular', date: new Date('2030-06-01T06:00:00Z') },
];

/**
 * Navigate to a specific event
 * @param {Object} event - The event to navigate to
 * @param {THREE.Camera} camera - The scene camera
 * @param {Object} controls - OrbitControls instance
 * @param {Array} planets - Array of planet objects
 */
export function navigateToEvent(event, camera, controls, planets) {
  // Set the date to the event time
  config.date = new Date(event.date);
  config.simulationSpeed = 1;

  if (window.uiState?.updateSpeedometer) {
    window.uiState.updateSpeedometer();
  }

  // Wait for planets to update
  setTimeout(() => {
    const earth = planets.find((p) => p.data.name === 'Earth');

    if (!earth) {
      Logger.error('Earth not found');
      return;
    }

    // Use existing focus mode to center on Earth
    // This handles camera positioning, high-res texture swapping, and controls target
    // Use a smaller distance multiplier (2.5 instead of default 5) to get closer for eclipse viewing
    // We must explicitly set type: 'planet' so focusOnObject uses the correct scale factor
    focusOnObject({ ...earth, type: 'planet' }, camera, controls, 2.5);

    Logger.log(`Navigating to event: ${event.type} - ${event.date.toISOString()}`);
  }, 100);
}

export function formatEventName(event) {
  const dateStr = event.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `${event.type} - ${dateStr}`;
}
