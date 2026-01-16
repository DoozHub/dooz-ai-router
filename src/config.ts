/**
 * dooz-ai-router - Configuration Store
 * 
 * In-memory configuration for task routing with persistence support.
 */

import type { TaskType, ProviderType } from './types';

// =============================================================================
// TASK ROUTE CONFIG
// =============================================================================

export interface TaskRoute {
    task: TaskType;
    provider: ProviderType;
    model: string;
    enabled: boolean;
}

export interface RouterConfig {
    task_routes: TaskRoute[];
    default_provider: ProviderType;
    fallback_chain: ProviderType[];
}

// Default task routing configuration
const DEFAULT_CONFIG: RouterConfig = {
    task_routes: [
        { task: 'extraction', provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true },
        { task: 'summarization', provider: 'openrouter', model: 'anthropic/claude-3-haiku', enabled: true },
        { task: 'comparison', provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', enabled: true },
        { task: 'risk_analysis', provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', enabled: true },
        { task: 'code_generation', provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', enabled: true },
        { task: 'reasoning', provider: 'openrouter', model: 'openai/gpt-4o', enabled: true },
        { task: 'general', provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true },
    ],
    default_provider: 'openrouter',
    fallback_chain: ['ollama'],
};

// =============================================================================
// REQUEST LOG
// =============================================================================

export interface RequestLog {
    id: string;
    timestamp: string;
    method: 'complete' | 'route';
    request: {
        provider?: string;
        model?: string;
        task_type?: string;
        prompt_preview: string;
        temperature?: number;
        max_tokens?: number;
    };
    response?: {
        provider: string;
        model: string;
        content_preview: string;
        tokens?: { prompt: number; completion: number; total: number };
        latency_ms: number;
    };
    error?: string;
    duration_ms: number;
}

// =============================================================================
// CONFIG STORE
// =============================================================================

class ConfigStore {
    private config: RouterConfig;
    private logs: RequestLog[] = [];
    private maxLogs = 100;

    constructor() {
        this.config = structuredClone(DEFAULT_CONFIG);
    }

    // Config getters/setters
    getConfig(): RouterConfig {
        return structuredClone(this.config);
    }

    updateConfig(updates: Partial<RouterConfig>): RouterConfig {
        if (updates.task_routes) {
            this.config.task_routes = updates.task_routes;
        }
        if (updates.default_provider) {
            this.config.default_provider = updates.default_provider;
        }
        if (updates.fallback_chain) {
            this.config.fallback_chain = updates.fallback_chain;
        }
        return this.getConfig();
    }

    getRouteForTask(task: TaskType): TaskRoute | undefined {
        return this.config.task_routes.find(r => r.task === task && r.enabled);
    }

    getDefaultProvider(): ProviderType {
        return this.config.default_provider;
    }

    getFallbackChain(): ProviderType[] {
        return this.config.fallback_chain;
    }

    // Logging
    addLog(log: RequestLog): void {
        this.logs.unshift(log);
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
    }

    getLogs(limit = 50): RequestLog[] {
        return this.logs.slice(0, limit);
    }

    clearLogs(): void {
        this.logs = [];
    }

    getLogById(id: string): RequestLog | undefined {
        return this.logs.find(l => l.id === id);
    }

    // Stats
    getStats(): { total: number; success: number; failed: number; avg_latency_ms: number } {
        const total = this.logs.length;
        const success = this.logs.filter(l => !l.error).length;
        const failed = this.logs.filter(l => !!l.error).length;
        const latencies = this.logs.filter(l => !l.error).map(l => l.duration_ms);
        const avg_latency_ms = latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0;

        return { total, success, failed, avg_latency_ms };
    }
}

// Singleton instance
export const configStore = new ConfigStore();

// Helper to generate log ID
export function generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
