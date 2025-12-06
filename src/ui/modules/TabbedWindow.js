/**
 * @file TabbedWindow.js
 * @description Tabbed window component with drag-and-drop tab docking/undocking functionality.
 *
 * This file implements a reusable tabbed window system that allows users to organize related UI
 * content into tabs within a single window. Tabs can be dragged out to create standalone windows
 * or docked back into the tabbed interface via drag-and-drop gestures.
 *
 * Key features:
 * -  Multiple tabs with icons and titles in a single window
 * - Drag-and-drop tab detachment: Mouse drag threshold (10px) before creating new window
 * - Auto-docking: Dragging a standalone window over the tab header re-docks it
 * - Ordered tab list: Maintains stable order (Objects, Constellations, Orbits, Magnetic)
 * - Active tab selection with visual highlighting
 * - Smooth scroll to active tab for better UX with many tabs
 * - Window manager integration for unified window lifecycle
 *
 * Used by the Visual Tools window to organize multiple visualization control panels.
 * The system prevents orphaning the last tab (cannot drag if only one tab exists).
 */
import { windowManager } from '../WindowManager.js';

export class TabbedWindow {
  constructor(id, title, options = {}) {
    this.id = id;
    this.tabs = []; // { id, title, contentElement, originalWindowId }
    this.activeTabId = null;

    // Create the main window via WindowManager
    this.window = windowManager.createWindow(id, title, {
      ...options,
      onClose: () => this.onClose(),
    });

    // Custom structure for tabs
    this.setupTabStructure();

    // Listen for drop events from other windows
    this.setupDropZone();

    // Start hidden
    windowManager.hideWindow(this.id);
  }

  setupTabStructure() {
    const contentContainer = this.window.content;
    contentContainer.innerHTML = ''; // Clear default content

    // Create Header for Tabs
    this.tabHeader = document.createElement('div');
    this.tabHeader.className = 'tab-header';
    contentContainer.appendChild(this.tabHeader);

    // Tab List
    this.tabList = document.createElement('div');
    this.tabList.className = 'tab-list';
    this.tabHeader.appendChild(this.tabList);

    // Create Content Area
    this.tabContentArea = document.createElement('div');
    this.tabContentArea.className = 'tab-content-area';
    contentContainer.appendChild(this.tabContentArea);
  }

  /**
   * Adds a tab to the window.
   * @param {string} id - Unique ID for the tab
   * @param {string} title - Title of the tab
   * @param {HTMLElement} contentElement - The DOM element for the tab content
   * @param {string} [icon] - Optional icon for the tab
   */
  addTab(id, title, contentElement, icon = '') {
    // Check if tab already exists
    if (this.tabs.find((t) => t.id === id)) return;

    // Ordered list of tab IDs
    const TAB_ORDER = ['objects', 'orbits', 'magnetic', 'guides', 'asterisms', 'system'];

    // Prepare content element
    contentElement.classList.add('tab-content'); // Add class for styling
    this.tabContentArea.appendChild(contentElement);

    const tab = { id, title, contentElement, icon };

    // Find correct insertion index
    let insertIndex = this.tabs.length;
    const orderIndex = TAB_ORDER.indexOf(id);

    if (orderIndex !== -1) {
      // If this tab is in our known list, try to place it correctly
      for (let i = 0; i < this.tabs.length; i++) {
        const existingId = this.tabs[i].id;
        const existingOrderIndex = TAB_ORDER.indexOf(existingId);

        // If existing tab is "after" us (or unknown, pushing it back), insert here
        // Unknown tabs (index -1) go to the end, i.e., larger than any known index?
        // Let's say unknown tabs go to the end.

        if (existingOrderIndex === -1) {
          // Determine policy for unknown tabs. Let's put known tabs first.
          // So if we are known, we come before unknown.
          insertIndex = i;
          break;
        } else if (existingOrderIndex > orderIndex) {
          insertIndex = i;
          break;
        }
      }
    } else {
      // We are unknown. We go to the end.
      insertIndex = this.tabs.length;
    }

    this.tabs.splice(insertIndex, 0, tab);

    this.renderTabs();

    // If it's the first tab, select it
    if (this.tabs.length === 1) {
      this.selectTab(id);
    }

    // Update buttons after adding
  }

  removeTab(id) {
    const index = this.tabs.findIndex((t) => t.id === id);
    if (index > -1) {
      const tab = this.tabs[index];

      // Remove content from DOM
      if (tab.contentElement.parentNode === this.tabContentArea) {
        this.tabContentArea.removeChild(tab.contentElement);
        tab.contentElement.classList.remove('tab-content', 'active-content');
      }

      this.tabs.splice(index, 1);
      this.renderTabs();

      // If we removed the active tab, switch to another one
      if (this.activeTabId === id) {
        if (this.tabs.length > 0) {
          // Select the previous tab, or the first one if we were at the start
          const newIndex = Math.max(0, index - 1);
          this.selectTab(this.tabs[newIndex].id);
        } else {
          this.activeTabId = null;
          // No need to clear innerHTML, we removed the child above
        }
      }
    }
  }

