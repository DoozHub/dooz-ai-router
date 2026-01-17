/**
 * @dooz/ai-router - Rate Limiter
 * 
 * Token bucket rate limiter for AI endpoints.
 * Addresses AI-004: No rate limiting on AI endpoints.
 */

export interface RateLimitConfig {
    /** Requests per window */
    maxRequests: number;
    /** Window duration in ms */
    windowMs: number;
    /** Per-client limits (keyed by client ID) */
    perClient?: boolean;
    /** Global limit (shared across all clients) */
    globalLimit?: number;
}

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

/**
 * Token bucket rate limiter
 */
export class RateLimiter {
    private buckets: Map<string, TokenBucket> = new Map();
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = {
            maxRequests: config.maxRequests || 60,
            windowMs: config.windowMs || 60000,
            perClient: config.perClient ?? true,
            globalLimit: config.globalLimit,
        };
    }

    /**
     * Check if request is allowed
     */
    isAllowed(clientId: string = 'global'): boolean {
        const key = this.config.perClient ? clientId : 'global';
        const now = Date.now();

        let bucket = this.buckets.get(key);

        if (!bucket) {
            bucket = {
                tokens: this.config.maxRequests,
                lastRefill: now,
            };
            this.buckets.set(key, bucket);
        }

        // Refill tokens based on time passed
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(
            (timePassed / this.config.windowMs) * this.config.maxRequests
        );

        if (tokensToAdd > 0) {
            bucket.tokens = Math.min(
                this.config.maxRequests,
                bucket.tokens + tokensToAdd
            );
            bucket.lastRefill = now;
        }

        // Check if request is allowed
        if (bucket.tokens > 0) {
            bucket.tokens--;
            return true;
        }

        return false;
    }

    /**
     * Get remaining tokens for a client
     */
    getRemaining(clientId: string = 'global'): number {
        const key = this.config.perClient ? clientId : 'global';
        const bucket = this.buckets.get(key);
        return bucket?.tokens ?? this.config.maxRequests;
    }

    /**
     * Get time until next token is available (in ms)
     */
    getRetryAfter(clientId: string = 'global'): number {
        const key = this.config.perClient ? clientId : 'global';
        const bucket = this.buckets.get(key);

        if (!bucket || bucket.tokens > 0) {
            return 0;
        }

        // Calculate time until 1 token is refilled
        const tokenRefillTime = this.config.windowMs / this.config.maxRequests;
        const timeSinceRefill = Date.now() - bucket.lastRefill;

        return Math.max(0, tokenRefillTime - timeSinceRefill);
    }

    /**
     * Reset limits for a client
     */
    reset(clientId: string = 'global'): void {
        const key = this.config.perClient ? clientId : 'global';
        this.buckets.delete(key);
    }

    /**
     * Clear all buckets
     */
    clear(): void {
        this.buckets.clear();
    }
}

/**
 * Create a rate limiter with sensible defaults
 */
export function createRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
    return new RateLimiter({
        maxRequests: config?.maxRequests ?? 60,
        windowMs: config?.windowMs ?? 60000,
        perClient: config?.perClient ?? true,
        globalLimit: config?.globalLimit,
    });
}

/**
 * Rate limit error with retry info
 */
export class RateLimitError extends Error {
    public readonly retryAfterMs: number;
    public readonly remaining: number;

    constructor(retryAfterMs: number, remaining: number = 0) {
        super(`Rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`);
        this.name = 'RateLimitError';
        this.retryAfterMs = retryAfterMs;
        this.remaining = remaining;
    }
}
