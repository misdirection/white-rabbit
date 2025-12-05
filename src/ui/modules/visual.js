import * as THREE from 'three';
import { config, REAL_PLANET_SCALE_FACTOR } from '../../config.js';

export function updateReferencePlane(val, universeGroup) {
  if (universeGroup) {
    if (val === 'Ecliptic') {
      // Rotate universe so Ecliptic is flat (X-Z plane)
      // Ecliptic is tilted by Obliquity relative to Equatorial (~23.44 degrees)
      // Equatorial Y is North. Ecliptic North is tilted.
      // To make Ecliptic flat, we rotate the whole universe around X axis.

      const obliquity = 23.43928; // Mean Obliquity of the Ecliptic J2000
      const obliquityRad = THREE.MathUtils.degToRad(obliquity);

      // Rotate around X axis to bring Ecliptic to horizontal
      // Equatorial to Ecliptic transformation requires negative rotation
      universeGroup.rotation.x = -obliquityRad;
    } else {
      // Equatorial (Default)
      universeGroup.rotation.x = 0;
    }
  }
}

export function updateStarBrightness(val, starsRef) {
  const stars = starsRef.value;
  if (stars?.material) {
    // Piecewise logic for better control:
    // 0.0 - 0.6: Fine Opacity Control (0.0 -> 0.3) - Realistic Range
    // 0.6 - 0.8: Rapid Opacity Ramp (0.3 -> 1.0)
    // 0.8 - 1.0: Intensity Boost (1.0 -> 100.0) - Turbo Range

    let opacity = 1.0;
    let intensity = 1.0;

    if (val <= 0.6) {
      opacity = (val / 0.6) * 0.3;
    } else if (val <= 0.8) {
      opacity = 0.3 + ((val - 0.6) / 0.2) * 0.7;
    } else {
      opacity = 1.0;
      // Exponential boost from 1.0 to 100.0
      // (val - 0.8) / 0.2 goes 0 -> 1
      const t = (val - 0.8) / 0.2;
      intensity = 1.0 + t ** 3 * 99.0;
    }

    stars.material.opacity = opacity;
    stars.material.color.setScalar(intensity);

    // Subtle size increase only at very high settings (Turbo Range)
    if (val > 0.8) {
      const t = (val - 0.8) / 0.2;
      stars.material.size = 1.0 + t * 0.2; // Max 1.2x
    } else {
      stars.material.size = 1.0;
    }
  }
}

import { updateCoordinateSystem } from '../../systems/coordinates.js';
import { updateRelativeOrbits } from '../../systems/relativeOrbits.js';

export function setupVisualFolder(
  gui,
  starsRef,
  renderer,
  universeGroup,
  planets,
  sun,
  orbitGroup,
  relativeOrbitGroup
) {
  const visualFolder = gui.addFolder('Visual');

  // Coordinate System (Origin)
  visualFolder
    .add(config, 'coordinateSystem', {
      'Center of Mass (Barycentric)': 'Barycentric',
      'Earth (Geocentric)': 'Geocentric',
      'Earth (Tychonic)': 'Tychonic',
      'Sun (Heliocentric)': 'Heliocentric',
    })
    .name('Origin')
    .onChange(() => {
      updateCoordinateSystem(universeGroup, planets, sun);
      updateRelativeOrbits(orbitGroup, relativeOrbitGroup, planets, sun);
    });

  // Reference Plane Control
  visualFolder
    .add(config, 'referencePlane', ['Equatorial', 'Ecliptic'])
    .name('Reference Plane')
    .onChange((val) => updateReferencePlane(val, universeGroup));

  // Initialize Reference Plane state
  updateReferencePlane(config.referencePlane, universeGroup);

  const starSlider = visualFolder
    .add(config, 'starBrightness', 0.0, 1.0)
    .name('Star Brightness')
    .onChange((val) => updateStarBrightness(val, starsRef));
  starSlider.domElement.classList.add('hide-value');
  starSlider.domElement.classList.add('full-width');

  // Initialize star brightness state
  updateStarBrightness(config.starBrightness, starsRef);

  const gammaSlider = visualFolder
    .add(config, 'gamma', 0.1, 5.0)
    .name('Gamma')
    .onChange((val) => {
      if (renderer) {
        renderer.toneMappingExposure = val;
      }
    });
  gammaSlider.domElement.classList.add('hide-value');
  gammaSlider.domElement.classList.add('full-width');

  // Object Info Mode
  const objectInfoCtrl = visualFolder
    .add(config, 'objectInfoMode', {
      Tooltips: 'tooltip',
      Window: 'window',
      Off: 'off',
    })
    .name('Object Info');
  // objectInfoCtrl.domElement.classList.add('full-width'); // Removed to fix visibility issue

  visualFolder.close(); // Close Visual folder by default
}

