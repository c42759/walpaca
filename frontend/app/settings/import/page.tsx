"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { parseImportContent } from "@/lib/importUtils";

import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { UploadIcon } from "@/components/icons/Icons";

export default function ImportSettingsPage() {
    const router = useRouter();
    const { setCurrentView } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("import-chat");

    // Import Chat State
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [importStatusMessage, setImportStatusMessage] = useState<string>("");
    const [isDraggingImport, setIsDraggingImport] = useState<boolean>(false);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // Handlers: Import Files
    const handleImportFiles = async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        setIsImporting(true);
        setImportStatusMessage(`Reading ${files.length} file(s)...`);

        try {
            const allParsedChats: any[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setImportStatusMessage(`Parsing ${file.name}...`);
                const text = await file.text();
                const parsed = parseImportContent(file.name, text);
                allParsedChats.push(...parsed);
            }

            if (allParsedChats.length === 0) {
                setImportStatusMessage("No valid chat messages found in selected file(s).");
                setIsImporting(false);
                return;
            }

            setImportStatusMessage(`Importing ${allParsedChats.length} conversation(s)...`);
            const res = await fetch(`${getApiUrl()}/chats/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chats: allParsedChats }),
            });

            if (!res.ok) {
                throw new Error("Failed to import chats");
            }

            const newChats = await res.json();
            setImportStatusMessage(`Successfully imported ${newChats.length} conversation(s)!`);

            if (newChats.length > 0 && newChats[0].id) {
                setTimeout(() => {
                    setCurrentView("chat");
                    router.push(`/?chat=${newChats[0].id}`);
                }, 1000);
            }
        } catch (e: any) {
            console.error("Import error:", e);
            setImportStatusMessage(`Import failed: ${e.message || "Unknown error"}`);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar activeSettingsCategory={activeSettingsCategory} setActiveSettingsCategory={setActiveSettingsCategory} setCurrentView={setCurrentView} />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="mx-auto space-y-8">
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs">
                            <div>
                                <h3 className="text-xl font-bold text-[#202022] tracking-tight">Import Chat</h3>
                                <p className="text-sm text-[#7a7d90] mt-1 font-medium">Import conversation logs, JSON backups, Markdown transcripts, or text exports.</p>
                            </div>
                        </div>

                        <input
                            type="file"
                            ref={importFileInputRef}
                            onChange={(e) => e.target.files && handleImportFiles(e.target.files)}
                            accept=".json,.md,.markdown,.txt"
                            multiple
                            className="hidden"
                        />

                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDraggingImport(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                setIsDraggingImport(false);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingImport(false);
                                handleImportFiles(e.dataTransfer.files);
                            }}
                            onClick={() => importFileInputRef.current?.click()}
                            className={`border-2 border-dashed ${
                                isDraggingImport ? "border-[#7678ed] bg-[#eaecf9]/40" : "border-[#7678ed]/40 hover:border-[#7678ed]"
                            } rounded-3xl p-10 bg-white hover:bg-[#f3f4fd] transition-all flex flex-col items-center justify-center text-center cursor-pointer group shadow-xs`}
                        >
                            <div className="w-16 h-16 rounded-2xl bg-[#eaecf9] group-hover:bg-[#7678ed] group-hover:text-white text-[#7678ed] flex items-center justify-center mb-4 transition-colors shadow-sm">
                                <UploadIcon className="w-7 h-7" />
                            </div>

                            {isImporting ? (
                                <div className="space-y-2">
                                    <div className="inline-block w-6 h-6 border-2 border-[#7678ed] border-t-transparent rounded-full animate-spin mb-1" />
                                    <h4 className="text-base font-bold text-[#202022]">{importStatusMessage}</h4>
                                </div>
                            ) : (
                                <>
                                    <h4 className="text-base font-bold text-[#202022] mb-1">Drop chat export files here</h4>
                                    <p className="text-xs text-[#8e90a6] mb-4">
                                        Supports Walpaca JSON (.json), ChatGPT export (.json), Claude export (.json), Markdown (.md), and Plain Text (.txt)
                                    </p>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            importFileInputRef.current?.click();
                                        }}
                                        className="px-5 py-2.5 rounded-2xl bg-[#7678ed] hover:bg-[#6869d9] text-white font-semibold text-xs transition-all shadow-sm"
                                    >
                                        Browse Local Files
                                    </button>
                                </>
                            )}
                        </div>

                        {importStatusMessage && !isImporting && (
                            <div className="p-4 rounded-2xl bg-[#eaecf9] text-[#7678ed] font-medium text-xs text-center border border-[#7678ed]/20">{importStatusMessage}</div>
                        )}
                    </div>
                </div>
            </main>

            {/* 3. RIGHT HELP SIDEBAR */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
