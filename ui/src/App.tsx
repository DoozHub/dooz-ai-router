import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Settings,
    Zap,
    Database,
    TestTube2,
    Server,
    Key,
    CheckCircle2,
    XCircle,
    Send,
    RefreshCw,
} from 'lucide-react';

type Provider = {
    id: string;
    name: string;
    type: 'openrouter' | 'ollama' | 'openai' | 'anthropic';
    apiKey?: string;
    baseUrl?: string;
    enabled: boolean;
    status: 'online' | 'offline' | 'unknown';
};

type TaskMapping = {
    task: string;
    model: string;
    provider: string;
};

const DEFAULT_PROVIDERS: Provider[] = [
    { id: 'openrouter', name: 'OpenRouter', type: 'openrouter', enabled: true, status: 'unknown' },
    { id: 'ollama', name: 'Ollama', type: 'ollama', baseUrl: 'http://localhost:11434', enabled: true, status: 'unknown' },
    { id: 'openai', name: 'OpenAI', type: 'openai', enabled: false, status: 'unknown' },
    { id: 'anthropic', name: 'Anthropic', type: 'anthropic', enabled: false, status: 'unknown' },
];

const TASK_TYPES = [
    'extraction',
    'summarization',
    'comparison',
    'risk_analysis',
    'code_generation',
    'reasoning',
    'general',
];

const MODELS = [
    'gpt-4o',
    'gpt-4o-mini',
    'claude-3.5-sonnet',
    'claude-3-haiku',
    'gemini-1.5-pro',
    'llama-3.2-70b',
    'mistral-large',
];

