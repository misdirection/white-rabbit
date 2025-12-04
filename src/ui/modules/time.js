import { windowManager } from '../WindowManager.js';

export function setupTimeFolder(_gui, uiState, config) {
  // Create Time Window
  const timeWindowObj = windowManager.createWindow('time-window', 'Time & Speed', {
    x: 20,
    y: window.innerHeight - 280, // Position lower left, aligned with dock margin
    width: '250px',
    onClose: () => {
      // Optional: toggle dock state
    },
  });

  const content = timeWindowObj.content;
  content.classList.add('time-window-content');

  // --- Date/Time Display ---
  const dateDisplay = document.createElement('div');
  dateDisplay.className = 'time-display';
  dateDisplay.textContent = uiState.date; // Initial
  content.appendChild(dateDisplay);

  // --- Speedometer & Controls ---
  const speedometerContainer = document.createElement('div');
  speedometerContainer.className = 'speedometer-container';
  speedometerContainer.innerHTML = `
        <div class="gauge-arc"></div>
        <div class="gauge-needle"></div>
        <div class="digital-speed">0x</div>
        <div class="speedometer-interaction"></div>
    `;
  content.appendChild(speedometerContainer);

  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'control-buttons';

  const buttons = [
    { label: '<<', action: 'rewind' },
    { label: '<', action: 'reverse' },
    { label: '||', action: 'pause' },
    { label: '>', action: 'play' },
    { label: '>>', action: 'forward' },
  ];

  buttons.forEach((btn) => {
    const b = document.createElement('div');
    b.className = 'control-btn';
    b.textContent = btn.label;
    b.dataset.action = btn.action;
    b.onclick = () => handleControlClick(btn.action);
    controlsContainer.appendChild(b);
  });
  content.appendChild(controlsContainer);

  // --- Logic (Reused) ---
  const needle = speedometerContainer.querySelector('.gauge-needle');
  const digitalDisplay = speedometerContainer.querySelector('.digital-speed');
  const interactionZone = speedometerContainer.querySelector('.speedometer-interaction');

  function formatSpeed(speed) {
    if (speed === 0) return 'PAUSED';
    const absSpeed = Math.abs(speed);
    let label = '';
    if (absSpeed >= 1e9) label = Math.round(absSpeed / 1e9).toLocaleString() + ' b';
    else if (absSpeed >= 1e6) label = Math.round(absSpeed / 1e6).toLocaleString() + ' m';
    else if (absSpeed >= 100) label = Math.round(absSpeed).toLocaleString() + 'x';
    else if (absSpeed >= 10) label = absSpeed.toFixed(1) + 'x';
    else label = absSpeed.toFixed(2) + 'x';
    return label;
  }

  function updateSpeedometer() {
    const speed = config.simulationSpeed;
    let angle = 0;
    if (speed !== 0) {
      const sign = Math.sign(speed);
      const absSpeed = Math.abs(speed);
      const exponent = Math.log10(absSpeed);
      const clampedExp = Math.max(0, Math.min(10, exponent));
      angle = (clampedExp / 10) * 90 * sign;
    }
    needle.style.transform = `rotate(${angle}deg)`;
    if (speed === 0) {
      digitalDisplay.textContent = 'PAUSED';
      digitalDisplay.style.color = '#ffaa88';
    } else {
      digitalDisplay.textContent = formatSpeed(speed);
      digitalDisplay.style.color = '#aaccff';
    }
    controlsContainer.querySelectorAll('.control-btn').forEach((b) => {
      b.classList.remove('active');
      const action = b.dataset.action;
      if (action === 'pause' && speed === 0) b.classList.add('active');
      if (action === 'play' && speed === 1) b.classList.add('active');
      if (action === 'reverse' && speed === -1) b.classList.add('active');
    });

    // Update Date Display
    dateDisplay.textContent = uiState.date + ' ' + uiState.time;
  }

  uiState.updateSpeedometer = updateSpeedometer;
  updateSpeedometer();

  // Interaction Logic
  function setSpeedFromAngle(angleDeg) {
    angleDeg = Math.max(-90, Math.min(90, angleDeg));
    if (Math.abs(angleDeg) < 1) {
      config.simulationSpeed = 0;
      uiState.speedFactor = '0x';
    } else {
      const sign = Math.sign(angleDeg);
      const ratio = Math.abs(angleDeg) / 90;
      const exponent = ratio * 10;
      const speed = sign * 10 ** exponent;
      config.simulationSpeed = speed;
      uiState.speedFactor = formatSpeed(speed);
    }
    updateSpeedometer();
  }

  function handleInteraction(e) {
    const rect = interactionZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const bottomY = rect.bottom;
    const x = e.clientX - centerX;
    const y = bottomY - e.clientY;
    const angleRad = Math.atan2(y, x);
    const angleDeg = 90 - (angleRad * 180) / Math.PI;
    setSpeedFromAngle(angleDeg);
  }

  let isDragging = false;
  interactionZone.addEventListener('mousedown', (e) => {
    isDragging = true;
    handleInteraction(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (isDragging) handleInteraction(e);
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  function handleControlClick(action) {
    const currentSpeed = config.simulationSpeed;
    const mag = currentSpeed === 0 ? 0 : Math.log10(Math.abs(currentSpeed));
    // let sign = Math.sign(currentSpeed); // Unused
    // if (currentSpeed === 0) sign = 1;

    switch (action) {
      case 'pause':
        config.simulationSpeed = 0;
        break;
      case 'play':
        config.simulationSpeed = 1;
        break;
      case 'reverse':
        config.simulationSpeed = -1;
        break;
      case 'forward':
        if (currentSpeed < 0) {
          const targetMag = Math.floor(mag) - 1;
          if (targetMag < 0) config.simulationSpeed = 1;
          else config.simulationSpeed = -(10 ** targetMag);
        } else {
          if (currentSpeed === 0) config.simulationSpeed = 1;
          else {
            const targetMag = Math.min(10, Math.floor(mag) + 1);
            config.simulationSpeed = 10 ** targetMag;
          }
        }
        break;
      case 'rewind':
        if (currentSpeed > 0) {
          const targetMag = Math.floor(mag) - 1;
          if (targetMag < 0) config.simulationSpeed = -1;
          else config.simulationSpeed = 10 ** targetMag;
        } else {
          if (currentSpeed === 0) config.simulationSpeed = -1;
          else {
            const targetMag = Math.min(10, Math.floor(mag) + 1);
            config.simulationSpeed = -(10 ** targetMag);
          }
        }
        break;
    }
    uiState.speedFactor = formatSpeed(config.simulationSpeed);
    updateSpeedometer();
  }

  // Return controls for gui.js to update
  // We mock the updateDisplay methods since we don't use lil-gui controllers anymore
  return {
    dateCtrl: { updateDisplay: () => {}, domElement: { querySelector: () => null } },
    timeCtrl: { updateDisplay: () => {} },
    stardateCtrl: { updateDisplay: () => {} },
    speedDisplay: { update: updateSpeedometer },
  };
}
