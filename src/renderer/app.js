// ============================================================================
// XboxSteamBridge - Console Horizon Renderer Engine
// ============================================================================

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

// Global Application State
const appState = {
  version: '1.6.0',
  currentSection: 'library',
  currentSectionIndex: 0,
  currentTab: 'missing',
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
  customPaths: [],
  backups: []
};

const SECTIONS = ['library', 'sync', 'backups', 'settings'];
const TABS = ['missing', 'synced', 'all', 'hidden', 'xbox'];

// DOM Elements
const brandGroup = document.getElementById('brandGroup');
const sectionNavLinks = document.getElementById('sectionNavLinks');
const navBtns = {
  library: document.getElementById('navBtnLibrary'),
  sync: document.getElementById('navBtnSync'),
  backups: document.getElementById('navBtnBackups'),
  settings: document.getElementById('navBtnSettings')
};

const pages = {
  library: document.getElementById('pageLibrary'),
  sync: document.getElementById('pageSync'),
  backups: document.getElementById('pageBackups'),
  settings: document.getElementById('pageSettings')
};

const badgeLB = document.getElementById('badgeLB');
const badgeRB = document.getElementById('badgeRB');
const badgeLT = document.getElementById('badgeLT');
const badgeRT = document.getElementById('badgeRT');

const btnXboxAlert = document.getElementById('btnXboxAlert');
const btnScan = document.getElementById('btnScan');
const scanIcon = document.getElementById('scanIcon');
const btnToggleFse = document.getElementById('btnToggleFse');
const fseIcon = document.getElementById('fseIcon');

// Category Badges
const badgeMissing = document.getElementById('badgeMissing');
const badgeSynced = document.getElementById('badgeSynced');
const badgeAll = document.getElementById('badgeAll');
const badgeHidden = document.getElementById('badgeHidden');
const badgeXbox = document.getElementById('badgeXbox');

// Search & Actions
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const btnAddFolder = document.getElementById('btnAddFolder');
const sectionSubtitle = document.getElementById('sectionSubtitle');
const sectionCount = document.getElementById('sectionCount');
const gamesContainer = document.getElementById('gamesContainer');
const syncGamesContainer = document.getElementById('syncGamesContainer');

// Sync Hub Elements
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const selectLabel = document.getElementById('selectLabel');
const selectionSummary = document.getElementById('selectionSummary');
const btnSync = document.getElementById('btnSync');
const syncBtnLabel = document.getElementById('syncBtnLabel');

// Backups Full Page
const backupsList = document.getElementById('backupsList');
const btnCreateBackup = document.getElementById('btnCreateBackup');

// Settings Full Page
const settingsLibrariesList = document.getElementById('settingsLibrariesList');
const btnSettingsAddFolder = document.getElementById('btnSettingsAddFolder');
const btnResetHidden = document.getElementById('btnResetHidden');
const settingsHiddenCount = document.getElementById('settingsHiddenCount');
const settingsXboxPath = document.getElementById('settingsXboxPath');

// Footer
const footerSteamStatus = document.getElementById('footerSteamStatus');
const footerXboxStatus = document.getElementById('footerXboxStatus');

// Modals
const confirmModal = document.getElementById('confirmModal');
const modalGameCount = document.getElementById('modalGameCount');
const modalProcessWarning = document.getElementById('modalProcessWarning');
const btnCancelSync = document.getElementById('btnCancelSync');
const btnProceedSync = document.getElementById('btnProceedSync');
const btnCloseConfirm = document.getElementById('btnCloseConfirm');

const uninjectModal = document.getElementById('uninjectModal');
const uninjectTitleName = document.getElementById('uninjectTitleName');
const btnCloseUninject = document.getElementById('btnCloseUninject');
const btnCancelUninject = document.getElementById('btnCancelUninject');
const btnProceedUninject = document.getElementById('btnProceedUninject');
let pendingUninjectAppId = null;
let pendingUninjectTitle = '';

const xboxRunningModal = document.getElementById('xboxRunningModal');
const btnCloseXboxRunning = document.getElementById('btnCloseXboxRunning');
const btnDismissXboxRunning = document.getElementById('btnDismissXboxRunning');
const btnKillXboxModal = document.getElementById('btnKillXboxModal');
const xboxProcessesSummary = document.getElementById('xboxProcessesSummary');

// ============================================================================
// Initialization
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  controllerNav.init();
  await loadVersion();
  await checkProcesses();
  await triggerScan();
});

