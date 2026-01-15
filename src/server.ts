/**
 * dooz-ai-router HTTP API Server
 * 
 * Provides stateless HTTP endpoints for centralized LLM routing.
 * This allows other Dooz apps (like dooz-brain) to use centralized routing.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRouterFromEnv, createRouter, LlmRouter } from './router';
import type { LlmRequest, RouterConfig, ProviderConfig, TaskType } from './types';

const app = new Hono();

// Enable CORS for cross-origin requests
app.use('/*', cors());

// Global router instance
let router: LlmRouter | null = null;

// Health check
app.get('/health', (c) => {
    return c.json({ status: 'ok', service: 'dooz-ai-router' });
});

// Get router status
app.get('/status', async (c) => {
    if (!router) {
        return c.json({ configured: false, providers: [] });
    }

    const availability = await router.checkAvailability();
    return c.json({
        configured: true,
        providers: Object.entries(availability).map(([type, available]) => ({
            type,
            available,
        })),
    });
});

// Configure router (sets up providers)
app.post('/configure', async (c) => {
    try {
        const config = await c.req.json<RouterConfig>();
        router = createRouter(config);
        return c.json({ success: true, message: 'Router configured' });
    } catch (error) {
        return c.json({ success: false, error: String(error) }, 500);
    }
});

// Complete (non-streaming) - main endpoint
app.post('/complete', async (c) => {
    if (!router) {
        // Try to auto-configure from env
        try {
            router = createRouterFromEnv();
        } catch {
            return c.json({
                success: false,
                error: 'Router not configured. Call POST /configure first or set environment variables.'
            }, 500);
        }
    }

    try {
        const request = await c.req.json<LlmRequest>();
        const response = await router.complete(request);
        return c.json({
            success: true,
            data: response,
        });
    } catch (error) {
        return c.json({
            success: false,
            error: String(error),
        }, 500);
    }
});

// List available models
app.get('/models', async (c) => {
    if (!router) {
        return c.json({ success: false, error: 'Router not configured' }, 500);
    }

    try {
        const models = await router.listAllModels();
        return c.json({ success: true, data: models });
    } catch (error) {
        return c.json({ success: false, error: String(error) }, 500);
    }
});

// Task routing endpoint for Brain integration
app.post('/route', async (c) => {
    if (!router) {
        try {
            router = createRouterFromEnv();
        } catch {
            return c.json({
                success: false,
                error: 'Router not configured'
            }, 500);
        }
    }

    try {
        const body = await c.req.json<{
            task_type: TaskType;
            prompt: string;
            system_prompt?: string;
            model?: string;
            temperature?: number;
            max_tokens?: number;
        }>();

        const request: LlmRequest = {
            messages: [
                ...(body.system_prompt ? [{ role: 'system' as const, content: body.system_prompt }] : []),
                { role: 'user' as const, content: body.prompt },
            ],
            taskType: body.task_type,
            model: body.model,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
        };

        const response = await router.complete(request);
        return c.json({
            success: true,
            data: {
                content: response.content,
                model: response.model,
                provider: response.provider,
                usage: response.usage,
                latency_ms: response.latencyMs,
            },
        });
    } catch (error) {
        return c.json({
            success: false,
            error: String(error),
        }, 500);
    }
});

export { app };

// Start server if run directly
const port = parseInt(process.env.AI_ROUTER_PORT || '5180');
console.log(`🤖 dooz-ai-router API starting on http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
