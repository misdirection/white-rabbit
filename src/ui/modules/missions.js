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
    padding: 2px 8px; /* Reduced vertical padding further */
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

  .story-btn {
    opacity: 0;
    pointer-events: none; /* Ignore clicks when hidden */
    transform: translateX(10px);
    transition: all 0.2s;
    background: none;
    border: none;
    font-size: 1.1em; /* Slight reduction */
    cursor: pointer;
    padding: 1px 4px; /* Reduced padding */
    margin-left: 5px;
  }

  /* Show on hover */
  .mission-list-item:hover .story-btn {
    opacity: 1;
    pointer-events: auto; /* Enable clicks */
    transform: translateX(0);
  }

  .mission-color-dot {
    width: 10px; /* Smaller dots */
    height: 10px;
    border-radius: 50%;
    margin-right: 8px; /* Closer to text */
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
  /* .mission-info-panel removed to save space */
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
    margin-bottom: 5px;
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

    // Focus Button (Satellite Icon) - Appears on Hover
    const focusBtn = document.createElement('button');
    focusBtn.className = 'story-btn'; // Reuse same style
    focusBtn.textContent = '🛰️'; // Satellite icon
    focusBtn.title = 'Focus on Probe';
    focusBtn.onclick = async (e) => {
      e.stopPropagation(); // Prevent row click (toggle)
      
      // Import required modules
      const { ensureProbeLoaded, getProbeForFocus } = await import('../../features/missions.js');
      const { focusOnObject } = await import('../../features/focusMode.js');

      // Ensure probe is loaded (enables trajectory if needed)
      const loaded = await ensureProbeLoaded(mission.id);
      
      if (loaded) {
        updateDotState(); // Update UI to show enabled
        
        const probeWrapper = getProbeForFocus(mission.id);
        if (probeWrapper) {
          // Get camera and controls from SimulationControl
          const { camera, controls } = window.SimulationControl || {};
          if (camera && controls) {
            focusOnObject(probeWrapper, camera, controls);
          }
        }
      }
    };

    row.appendChild(focusBtn);

    // Story Button (Movie Icon) - Appears on Hover
    const storyBtn = document.createElement('button');
    storyBtn.className = 'story-btn';
    storyBtn.textContent = '🎞️'; // Movie strip icon
    storyBtn.title = 'View Story';
    storyBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent row click (toggle)
      
      // Select Mission and Open Story Tab
      window.dispatchEvent(
        new CustomEvent('mission-selected', { detail: { missionId: mission.id } })
      );

      import('../WindowManager.js').then(({ windowManager }) => {
        const win = windowManager.getWindow('explorer-window');
        if (win && win.controller) {
          win.controller.selectTab?.('mission-details');
        }
      });
    };

    row.appendChild(storyBtn);

    // Row Click -> Toggle Visibility
    row.onclick = () => {
       config.showMissions[mission.id] = !config.showMissions[mission.id];
       updateDotState();
       window.dispatchEvent(
        new CustomEvent('mission-visibility-changed', { detail: { missionId: mission.id } })
       );
       if (window.updateMissions) window.updateMissions();
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
import { ModelPreview } from '../components/ModelPreview.js';

export function setupMissionDetails(container, config) {
  container.innerHTML = '';
  container.className = 'mission-ui-container';
  injectStyles(container);

  const content = document.createElement('div');
  container.appendChild(content);

  // Store active preview to dispose it correctly
  let activePreview = null;
  // Track current page per mission (or global? Local seems better but resets on switch)
  // Let's keep it simple: defaulting to page 0 (Info) when opening a mission.
  let currentPage = 0; 

  const renderEmpty = () => {
    if (activePreview) {
      activePreview.dispose();
      activePreview = null;
    }
    content.innerHTML =
      '<div class="empty-state">Select a mission from the list to view details.</div>';
  };

  const renderMission = (missionId) => {
    const mission = missionData.find((m) => m.id === missionId);
    if (!mission) {
      renderEmpty();
      return;
    }

    if (activePreview) {
      activePreview.dispose();
      activePreview = null;
    }
    currentPage = 0; // Reset to Info page on new selection

    // Re-render function to handle page switching without full rebuild
    const updateView = () => {
        // Dispose any existing preview first (critical for WebGL context management)
        if (activePreview) {
          activePreview.dispose();
          activePreview = null;
        }
        content.innerHTML = '';
        
        // --- Header (Always Visible) ---
        const header = document.createElement('div');
        header.className = 'mission-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between'; // Space for arrows
        header.style.alignItems = 'center';

        // Left: Dot + Title
        const leftGroup = document.createElement('div');
        leftGroup.style.display = 'flex';
        leftGroup.style.alignItems = 'center';
        leftGroup.style.flexGrow = '1';

        const dot = document.createElement('div');
        dot.className = 'mission-color-dot';
        
        const updateHeaderDot = () => {
        const isVisible = config.showMissions[mission.id];
        if (isVisible) {
            const colorHex = '#' + mission.color.toString(16).padStart(6, '0');
            dot.style.backgroundColor = colorHex;
            dot.style.boxShadow = `0 0 8px ${colorHex}`;
            dot.style.borderColor = 'rgba(255,255,255,0.5)';
        } else {
            dot.style.backgroundColor = '#444'; 
            dot.style.boxShadow = 'none';
            dot.style.borderColor = 'rgba(255,255,255,0.2)';
        }
        };
        updateHeaderDot();

        dot.onclick = () => {
        config.showMissions[mission.id] = !config.showMissions[mission.id];
        updateHeaderDot();
        window.dispatchEvent(
            new CustomEvent('mission-visibility-changed', { detail: { missionId: mission.id } })
        );
        if (window.updateMissions) window.updateMissions();
        };

        const title = document.createElement('h3');
        title.className = 'mission-title';
        title.textContent = mission.name || mission.id;
        // title.style.flexGrow = '1'; // Removed, handled by parent

        leftGroup.appendChild(dot);
        leftGroup.appendChild(title);
        header.appendChild(leftGroup);

        // Right: Pagination Controls (< >)
        // Only if we have a timeline
        if (mission.timeline && mission.timeline.length > 0) {
            const navGroup = document.createElement('div');
            navGroup.style.display = 'flex';
            navGroup.style.gap = '10px';
            navGroup.style.userSelect = 'none';
            
            const prevBtn = document.createElement('span');
            prevBtn.textContent = '<';
            prevBtn.style.cursor = 'pointer';
            prevBtn.style.opacity = currentPage === 0 ? '0.3' : '1';
            prevBtn.onclick = () => {
                if (currentPage > 0) {
                    currentPage--;
                    updateView();
                }
            };

            const nextBtn = document.createElement('span');
            nextBtn.textContent = '>';
            nextBtn.style.cursor = 'pointer';
            nextBtn.style.opacity = currentPage === 1 ? '0.3' : '1';
            nextBtn.onclick = () => {
                if (currentPage < 1) {
                    currentPage++;
                    updateView();
                }
            };

            navGroup.appendChild(prevBtn);
            navGroup.appendChild(nextBtn);
            header.appendChild(navGroup);
        }

        content.appendChild(header);

        // --- Page Content ---
        const pageContainer = document.createElement('div');
        pageContainer.className = 'mission-page-content';
        content.appendChild(pageContainer);

        if (currentPage === 0) {
            // PAGE 1: Info + Model/Image
            
            // 3D Model or Image
            if (mission.modelPath) {
                const modelContainer = document.createElement('div');
                modelContainer.style.width = '100%';
                modelContainer.style.height = '200px';
                modelContainer.style.backgroundColor = 'transparent'; // Let canvas verify
                modelContainer.style.marginBottom = '10px';
                modelContainer.style.position = 'relative'; // For loading text
                pageContainer.appendChild(modelContainer);
                
                // Initialize ModelPreview
                // We need to delay slightly to ensure container is in DOM for size? 
                // ModelPreview uses clientWidth, so it must be attached.
                // It is attached now.
                activePreview = new ModelPreview(modelContainer);
                activePreview.loadModel(mission.modelPath);
                
            } else if (mission.image) {
                const img = document.createElement('img');
                img.className = 'mission-image';
                img.src = mission.image;
                img.style.height = '200px'; // Match model height
                img.style.objectFit = 'contain';
                img.onerror = () => { img.style.display = 'none'; };
                pageContainer.appendChild(img);
            }

            // Summary
            if (mission.summary) {
                const p = document.createElement('p');
                p.className = 'mission-summary';
                p.textContent = mission.summary;
                pageContainer.appendChild(p);
            }

        } else {
            // PAGE 2: Timeline
            if (activePreview) {
                activePreview.dispose();
                activePreview = null;
            }

             if (mission.timeline && mission.timeline.length > 0) {
                const timelineDiv = document.createElement('div');
                timelineDiv.className = 'mission-timeline';

                mission.timeline.forEach((event) => {
                    const row = document.createElement('div');
                    row.className = 'timeline-event';
                    row.title = `Jump to ${event.date.split('T')[0]} - ${event.label}`;
                    row.dataset.date = event.date;
                    row.dataset.color = '#' + mission.color.toString(16).padStart(6, '0');

                    row.onclick = () => {
                        const simCtrl = window.SimulationControl;
                        if (simCtrl?.jumpToMissionLocation) {
                            simCtrl.jumpToMissionLocation(mission.id, event.date, true);
                        }
                    };

                    const dot = document.createElement('div');
                    dot.className = 'timeline-dot';
                    
                    // Style logic matches updateMissionTimeline
                    const eventDate = new Date(event.date);
                    const simDate = config.date;
                    const isFuture = eventDate > simDate;
                    const colorHex = '#' + mission.color.toString(16).padStart(6, '0');

                    if (isFuture) {
                        dot.style.backgroundColor = 'transparent';
                        dot.style.border = '2px solid transparent';
                        dot.style.boxShadow = `inset 0 0 0 1px ${colorHex}`;
                    } else {
                        dot.style.backgroundColor = colorHex;
                        dot.style.border = '2px solid #222';
                        dot.style.boxShadow = 'none';
                    }
                    row.appendChild(dot);

                    const dateSpan = document.createElement('span');
                    dateSpan.className = 'event-date';
                    dateSpan.textContent = event.date.split('T')[0];
                    row.appendChild(dateSpan);

                    const labelSpan = document.createElement('span');
                    labelSpan.className = 'event-label';
                    labelSpan.textContent = event.label;
                    labelSpan.style.cursor = 'pointer';
                    labelSpan.onclick = (e) => {
                        e.stopPropagation();
                        const simCtrl = window.SimulationControl;
                        if (simCtrl?.jumpToMissionLocation) {
                            simCtrl.jumpToMissionLocation(mission.id, event.date, true);
                        }
                    };
                    labelSpan.onmouseover = () => { labelSpan.style.textDecoration = 'underline'; };
                    labelSpan.onmouseout = () => { labelSpan.style.textDecoration = 'none'; };
                    row.appendChild(labelSpan);

                    timelineDiv.appendChild(row);
                });
                pageContainer.appendChild(timelineDiv);
            }
        }
    };

    updateView();
  };

  // Initial Empty State
  renderEmpty();
  
  // Track current displayed mission to avoid unnecessary re-renders
  let currentMissionId = null;

  // Listener
  const onMissionSelected = (e) => {
    const missionId = e.detail.missionId;
    // Skip re-render if already showing this mission
    if (missionId === currentMissionId) return;
    currentMissionId = missionId;
    renderMission(missionId);
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
