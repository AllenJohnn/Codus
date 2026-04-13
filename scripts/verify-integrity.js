const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');

const monitoredFiles = [
  'package.json',
  'package-lock.json',
  path.join('extension', 'package.json'),
  path.join('extension', 'tsconfig.json'),
  path.join('extension', 'src', 'extension.ts'),
  path.join('extension', 'src', 'cursorManager.ts'),
  path.join('extension', 'src', 'roomManager.ts'),
  path.join('extension', 'src', 'types.ts'),
  path.join('extension', 'src', 'webview', 'panel.ts'),
  path.join('server', 'package.json'),
  path.join('server', 'tsconfig.json'),
  path.join('server', 'src', 'index.ts'),
];

function readFile(filePath) {
  return fs.readFileSync(path.join(rootDir, filePath), 'utf8');
}

function hash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function validateJson(filePath, content) {
  try {
    JSON.parse(content);
  } catch (error) {
    throw new Error(`${filePath} is not valid JSON: ${error.message}`);
  }
}

const hashToFiles = new Map();

for (const filePath of monitoredFiles) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing monitored file: ${filePath}`);
  }

  const content = readFile(filePath);
  if (!content.trim()) {
    throw new Error(`Monitored file is empty: ${filePath}`);
  }

  if (filePath.endsWith('.json')) {
    validateJson(filePath, content);
  }

  const fileHash = hash(content);
  const existing = hashToFiles.get(fileHash) ?? [];
  existing.push(filePath);
  hashToFiles.set(fileHash, existing);
}

const duplicateGroups = Array.from(hashToFiles.values()).filter((group) => group.length > 1);

if (duplicateGroups.length > 0) {
  const details = duplicateGroups.map((group) => `- ${group.join(', ')}`).join('\n');
  throw new Error(
    `Detected identical content across monitored files. This usually means an accidental overwrite occurred:\n${details}`,
  );
}

console.log(`Integrity check passed for ${monitoredFiles.length} monitored files.`);