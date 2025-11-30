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
export function setupSoundUI(gui) {
  const soundFolder = gui.addFolder('Sound');

  // Volume Control (Music Volume)
  // This controls both volume and enabled state (0 volume = disabled)
  const volCtrl = soundFolder
    .add(config.music, 'volume', 0, 1)
    .name('Music Volume')
    .onChange((value) => {
      musicSystem.setVolume(value);
    });

  // Hide the number display for volume and expand slider
  if (volCtrl) {
    volCtrl.domElement.classList.add('hide-value');
    volCtrl.domElement.classList.add('full-width');
  }

  // Playlist Button (Modal Trigger)
  const playlistControl = {
    editPlaylist: () => {
      openPlaylistModal();
    },
  };
  soundFolder.add(playlistControl, 'editPlaylist').name('Edit Playlist...');

  soundFolder.close(); // Close folder by default
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