// Setup Events
function setupEventListeners() {
  // Topbar Center Navigation Buttons
  Object.keys(navBtns).forEach(secKey => {
    const btn = navBtns[secKey];
    if (btn) {
      btn.addEventListener('click', () => switchSection(secKey));
    }
  });

  // LB / RB Bumpers
  if (badgeLB) badgeLB.addEventListener('click', () => switchSectionByOffset(-1));
  if (badgeRB) badgeRB.addEventListener('click', () => switchSectionByOffset(1));

  // Category Tab Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const tab = e.currentTarget.getAttribute('data-tab');
      e.currentTarget.classList.add('active');
      appState.currentTab = tab;
      renderLibraryPage();
    });
  });

  // LT / RT Triggers
  if (badgeLT) badgeLT.addEventListener('click', () => switchTabByOffset(-1));
  if (badgeRT) badgeRT.addEventListener('click', () => switchTabByOffset(1));

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value.toLowerCase().trim();
      if (searchClearBtn) {
        searchClearBtn.style.display = appState.searchQuery ? 'block' : 'none';
      }
      renderLibraryPage();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      appState.searchQuery = '';
      searchClearBtn.style.display = 'none';
      searchInput.focus();
      renderLibraryPage();
    });
  }

  // Select All Checkbox in Sync Center
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const missing = getFilteredMissingGames();
      if (isChecked) {
        missing.forEach(g => appState.selectedAppIds.add(String(g.appid)));
      } else {
        missing.forEach(g => appState.selectedAppIds.delete(String(g.appid)));
      }
      updateSyncHubSelectionUI();
      renderSyncCenterPage();
    });
  }

  // Scan Button
  if (btnScan) {
    btnScan.addEventListener('click', () => {
      if (!appState.isScanning) triggerScan();
    });
  }

  // Primary Sync Button
  if (btnSync) {
    btnSync.addEventListener('click', () => {
      const toSync = getSelectedMissingGames();
      if (toSync.length === 0) return;
      openConfirmModal(toSync);
    });
  }

  // Add Folder Buttons
  if (btnAddFolder) {
    btnAddFolder.addEventListener('click', promptAddFolder);
  }
  if (btnSettingsAddFolder) {
    btnSettingsAddFolder.addEventListener('click', promptAddFolder);
  }

  // Reset Hidden Titles
  if (btnResetHidden) {
    btnResetHidden.addEventListener('click', () => {
      appState.hiddenAppIds.clear();
      saveHiddenAppIds(appState.hiddenAppIds);
      updateSettingsUI();
      renderAllPages();
    });
  }

  // Create Manual Backup
  if (btnCreateBackup) {
    btnCreateBackup.addEventListener('click', async () => {
      try {
        const res = await window.api.createBackup();
        if (res.success) {
          await loadBackups();
        }
      } catch (e) {
        console.error('Backup creation error:', e);
      }
    });
  }

  // Xbox Process Alert Button
  if (btnXboxAlert) {
    btnXboxAlert.addEventListener('click', () => {
      if (xboxRunningModal) {
        if (xboxProcessesSummary && appState.processInfo.processes.length > 0) {
          xboxProcessesSummary.textContent = `Active: ${appState.processInfo.processes.map(p => p.name).join(', ')}`;
        }
        xboxRunningModal.style.display = 'flex';
      }
    });
  }

  if (btnCloseXboxRunning) {
    btnCloseXboxRunning.addEventListener('click', () => xboxRunningModal.style.display = 'none');
  }
  if (btnDismissXboxRunning) {
    btnDismissXboxRunning.addEventListener('click', () => xboxRunningModal.style.display = 'none');
  }
  if (btnKillXboxModal) {
    btnKillXboxModal.addEventListener('click', async () => {
      await closeXboxApp();
      xboxRunningModal.style.display = 'none';
    });
  }

  // Injection Confirm Modal
  if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', () => confirmModal.style.display = 'none');
  if (btnCancelSync) btnCancelSync.addEventListener('click', () => confirmModal.style.display = 'none');
  if (btnProceedSync) {
    btnProceedSync.addEventListener('click', async () => {
      confirmModal.style.display = 'none';
      await executeSync();
    });
  }

  // Uninject Confirm Modal
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

  // Full Screen Experience (FSE)
  if (btnToggleFse) {
    btnToggleFse.addEventListener('click', toggleFse);
  }

  if (window.api && typeof window.api.onFullscreenChange === 'function') {
    window.api.onFullscreenChange(isFull => updateFseState(isFull));
  }

  if (window.api && typeof window.api.getFullscreenState === 'function') {
    window.api.getFullscreenState().then(updateFseState);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFse();
    }
  });

  // IPC Sync Progress
  if (window.api && typeof window.api.onSyncProgress === 'function') {
    window.api.onSyncProgress(data => {
      if (data.stage === 'item') {
        if (syncBtnLabel) syncBtnLabel.textContent = `Injecting (${data.index}/${data.total})...`;
      } else if (data.stage === 'done') {
        if (syncBtnLabel) syncBtnLabel.textContent = 'Sync Selected to Xbox';
      }
    });
  }
}

