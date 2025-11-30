import * as THREE from 'three';
import { config } from '../config.js';
import { focusOnObject, exitFocusMode } from '../features/focusMode.js';
import {
  updateReferencePlane,
  updateStarBrightness,
  updateOrbitsVisibility,
  updateAxesVisibility,
  updateConstellationsVisibility,
  updateZodiacSignsVisibility,
  updateHabitableZoneVisibility,
  updateMagneticFieldsVisibility,
  updateSunVisibility,
  updatePlanetVisibility,
  updateDwarfVisibility,
  updateMoonVisibility,
} from '../ui/modules/visual.js';

/**
 * API for controlling the simulation programmatically.
 * Exposed as window.SimulationControl
 */
export class SimulationControl {
  constructor(
    planets,
    sun,
    orbitGroup,
    zodiacGroup,
    constellationsGroup,
    starsRef,
    camera,
    controls,
    zodiacSignsGroup,
    habitableZone,
    magneticFieldsGroup,
    universeGroup
  ) {
    this.planets = planets;
    this.sun = sun;
    this.orbitGroup = orbitGroup;
    this.zodiacGroup = zodiacGroup;
    this.constellationsGroup = constellationsGroup;
    this.starsRef = starsRef;
    this.camera = camera;
    this.controls = controls;
    this.zodiacSignsGroup = zodiacSignsGroup;
    this.habitableZone = habitableZone;
    this.magneticFieldsGroup = magneticFieldsGroup;
    this.universeGroup = universeGroup;
  }

  getConfig() {
    return config;
  }

  // --- Time & Speed ---

  setSpeed(speed) {
    config.simulationSpeed = speed;
    // UI updates automatically via updateUI loop
  }

  setDate(dateString) {
    // Format: YYYY-MM-DD
    const [year, month, day] = dateString.split('-').map(Number);
    const current = config.date;
    config.date = new Date(
      year,
      month - 1,
      day,
      current.getHours(),
      current.getMinutes(),
      current.getSeconds()
    );
  }

  // --- Focus ---

  focus(name) {
    // Search for object by name
    const lowerName = name.toLowerCase();

    if (lowerName === 'sun') {
      focusOnObject(
        { mesh: this.sun, data: { name: 'Sun', radius: 5 }, type: 'sun' },
        this.camera,
        this.controls
      );
      return;
    }

    for (const p of this.planets) {
      if (p.data.name.toLowerCase() === lowerName) {
        focusOnObject(p, this.camera, this.controls);
        return;
      }
      for (const m of p.moons) {
        if (m.data.name.toLowerCase() === lowerName) {
          focusOnObject(m, this.camera, this.controls);
          return;
        }
      }
    }
    console.warn(`Object '${name}' not found.`);
  }

  exitFocus() {
    exitFocusMode(this.controls);
  }

  rotateToDarkSide() {
    const target = this.controls.target;
    const camera = this.camera;

    // Sun is at 0,0,0
    const sunPos = new THREE.Vector3(0, 0, 0);
    const objPos = target.clone();

    // Vector from Sun to Object
    const sunToObj = new THREE.Vector3().subVectors(objPos, sunPos).normalize();
    const dist = camera.position.distanceTo(objPos);

    // New position: ObjectPos + SunToObj * dist
    // This places the camera directly behind the object relative to the Sun
    const newPos = objPos.clone().add(sunToObj.multiplyScalar(dist));

    camera.position.copy(newPos);
    this.controls.update();
  }

  // --- Visual Settings ---

  setReferencePlane(plane) {
    if (plane !== 'Equatorial' && plane !== 'Ecliptic') {
      console.warn("Invalid plane. Use 'Equatorial' or 'Ecliptic'.");
      return;
    }
    config.referencePlane = plane;
    updateReferencePlane(plane, this.universeGroup);
  }

  setStarBrightness(val) {
    config.starBrightness = Math.max(0, Math.min(1, val));
    updateStarBrightness(config.starBrightness, this.starsRef);
  }

  toggleOrbits(visible) {
    config.showOrbits = visible;
    updateOrbitsVisibility(visible, this.orbitGroup, this.planets, null);
  }

  toggleAxes(visible) {
    config.showAxes = visible;
    updateAxesVisibility(visible, this.sun, this.planets);
  }

  toggleZodiacs(visible) {
    config.showZodiacs = visible;
    updateConstellationsVisibility(this.zodiacGroup, this.constellationsGroup);
  }

  toggleConstellations(visible) {
    config.showConstellations = visible;
    updateConstellationsVisibility(this.zodiacGroup, this.constellationsGroup);
  }

  toggleZodiacSigns(visible) {
    config.showZodiacSigns = visible;
    updateZodiacSignsVisibility(visible, this.zodiacSignsGroup);
  }

  toggleHabitableZone(visible) {
    config.showHabitableZone = visible;
    updateHabitableZoneVisibility(visible, this.habitableZone);
  }

  toggleMagneticFields(visible) {
    config.showMagneticFields = visible;
    updateMagneticFieldsVisibility(visible, this.magneticFieldsGroup, this.planets, null);
  }

  toggleSunMagneticFieldBasic(visible) {
    config.showSunMagneticFieldBasic = visible;
    if (this.universeGroup) {
      const field = this.universeGroup.children.find((c) => c.name === 'SunMagneticFieldBasic');
      if (field) field.visible = visible;
    }
  }

  toggleSunMagneticFieldSolarWind(visible) {
    config.showSunMagneticField = visible;
    if (this.universeGroup) {
      const field = this.universeGroup.children.find((c) => c.name === 'MagneticField');
      if (field) field.visible = visible;
    }
  }

  // --- Object Visibility ---

  toggleSun(visible) {
    config.showSun = visible;
    updateSunVisibility(visible, this.sun);
  }

  togglePlanets(visible) {
    config.showPlanets = visible;
    updatePlanetVisibility(visible, this.planets);
  }

  toggleDwarfPlanets(visible) {
    config.showDwarfPlanets = visible;
    updateDwarfVisibility(visible, this.planets);
  }

  toggleMoons(category, visible) {
    // category: 'largest', 'major', 'small'
    if (category === 'largest') config.showLargestMoons = visible;
    else if (category === 'major') config.showMajorMoons = visible;
    else if (category === 'small') config.showSmallMoons = visible;
    else {
      console.warn("Invalid moon category. Use 'largest', 'major', or 'small'.");
      return;
    }
    updateMoonVisibility(visible, this.planets, category);
  }
}
