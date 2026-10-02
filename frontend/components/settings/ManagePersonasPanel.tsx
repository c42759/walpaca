import React, { useState } from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input, Textarea } from "../ui/Input";
import { PlusIcon, EditIcon, TrashIcon, CheckIcon, SearchIcon, ChevronIcon } from "../icons/Icons";
import { TTS_VOICE_GROUPS, getVoiceDisplayName } from "@/lib/voiceConstants";

export interface PersonaTemplate {
    filename: string;
    name: string;
    description?: string;
    personality?: string;
    scenario?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    first_mes?: string;
    alternate_greetings?: string[];
    picture?: string | null;
    voice?: string | null;
    num_ctx?: number | null;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    character_book?: {
        name?: string;
        description?: string;
        entries?: Array<{
            name?: string;
            keys?: string[] | string;
            content?: string;
            comment?: string;
            enabled?: boolean;
        }>;
    } | null;
    generation_settings?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
        repeat_penalty?: number;
        presence_penalty?: number;
        frequency_penalty?: number;
    } | null;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface LorebookTemplate {
    filename: string;
    name: string;
    keys: string[];
    content: string;
    error?: string;
}

export interface ManagePersonasPanelProps {
    personaTemplates: PersonaTemplate[];
    lorebookTemplates: LorebookTemplate[];
    isPersonaLoading: boolean;
    getApiUrl: () => string;
    fetchPersonaTemplates: () => Promise<void>;
    setApplyPersonaModalTemplate: (template: PersonaTemplate | null) => void;
    setApplyPersonaSelectedModelId: (id: string) => void;
    setDeletingPersonaTemplate: (template: PersonaTemplate | null) => void;
}

