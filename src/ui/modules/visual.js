/**
 * @file visual.js
 * @description Visual settings controls including coordinate systems, rendering options, and overlay visibility.
 *
 * This file provides a comprehensive set of UI controls for adjusting visual presentation and overlays
 * in the solar system simulator. It manages global visual state through config updates and coordinates
 * scene transformations for different coordinate systems and reference planes.
 *
 * Key responsibilities:
 * - Reference plane rotation: Equatorial (default) vs Ecliptic (23.44° tilt correction)
 * - Coordinate system origin: Barycentric, Geocentric, Tychonic, Heliocentric
 * - Star brightness control: Piecewise mapping (realistic → turbo with 100x intensity boost)
 * - Gamma/exposure adjustment via tone mapping
 * - Object info mode: Tooltip vs Window vs Off
 * - Visibility toggles for all overlay categories (orbits, constellations, axes, etc.)
 * - Parent-child control relationships: Auto-hide child controls when parent disabled
 * - Custom tab-based UI builders for Visual Tools window
 * - Orbit color management (planet/dwarf planet specific colors)
 * - Moon orbit capping when scaling
 * - Magnetic field capping when scaling
 *
 * The visual module integrates deeply with the GUI system, providing both lil-gui folder-based
 * controls and custom HTML-based tabbed interfaces for better organization of complex settings.
 */
import * as THREE from 'three';
import { config, REAL_PLANET_SCALE_FACTOR } from '../../config.js';
import { updateOrbitMaterialColor } from '../../materials/OrbitMaterial.js';

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


// Removed updateReferencePlane export conflict if present, but user asked for visual.js update.
import { updateCoordinateSystem } from '../../systems/coordinates.js';
import { updateRelativeOrbits } from '../../systems/relativeOrbits.js';

import { menuDock } from '../MenuDock.js';

