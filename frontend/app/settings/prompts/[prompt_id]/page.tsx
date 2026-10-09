"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { CustomPrompt } from "@/components/settings/ManagePromptsPanel";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ChevronIcon } from "@/components/icons/Icons";

interface EditPromptPageProps {
    params: Promise<{ prompt_id: string }>;
}

export default function EditPromptPage({ params }: EditPromptPageProps) {
    const router = useRouter();
    const resolvedParams = use(params);
    const rawPromptId = resolvedParams.prompt_id;
    const decodedId = decodeURIComponent(rawPromptId);

    const { setCurrentView } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-prompts");

    const [prompt, setPrompt] = useState<CustomPrompt | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

    // Form fields
    const [title, setTitle] = useState<string>("");
    const [content, setContent] = useState<string>("");

    useEffect(() => {
        let isMounted = true;
        const fetchPrompt = async () => {
            setIsLoading(true);
            setErrorMessage(null);
            try {
                const res = await fetch(`${getApiUrl()}/prompts`);
                if (!res.ok) {
                    throw new Error(`Failed to load prompts: HTTP ${res.status}`);
                }
                const data: CustomPrompt[] = await res.json();
                if (!isMounted) return;

                const match = data.find(
                    (p) =>
                        p.filename === decodedId ||
                        p.title === decodedId ||
                        p.filename.toLowerCase() === decodedId.toLowerCase() ||
                        p.filename === `${decodedId}.json`
                );

                if (!match) {
                    setErrorMessage(`Custom prompt "${decodedId}" not found.`);
                    setPrompt(null);
                } else {
                    setPrompt(match);
                    setTitle(match.title || "");
                    setContent(match.content || "");
                }
            } catch (err: unknown) {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : "Error loading prompt";
                    setErrorMessage(message);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchPrompt();
        return () => {
            isMounted = false;
        };
    }, [decodedId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setErrorMessage("Prompt Title is required.");
            return;
        }

        if (!prompt) return;

        setIsSaving(true);
        setErrorMessage(null);
        setSaveSuccessMessage(null);

        try {
            const payload = {
                title: title.trim(),
                content: content,
            };

            const url = `${getApiUrl()}/prompts/${encodeURIComponent(prompt.filename)}`;
            const res = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const updated: CustomPrompt = await res.json();
                setPrompt(updated);
                setTitle(updated.title || "");
                setContent(updated.content || "");
                setSaveSuccessMessage("Custom prompt saved successfully.");
                setTimeout(() => setSaveSuccessMessage(null), 4000);
            } else {
                const errData = await res.json().catch(() => ({}));
                setErrorMessage(errData.error || "Failed saving prompt.");
            }
        } catch (err: unknown) {
            console.error("Error saving prompt:", err);
            const message = err instanceof Error ? err.message : "Error saving prompt.";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
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
                <div className="mx-auto space-y-6 max-w-4xl">
                    {/* Top Back Breadcrumb */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push("/settings/prompts")}
                            className="p-2 text-[#7a7d90] hover:text-[#202022] hover:bg-[#eaecf9] rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                        >
                            <ChevronIcon className="w-4 h-4" direction="left" />
                            <span>Back to Manage Prompts</span>
                        </button>
                    </div>

                    {/* Messages */}
                    {errorMessage && (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
                            {errorMessage}
                        </div>
                    )}
                    {saveSuccessMessage && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                            {saveSuccessMessage}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">
                            Loading custom prompt...
                        </div>
                    ) : !prompt ? (
                        <div className="p-12 text-center bg-white rounded-2xl border border-[#e8ebf3] space-y-3">
                            <h4 className="font-bold text-[#202022] text-base">Prompt Not Found</h4>
                            <p className="text-xs text-[#7a7d90]">The requested custom prompt file does not exist.</p>
                            <Button variant="primary" size="sm" onClick={() => router.push("/settings/prompts")}>
                                Return to Prompts
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-6">
                            {/* Card: Header */}
                            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold text-[#202022] tracking-tight">{prompt.title}</h3>
                                        <Badge variant="primary">{prompt.filename}</Badge>
                                    </div>
                                    <p className="text-sm text-[#7a7d90] font-medium">
                                        Edit custom prompt details and content.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => router.push("/settings/prompts")}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
                                        {isSaving ? "Saving..." : "Save Prompt"}
                                    </Button>
                                </div>
                            </div>

                            {/* Card: Fields */}
                            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-5">
                                <Input
                                    label="Prompt Title *"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Code Reviewer"
                                    helperText="Descriptive label for identifying this prompt in chat list."
                                />

                                <Textarea
                                    label="Prompt Content *"
                                    required
                                    rows={10}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Write your prompt content here..."
                                    helperText="This exact text will be inserted into the chat input message box when selected."
                                    className="!font-mono text-xs leading-relaxed"
                                />
                            </div>
                        </form>
                    )}
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
