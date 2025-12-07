/**
 * @file starsTab.js
 * @description Logic for the "Stars" tab in Visual Tools (Custom UI).
 *
 * Consolidates star-related controls:
 * - Star Brightness
 * - Magnitude Limit
 */
import { config } from '../../config.js';

export function setupStarsTab(container, starsRef, renderer) {
  // Clear any existing content
  container.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'system-list'; // Reusing system-list for consistent styling
  container.appendChild(list);

  // --- HELPERS (Copied/Adapted from systemTab.js - could be shared util later) ---
  const createSection = (title) => {
    const sec = document.createElement('div');
    sec.className = 'system-section';
    const t = document.createElement('div');
    t.className = 'system-section-title';
    t.textContent = title;
    sec.appendChild(t);
    list.appendChild(sec);
    return sec;
  };

  const createSliderControl = (parent, labelText, valueFn, onChangeFn, formatter) => {
    const row = document.createElement('div');
    row.className = 'system-row';

    const label = document.createElement('div');
    label.className = 'system-label';
    label.textContent = labelText;
    row.appendChild(label);

    const sliderCont = document.createElement('div');
    sliderCont.className = 'system-slider-container';

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'system-slider';
    // We'll normalize all sliders to 0-1000 internally for smooth feel
    input.min = 0;
    input.max = 1000;
    input.value = valueFn();

    // Value Display
    const valSpan = document.createElement('span');
    valSpan.className = 'system-value';
    valSpan.textContent = formatter();

    input.addEventListener('input', (e) => {
      onChangeFn(parseFloat(e.target.value));
      const newVal = formatter();
      valSpan.textContent = newVal;
    });

    sliderCont.appendChild(input);
    row.appendChild(sliderCont);
    row.appendChild(valSpan);

    parent.appendChild(row);

    return {
      update: () => {
        input.value = valueFn();
        valSpan.textContent = formatter();
      },
    };
  };

  // --- SECTIONS ---
  const settingsSec = createSection('Settings');

  // 1. Star Brightness (0.0 - 1.0)
  const getBrightnessVal = () => {
    return config.starBrightness * 1000;
  };

  const onBrightnessChange = (sliderVal) => {
    // 0-1000
    const val = sliderVal / 1000;
    config.starBrightness = val;

    // Update Manager
    const starsGroup = starsRef.value;
    if (starsGroup && starsGroup.userData.manager) {
      starsGroup.userData.manager.setBrightness(val);
    }
  };

  const brightnessFormatter = () => {
    return (config.starBrightness * 100).toFixed(0) + '%';
  };

  createSliderControl(
    settingsSec,
    'Brightness',
    getBrightnessVal,
    onBrightnessChange,
    brightnessFormatter
  );

  // 2. Star Saturation (0.0 - 1.0)
  const getSaturationVal = () => {
    return (config.starSaturation || 0) * 1000; // Map 0-1.0 to 0-1000
  };

  const onSaturationChange = (sliderVal) => {
    // 0-1000
    const val = sliderVal / 1000; // Map back to 0-1.0
    config.starSaturation = val;

    // Update Manager
    const starsGroup = starsRef.value;
    if (starsGroup && starsGroup.userData.manager) {
      starsGroup.userData.manager.setSaturation(val);
    }
  };

  const saturationFormatter = () => {
    const val = config.starSaturation !== undefined ? config.starSaturation : 0.3;
    return val.toFixed(1) + 'x';
  };

  createSliderControl(
    settingsSec,
    'Saturation',
    getSaturationVal,
    onSaturationChange,
    saturationFormatter
  );

  // 2. Magnitude Limit (2.0 - 13.0)
  const minMag = 2.0;
  const maxMag = 13.0;

  const getMagVal = () => {
    // Map 2.0-13.0 to 0-1000
    return ((config.magnitudeLimit - minMag) / (maxMag - minMag)) * 1000;
  };

  const onMagChange = (sliderVal) => {
    // 0-1000
    const t = sliderVal / 1000;
    const val = minMag + t * (maxMag - minMag);
    config.magnitudeLimit = val;

    const stars = starsRef.value;
    if (stars && stars.userData.manager) {
      const manager = stars.userData.manager;
      // Coarse loading logic
      if (val > 6.5) manager.loadChunk(1);
      if (val > 8.0) manager.loadChunk(2);
      manager.setMagnitudeLimit(val);
    }
  };

  const magFormatter = () => {
    return config.magnitudeLimit.toFixed(1);
  };

  createSliderControl(settingsSec, 'Limit (Mag)', getMagVal, onMagChange, magFormatter);
}
