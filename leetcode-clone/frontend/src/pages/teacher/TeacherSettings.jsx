import React, { useState, useEffect } from "react";
import { Settings, Key, Trash2, ExternalLink, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { getAiProviders, saveAiKey, removeAiKey } from "../../utils/api";

const PROVIDER_ICONS = {
    gemini: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4"/>
            <path d="M12 6l2.5 5.5L20 12l-5.5 2.5L12 20l-2.5-5.5L4 12l5.5-2.5z" fill="white"/>
        </svg>
    ),
    openrouter: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <rect width="24" height="24" rx="4" fill="#1a1a2e"/>
            <path d="M6 12h12M12 6v12M8 8l8 8M16 8l-8 8" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
    ),
    cerebras: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <rect width="24" height="24" rx="4" fill="#ff4f00"/>
            <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="2" fill="transparent"/>
            <circle cx="12" cy="12" r="2" fill="white"/>
        </svg>
    ),
    mistral: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <rect width="24" height="24" rx="4" fill="#f87315"/>
            <path d="M7 17V7l5 5 5-5v10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    openai: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
            <rect width="24" height="24" rx="4" fill="#10a37f"/>
            <path d="M12 4.5a7.1 7.1 0 0 0-6.8 9.2L4 17l3.4-1.1A7.1 7.1 0 1 0 12 4.5z" fill="white" opacity="0.9"/>
        </svg>
    ),
    claude: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <rect width="24" height="24" rx="4" fill="#c9a96e"/>
            <text x="4" y="17" fontSize="13" fontWeight="bold" fill="white" fontFamily="serif">Cl</text>
        </svg>
    ),
    grok: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <rect width="24" height="24" rx="4" fill="#000"/>
            <path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
    )
};

const SETUP_GUIDES = {
    gemini: {
        title: "How to get a Gemini API Key",
        steps: [
            "Go to Google AI Studio (aistudio.google.com)",
            "Sign in with your Google account",
            "Click 'Get API Key' in the left sidebar",
            "Click 'Create API Key' and select a project",
            "Copy the generated key and paste it below"
        ]
    },
    openrouter: {
        title: "How to get an OpenRouter API Key",
        steps: [
            "Create an account at openrouter.ai",
            "Navigate to Settings → Keys",
            "Click 'Create Key'",
            "Give it a name (e.g. 'Quiz Portal')",
            "Optionally set a spending limit and expiration",
            "Click 'Create' and copy the key immediately",
            "OpenRouter only shows the key once after creation"
        ]
    },
    cerebras: {
        title: "How to get a Cerebras API Key",
        steps: [
            "Go to Cerebras Cloud (cloud.cerebras.ai)",
            "Sign in with your account",
            "Navigate to the API Keys section",
            "Click 'Create API Key'",
            "Copy the generated key and paste it below"
        ]
    },
    mistral: {
        title: "How to get a Mistral API Key",
        steps: [
            "Create an account at console.mistral.ai",
            "Navigate to API Keys",
            "Click 'Create new key'",
            "Copy the key to your clipboard",
            "Paste it below"
        ]
    },
    openai: {
        title: "How to get an OpenAI API Key",
        steps: [
            "Go to platform.openai.com and sign in",
            "Click your profile icon → 'API keys'",
            "Click 'Create new secret key'",
            "Give it a name (e.g. 'Quiz Portal')",
            "Copy the key immediately — it won't be shown again",
            "Make sure your account has credits at platform.openai.com/settings/billing"
        ]
    },
    claude: {
        title: "How to get a Claude (Anthropic) API Key",
        steps: [
            "Go to console.anthropic.com and create an account",
            "Navigate to Settings → API Keys",
            "Click 'Create Key'",
            "Give it a name and click 'Create Key'",
            "Copy the key — it won't be shown again",
            "Add credits at console.anthropic.com/settings/billing if needed"
        ]
    },
    grok: {
        title: "How to get a Grok (xAI) API Key",
        steps: [
            "Go to console.x.ai and sign in with your X (Twitter) account",
            "Navigate to API Keys",
            "Click 'Create API Key'",
            "Copy the key immediately",
            "Note: Grok API has a free monthly credit allowance"
        ]
    }
};

