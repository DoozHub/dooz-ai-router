/**
 * dooz-ai-router HTTP API Server
 * 
 * Centralized LLM gateway for the Dooz ecosystem.
 * Provides provider discovery, task routing, and comprehensive logging.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRouterFromEnv, createRouter, LlmRouter } from './router';
import { configStore, generateLogId, type RequestLog } from './config';
import type { LlmRequest, ProviderType, TaskType } from './types';
import { createRateLimiter, RateLimitError } from './rate-limiter';

const app = new Hono();

// Enable CORS
app.use('/*', cors());

// Rate limiter instance (60 requests per minute)
const rateLimiter = createRateLimiter({
    maxRequests: 60,
    windowMs: 60000,
    perClient: true,
});

// Rate limiting middleware for AI endpoints
app.use('/complete', async (c, next) => {
    const clientId = c.req.header('X-Client-ID') || c.req.header('Authorization') || 'anonymous';

    if (!rateLimiter.isAllowed(clientId)) {
        const retryAfter = rateLimiter.getRetryAfter(clientId);
        c.header('Retry-After', String(Math.ceil(retryAfter / 1000)));
        c.header('X-RateLimit-Remaining', '0');
        return c.json({
            success: false,
            error: 'Rate limit exceeded',
            retry_after_ms: retryAfter,
        }, 429);
    }

    c.header('X-RateLimit-Remaining', String(rateLimiter.getRemaining(clientId)));
    await next();
});

app.use('/route', async (c, next) => {
    const clientId = c.req.header('X-Client-ID') || c.req.header('Authorization') || 'anonymous';

    if (!rateLimiter.isAllowed(clientId)) {
        const retryAfter = rateLimiter.getRetryAfter(clientId);
        c.header('Retry-After', String(Math.ceil(retryAfter / 1000)));
        c.header('X-RateLimit-Remaining', '0');
        return c.json({
            success: false,
            error: 'Rate limit exceeded',
            retry_after_ms: retryAfter,
        }, 429);
    }

    c.header('X-RateLimit-Remaining', String(rateLimiter.getRemaining(clientId)));
    await next();
});

// Global router instance
let router: LlmRouter | null = null;

// Initialize router from env
function ensureRouter(): LlmRouter {
    if (!router) {
        try {
            router = createRouterFromEnv();
        } catch (e) {
            throw new Error('Router not configured. Set OPENROUTER_API_KEY or OLLAMA_ENABLED=true');
        }
    }
    return router;
}

// =============================================================================
// HEALTH & STATUS
// =============================================================================

app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        service: 'dooz-ai-router',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

app.get('/status', async (c) => {
    try {
        const r = ensureRouter();
        const availability = await r.checkAvailability();
        const stats = configStore.getStats();

        return c.json({
            configured: true,
            providers: Object.entries(availability).map(([type, available]) => ({
                type,
                available,
            })),
            stats,
        });
    } catch (e) {
        return c.json({ configured: false, error: String(e) });
    }
});

// =============================================================================
// PROVIDER DISCOVERY
// =============================================================================

app.get('/providers', async (c) => {
    try {
        const r = ensureRouter();
        const availability = await r.checkAvailability();
        const allModels = await r.listAllModels();

        const providers = Object.entries(availability).map(([type, available]) => ({
            type,
            available,
            model_count: allModels[type as ProviderType]?.length || 0,
        }));

        return c.json({ success: true, data: providers });
    } catch (e) {
        return c.json({ success: false, error: String(e) }, 500);
    }
});

app.get('/providers/:type/models', async (c) => {
    const providerType = c.req.param('type') as ProviderType;

    try {
        const r = ensureRouter();
        const allModels = await r.listAllModels();
        const models = allModels[providerType] || [];

        // Separate free models (OpenRouter convention: ends with :free)
        const freeModels = models.filter(m => m.includes(':free'));
        const paidModels = models.filter(m => !m.includes(':free'));

        return c.json({
            success: true,
            data: {
                provider: providerType,
                models: paidModels,
                free_models: freeModels,
                total: models.length,
            }
        });
    } catch (e) {
        return c.json({ success: false, error: String(e) }, 500);
    }
});

app.get('/providers/:type/status', async (c) => {
    const providerType = c.req.param('type') as ProviderType;

    try {
        const r = ensureRouter();
        const start = Date.now();
        const availability = await r.checkAvailability();
        const latency = Date.now() - start;

        const available = availability[providerType] ?? false;

        return c.json({
            success: true,
            data: {
                provider: providerType,
                available,
                latency_ms: latency,
            }
        });
    } catch (e) {
        return c.json({ success: false, error: String(e) }, 500);
    }
});

// =============================================================================
// CONFIG MANAGEMENT
// =============================================================================

app.get('/config', (c) => {
    return c.json({ success: true, data: configStore.getConfig() });
});

app.post('/config', async (c) => {
    try {
        const updates = await c.req.json();
        const newConfig = configStore.updateConfig(updates);
        return c.json({ success: true, data: newConfig });
    } catch (e) {
        return c.json({ success: false, error: String(e) }, 500);
    }
});

// =============================================================================
// LOGGING
// =============================================================================

app.get('/logs', (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const logs = configStore.getLogs(limit);
    const stats = configStore.getStats();

    return c.json({ success: true, data: { logs, stats } });
});

app.get('/logs/:id', (c) => {
    const id = c.req.param('id');
    const log = configStore.getLogById(id);

    if (!log) {
        return c.json({ success: false, error: 'Log not found' }, 404);
    }

    return c.json({ success: true, data: log });
});

app.delete('/logs', (c) => {
    configStore.clearLogs();
    return c.json({ success: true, message: 'Logs cleared' });
});

// =============================================================================
// COMPLETION ENDPOINTS
// =============================================================================

app.post('/complete', async (c) => {
    const startTime = Date.now();
    const logId = generateLogId();

    try {
        const r = ensureRouter();
        const body = await c.req.json<{
            messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
            provider?: ProviderType;
            model?: string;
            task_type?: TaskType;
            temperature?: number;
            max_tokens?: number;
        }>();

        // Build request
        const request: LlmRequest = {
            messages: body.messages,
            model: body.model,
            taskType: body.task_type,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
        };

        // Get prompt preview for logging
        const lastUserMsg = body.messages.filter(m => m.role === 'user').pop();
        const promptPreview = lastUserMsg?.content.slice(0, 100) + (lastUserMsg && lastUserMsg.content.length > 100 ? '...' : '');

        // Execute
        const response = await r.complete(request);
        const duration = Date.now() - startTime;

        // Log request
        const log: RequestLog = {
            id: logId,
            timestamp: new Date().toISOString(),
            method: 'complete',
            request: {
                provider: body.provider,
                model: body.model,
                task_type: body.task_type,
                prompt_preview: promptPreview || '',
                temperature: body.temperature,
                max_tokens: body.max_tokens,
            },
            response: {
                provider: response.provider,
                model: response.model,
                content_preview: response.content.slice(0, 200) + (response.content.length > 200 ? '...' : ''),
                tokens: response.usage ? {
                    prompt: response.usage.promptTokens,
                    completion: response.usage.completionTokens,
                    total: response.usage.totalTokens,
                } : undefined,
                latency_ms: response.latencyMs,
            },
            duration_ms: duration,
        };
        configStore.addLog(log);

        console.log(`[ai-router] ${logId} | ${response.provider}/${response.model} | ${duration}ms`);

        return c.json({
            success: true,
            data: {
                content: response.content,
                provider: response.provider,
                model: response.model,
                usage: response.usage,
                latency_ms: response.latencyMs,
            },
            log_id: logId,
        });
    } catch (e) {
        const duration = Date.now() - startTime;

        // Log error
        const log: RequestLog = {
            id: logId,
            timestamp: new Date().toISOString(),
            method: 'complete',
            request: { prompt_preview: '(error before parsing)' },
            error: String(e),
            duration_ms: duration,
        };
        configStore.addLog(log);

        console.error(`[ai-router] ${logId} | ERROR | ${duration}ms | ${e}`);

        return c.json({ success: false, error: String(e), log_id: logId }, 500);
    }
});

// Task-based routing endpoint
app.post('/route', async (c) => {
    const startTime = Date.now();
    const logId = generateLogId();

    try {
        const r = ensureRouter();
        const body = await c.req.json<{
            task_type: TaskType;
            prompt: string;
            system_prompt?: string;
            model?: string;
            temperature?: number;
            max_tokens?: number;
        }>();

        // Get route config for task
        const route = configStore.getRouteForTask(body.task_type);
        const effectiveModel = body.model || route?.model;

        const request: LlmRequest = {
            messages: [
                ...(body.system_prompt ? [{ role: 'system' as const, content: body.system_prompt }] : []),
                { role: 'user' as const, content: body.prompt },
            ],
            taskType: body.task_type,
            model: effectiveModel,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
        };

        const response = await r.complete(request);
        const duration = Date.now() - startTime;

        // Log
        const log: RequestLog = {
            id: logId,
            timestamp: new Date().toISOString(),
            method: 'route',
            request: {
                task_type: body.task_type,
                model: effectiveModel,
                prompt_preview: body.prompt.slice(0, 100) + (body.prompt.length > 100 ? '...' : ''),
                temperature: body.temperature,
                max_tokens: body.max_tokens,
            },
            response: {
                provider: response.provider,
                model: response.model,
                content_preview: response.content.slice(0, 200) + (response.content.length > 200 ? '...' : ''),
                tokens: response.usage ? {
                    prompt: response.usage.promptTokens,
                    completion: response.usage.completionTokens,
                    total: response.usage.totalTokens,
                } : undefined,
                latency_ms: response.latencyMs,
            },
            duration_ms: duration,
        };
        configStore.addLog(log);

        console.log(`[ai-router] ${logId} | ROUTE:${body.task_type} | ${response.provider}/${response.model} | ${duration}ms`);

        return c.json({
            success: true,
            data: {
                content: response.content,
                provider: response.provider,
                model: response.model,
                task_type: body.task_type,
                usage: response.usage,
                latency_ms: response.latencyMs,
            },
            log_id: logId,
        });
    } catch (e) {
        const duration = Date.now() - startTime;

        const log: RequestLog = {
            id: logId,
            timestamp: new Date().toISOString(),
            method: 'route',
            request: { prompt_preview: '(error before parsing)' },
            error: String(e),
            duration_ms: duration,
        };
        configStore.addLog(log);

        console.error(`[ai-router] ${logId} | ROUTE ERROR | ${duration}ms | ${e}`);

        return c.json({ success: false, error: String(e), log_id: logId }, 500);
    }
});

// =============================================================================
// CONFIGURE ROUTER
// =============================================================================

app.post('/configure', async (c) => {
    try {
        const body = await c.req.json();
        router = createRouter(body);
        return c.json({ success: true, message: 'Router configured' });
    } catch (e) {
        return c.json({ success: false, error: String(e) }, 500);
    }
});

// =============================================================================
// EXPORT
// =============================================================================

export { app };

const port = parseInt(process.env.AI_ROUTER_PORT || '5181');
console.log(`🤖 dooz-ai-router API starting on http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
