
import * as THREE from 'three';
import { config } from '../config.js';

const ZODIAC_SIGNS = [
    { name: 'Aries', index: 0 },
    { name: 'Taurus', index: 1 },
    { name: 'Gemini', index: 2 },
    { name: 'Cancer', index: 3 },
    { name: 'Leo', index: 4 },
    { name: 'Virgo', index: 5 },
    { name: 'Libra', index: 6 },
    { name: 'Scorpio', index: 7 },
    { name: 'Sagittarius', index: 8 },
    { name: 'Capricorn', index: 9 },
    { name: 'Aquarius', index: 10 },
    { name: 'Pisces', index: 11 }
];

const ZODIAC_IDS = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc'];

export function createZodiacSigns(scene, textureLoader) {
    const zodiacSignsGroup = new THREE.Group();
    zodiacSignsGroup.visible = config.showZodiacSigns || false;
    scene.add(zodiacSignsGroup);

    // Load the sprite sheet
    const texturePath = `${import.meta.env.BASE_URL}assets/zodiac_signs_sheet.png`;
    console.log("ZodiacSigns: Loading texture from", texturePath);

    textureLoader.load(texturePath, (texture) => {
        console.log("ZodiacSigns: Texture loaded successfully");
        texture.colorSpace = THREE.SRGBColorSpace;

        const size = 5000;   // Size of each sign (increased for better visibility at distance)

        ZODIAC_SIGNS.forEach((sign, i) => {
            // Clone texture to set different offset/repeat for each sprite
            const signTexture = texture.clone();
            signTexture.needsUpdate = true;

            // 4 columns, 3 rows
            const col = i % 4;
            const row = 2 - Math.floor(i / 4); // Flip row index because UV 0,0 is bottom-left

            signTexture.repeat.set(0.25, 0.333);
            signTexture.offset.set(col * 0.25, row * 0.333);

            const material = new THREE.SpriteMaterial({
                map: signTexture,
                transparent: true,
                opacity: 0.8,
                color: 0xffffff,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });

            const sprite = new THREE.Sprite(material);
            sprite.scale.set(size, size, 1);

            // Initial position (hidden or default until data loads)
            sprite.visible = false;
            sprite.userData = { zodiacIndex: i, zodiacId: ZODIAC_IDS[i] };

            zodiacSignsGroup.add(sprite);
        });
    }, undefined, (err) => {
        console.error("ZodiacSigns: Error loading texture", err);
    });

    return zodiacSignsGroup;
}

export async function alignZodiacSigns(zodiacSignsGroup, starsData) {
    if (!zodiacSignsGroup || !starsData) return;

    try {
        // Load zodiac lines to get star IDs for each constellation
        const response = await fetch(`${import.meta.env.BASE_URL}assets/zodiac_lines.json`);
        const zodiacLines = await response.json();

        // Map star IDs to positions
        const SCALE = 10000;
        const starPositionMap = {};
        starsData.forEach(star => {
            if (star.x != null && star.y != null && star.z != null && star.i != null) {
                starPositionMap[star.i] = new THREE.Vector3(
                    star.x * SCALE,
                    star.y * SCALE,
                    star.z * SCALE
                );
            }
        });

        // Update each sprite position
        zodiacSignsGroup.children.forEach(sprite => {
            if (!sprite.isSprite) return;

            const zodiacId = sprite.userData.zodiacId;
            const starIds = zodiacLines[zodiacId];

            if (starIds && starIds.length > 0) {
                // Calculate centroid
                const centroid = new THREE.Vector3();
                let count = 0;

                starIds.forEach(id => {
                    const pos = starPositionMap[id];
                    if (pos) {
                        centroid.add(pos);
                        count++;
                    }
                });

                if (count > 0) {
                    centroid.divideScalar(count);

                    // Position sprite at centroid
                    sprite.position.copy(centroid);
                    sprite.visible = true;

                    // Scale based on distance
                    const distance = centroid.length();
                    const scaleFactor = 0.15;
                    const newSize = distance * scaleFactor;
                    sprite.scale.set(newSize, newSize, 1);
                }
            }
        });

        console.log("ZodiacSigns: Aligned signs to constellations");

    } catch (error) {
        console.error("ZodiacSigns: Error aligning signs", error);
    }
}