// ============================================================================
// Section Switching & Directional Slide Transitions (Problem #4 Solved)
// ============================================================================
function switchSection(secKey) {
  if (!SECTIONS.includes(secKey)) return;
  const oldIndex = appState.currentSectionIndex;
  const newIndex = SECTIONS.indexOf(secKey);
  if (oldIndex === newIndex && pages[secKey].classList.contains('active')) return;

  const isForward = newIndex > oldIndex;

  // Update nav buttons
  Object.keys(navBtns).forEach(k => {
    if (navBtns[k]) navBtns[k].classList.toggle('active', k === secKey);
  });

  // Slide pages directionally
  SECTIONS.forEach((k, idx) => {
    const pageEl = pages[k];
    if (!pageEl) return;

    if (idx === newIndex) {
      // Incoming page
      pageEl.classList.remove('slide-left', 'slide-right');
      pageEl.classList.add(isForward ? 'slide-right' : 'slide-left');
      // Force reflow
      void pageEl.offsetWidth;
      pageEl.classList.remove('slide-left', 'slide-right');
      pageEl.classList.add('active');
    } else if (idx === oldIndex) {
      // Outgoing page
      pageEl.classList.remove('active');
      pageEl.classList.add(isForward ? 'slide-left' : 'slide-right');
    } else {
      pageEl.classList.remove('active', 'slide-left', 'slide-right');
      pageEl.classList.add(idx < newIndex ? 'slide-left' : 'slide-right');
    }
  });

  appState.currentSection = secKey;
  appState.currentSectionIndex = newIndex;
  document.body.setAttribute('data-page', secKey);

  // Render contents for section
  if (secKey === 'library') {
    renderLibraryPage();
  } else if (secKey === 'sync') {
    renderSyncCenterPage();
  } else if (secKey === 'backups') {
    loadBackups();
  } else if (secKey === 'settings') {
    updateSettingsUI();
  }

  // Update controller focus
  setTimeout(() => {
    controllerNav.focusFirstAvailable();
  }, 100);
}

function switchSectionByOffset(offset) {
  const nextIdx = (appState.currentSectionIndex + offset + SECTIONS.length) % SECTIONS.length;
  switchSection(SECTIONS[nextIdx]);
}

function switchTabByOffset(offset) {
  const currentIdx = TABS.indexOf(appState.currentTab);
  const nextIdx = (currentIdx + offset + TABS.length) % TABS.length;
  const nextTab = TABS[nextIdx];
  const targetBtn = document.querySelector(`.tab-btn[data-tab="${nextTab}"]`);
  if (targetBtn) targetBtn.click();
}

// ============================================================================
// FSE (Full Screen Experience)
// ============================================================================
function updateFseState(isFull) {
  document.body.classList.toggle('fse-active', !!isFull);
  if (fseIcon) {
    fseIcon.innerHTML = isFull
      ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'
      : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
  }
  if (btnToggleFse) {
    btnToggleFse.classList.toggle('active', !!isFull);
  }
}

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
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => updateFseState(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => updateFseState(false)).catch(() => {});
    }
  }
}

// ============================================================================
// Process Safety
// ============================================================================
async function checkProcesses() {
  try {
    const p = await window.api.checkProcesses();
    appState.processInfo = p;
    if (p.isRunning) {
      btnXboxAlert.style.display = 'inline-flex';
    } else {
      btnXboxAlert.style.display = 'none';
    }
  } catch {
    btnXboxAlert.style.display = 'none';
  }
}

async function closeXboxApp() {
  try {
    await window.api.closeProcesses();
    await checkProcesses();
  } catch (e) {
    console.error('Error closing Xbox processes:', e);
  }
}

// ============================================================================
// Version & Scanning
// ============================================================================
async function loadVersion() {
  try {
    const v = await window.api.getAppVersion();
    appState.version = v;
  } catch {
    appState.version = '1.6.0';
  }
}

async function triggerScan() {
  if (appState.isScanning) return;
  appState.isScanning = true;
  if (scanIcon) scanIcon.classList.add('spinning');

  try {
    const res = await window.api.scanSteam(appState.customPaths);
    if (res.success) {
      appState.steamRoots = res.steamRoots || [];
      appState.libraries = res.libraries || [];
      appState.games = res.games || [];
      appState.xboxData = res.xboxData || null;

      // Select all missing titles by default
      const missing = appState.games.filter(g => !g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid)));
      missing.forEach(g => appState.selectedAppIds.add(String(g.appid)));

      if (footerSteamStatus) {
        footerSteamStatus.textContent = `${appState.games.length} Steam Titles`;
      }
      if (footerXboxStatus) {
        const xboxCount = (res.xboxData && res.xboxData.totalRegisteredXboxTitles) || 0;
        footerXboxStatus.textContent = `${xboxCount} In Xbox Database`;
      }

      renderAllPages();
    }
  } catch (err) {
    console.error('Scan failed:', err);
  } finally {
    appState.isScanning = false;
    if (scanIcon) scanIcon.classList.remove('spinning');
  }
}

async function promptAddFolder() {
  try {
    const folder = await window.api.selectFolder();
    if (folder && !appState.customPaths.includes(folder)) {
      appState.customPaths.push(folder);
      await triggerScan();
      updateSettingsUI();
    }
  } catch (e) {
    console.error('Add folder error:', e);
  }
}

// ============================================================================
// Render All Pages
// ============================================================================
function renderAllPages() {
  updateCategoryBadges();
  renderLibraryPage();
  renderSyncCenterPage();
  updateSettingsUI();
}

