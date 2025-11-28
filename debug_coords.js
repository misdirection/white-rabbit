import * as Astronomy from 'astronomy-engine';

// Check Earth's position at J2000
const date = new Date('2000-01-01T12:00:00Z');
const earth = Astronomy.HelioVector(Astronomy.Body.Earth, date);

console.log('Earth HelioVector at J2000 (Equatorial):');
console.log(`x: ${earth.x}, y: ${earth.y}, z: ${earth.z}`);

// Calculate Obliquity of Ecliptic
const obliquity = Astronomy.Obliquity(date);
console.log(`Obliquity of Ecliptic: ${obliquity} degrees`);

// Check if z is 0 (which would mean Ecliptic coordinates)
if (Math.abs(earth.z) < 0.1) {
  console.log('Likely Ecliptic Coordinates (Z ~ 0)');
} else {
  console.log('Likely Equatorial Coordinates (Z != 0)');
}
