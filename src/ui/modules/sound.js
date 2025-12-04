/**
 * @file sound.js
 * @description UI module for sound and music controls.
 */

import { config } from '../../config.js';
import { musicSystem } from '../../systems/music.js';

/**
 * Setup the Sound section of the GUI.
 * @param {GUI} gui - The lil-gui instance.
 */
import { windowManager } from '../WindowManager.js';

/**
 * Setup the Music Window.
 */
export function setupMusicWindow() {
  const win = windowManager.createWindow('music-window', 'Music', {
    width: '240px',
    x: window.innerWidth / 2 + 160, // Right of center (dock is ~300px wide)
    y: window.innerHeight - 200, // Bottom area
    onClose: () => {
      // Optional: Update UI state if needed, but windowManager handles display:none
    },
  });

  const content = win.content;
  content.classList.add('music-window-content');

  // --- Volume Control ---
  const volumeContainer = document.createElement('div');
  volumeContainer.className = 'volume-container';

  const volumeLabel = document.createElement('label');
  volumeLabel.textContent = 'Volume';

  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '1';
  volumeSlider.step = '0.01';
  volumeSlider.value = config.music.volume;
  volumeSlider.className = 'volume-slider';

  volumeSlider.oninput = (e) => {
    musicSystem.setVolume(parseFloat(e.target.value));
  };

  volumeContainer.appendChild(volumeLabel);
  volumeContainer.appendChild(volumeSlider);
  content.appendChild(volumeContainer);

  // --- Track Display ---
  const trackDisplay = document.createElement('div');
  trackDisplay.className = 'track-display';
  trackDisplay.textContent = config.music.currentTrackName || '---';
  content.appendChild(trackDisplay);

  // Update track display loop/listener
  // We can hook into the config object if it was reactive, but here we might need a manual update or polling
  // For now, let's expose an update function or rely on the updateUI loop in gui.js to update this element?
  // Actually, let's just make a simple poller or export an updater.
  // Better yet, let's attach the updater to the window object so gui.js can call it.
  win.update = () => {
    if (trackDisplay.textContent !== config.music.currentTrackName) {
      trackDisplay.textContent = config.music.currentTrackName;
    }
    // Update Play/Pause button state if changed externally
    // (We'll need reference to the button)
  };

  // --- Controls ---
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'control-buttons';

  // Previous
  const prevBtn = document.createElement('div');
  prevBtn.className = 'control-btn';
  prevBtn.textContent = '⏮';
  prevBtn.title = 'Previous Track';
  prevBtn.onclick = () => musicSystem.playPrevious();

  // Play/Pause
  const playPauseBtn = document.createElement('div');
  playPauseBtn.className = 'control-btn';
  const initiallyPlaying = config.music.volume > 0 && config.music.enabled;
  playPauseBtn.textContent = initiallyPlaying ? '⏸' : '▶';
  playPauseBtn.title = initiallyPlaying ? 'Pause' : 'Play';

  playPauseBtn.onclick = () => {
    const newState = !config.music.enabled;
    musicSystem.setEnabled(newState);
    playPauseBtn.textContent = newState ? '⏸' : '▶';
    playPauseBtn.title = newState ? 'Pause' : 'Play';
  };

  // Update button reference in win.update
  const originalUpdate = win.update;
  win.update = () => {
    originalUpdate();
    const isPlaying = config.music.enabled;
    const expectedIcon = isPlaying ? '⏸' : '▶';
    if (playPauseBtn.textContent !== expectedIcon) {
      playPauseBtn.textContent = expectedIcon;
      playPauseBtn.title = isPlaying ? 'Pause' : 'Play';
    }
  };

  // Next
  const nextBtn = document.createElement('div');
  nextBtn.className = 'control-btn';
  nextBtn.textContent = '⏭';
  nextBtn.title = 'Next Track';
  nextBtn.onclick = () => musicSystem.playNext();

  // Shuffle
  const shuffleBtn = document.createElement('div');
  shuffleBtn.className = 'control-btn';
  const shuffleIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
      <polyline points="16 3 21 3 21 8"></polyline>
      <line x1="4" y1="20" x2="21" y2="3"></line>
      <polyline points="21 16 21 21 16 21"></polyline>
      <line x1="15" y1="15" x2="21" y2="21"></line>
      <line x1="4" y1="4" x2="9" y2="9"></line>
    </svg>
  `;
  shuffleBtn.innerHTML = shuffleIcon;
  shuffleBtn.title = config.music.shuffle ? 'Shuffle: ON' : 'Shuffle: OFF';
  if (config.music.shuffle) shuffleBtn.classList.add('active');

  shuffleBtn.onclick = () => {
    config.music.shuffle = !config.music.shuffle;
    if (config.music.shuffle) {
      shuffleBtn.classList.add('active');
      shuffleBtn.title = 'Shuffle: ON';
    } else {
      shuffleBtn.classList.remove('active');
      shuffleBtn.title = 'Shuffle: OFF';
    }
  };

  // Playlist
  const playlistBtn = document.createElement('div');
  playlistBtn.className = 'control-btn';
  playlistBtn.textContent = '☰'; // List icon
  playlistBtn.title = 'Edit Playlist';
  playlistBtn.onclick = () => openPlaylistModal();

  controlsContainer.appendChild(prevBtn);
  controlsContainer.appendChild(playPauseBtn);
  controlsContainer.appendChild(nextBtn);
  controlsContainer.appendChild(shuffleBtn);
  controlsContainer.appendChild(playlistBtn);

  content.appendChild(controlsContainer);

  // Calculate snapped position (bottom right)
  // We need to wait for a frame or force layout to get correct height?
  // Since it's appended to body, offsetHeight should be available if not display:none.
  // WindowManager creates it with default display (flex).
  const height = win.element.offsetHeight;
  // const width = win.element.offsetWidth; // Unused

  // Snap to bottom-right with 20px padding
  const padding = 20;
  win.x = window.innerWidth / 2 + 160; // Keep x relative to dock
  win.y = window.innerHeight - height - padding;

  win.element.style.transform = `translate3d(${win.x}px, ${win.y}px, 0)`;

  // Initially hide
  windowManager.hideWindow('music-window');
}

/**
 * Opens the playlist modal.
 */
function openPlaylistModal() {
  let overlay = document.querySelector('.playlist-modal-overlay');

  if (!overlay) {
    createPlaylistModal();
    overlay = document.querySelector('.playlist-modal-overlay');
  }

  // Refresh state
  updateModalState();

  overlay.classList.add('active');
}

/**
 * Creates the DOM elements for the playlist modal.
 */
function createPlaylistModal() {
  const overlay = document.createElement('div');
  overlay.className = 'playlist-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'playlist-modal';

  // Header
  const header = document.createElement('div');
  header.className = 'playlist-header';
  header.innerHTML = '<h2>Playlist</h2>';

  // Controls
  const controls = document.createElement('div');
  controls.className = 'playlist-controls';

  const selectAllBtn = document.createElement('button');
  selectAllBtn.className = 'playlist-btn';
  selectAllBtn.textContent = 'All';
  selectAllBtn.onclick = () => setAllTracks(true);

  const selectNoneBtn = document.createElement('button');
  selectNoneBtn.className = 'playlist-btn';
  selectNoneBtn.textContent = 'None';
  selectNoneBtn.onclick = () => setAllTracks(false);

  const selectLyricsBtn = document.createElement('button');
  selectLyricsBtn.className = 'playlist-btn';
  selectLyricsBtn.textContent = 'Lyrics';
  selectLyricsBtn.onclick = () => setCategoryTracks('Lyrics');

  const selectInstBtn = document.createElement('button');
  selectInstBtn.className = 'playlist-btn';
  selectInstBtn.textContent = 'Instrumental';
  selectInstBtn.onclick = () => setCategoryTracks('Instrumental');

  controls.appendChild(selectAllBtn);
  controls.appendChild(selectNoneBtn);
  controls.appendChild(selectLyricsBtn);
  controls.appendChild(selectInstBtn);

  // Tracks List
  const tracksContainer = document.createElement('div');
  tracksContainer.className = 'playlist-tracks';
  tracksContainer.id = 'playlist-tracks-container';

  // Footer
  const footer = document.createElement('div');
  footer.className = 'playlist-footer';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'playlist-close-btn';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => {
    overlay.classList.remove('active');
  };

  footer.appendChild(closeBtn);

  // Assemble
  modal.appendChild(header);
  modal.appendChild(controls);
  modal.appendChild(tracksContainer);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close on click outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
}

/**
 * Updates the modal content with current tracks and selection state.
 */
function updateModalState() {
  const container = document.getElementById('playlist-tracks-container');
  if (!container) return;

  container.innerHTML = '';

  // Wait for tracks if not loaded
  if (!musicSystem.tracks || musicSystem.tracks.length === 0) {
    container.innerHTML = '<div style="padding:10px; color:#aaa;">Loading tracks...</div>';
    // Try to init if not already
    musicSystem.init().then(() => updateModalState());
    return;
  }

  musicSystem.tracks.forEach((track) => {
    const item = document.createElement('div');
    item.className = 'track-item';
    if (config.music.playlist.includes(track.id)) {
      item.classList.add('selected');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = config.music.playlist.includes(track.id);
    checkbox.onchange = (e) => {
      toggleTrack(track.id, e.target.checked);
      if (e.target.checked) item.classList.add('selected');
      else item.classList.remove('selected');
    };

    const label = document.createElement('span');
    label.className = 'track-label';
    // Remove [Lyrics] and [Instrumental] from display title
    label.textContent = track.title.replace(/ \[(Lyrics|Instrumental)\]/g, '');

    // Allow clicking row to toggle
    item.onclick = (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    };

    item.appendChild(checkbox);
    item.appendChild(label);
    container.appendChild(item);
  });
}

/**
 * Toggles a single track's selection.
 */
function toggleTrack(trackId, selected) {
  if (selected) {
    if (!config.music.playlist.includes(trackId)) {
      config.music.playlist.push(trackId);
    }
  } else {
    config.music.playlist = config.music.playlist.filter((id) => id !== trackId);
  }
  musicSystem.setPlaylist(config.music.playlist);
}

/**
 * Selects or deselects all tracks.
 */
function setAllTracks(selected) {
  if (selected) {
    config.music.playlist = musicSystem.tracks.map((t) => t.id);
  } else {
    config.music.playlist = [];
  }
  musicSystem.setPlaylist(config.music.playlist);
  updateModalState();
}

/**
 * Selects tracks by category (Lyrics or Instrumental).
 * This is a toggle: if all in category are selected, deselect them. Otherwise select all in category.
 */
function setCategoryTracks(category) {
  const categoryTracks = musicSystem.tracks.filter((t) => t.title.includes(`[${category}]`));
  const categoryIds = categoryTracks.map((t) => t.id);

  // Check if all are currently selected
  const allSelected = categoryIds.every((id) => config.music.playlist.includes(id));

  if (allSelected) {
    // Deselect all in category
    config.music.playlist = config.music.playlist.filter((id) => !categoryIds.includes(id));
  } else {
    // Select all in category
    categoryIds.forEach((id) => {
      if (!config.music.playlist.includes(id)) {
        config.music.playlist.push(id);
      }
    });
  }

  musicSystem.setPlaylist(config.music.playlist);
  updateModalState();
}
