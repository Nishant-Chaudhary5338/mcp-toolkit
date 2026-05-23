export function validateComponentName(name: string): { valid: boolean; suggestion?: string; error?: string } {
  if (name.includes('-')) {
    const suggestion = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return { valid: false, suggestion, error: `Component name "${name}" contains hyphens. Use "${suggestion}" instead.` };
  }
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    return { valid: false, error: `Component name "${name}" must be PascalCase.` };
  }
  return { valid: true };
}
