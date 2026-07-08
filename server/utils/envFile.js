const fs = require('fs');
const path = require('path');

/**
 * Set or clear a single variable in a dotenv file without disturbing other entries.
 * Empty value writes KEY= so the variable is explicitly unset.
 */
function updateEnvFile(envPath, varName, value) {
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const normalized = (value ?? '').trim();
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const linePattern = new RegExp(`^${escapeRegExp(varName)}=.*(?:\\r?\\n|$)`, 'm');

  if (normalized) {
    const nextLine = `${varName}=${normalized}\n`;
    if (linePattern.test(content)) {
      content = content.replace(linePattern, nextLine);
    } else {
      content = content.trimEnd();
      if (content.length > 0) content += '\n';
      content += nextLine;
    }
  } else if (linePattern.test(content)) {
    content = content.replace(linePattern, '');
    content = content.trimEnd();
    if (content.length > 0) content += '\n';
  } else if (!fs.existsSync(envPath)) {
    return;
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { updateEnvFile };
