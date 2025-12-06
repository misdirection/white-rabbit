import GUI from 'lil-gui';

export function setupMissionsControlsCustom(container, config) {
  const gui = new GUI({ container: container, width: '100%' });
  gui.domElement.classList.add('embedded-gui');
  gui.title('Missions'); // Set title to Missions
  // gui.domElement.querySelector('.title').style.display = 'none'; // Optional: hide title completely if preferred
  // Since we want "Missions (Check to Show)", we can just use the root.
  
  // Use the root gui instead of a folder, or just hide the root header.
  // To match user request "superfluous menu called controls", simply hiding the root title bar is best.
  // But lil-gui might not expose an easy way to hide just the header via API without CSS.
  // We can just add controls to root and user will see "Controls" title by default.
  // Let's set title to empty string?
  // gui.title(''); // This leaves a small bar.
  
  // Best approach: Add a CSS class to hide the title bar for embedded GUIs.
  // gui.domElement.querySelector('.title').style.display = 'none';
  // But we need to do it after creation.
  
  // Or better:
  const missionsFolder = gui; // Use root
  // We can't rename root easily in old lil-gui but recent versions allow `new GUI({ title: '...' })`.
  // Let's check imports. It's 'lil-gui'.
  // Let's try to set title to 'Missions'.

  // However, users said "sub menu called controls". 
  // If I use a folder, I get "Controls" > "Missions".
  // Note: I will use the root GUI and hide the title bar via DOM manipulation to be safe.
  
  const titleBar = gui.domElement.querySelector('.title');
  if (titleBar) titleBar.style.display = 'none';

  // Pioneer 10 (1972)
  const p10Ctrl = missionsFolder
    .add(config.showMissions, 'pioneer10')
    .name('Pioneer 10 (1972)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  p10Ctrl.domElement.classList.add('pioneer10-checkbox');

  // Pioneer 11 (1973)
  const p11Ctrl = missionsFolder
    .add(config.showMissions, 'pioneer11')
    .name('Pioneer 11 (1973)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  p11Ctrl.domElement.classList.add('pioneer11-checkbox');

  // Voyager 2 (1977)
  const v2Ctrl = missionsFolder
    .add(config.showMissions, 'voyager2')
    .name('Voyager 2 (1977)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  v2Ctrl.domElement.classList.add('voyager2-checkbox');

  // Voyager 1 (1977)
  const v1Ctrl = missionsFolder
    .add(config.showMissions, 'voyager1')
    .name('Voyager 1 (1977)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  v1Ctrl.domElement.classList.add('voyager1-checkbox');

  // Galileo (1989)
  const galCtrl = missionsFolder
    .add(config.showMissions, 'galileo')
    .name('Galileo (1989)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  galCtrl.domElement.classList.add('galileo-checkbox');

  // Ulysses (1990)
  const ulyssesCtrl = missionsFolder
    .add(config.showMissions, 'ulysses')
    .name('Ulysses (1990)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  ulyssesCtrl.domElement.classList.add('ulysses-checkbox');

  // Cassini (1997)
  const cassiniCtrl = missionsFolder
    .add(config.showMissions, 'cassini')
    .name('Cassini (1997)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  cassiniCtrl.domElement.classList.add('cassini-checkbox');

  // Rosetta (2004)
  const rosettaCtrl = missionsFolder
    .add(config.showMissions, 'rosetta')
    .name('Rosetta (2004)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  rosettaCtrl.domElement.classList.add('rosetta-checkbox');

  // New Horizons (2006)
  const nhCtrl = missionsFolder
    .add(config.showMissions, 'newHorizons')
    .name('New Horizons (2006)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  nhCtrl.domElement.classList.add('new-horizons-checkbox');

  // Juno (2011)
  const junoCtrl = missionsFolder
    .add(config.showMissions, 'juno')
    .name('Juno (2011)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  junoCtrl.domElement.classList.add('juno-checkbox');

  // Parker Solar Probe (2018)
  const parkerCtrl = missionsFolder
    .add(config.showMissions, 'parkerSolarProbe')
    .name('Parker Solar Probe (2018)')
    .onChange(() => {
      if (window.updateMissions) window.updateMissions();
    });
  parkerCtrl.domElement.classList.add('parker-checkbox');

  // We can open the folder or not. Since it's in a dedicated tab, maybe open is better?
  // missionsFolder.open(); 
  // Remove the folder header if we want to save space, but let's keep it for now as it acts as a group title.
}
