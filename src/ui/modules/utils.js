/**
 * Helper to add custom value display next to slider
 * @param {Object} controller - The lil-gui controller
 * @param {Function} formatFn - Function to format the value
 * @returns {Object} Object containing update function
 */
export function addValueDisplay(controller, formatFn) {
  const display = document.createElement('div');
  display.className = 'custom-value';
  controller.domElement.querySelector('.widget').appendChild(display);

  const update = () => {
    display.textContent = formatFn(controller.getValue());
  };

  // Hook into onChange to update display immediately
  const originalOnChange = controller._onChange;
  controller.onChange((val) => {
    update();
    if (originalOnChange) originalOnChange(val);
  });

  update(); // Initial update
  return { update }; // Return interface to force update
}
