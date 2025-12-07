/**
 * @file systemTab.js
 * @description Logic for the "System" tab in Visual Tools (Custom UI).
 *
 * This module consolidates system-level controls:
 * - Origin (Coordinate System)
 * - Reference Plane
 * - Scale Adjustments (Presets & Custom)
 */
import { config, REAL_PLANET_SCALE_FACTOR, REAL_SUN_SCALE_FACTOR } from '../../config.js';
import { updateCoordinateSystem } from '../../systems/coordinates.js';
import { updateRelativeOrbits } from '../../systems/relativeOrbits.js';
import {
  updateMagneticFieldScales,
  updateReferencePlane,
  updateSunMagneticFieldScale,
} from './visual.js';
import { updateMissionTrajectories } from '../../features/missions.js';

export function setupSystemTab(
  container,
  uiState,
  planets,
  sun,
  universeGroup,
  orbitGroup,
  relativeOrbitGroup
) {
  // Clear any existing content
  container.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'system-list';
  container.appendChild(list);

  // --- HELPERS ---
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

  const createSelect = (parent, labelText, optionsMap, getVal, setVal) => {
    const row = document.createElement('div');
    row.className = 'system-row';

    const label = document.createElement('div');
    label.className = 'system-label';
    label.textContent = labelText;
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'system-select';

    // OptionsMap: { "Label": "value" }
    Object.entries(optionsMap).forEach(([text, val]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      if (val === getVal()) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      setVal(e.target.value);
    });

    row.appendChild(select);
    parent.appendChild(row);
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
    input.min = 0;
    input.max = 1000;
    input.value = valueFn(); // Expected 0-1000

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
    row.appendChild(valSpan); // Value at the end

    parent.appendChild(row);

    return {
      update: () => {
        input.value = valueFn();
        valSpan.textContent = formatter();
      },
    };
  };

  // --- COORDINATE SYSTEMS ---
  const coordSec = createSection('Coordinate System');

  // Origin
  createSelect(
    coordSec,
    'Origin',
    {
      'Center of Mass (Barycentric)': 'Barycentric',
      'Earth (Geocentric)': 'Geocentric',
      'Earth (Tychonic)': 'Tychonic',
      'Sun (Heliocentric)': 'Heliocentric',
    },
    () => config.coordinateSystem,
    (val) => {
      config.coordinateSystem = val;
      updateCoordinateSystem(universeGroup, planets, sun);
      updateRelativeOrbits(orbitGroup, relativeOrbitGroup, planets, sun);
    }
  );

  // Reference Plane
  // Options: Equatorial, Ecliptic
  // Map array to object
  const refOpts = { Equatorial: 'Equatorial', Ecliptic: 'Ecliptic' };
  createSelect(
    coordSec,
    'Reference Plane', // Full label
    refOpts,
    () => config.referencePlane,
    (val) => {
      config.referencePlane = val;
      updateReferencePlane(val, universeGroup);
    }
  );

  // --- SCALE ---
  const scaleSec = createSection('Scale');

  // Custom CreateSelect for Presets
  const createPresetSelect = () => {
    const row = document.createElement('div');
    row.className = 'system-row';

    const label = document.createElement('div');
    label.className = 'system-label';
    label.textContent = 'Preset';
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'system-select';

    const presetOpts = { Realistic: 'Realistic', Artistic: 'Artistic', Custom: 'Custom' };
    Object.entries(presetOpts).forEach(([k, v]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = k;
      select.appendChild(opt);
    });
    select.value = uiState.scalePreset;

    select.addEventListener('change', (e) => {
      uiState.scalePreset = e.target.value;
      applyPreset(uiState.scalePreset);
    });

    row.appendChild(select);
    scaleSec.appendChild(row);

    return {
      update: () => {
        select.value = uiState.scalePreset;
      },
    };
  };

  // Logic from scale.js
  let isPresetChanging = false;

  const applyPreset = (val) => {
    isPresetChanging = true;
    if (val === 'Realistic') {
      // Sun 1x, Planet 1x
      updateSun(1);
      updatePlanet(0); // t=0
    } else if (val === 'Artistic') {
      // Sun 20x, Planet 500x
      updateSun(1.0 * REAL_SUN_SCALE_FACTOR);
      // Calculate t for 500x
      const t = ((500 - 1) / (REAL_PLANET_SCALE_FACTOR * 5 - 1)) ** (1 / 3);
      updatePlanet(t * 1000);
    }
    isPresetChanging = false;
  };

  const presetCtrl = createPresetSelect();

  // Sun Scale
  const sunMin = 1;
  const sunMax = 70;

  const getSunVal = () => {
    const real = config.sunScale * REAL_SUN_SCALE_FACTOR; // 1 to 70
    // Map to 0-1000
    return ((real - sunMin) / (sunMax - sunMin)) * 1000;
  };

  const updateSun = (realVal) => {
    // realVal is e.g. 20
    const internalVal = realVal / REAL_SUN_SCALE_FACTOR;
    config.sunScale = internalVal;
    sun.scale.setScalar(internalVal);
    updateSunMagneticFieldScale(universeGroup, internalVal);

    if (sunCtrl) sunCtrl.update();
  };

  const onSunChange = (sliderVal) => {
    // 0-1000
    const t = sliderVal / 1000;
    const realVal = sunMin + t * (sunMax - sunMin);
    updateSun(realVal);

    if (!isPresetChanging && uiState.scalePreset !== 'Custom') {
      uiState.scalePreset = 'Custom';
      presetCtrl.update();
    }
  };

  const sunFormatter = () => {
    return (config.sunScale * REAL_SUN_SCALE_FACTOR).toFixed(0) + 'x';
  };

  const sunCtrl = createSliderControl(scaleSec, 'Sun Scale', getSunVal, onSunChange, sunFormatter);

  // Planet Scale
  const toScale = (t) => 1 + (REAL_PLANET_SCALE_FACTOR * 5 - 1) * t ** 3;
  const toTb = (scale) => ((scale - 1) / (REAL_PLANET_SCALE_FACTOR * 5 - 1)) ** (1 / 3);

  const getPlanetVal = () => {
    // Returns 0-1000
    const currentScale = config.planetScale * REAL_PLANET_SCALE_FACTOR;
    const t = toTb(currentScale);
    return t * 1000;
  };

  const updatePlanet = (sliderVal) => {
    // 0-1000
    const t = sliderVal / 1000;
    const realScale = toScale(t);
    const internalVal = realScale / REAL_PLANET_SCALE_FACTOR;
    config.planetScale = internalVal;

    planets.forEach((p) => {
      p.mesh.scale.setScalar(internalVal);
      p.moons.forEach((m) => m.mesh.scale.setScalar(internalVal));
    });
    updateMagneticFieldScales(planets);
    // Force mission trajectory update (for scale-aware offsets)
    updateMissionTrajectories(null, true);

    if (planetCtrl) planetCtrl.update();
  };

  const onPlanetChange = (sliderVal) => {
    updatePlanet(sliderVal);
    if (!isPresetChanging && uiState.scalePreset !== 'Custom') {
      uiState.scalePreset = 'Custom';
      presetCtrl.update();
    }
  };

  const planetFormatter = () => {
    const currentScale = config.planetScale * REAL_PLANET_SCALE_FACTOR;
    return currentScale.toFixed(0) + 'x';
  };

  const planetCtrl = createSliderControl(
    scaleSec,
    'Planet Scale',
    getPlanetVal,
    onPlanetChange,
    planetFormatter
  );

  // Return API
  return {
    setScalePreset: (preset) => {
      uiState.scalePreset = preset;
      presetCtrl.update(); // Update select UI
      applyPreset(preset); // Apply logic
    },
  };
}
