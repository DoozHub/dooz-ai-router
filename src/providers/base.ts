/**
 * Base Provider - Abstract base class for LLM providers
 */

import type { LlmProvider, LlmRequest, LlmResponse, StreamChunk, ProviderConfig, ProviderType } from '../types';

export abstract class BaseProvider implements LlmProvider {
    abstract readonly type: ProviderType;
    abstract readonly name: string;

    protected config: ProviderConfig;
    protected baseUrl: string;
    protected apiKey?: string;
    protected defaultModel: string;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.baseUrl = config.baseUrl || this.getDefaultBaseUrl();
        this.apiKey = config.apiKey;
        this.defaultModel = config.defaultModel || this.getDefaultModel();
    }

    protected abstract getDefaultBaseUrl(): string;
    protected abstract getDefaultModel(): string;

    abstract complete(request: LlmRequest): Promise<LlmResponse>;
    abstract stream(request: LlmRequest): AsyncGenerator<StreamChunk>;
    abstract isAvailable(): Promise<boolean>;
    abstract listModels(): Promise<string[]>;

    /**
     * Build messages array from request
     */
    protected buildMessages(request: LlmRequest): Array<{ role: string; content: string }> {
        const messages = [...request.messages];

        if (request.systemPrompt) {
            // Prepend system message if not already present
            if (messages.length === 0 || messages[0].role !== 'system') {
                messages.unshift({ role: 'system', content: request.systemPrompt });
            }
        }

        return messages;
    }

    /**
     * Get model for this request (uses task-based routing if configured)
     */
    protected getModel(request: LlmRequest): string {
        // Explicit model in request takes precedence
        if (request.model) {
            return request.model;
        }

        // Task-based routing
        if (request.taskType && this.config.taskModels?.[request.taskType]) {
            return this.config.taskModels[request.taskType]!;
        }

        return this.defaultModel;
    }
}
