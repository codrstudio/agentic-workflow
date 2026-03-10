/**
 * ACR Injector — fetches active Architectural Constraint Records from the hub
 * and formats them as a prompt section for agent spawns.
 */

export interface ACRContextResponse {
  acrs: Array<{
    slug: string;
    title: string;
    category: string;
    constraint: string;
    rationale: string;
  }>;
  violations_summary: {
    open: number;
    accepted: number;
  };
}

export class AcrInjector {
  private readonly hubBaseUrl: string;

  constructor(hubBaseUrl?: string) {
    this.hubBaseUrl = hubBaseUrl ?? process.env.AW_WEB_URL ?? 'http://localhost:3000';
  }

  /**
   * Fetch ACR context from the hub and return a formatted prompt section.
   * Returns empty string if no active ACRs or if the hub is unreachable.
   */
  async buildSection(projectSlug: string): Promise<string> {
    if (!projectSlug) return '';

    let data: ACRContextResponse;
    try {
      data = await this.fetchContext(projectSlug);
    } catch {
      // Hub unreachable or error — silently skip ACR injection
      return '';
    }

    if (!data.acrs || data.acrs.length === 0) return '';

    return this.formatSection(data);
  }

  private async fetchContext(projectSlug: string): Promise<ACRContextResponse> {
    const url = `${this.hubBaseUrl}/api/v1/hub/projects/${encodeURIComponent(projectSlug)}/acrs/context`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`ACR context fetch failed: ${response.status}`);
    }

    return response.json() as Promise<ACRContextResponse>;
  }

  private formatSection(data: ACRContextResponse): string {
    const lines: string[] = [
      '\n\n## Architectural Constraints (ACRs Ativas)',
      '',
      'Os seguintes constraints arquiteturais DEVEM ser respeitados em qualquer codigo gerado:',
      '',
    ];

    for (const acr of data.acrs) {
      lines.push(`[${acr.slug}] [${acr.category}] ${acr.title}`);
      lines.push(`Constraint: ${acr.constraint}`);
      lines.push(`Rationale: ${acr.rationale}`);
      lines.push('');
    }

    const { open, accepted } = data.violations_summary;
    if (open > 0 || accepted > 0) {
      lines.push('---');
      lines.push('');
      lines.push(`Violacoes abertas: ${open} open, ${accepted} accepted. Evite adicionar novas violacoes.`);
    }

    return lines.join('\n');
  }
}