export function updateOrbitsVisibility(orbitGroup, planets, capMoonOrbitsCtrl) {
  // 1. Update Standard Orbits (Heliocentric / Tychonic)
  // Note: relativeOrbits.js handles the actual visibility of the group and lines for relative modes.
  // Here we handle the "static" orbit lines attached to planets/moons.

  // Sun Orbit (only relevant if it exists as a line, usually handled in relativeOrbits)
  // ...

  // Planet Orbits
  planets.forEach((p) => {
    if (p.data.type !== 'dwarf') {
      if (p.orbitLine) {
        // Visible if Planet Orbits are ON AND the Planet itself is visible
        p.orbitLine.visible = config.showPlanetOrbits && config.showPlanets;
      }
    } else {
      // Dwarf Planet Orbits
      if (p.orbitLine) {
        p.orbitLine.visible = config.showDwarfPlanetOrbits && config.showDwarfPlanets;
      }
    }

    // Moon Orbits
    p.moons.forEach((m) => {
      if (m.data.orbitLine) {
        // Check category visibility
        let isCategoryVisible = false;
        if (m.data.category === 'largest' && config.showLargestMoons) isCategoryVisible = true;
        else if (m.data.category === 'major' && config.showMajorMoons) isCategoryVisible = true;
        else if (m.data.category === 'small' && config.showSmallMoons) isCategoryVisible = true;
        if (!m.data.category) isCategoryVisible = true; // Fallback

        // Visible if Moon Orbits are ON AND the Moon Category is visible
        m.data.orbitLine.visible = config.showMoonOrbits && isCategoryVisible;
      }
    });
  });

  if (capMoonOrbitsCtrl) {
    capMoonOrbitsCtrl.domElement.style.display = config.showMoonOrbits ? '' : 'none';
  }
}

export function updateAxesVisibility(val, sun, planets) {
  // Toggle sun axis
  if (sun.axisLine) sun.axisLine.visible = val;

  // Toggle planet axes
  planets.forEach((p) => {
    if (p.data.axisLine) p.data.axisLine.visible = val;

    // Toggle moon axes
    p.moons.forEach((m) => {
      if (m.data.axisLine) m.data.axisLine.visible = val;
    });
  });
}

export function updateConstellationsVisibility(zodiacGroup, constellationsGroup) {
  const showZ = config.showZodiacs;
  const showC = config.showConstellations;

  // Zodiac Group Visibility: Visible if either switch is ON
  if (zodiacGroup) {
    zodiacGroup.visible = showZ || showC;

    // Zodiac Group Color: Distinct (Blue) if Zodiac switch is ON, else same as others (Grey)
    const color = showZ ? 0x446688 : 0xcccccc;
    zodiacGroup.children.forEach((child) => {
      if (child.material) {
        child.material.color.setHex(color);
        // Adjust opacity if needed, but keeping it simple for now
        child.material.opacity = showZ ? 0.6 : 0.4;
      }
    });
  }

  // Other Constellations Visibility: Only if Constellations switch is ON
  if (constellationsGroup) {
    constellationsGroup.visible = showC;
  }
}

export function updateZodiacSignsVisibility(val, zodiacSignsGroup) {
  if (zodiacSignsGroup) {
    zodiacSignsGroup.visible = val;
  }
}