export default function TeacherSettings() {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeProvider, setActiveProvider] = useState(null); // which provider is being edited
    const [keyInput, setKeyInput] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(null); // provider id being removed
    const [expandedGuide, setExpandedGuide] = useState(null);
    const [feedback, setFeedback] = useState(null); // { type: "success" | "error", message }

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const res = await getAiProviders();
            setProviders(res.data.providers);
        } catch (err) {
            console.error("Failed to fetch AI providers:", err);
            setFeedback({ type: "error", message: "Failed to load AI providers." });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = async (providerId) => {
        if (!keyInput.trim()) return;
        setSaving(true);
        setFeedback(null);
        try {
            await saveAiKey(providerId, keyInput.trim());
            setFeedback({ type: "success", message: `${providerId} API key saved successfully.` });
            setActiveProvider(null);
            setKeyInput("");
            setShowKey(false);
            await fetchProviders();
        } catch (err) {
            setFeedback({ type: "error", message: err.response?.data?.error || "Failed to save API key." });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveKey = async (providerId) => {
        if (!window.confirm(`Are you sure you want to remove your ${providerId} API key?`)) return;
        setRemoving(providerId);
        setFeedback(null);
        try {
            await removeAiKey(providerId);
            setFeedback({ type: "success", message: `${providerId} API key removed.` });
            await fetchProviders();
        } catch (err) {
            setFeedback({ type: "error", message: err.response?.data?.error || "Failed to remove API key." });
        } finally {
            setRemoving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Settings className="w-8 h-8 text-indigo-400" />
                    Settings
                </h1>
                <p className="text-gray-400 mt-2">Manage your AI provider API keys for quiz generation and evaluation.</p>
            </div>

            {/* Feedback Banner */}
            {feedback && (
                <div className={`mb-6 px-4 py-3 rounded-lg border flex items-center gap-3 text-sm ${
                    feedback.type === "success"
                        ? "bg-green-900/20 border-green-700/50 text-green-300"
                        : "bg-red-900/20 border-red-700/50 text-red-300"
                }`}>
                    {feedback.type === "success"
                        ? <CheckCircle className="w-5 h-5 shrink-0" />
                        : <AlertCircle className="w-5 h-5 shrink-0" />
                    }
                    {feedback.message}
                    <button onClick={() => setFeedback(null)} className="ml-auto text-gray-400 hover:text-white">&times;</button>
                </div>
            )}

            {/* Security Note */}
            <div className="mb-6 px-4 py-3 rounded-lg border border-indigo-700/30 bg-indigo-900/10 flex items-start gap-3 text-sm text-indigo-200">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" />
                <div>
                    <p className="font-semibold">Your keys are stored securely</p>
                    <p className="text-indigo-300/70 mt-0.5">API keys are saved to your profile and never exposed to other users. Only masked versions are displayed.</p>
                </div>
            </div>

            {/* Provider Cards */}
            <div className="space-y-4 sm:space-y-6">
                {providers.map((provider) => (
                    <div
                        key={provider.id}
                        className="bg-[#1e1e1e] border border-gray-800 rounded-xl overflow-hidden transition-all hover:border-gray-700"
                    >
                        {/* Card Header */}
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start justify-between gap-4">
                            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[#252526] border border-gray-700 flex items-center justify-center shrink-0">
                                    {PROVIDER_ICONS[provider.id]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                        <h3 className="text-base sm:text-lg font-bold text-white leading-snug">{provider.name}</h3>
                                        {provider.configured ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-900/30 text-green-400 border border-green-700/30">
                                                <CheckCircle className="w-3 h-3" /> Configured
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-800 text-gray-400 border border-gray-700">
                                                Not configured
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">{provider.description}</p>
                                    {provider.configured && provider.maskedKey && (
                                        <p className="text-[11px] text-gray-500 mt-2 font-mono bg-[#252526] inline-block px-2 py-1 rounded border border-white/5">
                                            <Key className="w-3 h-3 inline mr-1" />
                                            {provider.maskedKey}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-800/60 w-full sm:w-auto justify-end">
                                <a
                                    href={provider.docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-1 text-xs"
                                    title="View docs"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span className="sm:hidden text-xs">Docs</span>
                                </a>
                                {provider.configured && (
                                    <button
                                        onClick={() => handleRemoveKey(provider.id)}
                                        disabled={removing === provider.id}
                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 text-xs"
                                        title="Remove key"
                                    >
                                        {removing === provider.id
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Trash2 className="w-4 h-4" />
                                        }
                                        <span className="sm:hidden text-xs">Remove</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Key Input Section */}
                        {activeProvider === provider.id ? (
                            <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-800 pt-4">
                                <div className="flex flex-col sm:flex-row gap-2">

                                    <div className="relative flex-1">
                                        <input
                                            type={showKey ? "text" : "password"}
                                            value={keyInput}
                                            onChange={(e) => setKeyInput(e.target.value)}
                                            placeholder={provider.id === "openrouter" ? "sk-or-v1-..." : "Enter API key..."}
                                            className="w-full bg-[#252526] border border-gray-600 rounded-lg px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                                        >
                                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleSaveKey(provider.id)}
                                        disabled={saving || !keyInput.trim()}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setActiveProvider(null); setKeyInput(""); setShowKey(false); }}
                                        className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="px-5 pb-4">
                                <button
                                    onClick={() => { setActiveProvider(provider.id); setKeyInput(""); setShowKey(false); }}
                                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-2"
                                >
                                    <Key className="w-4 h-4" />
                                    {provider.configured ? "Update Key" : "Add Key"}
                                </button>
                            </div>
                        )}

                        {/* Setup Guide (Collapsible) */}
                        <div className="border-t border-gray-800">
                            <button
                                onClick={() => setExpandedGuide(expandedGuide === provider.id ? null : provider.id)}
                                className="w-full px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-white/5 transition-colors flex items-center justify-between"
                            >
                                <span>Setup Guide</span>
                                <span className="text-gray-600">{expandedGuide === provider.id ? "−" : "+"}</span>
                            </button>
                            {expandedGuide === provider.id && SETUP_GUIDES[provider.id] && (
                                <div className="px-5 pb-4">
                                    <h4 className="text-sm font-semibold text-gray-300 mb-3">{SETUP_GUIDES[provider.id].title}</h4>
                                    <ol className="space-y-2">
                                        {SETUP_GUIDES[provider.id].steps.map((step, idx) => (
                                            <li key={idx} className="flex items-start gap-3 text-sm text-gray-400">
                                                <span className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </span>
                                                {step}
                                            </li>
                                        ))}
                                    </ol>
                                    <a
                                        href={providers.find(p => p.id === provider.id)?.docsUrl || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Open official documentation
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
