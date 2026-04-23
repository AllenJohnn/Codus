const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');

const monitoredFiles = [
  'package.json',
  'package-lock.json',
  path.join('extension', 'package.json'),
  path.join('extension', 'README.md'),
  path.join('extension', 'CHANGELOG.md'),
  path.join('extension', 'tsconfig.json'),
  path.join('extension', 'src', 'extension.ts'),
  path.join('extension', 'src', 'cursorManager.ts'),
  path.join('extension', 'src', 'roomManager.ts'),
  path.join('extension', 'src', 'types.ts'),
  path.join('extension', 'src', 'webview', 'index.html'),
  path.join('extension', 'src', 'webview', 'panel.ts'),
  path.join('shared', 'types.ts'),
  path.join('server', 'package.json'),
  path.join('server', 'tsconfig.json'),
  path.join('server', 'src', 'index.ts'),
];

const expectedSignatures = {
  [path.join('extension', 'src', 'extension.ts')]: ['export function activate', 'const URI_AUTHORITY'],
  [path.join('extension', 'src', 'roomManager.ts')]: ['export class RoomManager', 'SOCKET_EVENTS'],
  [path.join('extension', 'src', 'types.ts')]: ["export * from 'codus-shared'"],
  [path.join('extension', 'src', 'webview', 'panel.ts')]: ['export class CollaborativePanelProvider'],
  [path.join('extension', 'src', 'webview', 'index.html')]: ['<!DOCTYPE html>', '<html lang="en">'],
  [path.join('shared', 'types.ts')]: ["export * from './src'"],
  [path.join('extension', 'README.md')]: ['# Codus'],
  [path.join('extension', 'CHANGELOG.md')]: ['# Changelog'],
};

const forbiddenSignaturesByExtension = {
  '.ts': ['<!DOCTYPE html>'],
  '.html': ["import * as vscode from 'vscode';", 'export function activate'],
  '.md': ["import * as vscode from 'vscode';", 'export function activate'],
  '.json': ['<!DOCTYPE html>'],
};

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

function assertExpectedSignatures(filePath, content) {
  const expected = expectedSignatures[filePath];
  if (!expected) {
    return;
  }

  for (const needle of expected) {
    if (!content.includes(needle)) {
      throw new Error(`Integrity signature missing in ${filePath}: expected to find ${JSON.stringify(needle)}`);
    }
  }
}

function assertForbiddenSignatures(filePath, content) {
  const extension = path.extname(filePath);
  const forbidden = forbiddenSignaturesByExtension[extension] ?? [];
  for (const needle of forbidden) {
    if (content.includes(needle)) {
      throw new Error(`Detected file-type corruption in ${filePath}: contains forbidden signature ${JSON.stringify(needle)}`);
    }
  }
}

const hashToFiles = new Map();
const errors = [];

for (const filePath of monitoredFiles) {
  try {
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

    assertExpectedSignatures(filePath, content);
    assertForbiddenSignatures(filePath, content);

    const fileHash = hash(content);
    const existing = hashToFiles.get(fileHash) ?? [];
    existing.push(filePath);
    hashToFiles.set(fileHash, existing);
  } catch (error) {
    errors.push(error.message);
  }
}

if (errors.length > 0) {
  throw new Error(`Integrity check failed:\n${errors.map((message) => `- ${message}`).join('\n')}`);
}

const duplicateGroups = Array.from(hashToFiles.values()).filter((group) => group.length > 1);

if (duplicateGroups.length > 0) {
  const details = duplicateGroups.map((group) => `- ${group.join(', ')}`).join('\n');
  throw new Error(
    `Detected identical content across monitored files. This usually means an accidental overwrite occurred:\n${details}`,
  );
}

console.log(`Integrity check passed for ${monitoredFiles.length} monitored files.`);