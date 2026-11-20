import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres/drizzle'

export interface RateRule {
  /** Logical key including the subject, for example `rfq:ip:<hash>` */
  key: string
  limit: number
  windowSeconds: number
}

export interface RateDecision {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  rule?: RateRule
}

/** Fixed-window bucket id. Exported for tests. */
export function bucketId(rule: RateRule, nowMs: number): string {
  return `${rule.key}|${rule.windowSeconds}|${Math.floor(nowMs / (rule.windowSeconds * 1000))}`
}

export function retryAfter(rule: RateRule, nowMs: number): number {
  const windowMs = rule.windowSeconds * 1000
  return Math.max(1, Math.ceil((windowMs - (nowMs % windowMs)) / 1000))
}

/**
 * Atomically increments the counter for each rule and reports the first one exceeded.
 * Backed by the `rate_limits` table; one INSERT ... ON CONFLICT per rule, so it is safe under concurrency.
 */
export async function checkRateLimits(
  payload: Payload,
  rules: RateRule[],
  nowMs: number = Date.now(),
): Promise<RateDecision> {
  let minRemaining = Number.POSITIVE_INFINITY
  for (const rule of rules) {
    const id = bucketId(rule, nowMs)
    const res = (await payload.db.drizzle.execute(sql`
      INSERT INTO rate_limits (bucket, count, created_at, updated_at)
      VALUES (${id}, 1, now(), now())
      ON CONFLICT (bucket) DO UPDATE SET count = rate_limits.count + 1, updated_at = now()
      RETURNING count
    `)) as unknown as { rows: { count: number | string }[] }
    const count = Number(res.rows[0]?.count ?? 1)
    if (count > rule.limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter(rule, nowMs), rule }
    }
    minRemaining = Math.min(minRemaining, rule.limit - count)
  }
  return {
    allowed: true,
    remaining: Number.isFinite(minRemaining) ? minRemaining : 0,
    retryAfterSeconds: 0,
  }
}

/** Housekeeping: drop counters older than two days. Called from the cleanup cron. */
export async function purgeRateLimits(payload: Payload): Promise<number> {
  const res = (await payload.db.drizzle.execute(
    sql`DELETE FROM rate_limits WHERE updated_at < now() - interval '2 days'`,
  )) as unknown as { rowCount?: number }
  return res.rowCount ?? 0
}
