// Hidden Games Persistent Storage
function getHiddenAppIds() {
  try {
    const raw = localStorage.getItem('xboxSteamBridge_hiddenAppIds');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}

function saveHiddenAppIds(set) {
  try {
    localStorage.setItem('xboxSteamBridge_hiddenAppIds', JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error('Failed to save hidden app IDs:', e);
  }
}

// State
let appState = {
  version: '1.5.1',
  currentTab: 'missing',
  currentSection: 'library',
  steamRoots: [],
  libraries: [],
  games: [],
  xboxData: null,
  selectedAppIds: new Set(),
  hiddenAppIds: getHiddenAppIds(),
  searchQuery: '',
  isScanning: false,
  isSyncing: false,
  processInfo: { isRunning: false, processes: [] },
  customPaths: []
};

// DOM Elements
const semverBadge = document.getElementById('semverBadge');
const footerVersionBadge = document.getElementById('footerVersionBadge');
const statSteamGames = document.getElementById('statSteamGames');
const statLibrariesCount = document.getElementById('statLibrariesCount');
const statXboxGames = document.getElementById('statXboxGames');
const statXboxStatus = document.getElementById('statXboxStatus');
const statMissingGames = document.getElementById('statMissingGames');
const statSyncedGames = document.getElementById('statSyncedGames');
const badgeMissing = document.getElementById('badgeMissing');
const badgeSynced = document.getElementById('badgeSynced');
const badgeAll = document.getElementById('badgeAll');
const badgeHidden = document.getElementById('badgeHidden');
const badgeXbox = document.getElementById('badgeXbox');
const searchInput = document.getElementById('searchInput');
const gamesContainer = document.getElementById('gamesContainer');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const selectionSummary = document.getElementById('selectionSummary');
const selectLabel = document.getElementById('selectLabel');
const selectionBanner = document.getElementById('selectionBanner');
const btnScan = document.getElementById('btnScan');
const scanIcon = document.getElementById('scanIcon');
const scanBtnText = document.getElementById('scanBtnText');
const btnSync = document.getElementById('btnSync');
const syncBtnLabel = document.getElementById('syncBtnLabel');
const btnAddFolder = document.getElementById('btnAddFolder');
const btnBackups = document.getElementById('btnBackups');
const processPill = document.getElementById('processPill');
const processDot = document.getElementById('processDot');
const processLabel = document.getElementById('processLabel');
const btnKillXbox = document.getElementById('btnKillXbox');
const consoleLogs = document.getElementById('consoleLogs');
const btnClearLog = document.getElementById('btnClearLog');
const consoleDrawer = document.getElementById('consoleDrawer');
const drawerHeader = document.getElementById('drawerHeader');
const drawerPreviewText = document.getElementById('drawerPreviewText');
const searchClearBtn = document.getElementById('searchClearBtn');
const gamepadStatusPill = document.getElementById('gamepadStatusPill');
const gamepadStatusText = document.getElementById('gamepadStatusText');

// Console Navigation Elements
const navBtnLibrary = document.getElementById('navBtnLibrary');
const navBtnSync = document.getElementById('navBtnSync');
const navBtnBackups = document.getElementById('navBtnBackups');
const navBtnSettings = document.getElementById('navBtnSettings');
const badgeLB = document.getElementById('badgeLB');
const badgeRB = document.getElementById('badgeRB');
const badgeLT = document.getElementById('badgeLT');
const badgeRT = document.getElementById('badgeRT');
const sectionSubtitle = document.getElementById('sectionSubtitle');
const sectionCount = document.getElementById('sectionCount');

// Modal Elements: Confirm
const confirmModal = document.getElementById('confirmModal');
const modalGameCount = document.getElementById('modalGameCount');
const modalProcessWarning = document.getElementById('modalProcessWarning');
const btnCancelSync = document.getElementById('btnCancelSync');
const btnProceedSync = document.getElementById('btnProceedSync');
const btnCloseConfirm = document.getElementById('btnCloseConfirm');

// Modal Elements: Backups
const backupsModal = document.getElementById('backupsModal');
const btnCloseBackups = document.getElementById('btnCloseBackups');
const btnCloseBackupsFooter = document.getElementById('btnCloseBackupsFooter');
const backupsList = document.getElementById('backupsList');

// Modal Elements: Uninject
const uninjectModal = document.getElementById('uninjectModal');
const uninjectTitleName = document.getElementById('uninjectTitleName');
const btnCloseUninject = document.getElementById('btnCloseUninject');
const btnCancelUninject = document.getElementById('btnCancelUninject');
const btnProceedUninject = document.getElementById('btnProceedUninject');
let pendingUninjectAppId = null;
let pendingUninjectTitle = '';

// Modal Elements: Settings & Folders
const settingsModal = document.getElementById('settingsModal');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnCloseSettingsFooter = document.getElementById('btnCloseSettingsFooter');
const btnSettingsAddFolder = document.getElementById('btnSettingsAddFolder');
const btnResetHidden = document.getElementById('btnResetHidden');
const settingsLibrariesList = document.getElementById('settingsLibrariesList');
const settingsHiddenCount = document.getElementById('settingsHiddenCount');
const settingsXboxPath = document.getElementById('settingsXboxPath');

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  controllerNav.init();
  await loadVersion();
  await checkProcesses();
  await triggerScan();
});

