import * as THREE from 'three';
import { config, PARSEC_TO_SCENE } from '../config.js';
import { ZODIAC_IDS, ZODIAC_SIGNS } from '../data/zodiac.js';
import { Logger } from '../utils/logger.js';

export function createZodiacSigns(scene, textureLoader) {
  const zodiacSignsGroup = new THREE.Group();
  zodiacSignsGroup.visible = config.showZodiacSigns || false;
  scene.add(zodiacSignsGroup);

  // Load the sprite sheet
  const texturePath = `${import.meta.env.BASE_URL}assets/zodiac_signs_sheet.png`;
  Logger.log('ZodiacSigns: Loading texture from', texturePath);

  textureLoader.load(
    texturePath,
    (texture) => {
      Logger.log('ZodiacSigns: Texture loaded successfully');
      texture.colorSpace = THREE.SRGBColorSpace;

      const size = 5000; // Size of each sign (increased for better visibility at distance)

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
          blending: THREE.AdditiveBlending,
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(size, size, 1);

        // Initial position (hidden or default until data loads)
        sprite.visible = false;
        sprite.userData = { zodiacIndex: i, zodiacId: ZODIAC_IDS[i] };

        zodiacSignsGroup.add(sprite);
      });
    },
    undefined,
    (err) => {
      Logger.error('ZodiacSigns: Error loading texture', err);
    }
  );

  return zodiacSignsGroup;
}

export async function alignZodiacSigns(zodiacSignsGroup, starsData) {
  if (!zodiacSignsGroup) return;

  // Place zodiac signs in a perfect circle at 30° intervals on the ecliptic
  // This is more intuitive for users than star-centroid-based placement

  // Position at ~100 parsecs (a reasonable distance for zodiac signs, consistent with stars)
  const RADIUS = PARSEC_TO_SCENE * 100; // ~100 parsecs in scene units
  const SIZE = RADIUS * 0.08; // Size proportional to distance

  // Ecliptic tilt (23.44 degrees)
  const eclipticTilt = (23.44 * Math.PI) / 180;

  // Starting angle: Aries begins at the vernal equinox (0° ecliptic longitude)
  // In our coordinate system, we need to offset to align with the celestial sphere
  const startAngle = 0; // Radians, adjust if needed for alignment

  zodiacSignsGroup.children.forEach((sprite, i) => {
    if (!sprite.isSprite) return;

    // Each sign occupies 30° (π/6 radians)
    // Place at the center of each 30° segment (offset by 15°)
    const angle = startAngle + (i * Math.PI) / 6 + Math.PI / 12;

    // Calculate position on the ecliptic plane (tilted relative to equatorial)
    // First calculate position on ecliptic plane (XY plane)
    const eclipticX = RADIUS * Math.cos(angle);
    const eclipticY = RADIUS * Math.sin(angle);
    const eclipticZ = 0;

    // Rotate around X-axis by ecliptic tilt to transform to equatorial coordinates
    const x = eclipticX;
    const y = eclipticY * Math.cos(eclipticTilt) - eclipticZ * Math.sin(eclipticTilt);
    const z = eclipticY * Math.sin(eclipticTilt) + eclipticZ * Math.cos(eclipticTilt);

    // Apply our scene coordinate transform (X, Z, -Y for scene coordinates)
    sprite.position.set(x, z, -y);
    sprite.scale.set(SIZE, SIZE, 1);
    sprite.visible = true;
  });

  Logger.log('ZodiacSigns: Aligned signs in perfect circle on ecliptic');
}
