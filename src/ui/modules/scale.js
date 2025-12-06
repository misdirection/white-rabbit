/**
 * @file scale.js
 * @deprecated Scale controls have been moved to systemTab.js
 */
export function setupScaleFolder() {
  console.warn('setupScaleFolder is deprecated. Use setupSystemTab instead.');
  return { setScalePreset: () => {} };
}