// Setup Events
function setupEventListeners() {
  // Category Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const tab = e.currentTarget.getAttribute('data-tab');
      e.currentTarget.classList.add('active');
      appState.currentTab = tab;
      render();
    });
  });

  // Center Section Navigation Links
  const sectionNavBtns = document.querySelectorAll('.section-nav-btn');
  sectionNavBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      sectionNavBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const sec = e.currentTarget.getAttribute('data-section');
      appState.currentSection = sec;
      if (sec === 'sync') {
        const missingTab = document.getElementById('tabMissing');
        if (missingTab) missingTab.click();
        if (btnSync && !btnSync.disabled) btnSync.focus();
      } else if (sec === 'backups') {
        openBackupsModal();
      } else if (sec === 'settings') {
        openSettingsModal();
      } else {
        render();
      }
    });
  });

  // Shoulder & Trigger Navigation Badges (Interactive clicks & taps)
  if (badgeLB) {
    badgeLB.addEventListener('click', () => controllerNav.switchSection(-1));
  }
  if (badgeRB) {
    badgeRB.addEventListener('click', () => controllerNav.switchSection(1));
  }
  if (badgeLT) {
    badgeLT.addEventListener('click', () => controllerNav.switchTab(-1));
  }
  if (badgeRT) {
    badgeRT.addEventListener('click', () => controllerNav.switchTab(1));
  }

  // Search input
  searchInput.addEventListener('input', (e) => {
    appState.searchQuery = e.target.value.toLowerCase().trim();
    if (searchClearBtn) {
      searchClearBtn.style.display = appState.searchQuery ? 'block' : 'none';
    }
    renderCards();
  });

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      appState.searchQuery = '';
      searchClearBtn.style.display = 'none';
      searchInput.focus();
      renderCards();
    });
  }

  // Select all checkbox
  selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const missingFiltered = getFilteredMissingGames();
    if (isChecked) {
      missingFiltered.forEach(g => appState.selectedAppIds.add(g.appid));
    } else {
      missingFiltered.forEach(g => appState.selectedAppIds.delete(g.appid));
    }
    render();
  });

  // Scan Button
  btnScan.addEventListener('click', () => {
    if (!appState.isScanning) {
      triggerScan();
    }
  });

  // Sync to Xbox Button
  btnSync.addEventListener('click', () => {
    const toSync = getSelectedMissingGames();
    if (toSync.length === 0) return;
    openConfirmModal(toSync);
  });

  // Add Custom Folder Button
  if (btnAddFolder) {
    btnAddFolder.addEventListener('click', async () => {
      await promptAddFolder();
    });
  }

  // Backups Modal
  if (btnBackups) {
    btnBackups.addEventListener('click', async () => {
      await openBackupsModal();
    });
  }

  if (btnCloseBackups) {
    btnCloseBackups.addEventListener('click', () => {
      backupsModal.style.display = 'none';
    });
  }

  if (btnCloseBackupsFooter) {
    btnCloseBackupsFooter.addEventListener('click', () => {
      backupsModal.style.display = 'none';
    });
  }

  // Settings Modal Handlers
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }

  if (btnCloseSettingsFooter) {
    btnCloseSettingsFooter.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }

  if (btnSettingsAddFolder) {
    btnSettingsAddFolder.addEventListener('click', async () => {
      await promptAddFolder();
      updateSettingsModalUI();
    });
  }

  if (btnResetHidden) {
    btnResetHidden.addEventListener('click', () => {
      appState.hiddenAppIds.clear();
      saveHiddenAppIds(appState.hiddenAppIds);
      updateSettingsModalUI();
      render();
      logConsole('[Settings] Reset all hidden game titles.', 'info');
    });
  }

  // Kill Xbox Button
  if (btnKillXbox) {
    btnKillXbox.addEventListener('click', async () => {
      await closeXboxApp();
    });
  }

  // Drawer Toggles (if present)
  if (drawerHeader && consoleDrawer) {
    drawerHeader.addEventListener('click', () => {
      consoleDrawer.classList.toggle('collapsed');
    });
  }

  if (btnClearLog) {
    btnClearLog.addEventListener('click', (e) => {
      e.stopPropagation();
      consoleLogs.innerHTML = '';
      if (drawerPreviewText) drawerPreviewText.textContent = 'Console cleared.';
    });
  }

  // Modal Actions: Sync
  if (btnCloseConfirm) {
    btnCloseConfirm.addEventListener('click', () => {
      confirmModal.style.display = 'none';
    });
  }

  btnCancelSync.addEventListener('click', () => {
    confirmModal.style.display = 'none';
  });

  btnProceedSync.addEventListener('click', async () => {
    confirmModal.style.display = 'none';
    await executeSync();
  });

  // Modal Actions: Uninject
  if (btnCloseUninject) {
    btnCloseUninject.addEventListener('click', () => {
      uninjectModal.style.display = 'none';
      pendingUninjectAppId = null;
    });
  }

  if (btnCancelUninject) {
    btnCancelUninject.addEventListener('click', () => {
      uninjectModal.style.display = 'none';
      pendingUninjectAppId = null;
    });
  }

  if (btnProceedUninject) {
    btnProceedUninject.addEventListener('click', async () => {
      if (pendingUninjectAppId) {
        const id = pendingUninjectAppId;
        const title = pendingUninjectTitle;
        uninjectModal.style.display = 'none';
        pendingUninjectAppId = null;
        await executeUninject(id, title);
      }
    });
  }

  // FSE Controls
  const btnToggleFse = document.getElementById('btnToggleFse');
  const updateFseState = (isFull) => {
    document.body.classList.toggle('fse-active', !!isFull);
    const fseBtnLabel = document.getElementById('fseBtnLabel');
    if (fseBtnLabel) {
      fseBtnLabel.textContent = isFull ? 'Exit FSE' : 'FSE';
    }
    const fseIcon = document.getElementById('fseIcon');
    if (fseIcon) {
      fseIcon.innerHTML = isFull
        ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'
        : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
    }
    if (btnToggleFse) {
      btnToggleFse.classList.toggle('active', !!isFull);
    }
  };

  async function toggleFse() {
    try {
      let isFull = false;
      if (window.api && typeof window.api.toggleFullscreen === 'function') {
        isFull = await window.api.toggleFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        isFull = false;
      } else {
        await document.documentElement.requestFullscreen();
        isFull = true;
      }
      updateFseState(isFull);
    } catch (e) {
      console.warn('FSE toggle error, attempting DOM fullscreen fallback:', e);
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => updateFseState(true)).catch(() => {});
      } else {
        document.exitFullscreen().then(() => updateFseState(false)).catch(() => {});
      }
    }
  }

  if (btnToggleFse) {
    btnToggleFse.addEventListener('click', toggleFse);
  }

  // Handle IPC and keyboard F11
  if (window.api && typeof window.api.onFullscreenChange === 'function') {
    window.api.onFullscreenChange(isFull => {
      updateFseState(isFull);
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFse();
    }
  });

  // Query initial fullscreen state
  if (window.api && typeof window.api.getFullscreenState === 'function') {
    window.api.getFullscreenState().then(updateFseState);
  }

  // Listen to IPC sync progress events
  window.api.onSyncProgress(data => {
    if (data.stage === 'backup') {
      logConsole(`[Backup] ${data.message}`, 'info');
    } else if (data.stage === 'item') {
      logConsole(`[Inject] (${data.index}/${data.total}) ${data.title}`, 'success');
    } else if (data.stage === 'done') {
      logConsole(`[Done] ${data.message}`, 'success');
    } else {
      logConsole(`[Sync] ${data.message}`, 'info');
    }
  });
}

// Version
async function loadVersion() {
  try {
    const v = await window.api.getAppVersion();
    appState.version = v;
    if (semverBadge) semverBadge.textContent = `v${v}`;
    if (footerVersionBadge) footerVersionBadge.textContent = `v${v}`;
  } catch {
    if (semverBadge) semverBadge.textContent = 'v1.5.0';
    if (footerVersionBadge) footerVersionBadge.textContent = 'v1.5.0';
  }
}

// Process Checks
async function checkProcesses() {
  try {
    const p = await window.api.checkProcesses();
    appState.processInfo = p;
    if (p.isRunning) {
      processPill.classList.remove('ready');
      processPill.classList.add('running');
      processDot.classList.add('running');
      processLabel.textContent = `Xbox App Active (${p.processes.length} proc)`;
      btnKillXbox.style.display = 'inline-block';
      logConsole(`[Process] Detected active Xbox process: ${p.processes.map(x => x.name).join(', ')}`, 'warn');
    } else {
      processPill.classList.remove('running');
      processPill.classList.add('ready');
      processDot.classList.remove('running');
      processLabel.textContent = 'Xbox App Closed';
      btnKillXbox.style.display = 'none';
    }
  } catch (e) {
    logConsole(`[Process Check Error] ${e.message}`, 'error');
  }
}

