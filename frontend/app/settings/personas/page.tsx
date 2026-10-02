"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { ManagePersonasPanel, PersonaTemplate, LorebookTemplate } from "@/components/settings/ManagePersonasPanel";

export default function PersonasSettingsPage() {
    const { setCurrentView, instances, fetchInstances, fetchInstanceModels, fetchModelPreferences } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-personas");

    // --- Persona State & Modals ---
    const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplate[]>([]);
    const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplate[]>([]);
    const [isPersonaLoading, setIsPersonaLoading] = useState<boolean>(false);
    const [applyPersonaModalTemplate, setApplyPersonaModalTemplate] = useState<PersonaTemplate | null>(null);
    const [applyPersonaSelectedModelId, setApplyPersonaSelectedModelId] = useState<string>("");
    const [isApplyingPersona, setIsApplyingPersona] = useState<boolean>(false);
    const [deletingPersonaTemplate, setDeletingPersonaTemplate] = useState<PersonaTemplate | null>(null);
    const [availableModelsList, setAvailableModelsList] = useState<any[]>([]);

    const fetchPersonaTemplates = async () => {
        setIsPersonaLoading(true);
        try {
            const res = await fetch(`${getApiUrl()}/personas`);
            if (res.ok) {
                const data = await res.json();
                setPersonaTemplates(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.warn("Could not fetch persona templates:", err);
        } finally {
            setIsPersonaLoading(false);
        }
    };

    const fetchLorebookTemplates = async () => {
        try {
            const res = await fetch(`${getApiUrl()}/lorebook`);
            if (res.ok) {
                const data = await res.json();
                setLorebookTemplates(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.warn("Could not fetch lorebook templates:", err);
        }
    };

    useEffect(() => {
        fetchPersonaTemplates();
        fetchLorebookTemplates();
        fetchInstances();
    }, [fetchInstances]);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            if (instances.length > 0) {
                const allMods: any[] = [];
                for (const inst of instances) {
                    try {
                        const mods = await fetchInstanceModels(inst.id);
                        if (Array.isArray(mods)) {
                            allMods.push(...mods);
                        }
                    } catch (e) {
                        console.warn("Could not fetch models for instance:", inst.id, e);
                    }
                }
                if (isMounted) {
                    setAvailableModelsList(allMods);
                }
            }
        })();
        return () => {
            isMounted = false;
        };
    }, [instances, fetchInstanceModels]);

    const handleApplyPersonaToModel = async (template: PersonaTemplate, targetModelId: string) => {
        if (!targetModelId) return;
        setIsApplyingPersona(true);
        try {
            const payload = {
                id: targetModelId,
                picture: template.picture || null,
                voice: template.voice || "af_heart",
                num_ctx: template.num_ctx ? Number(template.num_ctx) : undefined,
                character: {
                    name: template.name,
                    description: template.description || "",
                    personality: template.description || "",
                    scenario: template.scenario || "",
                    system_prompt: template.system_prompt || "",
                    post_history_instructions: template.post_history_instructions || "",
                    first_mes: template.first_mes || "",
                    alternate_greetings: template.alternate_greetings || [],
                    character_book: template.character_book || null,
                    generation_settings: template.generation_settings || null,
                },
            };

            const res = await fetch(`${getApiUrl()}/model-preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                await fetchModelPreferences();
                setApplyPersonaModalTemplate(null);
                alert(`Successfully applied persona '${template.name}' to model '${targetModelId}'!`);
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed applying persona to model");
            }
        } catch (err: any) {
            console.error("Error applying persona to model:", err);
            alert(err.message || "Error applying persona to model");
        } finally {
            setIsApplyingPersona(false);
        }
    };

    const handleConfirmDeletePersonaTemplate = async () => {
        if (!deletingPersonaTemplate) return;
        try {
            const filename = deletingPersonaTemplate.filename;
            const res = await fetch(`${getApiUrl()}/personas/${encodeURIComponent(filename)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setDeletingPersonaTemplate(null);
                fetchPersonaTemplates();
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed deleting persona template");
            }
        } catch (err: any) {
            console.error("Error deleting persona template:", err);
            alert(err.message || "Error deleting template");
        }
    };

    return (
        <>
            <div className="flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text">
                {/* 1. SETTINGS CATEGORIES SIDEBAR */}
                <SettingsSidebar activeSettingsCategory={activeSettingsCategory} setActiveSettingsCategory={setActiveSettingsCategory} setCurrentView={setCurrentView} />

                {/* 2. MIDDLE SETTINGS CONTENT AREA */}
                <main className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-3xl mx-auto space-y-8">
                        <ManagePersonasPanel
                            personaTemplates={personaTemplates}
                            lorebookTemplates={lorebookTemplates}
                            isPersonaLoading={isPersonaLoading}
                            getApiUrl={getApiUrl}
                            fetchPersonaTemplates={fetchPersonaTemplates}
                            setApplyPersonaModalTemplate={setApplyPersonaModalTemplate}
                            setApplyPersonaSelectedModelId={setApplyPersonaSelectedModelId}
                            setDeletingPersonaTemplate={setDeletingPersonaTemplate}
                        />
                    </div>
                </main>

                {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
                <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
            </div>

            {/* Apply Persona to Model Modal */}
            {applyPersonaModalTemplate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white">Apply Persona to Model</h3>
                            <button onClick={() => setApplyPersonaModalTemplate(null)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#eaecf9] text-[#7678ed] overflow-hidden flex items-center justify-center shrink-0">
                                    {applyPersonaModalTemplate.picture ? (
                                        <img src={applyPersonaModalTemplate.picture} alt={applyPersonaModalTemplate.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>🎭</span>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-white">{applyPersonaModalTemplate.name}</h4>
                                    <span className="text-[11px] font-mono text-white/50 block">{applyPersonaModalTemplate.filename}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-white/80 mb-1.5">Select Target Model</label>
                                <select
                                    value={applyPersonaSelectedModelId}
                                    onChange={(e) => setApplyPersonaSelectedModelId(e.target.value)}
                                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#7678ed] transition-all cursor-pointer"
                                >
                                    <option value="" className="bg-[#202022] text-white">
                                        Select a model...
                                    </option>
                                    {availableModelsList.map((mod) => (
                                        <option key={mod.id} value={mod.id} className="bg-[#202022] text-white">
                                            {mod.name || mod.id} ({mod.provider || "AI"})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setApplyPersonaModalTemplate(null)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isApplyingPersona || !applyPersonaSelectedModelId}
                                    onClick={() => handleApplyPersonaToModel(applyPersonaModalTemplate, applyPersonaSelectedModelId)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer"
                                >
                                    {isApplyingPersona ? "Applying..." : "Apply Persona"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Persona Confirmation Modal */}
            {deletingPersonaTemplate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-rose-400">Delete Persona?</h3>
                            <button onClick={() => setDeletingPersonaTemplate(null)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="6" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed mb-6">
                            Are you sure you want to delete persona template <strong className="text-white">&ldquo;{deletingPersonaTemplate.name}&rdquo;</strong>? This action
                            cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeletingPersonaTemplate(null)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeletePersonaTemplate}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/30 cursor-pointer"
                            >
                                Delete Persona
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
