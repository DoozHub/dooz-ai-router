/**
 * Ollama Provider
 * 
 * Local/self-hosted LLM server
 * https://ollama.ai/
 */

import { BaseProvider } from './base';
import type { LlmRequest, LlmResponse, StreamChunk, ProviderConfig, ProviderType } from '../types';

export class OllamaProvider extends BaseProvider {
    readonly type: ProviderType = 'ollama';
    readonly name = 'Ollama (Local)';

    constructor(config: ProviderConfig) {
        super(config);
    }

    protected getDefaultBaseUrl(): string {
        return 'http://localhost:11434';
    }

    protected getDefaultModel(): string {
        return 'llama3.2';
    }

    async complete(request: LlmRequest): Promise<LlmResponse> {
        const startTime = Date.now();
        const model = this.getModel(request);
        const messages = this.buildMessages(request);

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                options: {
                    temperature: request.temperature ?? 0.7,
                    num_predict: request.maxTokens,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as {
            message: { content: string };
            model: string;
            eval_count?: number;
            prompt_eval_count?: number;
        };

        return {
            content: data.message?.content || '',
            model: data.model || model,
            provider: this.type,
            usage: data.eval_count ? {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count,
                totalTokens: (data.prompt_eval_count || 0) + data.eval_count,
            } : undefined,
            latencyMs: Date.now() - startTime,
            raw: data,
        };
    }

    async *stream(request: LlmRequest): AsyncGenerator<StreamChunk> {
        const model = this.getModel(request);
        const messages = this.buildMessages(request);

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: true,
                options: {
                    temperature: request.temperature ?? 0.7,
                    num_predict: request.maxTokens,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${error}`);
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
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line) as {
                        message?: { content: string };
                        done: boolean;
                    };

                    if (parsed.done) {
                        yield { content: '', done: true };
                        return;
                    }

                    const content = parsed.message?.content || '';
                    if (content) {
                        yield { content, done: false };
                    }
                } catch {
                    // Skip malformed JSON
                }
            }
        }

        yield { content: '', done: true };
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch {
            return false;
        }
    }

    async listModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) return [];

            const data = await response.json() as {
                models: Array<{ name: string }>;
            };

            return data.models?.map(m => m.name) || [];
        } catch {
            return [];
        }
    }
}