function updateCategoryBadges() {
  const missing = appState.games.filter(g => !g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid)));
  const synced = appState.games.filter(g => g.isDuplicate);
  const allSteam = appState.games;
  const hidden = appState.games.filter(g => appState.hiddenAppIds.has(String(g.appid)));
  const xboxCustom = (appState.xboxData && appState.xboxData.customGames) ? appState.xboxData.customGames : [];

  if (badgeMissing) badgeMissing.textContent = missing.length;
  if (badgeSynced) badgeSynced.textContent = synced.length;
  if (badgeAll) badgeAll.textContent = allSteam.length;
  if (badgeHidden) badgeHidden.textContent = hidden.length;
  if (badgeXbox) badgeXbox.textContent = xboxCustom.length;

  const subtitles = {
    missing: 'Missing from Xbox',
    synced: 'Already in Xbox Library',
    all: 'All Steam Games',
    hidden: 'Hidden Games',
    xbox: 'Xbox App Library'
  };
  if (sectionSubtitle) sectionSubtitle.textContent = subtitles[appState.currentTab] || 'Steam Bridge';

  const counts = {
    missing: missing.length,
    synced: synced.length,
    all: allSteam.length,
    hidden: hidden.length,
    xbox: xboxCustom.length
  };
  const c = counts[appState.currentTab] || 0;
  if (sectionCount) sectionCount.textContent = `(${c} game${c === 1 ? '' : 's'})`;
}

// ============================================================================
// Page 1: Render Library
// ============================================================================
function renderLibraryPage() {
  updateCategoryBadges();
  gamesContainer.innerHTML = '';

  let list = [];
  const q = appState.searchQuery;

  if (appState.currentTab === 'missing') {
    list = appState.games.filter(g => !g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid)));
  } else if (appState.currentTab === 'synced') {
    list = appState.games.filter(g => g.isDuplicate);
  } else if (appState.currentTab === 'all') {
    list = appState.games;
  } else if (appState.currentTab === 'hidden') {
    list = appState.games.filter(g => appState.hiddenAppIds.has(String(g.appid)));
  } else if (appState.currentTab === 'xbox') {
    const custom = (appState.xboxData && appState.xboxData.customGames) ? appState.xboxData.customGames : [];
    renderXboxList(q ? custom.filter(x => (x.title || '').toLowerCase().includes(q)) : custom);
    return;
  }

  if (q) {
    list = list.filter(g => g.name.toLowerCase().includes(q) || String(g.appid).includes(q));
  }

  if (list.length === 0) {
    renderEmptyState(gamesContainer);
    return;
  }

  list.forEach(game => {
    const card = createGameCard(game, appState.currentTab);
    gamesContainer.appendChild(card);
  });
}

