import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { FrameworkDetector, RouteBinding, ScanContext } from '../../types.js';

export class VueRouterDetector implements FrameworkDetector {
  readonly name = 'vue-router';
  readonly language = 'typescript';
  readonly filePattern = /\.(js|ts|vue)$/;

  async detect(projectRoot: string, files: string[]): Promise<boolean> {
    const packageJsonPath = join(projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps && (deps['vue-router'] || deps['vue'])) {
          return true;
        }
      } catch {
        // Ignored
      }
    }
    return false;
  }

  async extractRoutes(filePath: string, content: string, ctx: ScanContext): Promise<RouteBinding[]> {
    const routes: RouteBinding[] = [];

    if (!content.includes('VueRouter') && !content.includes('createRouter') && !content.includes('routes')) {
      return [];
    }

    // Locate "routes: [" or "routes = [" or type-annotated declarations
    let index = 0;
    while (true) {
      const match = content.substring(index).match(/\broutes(?:\s*:[^=]+)?\s*[=:]\s*\[/);
      if (!match) break;

      const startOfArray = index + match.index! + match[0].length - 1;
      const arrayObj = getBracketedContent(content, startOfArray);
      if (!arrayObj) {
        index = startOfArray + 1;
        continue;
      }

      const parsedRoutes = this.parseRoutesArray(arrayObj.content, filePath, ctx);
      routes.push(...parsedRoutes);

      index = arrayObj.endIndex;
    }

    return routes;
  }

  private parseRoutesArray(content: string, filePath: string, ctx: ScanContext, prefixParts: string[] = []): RouteBinding[] {
    const routes: RouteBinding[] = [];
    let index = 0;

    while (index < content.length) {
      const startOfBrace = content.indexOf('{', index);
      if (startOfBrace === -1) break;

      const obj = getBracedContent(content, startOfBrace);
      if (!obj) {
        index = startOfBrace + 1;
        continue;
      }

      // Parse current route object
      const objBody = obj.content;
      const pathMatch = objBody.match(/\bpath\s*:\s*['"]([^'"]*)['"]/);
      const pathVal = pathMatch ? pathMatch[1] : '';

      // Try matching standard component: Home or component: () => import('./Home.vue')
      const compMatch = objBody.match(/\bcomponent\s*:\s*([a-zA-Z0-9_]+)/);
      const importMatch = objBody.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      const requireMatch = objBody.match(/require\s*\(\s*(?:\[\s*)?['"]([^'"]+)['"]/);

      let componentSymbol = compMatch ? compMatch[1] : undefined;
      let resolvedFile = filePath;

      if (importMatch || requireMatch) {
        const importPath = importMatch ? importMatch[1] : requireMatch![1];
        if (importPath.startsWith('.')) {
          // Resolve relative component path
          resolvedFile = join(dirname(filePath), importPath);
        }
        // Use filename or final path part as component symbol representation
        componentSymbol = importPath.split('/').pop()?.replace(/\.[a-zA-Z0-9]+$/, '') || 'Component';
      } else if (componentSymbol) {
        const resolvedPath = ctx.resolveSymbolToFile(componentSymbol);
        if (resolvedPath) {
          resolvedFile = resolvedPath;
        }
      }

      const cleanParentPrefix = prefixParts.map(p => p.replace(/^\/|\/$/g, '')).filter(Boolean);
      const cleanPath = pathVal.replace(/^\/|\/$/g, '');
      const fullPath = '/' + [...cleanParentPrefix, cleanPath].filter(Boolean).join('/');

      if (componentSymbol || objBody.includes('children')) {
        routes.push({
          framework: this.name,
          method: 'GET',
          path: fullPath,
          handlerFile: resolvedFile,
          handlerSymbol: componentSymbol || 'Component',
          metadata: {
            confidence: 'inferred',
            routeType: 'client',
          },
        });
      }

      // Recursively parse children if present
      const childrenMatch = objBody.match(/\bchildren\s*:\s*\[/);
      if (childrenMatch) {
        const childrenStart = objBody.indexOf('children') + childrenMatch[0].length - 1;
        const childrenArray = getBracketedContent(objBody, childrenStart);
        if (childrenArray) {
          const childRoutes = this.parseRoutesArray(childrenArray.content, filePath, ctx, [...prefixParts, pathVal]);
          routes.push(...childRoutes);
        }
      }

      index = obj.endIndex;
    }

    return routes;
  }
}

function getBracketedContent(str: string, startIndex: number): { content: string, endIndex: number } | null {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escape = false;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (inString) {
      if (char === stringChar) {
        inString = false;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    if (char === '[') {
      depth++;
      if (depth === 1) {
        startIndex = i + 1;
      }
    } else if (char === ']') {
      depth--;
      if (depth === 0) {
        return {
          content: str.substring(startIndex, i),
          endIndex: i + 1
        };
      }
    }
  }
  return null;
}

function getBracedContent(str: string, startIndex: number): { content: string, endIndex: number } | null {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escape = false;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (inString) {
      if (char === stringChar) {
        inString = false;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    if (char === '{') {
      depth++;
      if (depth === 1) {
        startIndex = i + 1;
      }
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: str.substring(startIndex, i),
          endIndex: i + 1
        };
      }
    }
  }
  return null;
}
