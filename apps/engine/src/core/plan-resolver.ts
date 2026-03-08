import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { PlanSchema, TIER_MAP, type Plan, type TierSlug } from '../schemas/tier.js';

export class PlanResolver {
  async loadPlan(plansDir: string, slug: string): Promise<Plan> {
    const path = join(plansDir, `${slug}.yaml`);
    const raw = await readFile(path, 'utf-8');
    const parsed = parseYaml(raw);
    const result = PlanSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid plan "${slug}": ${result.error.message}`);
    }
    return result.data;
  }

  resolveTier(plan: Plan, taskSlug: string, attempt: number = 1): TierSlug {
    if (attempt > 1 && plan.escalation?.[taskSlug]) {
      return plan.escalation[taskSlug]!;
    }
    return plan.tiers[taskSlug] ?? 'balanced';
  }

  resolveModelEffort(plan: Plan, taskSlug: string, attempt: number = 1): { model: string; effort?: string } {
    const tier = this.resolveTier(plan, taskSlug, attempt);
    return TIER_MAP[tier];
  }
}
