import { config } from '../../config.js';

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

export function setupOverlaysFolder(gui, orbitGroup, zodiacGroup, planets, sun, zodiacSignsGroup, habitableZone) {
    const overlaysFolder = gui.addFolder('Overlays');

    overlaysFolder.add(config, 'showOrbits').name('Orbits').onChange(val => {
        orbitGroup.visible = val;
        planets.forEach(p => {
            p.moons.forEach(m => {
                if (m.data.orbitLine) m.data.orbitLine.visible = val;
            });
        });
    });

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

    overlaysFolder.add(config, 'showZodiacs').name('Zodiacs').onChange(val => {
        zodiacGroup.visible = val;
    });

    overlaysFolder.add(config, 'showZodiacSigns').name('Zodiac Signs').onChange(val => {
        if (zodiacSignsGroup) {
            zodiacSignsGroup.visible = val;
        }
    });

    overlaysFolder.add(config, 'showHabitableZone').name('Habitable Zone').onChange(val => {
        if (habitableZone) {
            habitableZone.visible = val;
        }
    });


    overlaysFolder.close();
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
