import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input, Textarea } from "../ui/Input";
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, PromptIcon } from "../icons/Icons";

export interface CustomPrompt {
    filename: string;
    title: string;
    content: string;
    error?: string;
}

export interface ManagePromptsPanelProps {
    prompts: CustomPrompt[];
    isLoading: boolean;
    getApiUrl: () => string;
    fetchPrompts: () => Promise<void>;
}

export const ManagePromptsPanel: React.FC<ManagePromptsPanelProps> = ({
    prompts,
    isLoading,
    getApiUrl,
    fetchPrompts,
}) => {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);
    const [formTitle, setFormTitle] = useState<string>("");
    const [formContent, setFormContent] = useState<string>("");
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [deletingPrompt, setDeletingPrompt] = useState<CustomPrompt | null>(null);

    const handleOpenCreateModal = () => {
        setEditingPrompt(null);
        setFormTitle("");
        setFormContent("");
        setIsModalOpen(true);
    };

    const handleOpenEditPage = (prompt: CustomPrompt) => {
        router.push(`/settings/prompts/${encodeURIComponent(prompt.filename)}`);
    };

    const handleSavePrompt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim()) return;

        setIsSaving(true);
        try {
            const payload = {
                title: formTitle.trim(),
                content: formContent,
            };

            let url = `${getApiUrl()}/prompts`;
            let method = "POST";

            if (editingPrompt) {
                url = `${getApiUrl()}/prompts/${encodeURIComponent(editingPrompt.filename)}`;
                method = "PUT";
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchPrompts();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || "Failed saving prompt");
            }
        } catch (err: unknown) {
            console.error("Error saving prompt:", err);
            const message = err instanceof Error ? err.message : "Error saving prompt";
            alert(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmDeletePrompt = async () => {
        if (!deletingPrompt) return;

        try {
            const filename = deletingPrompt.filename;
            const res = await fetch(`${getApiUrl()}/prompts/${encodeURIComponent(filename)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setDeletingPrompt(null);
                fetchPrompts();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || "Failed deleting prompt");
            }
        } catch (err: unknown) {
            console.error("Error deleting prompt:", err);
            const message = err instanceof Error ? err.message : "Error deleting prompt";
            alert(message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200 pb-8">
            {/* Header */}
            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-[#202022] tracking-tight">Manage Custom Prompts</h3>
                    <p className="text-sm text-[#7a7d90] mt-1 font-medium">
                        Create, view, and edit reusable prompts with titles and contents. Use them directly in chat conversations.
                    </p>
                </div>

                <button
                    onClick={handleOpenCreateModal}
                    className="p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer shrink-0"
                    title="Add Custom Prompt"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search custom prompts by title or content..."
                    className="w-full bg-white border border-[#e8ebf3] rounded-2xl pl-11 pr-4 py-3 text-sm text-[#202022] placeholder-[#a0a3b5] outline-none focus:border-[#7678ed] transition-all shadow-xs"
                />
                <SearchIcon className="absolute left-4 top-3.5 text-[#a0a3b5] w-4 h-4" />
            </div>

            {/* Cards Grid */}
            {isLoading ? (
                <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">
                    Loading custom prompts...
                </div>
            ) : (
                (() => {
                    const filtered = prompts.filter((p) => {
                        const q = searchQuery.toLowerCase().trim();
                        if (!q) return true;
                        const titleMatch = (p.title || "").toLowerCase().includes(q);
                        const contentMatch = (p.content || "").toLowerCase().includes(q);
                        const fileMatch = (p.filename || "").toLowerCase().includes(q);
                        return titleMatch || contentMatch || fileMatch;
                    });

                    if (filtered.length === 0) {
                        return (
                            <div className="p-12 text-center bg-white rounded-2xl border border-[#e8ebf3] space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center mx-auto mb-2">
                                    <PromptIcon className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-[#202022] text-base">No custom prompts found</h4>
                                <p className="text-xs text-[#7a7d90] max-w-sm mx-auto">
                                    {searchQuery
                                        ? "No prompts match your search filter."
                                        : "No custom prompts have been created yet."}
                                </p>
                                {!searchQuery && (
                                    <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
                                        Create Custom Prompt
                                    </Button>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((prompt) => (
                                <div
                                    key={prompt.filename}
                                    className="p-5 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#7678ed]/40 transition-all group"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-[#202022] text-base leading-snug truncate" title={prompt.title}>
                                                    {prompt.title}
                                                </h4>
                                                <span className="text-[11px] font-mono text-[#a0a3b5] block mt-0.5">
                                                    {prompt.filename}
                                                </span>
                                            </div>
                                            <Badge variant="primary">
                                                {prompt.content ? `${prompt.content.length} chars` : "empty"}
                                            </Badge>
                                        </div>

                                        <div>
                                            <p className="text-xs text-[#52556b] bg-[#f9fafc] border border-[#eef0f6] rounded-xl p-3 line-clamp-4 font-mono leading-relaxed select-text whitespace-pre-wrap">
                                                {prompt.content || <span className="italic text-[#a0a3b5]">No prompt content</span>}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end pt-3 border-t border-[#e8ebf3] gap-1">
                                        <button
                                            onClick={() => handleOpenEditPage(prompt)}
                                            className="p-2 text-[#7a7d90] hover:text-[#7678ed] transition-colors rounded-xl hover:bg-[#eaecf9] cursor-pointer"
                                            title="Edit Prompt"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeletingPrompt(prompt)}
                                            className="p-2 text-[#7a7d90] hover:text-rose-500 transition-colors rounded-xl hover:bg-rose-50 cursor-pointer"
                                            title="Delete Prompt"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()
            )}

            {/* Modal: Create / Edit Prompt */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white">
                                {editingPrompt ? "Edit Custom Prompt" : "New Custom Prompt"}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSavePrompt} className="space-y-4">
                            <Input
                                label="Prompt Title"
                                required
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="e.g., Code Reviewer, Story Intro"
                                className="!bg-white/10 !border-white/15 !text-white"
                            />

                            <Textarea
                                label="Prompt Content"
                                required
                                rows={6}
                                value={formContent}
                                onChange={(e) => setFormContent(e.target.value)}
                                placeholder="Enter the prompt content to place into the chat input..."
                                className="!bg-white/10 !border-white/15 !text-white !font-mono text-xs leading-relaxed"
                            />

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsModalOpen(false)}
                                    className="!bg-white/10 hover:!bg-white/20 !text-white border-transparent"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" size="sm" disabled={isSaving || !formTitle.trim()}>
                                    {isSaving ? "Saving..." : editingPrompt ? "Save Changes" : "Create Prompt"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Delete Confirmation */}
            {deletingPrompt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">Delete Custom Prompt</h3>
                        <p className="text-sm text-white/70 mb-6 font-medium leading-relaxed">
                            Are you sure you want to permanently delete the custom prompt{" "}
                            <span className="text-white font-bold">&quot;{deletingPrompt.title}&quot;</span> (
                            <code className="text-[#7678ed] text-xs font-mono">{deletingPrompt.filename}</code>)? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setDeletingPrompt(null)}
                                className="!bg-white/10 hover:!bg-white/20 !text-white border-transparent"
                            >
                                Cancel
                            </Button>
                            <Button variant="danger" size="sm" onClick={handleConfirmDeletePrompt}>
                                Delete Prompt
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
