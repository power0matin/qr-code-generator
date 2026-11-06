import type { ApiDatabase } from './database-client.js';

export interface ApiRateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: Date;
}

interface RateLimitRow {
  readonly requestCount: number;
}

export async function consumeApiKeyRateLimit(
  database: ApiDatabase,
  apiKeyId: string,
  limit = 60,
  now = new Date(),
): Promise<ApiRateLimitResult> {
  const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const resetAt = new Date(windowStart.getTime() + 60_000);
  const rows = await database.unsafe(
    'INSERT INTO moduqr.api_rate_limit_windows (api_key_id, window_started_at, request_count) ' +
    'VALUES ($1::uuid, $2, 1) ' +
    'ON CONFLICT (api_key_id, window_started_at) DO UPDATE ' +
    'SET request_count = moduqr.api_rate_limit_windows.request_count + 1 ' +
    'RETURNING request_count AS "requestCount"',
    [apiKeyId, windowStart],
  ) as RateLimitRow[];

  const count = Number(rows[0]?.requestCount ?? limit + 1);
  await database.unsafe(
    'DELETE FROM moduqr.api_rate_limit_windows ' +
    'WHERE api_key_id = $1::uuid AND window_started_at < $2',
    [apiKeyId, new Date(now.getTime() - 2 * 60 * 60 * 1_000)],
  );

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}
