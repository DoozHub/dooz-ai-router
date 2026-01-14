/**
 * @dooz/ai-router - Type Definitions
 * 
 * Core types for the multi-provider LLM router.
 */

import { z } from 'zod';

// =============================================================================
// TASK TYPES - Used for smart routing
// =============================================================================

export const TaskType = z.enum([
    'extraction',     // Chat/document parsing, entity extraction
    'summarization',  // Content summarization
    'comparison',     // Diff analysis, comparing options
    'risk_analysis',  // Risk detection and assessment
    'code_generation',// Code writing and editing
    'reasoning',      // Complex reasoning tasks
    'general',        // Default/fallback
]);
export type TaskType = z.infer<typeof TaskType>;

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export const ProviderType = z.enum([
    'openrouter',
    'ollama',
    'openai',
    'anthropic',
    'gemini',
]);
export type ProviderType = z.infer<typeof ProviderType>;

// =============================================================================
// REQUEST/RESPONSE TYPES
// ============================ =================================================

export interface LlmMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LlmRequest {
    /** Messages in chat format */
    messages: LlmMessage[];
    /** Optional system prompt (prepended to messages) */
    systemPrompt?: string;
    /** Specific model to use (overrides routing) */
    model?: string;
    /** Temperature (0-2, default 0.7) */
    temperature?: number;
    /** Max tokens in response */
    maxTokens?: number;
    /** Task type for smart routing */
    taskType?: TaskType;
    /** Request metadata */
    metadata?: Record<string, unknown>;
}

export interface LlmResponse {
    /** Generated content */
    content: string;
    /** Model that was used */
    model: string;
    /** Provider that served the request */
    provider: ProviderType;
    /** Token usage */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    /** Request latency in ms */
    latencyMs: number;
    /** Raw provider response */
    raw?: unknown;
}

export interface StreamChunk {
    content: string;
    done: boolean;
}

// =============================================================================
// PROVIDER CONFIG
// =============================================================================

export interface ProviderConfig {
    type: ProviderType;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    enabled?: boolean;
    /** Model mappings for task-based routing */
    taskModels?: Partial<Record<TaskType, string>>;
}

// =============================================================================
// ROUTER CONFIG
// =============================================================================

export interface RouterConfig {
    /** Provider configurations */
    providers: ProviderConfig[];
    /** Default provider to use */
    defaultProvider: ProviderType;
    /** Fallback chain when primary fails */
    fallbackChain?: ProviderType[];
    /** Enable smart routing by task type */
    smartRouting?: boolean;
    /** Request timeout in ms */
    timeout?: number;
    /** Enable request logging */
    logging?: boolean;
}

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

export interface LlmProvider {
    /** Provider type identifier */
    readonly type: ProviderType;
    /** Provider display name */
    readonly name: string;

    /** Complete a request (non-streaming) */
    complete(request: LlmRequest): Promise<LlmResponse>;

    /** Stream a response */
    stream(request: LlmRequest): AsyncGenerator<StreamChunk>;

    /** Check if provider is available/configured */
    isAvailable(): Promise<boolean>;

    /** Get list of available models */
    listModels(): Promise<string[]>;
}
