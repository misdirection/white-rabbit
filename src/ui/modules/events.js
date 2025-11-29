import { events, formatEventName, navigateToEvent } from '../../features/events.js';

export function setupEventsFolder(gui, camera, controls, planets, setScalePreset) {
  const eventsFolder = gui.addFolder('Events');
  eventsFolder.domElement.classList.add('events-folder');

  const eventsState = {
    query: '',
    selectedEvent: null,
  };

  // Create container for custom HTML
  const eventsContainer = document.createElement('div');
  eventsContainer.className = 'events-container';
  eventsContainer.innerHTML = `
        <div class="events-input-wrapper">
            <label for="events-search">Solar Eclipse</label>
            <input type="text" id="events-search" placeholder="Search..." autocomplete="off">
        </div>
        <div class="events-actions">
            <button id="btn-go-to-event" disabled>Go To</button>
        </div>
        <div id="events-status"></div>
    `;
  eventsFolder.domElement.querySelector('.children').appendChild(eventsContainer);

  // Create results dropdown appended to BODY to avoid overflow issues
  let resultsDiv = document.getElementById('events-results-dropdown');
  if (!resultsDiv) {
    resultsDiv = document.createElement('div');
    resultsDiv.id = 'events-results-dropdown';
    resultsDiv.className = 'events-results';
    document.body.appendChild(resultsDiv);
  }

  const searchInput = eventsContainer.querySelector('#events-search');
  const goToBtn = eventsContainer.querySelector('#btn-go-to-event');
  const statusDiv = eventsContainer.querySelector('#events-status');

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
    if (query.length < 1) {
      resultsDiv.style.display = 'none';
      return;
    }

    const matches = [];

    // Search through all events
    events.forEach((event) => {
      const eventName = formatEventName(event).toLowerCase();
      if (eventName.includes(query)) {
        matches.push(event);
      }
    });

    // Sort by date
    matches.sort((a, b) => a.date - b.date);

    // Display Results
    resultsDiv.innerHTML = '';
    if (matches.length > 0) {
      updateDropdownPosition();
      resultsDiv.style.display = 'block';
      matches.forEach((event) => {
        const div = document.createElement('div');
        div.className = 'events-result-item';
        const typeClass = event.type.includes('Total') ? 'total-eclipse' : 'annular-eclipse';
        div.innerHTML = `<span class="event-type ${typeClass}">${event.type}</span><span class="event-date">${event.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>`;
        div.onclick = () => {
          selectEvent(event);
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
  eventsFolder.domElement.closest('.lil-gui').addEventListener(
    'scroll',
    () => {
      if (resultsDiv.style.display === 'block') {
        updateDropdownPosition();
      }
    },
    true
  );

  function selectEvent(event) {
    eventsState.selectedEvent = event;
    searchInput.value = formatEventName(event);
    goToBtn.disabled = false;
    statusDiv.textContent = `Selected: ${formatEventName(event)}`;
  }

  goToBtn.onclick = () => {
    if (eventsState.selectedEvent && camera && controls) {
      // User requested to keep current scale mode
      // if (setScalePreset) {
      //   setScalePreset('Realistic');
      // }
      navigateToEvent(eventsState.selectedEvent, camera, controls, planets);
      statusDiv.textContent = `Navigating to ${formatEventName(eventsState.selectedEvent)}...`;
    }
  };

  // Add a dummy controller to prevent "Empty" message
  eventsFolder
    .add({ dummy: '' }, 'dummy')
    .name('Hidden')
    .onChange(() => {}).domElement.style.display = 'none';

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!eventsContainer.contains(e.target)) {
      resultsDiv.style.display = 'none';
    }
  });

  eventsFolder.close(); // Close Events folder by default
}