async function closeXboxApp() {
  btnKillXbox.disabled = true;
  btnKillXbox.textContent = 'Closing...';
  logConsole('[Process] Requesting graceful Xbox App shutdown...', 'info');
  try {
    const res = await window.api.closeProcesses();
    if (res.success) {
      logConsole('[Process] Xbox App closed successfully.', 'success');
    } else {
      logConsole(`[Process] Could not close Xbox: ${res.error}`, 'error');
    }
  } catch (err) {
    logConsole(`[Process] Error: ${err.message}`, 'error');
  } finally {
    btnKillXbox.disabled = false;
    btnKillXbox.textContent = 'Close Xbox';
    await checkProcesses();
  }
}

// Scan Trigger
async function triggerScan() {
  appState.isScanning = true;
  btnScan.disabled = true;
  scanIcon.classList.add('spinning');
  scanBtnText.textContent = 'Scanning...';
  logConsole('[Scanner] Starting scan of Steam and Xbox libraries...', 'info');

  try {
    const res = await window.api.scanSteam(appState.customPaths);
    if (!res.success) {
      throw new Error(res.error || 'Scan failed.');
    }

    appState.steamRoots = res.steamRoots || [];
    appState.libraries = res.libraries || [];
    appState.games = res.games || [];
    appState.xboxData = res.xboxData || null;

    // Reset selection to all missing games by default
    appState.selectedAppIds.clear();
    appState.games.forEach(g => {
      if (!g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid))) {
        appState.selectedAppIds.add(g.appid);
      }
    });

    logConsole(`[Scanner] Found ${res.totalSteamGames} Steam games across ${appState.libraries.length} library folders.`, 'success');
    logConsole(`[Scanner] Xbox App local library has ${res.xboxData ? res.xboxData.totalRegisteredXboxTitles : 0} registered titles.`, 'info');
    logConsole(`[Scanner] Synchronization status: ${res.missingCount} Missing, ${res.syncedCount} Synced.`, 'info');

    render();
  } catch (e) {
    logConsole(`[Scan Error] ${e.message}`, 'error');
  } finally {
    appState.isScanning = false;
    btnScan.disabled = false;
    scanIcon.classList.remove('spinning');
    scanBtnText.textContent = 'Scan';
  }
}

// Title Hiding & Unhiding
function hideGame(appId) {
  const strId = String(appId);
  appState.hiddenAppIds.add(strId);
  appState.selectedAppIds.delete(strId);
  saveHiddenAppIds(appState.hiddenAppIds);
  const found = appState.games.find(g => String(g.appid) === strId);
  const title = found ? found.name : strId;
  logConsole(`[Library] Hid title: "${title}" (AppID: ${strId})`, 'info');
  render();
}

function unhideGame(appId) {
  const strId = String(appId);
  appState.hiddenAppIds.delete(strId);
  saveHiddenAppIds(appState.hiddenAppIds);
  const found = appState.games.find(g => String(g.appid) === strId);
  const title = found ? found.name : strId;
  if (found && !found.isDuplicate) {
    appState.selectedAppIds.add(strId);
  }
  logConsole(`[Library] Restored title: "${title}" (AppID: ${strId})`, 'success');
  render();
}

// Uninject Flow
function promptUninjectGame(appId, title) {
  pendingUninjectAppId = appId;
  pendingUninjectTitle = title || 'this game';
  if (uninjectTitleName) uninjectTitleName.textContent = pendingUninjectTitle;
  if (uninjectModal) {
    uninjectModal.style.display = 'flex';
    if (typeof controllerNav !== 'undefined' && controllerNav.isActive) {
      controllerNav.applyFocus(btnProceedUninject);
    }
  }
}

async function executeUninject(appId, title) {
  logConsole(`[Uninject] Removing "${title || appId}" from Xbox App database...`, 'info');
  try {
    const res = await window.api.uninjectGame(appId);
    if (res.success) {
      logConsole(`[Uninject] Successfully uninjected "${title || appId}".`, 'success');
      await triggerScan();
    } else {
      logConsole(`[Uninject Error] ${res.error || 'Failed to uninject game.'}`, 'error');
    }
  } catch (err) {
    logConsole(`[Uninject Error] ${err.message}`, 'error');
  }
}

// Filtering Helpers
function getFilteredMissingGames() {
  const q = appState.searchQuery;
  return appState.games.filter(g => {
    if (g.isDuplicate) return false;
    if (appState.hiddenAppIds.has(String(g.appid))) return false;
    if (q) {
      return g.name.toLowerCase().includes(q) || g.appid.includes(q);
    }
    return true;
  });
}

function getSelectedMissingGames() {
  return appState.games.filter(g => !g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid)) && appState.selectedAppIds.has(g.appid));
}

// Rendering
function render() {
  const missing = appState.games.filter(g => !g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid)));
  const synced = appState.games.filter(g => g.isDuplicate);
  const allSteam = appState.games;
  const hiddenGames = appState.games.filter(g => appState.hiddenAppIds.has(String(g.appid)));
  const xboxCustom = (appState.xboxData && appState.xboxData.customGames) ? appState.xboxData.customGames : [];

  // Update Stats
  if (statSteamGames) statSteamGames.textContent = allSteam.length;
  if (statLibrariesCount) statLibrariesCount.textContent = `${appState.libraries.length} library folder${appState.libraries.length === 1 ? '' : 's'}`;

  const totalXbox = xboxCustom.length;
  if (statXboxGames) statXboxGames.textContent = totalXbox;
  if (statXboxStatus) statXboxStatus.textContent = `${totalXbox} custom title${totalXbox === 1 ? '' : 's'}`;

  if (statMissingGames) statMissingGames.textContent = missing.length;
  if (statSyncedGames) statSyncedGames.textContent = synced.length;

  if (badgeMissing) badgeMissing.textContent = missing.length;
  if (badgeSynced) badgeSynced.textContent = synced.length;
  if (badgeAll) badgeAll.textContent = allSteam.length;
  if (badgeHidden) badgeHidden.textContent = hiddenGames.length;
  if (badgeXbox) badgeXbox.textContent = totalXbox;

  // Sync Button State
  const selectedCount = getSelectedMissingGames().length;
  btnSync.disabled = selectedCount === 0 || appState.isSyncing;
  syncBtnLabel.textContent = selectedCount > 0 ? `Sync ${selectedCount} to Xbox` : 'Sync to Xbox App';

  // Section Header Headline (My Games | Steam Bridge (X games))
  if (sectionSubtitle && sectionCount) {
    const titles = {
      missing: 'Missing from Xbox',
      synced: 'Synced to Xbox',
      all: 'All Steam Titles',
      hidden: 'Hidden Games',
      xbox: 'Xbox App Library'
    };
    sectionSubtitle.textContent = titles[appState.currentTab] || 'Steam Bridge';
    const currentCount = (appState.currentTab === 'missing') ? missing.length :
                         (appState.currentTab === 'synced') ? synced.length :
                         (appState.currentTab === 'all') ? allSteam.length :
                         (appState.currentTab === 'hidden') ? hiddenGames.length : totalXbox;
    sectionCount.textContent = `(${currentCount} game${currentCount === 1 ? '' : 's'})`;
  }

  // Selection Banner Visibility
  if (appState.currentTab === 'missing') {
    selectionBanner.style.display = 'flex';
    renderSelectionState();
  } else {
    selectionBanner.style.display = 'none';
  }

  renderCards();
}

