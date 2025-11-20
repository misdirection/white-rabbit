import * as THREE from 'three';
import { raDecToVector } from './utils.js';

const STAR_DISTANCE = 10000;
const ZODIAC_IDS = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc'];

export async function createStarfield(scene) {
    try {
        const response = await fetch('/assets/stars.json');
        const data = await response.json();
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const sizes = [];
        const color = new THREE.Color();

        data.features.forEach(feature => {
            const [ra, dec] = feature.geometry.coordinates;
            const mag = feature.properties.mag;
            const pos = raDecToVector(ra, dec, STAR_DISTANCE);
            positions.push(pos.x, pos.y, pos.z);
            const intensity = Math.max(0.1, 1 - (mag + 1.5) / 8);
            color.setHSL(0.6, 0.2, intensity);
            colors.push(color.r, color.g, color.b);
            const size = Math.max(0.5, (6 - mag) * 1.5);
            sizes.push(size);
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            vertexColors: true,
            size: 2,
            sizeAttenuation: false
        });

        const stars = new THREE.Points(geometry, material);
        scene.add(stars);
    } catch (error) {
        console.error("Error loading stars:", error);
    }
}

export async function createConstellations(zodiacGroup) {
    try {
        const response = await fetch('/assets/constellations.json');
        const data = await response.json();
        const material = new THREE.LineBasicMaterial({ color: 0x446688, transparent: true, opacity: 0.6 });

        data.features.forEach(feature => {
            if (ZODIAC_IDS.includes(feature.id)) {
                feature.geometry.coordinates.forEach(lineString => {
                    const stripPoints = [];
                    lineString.forEach(coord => {
                        const [ra, dec] = coord;
                        stripPoints.push(raDecToVector(ra, dec, STAR_DISTANCE));
                    });
                    const stripGeometry = new THREE.BufferGeometry().setFromPoints(stripPoints);
                    const line = new THREE.Line(stripGeometry, material);
                    zodiacGroup.add(line);
                });
            }
        });
    } catch (error) {
        console.error("Error loading constellations:", error);
    }
}
