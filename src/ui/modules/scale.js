import { config, REAL_PLANET_SCALE_FACTOR, REAL_SUN_SCALE_FACTOR } from '../../config.js';
import { addValueDisplay } from './utils.js';
import { updateMagneticFieldScales } from './visual.js';

export function setupScaleFolder(gui, uiState, planets, sun) {
  const scaleFolder = gui.addFolder('Scale');

  // Flag to prevent switching to Custom when preset is being applied
  let isPresetChanging = false;

  const presetController = scaleFolder
    .add(uiState, 'scalePreset', ['Realistic', 'Artistic', 'Custom'])
    .name('Scale Preset');

  // Proxy object for GUI to control "Real Scale" directly
  const scaleProxy = {
    get sunScale() {
      return config.sunScale * REAL_SUN_SCALE_FACTOR;
    },
    set sunScale(v) {
      config.sunScale = v / REAL_SUN_SCALE_FACTOR;
    },
  };

  const sunSlider = scaleFolder
    .add(scaleProxy, 'sunScale', 1, 70)
    .name('Sun Scale')
    .onChange((val) => {
      const internalVal = val / REAL_SUN_SCALE_FACTOR;
      config.sunScale = internalVal;
      sun.scale.setScalar(internalVal);

      // Switch to Custom if user manually adjusts
      if (!isPresetChanging && uiState.scalePreset !== 'Custom') {
        uiState.scalePreset = 'Custom';
        presetController.updateDisplay();
      }
    });

  sunSlider.domElement.classList.add('hide-value');
  addValueDisplay(sunSlider, (val) => val.toFixed(0) + 'x');

  // Helper to convert between scale (1-2500) and slider t (0-1)
  const toSlider = (scale) => Math.pow((scale - 1) / (REAL_PLANET_SCALE_FACTOR * 5 - 1), 1 / 3);
  const toScale = (t) => 1 + (REAL_PLANET_SCALE_FACTOR * 5 - 1) * Math.pow(t, 3);

  // Proxy for slider control
  const sliderProxy = {
    get planetT() {
      return toSlider(config.planetScale * REAL_PLANET_SCALE_FACTOR);
    },
    set planetT(v) {
      const realScale = toScale(v);
      const internalVal = realScale / REAL_PLANET_SCALE_FACTOR;
      config.planetScale = internalVal;

      planets.forEach((p) => {
        p.mesh.scale.setScalar(internalVal);
        p.moons.forEach((m) => m.mesh.scale.setScalar(internalVal));
      });
      updateMagneticFieldScales(planets);
    },
  };

  const planetSlider = scaleFolder
    .add(sliderProxy, 'planetT', 0, 1)
    .name('Planet Scale')
    .onChange((val) => {
      // Switch to Custom if user manually adjusts
      if (!isPresetChanging && uiState.scalePreset !== 'Custom') {
        uiState.scalePreset = 'Custom';
        presetController.updateDisplay();
      }
    });

  planetSlider.domElement.classList.add('hide-value');
  addValueDisplay(planetSlider, (val) => toScale(val).toFixed(0) + 'x');

  // Attach onChange after sliders are defined
  presetController.onChange((val) => {
    isPresetChanging = true;
    if (val === 'Realistic') {
      sunSlider.setValue(1); // 1x
      planetSlider.setValue(0); // t=0 -> 1x
    } else if (val === 'Artistic') {
      sunSlider.setValue(1.0 * REAL_SUN_SCALE_FACTOR); // 20x
      // Calculate t for 500x
      const t = Math.pow((500 - 1) / (REAL_PLANET_SCALE_FACTOR * 5 - 1), 1 / 3);
      planetSlider.setValue(t);
    }
    // Custom doesn't change values, just indicates manual adjustment
    isPresetChanging = false;
  });

  scaleFolder.close(); // Close Scale folder by default

  // Initial update to apply defaults
  updateMagneticFieldScales(planets);

  return {};
}