function renderSelectionState() {
  const missingFiltered = getFilteredMissingGames();
  const selectedCount = getSelectedMissingGames().length;
  selectAllCheckbox.checked = missingFiltered.length > 0 && missingFiltered.every(g => appState.selectedAppIds.has(g.appid));
  selectLabel.textContent = `Select All (${missingFiltered.length})`;
  selectionSummary.textContent = `${selectedCount} title${selectedCount === 1 ? '' : 's'} selected for injection`;
}

function renderCards() {
  gamesContainer.className = 'games-showcase games-grid';
  gamesContainer.innerHTML = '';

  let listToDisplay = [];
  const q = appState.searchQuery;

  if (appState.currentTab === 'missing') {
    listToDisplay = appState.games.filter(g => !g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid)));
  } else if (appState.currentTab === 'synced') {
    listToDisplay = appState.games.filter(g => g.isDuplicate);
  } else if (appState.currentTab === 'all') {
    listToDisplay = appState.games;
  } else if (appState.currentTab === 'hidden') {
    listToDisplay = appState.games.filter(g => appState.hiddenAppIds.has(String(g.appid)));
  } else if (appState.currentTab === 'xbox') {
    const custom = (appState.xboxData && appState.xboxData.customGames) ? appState.xboxData.customGames : [];
    if (q) {
      listToDisplay = custom.filter(x => (x.title || '').toLowerCase().includes(q));
    } else {
      listToDisplay = custom;
    }
    renderXboxCards(listToDisplay);
    return;
  }

  // Filter by search
  if (q) {
    listToDisplay = listToDisplay.filter(g =>
      g.name.toLowerCase().includes(q) || String(g.appid).includes(q)
    );
  }

  if (listToDisplay.length === 0) {
    renderEmptyState();
    return;
  }

  listToDisplay.forEach(game => {
    const card = document.createElement('div');
    const isSelected = appState.selectedAppIds.has(game.appid);
    card.className = `game-card ${isSelected && !game.isDuplicate ? 'selected' : ''}`;

    const isHidden = appState.hiddenAppIds.has(String(game.appid));
    const isMissingTab = appState.currentTab === 'missing';

    let statusPillClass = 'pill-missing';
    let statusPillText = 'Missing from Xbox';
    if (game.isDuplicate) {
      statusPillClass = 'pill-synced';
      statusPillText = 'In Xbox Library';
    } else if (isHidden) {
      statusPillClass = 'pill-hidden';
      statusPillText = 'Hidden';
    }

    const exeName = game.primaryExecutable ? game.primaryExecutable.split(/[\\/]/).pop() : 'steam://';

    const steamSvg = `
      <div class="card-platform-badge" title="Steam Platform">
        <svg viewBox="0 0 24 24" fill="none" stroke="#66c0f4" stroke-width="2">
          <circle cx="12" cy="12" r="9"/>
          <circle cx="15.5" cy="8.5" r="2.5" fill="#66c0f4"/>
          <path d="M7 15l4.5-2.5"/>
          <circle cx="7" cy="15" r="2" fill="#66c0f4"/>
        </svg>
      </div>`;

    card.innerHTML = `
      <div class="card-header-art">
        ${isMissingTab ? `
          <input type="checkbox" class="card-checkbox" data-appid="${game.appid}" ${isSelected ? 'checked' : ''} />
        ` : ''}
        <span class="card-status-pill ${statusPillClass}">
          ${statusPillText}
        </span>
        ${steamSvg}
        <img src="${game.headerUrl || `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`}" alt="${game.name}" onerror="this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg'; this.onerror=null;" />
      </div>
      <div class="card-body">
        <h3 class="game-title" title="${game.name}">${game.name}</h3>
        <div class="game-meta">
          <span>AppID: ${game.appid}</span>
          <span>•</span>
          <span>${exeName}</span>
        </div>
        ${game.isDuplicate && game.matchReason ? `
          <div class="match-reason-box">${game.matchReason}</div>
        ` : ''}
        <div class="card-footer-row">
          <div class="game-path" title="${game.installLocation || ''}">${game.installLocation || 'Steam Library'}</div>
          <div class="card-actions-group">
            ${game.isDuplicate ? `
              <button class="card-action-btn btn-uninject" data-appid="${game.appid}" title="Remove title from Xbox App">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span>Uninject</span>
              </button>
            ` : (isHidden ? `
              <button class="card-action-btn btn-unhide" data-appid="${game.appid}" title="Unhide and restore to suggestions">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>Unhide</span>
              </button>
            ` : `
              <button class="card-action-btn btn-hide" data-appid="${game.appid}" title="Hide from injection suggestions">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                <span>Hide</span>
              </button>
            `)}
          </div>
        </div>
      </div>
    `;

    // Button event bindings
    const uninjectBtn = card.querySelector('.btn-uninject');
    if (uninjectBtn) {
      uninjectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptUninjectGame(game.appid, game.name);
      });
    }

    const hideBtn = card.querySelector('.btn-hide');
    if (hideBtn) {
      hideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideGame(game.appid);
      });
    }

    const unhideBtn = card.querySelector('.btn-unhide');
    if (unhideBtn) {
      unhideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        unhideGame(game.appid);
      });
    }

    if (isMissingTab) {
      card.classList.add('touch-interactive');
      const checkbox = card.querySelector('.card-checkbox');

      const toggleSelection = (shouldSelect) => {
        if (shouldSelect) {
          appState.selectedAppIds.add(game.appid);
          card.classList.add('selected');
        } else {
          appState.selectedAppIds.delete(game.appid);
          card.classList.remove('selected');
        }
        renderSelectionState();
        const selCount = getSelectedMissingGames().length;
        btnSync.disabled = selCount === 0;
        syncBtnLabel.textContent = selCount > 0 ? `Sync ${selCount} to Xbox` : 'Sync to Xbox App';
      };

      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          toggleSelection(e.target.checked);
        });
      }

      // Handheld touch optimization: Tap anywhere on the card to toggle selection
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-action-btn') || e.target.classList.contains('card-checkbox')) return;
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          toggleSelection(checkbox.checked);
        }
      });
    }

    gamesContainer.appendChild(card);
  });

  // If controller mode is active, maintain active focus glow
  if (typeof controllerNav !== 'undefined' && controllerNav.isActive) {
    setTimeout(() => {
      if (!controllerNav.focusedEl || !document.body.contains(controllerNav.focusedEl)) {
        controllerNav.focusFirstAvailable();
      } else {
        controllerNav.applyFocus(controllerNav.focusedEl);
      }
    }, 40);
  }
}

