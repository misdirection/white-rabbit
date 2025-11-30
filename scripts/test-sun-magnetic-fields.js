// Test script for Sun's magnetic field visualizations
// Run in browser console after the simulation loads

console.log('Testing Sun Magnetic Field Controls...');

// Test 1: Enable coronal loops (basic field)
console.log('Enabling coronal loops...');
SimulationControl.toggleSunMagneticFieldBasic(true);

setTimeout(() => {
  // Test 2: Also enable solar wind field
  console.log('Enabling solar wind field...');
  SimulationControl.toggleSunMagneticFieldSolarWind(true);

  setTimeout(() => {
    // Test 3: Disable solar wind, keep coronal loops
    console.log('Disabling solar wind, keeping coronal loops...');
    SimulationControl.toggleSunMagneticFieldSolarWind(false);

    setTimeout(() => {
      // Test 4: Swap - enable solar wind, disable coronal loops
      console.log('Swapping: enabling solar wind, disabling coronal loops...');
      SimulationControl.toggleSunMagneticFieldBasic(false);
      SimulationControl.toggleSunMagneticFieldSolarWind(true);

      setTimeout(() => {
        // Test 5: Disable all
        console.log('Disabling all magnetic fields...');
        SimulationControl.toggleSunMagneticFieldBasic(false);
        SimulationControl.toggleSunMagneticFieldSolarWind(false);
        console.log('Test complete!');
      }, 3000);
    }, 3000);
  }, 3000);
}, 2000);
