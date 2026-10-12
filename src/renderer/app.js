// State
let appState = {
  version: '1.1.1',
  currentTab: 'missing',
  steamRoots: [],
  libraries: [],
  games: [],
  xboxData: null,
  selectedAppIds: new Set(),
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
const btnDemoFixture = document.getElementById('btnDemoFixture');
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

// Modal Elements
const confirmModal = document.getElementById('confirmModal');
const modalGameCount = document.getElementById('modalGameCount');
const modalProcessWarning = document.getElementById('modalProcessWarning');
const btnCancelSync = document.getElementById('btnCancelSync');
const btnProceedSync = document.getElementById('btnProceedSync');

const backupsModal = document.getElementById('backupsModal');
const btnCloseBackups = document.getElementById('btnCloseBackups');
const backupsList = document.getElementById('backupsList');

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadVersion();
  await checkProcesses();
  await triggerScan();
});

// Setup Events
function setupEventListeners() {
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const tab = e.currentTarget.getAttribute('data-tab');
      e.currentTarget.classList.add('active');
      appState.currentTab = tab;
      render();
    });
  });

  // Search input
  searchInput.addEventListener('input', (e) => {
    appState.searchQuery = e.target.value.toLowerCase().trim();
    if (searchClearBtn) {
      searchClearBtn.style.display = appState.searchQuery ? 'block' : 'none';
    }
    render();
  });

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      appState.searchQuery = '';
      searchClearBtn.style.display = 'none';
      render();
    });
  }

  // Scan Button
  btnScan.addEventListener('click', () => triggerScan());

  // Add Steam Folder
  btnAddFolder.addEventListener('click', async () => {
    try {
      const folder = await window.api.selectFolder();
      if (folder) {
        if (!appState.customPaths.includes(folder)) {
          appState.customPaths.push(folder);
          logConsole(`[Steam] Added custom library folder: ${folder}`, 'info');
          await triggerScan();
        }
      }
    } catch (err) {
      logConsole(`[Error] Failed to select folder: ${err.message}`, 'error');
    }
  });

  // Load Demo / Sample Titles
  btnDemoFixture.addEventListener('click', async () => {
    try {
      logConsole('[Demo] Generating sample Steam library fixtures...', 'info');
      const res = await window.api.createDemoLibrary();
      if (res.success) {
        if (!appState.customPaths.includes(res.demoDir)) {
          appState.customPaths.push(res.demoDir);
        }
        logConsole(`[Demo] Sample Steam library initialized at: ${res.demoDir}`, 'success');
        await triggerScan();
      } else {
        logConsole(`[Demo] Failed to generate fixture: ${res.error}`, 'error');
      }
    } catch (err) {
      logConsole(`[Error] ${err.message}`, 'error');
    }
  });

  // Kill Xbox Process
  btnKillXbox.addEventListener('click', async () => {
    logConsole('[Process] Closing Xbox processes...', 'warn');
    await window.api.closeProcesses();
    await checkProcesses();
  });

  // Sync Click (Show modal)
  btnSync.addEventListener('click', () => {
    const selected = getSelectedMissingGames();
    if (selected.length === 0) return;

    modalGameCount.textContent = selected.length;
    modalProcessWarning.style.display = appState.processInfo.isRunning ? 'block' : 'none';
    confirmModal.style.display = 'flex';
  });

  btnCancelSync.addEventListener('click', () => {
    confirmModal.style.display = 'none';
  });

  btnProceedSync.addEventListener('click', async () => {
    confirmModal.style.display = 'none';
    await executeSync();
  });

  // Select all checkbox
  selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const missing = getFilteredMissingGames();
    if (isChecked) {
      missing.forEach(g => appState.selectedAppIds.add(g.appid));
    } else {
      missing.forEach(g => appState.selectedAppIds.delete(g.appid));
    }
    renderSelectionState();
    renderCards();
  });

  // Backups modal
  btnBackups.addEventListener('click', async () => {
    await loadBackupsList();
    backupsModal.style.display = 'flex';
  });

  btnCloseBackups.addEventListener('click', () => {
    backupsModal.style.display = 'none';
  });

  // Clear log
  btnClearLog.addEventListener('click', (e) => {
    e.stopPropagation();
    consoleLogs.innerHTML = '';
  });

  // Collapsible Console Drawer (Handheld Touch optimization)
  if (drawerHeader && consoleDrawer) {
    drawerHeader.addEventListener('click', (e) => {
      if (e.target.closest('#btnClearLog')) return;
      consoleDrawer.classList.toggle('collapsed');
    });
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
    const ver = await window.api.getAppVersion();
    if (ver) {
      appState.version = ver;
      semverBadge.textContent = `v${ver}`;
      footerVersionBadge.textContent = `v${ver}`;
      document.title = `XboxSteamBridge v${ver}`;
    }
  } catch (err) {
    console.error('Failed to load version:', err);
  }
}