function renderXboxCards(xboxGames) {
  gamesContainer.className = 'games-showcase games-grid';
  if (xboxGames.length === 0) {
    renderEmptyState();
    return;
  }

  xboxGames.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'game-card';
    const isCustom = entry.isCustom;
    const title = entry.title || 'Unknown Title';
    const imagePath = entry.imagePath || entry.bannerUrl || entry.thumbnailFile || 'https://assets.xboxservices.com/assets/79/32/7932e6a9-8588-4db9-8b89-299f01bc49b0.jpg';
    const canUninject = isCustom || (entry.id && String(entry.id).startsWith('steam_')) || entry.provider === 'steam';

    const xboxSvg = `
      <div class="card-platform-badge" title="Xbox Title">
        <svg viewBox="0 0 24 24" fill="none" stroke="#00e575" stroke-width="2">
          <circle cx="12" cy="12" r="9"/>
          <path d="M8 8c2.5 2 5.5 2 8 0M8 16c2.5-2 5.5-2 8 0"/>
          <line x1="7.5" y1="7.5" x2="16.5" y2="16.5"/>
          <line x1="16.5" y1="7.5" x2="7.5" y2="16.5"/>
        </svg>
      </div>`;

    card.innerHTML = `
      <div class="card-header-art">
        <span class="card-status-pill ${isCustom ? 'pill-synced' : 'pill-native'}">
          ${isCustom ? (entry.source || 'Sideloaded') : 'Xbox Store'}
        </span>
        ${xboxSvg}
        <img src="${imagePath}" alt="${title}" onerror="this.src='https://assets.xboxservices.com/assets/79/32/7932e6a9-8588-4db9-8b89-299f01bc49b0.jpg'" />
      </div>
      <div class="card-body">
        <h3 class="game-title" title="${title}">${title}</h3>
        <div class="game-meta">
          <span>${entry.id ? entry.id : 'ID'}</span>
          <span>•</span>
          <span>${entry.storefront || entry.source || entry.provider || 'Xbox'}</span>
        </div>
        <div class="card-footer-row">
          <div class="game-path" title="${entry.launchUri || entry.installLocation || ''}">
            ${entry.launchUri || entry.installLocation || 'Installed in Xbox'}
          </div>
          <div class="card-actions-group">
            ${canUninject ? `
              <button class="card-action-btn btn-uninject" data-id="${entry.originalId || entry.id}" title="Remove title from Xbox App">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span>Uninject</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    const uninjectBtn = card.querySelector('.btn-uninject');
    if (uninjectBtn) {
      uninjectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptUninjectGame(entry.originalId || entry.id, title);
      });
    }

    gamesContainer.appendChild(card);
  });

  if (typeof controllerNav !== 'undefined' && controllerNav.isActive) {
    setTimeout(() => {
      if (!controllerNav.focusedEl || !document.body.contains(controllerNav.focusedEl)) {
        controllerNav.focusFirstAvailable();
      } else {
        controllerNav.applyFocus(controllerNav.focusedEl);
      }
    }, 40);
  }
}

function renderEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  if (appState.searchQuery) {
    empty.innerHTML = `
      <div class="empty-icon-wrap">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <h3 class="empty-title">No matching titles</h3>
      <p class="empty-desc">No games match the query "${appState.searchQuery}". Clear your search to restore your library.</p>
    `;
  } else if (appState.currentTab === 'missing') {
    empty.innerHTML = `
      <div class="empty-icon-wrap">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="#00E575" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <h3 class="empty-title">All Titles Synchronized</h3>
      <p class="empty-desc">Every detected Steam title is already registered inside your PC Xbox App library.</p>
    `;
  } else if (appState.currentTab === 'synced') {
    empty.innerHTML = `
      <div class="empty-icon-wrap">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h3 class="empty-title">No Synced Titles Yet</h3>
      <p class="empty-desc">Switch to the "Missing" tab and tap "Sync to Xbox App" to inject titles.</p>
    `;
  } else if (appState.currentTab === 'hidden') {
    empty.innerHTML = `
      <div class="empty-icon-wrap">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      </div>
      <h3 class="empty-title">No Hidden Titles</h3>
      <p class="empty-desc">You have not hidden any games. Use the "Hide" button on any card to exclude it from suggestions.</p>
    `;
  } else {
    empty.innerHTML = `
      <div class="empty-icon-wrap">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </div>
      <h3 class="empty-title">No Steam Games Detected</h3>
      <p class="empty-desc">No Steam library folders were found automatically. Click "Add Folder" to specify a custom library directory.</p>
      <div style="margin-top: 14px;">
        <button class="console-btn btn-ghost" id="emptyBtnFolder">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>Add Folder</span>
        </button>
      </div>
    `;

    const folderBtn = empty.querySelector('#emptyBtnFolder');
    if (folderBtn) {
      folderBtn.addEventListener('click', () => {
        btnAddFolder.click();
      });
    }
  }

  gamesContainer.appendChild(empty);
}