// ============================================================================
// Page 2: Render Sync Center
// ============================================================================
function renderSyncCenterPage() {
  syncGamesContainer.innerHTML = '';
  const missing = getFilteredMissingGames();

  updateSyncHubSelectionUI();

  if (missing.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon-wrap">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="#00E575" stroke-width="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <h3 class="empty-title">All Steam Games Synchronized</h3>
      <p class="empty-desc">Your PC Xbox App is completely up to date with your local Steam library. Switch to the Library tab to view all synced titles.</p>
    `;
    syncGamesContainer.appendChild(empty);
    return;
  }

  missing.forEach(game => {
    const card = createGameCard(game, 'sync_hub');
    syncGamesContainer.appendChild(card);
  });
}

function updateSyncHubSelectionUI() {
  const missing = getFilteredMissingGames();
  const selected = getSelectedMissingGames();

  if (selectAllCheckbox) {
    selectAllCheckbox.checked = missing.length > 0 && missing.every(g => appState.selectedAppIds.has(String(g.appid)));
  }
  if (selectLabel) selectLabel.textContent = `Select All (${missing.length})`;
  if (selectionSummary) selectionSummary.textContent = `${selected.length} title${selected.length === 1 ? '' : 's'} selected`;

  if (btnSync) {
    btnSync.disabled = selected.length === 0;
  }
  if (syncBtnLabel) {
    syncBtnLabel.textContent = selected.length === 0
      ? 'Select Games to Sync'
      : `Sync ${selected.length} Title${selected.length === 1 ? '' : 's'} to Xbox`;
  }
}

// ============================================================================
// Card Generator: Rigid 340px Minimum Size (Problem #1 & #10 Solved)
// ============================================================================
function createGameCard(game, contextTab) {
  const card = document.createElement('div');
  const isSelected = appState.selectedAppIds.has(String(game.appid));
  const isHidden = appState.hiddenAppIds.has(String(game.appid));
  const isSyncMode = contextTab === 'sync_hub' || contextTab === 'missing';

  card.className = `game-card ${isSelected && !game.isDuplicate ? 'selected' : ''}`;
  card.setAttribute('tabindex', '0');
  card.setAttribute('data-appid', game.appid);

  let statusClass = 'pill-missing';
  let statusText = 'Missing from Xbox';
  if (game.isDuplicate) {
    statusClass = 'pill-synced';
    statusText = 'In Xbox Library';
  } else if (isHidden) {
    statusClass = 'pill-hidden';
    statusText = 'Hidden';
  }

  const exeName = game.primaryExecutable ? game.primaryExecutable.split(/[\\/]/).pop() : 'steam://';
  const headerUrl = game.headerUrl || `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;

  card.innerHTML = `
    <div class="card-header-art">
      ${isSyncMode ? `
        <input type="checkbox" class="card-checkbox" data-appid="${game.appid}" ${isSelected ? 'checked' : ''} />
      ` : ''}
      <span class="card-status-pill ${statusClass}">${statusText}</span>
      <div class="card-platform-badge" title="Steam Platform">
        <svg viewBox="0 0 24 24" fill="none" stroke="#66c0f4" stroke-width="2">
          <circle cx="12" cy="12" r="9"/>
          <circle cx="15.5" cy="8.5" r="2.5" fill="#66c0f4"/>
          <path d="M7 15l4.5-2.5"/>
          <circle cx="7" cy="15" r="2" fill="#66c0f4"/>
        </svg>
      </div>
      <img src="${headerUrl}" alt="${game.name}" onerror="this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg'; this.onerror=null;" />
    </div>
    <div class="card-body">
      <h3 class="game-title" title="${game.name}">${game.name}</h3>
      <div class="game-meta">
        <span>AppID: ${game.appid}</span>
        <span>•</span>
        <span>${exeName}</span>
      </div>
      ${game.isDuplicate && game.matchReason ? `<div class="match-reason-box">${game.matchReason}</div>` : ''}
      <div class="card-footer-row">
        <div class="game-path" title="${game.installLocation || ''}">${game.installLocation || 'Steam Library'}</div>
        <div class="card-actions-group">
          ${game.isDuplicate ? `
            <button class="card-action-btn btn-uninject" data-appid="${game.appid}" title="Remove title from Xbox App">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>Uninject</span>
            </button>
          ` : (isHidden ? `
            <button class="card-action-btn btn-unhide" data-appid="${game.appid}" title="Restore to sync suggestions">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Unhide</span>
            </button>
          ` : `
            <button class="card-action-btn btn-hide" data-appid="${game.appid}" title="Hide from suggestions">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              <span>Hide</span>
            </button>
          `)}
        </div>
      </div>
    </div>
  `;

  // Button Listeners
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

  // Card click interaction
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-action-btn') || e.target.classList.contains('card-checkbox')) return;

    if (isSyncMode) {
      const checkbox = card.querySelector('.card-checkbox');
      const strId = String(game.appid);
      if (appState.selectedAppIds.has(strId)) {
        appState.selectedAppIds.delete(strId);
        if (checkbox) checkbox.checked = false;
        card.classList.remove('selected');
      } else {
        appState.selectedAppIds.add(strId);
        if (checkbox) checkbox.checked = true;
        card.classList.add('selected');
      }
      updateSyncHubSelectionUI();
    } else if (game.isDuplicate) {
      promptUninjectGame(game.appid, game.name);
    }
  });

  return card;
}