export function updateHabitableZoneVisibility(val, habitableZone) {
  if (habitableZone) {
    habitableZone.visible = val;
  }
}

export function updateMagneticFieldsVisibility(
  val,
  magneticFieldsGroup,
  planets,
  capMagneticFieldsCtrl
) {
  if (magneticFieldsGroup) {
    magneticFieldsGroup.visible = val;

    planets.forEach((p) => {
      p.mesh.children.forEach((child) => {
        if (
          child.type === 'Group' &&
          child.children.length > 0 &&
          child.children[0].type === 'Line'
        ) {
          child.visible = val;
        }
      });

      // Also moons
      p.moons.forEach((m) => {
        m.mesh.children.forEach((child) => {
          if (
            child.type === 'Group' &&
            child.children.length > 0 &&
            child.children[0].type === 'Line'
          ) {
            child.visible = val;
          }
        });
      });
    });
  }
  if (capMagneticFieldsCtrl) {
    val ? capMagneticFieldsCtrl.show() : capMagneticFieldsCtrl.hide();
  }
}

/**
 * Updates the scale of magnetic field meshes based on planet scale and capping setting.
 * If capped, fields won't grow beyond 100x planet scale equivalent.
 */
export function updateMagneticFieldScales(planets) {
  const currentScale = config.planetScale * REAL_PLANET_SCALE_FACTOR;
  let magScale = 1.0;

  if (config.capMagneticFields && currentScale > 100) {
    // Cap at 100x equivalent
    magScale = 100 / currentScale;
  }

  planets.forEach((p) => {
    // Planet fields
    const field = p.mesh.getObjectByName('MagneticField');
    if (field) field.scale.setScalar(magScale);

    // Moon fields
    p.moons.forEach((m) => {
      const mField = m.mesh.getObjectByName('MagneticField');
      if (mField) mField.scale.setScalar(magScale);
    });
  });
}

export function setupConstellationsControls(gui, zodiacGroup, constellationsGroup, zodiacSignsGroup) {
  // Constellations (All 88)
  const constellationsCtrl = gui
    .add(config, 'showConstellations')
    .name('Constellations (All)')
    .onChange(() => updateConstellationsVisibility(zodiacGroup, constellationsGroup));
  constellationsCtrl.domElement.classList.add('checkbox-left');

  // Zodiacs
  const zodiacsCtrl = gui
    .add(config, 'showZodiacs')
    .name('Zodiacs')
    .onChange(() => updateConstellationsVisibility(zodiacGroup, constellationsGroup));
  zodiacsCtrl.domElement.classList.add('checkbox-left');

  // Zodiac Signs
  const zodiacSignsCtrl = gui
    .add(config, 'showZodiacSigns')
    .name('Zodiac Signs')
    .onChange((val) => updateZodiacSignsVisibility(val, zodiacSignsGroup));
  zodiacSignsCtrl.domElement.classList.add('checkbox-left');
}

