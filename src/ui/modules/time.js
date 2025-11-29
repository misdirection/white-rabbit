import { addValueDisplay } from './utils.js';

export function setupTimeFolder(gui, uiState, config) {
  const timeFolder = gui.addFolder('Time & Speed');
  timeFolder.domElement.classList.add('time-folder');

  const dateCtrl = timeFolder
    .add(uiState, 'date')
    .name('Date')
    .onChange((val) => {
      const [year, month, day] = val.split('-').map(Number);
      // Create new date from selected YYYY-MM-DD
      // Maintain current time of day
      const current = config.date;
      config.date = new Date(
        year,
        month - 1,
        day,
        current.getHours(),
        current.getMinutes(),
        current.getSeconds()
      );
    });
  dateCtrl.domElement.classList.add('compact-ctrl');

  // Hack to make it a date input
  const dateInput = dateCtrl.domElement.querySelector('input');
  dateInput.type = 'date';
  const timeCtrl = timeFolder.add(uiState, 'time').name('Time');
  timeCtrl.disable();
  timeCtrl.domElement.classList.add('compact-ctrl');

  const stardateCtrl = timeFolder.add(uiState, 'stardate').name('Stardate');
  stardateCtrl.disable();

  uiState.setNow = () => {
    config.date = new Date();
  };
  const setNowCtrl = timeFolder.add(uiState, 'setNow').name('NOW');
  setNowCtrl.domElement.classList.add('set-now-btn');

  // Add a dummy controller for the "Speed" label
  const speedLabel = { speed: '' };
  const speedCtrl = timeFolder.add(speedLabel, 'speed').name('Speed');
  speedCtrl.domElement.querySelector('input').style.display = 'none'; // Hide input
  speedCtrl.domElement.classList.add('speed-label-row');

  // --- Speedometer & Controls ---

  // Container for Speedometer
  const speedometerContainer = document.createElement('div');
  speedometerContainer.className = 'speedometer-container';
  speedometerContainer.innerHTML = `
        <div class="gauge-arc"></div>
        <div class="gauge-needle"></div>
        <div class="digital-speed">0x</div>
        <div class="speedometer-interaction"></div>
    `;

  // Container for Buttons
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

  // Insert into DOM
  const childrenContainer = timeFolder.domElement.querySelector('.children');
  // Append to the end
  childrenContainer.appendChild(speedometerContainer);
  childrenContainer.appendChild(controlsContainer);

  // --- Logic ---

  const needle = speedometerContainer.querySelector('.gauge-needle');
  const digitalDisplay = speedometerContainer.querySelector('.digital-speed');
  const interactionZone = speedometerContainer.querySelector('.speedometer-interaction');

  function formatSpeed(speed) {
    if (speed === 0) return 'PAUSED';

    const absSpeed = Math.abs(speed);
    let label = '';

    if (absSpeed >= 1e9) {
      // Billions - no decimals
      label = Math.round(absSpeed / 1e9).toLocaleString() + ' b';
    } else if (absSpeed >= 1e6) {
      // Millions - no decimals
      label = Math.round(absSpeed / 1e6).toLocaleString() + ' m';
    } else if (absSpeed >= 100) {
      // 100x and above - no decimals
      label = Math.round(absSpeed).toLocaleString() + 'x';
    } else if (absSpeed >= 10) {
      // 10x to 100x - one decimal place
      label = absSpeed.toFixed(1) + 'x';
    } else {
      // Below 10x - two decimal places
      label = absSpeed.toFixed(2) + 'x';
    }

    return label;
  }

  function updateSpeedometer() {
    const speed = config.simulationSpeed;
    let angle = 0;

    if (speed !== 0) {
      const sign = Math.sign(speed);
      const absSpeed = Math.abs(speed);
      const exponent = Math.log10(absSpeed);
      const clampedExp = Math.max(0, Math.min(11, exponent));
      angle = (clampedExp / 11) * 90 * sign;
    }

    needle.style.transform = `rotate(${angle}deg)`;

    // Update Digital Display
    if (speed === 0) {
      digitalDisplay.textContent = 'PAUSED';
      digitalDisplay.style.color = '#ffaa88';
    } else {
      digitalDisplay.textContent = formatSpeed(speed);
      digitalDisplay.style.color = '#aaccff';
    }

    // Update active buttons
    controlsContainer.querySelectorAll('.control-btn').forEach((b) => {
      b.classList.remove('active');
      const action = b.dataset.action;
      if (action === 'pause' && speed === 0) b.classList.add('active');
      if (action === 'play' && speed === 1) b.classList.add('active');
      if (action === 'reverse' && speed === -1) b.classList.add('active');
    });
  }

  // We no longer have a slider to hook into.
  // We need to expose an update function or poll?
  // The GUI update loop calls updateUI in gui.js.
  // We can attach this update function to uiState so gui.js can call it if needed,
  // OR we just rely on the fact that config.simulationSpeed is the source of truth
  // and we update the UI whenever we change it here.
  // BUT if something else changes speed (e.g. keyboard shortcut?), the UI won't update.
  // Let's attach it to uiState.
  uiState.updateSpeedometer = updateSpeedometer;

  // Initial update
  updateSpeedometer();

  // --- Interaction Logic ---

  function setSpeedFromAngle(angleDeg) {
    // Clamp angle
    angleDeg = Math.max(-90, Math.min(90, angleDeg));

    // Snap to 0 if close to center
    if (Math.abs(angleDeg) < 5) {
      config.simulationSpeed = 0;
      uiState.speedFactor = '0x';
    } else {
      const sign = Math.sign(angleDeg);
      const ratio = Math.abs(angleDeg) / 90;
      const exponent = ratio * 11;
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
    const y = bottomY - e.clientY; // Y goes up from bottom

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
    if (isDragging) {
      handleInteraction(e);
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // --- Button Logic ---

  function handleControlClick(action) {
    const currentSpeed = config.simulationSpeed;
    // Handle 0 case for log math
    const mag = currentSpeed === 0 ? 0 : Math.log10(Math.abs(currentSpeed));
    let sign = Math.sign(currentSpeed);
    if (currentSpeed === 0) sign = 1; // Default to forward if paused

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
        // Snap to next power of 10
        if (currentSpeed < 0) {
          // Moving towards 0 (e.g. -100 -> -10)
          // Current mag is 2. Target is 1.
          const targetMag = Math.floor(mag) - 1;
          // If we cross 0, flip to positive
          if (targetMag < 0) {
            config.simulationSpeed = 1; // Start forward
          } else {
            config.simulationSpeed = -(10 ** targetMag);
          }
        } else {
          // Moving away from 0 (e.g. 10 -> 100)
          // If 0, go to 1
          if (currentSpeed === 0) {
            config.simulationSpeed = 1;
          } else {
            const targetMag = Math.floor(mag) + 1;
            config.simulationSpeed = 10 ** targetMag;
          }
        }
        break;
      case 'rewind':
        // Snap to previous power of 10 (more negative)
        if (currentSpeed > 0) {
          // Moving towards 0 (e.g. 100 -> 10)
          const targetMag = Math.floor(mag) - 1;
          if (targetMag < 0) {
            config.simulationSpeed = -1; // Start reverse
          } else {
            config.simulationSpeed = 10 ** targetMag;
          }
        } else {
          // Moving away from 0 (e.g. -10 -> -100)
          if (currentSpeed === 0) {
            config.simulationSpeed = -1;
          } else {
            const targetMag = Math.floor(mag) + 1;
            config.simulationSpeed = -(10 ** targetMag);
          }
        }
        break;
    }

    uiState.speedFactor = formatSpeed(config.simulationSpeed);
    updateSpeedometer();
  }

  timeFolder.close(); // Close Time folder by default

  return {
    dateCtrl,
    timeCtrl,
    stardateCtrl,
    speedDisplay: { update: updateSpeedometer },
  };
}
