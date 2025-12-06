export function setupNavigationFolder(gui, uiState) {
  const navFolder = gui.addFolder('Mouse & Keys');
  const rotateCtrl = navFolder.add(uiState, 'rotate').name('Rotate');
  rotateCtrl.disable();
  const panCtrl = navFolder.add(uiState, 'pan').name('Pan');
  panCtrl.disable();
  const zoomCtrl = navFolder.add(uiState, 'zoom').name('Zoom');
  zoomCtrl.disable();
  const focusEnterCtrl = navFolder.add(uiState, 'focusEnter').name('Focus');
  focusEnterCtrl.disable();
  const focusExitCtrl = navFolder.add(uiState, 'focusExit').name('Exit Focus');
  focusExitCtrl.disable();
  const fullScreenCtrl = navFolder.add(uiState, 'fullScreen').name('Full Screen');
  fullScreenCtrl.disable();

  navFolder.close(); // Close Navigation folder by default
}