export function setupOrbitsControls(gui, orbitGroup, planets, relativeOrbitGroup) {
  const sunOrbitsCtrl = gui
    .add(config, 'showSunOrbits')
    .name('Sun')
    .onChange(() => {
      updateOrbitsVisibility(orbitGroup, planets, null);
    });
  sunOrbitsCtrl.domElement.classList.add('checkbox-left');

  // Planet Orbits
  const planetOrbitsCtrl = gui
    .add(config, 'showPlanetOrbits')
    .name('Planets')
    .onChange((val) => {
      updateOrbitsVisibility(orbitGroup, planets, null);
      val ? planetColorsCtrl.show() : planetColorsCtrl.hide();
    });
  planetOrbitsCtrl.domElement.classList.add('checkbox-left');

  const planetColorsCtrl = gui
    .add(config, 'showPlanetColors')
    .name('Use Colors')
    .onChange(() => {
      updateOrbitColors(orbitGroup, relativeOrbitGroup, planets);
    });
  planetColorsCtrl.domElement.classList.add('checkbox-left');
  planetColorsCtrl.domElement.classList.add('child-control');
  config.showPlanetOrbits ? planetColorsCtrl.show() : planetColorsCtrl.hide();

  // Dwarf Planet Orbits
  const dwarfPlanetOrbitsCtrl = gui
    .add(config, 'showDwarfPlanetOrbits')
    .name('Dwarf Planets')
    .onChange((val) => {
      updateOrbitsVisibility(orbitGroup, planets, null);
      val ? dwarfPlanetColorsCtrl.show() : dwarfPlanetColorsCtrl.hide();
    });
  dwarfPlanetOrbitsCtrl.domElement.classList.add('checkbox-left');

  const dwarfPlanetColorsCtrl = gui
    .add(config, 'showDwarfPlanetColors')
    .name('Use Colors')
    .onChange(() => {
      updateOrbitColors(orbitGroup, relativeOrbitGroup, planets);
    });
  dwarfPlanetColorsCtrl.domElement.classList.add('checkbox-left');
  dwarfPlanetColorsCtrl.domElement.classList.add('child-control');
  config.showDwarfPlanetOrbits ? dwarfPlanetColorsCtrl.show() : dwarfPlanetColorsCtrl.hide();

  // Moon Orbits
  const moonOrbitsCtrl = gui
    .add(config, 'showMoonOrbits')
    .name('Moons')
    .onChange(() => {
      updateOrbitsVisibility(orbitGroup, planets, capMoonOrbitsCtrl);
    });
  moonOrbitsCtrl.domElement.classList.add('checkbox-left');

  const capMoonOrbitsCtrl = gui
    .add(config, 'capMoonOrbits')
    .name('Cap When Scaling')
    .onChange(() => {
      // Moon positions will be updated in the next animation frame
    });
  capMoonOrbitsCtrl.domElement.classList.add('checkbox-left');
  capMoonOrbitsCtrl.domElement.classList.add('child-control'); // Indent it
}

export function setupMagneticFieldsControls(gui, magneticFieldsGroup, planets, universeGroup) {
  // Sun basic field (dipole without solar wind)
  const sunMagneticFieldBasicCtrl = gui
    .add(config, 'showSunMagneticFieldBasic')
    .name('Sun')
    .onChange((val) => {
      if (universeGroup) {
        const field = universeGroup.children.find((c) => c.name === 'SunMagneticFieldBasic');
        if (field) field.visible = val;
      }
      // Toggle child control
      if (sunMagneticFieldCtrl) {
        val ? sunMagneticFieldCtrl.show() : sunMagneticFieldCtrl.hide();
      }
    });
  sunMagneticFieldBasicCtrl.domElement.classList.add('checkbox-left');

  // Sun with solar wind (Parker Spiral)
  const sunMagneticFieldCtrl = gui
    .add(config, 'showSunMagneticField')
    .name('Solar Wind')
    .onChange((val) => {
      if (universeGroup) {
        // Find by name in universeGroup (direct child)
        const field = universeGroup.children.find((c) => c.name === 'MagneticField');
        if (field) field.visible = val;
      }
    });
  sunMagneticFieldCtrl.domElement.classList.add('checkbox-left');
  sunMagneticFieldCtrl.domElement.classList.add('child-control');

  // Initialize visibility of child control
  config.showSunMagneticFieldBasic ? sunMagneticFieldCtrl.show() : sunMagneticFieldCtrl.hide();

  const magneticFieldsCtrl = gui
    .add(config, 'showMagneticFields')
    .name('Planets, Moons')
    .onChange((val) =>
      updateMagneticFieldsVisibility(val, magneticFieldsGroup, planets, capMagneticFieldsCtrl)
    );
  magneticFieldsCtrl.domElement.classList.add('checkbox-left');

  const capMagneticFieldsCtrl = gui
    .add(config, 'capMagneticFields')
    .name('Cap When Scaling')
    .onChange(() => {
      updateMagneticFieldScales(planets);
    });
  capMagneticFieldsCtrl.domElement.classList.add('checkbox-left');
  capMagneticFieldsCtrl.domElement.classList.add('child-control');

  // Show/hide child control based on parent state
  updateMagneticFieldsVisibility(
    config.showMagneticFields,
    magneticFieldsGroup,
    planets,
    capMagneticFieldsCtrl
  );
}