  selectTab(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;

    this.activeTabId = id;
    this.renderTabs();

    // Scroll to active tab if needed
    // We need to find the element
    // renderTabs rebuilds DOM, so we need to wait or find it after render
    // Ideally renderTabs shouldn't rebuild entire DOM every time, but for now it's fine.
    // Let's modify renderTabs to help or just find by text/class?
    // We can't find it easily because we rebuild it.
    // Let's defer scroll to renderTabs or do it here after a tick.

    setTimeout(() => {
      // Find active tab element
      // tab-list is this.tabList
      // children order matches this.tabs
      const index = this.tabs.findIndex((t) => t.id === id);
      if (index > -1 && this.tabList.children[index]) {
        const el = this.tabList.children[index];
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 0);

    // Update visibility classes
    this.tabs.forEach((t) => {
      if (t.id === id) {
        t.contentElement.classList.add('active-content');
      } else {
        t.contentElement.classList.remove('active-content');
      }
    });
  }

  renderTabs() {
    this.tabList.innerHTML = ''; // Append to tabList now
    this.tabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item';
      if (tab.id === this.activeTabId) tabEl.classList.add('active');

      // Icon + Title structure
      const iconSpan = document.createElement('span');
      iconSpan.className = 'tab-icon';
      iconSpan.innerHTML = tab.icon || ''; // Use innerHTML to support styled icons

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = tab.title;

      tabEl.appendChild(iconSpan);
      tabEl.appendChild(titleSpan);

      tabEl.title = tab.title; // Show full title on hover

      tabEl.addEventListener('mousedown', (e) => this.handleTabMouseDown(e, tab));

      this.tabList.appendChild(tabEl);
    });
  }

  handleTabMouseDown(e, tab) {
    e.stopPropagation(); // Prevent moving the main window immediately

    // Constraint: Prevent dragging if it's the last tab
    if (this.tabs.length <= 1) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      // Threshold to start dragging out
      if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        isDragging = true;
        this.detachTab(tab, moveEvent.clientX, moveEvent.clientY);
        cleanup();
      }
    };

    const onMouseUp = () => {
      // If we just clicked without dragging, select the tab
      if (!isDragging) {
        this.selectTab(tab.id);
      }
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  detachTab(tab, x, y) {
    // 1. Remove from this window
    this.removeTab(tab.id);

    // 2. Create new independent window
    // We try to re-use an existing window ID if this tab WAS a window before?
    // For simplicity, let's just make a new window ID based on the tab ID.
    const winId = `window_${tab.id}`;

    // Position it centered on mouse if possible, or just offset
    // x, y are mouse coordinates from the dragged event
    const newWin = windowManager.createWindow(winId, tab.title, {
      x: x - 150, // Center horizontally (width 300 / 2)
      y: y - 20, // Offset slightly
      width: '300px', // Default width
      height: 'auto',
      onClose: () => {
        // Restore tab to the main window when the detached window is closed
        this.addTab(tab.id, tab.title, tab.contentElement, tab.icon);
      },
    });

    // Force update position because createWindow might return a recycled window with old coordinates
    newWin.x = x - 150;
    newWin.y = y - 20;
    newWin.snapState = { x: 'none', y: 'none' };
    newWin.element.style.transform = `translate3d(${newWin.x}px, ${newWin.y}px, 0)`;

    // Add specific class to identify it as a dockable window
    newWin.element.classList.add('dockable-window');
    newWin.element.dataset.tabId = tab.id;
    newWin.element.dataset.tabTitle = tab.title;
    newWin.element.dataset.tabIcon = tab.icon || ''; // Save icon

    // Move content
    // Remove class before appending to new window to strip 'tab-content' behavior
    tab.contentElement.classList.remove('tab-content', 'active-content');
    newWin.content.appendChild(tab.contentElement);

    // Show it
    windowManager.showWindow(winId);
    windowManager.bringToFront(winId);

    // Transparently transfer drag focus to the new window
    // We dispatch a mousedown event on the new window so WindowManager picks it up
    // and starts dragging it immediately.
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    });
    newWin.element.dispatchEvent(mouseDownEvent);
  }

  setupDropZone() {
    // Better approach:
    // Make the header a registered "drop target" in our app logic.
    // For now, let's implement a global mouseup listener that checks for overlap
    // with any 'dockable-window' that is currently being dragged (or simply is open).

    document.addEventListener('mouseup', (e) => {
      // Check if any dockable window is overlapping this header
      // And is NOT the tabbed window itself.

      const windows = document.querySelectorAll('.dockable-window');
      const headerRect = this.tabHeader.getBoundingClientRect();

      windows.forEach((winEl) => {
        // Only if window is visible
        if (winEl.style.display === 'none') return;

        const winRect = winEl.getBoundingClientRect();

        // Check simple overlap
        const overlap = !(
          winRect.right < headerRect.left ||
          winRect.left > headerRect.right ||
          winRect.bottom < headerRect.top ||
          winRect.top > headerRect.bottom
        );

        if (overlap) {
          // DOCK IT!
          const tabId = winEl.dataset.tabId;
          const tabTitle = winEl.dataset.tabTitle;
          const tabIcon = winEl.dataset.tabIcon;

          // We need to grab the content back.
          // The content is inside .window-content.
          // winEl.querySelector('.window-content').children...
          // BUT, the contentElement we passed around is the direct child.
          // Let's assume the first child of window-content is our component.
          const content = winEl.querySelector('.window-content').firstElementChild;

          if (tabId && content) {
            this.addTab(tabId, tabTitle, content, tabIcon);
            // Close/Remove the standalone window
            windowManager.hideWindow(winEl.id);
          }
        }
      });
    });
  }

  onClose() {
    // Handle main window close
  }

  toggle() {
    windowManager.toggleWindow(this.id);
  }
}
