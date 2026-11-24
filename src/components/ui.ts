export const cn = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'quiet'

const base =
  'target inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-base font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900 hover:text-white',
  secondary:
    'border-2 border-brand-800 bg-white text-brand-800 hover:bg-brand-50 hover:text-brand-900',
  quiet: 'text-brand-800 underline hover:bg-brand-50',
}

/** Class names for buttons and button-styled links. */
export const buttonClass = (variant: Variant = 'primary', extra?: string): string =>
  cn(base, variants[variant], extra)

export const inputClass =
  'target block w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-base text-ink placeholder:text-slate-500'

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}
