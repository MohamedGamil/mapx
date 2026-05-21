import { execSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';

export interface GitFileStatus {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'unchanged';
}

export interface GitBlobHash {
  path: string;
  hash: string;
}

export function getGitBlobHashes(repoRoot: string): Map<string, string> {
  const hashes = new Map<string, string>();
  try {
    const output = execSync('git ls-tree -r HEAD --name-only', {
      cwd: repoRoot,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });

    const files = output.trim().split('\n').filter(Boolean);
    for (const file of files) {
      try {
        const hashOutput = execSync(`git ls-tree HEAD -- "${file}"`, {
          cwd: repoRoot,
          encoding: 'utf-8',
        });
        const parts = hashOutput.trim().split(/\s+/);
        if (parts.length >= 3) {
          hashes.set(file, parts[2]);
        }
      } catch {
        // skip files that can't be hashed
      }
    }
  } catch {
    // not a git repo or no commits
  }
  return hashes;
}

export function getChangedFiles(repoRoot: string, since?: string): GitFileStatus[] {
  const changes: GitFileStatus[] = [];

  try {
    let command: string;
    if (since) {
      command = `git diff --name-status ${since}`;
    } else {
      command = 'git diff --name-status HEAD';
    }

    const output = execSync(command, {
      cwd: repoRoot,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });

    for (const line of output.trim().split('\n').filter(Boolean)) {
      const parts = line.split('\t');
      const status = parts[0].charAt(0);
      const filePath = parts[parts.length - 1];

      const statusMap: Record<string, GitFileStatus['status']> = {
        'A': 'added',
        'M': 'modified',
        'D': 'removed',
        'R': 'renamed',
        'C': 'modified',
      };

      changes.push({ path: filePath, status: statusMap[status] || 'modified' });
    }
  } catch {
    // no previous commit or not a git repo
  }

  try {
    const stagedOutput = execSync('git diff --name-status --cached', {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim();

    for (const line of stagedOutput.split('\n').filter(Boolean)) {
      const parts = line.split('\t');
      const status = parts[0].charAt(0);
      const filePath = parts[parts.length - 1];

      if (!changes.find(c => c.path === filePath)) {
        const statusMap: Record<string, GitFileStatus['status']> = {
          'A': 'added', 'M': 'modified', 'D': 'removed', 'R': 'renamed',
        };
        changes.push({ path: filePath, status: statusMap[status] || 'modified' });
      }
    }
  } catch {
    // no staged changes
  }

  return changes;
}

export function getCurrentCommitSha(repoRoot: string): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

export function getPreviousCommitSha(repoRoot: string): string | null {
  try {
    return execSync('git rev-parse HEAD~1', { cwd: repoRoot, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

export function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getRepoName(repoRoot: string): string {
  try {
    const remote = execSync('git remote get-url origin', { cwd: repoRoot, encoding: 'utf-8' }).trim();
    const basename = remote.split('/').pop() || 'unknown';
    return basename.replace(/\.git$/, '');
  } catch {
    return resolve(repoRoot).split('/').pop() || 'unknown';
  }
}
