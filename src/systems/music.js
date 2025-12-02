/**
 * @file music.js
 * @description Handles background music playback, playlist management, and format selection.
 */

import { config } from '../config.js';
import { Logger } from '../utils/logger.js';

export class MusicSystem {
  constructor() {
    this.audio = new Audio();
    this.tracks = [];
    this.currentTrackIndex = -1;
    this.isPlaying = false;
    this.initialized = false;
    this.playHistory = []; // Track previously played songs

    // Bind methods
    this.handleTrackEnded = this.handleTrackEnded.bind(this);
    this.audio.addEventListener('ended', this.handleTrackEnded);
  }

  /**
   * Initialize the music system by loading the track manifest.
   */
  async init() {
    if (this.initialized) return;

    try {
      const response = await fetch('assets/music/tracks.json');
      this.tracks = await response.json();
      this.initialized = true;
      Logger.log('Music system initialized with tracks:', this.tracks);

      // Initialize playlist in config if empty (select all by default)
      if (config.music.playlist.length === 0) {
        config.music.playlist = this.tracks.map((t) => t.id);
      }

      // Don't auto-start music on page load to avoid blocking with large file downloads
      // Music will start when user explicitly enables it via UI
      Logger.log('Music ready. Click play button to start.');
    } catch (error) {
      Logger.error('Failed to initialize music system:', error);
    }
  }

  /**
   * Toggle music playback on/off.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    config.music.enabled = enabled;
    if (enabled) {
      if (this.audio.paused) {
        // If we have a current track, resume or restart it.
        // If not, try to play the next one in the playlist.
        if (this.audio.src) {
          this.audio.play().catch((e) => Logger.warn('Audio play failed:', e));
          this.isPlaying = true;
        } else {
          this.playNext();
        }
      }
    } else {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  /**
   * Update the playlist based on user selection.
   * @param {string[]} trackIds - Array of selected track IDs.
   */
  setPlaylist(trackIds) {
    config.music.playlist = trackIds;

    // If currently playing track is removed from playlist, stop or skip?
    // For now, let's just let it finish or keep playing until the end.
    // But if we are not playing anything and enabled is true, start playing.
    if (config.music.enabled && !this.isPlaying && trackIds.length > 0) {
      this.playNext();
    }
  }

  /**
   * Set the volume and toggle playback if needed.
   * @param {number} volume - Volume level (0.0 to 1.0).
   */
  setVolume(volume) {
    this.audio.volume = volume;
    config.music.volume = volume;

    if (volume > 0 && !config.music.enabled) {
      this.setEnabled(true);
    } else if (volume === 0 && config.music.enabled) {
      this.setEnabled(false);
    }
  }

  /**
   * Play the next track in the playlist.
   */
  playNext() {
    if (!config.music.enabled || config.music.playlist.length === 0) {
      this.audio.pause();
      this.isPlaying = false;
      return;
    }

    // Filter tracks to only those in the playlist
    const playlistTracks = this.tracks.filter((t) => config.music.playlist.includes(t.id));

    if (playlistTracks.length === 0) return;

    let nextPlaylistTrack;

    if (config.music.shuffle) {
      // Pick random track
      const randomIndex = Math.floor(Math.random() * playlistTracks.length);
      nextPlaylistTrack = playlistTracks[randomIndex];
    } else {
      // If current track is in playlist, find its index in the filtered list
      const currentId = this.tracks[this.currentTrackIndex]?.id;
      const currentPlaylistIndex = playlistTracks.findIndex((t) => t.id === currentId);

      // Pick next one wrapping around
      nextPlaylistTrack = playlistTracks[(currentPlaylistIndex + 1) % playlistTracks.length];
    }

    // Add current track to history BEFORE switching
    if (this.currentTrackIndex !== -1) {
      const currentTrack = this.tracks[this.currentTrackIndex];
      if (currentTrack) {
        this.playHistory.push(currentTrack.id);
        // Keep history limited to last 50 tracks
        if (this.playHistory.length > 50) {
          this.playHistory.shift();
        }
      }
    }

    // Find its real index in this.tracks
    this.currentTrackIndex = this.tracks.findIndex((t) => t.id === nextPlaylistTrack.id);

    if (this.currentTrackIndex !== -1) {
      this.loadAndPlay(this.tracks[this.currentTrackIndex], true); // Skip history in loadAndPlay
    }
  }

  /**
   * Play the previous track in the playlist.
   */
  playPrevious() {
    // If we have history, go back to the last played track
    if (this.playHistory.length > 0) {
      const previousTrackId = this.playHistory.pop(); // Remove and get last item
      const trackIndex = this.tracks.findIndex((t) => t.id === previousTrackId);

      if (trackIndex !== -1) {
        this.currentTrackIndex = trackIndex;
        // Don't add to history when going back
        const trackToPlay = this.tracks[this.currentTrackIndex];
        this.loadAndPlay(trackToPlay, true); // Pass true to skip history recording
        return;
      }
    }

    // No history available, do nothing
    Logger.log('No previous track in history');
  }

  /**
   * Load and play a specific track.
   * @param {Object} track - Track object from manifest.
   */
  loadAndPlay(track) {
    // History is now managed by playNext(), not here

    // Only use OGG format to reduce deployed assets (no need for both OGG and M4A)
    const ext = 'ogg';

    this.audio.src = `assets/music/${ext}/${encodeURIComponent(track.filename)}.${ext}`;
    this.audio.volume = config.music.volume;

    // Set track name immediately (before play attempt)
    config.music.currentTrackName = track.title.replace(/ \[(Lyrics|Instrumental)\]/g, '');
    Logger.log(`Now playing: ${track.title}`);

    this.audio
      .play()
      .then(() => {
        this.isPlaying = true;
      })
      .catch((error) => {
        Logger.warn('Playback failed (likely autoplay blocked):', error);
        this.isPlaying = false;
        // Note: Track name stays set even if autoplay is blocked
        // User can click play button to start manually
      });
  }

  handleTrackEnded() {
    this.playNext();
  }
}

export const musicSystem = new MusicSystem();
