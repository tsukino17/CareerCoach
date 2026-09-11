import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const scannedRoots = ['app', 'components', 'lib', 'next.config.mjs', 'tailwind.config.ts'];
const blockedPatterns = [
  'next/font/google',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];
const ignoredDirs = new Set(['node_modules', '.next', '.git']);
const ignoredFiles = new Set(['scripts/check-no-remote-fonts.mjs']);
const textExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.css', '.mdx']);

function extensionOf(filePath) {
  const dotIndex = filePath.lastIndexOf('.');
  return dotIndex >= 0 ? filePath.slice(dotIndex) : '';
}

function collectFiles(entryPath, files = []) {
  const relativePath = relative(root, entryPath);
  if (ignoredFiles.has(relativePath)) return files;

  const stat = statSync(entryPath);
  if (stat.isDirectory()) {
    const name = entryPath.split('/').pop();
    if (name && ignoredDirs.has(name)) return files;
    for (const child of readdirSync(entryPath)) {
      collectFiles(join(entryPath, child), files);
    }
    return files;
  }

  if (stat.isFile() && textExtensions.has(extensionOf(entryPath))) {
    files.push(entryPath);
  }
  return files;
}

const files = scannedRoots.flatMap((entry) => {
  try {
    return collectFiles(join(root, entry));
  } catch {
    return [];
  }
});

const violations = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of blockedPatterns) {
    if (content.includes(pattern)) {
      violations.push(`${relative(root, file)} uses ${pattern}`);
    }
  }
}

if (violations.length) {
  console.error('Remote Google Fonts are not allowed in runtime code.');
  console.error('Use the system font stack defined in app/globals.css instead.');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Remote font check passed.');
