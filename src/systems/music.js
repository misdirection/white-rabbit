/**
 * @file music.js
 * @description Handles background music playback, playlist management, and format selection.
 */

import { config } from '../config.js';

export class MusicSystem {
  constructor() {
    this.audio = new Audio();
    this.tracks = [];
    this.currentTrackIndex = -1;
    this.isPlaying = false;
    this.initialized = false;

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
      console.log('Music system initialized with tracks:', this.tracks);

      // Initialize playlist in config if empty (select all by default)
      if (config.music.playlist.length === 0) {
        config.music.playlist = this.tracks.map((t) => t.id);
      }

      // If config.music.enabled is true on startup, we might want to start playing.
      if (config.music.enabled && config.music.playlist.length > 0) {
        this.playNext();
      }
    } catch (error) {
      console.error('Failed to initialize music system:', error);
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
          this.audio.play().catch((e) => console.warn('Audio play failed:', e));
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
   * Play the next track in the playlist.
   */
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

    // If current track is in playlist, find its index in the filtered list
    const currentId = this.tracks[this.currentTrackIndex]?.id;
    const currentPlaylistIndex = playlistTracks.findIndex((t) => t.id === currentId);

    // Pick next one wrapping around
    const nextPlaylistTrack = playlistTracks[(currentPlaylistIndex + 1) % playlistTracks.length];

    // Find its real index in this.tracks
    this.currentTrackIndex = this.tracks.findIndex((t) => t.id === nextPlaylistTrack.id);

    if (this.currentTrackIndex !== -1) {
      this.loadAndPlay(this.tracks[this.currentTrackIndex]);
    }
  }

  /**
   * Load and play a specific track.
   * @param {Object} track - Track object from manifest.
   */
  loadAndPlay(track) {
    // Determine supported format
    const canPlayOgg = this.audio.canPlayType('audio/ogg; codecs="vorbis"');
    const ext = canPlayOgg ? 'ogg' : 'm4a';

    this.audio.src = `assets/music/${ext}/${track.filename}.${ext}`;
    this.audio.volume = config.music.volume;
    this.audio
      .play()
      .then(() => {
        this.isPlaying = true;
        console.log(`Now playing: ${track.title}`);
      })
      .catch((error) => {
        console.error('Playback failed:', error);
        this.isPlaying = false;
        // Try next one if this fails?
        // setTimeout(() => this.playNext(), 1000);
      });
  }

  handleTrackEnded() {
    this.playNext();
  }
}

export const musicSystem = new MusicSystem();
