const fs = require('fs');
const path = require('path');

const SAMPLE_GAMES = [
  {
    appid: '1245620',
    name: 'ELDEN RING',
    installdir: 'ELDEN RING',
    exe: 'eldenring.exe',
    size: '48234857920'
  },
  {
    appid: '1086940',
    name: "Baldur's Gate 3",
    installdir: "Baldurs Gate 3",
    exe: 'bg3.exe',
    size: '125890204800'
  },
  {
    appid: '1091500',
    name: 'Cyberpunk 2077',
    installdir: 'Cyberpunk 2077',
    exe: 'Cyberpunk2077.exe',
    size: '72500000000'
  },
  {
    appid: '1145360',
    name: 'Hades II',
    installdir: 'Hades II',
    exe: 'Hades2.exe',
    size: '9500000000'
  },
  {
    appid: '553850',
    name: 'HELLDIVERS™ 2',
    installdir: 'HELLDIVERS 2',
    exe: 'helldivers2.exe',
    size: '25000000000'
  }
];

/**
 * Generate a valid Steam mock library for testing or demo purposes
 */
function createMockSteamLibrary(targetDir) {
  const steamAppsDir = path.join(targetDir, 'steamapps');
  const commonDir = path.join(steamAppsDir, 'common');

  if (!fs.existsSync(commonDir)) {
    fs.mkdirSync(commonDir, { recursive: true });
  }

  // Create libraryfolders.vdf
  const libraryFoldersVdf = `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${targetDir.replace(/\\/g, '\\\\')}"\n\t\t"label"\t\t""\n\t\t"contentid"\t\t"123456789"\n\t\t"totalSize"\t\t"1000000000000"\n\t\t"apps"\n\t\t{\n${SAMPLE_GAMES.map(g => `\t\t\t"${g.appid}"\t\t"${g.size}"`).join('\n')}\n\t\t}\n\t}\n}`;
  fs.writeFileSync(path.join(steamAppsDir, 'libraryfolders.vdf'), libraryFoldersVdf, 'utf8');

  // Create each appmanifest_<id>.acf and fake game exe
  for (const game of SAMPLE_GAMES) {
    const manifestContent = `"AppState"\n{\n\t"appid"\t\t"${game.appid}"\n\t"Universe"\t\t"1"\n\t"name"\t\t"${game.name}"\n\t"StateFlags"\t\t"4"\n\t"installdir"\t\t"${game.installdir}"\n\t"LastUpdated"\t\t"${Math.floor(Date.now() / 1000)}"\n\t"SizeOnDisk"\t\t"${game.size}"\n\t"buildid"\t\t"10000000"\n}`;
    fs.writeFileSync(path.join(steamAppsDir, `appmanifest_${game.appid}.acf`), manifestContent, 'utf8');

    const gameDir = path.join(commonDir, game.installdir);
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }
    const exePath = path.join(gameDir, game.exe);
    if (!fs.existsSync(exePath)) {
      fs.writeFileSync(exePath, 'MOCK_BINARY_DATA');
    }
  }

  return {
    libraryDir: targetDir,
    gamesCount: SAMPLE_GAMES.length,
    games: SAMPLE_GAMES
  };
}

module.exports = {
  SAMPLE_GAMES,
  createMockSteamLibrary
};
