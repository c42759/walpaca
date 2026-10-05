"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";

export default function AboutSettingsPage() {
    const { setCurrentView } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("about-walpaca");

    return (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white rounded-none md:rounded-l-[32px] w-full h-full select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar activeSettingsCategory={activeSettingsCategory} setActiveSettingsCategory={setActiveSettingsCategory} setCurrentView={setCurrentView} />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
                <div className="mx-auto space-y-8">
                    <div className="space-y-6 animate-in fade-in duration-200 pb-8">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs">
                            <div>
                                <h3 className="text-xl font-bold text-[#202022] tracking-tight">Walpaca</h3>
                                <p className="text-sm text-[#7a7d90] mt-1 font-medium">Web interface inspired on Jeffser/Alpaca GTK client.</p>
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                            <p className="text-sm text-[#404252] leading-relaxed">
                                Walpaca lets you access your local Alpaca workspace across your network or VPN. It mounts the exact same SQLite database file (alpaca.db) used by
                                the native desktop app, keeping your existing chats and settings synchronized.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                            <div className="text-[#202022] font-bold text-base pb-3 border-b border-[#e8ebf3] flex items-center gap-2">
                                <span>⚡</span>
                                <span>Features</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#404252]">
                                {[
                                    { icon: "💬", title: "Multi-Model Chats", desc: "Switch between Ollama & Cloud models in the same conversation." },
                                    {
                                        icon: "📄",
                                        title: "Document Recognition",
                                        desc: "Attach text and code files (.txt, .md, .js, .py) for prompt analysis.",
                                    },
                                    { icon: "🖼️", title: "Image Support", desc: "Attach up to 4 images per message for multimodal vision models." },
                                    { icon: "💻", title: "Syntax Highlighting", desc: "Tokenized code blocks with copy button and line counters." },
                                    { icon: "📥", title: "Export Transcripts", desc: "Export chats to Markdown (.md), Obsidian, JSON, or Plain Text." },
                                    { icon: "🔊", title: "Speech Output", desc: "Line-by-line audio synthesis using Kokoro TTS integration." },
                                ].map((feat, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#f9fafc] border border-[#e8ebf3]">
                                        <span className="text-xl shrink-0">{feat.icon}</span>
                                        <div>
                                            <div className="font-bold text-[#202022] text-xs">{feat.title}</div>
                                            <div className="text-[#7a7d90] mt-0.5 text-[11px] leading-relaxed">{feat.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
