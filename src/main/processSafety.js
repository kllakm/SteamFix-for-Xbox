const { execSync } = require('child_process');

const TARGET_PROCESS_NAMES = [
  'XboxPcApp',
  'Microsoft.GamingApp'
];

const IGNORED_PROCESS_NAMES = [
  'XboxPcAppFT',
  'XboxPcAppFT.exe'
];

/**
 * Check if any Xbox related process is running
 */
function checkXboxProcesses() {
  const running = [];

  try {
    const output = execSync('tasklist /FO CSV /NH', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });

    const lines = output.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      // CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
      const match = line.match(/^"([^"]+)"/);
      if (match) {
        const imageName = match[1];
        const lowerImage = imageName.toLowerCase();
        const baseName = lowerImage.replace(/\.exe$/i, '');

        // Explicitly ignore background fast-track tasks such as XboxPcAppFT.exe
        if (lowerImage.includes('xboxpcappft') || IGNORED_PROCESS_NAMES.some(ign => ign.toLowerCase() === baseName || ign.toLowerCase() === lowerImage)) {
          continue;
        }

        for (const target of TARGET_PROCESS_NAMES) {
          const targetLower = target.toLowerCase();
          if (baseName === targetLower || lowerImage === `${targetLower}.exe`) {
            if (!running.some(r => r.name.toLowerCase() === imageName.toLowerCase())) {
              running.push({ name: imageName });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error checking tasklist:', err);
  }

  return {
    isRunning: running.length > 0,
    processes: running
  };
}

/**
 * Gracefully close or terminate Xbox processes
 */
function closeXboxProcesses() {
  const results = [];
  for (const proc of TARGET_PROCESS_NAMES) {
    try {
      execSync(`taskkill /F /IM "${proc}.exe"`, {
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true
      });
      results.push({ name: `${proc}.exe`, status: 'Terminated' });
    } catch {
      // Process was not running or could not be terminated
    }
  }

  // Brief pause to allow Windows file locks to be released
  return {
    closed: results,
    status: 'completed'
  };
}

module.exports = {
  checkXboxProcesses,
  closeXboxProcesses,
  TARGET_PROCESS_NAMES,
  IGNORED_PROCESS_NAMES
};
