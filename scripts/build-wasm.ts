import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const WASM_DIR = join(PROJECT_ROOT, 'wasm');

const GRAMMARS = [
  { name: 'tree-sitter-php', files: ['tree-sitter-php.wasm'] },
  { name: 'tree-sitter-javascript', files: ['tree-sitter-javascript.wasm'] },
  { name: 'tree-sitter-typescript', files: ['tree-sitter-typescript.wasm', 'tree-sitter-tsx.wasm'] },
  { name: 'tree-sitter-python', files: ['tree-sitter-python.wasm'] },
  { name: 'tree-sitter-go', files: ['tree-sitter-go.wasm'] },
  { name: 'tree-sitter-rust', files: ['tree-sitter-rust.wasm'] },
  { name: 'tree-sitter-java', files: ['tree-sitter-java.wasm'] },
  { name: 'tree-sitter-c-sharp', files: ['tree-sitter-c_sharp.wasm'] },
];

function findWasmFiles(): Map<string, string> {
  const found = new Map<string, string>();
  const nmDir = join(PROJECT_ROOT, 'node_modules');

  for (const grammar of GRAMMARS) {
    for (const file of grammar.files) {
      const paths = [
        join(nmDir, grammar.name, file),
        join(nmDir, grammar.name, 'wasm', file),
        join(nmDir, grammar.name, 'bindgen', file),
        join(nmDir, grammar.name, 'build', file),
      ];

      for (const p of paths) {
        if (existsSync(p)) {
          found.set(file, p);
          break;
        }
      }
    }
  }

  return found;
}

console.log('Building WASM grammars...');
mkdirSync(WASM_DIR, { recursive: true });

const found = findWasmFiles();

if (found.size === 0) {
  console.log('No pre-built WASM files found. Attempting to build...');

  for (const grammar of GRAMMARS) {
    try {
      const grammarDir = join(PROJECT_ROOT, 'node_modules', grammar.name);
      if (!existsSync(grammarDir)) {
        console.log(`  Skipping ${grammar.name} (not installed)`);
        continue;
      }

      console.log(`  Building ${grammar.name}...`);
      execSync(`npx tree-sitter build --wasm ${grammarDir}`, {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
      });

      for (const file of grammar.files) {
        const src = join(PROJECT_ROOT, file);
        if (existsSync(src)) {
          const dest = join(WASM_DIR, file);
          execSync(`mv ${src} ${dest}`, { cwd: PROJECT_ROOT });
          console.log(`  Moved ${file} to wasm/`);
        }
      }
    } catch (e: any) {
      console.log(`  Failed to build ${grammar.name}: ${e.message}`);
    }
  }
} else {
  for (const [file, src] of found) {
    const dest = join(WASM_DIR, file);
    if (!existsSync(dest)) {
      execSync(`cp "${src}" "${dest}"`, { cwd: PROJECT_ROOT });
      console.log(`  Copied ${file} from ${src}`);
    } else {
      console.log(`  ${file} already exists`);
    }
  }
}

const existing = execSync(`ls -la ${WASM_DIR}`, { encoding: 'utf-8' });
console.log(`\nWASM directory contents:\n${existing}`);
