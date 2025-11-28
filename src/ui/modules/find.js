import * as THREE from 'three';

export function setupFindFolder(gui, planets, sun, starsRef, camera, controls) {
  const findFolder = gui.addFolder('Find');
  findFolder.domElement.classList.add('find-folder');

  const findState = {
    query: '',
    selectedObject: null,
  };

  // Create container for custom HTML
  const findContainer = document.createElement('div');
  findContainer.className = 'find-container';
  findContainer.innerHTML = `
        <div class="find-input-wrapper">
            <label for="find-search">Search</label>
            <input type="text" id="find-search" placeholder="Planets, stars..." autocomplete="off">
        </div>
        <div class="find-actions">
            <button id="btn-look-at" disabled>Look At</button>
            <button id="btn-go-to" disabled>Go To</button>
        </div>
        <div id="find-status"></div>
    `;
  findFolder.domElement.querySelector('.children').appendChild(findContainer);

  // Create results dropdown appended to BODY to avoid overflow issues
  let resultsDiv = document.getElementById('find-results-dropdown');
  if (!resultsDiv) {
    resultsDiv = document.createElement('div');
    resultsDiv.id = 'find-results-dropdown';
    resultsDiv.className = 'find-results';
    document.body.appendChild(resultsDiv);
  }

  const searchInput = findContainer.querySelector('#find-search');
  const lookAtBtn = findContainer.querySelector('#btn-look-at');
  const goToBtn = findContainer.querySelector('#btn-go-to');
  const statusDiv = findContainer.querySelector('#find-status');

  // Update dropdown position
  function updateDropdownPosition() {
    const rect = searchInput.getBoundingClientRect();
    resultsDiv.style.top = `${rect.bottom + 5}px`;
    resultsDiv.style.left = `${rect.left}px`;
    resultsDiv.style.width = `${rect.width}px`;
  }

  // Search Logic
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (query.length < 2) {
      resultsDiv.style.display = 'none';
      return;
    }

    const matches = [];

    // 1. Search Sun
    if ('sun'.includes(query) && sun.visible) {
      matches.push({
        name: 'Sun',
        type: 'Star',
        object: { mesh: sun, data: { name: 'Sun', radius: 5 }, type: 'sun' },
      });
    }

    // 2. Search Planets & Moons
    planets.forEach((p) => {
      if (p.data.name.toLowerCase().includes(query) && p.mesh.visible) {
        matches.push({
          name: p.data.name,
          type: p.data.type === 'dwarf' ? 'Dwarf Planet' : 'Planet',
          object: { mesh: p.mesh, data: p.data, type: 'planet' },
        });
      }
      if (p.moons) {
        p.moons.forEach((m) => {
          if (m.data.name.toLowerCase().includes(query) && m.mesh.visible) {
            matches.push({
              name: m.data.name,
              type: 'Moon',
              object: { mesh: m.mesh, data: m.data, type: 'moon' },
            });
          }
        });
      }
    });

    // 3. Search Stars
    if (starsRef.value && starsRef.value.userData.starData) {
      const stars = starsRef.value.userData.starData;
      // Limit star search to avoid performance hit
      let starCount = 0;
      for (let i = 0; i < stars.length && starCount < 5; i++) {
        const s = stars[i];
        const name = s.name || `HD ${s.id}`;
        if (name.toLowerCase().includes(query) || s.id.toString().includes(query)) {
          // Reconstruct star object for focus
          // We need the position from the geometry
          const positions = starsRef.value.geometry.attributes.position.array;
          const x = positions[i * 3];
          const y = positions[i * 3 + 1];
          const z = positions[i * 3 + 2];

          // Create a dummy mesh for the focus system to target
          const dummyMesh = new THREE.Mesh();
          dummyMesh.position.set(x, y, z);

          matches.push({
            name: name,
            type: 'Star',
            object: {
              mesh: dummyMesh,
              data: { name: name, radius: s.radius || 1 },
              type: 'star',
            },
          });
          starCount++;
        }
      }
    }

    // Display Results
    resultsDiv.innerHTML = '';
    if (matches.length > 0) {
      updateDropdownPosition();
      resultsDiv.style.display = 'block';
      matches.slice(0, 10).forEach((match) => {
        const div = document.createElement('div');
        div.className = 'find-result-item';
        div.innerHTML = `<strong>${match.name}</strong> <span style="opacity:0.7; font-size:0.8em">(${match.type})</span>`;
        div.onclick = () => {
          selectObject(match);
          resultsDiv.style.display = 'none';
        };
        resultsDiv.appendChild(div);
      });
    } else {
      resultsDiv.style.display = 'none';
    }
  });

  // Handle window resize to keep dropdown positioned
  window.addEventListener('resize', () => {
    if (resultsDiv.style.display === 'block') {
      updateDropdownPosition();
    }
  });

  // Handle scroll to keep dropdown positioned (if gui is scrolled)
  findFolder.domElement.closest('.lil-gui').addEventListener(
    'scroll',
    () => {
      if (resultsDiv.style.display === 'block') {
        updateDropdownPosition();
      }
    },
    true
  );

  function selectObject(match) {
    findState.selectedObject = match.object;
    searchInput.value = match.name;
    lookAtBtn.disabled = false;
    goToBtn.disabled = false;
    statusDiv.textContent = `Selected: ${match.name}`;
  }

  lookAtBtn.onclick = () => {
    if (findState.selectedObject && camera && controls) {
      // Import dynamically to avoid circular dependency issues
      import('../../features/focusMode.js').then((module) => {
        if (module.isFocusModeActive()) {
          module.exitFocusMode(controls);
        }

        const target = findState.selectedObject;
        const pos = new THREE.Vector3();

        // Handle dummy meshes for stars
        if (target.mesh.position) {
          target.mesh.getWorldPosition(pos);
        } else {
          pos.copy(target.mesh.position);
        }

        controls.target.copy(pos);
        camera.lookAt(pos);
        controls.update();
      });
    }
  };

  goToBtn.onclick = () => {
    if (findState.selectedObject && camera && controls) {
      // Import dynamically to avoid circular dependency issues if any
      import('../../features/focusMode.js').then((module) => {
        module.focusOnObject(findState.selectedObject, camera, controls);
      });
    }
  };

  // Add a dummy controller to prevent "Empty" message
  findFolder
    .add({ dummy: '' }, 'dummy')
    .name('Hidden')
    .onChange(() => {}).domElement.style.display = 'none';

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!findContainer.contains(e.target)) {
      resultsDiv.style.display = 'none';
    }
  });

  findFolder.close(); // Close Find folder by default
}
