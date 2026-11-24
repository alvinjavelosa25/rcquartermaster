/** Pure helpers for category paths and slugs. */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function buildCategoryPath(parentPath: string | null | undefined, slug: string): string {
  return parentPath ? `${parentPath}/${slug}` : slug
}

export function depthOfPath(path: string): number {
  return path.split('/').length
}

/** Normalise a SKU: trim, collapse inner whitespace, uppercase. */
export function normalizeSku(sku: string): string {
  return sku.trim().replace(/\s+/g, '-').toUpperCase()
}

export const MAX_CATEGORY_DEPTH = 4
