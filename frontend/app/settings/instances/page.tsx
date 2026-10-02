"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, InstanceItem } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { EditIcon, TrashIcon, CheckIcon, PlusIcon, ArrowLeftIcon } from "@/components/icons/Icons";

export default function InstancesSettingsPage() {
    const router = useRouter();
    const {
        instances,
        fetchInstances,
        setInstances: setStoreInstances,
        setCurrentView,
        appPreferences,
        fetchAppPreferences,
        setAppPreferences,
    } = useAppStore();

    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-instances");

    // --- Instances Management State ---
    const [instanceSubView, setInstanceSubView] = useState<"list" | "select-type" | "form">("list");
    const [selectedInstanceType, setSelectedInstanceType] = useState<string>("Ollama");

    // Instance Form fields for Adding
    const [instFormName, setInstFormName] = useState<string>("Instance");
    const [instFormUrl, setInstFormUrl] = useState<string>("http://0.0.0.0:11434");
    const [instFormApiKey, setInstFormApiKey] = useState<string>("");
    const [showApiKeyText, setShowApiKeyText] = useState<boolean>(false);
    const [instFormThink, setInstFormThink] = useState<boolean>(false);
    const [instFormShareName, setInstFormShareName] = useState<number>(2);
    const [instFormShowMetadata, setInstFormShowMetadata] = useState<boolean>(false);
    const [instFormAllowSsl, setInstFormAllowSsl] = useState<boolean>(false);
    const [instFormOverrideParams, setInstFormOverrideParams] = useState<boolean>(true);
    const [instFormTemp, setInstFormTemp] = useState<number>(0.7);
    const [instFormSeed, setInstFormSeed] = useState<number>(0);
    const [instFormNumCtx, setInstFormNumCtx] = useState<number>(16384);
    const [instFormKeepAliveMinutes, setInstFormKeepAliveMinutes] = useState<number>(5);

    // Lifecycle
    useEffect(() => {
        fetchInstances();
        fetchAppPreferences();
    }, [fetchInstances, fetchAppPreferences]);

    // Handlers: Instances
    const handleOpenAddInstanceModal = () => {
        setInstanceSubView("select-type");
    };

    const handleSelectInstanceType = (typeLabel: string) => {
        setSelectedInstanceType(typeLabel);

        let defaultName = "Instance";
        let defaultUrl = "http://0.0.0.0:11434";
        if (typeLabel.includes("Ollama")) {
            defaultName = "Ollama External";
            defaultUrl = "http://0.0.0.0:11434";
        } else if (typeLabel.includes("OpenAI")) {
            defaultName = "OpenAI ChatGPT";
            defaultUrl = "https://api.openai.com/v1";
        } else if (typeLabel.includes("Gemini")) {
            defaultName = "Google Gemini";
            defaultUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
        } else if (typeLabel.includes("Anthropic")) {
            defaultName = "Anthropic Claude";
            defaultUrl = "https://api.anthropic.com";
        } else if (typeLabel.includes("Deepseek")) {
            defaultName = "Deepseek AI";
            defaultUrl = "https://api.deepseek.com";
        } else if (typeLabel.includes("Groq")) {
            defaultName = "Groq Cloud";
            defaultUrl = "https://api.groq.com/openai/v1";
        } else if (typeLabel.includes("Together")) {
            defaultName = "Together AI";
            defaultUrl = "https://api.together.xyz/v1";
        } else if (typeLabel.includes("Venice")) {
            defaultName = "Venice AI";
            defaultUrl = "https://api.venice.ai/api/v1";
        } else if (typeLabel.includes("OpenRouter")) {
            defaultName = "OpenRouter AI";
            defaultUrl = "https://openrouter.ai/api/v1";
        }

        setInstFormName(defaultName);
        setInstFormUrl(defaultUrl);
        setInstFormApiKey("");
        setShowApiKeyText(false);
        setInstFormThink(false);
        setInstFormShareName(2);
        setInstFormShowMetadata(false);
        setInstFormAllowSsl(false);
        setInstFormOverrideParams(true);
        setInstFormTemp(0.7);
        setInstFormSeed(0);
        setInstFormNumCtx(16384);
        setInstFormKeepAliveMinutes(5);

        setInstanceSubView("form");
    };

    const handleActivateInstance = async (id: string) => {
        setAppPreferences({ active_instance_id: id });
        try {
            await fetch(`${getApiUrl()}/preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active_instance_id: id }),
            });
            fetchAppPreferences(true);
        } catch (err) {
            console.warn("Could not activate instance:", err);
        }
    };

    const handleDeleteInstance = async (id: string) => {
        const remaining = instances.filter((item) => item.id !== id);
        setStoreInstances(remaining);
        if (appPreferences.active_instance_id === id) {
            const newActiveId = remaining[0]?.id || null;
            setAppPreferences({ active_instance_id: newActiveId });
            try {
                await fetch(`${getApiUrl()}/preferences`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ active_instance_id: newActiveId }),
                });
            } catch (err) {
                console.warn("Could not update active instance preference after delete:", err);
            }
        }
        try {
            await fetch(`${getApiUrl()}/instances/${id}`, { method: "DELETE" });
            fetchInstances(true);
        } catch (err) {
            console.warn("Could not delete instance:", err);
        }
    };

    const handleSaveInstanceForm = async (e: React.FormEvent) => {
        e.preventDefault();

        let backendType = "ollama";
        if (selectedInstanceType.includes("OpenAI")) backendType = "openai";
        else if (selectedInstanceType.includes("Gemini")) backendType = "gemini";
        else if (selectedInstanceType.includes("Anthropic")) backendType = "anthropic";
        else if (selectedInstanceType.includes("Deepseek")) backendType = "deepseek";
        else if (selectedInstanceType.includes("Groq")) backendType = "groq";
        else if (selectedInstanceType.includes("Together")) backendType = "together";
        else if (selectedInstanceType.includes("Venice")) backendType = "venice";
        else if (selectedInstanceType.includes("OpenRouter")) backendType = "openrouter";

        const payload = {
            type: backendType,
            pinned: false,
            properties: {
                name: instFormName.trim() || "Instance",
                url: instFormUrl.trim() || "http://0.0.0.0:11434",
                api: instFormApiKey.trim() || "NOKEY",
                think: instFormThink,
                share_name: Number(instFormShareName),
                show_response_metadata: instFormShowMetadata,
                allow_self_signed_ssl: instFormAllowSsl,
                override_parameters: instFormOverrideParams,
                temperature: Number(instFormTemp),
                seed: Number(instFormSeed),
                num_ctx: Number(instFormNumCtx),
                keep_alive: Number(instFormKeepAliveMinutes),
                default_model: null,
                title_model: null,
            },
        };

        const tempId = `inst-${Date.now()}`;
        const newInst: InstanceItem = { id: tempId, pinned: false, type: backendType, properties: payload.properties };
        setStoreInstances([...instances, newInst]);
        try {
            const res = await fetch(`${getApiUrl()}/instances`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                fetchInstances(true);
            }
        } catch (err) {
            console.warn("Could not create instance:", err);
        }

        setInstanceSubView("list");
    };

    return (
        <div className="flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar activeSettingsCategory={activeSettingsCategory} setActiveSettingsCategory={setActiveSettingsCategory} setCurrentView={setCurrentView} />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="mx-auto space-y-8">
                    <div>
                        {/* View 1: List */}
                        {instanceSubView === "list" && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                {/* Header */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs">
                                    <div>
                                        <h3 className="text-xl font-bold text-[#202022] tracking-tight">Manage Instances</h3>
                                        <p className="text-sm text-[#7a7d90] mt-1 font-medium">Configure local server connections, cloud API backends, and proxy endpoints.</p>
                                    </div>
                                    <button
                                        onClick={handleOpenAddInstanceModal}
                                        className="p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                        title="Add Instance"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {instances.length === 0 ? (
                                    <div className="p-8 rounded-2xl border border-dashed border-[#7678ed]/30 bg-[#f9fafc] text-center space-y-3">
                                        <div className="w-12 h-12 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-xl mx-auto">⚡</div>
                                        <p className="text-base font-bold text-[#202022]">No Instances Configured</p>
                                        <p className="text-xs text-[#8e90a6] max-w-sm mx-auto">
                                            Click &ldquo;Add Instance&rdquo; above to connect an Ollama local or remote server to Walpaca.
                                        </p>
                                        <button
                                            onClick={handleOpenAddInstanceModal}
                                            className="px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold rounded-2xl transition-all shadow-xs"
                                        >
                                            + Add First Instance
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                        {instances.map((inst) => {
                                            const isActive = appPreferences.active_instance_id ? appPreferences.active_instance_id === inst.id : instances[0]?.id === inst.id;

                                            return (
                                                <div
                                                    key={inst.id}
                                                    className={`p-5 rounded-2xl bg-white border transition-all shadow-xs flex flex-col justify-between ${
                                                        isActive ? "border-[#7678ed] ring-2 ring-[#7678ed]/10" : "border-[#e8ebf3] hover:border-[#7678ed]/40"
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-base font-bold text-[#202022]">{inst.properties?.name || inst.type}</h4>
                                                                {isActive && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                        Active
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#eaecf9] text-[#7678ed]">
                                                                {inst.type}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-[#8e90a6] font-mono truncate mb-4">{inst.properties?.url || "http://0.0.0.0:11434"}</p>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-3 border-t border-[#e8ebf3] gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => router.push(`/settings/instances/${encodeURIComponent(inst.id)}`)}
                                                                className="px-3 py-1.5 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] text-xs font-semibold transition-all cursor-pointer"
                                                            >
                                                                Models
                                                            </button>
                                                            {isActive ? (
                                                                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold inline-flex items-center gap-1.5">
                                                                    <CheckIcon className="w-3.5 h-3.5" />
                                                                    Active
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleActivateInstance(inst.id)}
                                                                    className="px-3 py-1.5 rounded-xl bg-[#f0f2fb] hover:bg-[#7678ed] hover:text-white text-[#5d6075] text-xs font-semibold transition-all cursor-pointer"
                                                                >
                                                                    Activate
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => router.push(`/settings/instances/${encodeURIComponent(inst.id)}`)}
                                                                className="p-1.5 text-[#7a7d90] hover:text-[#7678ed] transition-colors rounded-lg hover:bg-[#eaecf9]"
                                                                title="Edit"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteInstance(inst.id)}
                                                                className="p-1.5 text-[#7a7d90] hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                                                                title="Delete"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* View 2: Select Provider Type */}
                        {instanceSubView === "select-type" && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setInstanceSubView("list")}
                                        className="p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer"
                                    >
                                        <ArrowLeftIcon className="w-5 h-5" />
                                    </button>
                                    <div>
                                        <h3 className="text-2xl font-bold text-[#202022]">Select Provider Type</h3>
                                        <p className="text-xs text-[#7a7d90] mt-0.5">Choose the backend engine for this instance</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {[
                                        { name: "Ollama", desc: "Local Ollama instance on localhost:11434", icon: "🦙" },
                                        { name: "OpenAI ChatGPT", desc: "Official OpenAI API (GPT-4o, o1, etc.)", icon: "⚡" },
                                        { name: "Google Gemini", desc: "Gemini Pro / Flash models via Generative AI", icon: "✨" },
                                        { name: "Anthropic Claude", desc: "Claude 3.5 Sonnet & Haiku models", icon: "🧠" },
                                        { name: "Deepseek AI", desc: "DeepSeek Chat & DeepSeek Reasoner API", icon: "🐋" },
                                        { name: "Groq Cloud", desc: "Ultra-fast LPU inference endpoints", icon: "🚀" },
                                        { name: "Together AI", desc: "Open-weights cloud inference engine", icon: "🤝" },
                                        { name: "OpenRouter AI", desc: "Unified API routing across dozens of models", icon: "🌐" },
                                    ].map((prov) => (
                                        <button
                                            key={prov.name}
                                            onClick={() => handleSelectInstanceType(prov.name)}
                                            className="p-4 rounded-2xl bg-white border border-[#e8ebf3] hover:border-[#7678ed] hover:shadow-sm transition-all text-left flex items-center gap-3.5 group cursor-pointer"
                                        >
                                            <div className="w-11 h-11 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-xl shrink-0 group-hover:scale-105 transition-transform">
                                                {prov.icon}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-[#202022]">{prov.name}</h4>
                                                <p className="text-xs text-[#7a7d90] mt-0.5">{prov.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* View 3: Instance Form */}
                        {instanceSubView === "form" && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setInstanceSubView("select-type")}
                                        className="p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer"
                                    >
                                        <ArrowLeftIcon className="w-5 h-5" />
                                    </button>
                                    <div>
                                        <h3 className="text-2xl font-bold text-[#202022]">Add {selectedInstanceType}</h3>
                                        <p className="text-xs text-[#7a7d90] mt-0.5">Configure connection and execution parameters</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSaveInstanceForm} className="bg-white p-6 rounded-2xl border border-[#e8ebf3] shadow-xs space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1.5">Instance Name</label>
                                        <input
                                            type="text"
                                            value={instFormName}
                                            onChange={(e) => setInstFormName(e.target.value)}
                                            className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] outline-none focus:border-[#7678ed] transition-all"
                                            placeholder="e.g. My Ollama Box"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1.5">Server Endpoint URL</label>
                                        <input
                                            type="text"
                                            value={instFormUrl}
                                            onChange={(e) => setInstFormUrl(e.target.value)}
                                            className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] font-mono outline-none focus:border-[#7678ed] transition-all"
                                            placeholder="http://0.0.0.0:11434"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-semibold text-[#202022]">API Key</label>
                                            <button type="button" onClick={() => setShowApiKeyText(!showApiKeyText)} className="text-[11px] text-[#7678ed] hover:underline">
                                                {showApiKeyText ? "Hide" : "Show"}
                                            </button>
                                        </div>
                                        <input
                                            type={showApiKeyText ? "text" : "password"}
                                            value={instFormApiKey}
                                            onChange={(e) => setInstFormApiKey(e.target.value)}
                                            className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] font-mono outline-none focus:border-[#7678ed] transition-all"
                                            placeholder="Optional for local Ollama"
                                        />
                                    </div>

                                    <div className="pt-2 flex items-center justify-between border-t border-[#e8ebf3]">
                                        <span className="text-xs font-semibold text-[#202022]">Enable Reasoning / Thinking Output</span>
                                        <input
                                            type="checkbox"
                                            checked={instFormThink}
                                            onChange={(e) => setInstFormThink(e.target.checked)}
                                            className="w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>

                                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#e8ebf3]">
                                        <button
                                            type="button"
                                            onClick={() => setInstanceSubView("list")}
                                            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#7a7d90] hover:text-[#202022] hover:bg-[#eaecf9] transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold shadow-xs transition-all"
                                        >
                                            Save Instance
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
