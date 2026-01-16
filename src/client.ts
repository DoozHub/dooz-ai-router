/**
 * dooz-ai-router Client SDK
 * 
 * TypeScript client for other Dooz apps to use the AI Router.
 * 
 * @example
 * ```typescript
 * import { AiRouterClient } from '@dooz/ai-router';
 * 
 * const ai = new AiRouterClient('http://localhost:5180');
 * 
 * // List providers
 * const providers = await ai.listProviders();
 * 
 * // List models for a provider
 * const models = await ai.listModels('openrouter');
 * 
 * // Complete with task-based routing
 * const response = await ai.route('summarization', 'Summarize this text...');
 * 
 * // Complete with explicit provider/model
 * const response2 = await ai.complete({
 *     messages: [{ role: 'user', content: 'Hello!' }],
 *     model: 'anthropic/claude-3.5-sonnet',
 * });
 * ```
 */

import type { LlmMessage, ProviderType, TaskType } from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface ProviderInfo {
    type: ProviderType;
    available: boolean;
    model_count: number;
}

export interface ModelsInfo {
    provider: ProviderType;
    models: string[];
    free_models: string[];
    total: number;
}

export interface ProviderStatus {
    provider: ProviderType;
    available: boolean;
    latency_ms: number;
}

export interface TaskRoute {
    task: TaskType;
    provider: ProviderType;
    model: string;
    enabled: boolean;
}

export interface RouterConfigData {
    task_routes: TaskRoute[];
    default_provider: ProviderType;
    fallback_chain: ProviderType[];
}

export interface CompletionRequest {
    messages: LlmMessage[];
    provider?: ProviderType;
    model?: string;
    task_type?: TaskType;
    temperature?: number;
    max_tokens?: number;
}

export interface CompletionResponse {
    content: string;
    provider: ProviderType;
    model: string;
    task_type?: TaskType;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    latency_ms: number;
}

export interface RouteRequest {
    task_type: TaskType;
    prompt: string;
    system_prompt?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
}

export interface LogEntry {
    id: string;
    timestamp: string;
    method: 'complete' | 'route';
    request: {
        provider?: string;
        model?: string;
        task_type?: string;
        prompt_preview: string;
    };
    response?: {
        provider: string;
        model: string;
        content_preview: string;
        latency_ms: number;
    };
    error?: string;
    duration_ms: number;
}

export interface LogStats {
    total: number;
    success: number;
    failed: number;
    avg_latency_ms: number;
}

// =============================================================================
// CLIENT
// =============================================================================

export class AiRouterClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    // -------------------------------------------------------------------------
    // Health & Status
    // -------------------------------------------------------------------------

    async health(): Promise<{ status: string; service: string; version: string }> {
        const res = await fetch(`${this.baseUrl}/health`);
        return res.json();
    }

    async status(): Promise<{
        configured: boolean;
        providers: ProviderInfo[];
        stats: LogStats;
    }> {
        const res = await fetch(`${this.baseUrl}/status`);
        return res.json();
    }

    // -------------------------------------------------------------------------
    // Provider Discovery
    // -------------------------------------------------------------------------

    async listProviders(): Promise<ProviderInfo[]> {
        const res = await fetch(`${this.baseUrl}/providers`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    async listModels(provider: ProviderType): Promise<ModelsInfo> {
        const res = await fetch(`${this.baseUrl}/providers/${provider}/models`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    async getProviderStatus(provider: ProviderType): Promise<ProviderStatus> {
        const res = await fetch(`${this.baseUrl}/providers/${provider}/status`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    // -------------------------------------------------------------------------
    // Config Management
    // -------------------------------------------------------------------------

    async getConfig(): Promise<RouterConfigData> {
        const res = await fetch(`${this.baseUrl}/config`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    async updateConfig(updates: Partial<RouterConfigData>): Promise<RouterConfigData> {
        const res = await fetch(`${this.baseUrl}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    // -------------------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------------------

    async getLogs(limit = 50): Promise<{ logs: LogEntry[]; stats: LogStats }> {
        const res = await fetch(`${this.baseUrl}/logs?limit=${limit}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    async getLog(id: string): Promise<LogEntry> {
        const res = await fetch(`${this.baseUrl}/logs/${id}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    async clearLogs(): Promise<void> {
        await fetch(`${this.baseUrl}/logs`, { method: 'DELETE' });
    }

    // -------------------------------------------------------------------------
    // Completion
    // -------------------------------------------------------------------------

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const res = await fetch(`${this.baseUrl}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    async route(request: RouteRequest): Promise<CompletionResponse>;
    async route(taskType: TaskType, prompt: string, options?: Partial<RouteRequest>): Promise<CompletionResponse>;
    async route(
        taskOrRequest: TaskType | RouteRequest,
        prompt?: string,
        options?: Partial<RouteRequest>
    ): Promise<CompletionResponse> {
        const body: RouteRequest = typeof taskOrRequest === 'string'
            ? { task_type: taskOrRequest, prompt: prompt!, ...options }
            : taskOrRequest;

        const res = await fetch(`${this.baseUrl}/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    }

    // -------------------------------------------------------------------------
    // Quick helpers
    // -------------------------------------------------------------------------

    /**
     * Quick summarization
     */
    async summarize(text: string): Promise<string> {
        const response = await this.route('summarization', `Summarize the following:\n\n${text}`);
        return response.content;
    }

    /**
     * Quick extraction
     */
    async extract(text: string, what: string): Promise<string> {
        const response = await this.route('extraction', `Extract ${what} from the following:\n\n${text}`);
        return response.content;
    }

    /**
     * Quick code generation
     */
    async generateCode(prompt: string, language = 'typescript'): Promise<string> {
        const response = await this.route('code_generation', `Write ${language} code for: ${prompt}`);
        return response.content;
    }
}

// Default export
export default AiRouterClient;
