import { missionData } from '../../data/missions.js';
// import GUI from 'lil-gui'; // Unused

// --- Shared Styles ---
const SHARED_STYLES = `
  .mission-ui-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: #eee;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow-y: auto;
    padding: 10px;
  }

  /* List Styles */
  .mission-list-item {
    display: flex;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    cursor: pointer;
    transition: background 0.2s;
  }
  .mission-list-item:hover {
    background: rgba(255,255,255,0.1);
  }
  /* Custom Checkbox Styles - REMOVED */

  .mission-list-name {
    flex-grow: 1;
    font-size: 0.95em;
    user-select: none;
  }

  .mission-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 12px;
    flex-shrink: 0;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid rgba(255,255,255,0.2);
  }

  .mission-color-dot:hover {
    transform: scale(1.2);
    border-color: rgba(255,255,255,0.8);
  }

  /* Detail Styles */
  .mission-info-panel {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 15px;
  }
  .mission-header {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  .mission-title {
    font-size: 1.2em;
    font-weight: bold;
    margin: 0;
    flex-grow: 1;
  }
  .mission-image {
    width: 100%;
    height: 150px;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 15px;
    background-color: #000;
    display: block;
  }
  .mission-summary {
    font-size: 0.9em;
    line-height: 1.5;
    opacity: 0.9;
    margin-bottom: 20px;
    padding: 0 5px;
  }

  /* Vertical Stepper Timeline */
  .mission-timeline {
    position: relative;
    padding-left: 20px;
    margin-top: 10px;
    border-left: 2px solid rgba(255, 255, 255, 0.1);
    margin-left: 10px;
  }

  .timeline-event {
    position: relative;
    padding: 0 0 15px 15px; /* Reduced padding */
    cursor: pointer;
    transition: opacity 0.2s;
    display: flex; /* Flex layout for single line */
    align-items: baseline;
    gap: 10px;
  }
  
  .timeline-event:last-child {
    padding-bottom: 0;
  }

  .timeline-event:hover {
    opacity: 1;
  }
  .timeline-event:hover .timeline-dot {
    background: #fff;
    box-shadow: 0 0 8px rgba(255,255,255,0.8);
  }

  .timeline-dot {
    position: absolute;
    left: -26px; /* Adjust based on padding/margin */
    top: 5px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #555;
    border: 2px solid #222;
    transition: all 0.2s ease;
  }

  .event-date {
    display: block;
    font-family: monospace;
    font-size: 0.85em;
    color: #888;
    flex-shrink: 0; /* Prevent shrinking */
    min-width: 80px; /* Fixed width for alignment */
  }

  .event-label {
    display: block;
    font-size: 0.95em;
    font-weight: 500;
    color: #eee;
  }
  
  .empty-state {
    text-align: center;
    padding: 30px 20px;
    color: #666;
    font-style: italic;
  }
`;

function injectStyles(container) {
  const style = document.createElement('style');
  style.textContent = SHARED_STYLES;
  container.appendChild(style);
}

/**
 * Tab 1: Mission Visibility List
 */
