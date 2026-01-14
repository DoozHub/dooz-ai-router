/**
 * OpenRouter Provider
 * 
 * Unified API for 100+ models (OpenAI, Anthropic, Google, Meta, etc.)
 * https://openrouter.ai/docs
 */

import { BaseProvider } from './base';
import type { LlmRequest, LlmResponse, StreamChunk, ProviderConfig, ProviderType } from '../types';

export class OpenRouterProvider extends BaseProvider {
    readonly type: ProviderType = 'openrouter';
    readonly name = 'OpenRouter';

    constructor(config: ProviderConfig) {
        super(config);
    }

    protected getDefaultBaseUrl(): string {
        return 'https://openrouter.ai/api/v1';
    }

    protected getDefaultModel(): string {
        return 'openai/gpt-4o-mini';
    }

    async complete(request: LlmRequest): Promise<LlmResponse> {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key is required');
        }

        const startTime = Date.now();
        const model = this.getModel(request);
        const messages = this.buildMessages(request);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://dooz.ai',
                'X-Title': 'Dooz PM Suite',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as {
            choices: Array<{ message: { content: string } }>;
            model: string;
            usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        return {
            content: data.choices[0]?.message?.content || '',
            model: data.model || model,
            provider: this.type,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
            latencyMs: Date.now() - startTime,
            raw: data,
        };
    }

    async *stream(request: LlmRequest): AsyncGenerator<StreamChunk> {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key is required');
        }

        const model = this.getModel(request);
        const messages = this.buildMessages(request);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://dooz.ai',
                'X-Title': 'Dooz PM Suite',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens,
                stream: true,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        yield { content: '', done: true };
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data) as {
                            choices: Array<{ delta: { content?: string } }>;
                        };
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) {
                            yield { content, done: false };
                        }
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        }

        yield { content: '', done: true };
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey) return false;

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async listModels(): Promise<string[]> {
        // Return commonly used models (OpenRouter has 100+)
        return [
            'openai/gpt-4o',
            'openai/gpt-4o-mini',
            'anthropic/claude-3.5-sonnet',
            'anthropic/claude-3-haiku',
            'google/gemini-2.0-flash-exp',
            'google/gemini-pro',
            'meta-llama/llama-3.1-70b-instruct',
            'mistralai/mistral-large',
        ];
    }
}
