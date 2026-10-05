"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore, InstanceItem, InstanceModel } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { getCharacterName } from "@/lib/characterUtils";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { CheckIcon, ChevronIcon, SearchIcon, SettingsIcon, CloseIcon } from "@/components/icons/Icons";

const PROVIDER_OPTIONS = [
    { value: "ollama", label: "Ollama (Local / Remote)", defaultUrl: "http://0.0.0.0:11434" },
    { value: "openai", label: "OpenAI ChatGPT", defaultUrl: "https://api.openai.com/v1" },
    { value: "gemini", label: "Google Gemini", defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
    { value: "anthropic", label: "Anthropic Claude", defaultUrl: "https://api.anthropic.com" },
    { value: "deepseek", label: "Deepseek AI", defaultUrl: "https://api.deepseek.com" },
    { value: "groq", label: "Groq Cloud", defaultUrl: "https://api.groq.com/openai/v1" },
    { value: "together", label: "Together AI", defaultUrl: "https://api.together.xyz/v1" },
    { value: "openrouter", label: "OpenRouter AI", defaultUrl: "https://openrouter.ai/api/v1" },
    { value: "venice", label: "Venice AI", defaultUrl: "https://api.venice.ai/api/v1" },
];

export default function EditInstancePage() {
    const params = useParams();
    const router = useRouter();
    const rawInstanceId = typeof params?.instance_id === "string" ? params.instance_id : "";
    const instanceId = decodeURIComponent(rawInstanceId);

    const {
        instances,
        fetchInstances,
        setInstances: setStoreInstances,
        modelPreferences,
        fetchModelPreferences,
        fetchInstanceModels,
        setCurrentView,
    } = useAppStore();

    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-instances");
    const [isLoadingInstance, setIsLoadingInstance] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Instance Form State
    const [formName, setFormName] = useState<string>("");
    const [formType, setFormType] = useState<string>("ollama");
    const [formUrl, setFormUrl] = useState<string>("");
    const [formApiKey, setFormApiKey] = useState<string>("");
    const [showApiKeyText, setShowApiKeyText] = useState<boolean>(false);
    const [formThink, setFormThink] = useState<boolean>(false);
    const [formShareName, setFormShareName] = useState<number>(2);
    const [formShowMetadata, setFormShowMetadata] = useState<boolean>(false);
    const [formAllowSsl, setFormAllowSsl] = useState<boolean>(false);
    const [formOverrideParams, setFormOverrideParams] = useState<boolean>(true);
    const [formTemp, setFormTemp] = useState<number>(0.7);
    const [formSeed, setFormSeed] = useState<number>(0);
    const [formNumCtx, setFormNumCtx] = useState<number>(16384);
    const [formKeepAlive, setFormKeepAlive] = useState<number>(5);

    // Available Models State
    const [instanceModels, setInstanceModels] = useState<InstanceModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
    const [modelsSearch, setModelsSearch] = useState<string>("");

    // Initial mount data fetching
    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            await Promise.all([fetchInstances(), fetchModelPreferences()]);
            if (isMounted) {
                setIsLoadingInstance(false);
            }
        };
        init();
        return () => {
            isMounted = false;
        };
    }, [fetchInstances, fetchModelPreferences]);

    // Match current instance from store
    const currentInstance: InstanceItem | undefined = useMemo(() => {
        return instances.find((i) => i.id === instanceId);
    }, [instances, instanceId]);

    const populateForm = useCallback((inst: InstanceItem) => {
        setFormName(inst.properties?.name || inst.type);
        setFormType(inst.type || "ollama");
        setFormUrl(inst.properties?.url || "http://0.0.0.0:11434");
        setFormApiKey(
            inst.properties?.api && inst.properties.api !== "NOKEY"
                ? inst.properties.api
                : ""
        );
        setFormThink(Boolean(inst.properties?.think));
        setFormShareName(inst.properties?.share_name ?? 2);
        setFormShowMetadata(Boolean(inst.properties?.show_response_metadata));
        setFormAllowSsl(Boolean(inst.properties?.allow_self_signed_ssl));
        setFormOverrideParams(inst.properties?.override_parameters ?? true);
        setFormTemp(inst.properties?.temperature ?? 0.7);
        setFormSeed(inst.properties?.seed ?? 0);
        setFormNumCtx(inst.properties?.num_ctx ?? 16384);
        setFormKeepAlive(inst.properties?.keep_alive ?? 5);
    }, []);

    // Populate form fields when currentInstance is available
    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (currentInstance && isMounted) {
                populateForm(currentInstance);
            }
        };
        load();
        return () => {
            isMounted = false;
        };
    }, [currentInstance, populateForm]);

    // Load available models for this instance
    const loadModels = useCallback(
        async (force = false) => {
            if (!instanceId) return;
            setIsLoadingModels(true);
            try {
                const list = await fetchInstanceModels(instanceId, force);
                if (Array.isArray(list) && list.length > 0) {
                    setInstanceModels(list);
                    return;
                }

                // Fallbacks if backend discovery returns empty
                const inst = instances.find((i) => i.id === instanceId);
                const instType = inst?.type || formType;

                if (instType === "gemini" || inst?.properties?.url?.includes("generativelanguage.googleapis.com")) {
                    setInstanceModels([
                        { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", provider: "Google Gemini", voice: "af_heart", context: "1,048,576 tokens" },
                        { id: "gemini-flash-latest", name: "Gemini Flash (Latest)", provider: "Google Gemini", voice: "af_heart", context: "1,048,576 tokens" },
                        { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "Google Gemini", voice: "af_heart", context: "1,048,576 tokens" },
                        { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "Google Gemini", voice: "af_heart", context: "1,048,576 tokens" },
                    ]);
                } else {
                    setInstanceModels(list || []);
                }
            } catch (err) {
                console.warn(`Could not fetch models for instance ${instanceId}:`, err);
            } finally {
                setIsLoadingModels(false);
            }
        },
        [instanceId, fetchInstanceModels, instances, formType]
    );

    useEffect(() => {
        let isMounted = true;
        const fetchModels = async () => {
            if (instanceId && isMounted) {
                await loadModels(false);
            }
        };
        fetchModels();
        return () => {
            isMounted = false;
        };
    }, [instanceId, loadModels]);

    const isActive = useMemo(() => {
        if (!currentInstance) return false;
        return Boolean(currentInstance.is_enabled ?? (instances[0]?.id === currentInstance.id));
    }, [currentInstance, instances]);

    const handleActivate = async () => {
        if (!currentInstance) return;
        try {
            await fetch(`${getApiUrl()}/instances/${encodeURIComponent(currentInstance.id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_enabled: true }),
            });
            fetchInstances();
        } catch (err) {
            console.warn("Could not activate instance:", err);
        }
    };

    const handleSaveInstance = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveFeedback(null);

        const payload = {
            type: formType,
            pinned: currentInstance?.pinned ?? false,
            properties: {
                name: formName.trim() || "Instance",
                url: formUrl.trim() || "http://0.0.0.0:11434",
                api: formApiKey.trim() || "NOKEY",
                think: formThink,
                share_name: Number(formShareName),
                show_response_metadata: formShowMetadata,
                allow_self_signed_ssl: formAllowSsl,
                override_parameters: formOverrideParams,
                temperature: Number(formTemp),
                seed: Number(formSeed),
                num_ctx: Number(formNumCtx),
                keep_alive: Number(formKeepAlive),
                default_model: currentInstance?.properties?.default_model ?? null,
                title_model: currentInstance?.properties?.title_model ?? null,
            },
        };

        try {
            const res = await fetch(`${getApiUrl()}/instances/${encodeURIComponent(instanceId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setStoreInstances(
                    instances.map((inst) =>
                        inst.id === instanceId
                            ? { ...inst, type: formType, properties: { ...inst.properties, ...payload.properties } }
                            : inst
                    )
                );
                await fetchInstances(true);
                setSaveFeedback({ type: "success", message: "Instance settings saved successfully." });
                setTimeout(() => setSaveFeedback(null), 4000);
            } else {
                const err = await res.json().catch(() => ({}));
                setSaveFeedback({ type: "error", message: err.detail || err.error || "Failed to update instance." });
            }
        } catch (err: any) {
            console.error("Error saving instance:", err);
            setSaveFeedback({ type: "error", message: err.message || "Network error updating instance." });
        } finally {
            setIsSaving(false);
        }
    };

    // Filter models
    const filteredModels = useMemo(() => {
        if (!modelsSearch.trim()) return instanceModels;
        const q = modelsSearch.toLowerCase();
        return instanceModels.filter(
            (m) =>
                m.id.toLowerCase().includes(q) ||
                (m.name && m.name.toLowerCase().includes(q)) ||
                (m.family && m.family.toLowerCase().includes(q)) ||
                (m.tag && m.tag.toLowerCase().includes(q))
        );
    }, [instanceModels, modelsSearch]);

    const formatBytes = (bytes?: number) => {
        if (!bytes || bytes <= 0) return null;
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(1)} GB`;
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white rounded-none md:rounded-l-[32px] w-full h-full select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar
                activeSettingsCategory={activeSettingsCategory}
                setActiveSettingsCategory={setActiveSettingsCategory}
                setCurrentView={setCurrentView}
            />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Top Bar Navigation */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => router.push("/settings/instances")}
                                className="p-2 rounded-xl bg-[#f0f2fb] hover:bg-[#eaecf9] text-[#7678ed] transition-all cursor-pointer"
                                title="Back to Instances List"
                            >
                                <ChevronIcon direction="left" className="w-5 h-5" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-xl font-bold text-[#202022] tracking-tight">
                                        Edit Instance: {formName || currentInstance?.properties?.name || instanceId}
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#eaecf9] text-[#7678ed]">
                                        {formType}
                                    </span>
                                    {isActive ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                            <CheckIcon className="w-3 h-3 text-emerald-600" />
                                            Active
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleActivate}
                                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f0f2fb] hover:bg-[#7678ed] hover:text-white text-[#5d6075] transition-all cursor-pointer"
                                        >
                                            Activate
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-[#7a7d90] mt-1 font-medium font-mono truncate max-w-md">
                                    {formUrl || "http://0.0.0.0:11434"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                type="submit"
                                form="edit-instance-form"
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>

                    {saveFeedback && (
                        <div
                            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                                saveFeedback.type === "success"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                        >
                            <span>{saveFeedback.message}</span>
                            <button
                                type="button"
                                onClick={() => setSaveFeedback(null)}
                                className="p-1 text-current opacity-60 hover:opacity-100 transition-opacity rounded-md"
                                title="Dismiss"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {isLoadingInstance && !currentInstance ? (
                        <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">
                            Loading instance configuration...
                        </div>
                    ) : !currentInstance ? (
                        <div className="p-8 rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 text-center space-y-3">
                            <p className="text-base font-bold text-rose-800">Instance Not Found</p>
                            <p className="text-xs text-[#7a7d90]">
                                No instance with ID <code className="font-mono">{instanceId}</code> exists.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push("/settings/instances")}
                            >
                                Return to Instances
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* --- 1. EDIT INSTANCE FORM --- */}
                            <form
                                id="edit-instance-form"
                                onSubmit={handleSaveInstance}
                                className="bg-white p-6 rounded-2xl border border-[#e8ebf3] shadow-xs space-y-6"
                            >
                                <div className="border-b border-[#e8ebf3] pb-3">
                                    <h4 className="text-base font-bold text-[#202022]">Instance Configuration</h4>
                                    <p className="text-xs text-[#7a7d90] mt-0.5">
                                        Server endpoint address, credentials, and default generation parameters.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1.5">
                                            Instance Name
                                        </label>
                                        <Input
                                            type="text"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            placeholder="e.g. My Ollama Server"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1.5">
                                            Provider Backend
                                        </label>
                                        <select
                                            value={formType}
                                            onChange={(e) => {
                                                const newType = e.target.value;
                                                setFormType(newType);
                                                const match = PROVIDER_OPTIONS.find((p) => p.value === newType);
                                                if (match && (!formUrl || formUrl === "http://0.0.0.0:11434")) {
                                                    setFormUrl(match.defaultUrl);
                                                }
                                            }}
                                            className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] outline-none focus:border-[#7678ed] transition-all"
                                        >
                                            {PROVIDER_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1.5">
                                            Server Endpoint URL
                                        </label>
                                        <Input
                                            type="text"
                                            value={formUrl}
                                            onChange={(e) => setFormUrl(e.target.value)}
                                            placeholder="http://0.0.0.0:11434"
                                            className="font-mono text-xs"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-semibold text-[#202022]">API Key</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKeyText(!showApiKeyText)}
                                                className="text-[11px] text-[#7678ed] hover:underline cursor-pointer"
                                            >
                                                {showApiKeyText ? "Hide" : "Show"}
                                            </button>
                                        </div>
                                        <Input
                                            type={showApiKeyText ? "text" : "password"}
                                            value={formApiKey}
                                            onChange={(e) => setFormApiKey(e.target.value)}
                                            placeholder="Optional for local Ollama"
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Advanced Parameters */}
                                <div className="pt-2 border-t border-[#e8ebf3]">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[#7a7d90] mb-3">
                                        Default Generation & Execution Parameters
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-[#202022] mb-1">
                                                Context Size
                                            </label>
                                            <Input
                                                type="number"
                                                value={formNumCtx}
                                                onChange={(e) => setFormNumCtx(Number(e.target.value))}
                                                placeholder="16384"
                                                className="font-mono text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-[#202022] mb-1">
                                                Temperature
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="2"
                                                value={formTemp}
                                                onChange={(e) => setFormTemp(Number(e.target.value))}
                                                placeholder="0.7"
                                                className="font-mono text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-[#202022] mb-1">
                                                Seed
                                            </label>
                                            <Input
                                                type="number"
                                                value={formSeed}
                                                onChange={(e) => setFormSeed(Number(e.target.value))}
                                                placeholder="0"
                                                className="font-mono text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-[#202022] mb-1">
                                                Keep-Alive (min)
                                            </label>
                                            <Input
                                                type="number"
                                                value={formKeepAlive}
                                                onChange={(e) => setFormKeepAlive(Number(e.target.value))}
                                                placeholder="5"
                                                className="font-mono text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Feature Toggles */}
                                <div className="pt-2 border-t border-[#e8ebf3] space-y-2.5">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[#7a7d90] mb-2">
                                        Connection & Output Options
                                    </label>

                                    <div className="flex items-center justify-between py-1">
                                        <div>
                                            <span className="text-xs font-semibold text-[#202022] block">
                                                Enable Reasoning / Thinking Output
                                            </span>
                                            <span className="text-[11px] text-[#7a7d90]">
                                                Display thought processes for reasoning models like DeepSeek-R1.
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={formThink}
                                            onChange={(e) => setFormThink(e.target.checked)}
                                            className="w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between py-1 border-t border-[#f0f2fb]">
                                        <div>
                                            <span className="text-xs font-semibold text-[#202022] block">
                                                Allow Self-Signed SSL
                                            </span>
                                            <span className="text-[11px] text-[#7a7d90]">
                                                Permit HTTPS endpoints with untrusted certificates.
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={formAllowSsl}
                                            onChange={(e) => setFormAllowSsl(e.target.checked)}
                                            className="w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between py-1 border-t border-[#f0f2fb]">
                                        <div>
                                            <span className="text-xs font-semibold text-[#202022] block">
                                                Show Response Metadata
                                            </span>
                                            <span className="text-[11px] text-[#7a7d90]">
                                                Expose latency, prompt eval tokens, and tokens per second in chat bubbles.
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={formShowMetadata}
                                            onChange={(e) => setFormShowMetadata(e.target.checked)}
                                            className="w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between py-1 border-t border-[#f0f2fb]">
                                        <div>
                                            <span className="text-xs font-semibold text-[#202022] block">
                                                Override Parameters
                                            </span>
                                            <span className="text-[11px] text-[#7a7d90]">
                                                Apply these generation parameters when model defaults are omitted.
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={formOverrideParams}
                                            onChange={(e) => setFormOverrideParams(e.target.checked)}
                                            className="w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#e8ebf3]">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => router.push("/settings/instances")}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isSaving}>
                                        {isSaving ? "Saving..." : "Save Instance"}
                                    </Button>
                                </div>
                            </form>

                            {/* --- 2. AVAILABLE MODELS SECTION --- */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-lg font-bold text-[#202022]">Available Models</h4>
                                            <Badge variant="secondary" className="font-mono">
                                                {filteredModels.length}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-[#7a7d90] mt-0.5 font-medium">
                                            Models discovered from this endpoint. Click configure to customize individual personas and voices.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="relative w-48 sm:w-56">
                                            <SearchIcon className="w-4 h-4 text-[#7a7d90] absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={modelsSearch}
                                                onChange={(e) => setModelsSearch(e.target.value)}
                                                placeholder="Filter models..."
                                                className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#202022] outline-none focus:border-[#7678ed] transition-all"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => loadModels(true)}
                                            disabled={isLoadingModels}
                                            title="Reload model catalog from instance"
                                        >
                                            {isLoadingModels ? "Refreshing..." : "Refresh"}
                                        </Button>
                                    </div>
                                </div>

                                {isLoadingModels && instanceModels.length === 0 ? (
                                    <div className="p-8 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">
                                        Discovering models from {formName || "instance"}...
                                    </div>
                                ) : filteredModels.length === 0 ? (
                                    <div className="p-8 rounded-2xl border border-dashed border-[#e8ebf3] bg-[#f9fafc] text-center space-y-3">
                                        <p className="text-sm font-bold text-[#202022]">No models found</p>
                                        <p className="text-xs text-[#7a7d90] max-w-sm mx-auto">
                                            {modelsSearch
                                                ? "No models match your search query."
                                                : "No models reported by this instance endpoint. Verify that the server URL is reachable and any required API key is configured."}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => loadModels(true)}
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        {filteredModels.map((mod) => {
                                            const rawId = String(mod.id || "");
                                            const prefKey = rawId.toLowerCase();
                                            const pref = modelPreferences[rawId] || modelPreferences[prefKey];
                                            const configuredName = pref?.character
                                                ? getCharacterName(pref.character)
                                                : (pref as any)?.name;

                                            return (
                                                <div
                                                    key={mod.id}
                                                    className="p-4 rounded-2xl bg-white border border-[#e8ebf3] hover:border-[#7678ed]/40 transition-all shadow-xs flex flex-col justify-between gap-3 group"
                                                >
                                                    <div>
                                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                                            <div className="min-w-0">
                                                                <h5 className="text-sm font-bold text-[#202022] truncate group-hover:text-[#7678ed] transition-colors">
                                                                    {mod.name || mod.id}
                                                                </h5>
                                                                <span className="text-[11px] font-mono text-[#7a7d90] block truncate">
                                                                    {mod.id}
                                                                </span>
                                                            </div>
                                                            {pref && (
                                                                <Badge
                                                                    variant="success"
                                                                    className="shrink-0 text-[10px]"
                                                                >
                                                                    Configured
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {/* Badges & Meta */}
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                                            {mod.family && (
                                                                <Badge variant="secondary" className="text-[10px]">
                                                                    {mod.family}
                                                                </Badge>
                                                            )}
                                                            {mod.parameter_size && (
                                                                <Badge variant="secondary" className="text-[10px]">
                                                                    {mod.parameter_size}
                                                                </Badge>
                                                            )}
                                                            {mod.quantization_level && (
                                                                <Badge variant="secondary" className="text-[10px]">
                                                                    {mod.quantization_level}
                                                                </Badge>
                                                            )}
                                                            {mod.context && (
                                                                <span className="text-[10px] text-[#7a7d90] bg-[#f0f2fb] px-2 py-0.5 rounded-md font-mono">
                                                                    {mod.context}
                                                                </span>
                                                            )}
                                                            {formatBytes(mod.size) && (
                                                                <span className="text-[10px] text-[#7a7d90] bg-[#f0f2fb] px-2 py-0.5 rounded-md font-mono">
                                                                    {formatBytes(mod.size)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {configuredName && (
                                                            <p className="text-[11px] text-[#7678ed] mt-2 font-medium truncate">
                                                                Persona: <span className="font-semibold">{configuredName}</span>
                                                                {pref?.voice && ` • Voice: ${pref.voice}`}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="pt-2 border-t border-[#e8ebf3] flex items-center justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                router.push(
                                                                    `/settings/model-preferences/${encodeURIComponent(
                                                                        mod.id
                                                                    )}`
                                                                )
                                                            }
                                                            className="px-3 py-1.5 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <SettingsIcon className="w-3.5 h-3.5" />
                                                            {pref ? "Edit Preference" : "Configure Preference"}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