export function setupVisualFolder(
  gui,
  starsRef,
  renderer,
  universeGroup,
  planets,
  sun,
  orbitGroup,
  relativeOrbitGroup,
  uiState // Added uiState
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
    .onChange((val) => {
        const starsGroup = starsRef.value;
        if (starsGroup && starsGroup.userData.manager) {
            starsGroup.userData.manager.setBrightness(val);
        }
    });
  starSlider.domElement.classList.add('hide-value');
  starSlider.domElement.classList.add('full-width');

  // Magnitude Limit (Star Count)
  const magSlider = visualFolder
    .add(config, 'magnitudeLimit', 2.0, 13.0)
    .name('Magnitude Limit')
    .step(0.1)
    .onChange((val) => {
        const stars = starsRef.value;
        if (stars && stars.userData.manager) {
            const manager = stars.userData.manager;
            // Coarse chunk loading based on magnitude thresholds
            // Chunk 0: <= 6.5 (Always loaded)
            // Chunk 1: <= 8.0
            // Chunk 2: > 8.0 (Deep space)
            
            if (val > 6.5) manager.loadChunk(1);
            if (val > 8.0) manager.loadChunk(2);
            
            // Pass 'val' to shader to clip stars precisely
            manager.setMagnitudeLimit(val);
        }
    });
  magSlider.domElement.classList.add('full-width');

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

  // Dock Visibility
  if (uiState) {
    visualFolder
    .add(uiState, 'dock')
    .name('Show Dock')
    .onChange((v) => {
      menuDock.dock.style.display = v ? 'flex' : 'none';
    });
  }

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

export function updateAsterismsVisibility(zodiacGroup, asterismsGroup) {
  const showZ = config.showZodiacs;
  const showC = config.showAsterisms;

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

  // Other Asterisms Visibility: Only if Asterisms switch is ON
  if (asterismsGroup) {
    asterismsGroup.visible = showC;
  }
}

export function updateConstellationsBoundariesVisibility(constellationsGroup) {
  if (constellationsGroup) {
    constellationsGroup.visible = config.showConstellations;
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

export function setupAsterismsControls(
  gui,
  zodiacGroup,
  asterismsGroup,
  zodiacSignsGroup
) {
  // Asterisms (All)
  const asterismsCtrl = gui
    .add(config, 'showAsterisms')
    .name('Asterisms (All)')
    .onChange(() => updateAsterismsVisibility(zodiacGroup, asterismsGroup));
  asterismsCtrl.domElement.classList.add('checkbox-left');

  // Zodiacs
  const zodiacsCtrl = gui
    .add(config, 'showZodiacs')
    .name('Zodiacs')
    .onChange(() => updateAsterismsVisibility(zodiacGroup, asterismsGroup));
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
  asterismsGroup,
  planets,
  sun,
  zodiacSignsGroup,
  habitableZone,
  magneticFieldsGroup,
  relativeOrbitGroup,
  universeGroup
) {
  const overlaysFolder = gui.addFolder('Overlays');

  const asterismsFolder = overlaysFolder.addFolder('Asterisms');
  asterismsFolder.domElement.classList.add('constellations-folder');
  setupAsterismsControls(
    asterismsFolder,
    zodiacGroup,
    asterismsGroup,
    zodiacSignsGroup
  );
  asterismsFolder.close();

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

export function setupAsterismsControlsCustom(
  container,
  zodiacGroup,
  asterismsGroup,
  zodiacSignsGroup,
  constellationsGroup
) {
  const items = [
    {
      configKey: 'showConstellations',
      label: 'Constellations',
      icon: '🌐',
      updateFn: () => updateConstellationsBoundariesVisibility(constellationsGroup),
    },
    {
      configKey: 'showAsterisms',
      label: 'Asterisms (All)',
      icon: '✨',
      updateFn: () => updateAsterismsVisibility(zodiacGroup, asterismsGroup),
    },
    {
      configKey: 'showZodiacs',
      label: 'Zodiacs',
      icon: '⁂',
      updateFn: () => updateAsterismsVisibility(zodiacGroup, asterismsGroup),
    },
    {
      configKey: 'showZodiacSigns',
      label: 'Zodiac Signs',
      icon: '🦁',
      updateFn: (val) => updateZodiacSignsVisibility(val, zodiacSignsGroup),
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
  container.appendChild(list);
}

export function setupOrbitsControlsCustom(container, orbitGroup, planets, relativeOrbitGroup) {
  const items = [
    {
      configKey: 'showSunOrbits',
      label: 'Sun',
      icon: '☀️',
      updateFn: () => updateOrbitsVisibility(orbitGroup, planets, null),
    },
    {
      configKey: 'showPlanetOrbits',
      label: 'Planets',
      icon: '🪐',
      updateFn: () => updateOrbitsVisibility(orbitGroup, planets, null),
      childToggle: {
        configKey: 'showPlanetColors',
        label: 'Colors',
        updateFn: () => updateOrbitColors(orbitGroup, relativeOrbitGroup, planets),
      },
    },
    {
      configKey: 'showDwarfPlanetOrbits',
      label: 'Dwarf Planets',
      icon: '🪨',
      updateFn: () => updateOrbitsVisibility(orbitGroup, planets, null),
      childToggle: {
        configKey: 'showDwarfPlanetColors',
        label: 'Colors',
        updateFn: () => updateOrbitColors(orbitGroup, relativeOrbitGroup, planets),
      },
    },
    {
      configKey: 'showMoonOrbits',
      label: 'Moons',
      icon: '🌕',
      updateFn: () => updateOrbitsVisibility(orbitGroup, planets, null),
      childToggle: {
        configKey: 'capMoonOrbits',
        label: 'Cap',
        updateFn: () => {}, // Handled in animation loop or updateOrbitsVisibility
      },
    },
  ];

  const list = document.createElement('div');
  list.className = 'object-list';

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'object-item';
    if (config[item.configKey]) el.classList.add('active');

    // Main Content
    const leftPart = document.createElement('div');
    leftPart.style.display = 'flex';
    leftPart.style.alignItems = 'center';
    leftPart.style.flexGrow = '1';
    leftPart.innerHTML = `
        <div class="object-icon">${item.icon}</div>
        <div class="object-label">${item.label}</div>
    `;
    el.appendChild(leftPart);

    // Child Toggle (if any)
    let toggleEl = null;

    if (item.childToggle) {
      toggleEl = document.createElement('div');
      toggleEl.className = 'object-toggle';
      if (config[item.childToggle.configKey]) toggleEl.classList.add('active');
      toggleEl.textContent = item.childToggle.label;

      toggleEl.style.display = config[item.configKey] ? 'flex' : 'none';

      toggleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        config[item.childToggle.configKey] = !config[item.childToggle.configKey];
        const isToggleActive = config[item.childToggle.configKey];

        if (isToggleActive) toggleEl.classList.add('active');
        else toggleEl.classList.remove('active');

        if (item.childToggle.updateFn) item.childToggle.updateFn();
      });

      el.appendChild(toggleEl);
    }

    // Main Click
    leftPart.addEventListener('click', () => {
      config[item.configKey] = !config[item.configKey];
      const isActive = config[item.configKey];

      if (isActive) {
        el.classList.add('active');
        if (toggleEl) toggleEl.style.display = 'flex';
      } else {
        el.classList.remove('active');
        if (toggleEl) toggleEl.style.display = 'none';
      }

      item.updateFn();
    });

    list.appendChild(el);
  });

  container.appendChild(list);
}

export function setupMagneticFieldsControlsCustom(
  container,
  magneticFieldsGroup,
  planets,
  universeGroup
) {
  const items = [
    {
      configKey: 'showSunMagneticFieldBasic',
      label: 'Sun',
      icon: '🔆',
      updateFn: () => {
        if (universeGroup) {
          const field = universeGroup.children.find((c) => c.name === 'SunMagneticFieldBasic');
          if (field) field.visible = config.showSunMagneticFieldBasic;
        }
      },
    },
    {
      configKey: 'showSunMagneticField',
      label: 'Solar Wind',
      icon: '🌬️',
      updateFn: () => {
        if (universeGroup) {
          const field = universeGroup.children.find((c) => c.name === 'MagneticField');
          if (field) field.visible = config.showSunMagneticField;
        }
      },
      childToggle: {
        configKey: 'showSunMagneticFieldBasic',
        label: 'Basic',
        updateFn: () => {
          if (universeGroup) {
            const field = universeGroup.children.find((c) => c.name === 'SunMagneticFieldBasic');
            if (field) field.visible = config.showSunMagneticFieldBasic;
          }
        },
      },
    },
    {
      configKey: 'showMagneticFields',
      label: 'Planets, Moons',
      icon: '🧲',
      updateFn: () =>
        updateMagneticFieldsVisibility(
          config.showMagneticFields,
          magneticFieldsGroup,
          planets,
          null
        ),
      childToggle: {
        configKey: 'capMagneticFields',
        label: 'Cap',
        updateFn: () => updateMagneticFieldScales(planets),
      },
    },
  ];

  const list = document.createElement('div');
  list.className = 'object-list';

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'object-item';
    if (config[item.configKey]) el.classList.add('active');

    // Main Content
    const leftPart = document.createElement('div');
    leftPart.style.display = 'flex';
    leftPart.style.alignItems = 'center';
    leftPart.style.flexGrow = '1';
    leftPart.innerHTML = `
        <div class="object-icon">${item.icon}</div>
        <div class="object-label">${item.label}</div>
    `;
    el.appendChild(leftPart);

    // Child Toggle (if any)
    let toggleEl = null;

    if (item.childToggle) {
      toggleEl = document.createElement('div');
      toggleEl.className = 'object-toggle';
      if (config[item.childToggle.configKey]) toggleEl.classList.add('active');
      toggleEl.textContent = item.childToggle.label;

      toggleEl.style.display = config[item.configKey] ? 'flex' : 'none';

      toggleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        config[item.childToggle.configKey] = !config[item.childToggle.configKey];
        const isToggleActive = config[item.childToggle.configKey];

        if (isToggleActive) toggleEl.classList.add('active');
        else toggleEl.classList.remove('active');

        if (item.childToggle.updateFn) item.childToggle.updateFn();
      });

      el.appendChild(toggleEl);
    }

    // Main Click
    leftPart.addEventListener('click', () => {
      config[item.configKey] = !config[item.configKey];
      const isActive = config[item.configKey];

      if (isActive) {
        el.classList.add('active');
        if (toggleEl) toggleEl.style.display = 'flex';
      } else {
        el.classList.remove('active');
        if (toggleEl) toggleEl.style.display = 'none';
      }

      item.updateFn();
    });

    list.appendChild(el);
  });
  container.appendChild(list);
}

