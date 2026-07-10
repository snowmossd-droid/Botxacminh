const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Cac bien nay do GitHub Actions tu cung cap trong workflow, khong can tu tay set
const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
const GITHUB_TOKEN = process.env.GH_PUSH_TOKEN; // dat trong workflow, xem README
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY; // vi du: "user/discord-bot", GitHub tu cap san

function loadAll() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    console.error('Loi doc config.json, dung config rong:', err);
    return {};
  }
}

function saveAll(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
  persistToGitIfNeeded();
}

// ==== Neu dang chay trong GitHub Actions, commit + push config.json ve repo ====
// de lan chay workflow tiep theo (checkout lai code) van thay duoc cau hinh moi nhat.
function persistToGitIfNeeded() {
  if (!IS_GITHUB_ACTIONS) return; // chay local hoac Render thi bo qua, file da nam san tren dia roi

  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    console.warn(
      'Dang chay trong GitHub Actions nhung thieu GH_PUSH_TOKEN hoac GITHUB_REPOSITORY, ' +
      'khong the tu luu config.json ve repo. Cau hinh se mat khi job ket thuc.'
    );
    return;
  }

  try {
    execSync('git config user.name "discord-bot"', { stdio: 'ignore' });
    execSync('git config user.email "discord-bot@users.noreply.github.com"', { stdio: 'ignore' });
    execSync(
      `git remote set-url origin https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`,
      { stdio: 'ignore' }
    );
    execSync('git add config.json', { stdio: 'ignore' });

    // Neu khong co gi thay doi, git commit se bao loi -> bo qua loi nay, khong phai van de
    try {
      execSync('git commit -m "chore: cap nhat config.json tu bot [skip ci]"', { stdio: 'ignore' });
    } catch {
      return; // khong co thay doi gi de commit
    }

    execSync('git push origin HEAD:main', { stdio: 'ignore' });
    console.log('Da luu config.json ve repo GitHub.');
  } catch (err) {
    console.error('Loi khi tu push config.json ve repo:', err.message);
  }
}

function getGuildConfig(guildId) {
  const all = loadAll();
  return all[guildId] || {};
}

function setGuildConfig(guildId, partial) {
  const all = loadAll();
  all[guildId] = { ...(all[guildId] || {}), ...partial };
  saveAll(all);
  return all[guildId];
}

module.exports = { getGuildConfig, setGuildConfig };