// ============================================================================
// Controller & Gamepad Navigation Engine (Universal Windows & Handheld Support)
// ============================================================================
const controllerNav = {
  isActive: false,
  focusedEl: null,
  lastActionTime: 0,
  lastStickDir: null,
  stickHoldStart: 0,
  repeatDelay: 180, // ms debounce between directional repeats
  initialDelay: 320, // ms before first repeat
  prevButtons: new Map(),
  lastControllerActionTime: 0,

  init() {
    this.hintsHud = document.getElementById('footerControllerLegend');

    // Deliberate mouse movement filter
    let mouseAccumDist = 0;
    let lastMouseX = null;
    let lastMouseY = null;

    window.addEventListener('mousemove', (e) => {
      // Handheld stick mouse-emulation protection: ignore mouse movement within 700ms of controller input
      if (performance.now() - this.lastControllerActionTime < 700) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
      }

      if (lastMouseX !== null && lastMouseY !== null) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        mouseAccumDist += Math.hypot(dx, dy);
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // When deliberate mouse movement occurs (>25px total): return to desktop mode
      if (mouseAccumDist > 25) {
        mouseAccumDist = 0;
        if (this.isActive) {
          this.deactivate();
        }
      }
    });

    // Mouse click or touch immediately returns to desktop mode
    window.addEventListener('mousedown', () => {
      mouseAccumDist = 0;
      if (this.isActive) {
        this.deactivate();
      }
    });

    window.addEventListener('touchstart', () => {
      mouseAccumDist = 0;
      if (this.isActive) {
        this.deactivate();
      }
    }, { passive: true });

    // Keyboard Navigation (Universal Accessibility & Handheld Fallback)
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.id === 'searchInput' && !['Escape', 'Tab'].includes(e.key)) {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.lastControllerActionTime = performance.now();
        if (!this.isActive) this.activate();
        if (e.key === 'ArrowRight') this.navigateDirection('right');
        else if (e.key === 'ArrowLeft') this.navigateDirection('left');
        else if (e.key === 'ArrowUp') this.navigateDirection('up');
        else if (e.key === 'ArrowDown') this.navigateDirection('down');
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (this.focusedEl && !['BUTTON', 'INPUT'].includes(e.target.tagName)) {
          e.preventDefault();
          this.lastControllerActionTime = performance.now();
          this.handleButtonA();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.lastControllerActionTime = performance.now();
        this.handleButtonB();
      } else if (e.key === 'Tab') {
        this.lastControllerActionTime = performance.now();
        if (!this.isActive) this.activate();
        e.preventDefault();
        this.navigateDirection(e.shiftKey ? 'left' : 'right');
      } else if (e.key === 'q' || e.key === 'Q') {
        if (!['INPUT'].includes(e.target.tagName)) {
          e.preventDefault();
          this.lastControllerActionTime = performance.now();
          this.switchSection(-1);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (!['INPUT'].includes(e.target.tagName)) {
          e.preventDefault();
          this.lastControllerActionTime = performance.now();
          this.switchSection(1);
        }
      }
    });

    // Gamepad connection events
    window.addEventListener('gamepadconnected', (e) => {
      logConsole(`[Controller] Connected: ${e.gamepad.id}`, 'info');
      this.updateGamepadPill(e.gamepad, true);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      logConsole(`[Controller] Disconnected: ${e.gamepad.id}`, 'warn');
      this.updateGamepadPill(null, false);
      if (this.isActive) this.deactivate();
    });

    // Dual-loop polling: requestAnimationFrame + 16ms interval safety backup
    requestAnimationFrame(this.poll.bind(this));
    setInterval(() => {
      this.poll(performance.now());
    }, 16);
  },

  updateGamepadPill(pad, isConnected) {
    if (!gamepadStatusPill || !gamepadStatusText) return;
    if (isConnected && pad) {
      const name = pad.id.includes('Xbox') ? 'Xbox Controller' : (pad.id.includes('360') ? 'Xbox 360' : 'Controller Ready');
      gamepadStatusText.textContent = name;
      gamepadStatusPill.classList.add('active');
    } else {
      gamepadStatusText.textContent = 'Desktop Mode';
      gamepadStatusPill.classList.remove('active');
    }
  },

  activate(activePad = null) {
    this.isActive = true;
    document.body.classList.add('controller-mode');
    document.body.classList.remove('desktop-mode');

    if (gamepadStatusPill) gamepadStatusPill.classList.add('active');
    if (gamepadStatusText) {
      const name = (activePad && activePad.id && activePad.id.includes('Xbox'))
        ? 'Xbox Controller Active'
        : 'Controller Active';
      gamepadStatusText.textContent = name;
    }

    if (!this.focusedEl || !document.body.contains(this.focusedEl)) {
      this.focusFirstAvailable();
    } else {
      this.applyFocus(this.focusedEl);
    }
  },

  deactivate() {
    this.isActive = false;
    document.body.classList.remove('controller-mode');
    document.body.classList.add('desktop-mode');

    if (this.focusedEl) {
      this.focusedEl.classList.remove('gamepad-focused');
    }
    // Clear any residual focus rings across document
    document.querySelectorAll('.gamepad-focused').forEach(el => el.classList.remove('gamepad-focused'));

    if (gamepadStatusPill) gamepadStatusPill.classList.remove('active');
    if (gamepadStatusText) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const hasAny = Array.from(gamepads).some(p => p && p.connected);
      gamepadStatusText.textContent = hasAny ? 'Controller Ready' : 'Desktop Mode';
    }
  },

  decodeHatSwitch(axisVal) {
    if (axisVal === undefined || axisVal === null || Math.abs(axisVal) > 1.05) {
      return { up: false, down: false, left: false, right: false };
    }
    const v = Math.round(axisVal * 100) / 100;
    return {
      up: (v >= -1.02 && v <= -0.9) || (v >= 0.95 && v <= 1.02) || (v >= -0.75 && v <= -0.65),
      right: (v >= -0.75 && v <= -0.1),
      down: (v >= -0.2 && v <= 0.45),
      left: (v >= 0.4 && v <= 1.02)
    };
  },

  poll(timestamp) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let detectedInputOnAnyPad = false;

    for (let i = 0; i < gamepads.length; i++) {
      const pad = gamepads[i];
      if (!pad || !pad.connected) continue;

      const hadInput = this.processGamepadInput(pad, timestamp);
      if (hadInput) {
        detectedInputOnAnyPad = true;
      }
    }

    if (detectedInputOnAnyPad) {
      this.lastControllerActionTime = performance.now();
    }
  },

  processGamepadInput(pad, timestamp) {
    if (!pad) return false;

    let hadInput = false;

    // Edge-triggered button check helper
    const isButtonPressed = (btnIndex) => {
      const btn = pad.buttons && pad.buttons[btnIndex];
      const isDown = !!(btn && (btn.pressed || btn.value > 0.3));
      const key = `${pad.index}_${btnIndex}`;
      const wasDown = !!this.prevButtons.get(key);
      this.prevButtons.set(key, isDown);
      if (isDown) hadInput = true;
      return isDown && !wasDown;
    };

    // Continuous button down helper (e.g. for triggers)
    const isButtonDown = (btnIndex) => {
      const btn = pad.buttons && pad.buttons[btnIndex];
      return !!(btn && (btn.pressed || btn.value > 0.35));
    };

    // Decode D-pad buttons (Standard & DirectInput)
    const dpadUpBtn = isButtonPressed(12);
    const dpadDownBtn = isButtonPressed(13);
    const dpadLeftBtn = isButtonPressed(14);
    const dpadRightBtn = isButtonPressed(15);

    // Decode POV Hat Switch (DirectInput generic controllers)
    const hat1 = (pad.axes && pad.axes.length > 9) ? this.decodeHatSwitch(pad.axes[9]) : null;
    const hat2 = (pad.axes && pad.axes.length > 4 && !hat1) ? this.decodeHatSwitch(pad.axes[4]) : null;
    const hat = hat1 || hat2 || { up: false, down: false, left: false, right: false };

    // Decode Left Analog Stick
    const axisX = (pad.axes && pad.axes.length > 0) ? (pad.axes[0] || 0) : 0;
    const axisY = (pad.axes && pad.axes.length > 1) ? (pad.axes[1] || 0) : 0;

    const stickThreshold = 0.42;
    const stickMovedX = Math.abs(axisX) > 0.22;
    const stickMovedY = Math.abs(axisY) > 0.22;
    if (stickMovedX || stickMovedY || hat.up || hat.down || hat.left || hat.right) {
      hadInput = true;
    }

    // Wake up on input
    if (hadInput && !this.isActive) {
      this.activate(pad);
    }

    if (!this.isActive) return hadInput;

    // Directional Navigation
    const now = timestamp || performance.now();
    let dir = null;
    if (dpadLeftBtn || hat.left || axisX < -stickThreshold) dir = 'left';
    else if (dpadRightBtn || hat.right || axisX > stickThreshold) dir = 'right';
    else if (dpadUpBtn || hat.up || axisY < -stickThreshold) dir = 'up';
    else if (dpadDownBtn || hat.down || axisY > stickThreshold) dir = 'down';

    if (dir) {
      if (this.lastStickDir !== dir) {
        this.lastStickDir = dir;
        this.stickHoldStart = now;
        this.lastActionTime = now;
        this.navigateDirection(dir);
      } else {
        const holdDuration = now - this.stickHoldStart;
        if (holdDuration > this.initialDelay && (now - this.lastActionTime) > this.repeatDelay) {
          this.lastActionTime = now;
          this.navigateDirection(dir);
        }
      }
    } else {
      this.lastStickDir = null;
    }

    // Action Buttons
    if (isButtonPressed(0)) { // A button: Select / Toggle
      this.handleButtonA();
    }
    if (isButtonPressed(1)) { // B button: Back / Close modal
      this.handleButtonB();
    }
    if (isButtonPressed(2)) { // X button: Toggle Select All
      this.handleButtonX();
    }
    if (isButtonPressed(3)) { // Y button: Scan Now
      this.handleButtonY();
    }
    if (isButtonPressed(4)) { // LB: Previous Section
      this.switchSection(-1);
    }
    if (isButtonPressed(5)) { // RB: Next Section
      this.switchSection(1);
    }
    if (isButtonPressed(6) || (pad.axes && pad.axes[2] > 0.4 && isButtonPressed(20))) { // LT: Previous Category Tab
      this.switchTab(-1);
    }
    if (isButtonPressed(7) || (pad.axes && pad.axes[5] > 0.4 && isButtonPressed(21))) { // RT: Next Category Tab
      this.switchTab(1);
    }
    if (isButtonPressed(9)) { // Start / Menu: Toggle FSE
      const btnToggleFse = document.getElementById('btnToggleFse');
      if (btnToggleFse) btnToggleFse.click();
    }
    if (isButtonPressed(8)) { // Select / View: Backups
      openBackupsModal();
    }

    return hadInput;
  },

  getFocusableElements() {
    // Check if modal is active
    if (settingsModal && settingsModal.style.display === 'flex') {
      return [btnCloseSettings, btnCloseSettingsFooter, btnSettingsAddFolder, btnResetHidden].filter(el => el && el.offsetParent !== null);
    }
    if (uninjectModal && uninjectModal.style.display === 'flex') {
      return [btnCancelUninject, btnProceedUninject].filter(el => el && el.offsetParent !== null);
    }
    if (confirmModal && confirmModal.style.display === 'flex') {
      return [btnCancelSync, btnProceedSync].filter(el => el && el.offsetParent !== null);
    }
    if (backupsModal && backupsModal.style.display === 'flex') {
      const restores = Array.from(backupsModal.querySelectorAll('.btn-restore'));
      return [btnCloseBackups, btnCloseBackupsFooter, ...restores].filter(el => el && el.offsetParent !== null);
    }

    const elements = [];

    // Main Section Nav Buttons
    const secBtns = Array.from(document.querySelectorAll('.section-nav-btn'));
    elements.push(...secBtns);

    // Header buttons
    const fse = document.getElementById('btnToggleFse');
    if (btnKillXbox && btnKillXbox.style.display !== 'none') elements.push(btnKillXbox);
    if (btnBackups) elements.push(btnBackups);
    if (fse) elements.push(fse);
    if (btnScan) elements.push(btnScan);

    // Tabs
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    elements.push(...tabs);

    // Action Command Bar
    if (appState.currentTab === 'missing') {
      elements.push(selectAllCheckbox);
    }
    if (btnAddFolder) elements.push(btnAddFolder);
    const emptyBtnFolder = document.getElementById('emptyBtnFolder');
    if (emptyBtnFolder) elements.push(emptyBtnFolder);
    if (btnSync && !btnSync.disabled) elements.push(btnSync);

    // Game Cards & Action Buttons
    const cards = Array.from(document.querySelectorAll('.game-card'));
    elements.push(...cards);

    const actionBtns = Array.from(document.querySelectorAll('.card-action-btn'));
    elements.push(...actionBtns);

    return elements.filter(el => el && el.offsetParent !== null);
  },

  focusFirstAvailable() {
    const list = this.getFocusableElements();
    if (list.length > 0) {
      const activeTab = document.querySelector('.tab-btn.active');
      const firstCard = document.querySelector('.game-card');
      const target = firstCard || activeTab || list[0];
      this.applyFocus(target);
    }
  },

  applyFocus(el) {
    if (!el) return;
    if (this.focusedEl && this.focusedEl !== el) {
      this.focusedEl.classList.remove('gamepad-focused');
    }
    this.focusedEl = el;
    el.classList.add('gamepad-focused');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  },

  navigateDirection(dir) {
    const items = this.getFocusableElements();
    if (items.length === 0) return;

    if (!this.focusedEl || !items.includes(this.focusedEl)) {
      this.focusFirstAvailable();
      return;
    }

    const currentIdx = items.indexOf(this.focusedEl);

    if (dir === 'right') {
      const nextIdx = (currentIdx + 1) % items.length;
      this.applyFocus(items[nextIdx]);
    } else if (dir === 'left') {
      const prevIdx = (currentIdx - 1 + items.length) % items.length;
      this.applyFocus(items[prevIdx]);
    } else if (dir === 'down') {
      const cards = Array.from(document.querySelectorAll('.game-card'));
      if (cards.includes(this.focusedEl)) {
        const container = document.getElementById('gamesContainer');
        const colWidth = (cards[0] && cards[0].offsetWidth) ? cards[0].offsetWidth + 20 : 350;
        const cols = Math.max(1, Math.floor((container ? container.offsetWidth : 900) / colWidth));
        const cardIdx = cards.indexOf(this.focusedEl);
        const targetCardIdx = cardIdx + cols;
        if (targetCardIdx < cards.length) {
          this.applyFocus(cards[targetCardIdx]);
          return;
        }
      }
      const nextIdx = Math.min(items.length - 1, currentIdx + 1);
      this.applyFocus(items[nextIdx]);
    } else if (dir === 'up') {
      const cards = Array.from(document.querySelectorAll('.game-card'));
      if (cards.includes(this.focusedEl)) {
        const container = document.getElementById('gamesContainer');
        const colWidth = (cards[0] && cards[0].offsetWidth) ? cards[0].offsetWidth + 20 : 350;
        const cols = Math.max(1, Math.floor((container ? container.offsetWidth : 900) / colWidth));
        const cardIdx = cards.indexOf(this.focusedEl);
        const targetCardIdx = cardIdx - cols;
        if (targetCardIdx >= 0) {
          this.applyFocus(cards[targetCardIdx]);
          return;
        } else {
          const syncBtn = document.getElementById('btnSync');
          const activeTab = document.querySelector('.tab-btn.active');
          this.applyFocus(syncBtn || activeTab || items[0]);
          return;
        }
      }
      const prevIdx = Math.max(0, currentIdx - 1);
      this.applyFocus(items[prevIdx]);
    }
  },

  handleButtonA() {
    if (!this.focusedEl) return;
    this.focusedEl.click();
  },

  handleButtonB() {
    if (settingsModal && settingsModal.style.display === 'flex') {
      btnCloseSettings.click();
      return;
    }
    if (uninjectModal && uninjectModal.style.display === 'flex') {
      btnCancelUninject.click();
      return;
    }
    if (confirmModal && confirmModal.style.display === 'flex') {
      btnCancelSync.click();
      return;
    }
    if (backupsModal && backupsModal.style.display === 'flex') {
      btnCloseBackups.click();
      return;
    }
    if (consoleDrawer && !consoleDrawer.classList.contains('collapsed')) {
      consoleDrawer.classList.add('collapsed');
      return;
    }
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) this.applyFocus(activeTab);
  },

  handleButtonX() {
    if (appState.currentTab === 'missing') {
      selectAllCheckbox.click();
    }
  },

  handleButtonY() {
    btnScan.click();
  },

  switchSection(direction) {
    const sections = ['library', 'sync', 'backups', 'settings'];
    const currentIdx = sections.indexOf(appState.currentSection || 'library');
    const nextIdx = (currentIdx + direction + sections.length) % sections.length;
    const nextSec = sections[nextIdx];
    const targetBtn = document.querySelector(`.section-nav-btn[data-section="${nextSec}"]`);
    if (targetBtn) {
      targetBtn.click();
      this.applyFocus(targetBtn);
    }
  },

  switchTab(direction) {
    const tabs = ['missing', 'synced', 'all', 'hidden', 'xbox'];
    const currentIdx = tabs.indexOf(appState.currentTab);
    const nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
    const nextTab = tabs[nextIdx];
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${nextTab}"]`);
    if (targetBtn) {
      targetBtn.click();
      this.applyFocus(targetBtn);
    }
  }
};

