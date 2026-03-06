/**
 * Renders placeholders in agent prompt templates.
 * Supports {key} syntax with arbitrary context values.
 */
export class TemplateRenderer {
  /**
   * Replace all {placeholder} occurrences in template with values from context.
   * Backslashes in paths are converted to forward slashes for cross-platform compat.
   */
  render(template: string, context: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => {
      if (key in context) {
        return context[key]!.replace(/\\/g, '/');
      }
      return match; // leave unresolved placeholders as-is
    });
  }

  /**
   * Parse YAML frontmatter from a markdown file.
   * Returns {frontmatter, body} where frontmatter is key-value pairs.
   */
  parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const frontmatter: Record<string, string> = {};
    const lines = match[1]!.split(/\r?\n/);
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        frontmatter[key] = value;
      }
    }

    return { frontmatter, body: match[2]! };
  }
}
