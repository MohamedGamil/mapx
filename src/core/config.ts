import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { CodeGraphConfig, RepoConfig, UserLanguageDefinition } from '../types.js';
import type { LanguageDefinition } from '../languages/registry.js';
import { getBuiltinLanguages } from '../languages/registry.js';

const DEFAULT_CONFIG: CodeGraphConfig = {
  version: '1.0.0',
  repos: [],
  languages: {},
  settings: {
    maxTokenBudget: 16384,
    excludePatterns: [
      'node_modules/**',
      'vendor/**',
      '.git/**',
      'dist/**',
      '.codegraph/**',
      '*.min.js',
      '*.min.css',
      'package-lock.json',
      'composer.lock',
    ],
    includePatterns: [],
  },
};

export class Config {
  private configPath: string;
  private config: CodeGraphConfig;

  private constructor(configPath: string, config: CodeGraphConfig) {
    this.configPath = configPath;
    this.config = config;
  }

  static async load(workspaceRoot: string): Promise<Config> {
    const configPath = join(workspaceRoot, '.codegraph', 'config.json');
    const codegraphDir = join(workspaceRoot, '.codegraph');

    if (!existsSync(configPath)) {
      await mkdir(codegraphDir, { recursive: true });
      const defaultConfig = {
        ...DEFAULT_CONFIG,
        repos: [{
          name: resolve(workspaceRoot).split('/').pop() || 'default',
          path: '.',
        }],
      };
      await writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return new Config(configPath, defaultConfig);
    }

    const data = await readFile(configPath, 'utf-8');
    const config = JSON.parse(data) as CodeGraphConfig;
    return new Config(configPath, config);
  }

  static async init(workspaceRoot: string, repoName?: string): Promise<Config> {
    const codegraphDir = join(workspaceRoot, '.codegraph');
    await mkdir(codegraphDir, { recursive: true });

    const config: CodeGraphConfig = {
      ...DEFAULT_CONFIG,
      repos: [{
        name: repoName || resolve(workspaceRoot).split('/').pop() || 'default',
        path: '.',
      }],
    };

    const configPath = join(codegraphDir, 'config.json');
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return new Config(configPath, config);
  }

  async save(): Promise<void> {
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get repos(): RepoConfig[] {
    return this.config.repos;
  }

  get settings() {
    return this.config.settings;
  }

  get languages(): Record<string, UserLanguageDefinition> {
    return this.config.languages;
  }

  getResolvedUserLanguages(): Record<string, LanguageDefinition> {
    const result: Record<string, LanguageDefinition> = {};
    const builtins = getBuiltinLanguages();

    for (const [name, userDef] of Object.entries(this.config.languages)) {
      if (builtins[name]) continue; // skip overrides for now
      result[name] = {
        name,
        extensions: userDef.extensions,
        grammarWasm: userDef.grammarWasm,
        queries: {
          symbols: userDef.queries.symbols || '',
          references: userDef.queries.references || '',
        },
        nodeMappings: userDef.nodeMappings as any,
        tier: 'user',
      };
    }

    return result;
  }

  addRepo(name: string, path: string): void {
    if (!this.config.repos.find(r => r.path === path)) {
      this.config.repos.push({ name, path });
    }
  }

  removeRepo(path: string): void {
    this.config.repos = this.config.repos.filter(r => r.path !== path);
  }

  getWorkspaceRoot(): string {
    return resolve(this.configPath, '..', '..');
  }

  get repo(): RepoConfig {
    return this.config.repos[0];
  }
}
