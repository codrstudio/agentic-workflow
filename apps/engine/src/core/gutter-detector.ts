import { execSync } from 'node:child_process';
import type { Feature } from '../schemas/feature.js';

export type RollbackMode = 'stash' | 'reset' | 'none';

export interface GutterAction {
  action: 'retry' | 'rollback_and_retry' | 'skip' | 'exhaust';
  reason: string;
  rollbackResult?: string;
}

export class GutterDetector {
  /**
   * Determine the gutter action based on retry count and max retries.
   *
   * Escalation tiers:
   * - retries < maxRetries: simple retry
   * - retries === maxRetries: rollback + context rotation
   * - retries >= maxRetries * 2: permanent skip
   */
  evaluate(retries: number, maxRetries: number, autoRejected?: boolean): GutterAction {
    if (autoRejected) {
      return {
        action: 'skip',
        reason: 'Feature auto-rejected by contribution quality gate (score < auto_reject_below)',
      };
    }

    if (retries >= maxRetries * 2) {
      return {
        action: 'exhaust',
        reason: `Exceeded ${maxRetries * 2} retries, marking as exhausted`,
      };
    }

    if (retries >= maxRetries) {
      return {
        action: 'rollback_and_retry',
        reason: `Hit ${maxRetries} retries, rolling back and rotating context`,
      };
    }

    return {
      action: 'retry',
      reason: `Retry ${retries + 1}/${maxRetries}`,
    };
  }

  /**
   * Execute a git rollback operation in the given workspace.
   */
  executeRollback(mode: RollbackMode, featureId: string, workspace: string): string {
    if (mode === 'none') {
      return 'rollback: none (skipped)';
    }

    try {
      if (mode === 'stash') {
        execSync(
          `git stash push -m "gutter-rollback-${featureId}-${Date.now()}"`,
          { cwd: workspace, stdio: 'pipe' },
        );
        return 'rollback: stashed changes';
      }

      if (mode === 'reset') {
        execSync('git reset --hard HEAD', {
          cwd: workspace,
          stdio: 'pipe',
        });
        return 'rollback: reset to HEAD';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `rollback: failed (${msg})`;
    }

    return 'rollback: unknown mode';
  }

  /**
   * Apply gutter action to a feature.
   * Mutates the feature in place.
   */
  applyAction(
    feature: Feature,
    gutterAction: GutterAction,
    rollbackMode: RollbackMode,
    workspace: string,
  ): void {
    const f = feature as Record<string, unknown>;

    if (gutterAction.action === 'skip') {
      f.status = 'skipped';
      f.skip_reason = gutterAction.reason;
      return;
    }

    if (gutterAction.action === 'exhaust') {
      f.status = 'exhausted';
      f.exhausted_reason = gutterAction.reason;
      return;
    }

    if (gutterAction.action === 'rollback_and_retry') {
      const result = this.executeRollback(rollbackMode, feature.id, workspace);
      gutterAction.rollbackResult = result;
      // Keep status as failing for next retry
      return;
    }

    // Simple retry: no changes needed, feature stays failing
  }
}
