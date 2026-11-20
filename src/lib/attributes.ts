export interface AttributeRule {
  type: 'text' | 'number' | 'boolean' | 'enum'
  options?: string[]
  label?: string
}

/** Returns an error message, or null when the value is valid for the attribute definition. */
export function validateAttributeValue(rule: AttributeRule, raw: string): string | null {
  const value = raw.trim()
  const label = rule.label ?? 'This attribute'
  if (!value) return `${label} needs a value.`
  switch (rule.type) {
    case 'number':
      return Number.isFinite(Number(value)) ? null : `${label} must be a number.`
    case 'boolean':
      return value === 'true' || value === 'false' ? null : `${label} must be true or false.`
    case 'enum':
      return rule.options?.includes(value) ? null : `${label} must be one of: ${(rule.options ?? []).join(', ')}.`
    default:
      return value.length <= 200 ? null : `${label} must be 200 characters or fewer.`
  }
}
