const DEFAULT_MODEL = 'claude-sonnet-4-6';

interface StepOverride {
  model: string;
  model_fallback?: string;
}

interface PhaseModelConfigResponse {
  step_overrides?: Record<string, StepOverride>;
}

export interface ResolveModelOptions {
  stepModel?: string;
  profileModel?: string;
  stepName: string;
  projectSlug?: string;
  workflowSlug?: string;
}

/**
 * Resolves the model to use for a spawn with 4 levels of precedence:
 * 1. PhaseModelConfig.step_overrides[step_name].model (from API, cached per execution)
 * 2. WorkflowStep.model (from YAML)
 * 3. AgentProfile.model (from agent frontmatter)
 * 4. 'claude-sonnet-4-6' (hardcoded default)
 *
 * process.env.MODEL always overrides all levels (escape hatch).
 */
export class ModelResolver {
  private cache = new Map<string, Record<string, StepOverride>>();

  async resolve(opts: ResolveModelOptions): Promise<string> {
    // Env escape hatch takes top priority
    if (process.env.MODEL) return process.env.MODEL;

    // Level 1: PhaseModelConfig API override
    if (opts.projectSlug && opts.workflowSlug) {
      const overrides = await this.fetchOverrides(opts.projectSlug, opts.workflowSlug);
      const override = overrides[opts.stepName];
      if (override?.model) return override.model;
    }

    // Level 2: YAML step model
    if (opts.stepModel) return opts.stepModel;

    // Level 3: Agent profile model
    if (opts.profileModel) return opts.profileModel;

    // Level 4: Default
    return DEFAULT_MODEL;
  }

  private async fetchOverrides(
    projectSlug: string,
    workflowSlug: string,
  ): Promise<Record<string, StepOverride>> {
    const cacheKey = `${projectSlug}/${workflowSlug}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const hubUrl = process.env.HUB_URL ?? 'http://localhost:3001';
    try {
      const resp = await fetch(
        `${hubUrl}/api/v1/hub/projects/${projectSlug}/phase-model-configs/${workflowSlug}`,
      );
      if (!resp.ok) {
        this.cache.set(cacheKey, {});
        return {};
      }
      const data = (await resp.json()) as PhaseModelConfigResponse;
      const overrides = data.step_overrides ?? {};
      this.cache.set(cacheKey, overrides);
      return overrides;
    } catch {
      // Server not available or other error — fall through gracefully
      this.cache.set(cacheKey, {});
      return {};
    }
  }
}
