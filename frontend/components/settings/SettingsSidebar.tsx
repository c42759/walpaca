"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    UploadIcon,
    ServerIcon,
    BoxIcon,
    BookIcon,
    UserIcon,
    SlidersIcon,
    InfoIcon,
    SearchIcon,
    ArrowLeftIcon,
} from "@/components/icons/Icons";

export type SettingsCategory = "import-chat" | "manage-instances" | "manage-model-preferences" | "preferences" | "manage-lorebook" | "manage-personas" | "about-walpaca";

export interface SettingsSidebarProps {
    activeSettingsCategory: SettingsCategory;
    setActiveSettingsCategory: (category: SettingsCategory) => void;
    setCurrentView?: (view: "chat" | "settings") => void;
}

const defaultGetAvatarColor = (name: string): string => {
    if (!name) return "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const gradients = [
        "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
        "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
        "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
        "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
        "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
        "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
        "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
        "linear-gradient(135deg, #059669 0%, #047857 100%)",
    ];

    return gradients[Math.abs(hash) % gradients.length];
};

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeSettingsCategory, setActiveSettingsCategory, setCurrentView }) => {
    const router = useRouter();
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState("");

    const currentActive: SettingsCategory =
        pathname === "/settings/about"
            ? "about-walpaca"
            : pathname === "/settings/instances"
                ? "manage-instances"
                : pathname === "/settings/model-preferences"
                    ? "manage-model-preferences"
                    : pathname === "/settings/lorebook"
                        ? "manage-lorebook"
                        : pathname === "/settings/personas"
                            ? "manage-personas"
                            : pathname === "/settings/preferences"
                                ? "preferences"
                                : pathname === "/settings/import"
                                    ? "import-chat"
                                    : activeSettingsCategory;

    const categories: Array<{
        id: SettingsCategory;
        label: string;
        description: string;
        gradient: string;
        icon: React.ReactNode;
    }> = [
            {
                id: "import-chat",
                label: "Import Chat",
                description: "Import conversation logs, JSON, or Markdown",
                gradient: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                icon: <UploadIcon className="w-5 h-5 text-white" />,
            },
            {
                id: "manage-instances",
                label: "Manage Instances",
                description: "Configure Ollama, OpenAI, & API backends",
                gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                icon: <ServerIcon className="w-5 h-5 text-white" />,
            },
            {
                id: "manage-model-preferences",
                label: "Manage Model Preferences",
                description: "Customize character, avatar, voice, and context per model",
                gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                icon: <BoxIcon className="w-5 h-5 text-white" />,
            },
            {
                id: "manage-personas",
                label: "Manage Personas",
                description: "Custom character profiles & avatars",
                gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                icon: <UserIcon className="w-5 h-5 text-white" />,
            },
            {
                id: "manage-lorebook",
                label: "Manage Lorebook",
                description: "World info entries and context keywords",
                gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                icon: <BookIcon className="w-5 h-5 text-white" />,
            },
            {
                id: "preferences",
                label: "Preferences",
                description: "Global defaults, theme, and generation parameters",
                gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                icon: <SlidersIcon className="w-5 h-5 text-white" />,
            },
            {
                id: "about-walpaca",
                label: "About Walpaca",
                description: "Version info, updates, and system details",
                gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                icon: <InfoIcon className="w-5 h-5 text-white" />,
            },
        ];

    const filteredCategories = categories.filter((c) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    });

    const categoryRouteMap: Record<SettingsCategory, string> = {
        "import-chat": "/settings/import",
        "manage-instances": "/settings/instances",
        "manage-model-preferences": "/settings/model-preferences",
        "manage-lorebook": "/settings/lorebook",
        "manage-personas": "/settings/personas",
        preferences: "/settings/preferences",
        "about-walpaca": "/settings/about",
    };

    const handleCategoryClick = (catId: SettingsCategory) => {
        setActiveSettingsCategory(catId);
        const target = categoryRouteMap[catId] || "/settings/import";
        router.push(target);
    };

    const handleBackToChat = () => {
        if (setCurrentView) {
            setCurrentView("chat");
        }
        router.push("/");
    };

    return (
        <>
            {/* 1. Desktop & Tablet Vertical Sidebar (md:flex) */}
            <section className="hidden md:flex w-[260px] lg:w-[320px] xl:w-[350px] h-full border-r border-[#e8ebf3] flex-col bg-[#f9fafc] shrink-0">
                {/* Search Bar Header matching ChatListPanel */}
                <div className="p-4 pb-3 flex items-center gap-2">
                    <div className="relative flex-1 flex items-center bg-[#eaecf9] rounded-2xl px-3.5 py-2.5 transition-colors focus-within:bg-[#e2e5f8]">
                        <SearchIcon className="w-4.5 h-4.5 text-[#7678ed] mr-2.5 shrink-0 opacity-80" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent text-base lg:text-lg text-[#202022] placeholder-[#8e90a6] outline-none w-full font-medium"
                        />
                    </div>
                </div>

                {/* Category List */}
                <div className="flex-1 overflow-y-auto px-3 space-y-1.5 custom-scrollbar pb-4">
                    {filteredCategories.map((cat) => {
                        const isActive = (currentActive || activeSettingsCategory) === cat.id;

                        return (
                            <div
                                key={cat.id}
                                draggable={true}
                                onClick={() => handleCategoryClick(cat.id)}
                                className={`relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${isActive ? "bg-[#eaecf9] shadow-xs" : "hover:bg-[#f0f2f9]"
                                    }`}
                            >
                                {/* Avatar */}
                                <div
                                    style={{ background: defaultGetAvatarColor(cat.label) }}
                                    className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl text-white flex items-center justify-center font-bold text-base lg:text-lg tracking-wide shrink-0 shadow-sm"
                                >
                                    {cat.icon}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <h4 className="font-semibold text-base lg:text-lg text-[#202022] truncate">{cat.label}</h4>
                                    </div>
                                    <div className="flex items-center justify-between gap-1">
                                        <p className={`text-xs ${isActive ? "text-[#7678ed] font-medium" : "text-[#7a7d90]"} truncate`}>{cat.description}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredCategories.length === 0 && (
                        <div className="p-8 text-center text-xs text-[#8e90a6] font-medium">No settings found matching &ldquo;{searchQuery}&rdquo;</div>
                    )}
                </div>

                {/* Back to Chat Footer */}
                <div className="p-3 border-t border-[#e8ebf3] bg-[#f9fafc]">
                    <button
                        onClick={handleBackToChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] font-semibold text-sm transition-all cursor-pointer shadow-xs"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span>Back to Chat</span>
                    </button>
                </div>
            </section>

            {/* 2. Mobile Horizontal Category Navigation Strip (< md) */}
            <div className="md:hidden w-full bg-[#f9fafc] border-b border-[#e8ebf3] px-3 py-2 flex flex-col gap-2 shrink-0 select-none">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleBackToChat}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#7678ed] hover:text-[#5d5fb8] cursor-pointer"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span>Back to Chat</span>
                    </button>
                    <span className="text-xs font-bold text-[#8e90a6] uppercase tracking-wider">Settings</span>
                </div>

                {/* Horizontal Scrollable Category Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {categories.map((cat) => {
                        const isActive = (currentActive || activeSettingsCategory) === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleCategoryClick(cat.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${isActive
                                    ? "bg-[#7678ed] text-white shadow-xs"
                                    : "bg-[#eaecf9] text-[#202022] hover:bg-[#dfe2f7]"
                                    }`}
                            >
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
};
