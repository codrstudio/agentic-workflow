import type { Feature } from '../schemas/feature.js';

export class FeatureSelector {
  /**
   * Compute blocked status for all features based on dependency satisfaction.
   * A feature is blocked if any of its dependencies is not 'passing'.
   * Mutates the features array in place.
   */
  computeBlocked(features: Feature[]): void {
    const statusMap = new Map<string, string>();
    for (const f of features) {
      statusMap.set(f.id, f.status);
    }

    for (const f of features) {
      if (f.status === 'passing' || f.status === 'skipped' || f.status === 'exhausted') continue;

      const deps = f.dependencies ?? [];
      if (deps.length === 0) {
        if (f.status === 'blocked') {
          (f as Record<string, unknown>).status = 'pending';
        }
        continue;
      }

      const allDepsPassing = deps.every((depId) => {
        const depStatus = statusMap.get(depId);
        return depStatus === 'passing';
      });

      if (!allDepsPassing && f.status !== 'in_progress') {
        (f as Record<string, unknown>).status = 'blocked';
      } else if (allDepsPassing && f.status === 'blocked') {
        (f as Record<string, unknown>).status = 'pending';
      }
    }
  }

  /**
   * Select the next feature to work on.
   * Returns the lowest-priority eligible feature (status=pending|failing, all deps passing).
   * Returns null if no feature is eligible.
   */
  selectNextFeature(features: Feature[]): Feature | null {
    const eligible = features.filter((f) => {
      if (f.status !== 'pending' && f.status !== 'failing') return false;

      const deps = f.dependencies ?? [];
      if (deps.length === 0) return true;

      return deps.every((depId) => {
        const dep = features.find((d) => d.id === depId);
        return dep?.status === 'passing';
      });
    });

    if (eligible.length === 0) return null;

    // Sort by priority (lower = higher priority), then by id
    eligible.sort((a, b) => {
      const pa = (a as Record<string, unknown>).priority as number | undefined ?? 999;
      const pb = (b as Record<string, unknown>).priority as number | undefined ?? 999;
      if (pa !== pb) return pa - pb;
      return a.id.localeCompare(b.id);
    });

    return eligible[0]!;
  }

  /**
   * Count features by status.
   */
  countByStatus(features: Feature[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const f of features) {
      counts[f.status] = (counts[f.status] ?? 0) + 1;
    }
    return counts;
  }

  /**
   * Check if all remaining features are blocked with impossible dependencies.
   * This happens when all non-passing/non-skipped features are blocked.
   */
  hasImpossibleDeps(features: Feature[]): boolean {
    const remaining = features.filter(
      (f) => f.status !== 'passing' && f.status !== 'skipped' && f.status !== 'exhausted',
    );
    if (remaining.length === 0) return false;
    return remaining.every((f) => f.status === 'blocked');
  }
}