// Deprecated wrapper or kept for Axes/Habitable Zone if those stay in Main? 
// User asked for "Magnetic Field" section specifically.
// Axes and Habitable Zone are "Overlays" but maybe they can stay or go to "Orbits" or "Constellations"?
// Or a new "General" tab?
// Let's create a misc "Overlays" setup for the remaining items if needed.
export function setupExtraOverlaysControls(gui, sun, planets, habitableZone) {
  // Axes
  const axesCtrl = gui
    .add(config, 'showAxes')
    .name('Axes')
    .onChange((val) => updateAxesVisibility(val, sun, planets));
  axesCtrl.domElement.classList.add('checkbox-left');

  // Habitable Zone
  const habitableZoneCtrl = gui
    .add(config, 'showHabitableZone')
    .name('Habitable Zone')
    .onChange((val) => updateHabitableZoneVisibility(val, habitableZone));
  habitableZoneCtrl.domElement.classList.add('checkbox-left');
}

export function setupOverlaysFolder(
  gui,
  orbitGroup,
  zodiacGroup,
  constellationsGroup,
  planets,
  sun,
  zodiacSignsGroup,
  habitableZone,
  magneticFieldsGroup,
  relativeOrbitGroup,
  universeGroup
) {
  const overlaysFolder = gui.addFolder('Overlays');

  const constellationsFolder = overlaysFolder.addFolder('Constellations');
  constellationsFolder.domElement.classList.add('constellations-folder');
  setupConstellationsControls(constellationsFolder, zodiacGroup, constellationsGroup, zodiacSignsGroup);
  constellationsFolder.close();

  const orbitsFolder = overlaysFolder.addFolder('Orbits');
  orbitsFolder.domElement.classList.add('orbits-folder');
  setupOrbitsControls(orbitsFolder, orbitGroup, planets, relativeOrbitGroup);
  orbitsFolder.close();

  const magneticFieldsFolder = overlaysFolder.addFolder('Magnetic Fields');
  magneticFieldsFolder.domElement.classList.add('magnetic-fields-folder');
  setupMagneticFieldsControls(magneticFieldsFolder, magneticFieldsGroup, planets, universeGroup);
  magneticFieldsFolder.close();

  setupExtraOverlaysControls(overlaysFolder, sun, planets, habitableZone);

  overlaysFolder.close();
}

export function updateSunVisibility(val, sun) {
  sun.visible = val;
}

export function updatePlanetVisibility(val, planets) {
  planets.forEach((p) => {
    if (p.data.type !== 'dwarf') {
      p.mesh.visible = val;
      if (p.data.cloudMesh) p.data.cloudMesh.visible = val;

      // Toggle planet orbit line
      if (p.orbitLine) {
        p.orbitLine.visible = val && config.showPlanetOrbits;
      }

      // Rings should also be toggled
      p.group.children.forEach((child) => {
        if (child !== p.mesh && child !== p.orbitLinesGroup && child.type === 'Mesh') {
          if (!child.userData.isMoon) {
            // This catches rings
            child.visible = val;
          }
        }
      });
    }
  });
}

export function updateDwarfVisibility(val, planets) {
  planets.forEach((p) => {
    if (p.data.type === 'dwarf') {
      p.group.visible = val;
      if (p.orbitLine) {
        p.orbitLine.visible = val && config.showDwarfPlanetOrbits;
      }
    }
  });
}

export function updateMoonVisibility(val, planets, category) {
  planets.forEach((p) => {
    p.moons.forEach((m) => {
      if (m.data.category === category) {
        m.mesh.visible = val;
        if (m.data.orbitLine) {
          m.data.orbitLine.visible = val && config.showMoonOrbits;
        }
      }
    });
  });
}

