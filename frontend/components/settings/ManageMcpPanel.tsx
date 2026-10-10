"use client";

import React, { useState } from "react";
import {
    PlusIcon,
    TrashIcon,
    EditIcon,
    PuzzleIcon,
    CheckIcon,
    ChevronIcon,
    SparklesIcon,
} from "@/components/icons/Icons";

export interface McpTool {
    id: string;
    server_id: string;
    name: string;
    description?: string;
    schema?: any;
    is_enabled: boolean;
    requires_approval: boolean;
}

export interface McpServerItem {
    id: string;
    name: string;
    description?: string;
    is_enabled: boolean;
    transport_type: string;
    url?: string;
    env?: Record<string, string>;
    created_at?: string;
    tools?: McpTool[];
}

export interface ManageMcpPanelProps {
    servers: McpServerItem[];
    isLoading: boolean;
    getApiUrl: () => string;
    fetchServers: () => Promise<void>;
}

export const ManageMcpPanel: React.FC<ManageMcpPanelProps> = ({
    servers,
    isLoading,
    getApiUrl,
    fetchServers,
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [testingServerId, setTestingServerId] = useState<string | null>(null);
    const [syncingServerId, setSyncingServerId] = useState<string | null>(null);
    const [expandedServerIds, setExpandedServerIds] = useState<Record<string, boolean>>({});
    const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

    // Edit state
    const [editingServer, setEditingServer] = useState<McpServerItem | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Modal state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [urlStr, setUrlStr] = useState("http://localhost:8000/sse");
    const [envStr, setEnvStr] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const showToast = (text: string, type: "success" | "error" = "success") => {
        setNotification({ text, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const toggleExpand = (id: string) => {
        setExpandedServerIds((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleOpenCreateModal = () => {
        setName("");
        setDescription("");
        setUrlStr("http://localhost:8000/sse");
        setEnvStr("");
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (server: McpServerItem) => {
        setEditingServer(server);
        setName(server.name || "");
        setDescription(server.description || "");
        setUrlStr(server.url || "");

        const envLines: string[] = [];
        if (server.env) {
            Object.entries(server.env).forEach(([k, v]) => {
                envLines.push(`${k}=${v}`);
            });
        }
        setEnvStr(envLines.join("\n"));
        setIsEditModalOpen(true);
    };

    const parseEnvInput = (input: string): Record<string, string> => {
        const parsedEnv: Record<string, string> = {};
        if (input.trim()) {
            if (input.trim().startsWith("{")) {
                try {
                    Object.assign(parsedEnv, JSON.parse(input.trim()));
                } catch { }
            } else {
                input.split("\n").forEach((line) => {
                    const parts = line.split("=");
                    if (parts.length >= 2) {
                        parsedEnv[parts[0].trim()] = parts.slice(1).join("=").trim();
                    }
                });
            }
        }
        return parsedEnv;
    };

    const handleUpdateServer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingServer || !name.trim() || !urlStr.trim()) return;

        setIsSubmitting(true);
        try {
            const parsedEnv = parseEnvInput(envStr);
            const payload = {
                name: name.trim(),
                description: description.trim(),
                transport_type: "sse",
                url: urlStr.trim(),
                auto_sync: true,
                env: parsedEnv,
            };

            const res = await fetch(`${getApiUrl()}/mcp/servers/${editingServer.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                showToast(`Updated MCP server "${name.trim()}"`);
                setIsEditModalOpen(false);
                setEditingServer(null);
                await fetchServers();
            } else {
                const errData = await res.json();
                showToast(errData.error || "Failed to update MCP server", "error");
            }
        } catch (err: any) {
            showToast(err.message || "Network error", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateServer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !urlStr.trim()) return;

        setIsSubmitting(true);
        try {
            const parsedEnv = parseEnvInput(envStr);
            const payload = {
                name: name.trim(),
                description: description.trim(),
                transport_type: "sse",
                url: urlStr.trim(),
                is_enabled: true,
                auto_sync: true,
                env: parsedEnv,
            };

            const res = await fetch(`${getApiUrl()}/mcp/servers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                showToast(`Created MCP server "${name.trim()}"`);
                setName("");
                setDescription("");
                setUrlStr("http://localhost:8000/sse");
                setEnvStr("");
                setIsCreateModalOpen(false);
                await fetchServers();
            } else {
                const errData = await res.json();
                showToast(errData.error || "Failed to create MCP server", "error");
            }
        } catch (err: any) {
            showToast(err.message || "Network error", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleServer = async (server: McpServerItem) => {
        try {
            const res = await fetch(`${getApiUrl()}/mcp/servers/${server.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_enabled: !server.is_enabled }),
            });
            if (res.ok) {
                await fetchServers();
            }
        } catch (err) {
            console.error("Failed to toggle server:", err);
        }
    };

    const handleToggleTool = async (tool: McpTool) => {
        try {
            const res = await fetch(`${getApiUrl()}/mcp/tools/${tool.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_enabled: !tool.is_enabled }),
            });
            if (res.ok) {
                await fetchServers();
            }
        } catch (err) {
            console.error("Failed to toggle tool:", err);
        }
    };

    const handleTestServer = async (server: McpServerItem) => {
        setTestingServerId(server.id);
        try {
            const res = await fetch(`${getApiUrl()}/mcp/servers/${server.id}/test`, {
                method: "POST",
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || "Connection test succeeded!");
            } else {
                showToast(data.message || "Connection test failed", "error");
            }
        } catch (err: any) {
            showToast(err.message || "Test error", "error");
        } finally {
            setTestingServerId(null);
        }
    };

    const handleSyncServer = async (server: McpServerItem) => {
        setSyncingServerId(server.id);
        try {
            const res = await fetch(`${getApiUrl()}/mcp/servers/${server.id}/sync`, {
                method: "POST",
            });
            const data = await res.json();
            if (res.ok) {
                showToast(`Synchronized ${data.count || 0} tool(s)!`);
                await fetchServers();
            } else {
                showToast(data.message || "Sync failed", "error");
            }
        } catch (err: any) {
            showToast(err.message || "Sync error", "error");
        } finally {
            setSyncingServerId(null);
        }
    };

    const handleDeleteServer = async (serverId: string) => {
        try {
            const res = await fetch(`${getApiUrl()}/mcp/servers/${serverId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                showToast("Server deleted successfully");
                setIsDeletingId(null);
                await fetchServers();
            }
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    const filteredServers = servers.filter((s) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            s.name.toLowerCase().includes(q) ||
            (s.description || "").toLowerCase().includes(q) ||
            (s.url || "").toLowerCase().includes(q) ||
            (s.tools || []).some((t) => t.name.toLowerCase().includes(q))
        );
    });

    return (
        <div className="space-y-6">
            {/* Notification Toast */}
            {notification && (
                <div
                    className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-lg border text-sm font-medium transition-all ${notification.type === "success"
                            ? "bg-[#ecfdf5] border-[#10b981] text-[#065f46]"
                            : "bg-[#fef2f2] border-[#ef4444] text-[#991b1b]"
                        }`}
                >
                    {notification.text}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e8ebf3] pb-5">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#202022] flex items-center gap-2.5">
                        <PuzzleIcon className="w-6 h-6 text-[#7678ed]" />
                        <span>Manage MCP Servers</span>
                    </h2>
                    <p className="text-sm text-[#8e90a6] mt-1">
                        Connect SSE/HTTP Model Context Protocol endpoints to provide web browsing, databases, and workspace tools to your LLMs.
                    </p>
                </div>

                <button
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7678ed] hover:bg-[#6366f1] text-white rounded-2xl font-semibold text-sm transition-all shadow-xs shrink-0 cursor-pointer"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span>Add MCP Server</span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="flex items-center bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-3.5 py-2.5 focus-within:border-[#7678ed] transition-colors">
                <input
                    type="text"
                    placeholder="Search MCP servers or tools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm text-[#202022] placeholder-[#8e90a6] outline-none w-full font-medium"
                />
            </div>

            {/* Server List */}
            {isLoading ? (
                <div className="p-12 text-center text-sm text-[#8e90a6]">Loading MCP servers...</div>
            ) : filteredServers.length === 0 ? (
                <div className="p-12 text-center bg-[#f9fafc] rounded-3xl border border-dashed border-[#e8ebf3] space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center mx-auto">
                        <PuzzleIcon className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-base text-[#202022]">No MCP Servers Configured</h3>
                    <p className="text-xs text-[#8e90a6] max-w-md mx-auto">
                        Add an SSE MCP endpoint URL to grant your LLMs live tools during chat.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredServers.map((server) => {
                        const isExpanded = expandedServerIds[server.id] ?? false;
                        const toolCount = (server.tools || []).length;
                        const activeToolCount = (server.tools || []).filter((t) => t.is_enabled).length;

                        return (
                            <div
                                key={server.id}
                                className={`bg-white rounded-3xl border transition-all ${server.is_enabled ? "border-[#e8ebf3] shadow-xs" : "border-[#f0f2f9] opacity-70"
                                    }`}
                            >
                                {/* Server Header Card */}
                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3.5">
                                        <div
                                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${server.is_enabled ? "bg-[#7678ed] text-white" : "bg-[#eaecf9] text-[#8e90a6]"
                                                }`}
                                        >
                                            <PuzzleIcon className="w-5 h-5" />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-base text-[#202022]">{server.name}</h3>
                                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#eaecf9] text-[#7678ed]">
                                                    SSE / HTTP
                                                </span>
                                                <span className="text-xs text-[#8e90a6] font-medium">
                                                    {activeToolCount}/{toolCount} tools active
                                                </span>
                                            </div>

                                            {server.description && (
                                                <p className="text-xs text-[#7a7d90]">{server.description}</p>
                                            )}

                                            <div className="text-[11px] font-mono text-[#8e90a6] truncate max-w-xl">
                                                {server.url || "No URL configured"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleServer(server)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${server.is_enabled
                                                    ? "bg-[#ecfdf5] text-[#059669] hover:bg-[#d1fae5]"
                                                    : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]"
                                                }`}
                                        >
                                            {server.is_enabled ? "Enabled" : "Disabled"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleTestServer(server)}
                                            disabled={testingServerId === server.id}
                                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#eaecf9] hover:bg-[#dfe2f7] text-[#202022] cursor-pointer transition-all disabled:opacity-50"
                                        >
                                            {testingServerId === server.id ? "Testing..." : "Test"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSyncServer(server)}
                                            disabled={syncingServerId === server.id}
                                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#eaecf9] hover:bg-[#dfe2f7] text-[#202022] cursor-pointer transition-all disabled:opacity-50"
                                        >
                                            {syncingServerId === server.id ? "Syncing..." : "Sync Tools"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => toggleExpand(server.id)}
                                            className="p-2 rounded-xl text-[#8e90a6] hover:text-[#202022] hover:bg-[#f0f2f9] cursor-pointer transition-all"
                                            title="Toggle tool list"
                                        >
                                            <ChevronIcon direction={isExpanded ? "up" : "down"} className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditModal(server)}
                                            className="p-2 rounded-xl text-[#7678ed] hover:bg-[#eaecf9] cursor-pointer transition-all"
                                            title="Edit Server Configuration"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setIsDeletingId(server.id)}
                                            className="p-2 rounded-xl text-[#ef4444] hover:bg-[#fee2e2] cursor-pointer transition-all"
                                            title="Delete Server"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Collapsible Tools Section */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-2 border-t border-[#f0f2f9] space-y-3">
                                        <h4 className="text-xs font-bold text-[#8e90a6] uppercase tracking-wider">
                                            Discovered Tools ({toolCount})
                                        </h4>

                                        {toolCount === 0 ? (
                                            <p className="text-xs text-[#8e90a6] italic">
                                                No tools discovered yet. Click &ldquo;Sync Tools&rdquo; to fetch tools from this server.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {(server.tools || []).map((tool) => (
                                                    <div
                                                        key={tool.id}
                                                        className={`p-3 rounded-2xl border transition-all ${tool.is_enabled
                                                                ? "bg-[#f9fafc] border-[#e8ebf3]"
                                                                : "bg-[#f3f4f6] border-transparent opacity-60"
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <span className="font-mono text-xs font-bold text-[#7678ed] truncate">
                                                                {tool.name}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleTool(tool)}
                                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg cursor-pointer ${tool.is_enabled
                                                                        ? "bg-[#10b981] text-white"
                                                                        : "bg-[#d1d5db] text-[#374151]"
                                                                    }`}
                                                            >
                                                                {tool.is_enabled ? "Active" : "Off"}
                                                            </button>
                                                        </div>

                                                        {tool.description && (
                                                            <p className="text-[11px] text-[#7a7d90] line-clamp-2 mb-1.5">
                                                                {tool.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Server Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl border border-[#e8ebf3] space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-[#202022] flex items-center gap-2">
                                <PuzzleIcon className="w-5 h-5 text-[#7678ed]" />
                                <span>Add MCP Server</span>
                            </h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-[#8e90a6] hover:text-[#202022] text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateServer} className="space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-bold text-[#202022] uppercase tracking-wider mb-1">
                                    Server Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Brave Web Search"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-3.5 py-2.5 text-sm text-[#202022] focus:border-[#7678ed] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#202022] uppercase tracking-wider mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Live search queries over the internet"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-3.5 py-2.5 text-sm text-[#202022] focus:border-[#7678ed] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#202022] uppercase tracking-wider mb-1">
                                    SSE Endpoint URL *
                                </label>
                                <input
                                    type="url"
                                    required
                                    placeholder="http://localhost:8000/sse"
                                    value={urlStr}
                                    onChange={(e) => setUrlStr(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-3.5 py-2.5 text-sm font-mono text-[#202022] focus:border-[#7678ed] outline-none"
                                />
                                <p className="text-[11px] text-[#8e90a6] mt-1">
                                    URL of the remote or containerized MCP server implementing JSON-RPC 2.0.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#202022] uppercase tracking-wider mb-1">
                                    Auth Headers / Environment Variables (KEY=VALUE per line)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="AUTHORIZATION=Bearer YOUR_TOKEN_HERE"
                                    value={envStr}
                                    onChange={(e) => setEnvStr(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl p-3 text-xs font-mono text-[#202022] focus:border-[#7678ed] outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-2xl text-xs font-bold text-[#8e90a6] hover:bg-[#f0f2f9] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#7678ed] hover:bg-[#6366f1] text-white cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                    {isSubmitting ? "Connecting..." : "Add & Connect"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Server Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl border border-[#e8ebf3] space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-[#202022] flex items-center gap-2">
                                <EditIcon className="w-5 h-5 text-[#7678ed]" />
                                <span>Edit MCP Server</span>
                            </h3>
                            <button
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setEditingServer(null);
                                }}
                                className="text-[#8e90a6] hover:text-[#202022] text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleUpdateServer} className="space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-bold text-[#202022] uppercase tracking-wider mb-1">
                                    Server Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Brave Web Search"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-3.5 py-2.5 text-sm text-[#202022] focus:border-[#7678ed] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#202022] uppercase tracking-wider mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Live search queries over the internet"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-3.5 py-2.5 text-sm text-[#202022] focus:border-[#7678ed] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#202022] uppercase tracking-wider mb-1">
                                    SSE Endpoint URL *
                                </label>
                                <input
                                    type="url"
                                    required
                                    placeholder="http://localhost:8000/sse"
                                    value={urlStr}
                                    onChange={(e) => setUrlStr(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-3.5 py-2.5 text-sm font-mono text-[#202022] focus:border-[#7678ed] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#202022] uppercase tracking-wider mb-1">
                                    Auth Headers / Environment Variables (KEY=VALUE per line)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="AUTHORIZATION=Bearer YOUR_TOKEN_HERE"
                                    value={envStr}
                                    onChange={(e) => setEnvStr(e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl p-3 text-xs font-mono text-[#202022] focus:border-[#7678ed] outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setEditingServer(null);
                                    }}
                                    className="px-4 py-2 rounded-2xl text-xs font-bold text-[#8e90a6] hover:bg-[#f0f2f9] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#7678ed] hover:bg-[#6366f1] text-white cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                    {isSubmitting ? "Saving..." : "Save & Sync"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeletingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-[#e8ebf3] space-y-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#fee2e2] text-[#ef4444] flex items-center justify-center mx-auto">
                            <TrashIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-base text-[#202022]">Delete MCP Server?</h3>
                        <p className="text-xs text-[#8e90a6]">
                            This will remove the server configuration and all its associated tool configurations.
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDeletingId(null)}
                                className="px-4 py-2 rounded-2xl text-xs font-bold text-[#8e90a6] hover:bg-[#f0f2f9] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteServer(isDeletingId)}
                                className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#ef4444] hover:bg-[#dc2626] text-white cursor-pointer shadow-xs"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