function renderXboxList(xboxGames) {
  gamesContainer.innerHTML = '';
  if (xboxGames.length === 0) {
    renderEmptyState(gamesContainer);
    return;
  }

  xboxGames.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.setAttribute('tabindex', '0');
    const isCustom = entry.isCustom;
    const title = entry.title || 'Unknown Title';
    const imagePath = entry.imagePath || entry.bannerUrl || 'https://assets.xboxservices.com/assets/79/32/7932e6a9-8588-4db9-8b89-299f01bc49b0.jpg';

    card.innerHTML = `
      <div class="card-header-art">
        <span class="card-status-pill ${isCustom ? 'pill-synced' : 'pill-native'}">
          ${isCustom ? 'In Xbox Library' : 'Xbox Store'}
        </span>
        <div class="card-platform-badge" title="Xbox Title">
          <svg viewBox="0 0 24 24" fill="none" stroke="#00e575" stroke-width="2">
            <circle cx="12" cy="12" r="9"/>
            <path d="M8 8c2.5 2 5.5 2 8 0M8 16c2.5-2 5.5-2 8 0"/>
            <line x1="7.5" y1="7.5" x2="16.5" y2="16.5"/>
            <line x1="16.5" y1="7.5" x2="7.5" y2="16.5"/>
          </svg>
        </div>
        <img src="${imagePath}" alt="${title}" onerror="this.src='https://assets.xboxservices.com/assets/79/32/7932e6a9-8588-4db9-8b89-299f01bc49b0.jpg'" />
      </div>
      <div class="card-body">
        <h3 class="game-title" title="${title}">${title}</h3>
        <div class="game-meta">
          <span>${entry.id ? String(entry.id).substring(0, 18) + '...' : 'ID'}</span>
          <span>•</span>
          <span>${entry.source || 'Xbox Custom'}</span>
        </div>
        <div class="card-footer-row">
          <div class="game-path" title="${entry.launchUri || entry.installLocation || ''}">
            ${entry.launchUri || entry.installLocation || 'Installed in Xbox'}
          </div>
          <div class="card-actions-group">
            <button class="card-action-btn btn-uninject" title="Remove title from Xbox App">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>Uninject</span>
            </button>
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

    card.addEventListener('click', () => {
      promptUninjectGame(entry.originalId || entry.id, title);
    });

    gamesContainer.appendChild(card);
  });
}

function renderEmptyState(targetContainer) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.innerHTML = `
    <div class="empty-icon-wrap">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </div>
    <h3 class="empty-title">No Games Found</h3>
    <p class="empty-desc">No titles match your active filters or search query.</p>
  `;
  targetContainer.appendChild(empty);
}

// ============================================================================
// Page 3: Backups Full Page
// ============================================================================
async function loadBackups() {
  backupsList.innerHTML = '<div class="empty-backups">Loading safety backups...</div>';
  try {
    const res = await window.api.getBackups();
    if (res.success && res.backups && res.backups.length > 0) {
      appState.backups = res.backups;
      backupsList.innerHTML = '';
      res.backups.forEach(b => {
        const item = document.createElement('div');
        item.className = 'backup-item';
        const dateStr = new Date(b.createdAt).toLocaleString();
        const kb = Math.round(b.size / 1024);

        item.innerHTML = `
          <div>
            <div class="backup-name">${b.filename}</div>
            <div class="backup-meta">${dateStr} • ${kb} KB</div>
          </div>
          <button class="console-btn btn-ghost btn-sm btn-restore-item" title="Restore this snapshot">Restore</button>
        `;

        const restoreBtn = item.querySelector('.btn-restore-item');
        restoreBtn.addEventListener('click', async () => {
          try {
            await window.api.restoreBackup(b.fullPath);
            await triggerScan();
            await loadBackups();
          } catch (e) {
            console.error('Restore error:', e);
          }
        });

        backupsList.appendChild(item);
      });
    } else {
      backupsList.innerHTML = '<div class="empty-backups">No previous backups found in Xbox LocalState. Click "Create Snapshot Now" to save one.</div>';
    }
  } catch {
    backupsList.innerHTML = '<div class="empty-backups">Failed to load backups.</div>';
  }
}

// ============================================================================
// Page 4: Settings Full Page
// ============================================================================
function updateSettingsUI() {
  if (settingsHiddenCount) settingsHiddenCount.textContent = appState.hiddenAppIds.size;
  if (settingsXboxPath) {
    settingsXboxPath.textContent = (appState.xboxData && appState.xboxData.localStatePath)
      ? appState.xboxData.localStatePath
      : 'LocalState connected';
  }

  if (settingsLibrariesList) {
    settingsLibrariesList.innerHTML = '';
    const roots = [...appState.steamRoots, ...appState.customPaths];
    if (roots.length === 0) {
      settingsLibrariesList.innerHTML = '<div class="empty-backups">No library folders discovered yet. Click Scan to detect.</div>';
    } else {
      roots.forEach(r => {
        const item = document.createElement('div');
        item.className = 'library-item';
        item.innerHTML = `
          <div class="library-path">${r}</div>
          <span class="tab-count">Active</span>
        `;
        settingsLibrariesList.appendChild(item);
      });
    }
  }
}

// ============================================================================
// Hiding, Syncing, and Uninjecting
// ============================================================================
function hideGame(appId) {
  const strId = String(appId);
  appState.hiddenAppIds.add(strId);
  appState.selectedAppIds.delete(strId);
  saveHiddenAppIds(appState.hiddenAppIds);
  renderAllPages();
}

function unhideGame(appId) {
  const strId = String(appId);
  appState.hiddenAppIds.delete(strId);
  saveHiddenAppIds(appState.hiddenAppIds);
  renderAllPages();
}

function promptUninjectGame(appId, title) {
  pendingUninjectAppId = appId;
  pendingUninjectTitle = title || 'this game';
  if (uninjectTitleName) uninjectTitleName.textContent = pendingUninjectTitle;
  if (uninjectModal) {
    uninjectModal.style.display = 'flex';
    if (btnProceedUninject) btnProceedUninject.focus();
  }
}

async function executeUninject(appId, title) {
  try {
    const res = await window.api.uninjectGame(appId);
    if (res.success) {
      await triggerScan();
    }
  } catch (err) {
    console.error('Uninject error:', err);
  }
}

function openConfirmModal(toSync) {
  if (modalGameCount) modalGameCount.textContent = toSync.length;
  if (modalProcessWarning) {
    modalProcessWarning.style.display = appState.processInfo.isRunning ? 'flex' : 'none';
  }
  if (confirmModal) {
    confirmModal.style.display = 'flex';
    if (btnProceedSync) btnProceedSync.focus();
  }
}

async function executeSync() {
  const toSync = getSelectedMissingGames();
  if (toSync.length === 0) return;

  appState.isSyncing = true;
  if (btnSync) btnSync.disabled = true;
  if (syncBtnLabel) syncBtnLabel.textContent = 'Injecting into Xbox database...';

  try {
    if (appState.processInfo.isRunning) {
      await closeXboxApp();
    }
    const res = await window.api.syncGames(toSync);
    if (res.success) {
      await triggerScan();
      switchSection('library');
    }
  } catch (err) {
    console.error('Sync error:', err);
  } finally {
    appState.isSyncing = false;
    updateSyncHubSelectionUI();
  }
}

function getFilteredMissingGames() {
  return appState.games.filter(g => !g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid)));
}

function getSelectedMissingGames() {
  return appState.games.filter(g => !g.isDuplicate && !appState.hiddenAppIds.has(String(g.appid)) && appState.selectedAppIds.has(String(g.appid)));
}

// ============================================================================
// Controller & Gamepad Navigation Engine (Problem #2 Solved)
// True 2D Spatial Grid Navigation & Continuous Polling Loop
// ============================================================================
const controllerNav = {
  focusedEl: null,
  lastStickDir: null,
  stickHoldStart: 0,
  lastActionTime: 0,
  repeatDelay: 170,
  initialDelay: 300,
  prevButtons: new Map(),

  init() {
    // Keyboard navigation mapping
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.id === 'searchInput' && !['Escape', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowRight') this.navigateDirection('right');
        else if (e.key === 'ArrowLeft') this.navigateDirection('left');
        else if (e.key === 'ArrowUp') this.navigateDirection('up');
        else if (e.key === 'ArrowDown') this.navigateDirection('down');
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (this.focusedEl && !['BUTTON', 'INPUT'].includes(e.target.tagName)) {
          e.preventDefault();
          this.handleButtonA();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.handleButtonB();
      } else if (e.key === 'q' || e.key === 'Q') {
        if (!['INPUT'].includes(e.target.tagName)) {
          e.preventDefault();
          switchSectionByOffset(-1);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (!['INPUT'].includes(e.target.tagName)) {
          e.preventDefault();
          switchSectionByOffset(1);
        }
      }
    });

    // Start continuous requestAnimationFrame polling loop
    requestAnimationFrame(this.poll.bind(this));
  },

  poll(timestamp) {
    // Continuous RAF loop
    requestAnimationFrame(this.poll.bind(this));

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const pad = gamepads[i];
      if (!pad || !pad.connected) continue;
      this.processGamepadInput(pad, timestamp);
    }
  },

  processGamepadInput(pad, timestamp) {
    const isButtonPressed = (btnIdx) => {
      const btn = pad.buttons && pad.buttons[btnIdx];
      const isDown = !!(btn && (btn.pressed || btn.value > 0.35));
      const key = `${pad.index}_${btnIdx}`;
      const wasDown = !!this.prevButtons.get(key);
      this.prevButtons.set(key, isDown);
      return isDown && !wasDown;
    };

    // D-Pad buttons
    const dpadUp = isButtonPressed(12);
    const dpadDown = isButtonPressed(13);
    const dpadLeft = isButtonPressed(14);
    const dpadRight = isButtonPressed(15);

    // Left analog stick
    const axisX = (pad.axes && pad.axes.length > 0) ? (pad.axes[0] || 0) : 0;
    const axisY = (pad.axes && pad.axes.length > 1) ? (pad.axes[1] || 0) : 0;
    const stickThreshold = 0.45;

    let dir = null;
    if (dpadLeft || axisX < -stickThreshold) dir = 'left';
    else if (dpadRight || axisX > stickThreshold) dir = 'right';
    else if (dpadUp || axisY < -stickThreshold) dir = 'up';
    else if (dpadDown || axisY > stickThreshold) dir = 'down';

    const now = timestamp || performance.now();
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

    // Action buttons
    if (isButtonPressed(0)) this.handleButtonA(); // A: Select / Toggle
    if (isButtonPressed(1)) this.handleButtonB(); // B: Back
    if (isButtonPressed(2)) { // X: Toggle Select All
      if (appState.currentSection === 'sync' || appState.currentTab === 'missing') {
        if (selectAllCheckbox) selectAllCheckbox.click();
      }
    }
    if (isButtonPressed(3)) { // Y: Scan
      if (btnScan) btnScan.click();
    }
    if (isButtonPressed(4)) switchSectionByOffset(-1); // LB: Previous Page
    if (isButtonPressed(5)) switchSectionByOffset(1);  // RB: Next Page
    if (isButtonPressed(6)) switchTabByOffset(-1);     // LT: Previous Category
    if (isButtonPressed(7)) switchTabByOffset(1);      // RT: Next Category
    if (isButtonPressed(9)) toggleFse();               // Menu: FSE
  },

  getActiveContextElements() {
    // Check if any modal is open
    if (xboxRunningModal && xboxRunningModal.style.display === 'flex') {
      return [btnKillXboxModal, btnDismissXboxRunning, btnCloseXboxRunning].filter(el => el && el.offsetParent !== null);
    }
    if (confirmModal && confirmModal.style.display === 'flex') {
      return [btnProceedSync, btnCancelSync, btnCloseConfirm].filter(el => el && el.offsetParent !== null);
    }
    if (uninjectModal && uninjectModal.style.display === 'flex') {
      return [btnProceedUninject, btnCancelUninject, btnCloseUninject].filter(el => el && el.offsetParent !== null);
    }

    // Return elements according to current section
    const activePage = pages[appState.currentSection];
    if (!activePage) return [];

    const elements = [];

    if (appState.currentSection === 'library') {
      const tabs = Array.from(document.querySelectorAll('.tab-btn'));
      elements.push(...tabs);
      if (searchInput) elements.push(searchInput);
      if (btnAddFolder) elements.push(btnAddFolder);
      const cards = Array.from(gamesContainer.querySelectorAll('.game-card'));
      elements.push(...cards);
    } else if (appState.currentSection === 'sync') {
      if (selectAllCheckbox) elements.push(selectAllCheckbox);
      if (btnSync && !btnSync.disabled) elements.push(btnSync);
      const cards = Array.from(syncGamesContainer.querySelectorAll('.game-card'));
      elements.push(...cards);
    } else if (appState.currentSection === 'backups') {
      if (btnCreateBackup) elements.push(btnCreateBackup);
      const restoreBtns = Array.from(backupsList.querySelectorAll('.btn-restore-item'));
      elements.push(...restoreBtns);
    } else if (appState.currentSection === 'settings') {
      if (btnSettingsAddFolder) elements.push(btnSettingsAddFolder);
      if (btnResetHidden) elements.push(btnResetHidden);
    }

    return elements.filter(el => el && el.offsetParent !== null);
  },

  focusFirstAvailable() {
    const list = this.getActiveContextElements();
    if (list.length > 0) {
      // Prioritize first card or primary action
      const card = document.querySelector('.console-page.active .game-card');
      const target = card || list[0];
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
    const activePage = pages[appState.currentSection];
    const cards = activePage ? Array.from(activePage.querySelectorAll('.game-card')) : [];

    // 2D Spatial Card Navigation
    if (this.focusedEl && cards.includes(this.focusedEl)) {
      const cardIdx = cards.indexOf(this.focusedEl);
      const container = activePage.querySelector('.games-showcase');
      const containerWidth = container ? container.offsetWidth : 1200;
      const colWidth = (cards[0] && cards[0].offsetWidth) ? cards[0].offsetWidth + 24 : 364;
      const cols = Math.max(1, Math.floor(containerWidth / colWidth));

      if (dir === 'right') {
        const nextIdx = Math.min(cards.length - 1, cardIdx + 1);
        this.applyFocus(cards[nextIdx]);
        return;
      } else if (dir === 'left') {
        const prevIdx = Math.max(0, cardIdx - 1);
        this.applyFocus(cards[prevIdx]);
        return;
      } else if (dir === 'down') {
        const targetIdx = cardIdx + cols;
        if (targetIdx < cards.length) {
          this.applyFocus(cards[targetIdx]);
        }
        return;
      } else if (dir === 'up') {
        const targetIdx = cardIdx - cols;
        if (targetIdx >= 0) {
          this.applyFocus(cards[targetIdx]);
        } else {
          // Move up to section controls
          if (appState.currentSection === 'library') {
            const activeTab = document.querySelector('.tab-btn.active');
            this.applyFocus(activeTab || searchInput || btnAddFolder);
          } else if (appState.currentSection === 'sync') {
            this.applyFocus(btnSync && !btnSync.disabled ? btnSync : selectAllCheckbox);
          }
        }
        return;
      }
    }

    // Down from controls into cards
    if (dir === 'down' && cards.length > 0) {
      this.applyFocus(cards[0]);
      return;
    }

    // Linear navigation for other controls
    const items = this.getActiveContextElements();
    if (items.length === 0) return;

    if (!this.focusedEl || !items.includes(this.focusedEl)) {
      this.focusFirstAvailable();
      return;
    }

    const currentIdx = items.indexOf(this.focusedEl);
    if (dir === 'right' || dir === 'down') {
      const nextIdx = (currentIdx + 1) % items.length;
      this.applyFocus(items[nextIdx]);
    } else {
      const prevIdx = (currentIdx - 1 + items.length) % items.length;
      this.applyFocus(items[prevIdx]);
    }
  },

  handleButtonA() {
    if (!this.focusedEl) return;
    this.focusedEl.click();
  },

  handleButtonB() {
    if (xboxRunningModal && xboxRunningModal.style.display === 'flex') {
      xboxRunningModal.style.display = 'none';
      return;
    }
    if (confirmModal && confirmModal.style.display === 'flex') {
      confirmModal.style.display = 'none';
      return;
    }
    if (uninjectModal && uninjectModal.style.display === 'flex') {
      uninjectModal.style.display = 'none';
      pendingUninjectAppId = null;
      return;
    }

    // Return to Library first tab
    if (appState.currentSection !== 'library') {
      switchSection('library');
    }
  }
};
