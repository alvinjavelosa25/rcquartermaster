import { randomInt } from 'node:crypto'

/** Crockford-style base32 without I, L, O, U to avoid look-alikes when read over the phone. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789'

export const REFERENCE_RE = /^RCQ-\d{6}-[A-HJKMNP-TV-Z0-9]{6}$/

/** `RCQ-YYYYMM-XXXXXX`: month prefix for humans, 6 random characters so references cannot be guessed or counted. */
export function generateReference(
  now: Date = new Date(),
  random: (max: number) => number = (max) => randomInt(max),
): string {
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += ALPHABET[random(ALPHABET.length)]
  return `RCQ-${ym}-${suffix}`
}
