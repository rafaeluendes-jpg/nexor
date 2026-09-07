export interface RateLimitStore {
  incr(key: string, windowMs: number): Promise<number>;
}

/** Janela fixa simples em memoria: usada em teste e como reserva se o Redis cair. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  async incr(key: string, windowMs: number): Promise<number> {
    const agora = Date.now();
    const atual = this.hits.get(key);
    if (!atual || atual.resetAt <= agora) {
      this.hits.set(key, { count: 1, resetAt: agora + windowMs });
      return 1;
    }
    atual.count += 1;
    return atual.count;
  }
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * 60_000 },
  api: { limit: 300, windowMs: 60_000 },
  webhook: { limit: 1200, windowMs: 60_000 },
  attribution: { limit: 60, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const current = await store.incr(key, rule.windowMs);
  return { allowed: current <= rule.limit, current, limit: rule.limit };
}
