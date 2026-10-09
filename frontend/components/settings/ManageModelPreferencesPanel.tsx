"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, ModelPreference } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { getCharacterName, formatAvatarPicture, isInternalId, isUuid } from "@/lib/characterUtils";
import { getVoiceDisplayName } from "@/lib/voiceConstants";
import { EditIcon, TrashIcon, SearchIcon } from "@/components/icons/Icons";
import { Badge } from "../ui/Badge";

export const ManageModelPreferencesPanel: React.FC = () => {
    const {
        instances,
        fetchInstances,
        modelPreferences,
        modelPreferencesList,
        fetchModelPreferences,
        removeModelPreference: removeStoreModelPreference,
        instanceModelsMap,
        fetchInstanceModels,
    } = useAppStore();

    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Delete Modal State
    const [deletingPref, setDeletingPref] = useState<ModelPreference | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [instanceFilter, setInstanceFilter] = useState<string>("all");

    // Fetch instances and model preferences on mount
    useEffect(() => {
        Promise.all([fetchInstances(true), fetchModelPreferences(true)]).finally(() => {
            setIsLoading(false);
        });
    }, [fetchInstances, fetchModelPreferences]);

    // Fetch models for each instance to correlate models with their hosting instance
    useEffect(() => {
        if (instances.length > 0) {
            for (const inst of instances) {
                fetchInstanceModels(inst.id).catch(() => {});
            }
        }
    }, [instances, fetchInstanceModels]);

    // Convert modelPreferences map or raw list to array
    const preferencesList: ModelPreference[] = useMemo(() => {
        if (Array.isArray(modelPreferencesList) && modelPreferencesList.length > 0) {
            const seen = new Set<string>();
            const unique: ModelPreference[] = [];
            for (const p of modelPreferencesList) {
                const idKey = (p.id || "").toLowerCase();
                if (idKey && !seen.has(idKey)) {
                    seen.add(idKey);
                    unique.push(p);
                }
            }
            return unique;
        }

        const values = Object.values(modelPreferences);
        const seen = new Set<string>();
        const unique: ModelPreference[] = [];
        for (const p of values) {
            const idKey = (p.id || "").toLowerCase();
            if (idKey && !seen.has(idKey)) {
                seen.add(idKey);
                unique.push(p);
            }
        }
        return unique;
    }, [modelPreferencesList, modelPreferences]);

    const getInstanceColor = (type: string): string => {
        const t = (type || "").toLowerCase();
        if (t === "gemini") return "bg-amber-50 text-amber-700 border-amber-200";
        if (t === "openai") return "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (t === "openrouter") return "bg-indigo-50 text-indigo-700 border-indigo-200";
        if (t === "anthropic") return "bg-orange-50 text-orange-700 border-orange-200";
        if (t === "deepseek") return "bg-blue-50 text-blue-700 border-blue-200";
        return "bg-purple-50 text-purple-700 border-purple-200";
    };

    // Helper to resolve clean human-readable model name for a preference
    const getModelDisplayName = useCallback(
        (pref: ModelPreference): string => {
            // 1. If pref.model_name is present and not a raw UUID, use it
            if (pref.model_name && !isInternalId(pref.model_name)) {
                return pref.model_name;
            }

            // 2. If pref.model_id is present and not a raw UUID, use it
            if (pref.model_id && !isInternalId(pref.model_id)) {
                return pref.model_id;
            }

            // 3. Search in instanceModelsMap across all instances
            const targetIds = [pref.model_id, pref.id].filter(Boolean) as string[];
            for (const inst of instances) {
                const models = instanceModelsMap[inst.id] || [];
                for (const tid of targetIds) {
                    const match = models.find(
                        (m) =>
                            m.id === tid ||
                            m.name === tid ||
                            (m.id && tid && m.id.toLowerCase() === tid.toLowerCase()) ||
                            (m.name && tid && m.name.toLowerCase() === tid.toLowerCase()) ||
                            (m.uuid && tid && m.uuid.toLowerCase() === tid.toLowerCase()) ||
                            (m.instance_model_id && tid && m.instance_model_id.toLowerCase() === tid.toLowerCase())
                    );
                    if (match) {
                        const candidate = match.name || match.id;
                        if (candidate && !isInternalId(candidate)) {
                            return candidate;
                        }
                    }
                }
            }

            // 4. Try first model of hosting instance if available
            if (pref.instance_id && instanceModelsMap[pref.instance_id]?.length) {
                const firstMod = instanceModelsMap[pref.instance_id][0];
                const cleanName = firstMod.name || firstMod.id;
                if (cleanName && !isInternalId(cleanName)) return cleanName;
            }

            // 5. Fallbacks
            if (pref.model_name && !isInternalId(pref.model_name)) return pref.model_name;
            if (pref.model_id && !isInternalId(pref.model_id)) return pref.model_id;

            return "AI Model";
        },
        [instances, instanceModelsMap]
    );

    // Helper to resolve clean character/persona name or model display name
    const getCharacterDisplayName = useCallback(
        (pref: ModelPreference): string => {
            const charName = getCharacterName(pref.character);
            if (charName && !isInternalId(charName)) return charName;
            if (pref.name && !isInternalId(pref.name)) return pref.name;

            const modelName = getModelDisplayName(pref);
            if (modelName && !isInternalId(modelName)) return modelName;

            return "Persona";
        },
        [getModelDisplayName]
    );

    // Resolve the hosting instance for a given model preference item
    const getInstanceForModel = useCallback(
        (pref: ModelPreference): { id?: string; name: string; type: string; color: string; isEnabled?: number | boolean } => {
            // 1. Direct match by pref.instance_id across all loaded instances
            if (pref.instance_id) {
                const directInst = instances.find((i) => i.id === pref.instance_id);
                if (directInst) {
                    return {
                        id: directInst.id,
                        name: directInst.properties?.name || directInst.type,
                        type: directInst.type,
                        color: getInstanceColor(directInst.type),
                        isEnabled: directInst.is_enabled,
                    };
                }
            }

            // Target identifiers
            const targetModelName = pref.model_name || "";
            const targetModelId = pref.model_id || "";
            const fallbackId = pref.id || "";

            // 2. Direct match in fetched instance models across all instances
            for (const inst of instances) {
                const models = instanceModelsMap[inst.id] || [];
                if (
                    models.some((m) => {
                        const mNameLower = (m.name || "").toLowerCase();
                        const mIdLower = (m.id || "").toLowerCase();
                        return (
                            (targetModelName && (mNameLower === targetModelName.toLowerCase() || mIdLower === targetModelName.toLowerCase())) ||
                            (targetModelId && (mNameLower === targetModelId.toLowerCase() || mIdLower === targetModelId.toLowerCase())) ||
                            (fallbackId && (mNameLower === fallbackId.toLowerCase() || mIdLower === fallbackId.toLowerCase()))
                        );
                    })
                ) {
                    return {
                        id: inst.id,
                        name: inst.properties?.name || inst.type,
                        type: inst.type,
                        color: getInstanceColor(inst.type),
                        isEnabled: inst.is_enabled,
                    };
                }
            }

            // 3. ID prefix match
            for (const inst of instances) {
                if (
                    (targetModelId && targetModelId.startsWith(inst.id)) ||
                    (targetModelName && targetModelName.startsWith(inst.id)) ||
                    (fallbackId && fallbackId.startsWith(inst.id))
                ) {
                    return {
                        id: inst.id,
                        name: inst.properties?.name || inst.type,
                        type: inst.type,
                        color: getInstanceColor(inst.type),
                        isEnabled: inst.is_enabled,
                    };
                }
            }

            // 4. Provider heuristics based on model naming patterns
            const combinedNames = `${targetModelName} ${targetModelId} ${fallbackId}`.toLowerCase();

            if (combinedNames.includes("gemini") || combinedNames.includes("gemma")) {
                const geminiInst = instances.find((i) => i.type === "gemini" || i.properties?.url?.includes("generativelanguage"));
                if (geminiInst) {
                    return {
                        id: geminiInst.id,
                        name: geminiInst.properties?.name || "Google Gemini",
                        type: "gemini",
                        color: getInstanceColor("gemini"),
                        isEnabled: geminiInst.is_enabled,
                    };
                }
                return { name: "Google Gemini", type: "gemini", color: getInstanceColor("gemini") };
            }

            if (combinedNames.includes("gpt") || combinedNames.includes("o1") || combinedNames.includes("o3") || combinedNames.includes("openai")) {
                const openaiInst = instances.find((i) => i.type === "openai");
                if (openaiInst) {
                    return {
                        id: openaiInst.id,
                        name: openaiInst.properties?.name || "OpenAI ChatGPT",
                        type: "openai",
                        color: getInstanceColor("openai"),
                        isEnabled: openaiInst.is_enabled,
                    };
                }
                return { name: "OpenAI ChatGPT", type: "openai", color: getInstanceColor("openai") };
            }

            if (combinedNames.includes("claude") || combinedNames.includes("anthropic")) {
                const anthropicInst = instances.find((i) => i.type === "anthropic");
                if (anthropicInst) {
                    return {
                        id: anthropicInst.id,
                        name: anthropicInst.properties?.name || "Anthropic",
                        type: "anthropic",
                        color: getInstanceColor("anthropic"),
                        isEnabled: anthropicInst.is_enabled,
                    };
                }
            }

            // 5. Default to enabled instance or first instance
            const activeInst = instances.find((i) => i.is_enabled) || instances[0];
            if (activeInst) {
                return {
                    id: activeInst.id,
                    name: activeInst.properties?.name || activeInst.type,
                    type: activeInst.type,
                    color: getInstanceColor(activeInst.type),
                    isEnabled: activeInst.is_enabled,
                };
            }

            return { name: "Custom Instance", type: "custom", color: getInstanceColor("custom") };
        },
        [instances, instanceModelsMap]
    );

    const activeInst = useMemo(
        () => instances.find((i) => i.is_enabled) || instances[0],
        [instances]
    );

    const isModelInActiveInstance = useCallback(
        (pref: ModelPreference): boolean => {
            if (!activeInst) return true;
            if (pref.instance_id) {
                return pref.instance_id === activeInst.id;
            }
            const resolved = getInstanceForModel(pref);
            return resolved.id === activeInst.id;
        },
        [activeInst, getInstanceForModel]
    );

    const getAvatarBg = (name: string): string => {
        if (!name) return "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const gradients = [
            "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
            "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        ];
        return gradients[Math.abs(hash) % gradients.length];
    };

    // Filtered list based on search and instance filter
    const filteredPreferences = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();

        return preferencesList.filter((pref) => {
            const instInfo = getInstanceForModel(pref);

            // 1. Instance tab filter
            if (instanceFilter !== "all" && instInfo.id !== instanceFilter) {
                return false;
            }

            // 2. Search query filter
            if (!q) return true;

            const charDisplayName = getCharacterDisplayName(pref).toLowerCase();
            const modelDisplayName = getModelDisplayName(pref).toLowerCase();
            const rawModelId = (pref.model_id || pref.id || "").toLowerCase();
            const instName = instInfo.name.toLowerCase();
            const instType = instInfo.type.toLowerCase();
            const voice = (pref.voice || "").toLowerCase();

            return (
                charDisplayName.includes(q) ||
                modelDisplayName.includes(q) ||
                rawModelId.includes(q) ||
                instName.includes(q) ||
                instType.includes(q) ||
                voice.includes(q)
            );
        });
    }, [preferencesList, searchQuery, instanceFilter, getInstanceForModel, getCharacterDisplayName, getModelDisplayName]);

    // Open Delete Modal
    const handleOpenDelete = (pref: ModelPreference) => {
        setDeletingPref(pref);
    };

    // Confirm Delete
    const handleConfirmDelete = async () => {
        if (!deletingPref) return;
        setIsDeleting(true);
        try {
            const encodedId = encodeURIComponent(deletingPref.id);
            const res = await fetch(`${getApiUrl()}/model-preferences/${encodedId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                removeStoreModelPreference(deletingPref.id);
                if (deletingPref.model_id) removeStoreModelPreference(deletingPref.model_id);
                if (deletingPref.model_name) removeStoreModelPreference(deletingPref.model_name);
                setDeletingPref(null);
            }
        } catch (err) {
            console.error("Failed to delete model preference:", err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="p-8 mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs">
                <div>
                    <h3 className="text-xl font-bold text-[#202022] tracking-tight">Manage Model Preferences</h3>
                    <p className="text-sm text-[#7a7d90] mt-1 font-medium">
                        Configure character persona, profile avatar, Kokoro TTS voice, and context window limits for models across all instances.
                    </p>
                </div>
                {activeInst && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f9fafc] border border-[#e8ebf3] shrink-0 self-start md:self-auto">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-[#202022]">Active: {activeInst.properties?.name || activeInst.type}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#eaecf9] text-[#7678ed]">
                            {activeInst.type}
                        </span>
                    </div>
                )}
            </div>

            {/* Instance Filter Tabs Bar */}
            {instances.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button
                        type="button"
                        onClick={() => setInstanceFilter("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                            instanceFilter === "all"
                                ? "bg-[#7678ed] text-white shadow-xs"
                                : "bg-white text-[#7a7d90] border border-[#e8ebf3] hover:bg-[#f0f2fb] hover:text-[#202022]"
                        }`}
                    >
                        All Instances ({preferencesList.length})
                    </button>
                    {instances.map((inst) => {
                        const instName = inst.properties?.name || inst.type;
                        const count = preferencesList.filter((p) => getInstanceForModel(p).id === inst.id).length;
                        const isSelected = instanceFilter === inst.id;

                        return (
                            <button
                                key={inst.id}
                                type="button"
                                onClick={() => setInstanceFilter(inst.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                    isSelected
                                        ? "bg-[#7678ed] text-white shadow-xs"
                                        : "bg-white text-[#7a7d90] border border-[#e8ebf3] hover:bg-[#f0f2fb] hover:text-[#202022]"
                                }`}
                            >
                                {inst.is_enabled && (
                                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500"}`} />
                                )}
                                <span>@{instName}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-[#f0f2fb] text-[#7a7d90]"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Search Bar */}
            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search model preferences by character name, model ID, instance, or voice..."
                    className="w-full bg-white border border-[#e8ebf3] rounded-2xl pl-11 pr-4 py-3 text-sm text-[#202022] placeholder-[#a0a3b5] outline-none focus:border-[#7678ed] transition-all shadow-xs"
                />
                <SearchIcon className="absolute left-4 top-3.5 text-[#a0a3b5] w-4 h-4" />
            </div>

            {/* Cards Grid */}
            {isLoading ? (
                <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">Loading model preferences...</div>
            ) : filteredPreferences.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-[#e8ebf3] space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-xl mx-auto">🎭</div>
                    <h4 className="font-bold text-[#202022] text-base">{searchQuery || instanceFilter !== "all" ? "No model preferences match your filter" : "No Model Preferences Configured"}</h4>
                    <p className="text-xs text-[#7a7d90] max-w-sm mx-auto">
                        {searchQuery || instanceFilter !== "all"
                            ? "Try adjusting your search query or instance filter to find models."
                            : "Model preferences customize AI personality, avatar, and voice. They are created when assigning personas or editing model settings."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-5">
                    {filteredPreferences.map((pref) => {
                        const charDisplayName = getCharacterDisplayName(pref);
                        const modelDisplayName = getModelDisplayName(pref);
                        const avatarSrc = formatAvatarPicture(pref.picture);
                        const instInfo = getInstanceForModel(pref);
                        const voiceLabel = getVoiceDisplayName(pref.voice);
                        const isActiveInstance = isModelInActiveInstance(pref);

                        return (
                            <div
                                key={pref.id}
                                className={`p-5 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                                    isActiveInstance
                                        ? "hover:border-[#7678ed]/40"
                                        : "opacity-60 hover:opacity-90 hover:border-[#7678ed]/30"
                                }`}
                                title={!isActiveInstance ? `Hosting instance: @${instInfo.name} (${instInfo.type})` : undefined}
                            >
                                <div className="space-y-3 flex">
                                    {/* Avatar */}
                                    <div
                                        style={!avatarSrc ? { background: getAvatarBg(charDisplayName) } : undefined}
                                        className="w-30 h-30 mr-4 rounded-2xl border border-[#e8ebf3] overflow-hidden flex items-center justify-center shrink-0 shadow-xs relative bg-[#eaecf9]"
                                    >
                                        {avatarSrc ? (
                                            <img
                                                src={avatarSrc}
                                                alt={charDisplayName}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLElement).style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <span className="text-white font-bold text-xl uppercase">
                                                {charDisplayName.slice(0, 2)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-bold text-[#202022] text-base leading-snug truncate" title={charDisplayName}>
                                            {charDisplayName}
                                        </h4>
                                        <span className="text-[11px] font-mono text-[#a0a3b5] block mt-0.5 mb-2 truncate">
                                            {voiceLabel}
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge key={instInfo.name} variant="primary" className="text-xs">
                                                @{instInfo.name}
                                            </Badge>
                                            <Badge variant="secondary" className="font-mono text-xs" title={`Preference ID: ${pref.id}`}>
                                                {modelDisplayName}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end pt-3 border-t border-[#e8ebf3] gap-2">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => router.push(`/settings/model-preferences/${encodeURIComponent(pref.id)}`)}
                                            className="p-1.5 text-[#7a7d90] hover:text-[#7678ed] transition-colors rounded-lg hover:bg-[#eaecf9] cursor-pointer"
                                            title="Edit"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenDelete(pref)}
                                            className="p-1.5 text-[#7a7d90] hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 cursor-pointer"
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

            {/* Delete Confirmation Modal */}
            {deletingPref && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl border border-[#e8ebf3] shadow-2xl max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold text-[#202022]">Delete Model Preference</h3>
                        <p className="text-xs text-[#7a7d90] leading-relaxed">
                            Are you sure you want to remove the model preference for{" "}
                            <span className="font-bold text-[#202022]">{getCharacterDisplayName(deletingPref)}</span> (
                            <code className="font-mono text-[#7678ed]">{getModelDisplayName(deletingPref)}</code>)? This will revert the model to default settings.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e8ebf3]">
                            <button
                                onClick={() => setDeletingPref(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#4b4e6d] text-xs font-semibold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                {isDeleting ? "Deleting..." : "Delete Preference"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
