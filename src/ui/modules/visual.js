import { config, REAL_PLANET_SCALE_FACTOR } from '../../config.js';

export function setupVisualFolder(gui, starsRef, renderer) {
    const visualFolder = gui.addFolder('Visual');

    const updateStarBrightness = (val) => {
        const stars = starsRef.value;
        if (stars && stars.material) {
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
                intensity = 1.0 + Math.pow(t, 3) * 99.0;
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
    };

    const starSlider = visualFolder.add(config, 'starBrightness', 0.0, 1.0).name('Star Brightness').onChange(updateStarBrightness);
    starSlider.domElement.classList.add('hide-value');

    // Initialize star brightness state
    updateStarBrightness(config.starBrightness);

    const gammaSlider = visualFolder.add(config, 'gamma', 0.1, 5.0).name('Gamma').onChange(val => {
        if (renderer) {
            renderer.toneMappingExposure = val;
        }
    });
    gammaSlider.domElement.classList.add('hide-value');

    visualFolder.close(); // Close Visual folder by default
}

export function setupOverlaysFolder(gui, orbitGroup, zodiacGroup, planets, sun, zodiacSignsGroup, habitableZone, magneticFieldsGroup) {
    const overlaysFolder = gui.addFolder('Overlays');

    // Orbits
    overlaysFolder.add(config, 'showOrbits').name('Orbits').onChange(val => {
        orbitGroup.visible = val;
        planets.forEach(p => {
            p.moons.forEach(m => {
                if (m.data.orbitLine) m.data.orbitLine.visible = val;
            });
        });
        updateCapMoonOrbitsVisibility();
    });

    const capMoonOrbitsCtrl = overlaysFolder.add(config, 'capMoonOrbits')
        .name('Cap Moon Orbits When Scaling')
        .onChange(() => {
            // Moon positions will be updated in the next animation frame
        });
    capMoonOrbitsCtrl.domElement.classList.add('child-control');

    // Show/hide child control based on parent state
    const updateCapMoonOrbitsVisibility = () => {
        capMoonOrbitsCtrl.domElement.style.display = config.showOrbits ? '' : 'none';
    };
    updateCapMoonOrbitsVisibility();

    // Axes
    overlaysFolder.add(config, 'showAxes').name('Axes').onChange(val => {
        // Toggle sun axis
        if (sun.axisLine) sun.axisLine.visible = val;

        // Toggle planet axes
        planets.forEach(p => {
            if (p.data.axisLine) p.data.axisLine.visible = val;

            // Toggle moon axes
            p.moons.forEach(m => {
                if (m.data.axisLine) m.data.axisLine.visible = val;
            });
        });
    });

    // Zodiacs
    overlaysFolder.add(config, 'showZodiacs').name('Zodiacs').onChange(val => {
        zodiacGroup.visible = val;
    });

    // Zodiac Signs
    overlaysFolder.add(config, 'showZodiacSigns').name('Zodiac Signs').onChange(val => {
        if (zodiacSignsGroup) {
            zodiacSignsGroup.visible = val;
        }
    });

    // Habitable Zone
    overlaysFolder.add(config, 'showHabitableZone').name('Habitable Zone').onChange(val => {
        if (habitableZone) {
            habitableZone.visible = val;
        }
    });

    // Magnetic Fields
    overlaysFolder.add(config, 'showMagneticFields').name('Magnetic Fields').onChange(val => {
        if (magneticFieldsGroup) {
            magneticFieldsGroup.visible = val;

            planets.forEach(p => {
                p.mesh.children.forEach(child => {
                    if (child.type === 'Group' && child.children.length > 0 && child.children[0].type === 'Line') {
                        child.visible = val;
                    }
                });

                // Also moons
                p.moons.forEach(m => {
                    m.mesh.children.forEach(child => {
                        if (child.type === 'Group' && child.children.length > 0 && child.children[0].type === 'Line') {
                            child.visible = val;
                        }
                    });
                });
            });
        }
        updateCapMagneticFieldsVisibility();
    });

    const capMagneticFieldsCtrl = overlaysFolder.add(config, 'capMagneticFields')
        .name('Cap When Scaling')
        .onChange(() => {
            updateMagneticFieldScales(planets);
        });
    capMagneticFieldsCtrl.domElement.classList.add('child-control');

    // Show/hide child control based on parent state
    const updateCapMagneticFieldsVisibility = () => {
        capMagneticFieldsCtrl.domElement.style.display = config.showMagneticFields ? '' : 'none';
    };
    updateCapMagneticFieldsVisibility();

    overlaysFolder.close();
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

    planets.forEach(p => {
        // Planet fields
        const field = p.mesh.getObjectByName('MagneticField');
        if (field) field.scale.setScalar(magScale);

        // Moon fields
        p.moons.forEach(m => {
            const mField = m.mesh.getObjectByName('MagneticField');
            if (mField) mField.scale.setScalar(magScale);
        });
    });
}

export function setupObjectsFolder(gui, planets, sun) {
    const objectsFolder = gui.addFolder('Objects');

    objectsFolder.add(config, 'showSun').name('Sun').onChange(val => {
        sun.visible = val;
    });

    const updatePlanetVisibility = (val) => {
        planets.forEach(p => {
            if (p.data.type !== 'dwarf') {
                p.mesh.visible = val;
                if (p.data.cloudMesh) p.data.cloudMesh.visible = val;

                // Toggle planet orbit line
                if (p.orbitLine) p.orbitLine.visible = val;

                // Rings should also be toggled
                p.group.children.forEach(child => {
                    if (child !== p.mesh && child !== p.orbitLinesGroup && child.type === 'Mesh') {
                        // This catches rings
                        child.visible = val;
                    }
                });
            }
        });
    };
    objectsFolder.add(config, 'showPlanets').name('Planets').onChange(updatePlanetVisibility);
    updatePlanetVisibility(config.showPlanets);

    const updateDwarfVisibility = (val) => {
        planets.forEach(p => {
            if (p.data.type === 'dwarf') {
                p.group.visible = val;
                if (p.orbitLine) p.orbitLine.visible = val;
            }
        });
    };
    objectsFolder.add(config, 'showDwarfPlanets').name('Dwarf Planets').onChange(updateDwarfVisibility);
    updateDwarfVisibility(config.showDwarfPlanets);

    const updateLargestMoonsVisibility = (val) => {
        planets.forEach(p => {
            p.moons.forEach(m => {
                if (m.data.category === 'largest') {
                    m.mesh.visible = val;
                    if (m.data.orbitLine) m.data.orbitLine.visible = val;
                }
            });
        });
    };
    objectsFolder.add(config, 'showLargestMoons').name('Largest Moons').onChange(updateLargestMoonsVisibility);
    updateLargestMoonsVisibility(config.showLargestMoons);

    const updateMajorMoonsVisibility = (val) => {
        planets.forEach(p => {
            p.moons.forEach(m => {
                if (m.data.category === 'major') {
                    m.mesh.visible = val;
                    if (m.data.orbitLine) m.data.orbitLine.visible = val;
                }
            });
        });
    };
    objectsFolder.add(config, 'showMajorMoons').name('Major Moons').onChange(updateMajorMoonsVisibility);
    updateMajorMoonsVisibility(config.showMajorMoons);

    const updateSmallMoonsVisibility = (val) => {
        planets.forEach(p => {
            p.moons.forEach(m => {
                if (m.data.category === 'small') {
                    m.mesh.visible = val;
                    if (m.data.orbitLine) m.data.orbitLine.visible = val;
                }
            });
        });
    };
    objectsFolder.add(config, 'showSmallMoons').name('Small Moons').onChange(updateSmallMoonsVisibility);
    updateSmallMoonsVisibility(config.showSmallMoons);

    objectsFolder.close();
}