export function setupMissionList(container, config) {
  container.innerHTML = '';
  container.className = 'mission-ui-container';
  injectStyles(container);

  const listDiv = document.createElement('div');
  listDiv.className = 'mission-list';

  missionData.forEach((mission) => {
    const row = document.createElement('div');
    row.className = 'mission-list-item';

    // Toggle Button (Color Dot)
    const dot = document.createElement('div');
    dot.className = 'mission-color-dot';

    const updateDotState = () => {
      const isVisible = config.showMissions[mission.id];
      if (isVisible) {
        const colorHex = '#' + mission.color.toString(16).padStart(6, '0');
        dot.style.backgroundColor = colorHex;
        dot.style.boxShadow = `0 0 8px ${colorHex}`;
        dot.style.borderColor = 'rgba(255,255,255,0.5)';
      } else {
        dot.style.backgroundColor = '#444'; // Dark grey
        dot.style.boxShadow = 'none';
        dot.style.borderColor = 'rgba(255,255,255,0.2)';
      }
    };

    // Initial State
    updateDotState();

    // Click Handler for Toggle
    dot.onclick = (e) => {
      e.stopPropagation(); // Prevent opening details
      config.showMissions[mission.id] = !config.showMissions[mission.id];
      updateDotState();
      // Dispatch event to update Detail view if open
      window.dispatchEvent(
        new CustomEvent('mission-visibility-changed', { detail: { missionId: mission.id } })
      );
      if (window.updateMissions) window.updateMissions();
    };

    // Name
    const name = document.createElement('span');
    name.className = 'mission-list-name';
    name.textContent = mission.name || mission.id;

    row.appendChild(dot);
    row.appendChild(name);

    // Row Click -> Select Mission & Open Details Tab
    row.onclick = () => {
      const event = new CustomEvent('mission-selected', { detail: { missionId: mission.id } });
      window.dispatchEvent(event);

      import('../WindowManager.js').then(({ windowManager }) => {
        const win = windowManager.getWindow('explorer-window');
        if (win && win.controller) {
          win.controller.selectTab?.('mission-details');
        }
      });
    };

    // Listen for external updates (e.g. from Detail view)
    const onVisibilityChange = (e) => {
      if (e.detail.missionId === mission.id) {
        updateDotState();
      }
    };
    window.addEventListener('mission-visibility-changed', onVisibilityChange);
    // Cleanup? This listener will persist. Ideally we'd remove it.
    // However, given the app structure, this is acceptable for now.

    listDiv.appendChild(row);
  });

  container.appendChild(listDiv);
}

/**
 * Tab 2: Mission Details
 */
