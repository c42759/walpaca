"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore, ModelPreference } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { getCharacterName, isInternalId } from "@/lib/characterUtils";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { Badge } from "@/components/ui/Badge";
import { CloseIcon } from "@/components/icons/Icons";
import {
    PersonaEditorForm,
    PersonaFormData,
    PersonaTemplateItem,
    LorebookTemplateItem,
} from "@/components/settings/PersonaEditorForm";

export default function EditModelPreferencePage() {
    const params = useParams();
    const router = useRouter();
    const rawModelId = typeof params?.model_id === "string" ? params.model_id : "";
    const modelId = decodeURIComponent(rawModelId);

    const {
        setCurrentView,
        instances,
        fetchInstances,
        modelPreferences,
        fetchModelPreferences,
        setModelPreference: setStoreModelPreference,
        instanceModelsMap,
        fetchInstanceModels,
    } = useAppStore();

    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-model-preferences");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // External templates for copying
    const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplateItem[]>([]);
    const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplateItem[]>([]);

    // Fetched preference object
    const [fetchedPref, setFetchedPref] = useState<ModelPreference | null>(null);

    // Instance and Model relocation state
    const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
    const [selectedModelId, setSelectedModelId] = useState<string>("");
    const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
    const [customModelInput, setCustomModelInput] = useState<string>("");

    // Initial load: templates and instances
    useEffect(() => {
        let isMounted = true;
        const loadInitial = async () => {
            try {
                const [prefRes, insts, lRes, pRes] = await Promise.all([
                    fetchModelPreferences(),
                    fetchInstances(),
                    fetch(`${getApiUrl()}/lorebook`),
                    fetch(`${getApiUrl()}/personas`),
                ]);

                if (isMounted) {
                    if (lRes.ok) {
                        const lData = await lRes.json();
                        setLorebookTemplates(Array.isArray(lData) ? lData : []);
                    }
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        setPersonaTemplates(Array.isArray(pData) ? pData : []);
                    }

                    if (insts && Array.isArray(insts)) {
                        for (const inst of insts) {
                            fetchInstanceModels(inst.id).catch(() => {});
                        }
                    }
                }
            } catch (err) {
                console.warn("Error loading settings templates:", err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadInitial();
        return () => {
            isMounted = false;
        };
    }, [fetchModelPreferences, fetchInstances, fetchInstanceModels]);

    // Resolve preference from store or fetch directly
    useEffect(() => {
        let isMounted = true;
        const loadPref = async () => {
            const existing = modelPreferences[modelId] || modelPreferences[modelId.toLowerCase()];
            if (existing) {
                if (isMounted) setFetchedPref(existing);
                return;
            }
            try {
                const res = await fetch(`${getApiUrl()}/model-preferences/${encodeURIComponent(modelId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && data && (data.character || data.picture || data.voice || data.num_ctx)) {
                        setFetchedPref(data);
                    }
                }
            } catch {
                // Ignore fallback
            }
        };

        if (modelId) {
            loadPref();
        }

        return () => {
            isMounted = false;
        };
    }, [modelId, modelPreferences]);

    // Current preference object
    const currentPref: ModelPreference | null = useMemo(() => {
        return fetchedPref || modelPreferences[modelId] || modelPreferences[modelId.toLowerCase()] || null;
    }, [fetchedPref, modelPreferences, modelId]);

    // Synchronize instance and model selection when currentPref or instances are available
    useEffect(() => {
        if (currentPref) {
            const targetInstId =
                currentPref.instance_id ||
                instances.find((i) => i.is_enabled)?.id ||
                instances[0]?.id ||
                "";
            setSelectedInstanceId((prev) => prev || targetInstId);

            let targetModel = "";
            if (currentPref.model_name && !isInternalId(currentPref.model_name)) {
                targetModel = currentPref.model_name;
            } else if (currentPref.model_id && !isInternalId(currentPref.model_id)) {
                targetModel = currentPref.model_id;
            } else if (!isInternalId(modelId)) {
                targetModel = modelId;
            }

            if (targetModel) {
                setSelectedModelId((prev) => prev || targetModel);
            }
        } else if (instances.length > 0 && !selectedInstanceId) {
            const defaultInstId = instances.find((i) => i.is_enabled)?.id || instances[0]?.id || "";
            setSelectedInstanceId(defaultInstId);
            if (!isInternalId(modelId)) {
                setSelectedModelId(modelId);
            }
        }
    }, [currentPref, instances, modelId, selectedInstanceId]);

    // Fetch models when selected instance changes
    useEffect(() => {
        if (selectedInstanceId) {
            fetchInstanceModels(selectedInstanceId).catch(() => {});
        }
    }, [selectedInstanceId, fetchInstanceModels]);

    // Available models for currently selected instance
    const availableInstanceModels = useMemo(() => {
        if (!selectedInstanceId) return [];
        return instanceModelsMap[selectedInstanceId] || [];
    }, [selectedInstanceId, instanceModelsMap]);

    // When availableInstanceModels load and selectedModelId is still empty or is an internal ID, pick first discovered model
    useEffect(() => {
        if (availableInstanceModels.length > 0 && (!selectedModelId || isInternalId(selectedModelId))) {
            const firstClean = availableInstanceModels.find((m) => !isInternalId(m.name || m.id));
            if (firstClean) {
                setSelectedModelId(firstClean.name || firstClean.id);
            }
        }
    }, [availableInstanceModels, selectedModelId]);

    // Resolve hosting instance display
    const instanceInfo = useMemo(() => {
        const targetInstId = selectedInstanceId || currentPref?.instance_id;
        if (targetInstId) {
            const match = instances.find((i) => i.id === targetInstId);
            if (match) {
                return {
                    name: match.properties?.name || match.type,
                    type: match.type,
                };
            }
        }
        return null;
    }, [selectedInstanceId, currentPref, instances]);

    const initialFormData: Partial<PersonaFormData> | undefined = useMemo(() => {
        const char = currentPref?.character || {};
        const charData = (char as any).data || char;
        const charName = getCharacterName(char) || (!isInternalId(currentPref?.name) ? currentPref?.name : undefined) || (!isInternalId(currentPref?.model_name) ? currentPref?.model_name : undefined) || (!isInternalId(modelId) ? modelId : "Persona");

        return {
            name: charName,
            description: charData.description || charData.personality || currentPref?.description || "",
            personality: charData.personality || charData.description || currentPref?.description || "",
            scenario: charData.scenario || "",
            system_prompt: charData.system_prompt || "",
            post_history_instructions: charData.post_history_instructions || "",
            first_mes: charData.first_mes || "",
            alternate_greetings: charData.alternate_greetings || [],
            voice: currentPref?.voice || "af_heart",
            picture: currentPref?.picture || "",
            num_ctx: currentPref?.num_ctx || 8192,
            generation_settings: charData.generation_settings || {
                temperature: 0.7,
                top_p: 0.9,
                top_k: 40,
                repeat_penalty: 1.1,
                presence_penalty: 0.0,
                frequency_penalty: 0.0,
            },
            character_book: charData.character_book
                ? {
                      name: charData.character_book.name || `${charName} Lorebook`,
                      entries: (charData.character_book.entries || []).map((e: any) => ({
                          name: e.name || e.comment || "Entry",
                          keys: Array.isArray(e.keys)
                              ? e.keys
                              : String(e.keys || "")
                                    .split(",")
                                    .map((k) => k.trim())
                                    .filter(Boolean),
                          content: e.content || e.description || "",
                          enabled: e.enabled !== false,
                      })),
                  }
                : undefined,
        };
    }, [currentPref, modelId]);

    const handleSaveModelPreference = useCallback(
        async (payload: PersonaFormData) => {
            setIsSaving(true);
            setSaveFeedback(null);

            const characterPayload = {
                name: payload.name,
                description: payload.description,
                personality: payload.personality,
                scenario: payload.scenario,
                system_prompt: payload.system_prompt,
                post_history_instructions: payload.post_history_instructions,
                first_mes: payload.first_mes,
                alternate_greetings: payload.alternate_greetings,
                voice: payload.voice,
                picture: payload.picture,
                num_ctx: payload.num_ctx,
                generation_settings: payload.generation_settings,
                character_book: payload.character_book,
            };

            let effectiveModelId = "";
            if (isCustomModel && customModelInput.trim()) {
                effectiveModelId = customModelInput.trim();
            } else if (selectedModelId && !isInternalId(selectedModelId)) {
                effectiveModelId = selectedModelId;
            } else if (currentPref?.model_name && !isInternalId(currentPref.model_name)) {
                effectiveModelId = currentPref.model_name;
            } else if (currentPref?.model_id && !isInternalId(currentPref.model_id)) {
                effectiveModelId = currentPref.model_id;
            } else if (availableInstanceModels.length > 0) {
                const firstClean = availableInstanceModels.find((m) => !isInternalId(m.name || m.id));
                effectiveModelId = firstClean ? (firstClean.name || firstClean.id) : (availableInstanceModels[0].name || availableInstanceModels[0].id);
            } else if (!isInternalId(modelId)) {
                effectiveModelId = modelId;
            } else {
                effectiveModelId = "default";
            }

            const bodyPayload: any = {
                id: currentPref?.id || modelId,
                instance_id: selectedInstanceId || currentPref?.instance_id,
                model_id: effectiveModelId,
                picture: payload.picture || null,
                voice: payload.voice,
                num_ctx: payload.num_ctx,
                character: characterPayload,
            };

            try {
                const res = await fetch(`${getApiUrl()}/model-preferences`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(bodyPayload),
                });

                if (res.ok) {
                    const saved = await res.json();
                    if (saved?.id) {
                        setStoreModelPreference(saved.id, saved);
                    }
                    await fetchModelPreferences(true);
                    setSaveFeedback({ type: "success", message: "Model preference saved and assigned successfully." });
                    setTimeout(() => {
                        router.push("/settings/model-preferences");
                    }, 600);
                } else {
                    const err = await res.json().catch(() => ({}));
                    setSaveFeedback({ type: "error", message: err.error || "Failed saving model preference" });
                }
            } catch (err: any) {
                console.error("Error saving model preference:", err);
                setSaveFeedback({ type: "error", message: err.message || "Error saving model preference" });
            } finally {
                setIsSaving(false);
            }
        },
        [
            currentPref,
            modelId,
            selectedInstanceId,
            selectedModelId,
            isCustomModel,
            customModelInput,
            router,
            setStoreModelPreference,
            fetchModelPreferences,
        ]
    );

    const displayName = initialFormData?.name || currentPref?.model_name || modelId;

    // Instance & Model Selector JSX to be rendered before Section 1
    const instanceModelSelectorTopContent = (
        <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
            <div className="border-b border-[#e8ebf3] pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider">
                    Instance &amp; Model Assignment
                </h4>
                <span className="text-xs text-[#7a7d90] font-medium">
                    Move or re-assign this persona preference to another instance or AI model
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. INSTANCE SELECTOR */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#5d6075]">
                        Hosting Instance <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={selectedInstanceId}
                        onChange={(e) => {
                            const newInstId = e.target.value;
                            setSelectedInstanceId(newInstId);
                            // Auto-select first model from new instance if available
                            const newInstModels = instanceModelsMap[newInstId] || [];
                            if (newInstModels.length > 0 && !newInstModels.some((m) => m.name === selectedModelId || m.id === selectedModelId)) {
                                setSelectedModelId(newInstModels[0].name || newInstModels[0].id);
                                setIsCustomModel(false);
                            }
                        }}
                        className="w-full bg-white border border-[#e8ebf3] rounded-xl px-3.5 py-2.5 text-xs text-[#202022] outline-none focus:border-[#7678ed] transition-colors cursor-pointer"
                    >
                        {instances.map((inst) => {
                            const instName = inst.properties?.name || inst.type;
                            return (
                                <option key={inst.id} value={inst.id}>
                                    {instName} ({inst.type}){inst.is_enabled ? " — Active" : ""}
                                </option>
                            );
                        })}
                    </select>
                    <p className="text-[11px] text-[#7a7d90]">
                        Select which server/provider instance runs this model preference.
                    </p>
                </div>

                {/* 2. MODEL SELECTOR */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-[#5d6075]">
                            Target AI Model <span className="text-rose-500">*</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                setIsCustomModel(!isCustomModel);
                                if (!isCustomModel && !customModelInput) {
                                    setCustomModelInput(selectedModelId);
                                }
                            }}
                            className="text-[11px] font-semibold text-[#7678ed] hover:underline cursor-pointer"
                        >
                            {isCustomModel ? "Pick from discovered list" : "Enter custom model name"}
                        </button>
                    </div>

                    {isCustomModel ? (
                        <input
                            type="text"
                            value={customModelInput}
                            onChange={(e) => setCustomModelInput(e.target.value)}
                            placeholder="e.g., llama3.2:latest or gpt-4o"
                            className="w-full bg-white border border-[#e8ebf3] rounded-xl px-3.5 py-2.5 text-xs text-[#202022] outline-none focus:border-[#7678ed] font-mono transition-colors"
                        />
                    ) : (
                        <select
                            value={selectedModelId}
                            onChange={(e) => setSelectedModelId(e.target.value)}
                            className="w-full bg-white border border-[#e8ebf3] rounded-xl px-3.5 py-2.5 text-xs text-[#202022] outline-none focus:border-[#7678ed] transition-colors cursor-pointer font-mono"
                        >
                            {availableInstanceModels.length > 0 ? (
                                availableInstanceModels.map((m) => {
                                    const mVal = m.name || m.id;
                                    return (
                                        <option key={m.id || m.name} value={mVal}>
                                            {m.name || m.id}
                                        </option>
                                    );
                                })
                            ) : (
                                <option value={selectedModelId || modelId}>
                                    {selectedModelId || modelId}
                                </option>
                            )}
                        </select>
                    )}

                    <p className="text-[11px] text-[#7a7d90]">
                        {availableInstanceModels.length > 0
                            ? `${availableInstanceModels.length} models discovered on selected instance.`
                            : "Specify model name for this instance."}
                    </p>
                </div>
            </div>
        </div>
    );

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
                {saveFeedback && (
                    <div
                        className={`max-w-3xl mx-auto mb-6 p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                            saveFeedback.type === "success"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                    >
                        <span>{saveFeedback.message}</span>
                        <button
                            type="button"
                            onClick={() => setSaveFeedback(null)}
                            className="p-1 text-current opacity-60 hover:opacity-100 transition-opacity rounded-md cursor-pointer"
                            title="Dismiss"
                        >
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {isLoading && !currentPref ? (
                    <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">
                        Loading model preference...
                    </div>
                ) : (
                    <PersonaEditorForm
                        title={`Edit Model Preference: ${displayName}`}
                        subtitle="Configure character persona, profile avatar, Kokoro TTS voice, context window limits, and lorebook for this AI model."
                        badgeText={selectedModelId || currentPref?.model_name || (currentPref?.id ? currentPref.id.slice(0, 12) + "..." : modelId)}
                        extraHeaderBadges={
                            instanceInfo && (
                                <Badge variant="primary" className="text-xs">
                                    @{instanceInfo.name}
                                </Badge>
                            )
                        }
                        topContent={instanceModelSelectorTopContent}
                        saveButtonLabel="Save Preference"
                        isSaving={isSaving}
                        initialData={initialFormData}
                        availablePersonaTemplates={personaTemplates}
                        availableLorebookTemplates={lorebookTemplates}
                        currentIdentifier={currentPref?.id || modelId}
                        onSave={handleSaveModelPreference}
                        onCancel={() => router.push("/settings/model-preferences")}
                    />
                )}
            </main>

            {/* 3. RIGHT SETTINGS HELP SIDEBAR */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
