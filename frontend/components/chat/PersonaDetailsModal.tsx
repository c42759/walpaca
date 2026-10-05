"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatAvatarPicture, DEFAULT_MODEL_AVATAR } from "@/lib/characterUtils";
import { TTS_VOICE_GROUPS } from "@/lib/voiceConstants";

export interface PersonaDetailsData {
    name: string;
    avatar?: string | null;
    modelName?: string;
    preferenceName?: string;
    modelId?: string;
    instanceName?: string;
    voice?: string | null;
    numCtx?: number | null;
    systemPrompt?: string;
    firstMes?: string;
    alternateGreetings?: string[];
    generationSettings?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
        repeat_penalty?: number;
        presence_penalty?: number;
        frequency_penalty?: number;
    };
    characterBook?: {
        name?: string;
        entries?: Array<{
            name?: string;
            keys?: string[] | string;
            content?: string;
            enabled?: boolean;
        }>;
    };
    isCustomPersona: boolean;
}

export interface PersonaDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: PersonaDetailsData | null;
}

export const PersonaDetailsModal: React.FC<PersonaDetailsModalProps> = ({ isOpen, onClose, data }) => {
    const [activeTab, setActiveTab] = useState<"system" | "greetings" | "samplers" | "lorebook">("system");
    const [copiedSystemPrompt, setCopiedSystemPrompt] = useState<boolean>(false);
    const prevIsOpenRef = React.useRef<boolean>(false);

    // Reset tab to "system" ONLY on modal open transition
    useEffect(() => {
        if (isOpen && !prevIsOpenRef.current) {
            setActiveTab("system");
            setCopiedSystemPrompt(false);
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen]);

    // Keyboard ESC listener
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const voiceInfo = useMemo(() => {
        if (!data?.voice) return null;
        for (const group of TTS_VOICE_GROUPS) {
            const match = group.voices.find((v) => v.id === data.voice);
            if (match) return match;
        }
        return {
            id: data.voice,
            name: data.voice,
            flag: "🔊",
            language: "Voice",
            label: data.voice,
        };
    }, [data?.voice]);

    if (!isOpen || !data) return null;

    const avatarSrc = formatAvatarPicture(data.avatar) || DEFAULT_MODEL_AVATAR;
    const hasLorebookEntries = (data.characterBook?.entries || []).length > 0;

    const handleCopyPrompt = () => {
        if (!data.systemPrompt) return;
        navigator.clipboard.writeText(data.systemPrompt);
        setCopiedSystemPrompt(true);
        setTimeout(() => setCopiedSystemPrompt(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
            <div className="w-full max-w-3xl bg-white rounded-3xl border border-[#e8ebf3] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header Banner */}
                <div className="p-6 border-b border-[#eef0f6] bg-gradient-to-b from-[#f9fafc] to-white shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="relative shrink-0">
                                <img
                                    src={avatarSrc}
                                    alt={data.name}
                                    className="w-18 h-18 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
                                />
                                {data.isCustomPersona ? (
                                    <span
                                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#7678ed] text-white rounded-full flex items-center justify-center text-[11px] shadow-sm border-2 border-white"
                                        title="Custom Persona"
                                    >
                                        ✨
                                    </span>
                                ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-2xl font-bold text-[#202022] truncate tracking-tight">{data.name}</h3>
                                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f0f2f9] text-[#7678ed] border border-[#e0e3f5]">
                                        Read Only
                                    </span>
                                    {data.isCustomPersona && (
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                            Persona
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2.5 mt-1.5 text-xs text-[#8e90a6] flex-wrap">
                                    {(data.modelName || data.modelId) && (
                                        <span className="font-mono bg-[#f4f6fc] text-[#5d6075] px-2 py-0.5 rounded-lg border border-[#e8ebf3]">
                                            Model: {data.modelName || data.modelId}
                                        </span>
                                    )}
                                    {data.instanceName && (
                                        <span className="bg-[#f4f6fc] text-[#5d6075] px-2 py-0.5 rounded-lg border border-[#e8ebf3]">
                                            Instance: {data.instanceName}
                                        </span>
                                    )}
                                    {voiceInfo && (
                                        <span className="bg-[#f4f6fc] text-[#5d6075] px-2 py-0.5 rounded-lg border border-[#e8ebf3] flex items-center gap-1">
                                            <span>{voiceInfo.flag}</span>
                                            <span>{voiceInfo.name}</span>
                                        </span>
                                    )}
                                    {data.numCtx ? (
                                        <span className="bg-[#f4f6fc] text-[#5d6075] px-2 py-0.5 rounded-lg border border-[#e8ebf3]">
                                            Context: {Number(data.numCtx).toLocaleString()} tokens
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-[#8e90a6] hover:text-[#202022] hover:bg-[#eaecf9] transition-colors cursor-pointer shrink-0"
                            title="Close"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 mt-5 border-t border-[#eef0f6] pt-3 overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab("system")}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === "system"
                                    ? "bg-[#7678ed] text-white shadow-xs"
                                    : "text-[#5d6075] hover:bg-[#f0f2f9] hover:text-[#202022]"
                            }`}
                        >
                            <span>📝</span>
                            <span>System Prompt</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("greetings")}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === "greetings"
                                    ? "bg-[#7678ed] text-white shadow-xs"
                                    : "text-[#5d6075] hover:bg-[#f0f2f9] hover:text-[#202022]"
                            }`}
                        >
                            <span>💬</span>
                            <span>Greetings</span>
                            {data.alternateGreetings && data.alternateGreetings.length > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                    activeTab === "greetings" ? "bg-white/30 text-white" : "bg-[#e8ebf3] text-[#5d6075]"
                                }`}>
                                    {1 + data.alternateGreetings.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("samplers")}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === "samplers"
                                    ? "bg-[#7678ed] text-white shadow-xs"
                                    : "text-[#5d6075] hover:bg-[#f0f2f9] hover:text-[#202022]"
                            }`}
                        >
                            <span>⚙️</span>
                            <span>Samplers</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("lorebook")}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === "lorebook"
                                    ? "bg-[#7678ed] text-white shadow-xs"
                                    : "text-[#5d6075] hover:bg-[#f0f2f9] hover:text-[#202022]"
                            }`}
                        >
                            <span>📚</span>
                            <span>Lorebook</span>
                            {hasLorebookEntries && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                    activeTab === "lorebook" ? "bg-white/30 text-white" : "bg-[#e8ebf3] text-[#5d6075]"
                                }`}>
                                    {data.characterBook?.entries?.length || 0}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Tab Content Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* 1. System Prompt Tab */}
                    {activeTab === "system" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-base font-bold text-[#202022]">Unified System Prompt</h4>
                                    <p className="text-xs text-[#8e90a6]">AI personality bio, world scenario, and behavioral instructions.</p>
                                </div>
                                {data.systemPrompt && (
                                    <button
                                        type="button"
                                        onClick={handleCopyPrompt}
                                        className="px-3 py-1.5 rounded-xl border border-[#e8ebf3] bg-[#f9fafc] hover:bg-[#f0f2f9] text-xs font-semibold text-[#5d6075] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                        {copiedSystemPrompt ? (
                                            <>
                                                <span className="text-emerald-600 font-bold">✓ Copied</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                                <span>Copy Prompt</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {data.systemPrompt ? (
                                <div className="bg-[#f8f9fd] border border-[#e8ebf3] rounded-2xl p-4.5 text-sm font-mono text-[#202022] leading-relaxed whitespace-pre-wrap select-text max-h-[380px] overflow-y-auto shadow-inner">
                                    {data.systemPrompt}
                                </div>
                            ) : (
                                <div className="bg-[#f8f9fd] border border-dashed border-[#d8dce8] rounded-2xl p-8 text-center text-[#8e90a6]">
                                    <p className="text-sm">No custom system prompt specified for this assistant.</p>
                                    <p className="text-xs mt-1">Default model behavior and base instructions will apply.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. Greetings Tab */}
                    {activeTab === "greetings" && (
                        <div className="space-y-5">
                            <div>
                                <h4 className="text-base font-bold text-[#202022]">First Message (Primary Greeting)</h4>
                                <p className="text-xs text-[#8e90a6] mb-2.5">Opening statement used to start conversations with this persona.</p>
                                {data.firstMes ? (
                                    <div className="bg-[#f8f9fd] border border-[#e8ebf3] rounded-2xl p-4.5 text-sm text-[#202022] leading-relaxed whitespace-pre-wrap select-text shadow-inner">
                                        {data.firstMes}
                                    </div>
                                ) : (
                                    <div className="bg-[#f8f9fd] border border-dashed border-[#d8dce8] rounded-2xl p-6 text-center text-xs text-[#8e90a6]">
                                        No primary greeting configured.
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="text-base font-bold text-[#202022]">
                                    Alternate Greetings {data.alternateGreetings && data.alternateGreetings.length > 0 ? `(${data.alternateGreetings.length})` : ""}
                                </h4>
                                <p className="text-xs text-[#8e90a6] mb-2.5">Alternative openers available when starting or swiping.</p>
                                {data.alternateGreetings && data.alternateGreetings.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.alternateGreetings.map((greet, idx) => (
                                            <div key={idx} className="bg-[#f8f9fd] border border-[#e8ebf3] rounded-2xl p-4 text-sm text-[#202022] leading-relaxed whitespace-pre-wrap select-text shadow-inner">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-[11px] font-bold text-[#7678ed] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                                        Alternative #{idx + 1}
                                                    </span>
                                                </div>
                                                {greet}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-[#f8f9fd] border border-dashed border-[#d8dce8] rounded-2xl p-6 text-center text-xs text-[#8e90a6]">
                                        No alternate greetings configured.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. Samplers Tab */}
                    {activeTab === "samplers" && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-base font-bold text-[#202022]">Sampler & Generation Parameters</h4>
                                <p className="text-xs text-[#8e90a6]">Inference tuning hyperparameters active for response generation.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                <div className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-[#5d6075]">Temperature</span>
                                        <span className="text-sm font-mono font-bold text-[#7678ed]">
                                            {data.generationSettings?.temperature ?? 0.7}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#8e90a6] leading-relaxed">
                                        Controls randomness. Lower values produce focused, deterministic replies; higher values spark creativity.
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-[#5d6075]">Top P (Nucleus Sampling)</span>
                                        <span className="text-sm font-mono font-bold text-[#7678ed]">
                                            {data.generationSettings?.top_p ?? 0.9}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#8e90a6] leading-relaxed">
                                        Cumulative probability threshold for candidate tokens to maintain coherence.
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-[#5d6075]">Top K</span>
                                        <span className="text-sm font-mono font-bold text-[#7678ed]">
                                            {data.generationSettings?.top_k ?? 40}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#8e90a6] leading-relaxed">
                                        Limits selection to the top K most likely candidate tokens.
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-[#5d6075]">Repeat Penalty</span>
                                        <span className="text-sm font-mono font-bold text-[#7678ed]">
                                            {data.generationSettings?.repeat_penalty ?? 1.1}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#8e90a6] leading-relaxed">
                                        Penalizes repeating recently generated tokens to avoid repetitive loops.
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-[#5d6075]">Presence Penalty</span>
                                        <span className="text-sm font-mono font-bold text-[#7678ed]">
                                            {data.generationSettings?.presence_penalty ?? 0.0}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#8e90a6] leading-relaxed">
                                        Encourages introducing new topics by penalizing tokens based on prior presence.
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-[#5d6075]">Frequency Penalty</span>
                                        <span className="text-sm font-mono font-bold text-[#7678ed]">
                                            {data.generationSettings?.frequency_penalty ?? 0.0}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#8e90a6] leading-relaxed">
                                        Reduces the likelihood of repeating words in proportion to their frequency.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Lorebook Tab */}
                    {activeTab === "lorebook" && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-base font-bold text-[#202022]">
                                    {data.characterBook?.name || "Embedded Lorebook"}
                                </h4>
                                <p className="text-xs text-[#8e90a6]">World lore entries triggered by conversation keywords.</p>
                            </div>

                            {!hasLorebookEntries ? (
                                <div className="bg-[#f8f9fd] border border-dashed border-[#d8dce8] rounded-2xl p-8 text-center text-[#8e90a6]">
                                    <p className="text-sm">No embedded lorebook entries linked to this persona.</p>
                                    <p className="text-xs mt-1">Lorebook entries trigger specific context memories when keywords are detected in chat.</p>
                                </div>
                            ) : (
                            <div className="space-y-3">
                                {(data.characterBook?.entries || []).map((entry, idx) => {
                                    const keysList = Array.isArray(entry.keys)
                                        ? entry.keys
                                        : typeof entry.keys === "string"
                                        ? entry.keys.split(",").map((k) => k.trim()).filter(Boolean)
                                        : [];
                                    const isEnabled = entry.enabled !== false;

                                    return (
                                        <div key={idx} className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc] space-y-2">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-[#202022]">{entry.name || `Entry #${idx + 1}`}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                        isEnabled
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                            : "bg-gray-100 text-gray-500 border-gray-200"
                                                    }`}>
                                                        {isEnabled ? "Active" : "Disabled"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {keysList.map((keyStr, kIdx) => (
                                                        <span key={kIdx} className="text-[11px] font-mono bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-lg">
                                                            {keyStr}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            {entry.content && (
                                                <p className="text-xs text-[#5d6075] bg-white border border-[#e8ebf3] rounded-xl p-3 leading-relaxed whitespace-pre-wrap select-text">
                                                    {entry.content}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 px-6 border-t border-[#eef0f6] bg-[#f9fafc] flex items-center justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-sm font-semibold rounded-2xl transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