// Process Checker
async function checkProcesses() {
  try {
    const info = await window.api.checkProcesses();
    appState.processInfo = info;
    if (info.isRunning) {
      processDot.className = 'pill-dot running';
      const names = info.processes.map(p => p.name).join(', ');
      processLabel.textContent = `Xbox active (${names})`;
      btnKillXbox.style.display = 'inline-block';
    } else {
      processDot.className = 'pill-dot safe';
      processLabel.textContent = 'Xbox App closed (Safe to edit)';
      btnKillXbox.style.display = 'none';
    }
  } catch (err) {
    console.error('Error checking processes:', err);
  }
}

// Trigger Scan
async function triggerScan() {
  if (appState.isScanning) return;
  appState.isScanning = true;
  scanIcon.classList.add('spinning');
  scanBtnText.textContent = 'Scanning...';
  logConsole('[Scanner] Scanning Steam libraries and querying PC Xbox App...', 'info');

  try {
    await checkProcesses();
    const result = await window.api.scanSteam(appState.customPaths);
    if (result.success) {
      appState.steamRoots = result.steamRoots;
      appState.libraries = result.libraries;
      appState.games = result.games;
      appState.xboxData = result.xboxData;

      // Select all missing games by default
      appState.selectedAppIds.clear();
      appState.games
        .filter(g => !g.isDuplicate)
        .forEach(g => appState.selectedAppIds.add(g.appid));

      logConsole(`[Scanner] Discovered ${result.libraries.length} Steam library roots, found ${result.totalSteamGames} Steam games.`, 'info');
      logConsole(`[Xbox] LocalState parsed. ${result.xboxData.totalRegisteredXboxTitles} custom titles found in Xbox App.`, 'info');
      logConsole(`[Result] ${result.missingCount} games missing from Xbox. ${result.syncedCount} already synchronized.`, 'success');
    } else {
      logConsole(`[Error] Scan failed: ${result.error}`, 'error');
    }
  } catch (err) {
    logConsole(`[Error] Scan exception: ${err.message}`, 'error');
  } finally {
    appState.isScanning = false;
    scanIcon.classList.remove('spinning');
    scanBtnText.textContent = 'Scan Now';
    render();
  }
}

// Execute Sync
async function executeSync() {
  const selectedGames = getSelectedMissingGames();
  if (selectedGames.length === 0) return;

  appState.isSyncing = true;
  btnSync.disabled = true;
  syncBtnLabel.textContent = 'Syncing...';

  logConsole(`[Sync] Initiating injection for ${selectedGames.length} titles...`, 'info');

  try {
    // If Xbox is running, close it first
    if (appState.processInfo.isRunning) {
      logConsole('[Safety] Gracefully closing Xbox processes to release database locks...', 'warn');
      await window.api.closeProcesses();
      await checkProcesses();
    }

    const result = await window.api.syncGames(selectedGames);

    if (result.success) {
      logConsole(`[Success] Injected ${result.injectedCount} titles!`, 'success');
      if (result.backupInfo && result.backupInfo.backups.length > 0) {
        result.backupInfo.backups.forEach(b => {
          logConsole(`[Backup Created] ${b.backup} (${b.size} bytes)`, 'info');
        });
      }
      // Re-scan to update all counts and deduplicate
      await triggerScan();
    } else {
      logConsole(`[Error] Sync failed: ${result.error}`, 'error');
    }
  } catch (err) {
    logConsole(`[Error] Sync exception: ${err.message}`, 'error');
  } finally {
    appState.isSyncing = false;
    syncBtnLabel.textContent = 'Sync to Xbox App';
    render();
  }
}

