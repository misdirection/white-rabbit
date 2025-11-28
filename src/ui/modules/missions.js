export function setupMissionsFolder(gui, config) {
  const missionsFolder = gui.addFolder('Missions');
  const v1Ctrl = missionsFolder
    .add(config.showMissions, 'voyager1')
    .name('Voyager 1 (1977)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  v1Ctrl.domElement.classList.add('voyager1-checkbox');

  const v2Ctrl = missionsFolder
    .add(config.showMissions, 'voyager2')
    .name('Voyager 2 (1977)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  v2Ctrl.domElement.classList.add('voyager2-checkbox');

  const p10Ctrl = missionsFolder
    .add(config.showMissions, 'pioneer10')
    .name('Pioneer 10 (1972)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  p10Ctrl.domElement.classList.add('pioneer10-checkbox');

  const p11Ctrl = missionsFolder
    .add(config.showMissions, 'pioneer11')
    .name('Pioneer 11 (1973)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  p11Ctrl.domElement.classList.add('pioneer11-checkbox');

  const galCtrl = missionsFolder
    .add(config.showMissions, 'galileo')
    .name('Galileo (1989)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  galCtrl.domElement.classList.add('galileo-checkbox');

  missionsFolder.close(); // Close Missions subfolder by default
}