export function setupMissionDetails(container, config) {
  container.innerHTML = '';
  container.className = 'mission-ui-container';
  injectStyles(container);

  const content = document.createElement('div');
  container.appendChild(content);

  const renderEmpty = () => {
    content.innerHTML =
      '<div class="empty-state">Select a mission from the list to view details.</div>';
  };

  const renderMission = (missionId) => {
    const mission = missionData.find((m) => m.id === missionId);
    if (!mission) {
      renderEmpty();
      return;
    }

    content.innerHTML = '';

    // Panel
    const panel = document.createElement('div');
    panel.className = 'mission-info-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'mission-header';

    // Header Dot with Toggle Logic
    const dot = document.createElement('div');
    dot.className = 'mission-color-dot';
    // Reuse the style class but maybe it needs specific sizing or just use same
    // The previous CSS had mission-color-dot at 12px.

    const updateHeaderDot = () => {
      const isVisible = config.showMissions[mission.id];
      if (isVisible) {
        const colorHex = '#' + mission.color.toString(16).padStart(6, '0');
        dot.style.backgroundColor = colorHex;
        dot.style.boxShadow = `0 0 8px ${colorHex}`;
        dot.style.borderColor = 'rgba(255,255,255,0.5)';
      } else {
        dot.style.backgroundColor = '#444'; // Dark grey
        dot.style.boxShadow = 'none';
        dot.style.borderColor = 'rgba(255,255,255,0.2)';
      }
    };
    updateHeaderDot();

    dot.onclick = () => {
      config.showMissions[mission.id] = !config.showMissions[mission.id];
      updateHeaderDot();
      // Dispatch to update List view
      window.dispatchEvent(
        new CustomEvent('mission-visibility-changed', { detail: { missionId: mission.id } })
      );
      if (window.updateMissions) window.updateMissions();
    };

    const title = document.createElement('h3');
    title.className = 'mission-title';
    title.textContent = mission.name || mission.id;

    header.appendChild(dot);
    header.appendChild(title);
    panel.appendChild(header);

    // Image
    if (mission.image) {
      const img = document.createElement('img');
      img.className = 'mission-image';
      img.src = mission.image;
      img.onerror = () => {
        img.style.display = 'none';
      };
      panel.appendChild(img);
    }

    // Summary
    if (mission.summary) {
      const p = document.createElement('p');
      p.className = 'mission-summary';
      p.textContent = mission.summary;
      panel.appendChild(p);
    }

    // Timeline (Vertical Stepper)
    if (mission.timeline && mission.timeline.length > 0) {
      // NOTE: User requested removing label/header to save space
      const timelineDiv = document.createElement('div');
      timelineDiv.className = 'mission-timeline';

      mission.timeline.forEach((event) => {
        const row = document.createElement('div');
        row.className = 'timeline-event';
        row.title = `Jump to ${event.date} - ${event.label}`;
        // Store metadata for updates
        row.dataset.date = event.date;
        row.dataset.color = '#' + mission.color.toString(16).padStart(6, '0');

        row.onclick = () => {
          const simCtrl = window.SimulationControl;
          if (simCtrl?.jumpToDateFn) {
            simCtrl.jumpToDate(event.date, true);
          } else {
            console.warn('SimulationControl.jumpToDate not available');
          }
        };

        // Stepper Dot
        // Stepper Dot
        const dot = document.createElement('div');
        dot.className = 'timeline-dot';

        // Intelligent Styling: Solid if Past/Now, Outline if Future
        const eventDate = new Date(event.date);
        const simDate = config.date;
        const isFuture = eventDate > simDate;
        const colorHex = '#' + mission.color.toString(16).padStart(6, '0');

        if (isFuture) {
          // Future: Thin Inner Outline
          dot.style.backgroundColor = 'transparent';
          // Transparent border preserves layout size (10px + 4px = 14px)
          dot.style.border = '2px solid transparent';
          // Inset shadow creates the "inner" ring exactly where the solid fill would be
          dot.style.boxShadow = `inset 0 0 0 1px ${colorHex}`;
        } else {
          // Past: Solid
          dot.style.backgroundColor = colorHex;
          // Default dark border for contrast
          dot.style.border = '2px solid #222';
          dot.style.boxShadow = 'none';
        }

        // Fix for box-sizing mismatch causing potential jitter
        // Let's standardise to border-box for both to be safe, modifying size slightly?
        // Actually, let's just use inline styles to override specific props.
        // Existing CSS: width 10px, height 10px, border 2px solid #222. Total 14px.
        // If Future: border 2px solid color. width 10px. Total 14px.
        // So size is consistent.

        row.appendChild(dot);

        // Date (inline)
        const dateSpan = document.createElement('span');
        dateSpan.className = 'event-date';
        dateSpan.textContent = event.date;
        row.appendChild(dateSpan);

        // Label (inline)
        const labelSpan = document.createElement('span');
        labelSpan.className = 'event-label';
        labelSpan.textContent = event.label;
        labelSpan.style.cursor = 'pointer'; // Make it look clickable
        labelSpan.title = 'Jump to Location & Date';

        labelSpan.onclick = (e) => {
          e.stopPropagation(); // Prevent parent row click (which just jumps to date)
          const simCtrl = window.SimulationControl;
          if (simCtrl?.jumpToMissionLocation) {
            simCtrl.jumpToMissionLocation(mission.id, event.date, true);
          } else {
            console.warn('SimulationControl.jumpToMissionLocation not available');
          }
        };

        labelSpan.onmouseover = () => {
          labelSpan.style.textDecoration = 'underline';
        };
        labelSpan.onmouseout = () => {
          labelSpan.style.textDecoration = 'none';
        };

        row.appendChild(labelSpan);

        timelineDiv.appendChild(row);
      });

      panel.appendChild(timelineDiv);
    }

    content.appendChild(panel);
  };

  // Initial Empty State
  renderEmpty();

  // Listener
  const onMissionSelected = (e) => {
    const missionId = e.detail.missionId;
    renderMission(missionId);
    // Note: We are NO LONGER auto-showing the mission on selection,
    // as the user might want to read about it without enabling the trajectory.
    // The user can now use the header dot to toggle it.
  };
  window.addEventListener('mission-selected', onMissionSelected);
}

/**
 * Updates the mission timeline visuals based on current simulation time.
 * Called every frame by the UI loop.
 */
export function updateMissionTimeline(config) {
  const events = document.querySelectorAll('.mission-timeline .timeline-event');
  if (events.length === 0) return;

  const simDate = config.date;

  events.forEach((row) => {
    const eventDate = new Date(row.dataset.date);
    const colorHex = row.dataset.color;
    const dot = row.querySelector('.timeline-dot');

    if (!dot) return;

    const isFuture = eventDate > simDate;

    if (isFuture) {
      // Future: Thin Inner Outline
      dot.style.backgroundColor = 'transparent';
      dot.style.border = '2px solid transparent';
      dot.style.boxShadow = `inset 0 0 0 1px ${colorHex}`;
    } else {
      // Past: Solid
      dot.style.backgroundColor = colorHex;
      dot.style.border = '2px solid #222';
      dot.style.boxShadow = 'none';
    }
  });
}