// Helpers
function getSelectedMissingGames() {
  return appState.games.filter(g => !g.isDuplicate && appState.selectedAppIds.has(g.appid));
}

function getFilteredMissingGames() {
  return appState.games
    .filter(g => !g.isDuplicate)
    .filter(g => {
      if (!appState.searchQuery) return true;
      return g.name.toLowerCase().includes(appState.searchQuery) || g.appid.includes(appState.searchQuery);
    });
}

function logConsole(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  consoleLogs.appendChild(entry);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;

  if (drawerPreviewText) {
    drawerPreviewText.textContent = `[${timestamp}] ${message}`;
  }
}

// Backups Modal Manager
async function loadBackupsList() {
  backupsList.innerHTML = '<div class="empty-backups">Loading backups...</div>';
  try {
    const res = await window.api.getBackups();
    if (!res.success || res.backups.length === 0) {
      backupsList.innerHTML = '<div class="empty-backups">No previous backups found in Xbox LocalState.</div>';
      return;
    }

    backupsList.innerHTML = '';
    res.backups.forEach(b => {
      const row = document.createElement('div');
      row.className = 'backup-row';
      const dateStr = new Date(b.createdAt).toLocaleString();
      const sizeKb = (b.size / 1024).toFixed(1);

      row.innerHTML = `
        <div class="backup-info">
          <span class="backup-name">${b.filename}</span>
          <span class="backup-date">Created: ${dateStr} • ${sizeKb} KB</span>
        </div>
        <button class="btn btn-secondary btn-sm btn-restore" data-path="${b.fullPath}">
          Restore
        </button>
      `;

      row.querySelector('.btn-restore').addEventListener('click', async (e) => {
        const fullPath = e.currentTarget.getAttribute('data-path');
        if (confirm(`Restore Xbox library from backup ${b.filename}?`)) {
          logConsole(`[Restore] Restoring ${fullPath}...`, 'warn');
          const restoreRes = await window.api.restoreBackup(fullPath);
          if (restoreRes.success) {
            logConsole('[Restore] Successfully restored Xbox library state!', 'success');
            backupsModal.style.display = 'none';
            await triggerScan();
          } else {
            logConsole(`[Error] Restore failed: ${restoreRes.error}`, 'error');
          }
        }
      });

      backupsList.appendChild(row);
    });
  } catch (err) {
    backupsList.innerHTML = `<div class="empty-backups">Error: ${err.message}</div>`;
  }
}

