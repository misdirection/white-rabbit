/**
 * MenuDock.js
 * Manages the main icon dock.
 */

export class MenuDock {
  constructor() {
    this.dock = document.createElement('div');
    this.dock.className = 'menu-dock';
    document.body.appendChild(this.dock);

    this.items = new Map();
  }

  /**
   * Adds an item to the dock
   * @param {string} id - Unique ID
   * @param {string} icon - Icon character or HTML
   * @param {string} label - Tooltip label
   * @param {function} onClick - Click handler
   */
  addItem(id, icon, label, onClick) {
    const item = document.createElement('div');
    item.className = 'dock-item';
    item.title = label;
    item.innerHTML = `<span class="dock-icon">${icon}</span>`;

    item.addEventListener('click', () => {
      onClick();
      this.updateActiveState(id);
    });

    this.dock.appendChild(item);
    this.items.set(id, item);
  }

  updateActiveState(_activeId) {
    // Optional: Highlight active window's icon
    // For toggle behavior, we might need to check window state
    // But for now, let's just add a visual click effect or active class if needed
    // The window manager handles the window visibility.
  }

  setActive(id, isActive) {
    const item = this.items.get(id);
    if (item) {
      if (isActive) item.classList.add('active');
      else item.classList.remove('active');
    }
  }
}

export const menuDock = new MenuDock();
