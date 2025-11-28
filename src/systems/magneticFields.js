import * as THREE from 'three';

/**
 * Creates a magnetic field visualization for a celestial body.
 * 
 * @param {Object} bodyData - The data object for the planet or moon
 * @param {number} radius - The radius of the body in scene units
 * @returns {THREE.Group} The group containing the magnetic field lines
 */
export function createMagneticField(bodyData, radius) {
    if (!bodyData.magneticField) return null;

    const { strength, tilt, color } = bodyData.magneticField;
    const group = new THREE.Group();
    group.name = 'MagneticField';

    // Number of field lines
    const numLines = 16;
    const segments = 64;

    // Material for the field lines
    const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
    });

    // Generate field lines
    for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;

        // Create multiple loops per angle for volume
        for (let scale = 1.5; scale <= 3.0; scale += 0.5) {
            const points = [];

            // Dipole field equation approximation
            // r = L * sin^2(theta)
            // L is the "shell parameter" (distance at equator)

            // Adjust L based on strength parameter
            // Strength now represents the approximate size in planetary radii.
            // We create shells from 50% to 100% of that size.
            // scale goes from 1.5 to 3.0 (4 steps).
            // We map this to 0.5 * strength to 1.0 * strength.
            const normalizedScale = scale / 3.0; // 0.5 to 1.0
            const L = radius * strength * normalizedScale;

            for (let j = 0; j <= segments; j++) {
                // Theta goes from 0 to PI (pole to pole)
                // Avoid exactly 0 and PI to prevent singularities
                const theta = 0.1 + (j / segments) * (Math.PI - 0.2);

                const r = L * Math.pow(Math.sin(theta), 2);

                // Convert spherical to cartesian
                // x = r * sin(theta) * cos(phi)
                // y = r * sin(theta) * sin(phi)
                // z = r * cos(theta)
                // We align the dipole axis with Y initially

                const x = r * Math.sin(theta) * Math.cos(angle);
                const z = r * Math.sin(theta) * Math.sin(angle);
                const y = r * Math.cos(theta);

                points.push(new THREE.Vector3(x, y, z));
            }

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            group.add(line);
        }
    }

    // Apply tilt
    // Tilt is usually given relative to the rotation axis
    if (tilt) {
        const tiltRadians = tilt * (Math.PI / 180);
        group.rotation.z = tiltRadians; // Tilt around Z axis
    }

    // Initial visibility
    group.visible = false;

    return group;
}