// Render UI
function render() {
  const missing = appState.games.filter(g => !g.isDuplicate);
  const synced = appState.games.filter(g => g.isDuplicate);
  const allSteam = appState.games;
  const xboxCustom = (appState.xboxData && appState.xboxData.customGames) ? appState.xboxData.customGames : [];

  // Update Stats
  statSteamGames.textContent = allSteam.length;
  statLibrariesCount.textContent = `${appState.libraries.length} library folder${appState.libraries.length === 1 ? '' : 's'}`;
  
  const totalXbox = xboxCustom.length;
  statXboxGames.textContent = totalXbox;
  statXboxStatus.textContent = `${totalXbox} custom title${totalXbox === 1 ? '' : 's'}`;

  statMissingGames.textContent = missing.length;
  statSyncedGames.textContent = synced.length;

  badgeMissing.textContent = missing.length;
  badgeSynced.textContent = synced.length;
  badgeAll.textContent = allSteam.length;
  badgeXbox.textContent = totalXbox;

  // Sync Button State
  const selectedCount = getSelectedMissingGames().length;
  btnSync.disabled = selectedCount === 0 || appState.isSyncing;
  syncBtnLabel.textContent = selectedCount > 0 ? `Sync ${selectedCount} to Xbox` : 'Sync to Xbox App';

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
  gamesContainer.innerHTML = '';

  let listToDisplay = [];
  const q = appState.searchQuery;

  if (appState.currentTab === 'missing') {
    listToDisplay = appState.games.filter(g => !g.isDuplicate);
  } else if (appState.currentTab === 'synced') {
    listToDisplay = appState.games.filter(g => g.isDuplicate);
  } else if (appState.currentTab === 'all') {
    listToDisplay = appState.games;
  } else if (appState.currentTab === 'xbox') {
    // Show Xbox library titles
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
      g.name.toLowerCase().includes(q) || g.appid.includes(q)
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

    const isMissingTab = appState.currentTab === 'missing';

    card.innerHTML = `
      <div class="card-header-art">
        ${isMissingTab ? `
          <input type="checkbox" class="card-checkbox" data-appid="${game.appid}" ${isSelected ? 'checked' : ''} />
        ` : ''}
        <span class="card-status-pill ${game.isDuplicate ? 'pill-synced' : 'pill-missing'}">
          ${game.isDuplicate ? 'In Xbox Library' : 'Missing from Xbox'}
        </span>
        <img src="${game.headerUrl}" alt="${game.name}" onerror="this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg'; this.onerror=null;" />
      </div>
      <div class="card-body">
        <h3 class="game-title" title="${game.name}">${game.name}</h3>
        <div class="game-meta">
          <span>AppID: ${game.appid}</span>
          <span>•</span>
          <span>${game.primaryExecutable ? game.primaryExecutable : 'steam://'}</span>
        </div>
        ${game.isDuplicate && game.matchReason ? `
          <div class="match-reason-box">${game.matchReason}</div>
        ` : ''}
        <div class="game-path" title="${game.installLocation}">${game.installLocation}</div>
      </div>
    `;

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

      checkbox.addEventListener('change', (e) => {
        toggleSelection(e.target.checked);
      });

      // Handheld touch optimization: Tap anywhere on the card to toggle selection!
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-checkbox')) return;
        checkbox.checked = !checkbox.checked;
        toggleSelection(checkbox.checked);
      });
    }

    gamesContainer.appendChild(card);
  });
}

function renderXboxCards(xboxGames) {
  if (xboxGames.length === 0) {
    renderEmptyState();
    return;
  }

  xboxGames.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'game-card';
    const isCustom = entry.isCustom;
    const title = entry.title || 'Unknown Title';
    const imagePath = entry.imagePath || entry.bannerUrl || 'https://assets.xboxservices.com/assets/79/32/7932e6a9-8588-4db9-8b89-299f01bc49b0.jpg';

    card.innerHTML = `
      <div class="card-header-art">
        <span class="card-status-pill ${isCustom ? 'pill-synced' : 'pill-native'}">
          ${isCustom ? (entry.source || 'Sideloaded') : 'Xbox Store'}
        </span>
        <img src="${imagePath}" alt="${title}" onerror="this.style.opacity='0.2'" />
      </div>
      <div class="card-body">
        <h3 class="game-title" title="${title}">${title}</h3>
        <div class="game-meta">
          <span>${entry.id ? entry.id : 'ID'}</span>
          <span>•</span>
          <span>${entry.storefront || entry.source || 'Xbox'}</span>
        </div>
        <div class="game-path" title="${entry.launchUri || entry.installLocation || ''}">
          ${entry.launchUri || entry.installLocation || 'Installed in Xbox'}
        </div>
      </div>
    `;

    gamesContainer.appendChild(card);
  });
}

function renderEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.innerHTML = `
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12h8"/>
    </svg>
    <h3 class="empty-title">No games found in this view</h3>
    <p class="empty-desc">
      ${appState.games.length === 0 
        ? "We couldn't detect any Steam libraries on default paths. Click 'Add Steam Folder' to point to your Steam library, or click 'Load Sample Titles' to test immediately."
        : "All games match your filters or none are currently available in this category."}
    </p>
  `;
  gamesContainer.appendChild(empty);
}