// Logging Console
function logConsole(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;

  const time = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${escapeHtml(message)}</span>`;
  consoleLogs.appendChild(line);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;

  if (drawerPreviewText) {
    drawerPreviewText.textContent = message;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Confirmation Modal & Sync Execution
function openConfirmModal(games) {
  modalGameCount.textContent = games.length;
  modalProcessWarning.style.display = appState.processInfo.isRunning ? 'block' : 'none';
  confirmModal.style.display = 'flex';
  if (typeof controllerNav !== 'undefined' && controllerNav.isActive) {
    controllerNav.applyFocus(btnProceedSync);
  }
}

async function executeSync() {
  const toSync = getSelectedMissingGames();
  if (toSync.length === 0) return;

  appState.isSyncing = true;
  btnSync.disabled = true;
  syncBtnLabel.textContent = 'Syncing...';
  logConsole(`[Sync] Initiating injection for ${toSync.length} Steam games...`, 'info');

  try {
    // If Xbox processes are active, close them gracefully first
    if (appState.processInfo.isRunning) {
      logConsole('[Sync] Closing active Xbox App processes before sync...', 'info');
      await window.api.closeProcesses();
    }

    const res = await window.api.syncGames(toSync);
    if (!res.success) {
      throw new Error(res.error || 'Sync failed.');
    }

    logConsole(`[Sync] Completed successfully! ${res.injectedCount} titles injected into Xbox App.`, 'success');
    await triggerScan();
  } catch (err) {
    logConsole(`[Sync Error] ${err.message}`, 'error');
  } finally {
    appState.isSyncing = false;
    btnSync.disabled = false;
    syncBtnLabel.textContent = 'Sync to Xbox App';
  }
}

// Backups Modal
async function openBackupsModal() {
  backupsList.innerHTML = '<div class="empty-backups">Loading backups...</div>';
  backupsModal.style.display = 'flex';

  try {
    const res = await window.api.getBackups();
    if (!res.success || res.backups.length === 0) {
      backupsList.innerHTML = '<div class="empty-backups">No previous snapshots found.</div>';
      return;
    }

    backupsList.innerHTML = '';
    res.backups.forEach(b => {
      const item = document.createElement('div');
      item.className = 'backup-item';
      const date = new Date(b.createdAt).toLocaleString();
      const sizeKb = (b.size / 1024).toFixed(1);

      item.innerHTML = `
        <div class="backup-info">
          <div class="backup-name">${escapeHtml(b.filename)}</div>
          <div class="backup-meta">Created: ${date} • ${sizeKb} KB</div>
        </div>
        <button class="console-btn btn-ghost btn-restore" data-path="${escapeHtml(b.fullPath)}">
          Restore Snapshot
        </button>
      `;

      const restoreBtn = item.querySelector('.btn-restore');
      restoreBtn.addEventListener('click', async () => {
        await restoreSnapshot(b.fullPath, b.filename);
      });

      backupsList.appendChild(item);
    });

    if (typeof controllerNav !== 'undefined' && controllerNav.isActive) {
      controllerNav.applyFocus(btnCloseBackups);
    }
  } catch (err) {
    backupsList.innerHTML = `<div class="empty-backups">Error loading backups: ${err.message}</div>`;
  }
}

async function restoreSnapshot(path, name) {
  logConsole(`[Restore] Restoring Xbox App snapshot: ${name}...`, 'info');
  try {
    const res = await window.api.restoreBackup(path);
    if (res.success) {
      logConsole(`[Restore] Successfully restored snapshot: ${name}`, 'success');
      backupsModal.style.display = 'none';
      await triggerScan();
    } else {
      logConsole(`[Restore Error] Failed to restore: ${res.error}`, 'error');
    }
  } catch (e) {
    logConsole(`[Restore Error] ${e.message}`, 'error');
  }
}

// Custom Folder Selection
async function promptAddFolder() {
  try {
    const selectedPath = await window.api.selectFolder();
    if (selectedPath) {
      if (!appState.customPaths.includes(selectedPath)) {
        appState.customPaths.push(selectedPath);
        logConsole(`[Library] Added custom path: ${selectedPath}`, 'info');
        await triggerScan();
      } else {
        logConsole(`[Library] Folder already added: ${selectedPath}`, 'warn');
      }
    }
  } catch (e) {
    logConsole(`[Error] Failed to select folder: ${e.message}`, 'error');
  }
}

// Settings & Libraries Modal
function openSettingsModal() {
  updateSettingsModalUI();
  settingsModal.style.display = 'flex';
  if (typeof controllerNav !== 'undefined' && controllerNav.isActive) {
    controllerNav.applyFocus(btnCloseSettings);
  }
}

function updateSettingsModalUI() {
  if (settingsHiddenCount) {
    settingsHiddenCount.textContent = appState.hiddenAppIds.size;
  }
  if (settingsXboxPath) {
    settingsXboxPath.textContent = (appState.xboxData && appState.xboxData.localStatePath)
      ? appState.xboxData.localStatePath
      : 'Packages\\Microsoft.GamingApp_8wekyb3d8bbwe\\LocalState';
  }
  if (settingsLibrariesList) {
    settingsLibrariesList.innerHTML = '';
    const allLibs = [...appState.libraries, ...appState.customPaths];
    const uniqueLibs = Array.from(new Set(allLibs));
    if (uniqueLibs.length === 0) {
      settingsLibrariesList.innerHTML = '<div class="empty-backups">No library folders discovered yet. Click Scan to detect.</div>';
      return;
    }
    uniqueLibs.forEach(p => {
      const item = document.createElement('div');
      item.className = 'library-item';
      const isCustom = appState.customPaths.includes(p);
      item.innerHTML = `
        <div class="library-path">${escapeHtml(p)} ${isCustom ? '<span class="console-badge">Custom</span>' : ''}</div>
        ${isCustom ? `
          <button class="console-btn btn-ghost btn-sm btn-remove-folder" data-path="${escapeHtml(p)}">Remove</button>
        ` : ''}
      `;
      const removeBtn = item.querySelector('.btn-remove-folder');
      if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
          appState.customPaths = appState.customPaths.filter(cp => cp !== p);
          updateSettingsModalUI();
          await triggerScan();
        });
      }
      settingsLibrariesList.appendChild(item);
    });
  }
}

