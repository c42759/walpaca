"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, ModelPreference } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { getCharacterName, formatAvatarPicture } from "@/lib/characterUtils";
import { getVoiceDisplayName } from "@/lib/voiceConstants";
import { EditIcon, TrashIcon, SearchIcon } from "@/components/icons/Icons";
import { Badge } from "../ui/Badge";

export const ManageModelPreferencesPanel: React.FC = () => {
    const {
        instances,
        fetchInstances,
        modelPreferences,
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

    // Fetch instances and model preferences on mount
    useEffect(() => {
        Promise.all([fetchInstances(), fetchModelPreferences()]).finally(() => {
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

    // Convert modelPreferences map to array
    const preferencesList: ModelPreference[] = useMemo(() => {
        const values = Object.values(modelPreferences);
        // Deduplicate in case case-insensitive duplicates exist in store dictionary
        const seen = new Set<string>();
        const unique: ModelPreference[] = [];
        for (const p of values) {
            const idKey = p.id.toLowerCase();
            if (!seen.has(idKey)) {
                seen.add(idKey);
                unique.push(p);
            }
        }
        return unique;
    }, [modelPreferences]);

    const getInstanceColor = (type: string): string => {
        const t = (type || "").toLowerCase();
        if (t === "gemini") return "bg-amber-50 text-amber-700 border-amber-200";
        if (t === "openai") return "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (t === "openrouter") return "bg-indigo-50 text-indigo-700 border-indigo-200";
        if (t === "anthropic") return "bg-orange-50 text-orange-700 border-orange-200";
        if (t === "deepseek") return "bg-blue-50 text-blue-700 border-blue-200";
        return "bg-purple-50 text-purple-700 border-purple-200";
    };

    // Resolve the hosting instance for a given model ID
    const getInstanceForModel = useCallback(
        (modelId: string): { name: string; type: string; color: string } => {
            // 1. Direct match in fetched instance models
            for (const inst of instances) {
                const models = instanceModelsMap[inst.id] || [];
                if (models.some((m) => m.id === modelId || m.name === modelId)) {
                    return {
                        name: inst.properties?.name || inst.type,
                        type: inst.type,
                        color: getInstanceColor(inst.type),
                    };
                }
            }

            // 2. ID prefix match (e.g. dummy model IDs like <instance_id>-m1)
            for (const inst of instances) {
                if (modelId.startsWith(inst.id)) {
                    return {
                        name: inst.properties?.name || inst.type,
                        type: inst.type,
                        color: getInstanceColor(inst.type),
                    };
                }
            }

            // 3. Provider heuristics based on model naming patterns
            const lowerId = modelId.toLowerCase();

            if (lowerId.includes("gemini") || lowerId.includes("gemma")) {
                const geminiInst = instances.find((i) => i.type === "gemini" || i.properties?.url?.includes("generativelanguage"));
                if (geminiInst) {
                    return {
                        name: geminiInst.properties?.name || "Google Gemini",
                        type: "gemini",
                        color: getInstanceColor("gemini"),
                    };
                }
                return { name: "Google Gemini", type: "gemini", color: getInstanceColor("gemini") };
            }

            if (lowerId.includes("gpt") || lowerId.includes("o1") || lowerId.includes("o3")) {
                const openaiInst = instances.find((i) => i.type === "openai");
                if (openaiInst) {
                    return {
                        name: openaiInst.properties?.name || "OpenAI ChatGPT",
                        type: "openai",
                        color: getInstanceColor("openai"),
                    };
                }
                return { name: "OpenAI ChatGPT", type: "openai", color: getInstanceColor("openai") };
            }

            // 4. Default to first Ollama instance or fallback
            const ollamaInst = instances.find((i) => i.type === "ollama");
            if (ollamaInst) {
                return {
                    name: ollamaInst.properties?.name || "Ollama",
                    type: "ollama",
                    color: getInstanceColor("ollama"),
                };
            }

            return { name: "Ollama Instance", type: "ollama", color: getInstanceColor("ollama") };
        },
        [instances, instanceModelsMap],
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

    // Filtered list based on search
    const filteredPreferences = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return preferencesList;

        return preferencesList.filter((pref) => {
            const charName = (getCharacterName(pref.character) || pref.name || "").toLowerCase();
            const modelId = pref.id.toLowerCase();
            const instInfo = getInstanceForModel(pref.id);
            const instName = instInfo.name.toLowerCase();
            const instType = instInfo.type.toLowerCase();
            const voice = (pref.voice || "").toLowerCase();

            return charName.includes(q) || modelId.includes(q) || instName.includes(q) || instType.includes(q) || voice.includes(q);
        });
    }, [preferencesList, searchQuery, getInstanceForModel]);

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
                setDeletingPref(null);
            }
        } catch (err) {
            console.error("Failed to delete model preference:", err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs">
                <div>
                    <h3 className="text-xl font-bold text-[#202022] tracking-tight">Manage Model Preferences</h3>
                    <p className="text-sm text-[#7a7d90] mt-1 font-medium">
                        Configure character persona, profile avatar, Kokoro TTS voice, and context window limits for each AI model.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/20">
                        {preferencesList.length} {preferencesList.length === 1 ? "Model Preference" : "Model Preferences"}
                    </span>
                </div>
            </div>

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
                    <h4 className="font-bold text-[#202022] text-base">{searchQuery ? "No model preferences match your search" : "No Model Preferences Configured"}</h4>
                    <p className="text-xs text-[#7a7d90] max-w-sm mx-auto">
                        {searchQuery
                            ? "Try adjusting your search query to find models by name, ID, or instance."
                            : "Model preferences customize AI personality, avatar, and voice. They are created when assigning personas or editing model settings."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
                    {filteredPreferences.map((pref) => {
                        const charName = getCharacterName(pref.character) || pref.name || pref.id;
                        const avatarSrc = formatAvatarPicture(pref.picture);
                        const instInfo = getInstanceForModel(pref.id);
                        const voiceLabel = getVoiceDisplayName(pref.voice);

                        return (
                            // <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div
                                key={pref.id}
                                className="p-5 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#7678ed]/40 transition-all"
                            >
                                <div className="space-y-3 flex">
                                    {/* Avatar */}
                                    <div
                                        style={!avatarSrc ? { background: getAvatarBg(charName) } : undefined}
                                        className="w-30 h-30 mr-4 rounded-2xl border border-[#e8ebf3] overflow-hidden flex items-center justify-center shrink-0 shadow-xs relative bg-[#eaecf9]"
                                    >
                                        {avatarSrc ? (
                                            <img
                                                src={avatarSrc}
                                                alt={charName}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    // Fallback on image broken
                                                    (e.target as HTMLElement).style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <span className="text-white font-bold text-xl uppercase">{charName.slice(0, 2)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[#202022] text-base leading-snug">{charName}</h4>
                                        <span className="text-[11px] font-mono text-[#a0a3b5] block mt-0.5 mb-2">{voiceLabel}</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge key={instInfo.name} variant="primary">
                                                @{instInfo.name}
                                            </Badge>
                                            <Badge variant="secondary" className="font-mono" title={pref.id}>
                                                {pref.id}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className={"flex items-center justify-between pt-3 border-t border-[#e8ebf3] gap-2 justify-end"}>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => router.push(`/settings/model-preferences/${encodeURIComponent(pref.id)}`)}
                                            className="p-1.5 text-[#7a7d90] hover:text-[#7678ed] transition-colors rounded-lg hover:bg-[#eaecf9]"
                                            title="Edit"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenDelete(pref)}
                                            className="p-1.5 text-[#7a7d90] hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                                            title="Delete"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            // </div>
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
                            <span className="font-bold text-[#202022]">{getCharacterName(deletingPref.character) || deletingPref.name || deletingPref.id}</span> (
                            <code className="font-mono text-[#7678ed]">{deletingPref.id}</code>)? This will revert the model to default settings.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e8ebf3]">
                            <button
                                onClick={() => setDeletingPref(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#4b4e6d] text-xs font-semibold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
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