export default function App() {
    const [activeTab, setActiveTab] = useState<'providers' | 'routing' | 'test'>('providers');
    const [providers, setProviders] = useState<Provider[]>(DEFAULT_PROVIDERS);
    const [taskMappings, setTaskMappings] = useState<TaskMapping[]>(
        TASK_TYPES.map((task) => ({
            task,
            model: task === 'extraction' ? 'gpt-4o-mini' : 'claude-3.5-sonnet',
            provider: 'openrouter',
        }))
    );
    const [testPrompt, setTestPrompt] = useState('');
    const [testOutput, setTestOutput] = useState<string[]>([]);
    const [testing, setTesting] = useState(false);

    const updateProvider = (id: string, updates: Partial<Provider>) => {
        setProviders((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
        );
    };

    const checkProviderStatus = async () => {
        // Simulated status check
        setProviders((prev) =>
            prev.map((p) => ({
                ...p,
                status: p.enabled ? (Math.random() > 0.3 ? 'online' : 'offline') : 'unknown',
            }))
        );
    };

    const runTest = async () => {
        if (!testPrompt.trim()) return;
        setTesting(true);
        setTestOutput((prev) => [...prev, `> ${testPrompt}`]);

        // Simulated response
        setTimeout(() => {
            setTestOutput((prev) => [
                ...prev,
                `[openrouter/claude-3.5-sonnet] Processing...`,
                `Response: This is a simulated response from the AI Router.`,
                `Latency: ${Math.floor(Math.random() * 500 + 200)}ms | Tokens: ${Math.floor(Math.random() * 100 + 50)}`,
                '',
            ]);
            setTesting(false);
            setTestPrompt('');
        }, 1000);
    };

    const saveConfig = () => {
        const config = {
            providers: providers.filter((p) => p.enabled),
            taskMappings,
        };
        localStorage.setItem('ai-router-config', JSON.stringify(config));
        alert('Configuration saved!');
    };

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="sidebar__logo">
                    <Zap size={24} />
                    AI Router
                </div>
                <nav className="sidebar__nav">
                    <div
                        className={`nav-item ${activeTab === 'providers' ? 'nav-item--active' : ''}`}
                        onClick={() => setActiveTab('providers')}
                    >
                        <Server size={18} />
                        Providers
                    </div>
                    <div
                        className={`nav-item ${activeTab === 'routing' ? 'nav-item--active' : ''}`}
                        onClick={() => setActiveTab('routing')}
                    >
                        <Database size={18} />
                        Task Routing
                    </div>
                    <div
                        className={`nav-item ${activeTab === 'test' ? 'nav-item--active' : ''}`}
                        onClick={() => setActiveTab('test')}
                    >
                        <TestTube2 size={18} />
                        Test Console
                    </div>
                </nav>
                <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                    <button className="btn btn--primary" style={{ width: '100%' }} onClick={saveConfig}>
                        <Settings size={16} />
                        Save Config
                    </button>
                </div>
            </aside>

            <main className="main">
                {activeTab === 'providers' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <header className="header">
                            <h1 className="header__title">LLM Providers</h1>
                            <p className="header__subtitle">
                                Configure your AI provider connections and API keys
                            </p>
                        </header>

                        <div style={{ marginBottom: '1rem' }}>
                            <button className="btn btn--secondary" onClick={checkProviderStatus}>
                                <RefreshCw size={16} />
                                Check Status
                            </button>
                        </div>

                        <div className="provider-grid">
                            {providers.map((provider) => (
                                <div key={provider.id} className="provider-card">
                                    <div className="provider-card__header">
                                        <span className="provider-card__name">
                                            <Server size={18} />
                                            {provider.name}
                                        </span>
                                        <span
                                            className={`status-badge status-badge--${provider.status === 'online' ? 'online' : 'offline'
                                                }`}
                                        >
                                            {provider.status === 'online' ? (
                                                <><CheckCircle2 size={12} /> Online</>
                                            ) : provider.status === 'offline' ? (
                                                <><XCircle size={12} /> Offline</>
                                            ) : (
                                                'Unknown'
                                            )}
                                        </span>
                                    </div>

                                    <div className="form-group">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={provider.enabled}
                                                onChange={(e) =>
                                                    updateProvider(provider.id, { enabled: e.target.checked })
                                                }
                                                style={{ marginRight: '0.5rem' }}
                                            />
                                            Enabled
                                        </label>
                                    </div>

                                    {provider.type !== 'ollama' && (
                                        <div className="form-group">
                                            <label>
                                                <Key size={12} style={{ marginRight: '0.25rem' }} />
                                                API Key
                                            </label>
                                            <input
                                                type="password"
                                                placeholder="sk-..."
                                                value={provider.apiKey || ''}
                                                onChange={(e) =>
                                                    updateProvider(provider.id, { apiKey: e.target.value })
                                                }
                                            />
                                        </div>
                                    )}

                                    {provider.type === 'ollama' && (
                                        <div className="form-group">
                                            <label>Base URL</label>
                                            <input
                                                type="text"
                                                value={provider.baseUrl || ''}
                                                onChange={(e) =>
                                                    updateProvider(provider.id, { baseUrl: e.target.value })
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'routing' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <header className="header">
                            <h1 className="header__title">Task Routing</h1>
                            <p className="header__subtitle">
                                Configure which model handles each task type
                            </p>
                        </header>

                        <div className="card">
                            <table className="task-table">
                                <thead>
                                    <tr>
                                        <th>Task Type</th>
                                        <th>Model</th>
                                        <th>Provider</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {taskMappings.map((mapping, idx) => (
                                        <tr key={mapping.task}>
                                            <td style={{ textTransform: 'capitalize' }}>
                                                {mapping.task.replace('_', ' ')}
                                            </td>
                                            <td>
                                                <select
                                                    className="model-select"
                                                    value={mapping.model}
                                                    onChange={(e) => {
                                                        const newMappings = [...taskMappings];
                                                        newMappings[idx].model = e.target.value;
                                                        setTaskMappings(newMappings);
                                                    }}
                                                >
                                                    {MODELS.map((model) => (
                                                        <option key={model} value={model}>
                                                            {model}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    className="model-select"
                                                    value={mapping.provider}
                                                    onChange={(e) => {
                                                        const newMappings = [...taskMappings];
                                                        newMappings[idx].provider = e.target.value;
                                                        setTaskMappings(newMappings);
                                                    }}
                                                >
                                                    {providers
                                                        .filter((p) => p.enabled)
                                                        .map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'test' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <header className="header">
                            <h1 className="header__title">Test Console</h1>
                            <p className="header__subtitle">
                                Test your router configuration with sample prompts
                            </p>
                        </header>

                        <div className="card">
                            <div className="card__title">
                                <TestTube2 size={18} />
                                Prompt Playground
                            </div>

                            <div className="test-console">
                                {testOutput.length === 0 ? (
                                    <div className="test-console__line">
                                        Ready to test. Enter a prompt below...
                                    </div>
                                ) : (
                                    testOutput.map((line, i) => (
                                        <div
                                            key={i}
                                            className={`test-console__line ${line.startsWith('Response:')
                                                    ? 'test-console__line--response'
                                                    : line.startsWith('Error:')
                                                        ? 'test-console__line--error'
                                                        : ''
                                                }`}
                                        >
                                            {line}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="Enter a test prompt..."
                                    value={testPrompt}
                                    onChange={(e) => setTestPrompt(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && runTest()}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="btn btn--primary"
                                    onClick={runTest}
                                    disabled={testing}
                                >
                                    <Send size={16} />
                                    {testing ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </main>
        </div>
    );
}
