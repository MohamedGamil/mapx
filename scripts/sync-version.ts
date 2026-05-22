#!/usr/bin/env tsx
/**
 * Sync the version from the root VERSION file into package.json.
 * Usage: tsx scripts/sync-version.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const versionFile = resolve(root, 'VERSION');
const pkgFile = resolve(root, 'package.json');

const version = readFileSync(versionFile, 'utf-8').trim();
const pkg = JSON.parse(readFileSync(pkgFile, 'utf-8'));

if (pkg.version === version) {
  console.log(`package.json already at version ${version}`);
} else {
  pkg.version = version;
  writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated package.json version to ${version}`);
}
