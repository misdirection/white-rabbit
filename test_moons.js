import * as Astronomy from 'astronomy-engine';

const date = new Date();
const jm = Astronomy.JupiterMoons(date);

console.log('Io x:', jm.io.x);
console.log('Io y:', jm.io.y);
console.log('Io z:', jm.io.z);
console.log('Jupiter Helio:', Astronomy.HelioVector(Astronomy.Body.Jupiter, date));