export function setupObjectsControlsCustom(container, planets, sun) {
  const items = [
    {
      configKey: 'showSun',
      label: 'Sun',
      icon: '☀️',
      updateFn: (val) => updateSunVisibility(val, sun),
    },
    {
      configKey: 'showPlanets',
      label: 'Planets',
      icon: '🪐',
      updateFn: (val) => updatePlanetVisibility(val, planets),
    },
    {
      configKey: 'showDwarfPlanets',
      label: 'Dwarf Planets',
      icon: '🪨',
      updateFn: (val) => updateDwarfVisibility(val, planets),
    },
    {
      configKey: 'showLargestMoons',
      label: 'Largest Moons',
      icon: '🌕',
      updateFn: (val) => updateMoonVisibility(val, planets, 'largest'),
    },
    {
      configKey: 'showMajorMoons',
      label: 'Major Moons',
      icon: '🌖',
      updateFn: (val) => updateMoonVisibility(val, planets, 'major'),
    },
    {
      configKey: 'showSmallMoons',
      label: 'Small Moons',
      icon: '🥔',
      updateFn: (val) => updateMoonVisibility(val, planets, 'small'),
    },
  ];

  const list = document.createElement('div');
  list.className = 'object-list';

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'object-item';
    if (config[item.configKey]) el.classList.add('active');

    el.innerHTML = `
        <div class="object-icon">${item.icon}</div>
        <div class="object-label">${item.label}</div>
    `;

    el.addEventListener('click', () => {
      // Toggle config
      config[item.configKey] = !config[item.configKey];
      const isActive = config[item.configKey];

      // Update UI
      if (isActive) el.classList.add('active');
      else el.classList.remove('active');

      // Trigger update
      item.updateFn(isActive);
    });

    list.appendChild(el);
  });

  container.appendChild(list);
}

export function updateOrbitColors(orbitGroup, relativeOrbitGroup, planets) {
  const showColors = config.showPlanetColors;
  const showDwarfColors = config.showDwarfPlanetColors;

  // 1. Update Standard Orbits (Heliocentric / Tychonic)
  orbitGroup.children.forEach((line) => {
    // if (line.name === 'Earth_Orbit') return; // Removed exclusion

    const planetName = line.name.replace('_Orbit', '');
    const planet = planets.find((p) => p.data.name === planetName);

    if (planet) {
      const isDwarf = planet.data.type === 'dwarf';
      const useColor = isDwarf ? showDwarfColors : showColors;
      const color = useColor ? planet.data.color || 0x444444 : 0x444444;
      if (line.material) {
        line.material.color.setHex(color);
        line.material.opacity = useColor ? 0.8 : 0.5;
      }
    }
  });

  // 2. Update Relative Orbits
  relativeOrbitGroup.children.forEach((line) => {
    const bodyName = line.name.replace('_Trail', '');
    if (bodyName === 'Sun') return;

    const planet = planets.find((p) => p.data.name === bodyName);
    if (planet) {
      const isDwarf = planet.data.type === 'dwarf';
      const useColor = isDwarf ? showDwarfColors : showColors;
      const color = useColor ? planet.data.color || 0x444444 : 0x444444;
      if (line.material) {
        line.material.color.setHex(color);
        line.material.opacity = useColor ? 0.8 : 0.5;
      }
    }
  });
}

/**
 * Updates the scale of the Sun's magnetic field meshes.
 * @param {THREE.Group} universeGroup - The universe group containing the sun fields
 * @param {number} scale - The new scale factor
 */
export function updateSunMagneticFieldScale(universeGroup, scale) {
  if (!universeGroup) return;

  const basicField = universeGroup.children.find((c) => c.name === 'SunMagneticFieldBasic');
  if (basicField) {
    basicField.scale.setScalar(scale);
  }

  const solarWindField = universeGroup.children.find((c) => c.name === 'MagneticField');
  if (solarWindField) {
    // User requested fixed size for solar wind (equivalent to 20x sun scale)
    // 20x sun scale corresponds to internal scale of 1.0
    solarWindField.scale.setScalar(1.0);
  }
}
