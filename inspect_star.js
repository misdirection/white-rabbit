import fs from 'fs';

const stars = JSON.parse(fs.readFileSync('public/assets/stars_3d.json', 'utf8'));

// Spica (HR 5056) and Regulus (HR 3982)
const spica = stars.find((s) => s.i === 5056);
const regulus = stars.find((s) => s.i === 3982);

console.log('--- Spica (HR 5056) ---');
if (spica) {
  console.log(JSON.stringify(spica, null, 2));
  console.log(`Expected Ecliptic Z ~ 0. Expected Equatorial Z ~ -0.19.`);
} else {
  console.log('Not found.');
}

console.log('--- Regulus (HR 3982) ---');
if (regulus) {
  console.log(JSON.stringify(regulus, null, 2));
  console.log(`Expected Ecliptic Z ~ 0. Expected Equatorial Z ~ 0.20.`);
} else {
  console.log('Not found.');
}