export function setupGuidesControlsCustom(container, sun, planets, habitableZone) {
  const items = [
    {
      configKey: 'showAxes',
      label: 'Axes',
      icon: '📏',
      updateFn: (val) => updateAxesVisibility(val, sun, planets),
    },
    {
      configKey: 'showHabitableZone',
      label: 'Habitable Zone',
      icon: '🟢',
      updateFn: (val) => updateHabitableZoneVisibility(val, habitableZone),
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
  const defaultColor = 0x7799aa; // Slight cyan-tinted gray for default orbits

  // 1. Update Standard Orbits (Heliocentric / Tychonic)
  orbitGroup.children.forEach((line) => {
    const planetName = line.name.replace('_Orbit', '');
    const planet = planets.find((p) => p.data.name === planetName);

    if (planet) {
      const isDwarf = planet.data.type === 'dwarf';
      const useColor = isDwarf ? showDwarfColors : showColors;
      const color = useColor ? planet.data.color || defaultColor : defaultColor;
      const opacity = useColor ? 0.9 : 0.7;

      // Use utility function that handles both shader and basic materials
      updateOrbitMaterialColor(line.material, color, opacity);

      // Update glow intensity based on color mode
      if (line.material.uniforms && line.material.uniforms.uGlowIntensity) {
        line.material.uniforms.uGlowIntensity.value = useColor ? 0.4 : 0.2;
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
      const color = useColor ? planet.data.color || defaultColor : defaultColor;
      const opacity = useColor ? 0.9 : 0.7;

      // Use utility function that handles both shader and basic materials
      updateOrbitMaterialColor(line.material, color, opacity);

      // Update glow intensity based on color mode
      if (line.material.uniforms && line.material.uniforms.uGlowIntensity) {
        line.material.uniforms.uGlowIntensity.value = useColor ? 0.4 : 0.2;
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
