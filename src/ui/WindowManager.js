/**
 * WindowManager.js
 * Manages floating windows in the application.
 */
export class WindowManager {
  constructor() {
    this.windows = new Map();
    this.zIndexCounter = 1000;
    this.container = document.body; // Or a specific UI container
  }

  /**
   * Creates or returns an existing window
   * @param {string} id - Unique ID for the window
   * @param {string} title - Window title
   * @param {object} options - Options: { x, y, width, height, onClose }
   */
  createWindow(id, _title, options = {}) {
    if (this.windows.has(id)) {
      return this.windows.get(id);
    }

    const win = document.createElement('div');
    win.id = id;
    win.className = 'ui-window';
    win.style.zIndex = this.zIndexCounter++;

    // Default position/size
    const x = options.x || 100;
    const y = options.y || 100;
    win.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    if (options.width) win.style.width = options.width;
    if (options.height) win.style.height = options.height;

    win.innerHTML = `
      <div class="window-close">×</div>
      <div class="window-content"></div>
    `;

    this.container.appendChild(win);

    // Store reference
    const windowObj = {
      id,
      element: win,
      content: win.querySelector('.window-content'),
      closeBtn: win.querySelector('.window-close'),
      x,
      y,
      onClose: options.onClose,
    };

    this.windows.set(id, windowObj);
    this._setupInteractions(windowObj);

    return windowObj;
  }

  getWindow(id) {
    return this.windows.get(id);
  }

  toggleWindow(id) {
    const win = this.windows.get(id);
    if (win) {
      if (win.element.style.display === 'none') {
        this.showWindow(id);
      } else {
        this.hideWindow(id);
      }
    }
  }

  showWindow(id) {
    const win = this.windows.get(id);
    if (win) {
      win.element.style.display = 'flex';
      this.bringToFront(id);
    }
  }

  hideWindow(id) {
    const win = this.windows.get(id);
    if (win) {
      win.element.style.display = 'none';
      if (win.onClose) win.onClose();
    }
  }

  bringToFront(id) {
    const win = this.windows.get(id);
    if (win) {
      win.element.style.zIndex = ++this.zIndexCounter;
    }
  }

  _setupInteractions(winObj) {
    // Dragging
    let isDragging = false;
    let startX, startY;
    let initialWinX, initialWinY;

    const onMouseDown = (e) => {
      // Allow dragging from anywhere in the window EXCEPT interactive elements
      // like buttons, inputs, or the close button itself.
      if (
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('.control-btn') || // Time controls
        e.target.closest('.speedometer-interaction') || // Speedometer
        e.target === winObj.closeBtn
      ) {
        return;
      }

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialWinX = winObj.x;
      initialWinY = winObj.y;
      this.bringToFront(winObj.id);
      // e.preventDefault(); // Don't prevent default globally, might block text selection if we want that?
      // But for dragging, usually we want to prevent selection.
      // Let's prevent default only if we are actually dragging?
      // Or just on mousedown to be safe.
      // e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        winObj.x = initialWinX + dx;
        winObj.y = initialWinY + dy;

        winObj.element.style.transform = `translate3d(${winObj.x}px, ${winObj.y}px, 0)`;
        e.preventDefault(); // Prevent selection while dragging
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    winObj.element.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Close Button
    winObj.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag start if clicking close
      this.hideWindow(winObj.id);
    });

    // Focus on click (already handled by mousedown above essentially, but let's keep explicit bringToFront)
    winObj.element.addEventListener('mousedown', () => {
      this.bringToFront(winObj.id);
    });
  }
}

export const windowManager = new WindowManager();