export const ManagePersonasPanel: React.FC<ManagePersonasPanelProps> = ({
    personaTemplates,
    lorebookTemplates,
    isPersonaLoading,
    getApiUrl,
    fetchPersonaTemplates,
    setApplyPersonaModalTemplate,
    setApplyPersonaSelectedModelId,
    setDeletingPersonaTemplate,
}) => {
    const [personaViewMode, setPersonaViewMode] = useState<"list" | "editor">("list");
    const [personaSearchQuery, setPersonaSearchQuery] = useState<string>("");
    const [editingPersonaTemplate, setEditingPersonaTemplate] = useState<PersonaTemplate | null>(null);

    // Form State
    const [personaFormName, setPersonaFormName] = useState<string>("");
    const [personaFormDescription, setPersonaFormDescription] = useState<string>("");
    const [personaFormScenario, setPersonaFormScenario] = useState<string>("");
    const [personaFormSystemPrompt, setPersonaFormSystemPrompt] = useState<string>("");
    const [personaFormPostHistoryInstructions, setPersonaFormPostHistoryInstructions] = useState<string>("");
    const [personaFormFirstMes, setPersonaFormFirstMes] = useState<string>("");
    const [personaFormAlternateGreetings, setPersonaFormAlternateGreetings] = useState<string[]>([]);
    const [personaFormVoice, setPersonaFormVoice] = useState<string>("af_heart");
    const [personaFormPicture, setPersonaFormPicture] = useState<string>("");
    const [personaAvatarPreview, setPersonaAvatarPreview] = useState<string>("");
    const [isUploadingPersonaAvatar, setIsUploadingPersonaAvatar] = useState<boolean>(false);
    const [personaFormNumCtx, setPersonaFormNumCtx] = useState<number>(8192);
    const [personaFormTemperature, setPersonaFormTemperature] = useState<number>(0.7);
    const [personaFormTopP, setPersonaFormTopP] = useState<number>(0.9);
    const [personaFormTopK, setPersonaFormTopK] = useState<number>(40);
    const [personaFormRepeatPenalty, setPersonaFormRepeatPenalty] = useState<number>(1.1);
    const [personaFormPresencePenalty, setPersonaFormPresencePenalty] = useState<number>(0.0);
    const [personaFormFrequencyPenalty, setPersonaFormFrequencyPenalty] = useState<number>(0.0);
    const [personaFormLorebookEntries, setPersonaFormLorebookEntries] = useState<Array<{ name: string; keys: string; content: string; enabled: boolean }>>([]);
    const [personaSaving, setPersonaSaving] = useState<boolean>(false);

    const handleOpenCreatePersonaEditor = () => {
        setEditingPersonaTemplate(null);
        setPersonaFormName("");
        setPersonaFormDescription("");
        setPersonaFormScenario("");
        setPersonaFormSystemPrompt("");
        setPersonaFormPostHistoryInstructions("");
        setPersonaFormFirstMes("");
        setPersonaFormAlternateGreetings([]);
        setPersonaFormVoice("af_heart");
        setPersonaFormPicture("");
        setPersonaAvatarPreview("");
        setPersonaFormNumCtx(8192);
        setPersonaFormTemperature(0.7);
        setPersonaFormTopP(0.9);
        setPersonaFormTopK(40);
        setPersonaFormRepeatPenalty(1.1);
        setPersonaFormPresencePenalty(0.0);
        setPersonaFormFrequencyPenalty(0.0);
        setPersonaFormLorebookEntries([]);
        setPersonaViewMode("editor");
    };

    const handleOpenEditPersonaEditor = (template: PersonaTemplate) => {
        setEditingPersonaTemplate(template);
        setPersonaFormName(template.name || "");
        setPersonaFormDescription(template.description || template.personality || "");
        setPersonaFormScenario(template.scenario || "");
        setPersonaFormSystemPrompt(template.system_prompt || "");
        setPersonaFormPostHistoryInstructions(template.post_history_instructions || "");
        setPersonaFormFirstMes(template.first_mes || template.greeting || "");
        setPersonaFormAlternateGreetings(Array.isArray(template.alternate_greetings) ? [...template.alternate_greetings] : []);
        setPersonaFormVoice(template.voice || "af_heart");
        setPersonaFormPicture(template.picture || "");
        setPersonaAvatarPreview(template.picture || "");
        setPersonaFormNumCtx(template.num_ctx || 8192);
        setPersonaFormTemperature(template.generation_settings?.temperature ?? template.temperature ?? 0.7);
        setPersonaFormTopP(template.generation_settings?.top_p ?? template.top_p ?? 0.9);
        setPersonaFormTopK(template.generation_settings?.top_k ?? template.top_k ?? 40);
        setPersonaFormRepeatPenalty(template.generation_settings?.repeat_penalty ?? template.repeat_penalty ?? 1.1);
        setPersonaFormPresencePenalty(template.generation_settings?.presence_penalty ?? template.presence_penalty ?? 0.0);
        setPersonaFormFrequencyPenalty(template.generation_settings?.frequency_penalty ?? template.frequency_penalty ?? 0.0);

        const rawEntries = template.character_book?.entries || [];
        const parsedEntries = rawEntries.map((e) => ({
            name: e.name || "Entry",
            keys: Array.isArray(e.keys) ? e.keys.join(", ") : e.keys || "",
            content: e.content || "",
            enabled: e.enabled !== false,
        }));
        setPersonaFormLorebookEntries(parsedEntries);
        setPersonaViewMode("editor");
    };

    const handlePersonaAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const localBlobUrl = URL.createObjectURL(file);
        setPersonaAvatarPreview(localBlobUrl);
        setIsUploadingPersonaAvatar(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(`${getApiUrl()}/personas/avatar`, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                if (data.picture) {
                    setPersonaFormPicture(data.picture);
                    setPersonaAvatarPreview(data.picture);
                }
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed uploading avatar image");
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Error uploading persona avatar:", err);
            alert(err.message || "Error uploading avatar image");
        } finally {
            setIsUploadingPersonaAvatar(false);
        }
    };

    const handleAddPersonaGreeting = () => {
        setPersonaFormAlternateGreetings((prev) => [...prev, ""]);
    };

    const handleUpdatePersonaGreeting = (idx: number, val: string) => {
        setPersonaFormAlternateGreetings((prev) => {
            const next = [...prev];
            next[idx] = val;
            return next;
        });
    };

    const handleRemovePersonaGreeting = (idx: number) => {
        setPersonaFormAlternateGreetings((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleAddPersonaLorebookEntry = () => {
        setPersonaFormLorebookEntries((prev) => [...prev, { name: "New Entry", keys: "name, keyword", content: "", enabled: true }]);
    };

    const handleCopyLorebookTemplateToPersona = (filename: string) => {
        if (!filename) return;
        const tmpl = lorebookTemplates.find((l) => l.filename === filename);
        if (!tmpl) return;

        setPersonaFormLorebookEntries((prev) => [
            ...prev,
            {
                name: tmpl.name || tmpl.filename.replace(".json", ""),
                keys: Array.isArray(tmpl.keys) ? tmpl.keys.join(", ") : tmpl.keys || "",
                content: tmpl.content || "",
                enabled: true,
            },
        ]);
    };

    const handleUpdatePersonaLorebookEntry = (
        idx: number,
        field: "name" | "keys" | "content" | "enabled",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any,
    ) => {
        setPersonaFormLorebookEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const handleRemovePersonaLorebookEntry = (idx: number) => {
        setPersonaFormLorebookEntries((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSavePersonaTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!personaFormName.trim()) return;

        setPersonaSaving(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: any = {
                name: personaFormName.trim(),
                description: personaFormDescription.trim(),
                personality: personaFormDescription.trim(),
                scenario: personaFormScenario.trim(),
                system_prompt: personaFormSystemPrompt.trim(),
                post_history_instructions: personaFormPostHistoryInstructions.trim(),
                first_mes: personaFormFirstMes.trim(),
                alternate_greetings: personaFormAlternateGreetings.filter((g) => g.trim().length > 0),
                voice: personaFormVoice,
                picture: personaFormPicture || null,
                num_ctx: Number(personaFormNumCtx) || 8192,
                generation_settings: {
                    temperature: Number(personaFormTemperature),
                    top_p: Number(personaFormTopP),
                    top_k: Number(personaFormTopK),
                    repeat_penalty: Number(personaFormRepeatPenalty),
                    presence_penalty: Number(personaFormPresencePenalty),
                    frequency_penalty: Number(personaFormFrequencyPenalty),
                },
                character_book: {
                    name: `${personaFormName.trim()} Lorebook`,
                    entries: personaFormLorebookEntries.map((e) => ({
                        name: e.name.trim(),
                        keys: e.keys
                            .split(",")
                            .map((k) => k.trim())
                            .filter(Boolean),
                        content: e.content,
                        enabled: e.enabled !== false,
                    })),
                },
            };

            let url = `${getApiUrl()}/personas`;
            let method = "POST";

            if (editingPersonaTemplate) {
                url = `${getApiUrl()}/personas/${encodeURIComponent(editingPersonaTemplate.filename)}`;
                method = "PUT";
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setPersonaViewMode("list");
                fetchPersonaTemplates();
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed saving persona template");
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Error saving persona template:", err);
            alert(err.message || "Error saving template");
        } finally {
            setPersonaSaving(false);
        }
    };

    return (
        <div className="animate-in fade-in duration-200 pb-8">
            {personaViewMode === "editor" ? (
                <form onSubmit={handleSavePersonaTemplate} className="space-y-6">
                    {/* Header Bar */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setPersonaViewMode("list")}
                                className="p-2 rounded-xl bg-[#f0f2fb] hover:bg-[#eaecf9] text-[#7678ed] transition-all cursor-pointer"
                                title="Back to Personas List"
                            >
                                <ChevronIcon direction="left" className="w-5 h-5" />
                            </button>
                            <div>
                                <h3 className="text-xl font-bold text-[#202022] tracking-tight">
                                    {editingPersonaTemplate ? `Edit Persona: ${editingPersonaTemplate.name}` : "Create Persona Template"}
                                </h3>
                                <p className="text-xs text-[#7a7d90] mt-0.5 font-medium">
                                    Configure identity, audio, context size, system prompts, greetings, sampler settings, and lorebook characters.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <Button type="button" variant="outline" onClick={() => setPersonaViewMode("list")}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" isLoading={personaSaving} disabled={!personaFormName.trim()}>
                                Save Persona
                            </Button>
                        </div>
                    </div>

                    {/* 1. Identity & Audio Card */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                        <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">1. Identity & Audio Settings</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Persona / Character Name *"
                                value={personaFormName}
                                onChange={(e) => setPersonaFormName(e.target.value)}
                                placeholder="e.g. Sora Assistant"
                                required
                            />
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-[#5d6075]">Default TTS Voice</label>
                                <select
                                    value={personaFormVoice}
                                    onChange={(e) => setPersonaFormVoice(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-[#7678ed] transition-all cursor-pointer"
                                >
                                    {TTS_VOICE_GROUPS.map((group) => (
                                        <optgroup key={group.gender} label={`${group.gender} Voices`}>
                                            {group.voices.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-xs font-bold text-[#5d6075] mb-1">Persona Avatar Image</label>
                            <div className="flex items-center gap-4 bg-[#f9fafc] p-4 rounded-xl border border-[#e8ebf3]">
                                <div className="w-16 h-16 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/30 overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative group">
                                    {personaAvatarPreview || personaFormPicture ? (
                                        <img src={personaAvatarPreview || personaFormPicture || ""} alt="Avatar Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-2xl">🎭</span>
                                    )}
                                    {isUploadingPersonaAvatar && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">Converting...</div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-1.5">
                                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold cursor-pointer transition-all shadow-xs">
                                        <span>{isUploadingPersonaAvatar ? "Uploading & Converting..." : "Choose Image File..."}</span>
                                        <input type="file" accept="image/*" onChange={handlePersonaAvatarFileChange} className="hidden" />
                                    </label>
                                    <p className="text-[11px] text-[#7a7d90]">
                                        Select an image file (.png, .jpg, .webp). Backend converts to base64 automatically and displays immediately.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Input
                                label="Context Window Size (tokens)"
                                type="number"
                                value={personaFormNumCtx}
                                onChange={(e) => setPersonaFormNumCtx(Number(e.target.value) || 8192)}
                                placeholder="8192"
                            />
                        </div>
                    </div>

                    {/* 2. Prompts & Personality Card */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                        <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">2. Personality & System Prompts</h4>
                        <Textarea
                            label="Description / Personality Bio"
                            rows={3}
                            value={personaFormDescription}
                            onChange={(e) => setPersonaFormDescription(e.target.value)}
                            placeholder="Brief backstory, role, personality traits, and overall character tone..."
                        />
                        <Textarea
                            label="Scenario / Context"
                            rows={2}
                            value={personaFormScenario}
                            onChange={(e) => setPersonaFormScenario(e.target.value)}
                            placeholder="Current setting or environment (e.g. Modern office, futuristic space station...)"
                        />
                        <Textarea
                            label="System Instructions / Main System Prompt"
                            rows={4}
                            value={personaFormSystemPrompt}
                            onChange={(e) => setPersonaFormSystemPrompt(e.target.value)}
                            placeholder="Core system prompt directing AI behavior, output constraints, formatting, etc."
                            className="font-mono"
                        />
                        <Textarea
                            label="Post-History Instructions (Suffix)"
                            rows={2}
                            value={personaFormPostHistoryInstructions}
                            onChange={(e) => setPersonaFormPostHistoryInstructions(e.target.value)}
                            placeholder="Instructions injected at the very end of chat history..."
                        />
                    </div>

                    {/* 3. Greetings Card */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-[#e8ebf3] pb-2">
                            <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider">3. Greetings & Opening Messages</h4>
                            <Button type="button" variant="secondary" size="sm" onClick={handleAddPersonaGreeting}>
                                + Add Alt Greeting
                            </Button>
                        </div>

                        <Textarea
                            label="First Message (Primary Greeting)"
                            rows={2}
                            value={personaFormFirstMes}
                            onChange={(e) => setPersonaFormFirstMes(e.target.value)}
                            placeholder="First message spoken by character when starting a chat session..."
                        />

                        {personaFormAlternateGreetings.length > 0 && (
                            <div className="space-y-2.5 pt-2">
                                <label className="block text-xs font-bold text-[#5d6075]">Alternative Greetings</label>
                                {personaFormAlternateGreetings.map((greeting, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={greeting}
                                            onChange={(e) => handleUpdatePersonaGreeting(idx, e.target.value)}
                                            placeholder={`Alt Greeting #${idx + 1}...`}
                                            className="flex-1 bg-white border border-[#e8ebf3] text-[#202022] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#7678ed]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemovePersonaGreeting(idx)}
                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                            title="Remove"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 4. Generation Settings & Samplers */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                        <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">4. Generation Settings & Samplers</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-[#5d6075] mb-1">Temperature</label>
                                <input
                                    type="number"
                                    step="0.05"
                                    value={personaFormTemperature}
                                    onChange={(e) => setPersonaFormTemperature(parseFloat(e.target.value) || 0.7)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[#5d6075] mb-1">Top P</label>
                                <input
                                    type="number"
                                    step="0.05"
                                    value={personaFormTopP}
                                    onChange={(e) => setPersonaFormTopP(parseFloat(e.target.value) || 0.9)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[#5d6075] mb-1">Top K</label>
                                <input
                                    type="number"
                                    value={personaFormTopK}
                                    onChange={(e) => setPersonaFormTopK(parseInt(e.target.value, 10) || 40)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[#5d6075] mb-1">Rep. Penalty</label>
                                <input
                                    type="number"
                                    step="0.05"
                                    value={personaFormRepeatPenalty}
                                    onChange={(e) => setPersonaFormRepeatPenalty(parseFloat(e.target.value) || 1.1)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[#5d6075] mb-1">Pres. Penalty</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={personaFormPresencePenalty}
                                    onChange={(e) => setPersonaFormPresencePenalty(parseFloat(e.target.value) || 0.0)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[#5d6075] mb-1">Freq. Penalty</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={personaFormFrequencyPenalty}
                                    onChange={(e) => setPersonaFormFrequencyPenalty(parseFloat(e.target.value) || 0.0)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 5. Embedded Character Lorebook */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e8ebf3] pb-3">
                            <div>
                                <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider">5. Embedded Character Lorebook & World Info</h4>
                                <p className="text-xs text-[#7a7d90] mt-0.5">Manage lorebook entries for this persona or copy entries from your saved Lorebook templates.</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {lorebookTemplates.length > 0 && (
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleCopyLorebookTemplateToPersona(e.target.value);
                                                e.target.value = "";
                                            }
                                        }}
                                        className="bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/20 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer"
                                    >
                                        <option value="">+ Copy from Lorebook...</option>
                                        {lorebookTemplates.map((l) => (
                                            <option key={l.filename} value={l.filename}>
                                                {l.name} ({l.filename})
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <Button type="button" variant="primary" size="sm" onClick={handleAddPersonaLorebookEntry}>
                                    + Add Entry
                                </Button>
                            </div>
                        </div>

                        {personaFormLorebookEntries.length === 0 ? (
                            <div className="p-6 text-center text-[#8e90a6] text-xs italic bg-[#f9fafc] rounded-xl border border-dashed border-[#e8ebf3]">
                                No lorebook entries in this persona. Click &quot;+ Add Entry&quot; or select a Lorebook template above to copy entries.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {personaFormLorebookEntries.map((entry, idx) => (
                                    <div key={idx} className="p-4 rounded-xl bg-[#f9fafc] border border-[#e8ebf3] space-y-3 relative group">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    type="text"
                                                    value={entry.name}
                                                    onChange={(e) => handleUpdatePersonaLorebookEntry(idx, "name", e.target.value)}
                                                    placeholder="Entry Title / Character Name..."
                                                    className="font-bold text-xs text-[#202022] bg-white border border-[#e8ebf3] rounded-lg px-3 py-1.5 outline-none focus:border-[#7678ed]"
                                                />
                                                <label className="flex items-center gap-1.5 text-xs text-[#5d6075] cursor-pointer shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={entry.enabled}
                                                        onChange={(e) => handleUpdatePersonaLorebookEntry(idx, "enabled", e.target.checked)}
                                                        className="accent-[#7678ed]"
                                                    />
                                                    <span>Active</span>
                                                </label>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePersonaLorebookEntry(idx)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                                                title="Delete Entry"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-[#7a7d90] uppercase tracking-wider mb-1">Trigger Keywords</label>
                                            <input
                                                type="text"
                                                value={entry.keys}
                                                onChange={(e) => handleUpdatePersonaLorebookEntry(idx, "keys", e.target.value)}
                                                placeholder="name, car, city, lore..."
                                                className="w-full bg-white border border-[#e8ebf3] text-[#202022] rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:border-[#7678ed]"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-[#7a7d90] uppercase tracking-wider mb-1">Content / Lore Information</label>
                                            <textarea
                                                rows={2}
                                                value={entry.content}
                                                onChange={(e) => handleUpdatePersonaLorebookEntry(idx, "content", e.target.value)}
                                                placeholder="Detailed lore, background story, or memory entries..."
                                                className="w-full bg-white border border-[#e8ebf3] text-[#202022] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#7678ed] resize-y"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </form>
            ) : (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-[#202022] tracking-tight">Manage Persona Templates</h3>
                            <p className="text-sm text-[#7a7d90] mt-1 font-medium">
                                Create, view, and edit reusable AI character personas stored as JSON files in the personas folder.
                            </p>
                        </div>

                        <button
                            onClick={handleOpenCreatePersonaEditor}
                            className="p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                            title="Add Instance"
                        >
                            <PlusIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <input
                            type="text"
                            value={personaSearchQuery}
                            onChange={(e) => setPersonaSearchQuery(e.target.value)}
                            placeholder="Search persona templates by name, description, or system prompt..."
                            className="w-full bg-white border border-[#e8ebf3] rounded-2xl pl-11 pr-4 py-3 text-sm text-[#202022] placeholder-[#a0a3b5] outline-none focus:border-[#7678ed] transition-all shadow-xs"
                        />
                        <SearchIcon className="absolute left-4 top-3.5 text-[#a0a3b5] w-4 h-4" />
                    </div>

                    {/* Cards Grid */}
                    {isPersonaLoading ? (
                        <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">Loading persona templates...</div>
                    ) : (
                        (() => {
                            const filtered = personaTemplates.filter((p) => {
                                const q = personaSearchQuery.toLowerCase().trim();
                                if (!q) return true;
                                const nameMatch = p.name.toLowerCase().includes(q);
                                const fileMatch = p.filename.toLowerCase().includes(q);
                                const descMatch = (p.description || "").toLowerCase().includes(q);
                                const sysMatch = (p.system_prompt || "").toLowerCase().includes(q);
                                return nameMatch || fileMatch || descMatch || sysMatch;
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="p-12 text-center bg-white rounded-2xl border border-[#e8ebf3] space-y-3">
                                        <h4 className="font-bold text-[#202022] text-base">No persona templates found</h4>
                                        <p className="text-xs text-[#7a7d90] max-w-sm mx-auto">
                                            {personaSearchQuery ? "No templates match your search filter." : "No persona JSON files exist in the personas directory."}
                                        </p>
                                        {!personaSearchQuery && (
                                            <Button variant="primary" size="sm" onClick={handleOpenCreatePersonaEditor}>
                                                Create Persona Template
                                            </Button>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filtered.map((tmpl) => (
                                        <div
                                            key={tmpl.filename}
                                            className="p-5 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#7678ed]/40 transition-all"
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-3.5">
                                                    <div className="w-12 h-12 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/20 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                                                        {tmpl.picture ? (
                                                            <img src={tmpl.picture} alt={tmpl.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-xl">🎭</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-[#202022] text-base leading-snug truncate">{tmpl.name}</h4>
                                                        <span className="text-[11px] font-mono text-[#a0a3b5] block mt-0.5">{tmpl.filename}</span>
                                                    </div>
                                                </div>

                                                {tmpl.description && <p className="text-xs text-[#404252] font-medium leading-relaxed line-clamp-2">{tmpl.description}</p>}

                                                {tmpl.system_prompt && (
                                                    <div>
                                                        <span className="text-[11px] font-bold text-[#a0a3b5] uppercase tracking-wider block mb-1">System Instructions</span>
                                                        <p className="text-xs text-[#404252] bg-[#f9fafc] p-2.5 rounded-xl border border-[#e8ebf3] line-clamp-3 font-mono leading-relaxed whitespace-pre-wrap">
                                                            {tmpl.system_prompt}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#7a7d90] font-medium">
                                                    <Badge variant="primary">Voice: {getVoiceDisplayName(tmpl.voice)}</Badge>
                                                    {tmpl.num_ctx && <Badge variant="secondary">{tmpl.num_ctx} tokens</Badge>}
                                                    {tmpl.character_book?.entries && tmpl.character_book.entries.length > 0 && (
                                                        <Badge variant="success">📚 {tmpl.character_book.entries.length} Lorebook entries</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={"flex items-center justify-between pt-3 border-t border-[#e8ebf3] gap-2 justify-end"}>
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() => {
                                                        setApplyPersonaModalTemplate(tmpl);
                                                        setApplyPersonaSelectedModelId("");
                                                    }}
                                                    icon={<CheckIcon className="w-3.5 h-3.5" />}
                                                >
                                                    Apply to Model
                                                </Button>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleOpenEditPersonaEditor(tmpl)}
                                                        className="p-1.5 text-[#7a7d90] hover:text-[#7678ed] transition-colors rounded-lg hover:bg-[#eaecf9]"
                                                        title="Edit"
                                                    >
                                                        <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingPersonaTemplate(tmpl)}
                                                        className="p-1.5 text-[#7a7d90] hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                                                        title="Delete"
                                                    >
                                                        <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    )}
                </div>
            )}
        </div>
    );
};
