import { execSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
}

export class WorktreeManager {
  constructor(private repoRoot: string) {}

  /**
   * Create a new git worktree at the given path with an associated branch.
   */
  create(worktreePath: string, branchName: string, baseBranch?: string): WorktreeInfo {
    const baseRef = baseBranch ?? 'HEAD';

    // Check if the branch already exists (e.g. from a prior attempt that crashed).
    // If so, reuse it; otherwise create a new branch.
    const branchExists = (() => {
      try {
        const out = execSync(`git branch --list "${branchName}"`, { cwd: this.repoRoot, encoding: 'utf-8' });
        return out.trim().length > 0;
      } catch { return false; }
    })();

    if (branchExists) {
      // Prune stale worktree registrations (path may be missing from a prior crashed attempt)
      try { execSync('git worktree prune', { cwd: this.repoRoot, stdio: 'pipe' }); } catch { /* best effort */ }
      execSync(
        `git worktree add "${worktreePath}" "${branchName}"`,
        { cwd: this.repoRoot, stdio: 'pipe' },
      );
    } else {
      execSync(
        `git worktree add -b "${branchName}" "${worktreePath}" ${baseRef}`,
        { cwd: this.repoRoot, stdio: 'pipe' },
      );
    }

    const head = execSync('git rev-parse HEAD', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();

    return { path: worktreePath, branch: branchName, head, bare: false };
  }

  /**
   * Remove a worktree and optionally its branch.
   */
  async remove(worktreePath: string, branchName: string, deleteBranch = true): Promise<void> {
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: this.repoRoot,
        stdio: 'pipe',
      });
    } catch {
      // If git worktree remove fails, try manual cleanup
      try {
        await rm(worktreePath, { recursive: true, force: true });
        execSync('git worktree prune', {
          cwd: this.repoRoot,
          stdio: 'pipe',
        });
      } catch {
        // Best effort
      }
    }

    if (deleteBranch) {
      try {
        execSync(`git branch -D "${branchName}"`, {
          cwd: this.repoRoot,
          stdio: 'pipe',
        });
      } catch {
        // Branch may not exist
      }
    }
  }

  /**
   * List all worktrees.
   */
  list(): WorktreeInfo[] {
    const output = execSync('git worktree list --porcelain', {
      cwd: this.repoRoot,
      encoding: 'utf-8',
    });

    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as WorktreeInfo);
        current = { path: line.slice(9), bare: false };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        current.bare = true;
      }
    }

    if (current.path) worktrees.push(current as WorktreeInfo);
    return worktrees;
  }

  /**
   * Merge a worktree branch back into the parent branch.
   */
  merge(branchName: string, targetBranch?: string): string {
    const target = targetBranch ?? this.getCurrentBranch();

    execSync(`git merge "${branchName}" --no-edit`, {
      cwd: this.repoRoot,
      stdio: 'pipe',
    });

    return `Merged ${branchName} into ${target}`;
  }

  private getCurrentBranch(): string {
    return execSync('git branch --show-current', {
      cwd: this.repoRoot,
      encoding: 'utf-8',
    }).trim();
  }
}
