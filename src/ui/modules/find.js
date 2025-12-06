import * as THREE from 'three';
import { PARSEC_TO_SCENE } from '../../config.js';

export function setupFindControlsCustom(container, planets, sun, starsRef, camera, controls) {
  // We use custom HTML directly.

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
    `;

  // For custom HTML, we can append it directly to the container provided by the TabbedWindow
  // But since we created a local GUI, we can append to that or just the main container.
  // The original appended to `findFolder.domElement.querySelector('.children')`.
  // Here we can just append to the container.
  container.appendChild(findContainer);

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

  // Update dropdown position
  function updateDropdownPosition() {
    const rect = searchInput.getBoundingClientRect();
    resultsDiv.style.top = `${rect.bottom + 5}px`;
    resultsDiv.style.left = `${rect.left}px`;
    resultsDiv.style.width = `${rect.width}px`;
  }

  // Search Logic
  searchInput.addEventListener('input', (e) => {
    // Clear selection state on new input
    searchInput.classList.remove('valid-selection');
    findState.selectedObject = null;
    lookAtBtn.disabled = true;
    goToBtn.disabled = true;

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
    console.log('Searching stars...', starsRef);
    if (starsRef.value && starsRef.value.userData.starData) {
      const stars = starsRef.value.userData.starData;
      console.log('Star data found, count:', stars.length);
      // Limit star search to avoid performance hit
      let starCount = 0;

      for (let i = 0; i < stars.length && starCount < 20; i++) {
        const s = stars[i];

        // Build searchable strings
        const name = s.name || '';
        const bayer = s.bayer || '';
        const flam = s.flamsteed ? s.flamsteed.toString() : '';
        const hip = s.hip ? `hip ${s.hip}` : ''; // Search "hip 123"
        const hd = s.hd ? `hd ${s.hd}` : ''; // Search "hd 123"

        let match = false;

        // Check primary name
        if (name && name.toLowerCase().includes(query)) match = true;
        // Check IDs
        else if (hip.includes(query) || hd.includes(query)) match = true;
        // Check Bayer/Flamsteed (e.g. "Alpha Cen" or "Alp Cen")
        // Bayer is usually "Alp CMa" format in data? Let's assume standard abbreviations
        else if (bayer.toLowerCase().includes(query)) match = true;
        else if (flam && query.includes(flam))
          match = true; // Weak check for simple numbers, maybe strict equality?
        // Fallback for simple ID search if user just types a number
        else if (s.hip == query || s.hd == query) match = true;

        if (match) {
          // Reconstruct star object for focus
          // Coordinate align: x->x, y->z, z->-y to match Planets
          const x = s.x * PARSEC_TO_SCENE;
          const y = s.z * PARSEC_TO_SCENE;
          const z = -s.y * PARSEC_TO_SCENE;

          // Create a dummy mesh for the focus system to target
          const dummyMesh = new THREE.Mesh();
          dummyMesh.position.set(x, y, z);

          matches.push({
            name: name || bayer || `HD ${s.hd}` || `HIP ${s.hip}`,
            type: 'Star',
            object: {
              mesh: dummyMesh,
              data: { name: name || bayer || `Star`, radius: s.radius || 1 },
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

  // We don't have a 'scroll' event listener on lil-gui anymore since we aren't in a scrolling container necessarily
  // But the window content might scroll.
  container.addEventListener(
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
    searchInput.classList.add('valid-selection'); // Visual feedback
    lookAtBtn.disabled = false;
    goToBtn.disabled = false;
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
}
