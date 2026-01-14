/**
 * @dooz/ai-router
 * 
 * Multi-provider LLM router with smart routing and fallback support.
 * 
 * @example
 * ```typescript
 * import { createRouter } from '@dooz/ai-router';
 * 
 * const router = createRouter({
 *   providers: [
 *     { type: 'openrouter', apiKey: process.env.OPENROUTER_API_KEY },
 *     { type: 'ollama', baseUrl: 'http://localhost:11434' },
 *   ],
 *   defaultProvider: 'openrouter',
 *   fallbackChain: ['ollama'],
 *   smartRouting: true,
 * });
 * 
 * const response = await router.complete({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   taskType: 'general',
 * });
 * ```
 */

// Types
export type {
    TaskType,
    ProviderType,
    LlmMessage,
    LlmRequest,
    LlmResponse,
    StreamChunk,
    ProviderConfig,
    RouterConfig,
    LlmProvider,
} from './types';

// Router
export { LlmRouter, createRouter, createRouterFromEnv } from './router';

// Providers (for direct use if needed)
export { BaseProvider, OpenRouterProvider, OllamaProvider } from './providers';
