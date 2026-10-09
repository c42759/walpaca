"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore, registerGoToRootHandler, registerDropChatToFolderHandler } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { applyAudioOutputDevice } from "@/lib/audioUtils";
import {
    updateMediaSessionMetadata,
    setMediaSessionPlaybackState,
    registerMediaSessionHandlers,
    clearMediaSession,
} from "@/lib/mediaSession";

import { ChatListPanel } from "@/components/chat/ChatListPanel";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { PersonaDetailsModal, PersonaDetailsData } from "@/components/chat/PersonaDetailsModal";
import { CustomPromptsModal } from "@/components/chat/CustomPromptsModal";
import { BrainIcon, MetadataIcon, ServerIcon, CloseIcon } from "@/components/icons/Icons";
import { WidgetSimple, WidgetToggle, WidgetWithCustomHeader } from "@/components/ui/Widget";

// --- Types ---
interface ChatFolder {
    id: string;
    name: string;
    color?: string;
    parent?: string | null;
}

interface MessageAttachment {
    id?: string;
    type: string;
    name?: string;
    content: string;
}

interface SelectedAttachment {
    id: string;
    name: string;
    type: "image" | "plain_text" | "code" | "audio";
    content: string;
    size?: number;
    extension?: string;
}

interface Message {
    id: string;
    senderName: string;
    senderAvatar?: string;
    senderRole?: string;
    instanceId?: string;
    model?: string;
    isSelf: boolean;
    content: string;
    time: string;
    views?: number;
    reactions?: { emoji: string; count: number }[];
    image?: string;
    attachments?: MessageAttachment[];
}

interface LorebookTemplate {
    filename: string;
    name: string;
    keys: string[];
    content: string;
    error?: string;
}

interface PersonaTemplate {
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
    [key: string]: any;
}

interface ChatItem {
    id: string;
    name: string;
    avatarText?: string;
    avatarImg?: string;
    lastMessage: string;
    time: string;
    unreadCount?: number;
    isPinned?: boolean;
    isDelivered?: boolean;
    folder?: string;
}

interface BackendMessage {
    id: string;
    chat_id: string;
    role: string;
    model?: string;
    instance_id?: string;
    date_time: string;
    content: string;
    attachments?: any[];
}

interface ModelPreference {
    id: string;
    name?: string;
    description?: string;
    first_message?: string;
    alternate_greetings?: string[];
    picture?: string | null;
    voice?: string | null;
    num_ctx?: number | null;
    character?: any;
}

interface InstanceProperties {
    name: string;
    url: string;
    api?: string;
    default_model?: string | null;
    keep_alive?: number;
    num_ctx?: number;
    override_parameters?: boolean;
    seed?: number;
    share_name?: number;
    show_response_metadata?: boolean;
    temperature?: number;
    think?: boolean;
    title_model?: string | null;
    allow_self_signed_ssl?: boolean;
}

interface InstanceItem {
    id: string;
    pinned?: boolean;
    type: string;
    properties: InstanceProperties;
}

interface BackendChat {
    id: string;
    name: string;
    folder?: string | null;
    is_template?: boolean;
    latest_message_time?: string | null;
    messages?: BackendMessage[];
}

const initialMockChatList: ChatItem[] = [];

const mapBackendChatToChatItem = (c: BackendChat): ChatItem => {
    const words = c.name
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    let initials = "CH";
    if (words.length >= 2) {
        initials = `${words[0][0]}${words[1][0]}`.toUpperCase();
    } else if (words.length === 1 && words[0].length >= 2) {
        initials = words[0].slice(0, 2).toUpperCase();
    } else if (c.name.trim().length >= 2) {
        initials = c.name.trim().slice(0, 2).toUpperCase();
    }

    let timeStr = "now";
    if (c.latest_message_time) {
        const parts = c.latest_message_time.split(" ");
        timeStr = parts[1] ? parts[1].slice(0, 5) : parts[0] || "now";
    }

    return {
        id: c.id,
        name: c.name,
        avatarText: initials,
        lastMessage: c.latest_message_time ? `Last msg ${timeStr}` : "No messages yet",
        time: timeStr,
        folder: c.folder || undefined,
    };
};

const getCharacterName = (char?: any): string | undefined => {
    if (!char) return undefined;
    if (char.data && char.data.name && String(char.data.name).trim()) {
        return String(char.data.name).trim();
    }
    if (char.name && String(char.name).trim()) {
        return String(char.name).trim();
    }
    return undefined;
};

const isCharEnabled = (char?: any) => {
    if (!char) return false;
    if (typeof char.enabled === "boolean") return char.enabled;
    if (typeof char.enable === "boolean") return char.enable;
    if (typeof char.data?.enabled === "boolean") return char.data.enabled;
    if (typeof char.data?.enable === "boolean") return char.data.enable;
    return Boolean(getCharacterName(char));
};

const formatAvatarPicture = (picture?: string | null): string | undefined => {
    if (!picture) return undefined;
    if (picture.startsWith("data:") || picture.startsWith("http://") || picture.startsWith("https://") || picture.startsWith("/")) {
        return picture;
    }
    return `data:image/png;base64,${picture}`;
};

const getAvatarColor = (name: string): string => {
    if (!name) return "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const gradients = [
        "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", // Indigo
        "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", // Violet
        "linear-gradient(135deg, #ec4899 0%, #db2777 100%)", // Pink
        "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)", // Rose
        "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", // Orange
        "linear-gradient(135deg, #10b981 0%, #059669 100%)", // Emerald
        "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", // Teal
        "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)", // Cyan
        "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", // Blue
        "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)", // Purple
        "linear-gradient(135deg, #059669 0%, #047857 100%)", // Green
        "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", // Indigo-Violet
    ];

    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
};

const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = typeof window !== "undefined" ? window.innerHeight * 0.3 : 240;
    if (el.scrollHeight > maxHeight) {
        el.style.height = `${maxHeight}px`;
        el.style.overflowY = "auto";
    } else {
        el.style.height = `${el.scrollHeight}px`;
        el.style.overflowY = "hidden";
    }
};

const playNotificationSound = async () => {
    if (typeof window === "undefined") return;
    try {
        const audio = new Audio("/universfield-new-notification-036-485897.mp3");
        audio.volume = 0.6;
        const defaultOutput = useAppStore.getState().appPreferences?.default_audio_output;
        await applyAudioOutputDevice(audio, defaultOutput);
        audio.play().catch((err) => {
            console.warn("Notification sound playback prevented or failed:", err);
        });
    } catch (err) {
        console.warn("Notification sound playback error:", err);
    }
};

const DEFAULT_MODEL_AVATAR = "/icon-app.svg";

const getModelAvatarPicture = (pref?: ModelPreference | null, mod?: any): string => {
    const rawPic = pref?.picture || pref?.character?.data?.avatar || pref?.character?.avatar || mod?.picture || mod?.avatar || mod?.senderAvatar;
    return formatAvatarPicture(rawPic) || DEFAULT_MODEL_AVATAR;
};

const isImageAttachment = (att: MessageAttachment | any): boolean => {
    if (!att) return false;
    const typeStr = (att.type || "").toLowerCase();
    if (typeStr.includes("image") || typeStr.includes("photo") || typeStr.includes("png") || typeStr.includes("jpg") || typeStr.includes("jpeg")) {
        return true;
    }
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (
        contentStr.startsWith("data:image/") ||
        contentStr.startsWith("iVBOR") ||
        contentStr.startsWith("/9j/") ||
        contentStr.startsWith("R0lGOD") ||
        contentStr.startsWith("UklGR")
    ) {
        return true;
    }
    return false;
};

const getImageSrc = (att: MessageAttachment | any): string => {
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (contentStr.startsWith("data:") || contentStr.startsWith("http://") || contentStr.startsWith("https://") || contentStr.startsWith("/")) {
        return contentStr;
    }
    return `data:image/png;base64,${contentStr}`;
};

const mapBackendMsgToMessage = (m: BackendMessage, prefMap?: Record<string, ModelPreference>): Message => {
    const isSelf = m.role === "user";
    let timeStr = m.date_time || "";
    if (timeStr.includes(" ")) {
        timeStr = timeStr.split(" ")[1].slice(0, 5);
    }

    const modelKey = m.model ? m.model.toLowerCase() : "";
    const pref = prefMap && modelKey ? prefMap[modelKey] || prefMap[m.model!] : undefined;
    const avatarFromPref = formatAvatarPicture(pref?.picture);
    const charName = isCharEnabled(pref?.character) ? getCharacterName(pref?.character) : undefined;
    const displayName = charName || getCharacterName(pref?.character) || m.model || "Assistant";

    return {
        id: m.id,
        senderName: isSelf ? "You" : displayName,
        senderAvatar: isSelf ? undefined : avatarFromPref,
        senderRole: isSelf ? "user" : "assistant",
        model: m.model,
        instanceId: m.instance_id,
        isSelf,
        content: m.content,
        time: timeStr || "now",
        attachments: m.attachments || [],
    };
};

const parseFormatting = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.*?)\*\*|__(.*?)__|~~(.*?)~~|\*(.*?)\*|_(.*?)_|`(.*?)`|\[(.*?)\]\((.*?)\))/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(str)) !== null) {
        if (m.index > lastIdx) {
            parts.push(str.slice(lastIdx, m.index));
        }
        if (m[2] !== undefined) {
            parts.push(
                <strong key={m.index} className="font-bold text-inherit">
                    {m[2]}
                </strong>,
            );
        } else if (m[3] !== undefined) {
            parts.push(
                <strong key={m.index} className="font-bold text-inherit">
                    {m[3]}
                </strong>,
            );
        } else if (m[4] !== undefined) {
            parts.push(
                <del key={m.index} className="line-through opacity-80">
                    {m[4]}
                </del>,
            );
        } else if (m[5] !== undefined) {
            parts.push(
                <em key={m.index} className="italic text-inherit">
                    {m[5]}
                </em>,
            );
        } else if (m[6] !== undefined) {
            parts.push(
                <em key={m.index} className="italic text-inherit">
                    {m[6]}
                </em>,
            );
        } else if (m[7] !== undefined) {
            parts.push(
                <code key={m.index} className="bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5 font-mono text-sm border border-black/5 dark:border-white/5">
                    {m[7]}
                </code>,
            );
        } else if (m[8] !== undefined && m[9] !== undefined) {
            parts.push(
                <a key={m.index} href={m[9]} target="_blank" rel="noreferrer" className="underline font-medium text-[#7678ed] hover:opacity-80 transition-opacity">
                    {m[8]}
                </a>,
            );
        }
        lastIdx = regex.lastIndex;
    }
    if (lastIdx < str.length) {
        parts.push(str.slice(lastIdx));
    }

    return parts;
};

const renderInlineMarkdown = (
    text: string,
    keyPrefix: string,
    activeLineIndex?: number,
    onLineContextMenu?: (e: React.MouseEvent, lineText: string, lineIndex: number) => void,
) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let inUnorderedList = false;
    let currentUlItems: React.ReactNode[] = [];
    let inOrderedList = false;
    let currentOlItems: React.ReactNode[] = [];
    let inTable = false;
    let currentTableLines: string[] = [];

    const parseTableCells = (line: string): string[] => {
        let raw = line.trim();
        if (raw.startsWith("|")) raw = raw.slice(1);
        if (raw.endsWith("|")) raw = raw.slice(0, -1);
        return raw.split("|").map((cell) => cell.trim());
    };

    const isTableDivider = (line: string): boolean => {
        const cells = parseTableCells(line);
        return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.replace(/\s+/g, "")));
    };

    const flushListsAndTable = () => {
        if (inUnorderedList && currentUlItems.length > 0) {
            elements.push(
                <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2 pl-2">
                    {currentUlItems}
                </ul>,
            );
            currentUlItems = [];
            inUnorderedList = false;
        }
        if (inOrderedList && currentOlItems.length > 0) {
            elements.push(
                <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 pl-2">
                    {currentOlItems}
                </ol>,
            );
            currentOlItems = [];
            inOrderedList = false;
        }
        if (inTable && currentTableLines.length > 0) {
            let headerCells: string[] = [];
            let rowLines: string[] = [];

            if (currentTableLines.length >= 2 && isTableDivider(currentTableLines[1])) {
                headerCells = parseTableCells(currentTableLines[0]);
                rowLines = currentTableLines.slice(2);
            } else if (currentTableLines.length >= 1) {
                headerCells = parseTableCells(currentTableLines[0]);
                rowLines = currentTableLines.slice(1);
            }

            elements.push(
                <div key={`table-${elements.length}`} className="overflow-x-auto my-3 border border-[#e8ebf3] rounded-2xl shadow-xs select-text">
                    <table className="w-full text-left text-base border-collapse">
                        {headerCells.length > 0 && (
                            <thead className="bg-[#f0f2f9] border-b border-[#e8ebf3] text-[#202022]">
                                <tr>
                                    {headerCells.map((h, i) => (
                                        <th key={i} className="px-4 py-3 font-bold border-r border-[#e8ebf3] last:border-r-0">
                                            {parseFormatting(h)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        )}
                        <tbody className="divide-y divide-[#e8ebf3] text-[#202022]">
                            {rowLines.map((rLine, rIdx) => {
                                const cells = parseTableCells(rLine);
                                return (
                                    <tr key={rIdx} className="hover:bg-[#f9fafc] transition-colors">
                                        {cells.map((cell, cIdx) => (
                                            <td key={cIdx} className="px-4 py-2.5 font-normal border-r border-[#e8ebf3] last:border-r-0">
                                                {parseFormatting(cell)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>,
            );
            currentTableLines = [];
            inTable = false;
        }
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        const isHl = activeLineIndex === idx;
        const hlClass = isHl ? " bg-[#7678ed]/20 border-l-4 border-[#7678ed] pl-2.5 py-0.5 rounded-r-xl transition-all duration-300 font-medium text-[#111] shadow-xs" : "";
        const getMenuProps = () => {
            if (!onLineContextMenu) return {};
            return {
                onContextMenu: (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onLineContextMenu(e, line, idx);
                },
            };
        };

        // Check table line
        if (trimmed.startsWith("|") && (trimmed.endsWith("|") || trimmed.includes("|"))) {
            if (inUnorderedList || inOrderedList) flushListsAndTable();
            inTable = true;
            currentTableLines.push(trimmed);
            return;
        }

        if (inTable) {
            flushListsAndTable();
        }

        // Headers
        if (trimmed.startsWith("# ")) {
            flushListsAndTable();
            elements.push(
                <h1 key={idx} {...getMenuProps()} className={`text-2xl font-extrabold text-[#202022] my-2${hlClass}`}>
                    {parseFormatting(trimmed.slice(2))}
                </h1>,
            );
            return;
        }
        if (trimmed.startsWith("## ")) {
            flushListsAndTable();
            elements.push(
                <h2 key={idx} {...getMenuProps()} className={`text-xl font-bold text-[#202022] my-2${hlClass}`}>
                    {parseFormatting(trimmed.slice(3))}
                </h2>,
            );
            return;
        }
        if (trimmed.startsWith("### ")) {
            flushListsAndTable();
            elements.push(
                <h3 key={idx} {...getMenuProps()} className={`text-lg font-bold text-[#202022] my-1.5${hlClass}`}>
                    {parseFormatting(trimmed.slice(4))}
                </h3>,
            );
            return;
        }
        if (trimmed.startsWith("#### ")) {
            flushListsAndTable();
            elements.push(
                <h4 key={idx} {...getMenuProps()} className={`text-base font-bold text-[#202022] my-1${hlClass}`}>
                    {parseFormatting(trimmed.slice(5))}
                </h4>,
            );
            return;
        }
        if (trimmed.startsWith("##### ") || trimmed.startsWith("###### ")) {
            flushListsAndTable();
            elements.push(
                <h5 key={idx} {...getMenuProps()} className={`text-sm font-bold uppercase tracking-wider text-[#8e90a6] my-1${hlClass}`}>
                    {parseFormatting(trimmed.replace(/^#+\s*/, ""))}
                </h5>,
            );
            return;
        }

        // Horizontal rule
        if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
            flushListsAndTable();
            elements.push(<hr key={idx} className="my-3 border-t border-[#e8ebf3]" />);
            return;
        }

        // Blockquote
        if (trimmed.startsWith("> ")) {
            flushListsAndTable();
            elements.push(
                <blockquote key={idx} {...getMenuProps()} className={`border-l-4 border-[#7678ed] pl-3 py-1 my-2 text-[#4a4d63] italic bg-[#f0f2f9]/50 rounded-r-xl${hlClass}`}>
                    {parseFormatting(trimmed.slice(2))}
                </blockquote>,
            );
            return;
        }

        // Unordered List (- or * or +)
        const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);
        if (ulMatch) {
            if (inOrderedList) flushListsAndTable();
            inUnorderedList = true;
            currentUlItems.push(
                <li key={idx} {...getMenuProps()} className={`leading-relaxed${hlClass}`}>
                    {parseFormatting(ulMatch[1])}
                </li>,
            );
            return;
        }

        // Ordered List (1. 2.)
        const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
        if (olMatch) {
            if (inUnorderedList) flushListsAndTable();
            inOrderedList = true;
            currentOlItems.push(
                <li key={idx} {...getMenuProps()} className={`leading-relaxed${hlClass}`}>
                    {parseFormatting(olMatch[1])}
                </li>,
            );
            return;
        }

        // Empty line
        if (!trimmed) {
            flushListsAndTable();
            elements.push(<div key={idx} className="h-1.5" />);
            return;
        }

        // Regular paragraph
        flushListsAndTable();
        elements.push(
            <p key={idx} {...getMenuProps()} className={`leading-relaxed my-1${hlClass}`}>
                {parseFormatting(line)}
            </p>,
        );
    });

    flushListsAndTable();
    return (
        <div key={keyPrefix} className="space-y-1">
            {elements}
        </div>
    );
};

const highlightCodeTokens = (code: string, lang?: string): React.ReactNode => {
    if (!code) return null;
    const language = (lang || "").toLowerCase();

    const tokenRegex = new RegExp(
        [
            "(?:\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#[^\\n]*)",
            "(?:\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)",
            "\\b(?:0x[0-9a-fA-F]+|\\d+\\.\\d+|\\d+)\\b",
            "\\b(?:const|let|var|function|def|fn|class|extends|interface|type|struct|enum|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|delete|import|export|from|as|default|async|await|yield|this|super|self|public|private|protected|static|readonly|abstract|implements|namespace|using|package|include|require|typeof|instanceof|void|null|undefined|true|false|True|False|None|and|or|not|is|in|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|GROUP|BY|ORDER|HAVING|LIMIT|CREATE|TABLE|DROP|ALTER|ADD|INDEX)\\b",
            "\\b(?:string|number|boolean|any|unknown|never|object|symbol|bigint|int|float|double|char|bool|void|Array|Map|Set|Promise|Record|List|Dict|Tuple|React|useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer|Component|HTML|Element|String|Number|Boolean|Object|Function|Math|JSON|Console|process|window|document)\\b",
            "\\b[a-zA-Z_]\\w*\\b",
            "[=\\+\\-\\*/%&\\|\\^!<>~\\?:;\\,\\.\\{\\}\\[\\]\\(\\)]",
        ].join("|"),
        "g",
    );

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    code.replace(tokenRegex, (match, offset) => {
        if (offset > lastIndex) {
            elements.push(code.slice(lastIndex, offset));
        }
        lastIndex = offset + match.length;

        let colorClass = "text-[#f8f8f2]";
        if (/^\/\//.test(match) || /^\/\*/.test(match) || (language !== "css" && /^#[^\n]*/.test(match))) {
            colorClass = "text-[#75715e] italic";
        } else if (/^["'`]/.test(match)) {
            colorClass = "text-[#e6db74]";
        } else if (/^\d/.test(match) || /^0x/.test(match)) {
            colorClass = "text-[#ae81ff]";
        } else if (
            /^(const|let|var|function|def|fn|class|extends|interface|type|struct|enum|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|delete|import|export|from|as|default|async|await|yield|this|super|self|public|private|protected|static|readonly|abstract|implements|namespace|using|package|include|require|typeof|instanceof|void|null|undefined|true|false|True|False|None|and|or|not|is|in|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|GROUP|BY|ORDER|HAVING|LIMIT|CREATE|TABLE|DROP|ALTER|ADD|INDEX)$/i.test(
                match,
            )
        ) {
            colorClass = "text-[#ff79c6] font-semibold";
        } else if (
            /^(string|number|boolean|any|unknown|never|object|symbol|bigint|int|float|double|char|bool|void|Array|Map|Set|Promise|Record|List|Dict|Tuple|React|useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer|Component|HTML|Element|String|Number|Boolean|Object|Function|Math|JSON|Console|process|window|document)$/.test(
                match,
            )
        ) {
            colorClass = "text-[#8be9fd] font-semibold";
        } else if (
            /^[a-zA-Z_]\w*$/.test(match) &&
            code
                .slice(offset + match.length)
                .trim()
                .startsWith("(")
        ) {
            colorClass = "text-[#50fa7b]";
        } else if (/^[=\+\-\*/%&\|^\!<>~\?:;\,\.\{\}\[\]\(\)]$/.test(match)) {
            colorClass = "text-[#ff79c6]";
        }

        elements.push(
            <span key={offset} className={`${colorClass} font-mono`}>
                {match}
            </span>,
        );

        return match;
    });

    if (lastIndex < code.length) {
        elements.push(code.slice(lastIndex));
    }

    return <>{elements}</>;
};

const CodeBlock = ({ code, language }: { code: string; language?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const lineCount = code ? code.split("\n").length : 0;

    return (
        <div className="my-3 rounded-2xl bg-[#1e1e24] text-[#f8f8f2] overflow-hidden shadow-md border border-white/10 select-text">
            <div className="flex items-center justify-between px-4 py-2 bg-[#18181c] border-b border-white/10 text-xs font-sans">
                <div className="flex items-center gap-2 font-semibold text-white/70 uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block mr-1.5" />
                    <span>{language || "code"}</span>
                    <span className="text-white/40 text-[10px] font-normal lowercase">({lineCount} lines)</span>
                </div>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer font-medium"
                >
                    {copied ? (
                        <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copy code</span>
                        </>
                    )}
                </button>
            </div>

            <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed whitespace-pre-wrap select-text">
                <code className="font-mono">{highlightCodeTokens(code, language)}</code>
            </pre>
        </div>
    );
};

const renderMarkdownText = (text: string, activeLineIndex?: number, onLineContextMenu?: (e: React.MouseEvent, lineText: string, lineIndex: number) => void) => {
    if (!text) return null;

    const codeBlockRegex = /```(\w+)?\s*\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            elements.push(renderInlineMarkdown(text.slice(lastIndex, match.index), `text-${lastIndex}`, activeLineIndex, onLineContextMenu));
        }
        const lang = match[1] || "";
        const codeContent = match[2]?.trim() || "";
        elements.push(<CodeBlock key={`code-${match.index}`} code={codeContent} language={lang} />);
        lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        elements.push(renderInlineMarkdown(text.slice(lastIndex), `text-${lastIndex}`, activeLineIndex, onLineContextMenu));
    }

    return <>{elements}</>;
};

const getAttachmentType = (fileName: string, mimeType: string): "image" | "plain_text" | "code" | "audio" => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const audioExts = ["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma"];
    if (audioExts.includes(ext)) return "audio";
    const codeExts = [
        "c",
        "h",
        "css",
        "html",
        "js",
        "ts",
        "jsx",
        "tsx",
        "py",
        "java",
        "json",
        "xml",
        "asm",
        "nasm",
        "cs",
        "cpp",
        "cxx",
        "hpp",
        "csv",
        "lsp",
        "lisp",
        "dockerfile",
        "glsl",
        "lua",
        "php",
        "rb",
        "ru",
        "rs",
        "sql",
        "sh",
        "yaml",
        "yml",
        "p8",
        "go",
        "env",
    ];
    const imageExts = ["png", "jpeg", "jpg", "webp", "gif", "svg", "bmp"];
    if (imageExts.includes(ext)) return "image";
    if (codeExts.includes(ext)) return "code";
    return "plain_text";
};

export default function ChatPage() {
    const router = useRouter();
    const params = useParams<{ chat_id?: string }>();
    const routeChatId = params?.chat_id;
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isGeneratingRef = useRef<boolean>(false);
    const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);

    const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const currentCount = selectedAttachments.length;
        const maxAllowed = 4;
        const remaining = maxAllowed - currentCount;

        if (remaining <= 0) {
            alert("Maximum limit of 4 attachments (images or document files) reached.");
            if (e.target) e.target.value = "";
            return;
        }

        const selectedFiles = Array.from(files).slice(0, remaining);
        if (files.length > remaining) {
            alert(`Only ${remaining} more attachment(s) allowed (limit is 4 total).`);
        }

        const readPromises = selectedFiles.map((file) => {
            return new Promise<SelectedAttachment>((resolve, reject) => {
                const reader = new FileReader();
                const attType = getAttachmentType(file.name, file.type);
                const ext = file.name.split(".").pop()?.toLowerCase() || "txt";

                reader.onload = () => {
                    if (typeof reader.result === "string") {
                        resolve({
                            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                            name: file.name,
                            type: attType,
                            content: reader.result,
                            size: file.size,
                            extension: ext,
                        });
                    } else {
                        reject(new Error("Failed to read file"));
                    }
                };
                reader.onerror = () => reject(reader.error);

                if (attType === "image" || attType === "audio") {
                    reader.readAsDataURL(file);
                } else {
                    reader.readAsText(file);
                }
            });
        });

        Promise.all(readPromises)
            .then((newAtts) => {
                setSelectedAttachments((prev) => [...prev, ...newAtts].slice(0, maxAllowed));
            })
            .catch((err) => {
                console.error("Error reading attached files:", err);
            });

        if (e.target) e.target.value = "";
    };

    const handleRemoveSelectedAttachment = (indexToRemove: number) => {
        setSelectedAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    // Zustand Store Integration for long-lived data caching & navigation
    const {
        instances,
        modelPreferences,
        appPreferences,
        fetchAppPreferences,
        instanceModelsMap,
        fetchInstances,
        fetchModelPreferences,
        fetchInstanceModels,
        setInstances: setStoreInstances,
        setModelPreference: setStoreModelPreference,
        removeModelPreference: storeRemoveModelPreference,
        currentView,
        setCurrentView,
        activeTab,
        setActiveTab,
        folders,
        setFolders,
        fetchFolders,
        draggedChatId,
        setDraggedChatId,
        folderContextMenu,
        setFolderContextMenu,
        isCreatingFolder,
        setIsCreatingFolder,
        isRightDrawerOpen,
        setIsRightDrawerOpen,
    } = useAppStore();

    const [activeAttachmentModal, setActiveAttachmentModal] = useState<{ title: string; type: string; content: string } | null>(null);
    const [activeImageModal, setActiveImageModal] = useState<{ src: string; title?: string } | null>(null);
    const [isChatContextMenuOpen, setIsChatContextMenuOpen] = useState<boolean>(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
    const [renameInputVal, setRenameInputVal] = useState<string>("");
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);
    const [isForkModalOpen, setIsForkModalOpen] = useState<boolean>(false);
    const [forkTargetMsg, setForkTargetMsg] = useState<Message | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
    const [exportFormat, setExportFormat] = useState<"md" | "obsidian" | "json" | "txt">("md");
    const [editingModel, setEditingModel] = useState<any | null>(null);
    const [editModelVoice, setEditModelVoice] = useState<string>("af_heart");
    const [editModelNumCtx, setEditModelNumCtx] = useState<number>(8192);
    const [editModelName, setEditModelName] = useState<string>("");
    const [editModelDescription, setEditModelDescription] = useState<string>("");
    const [editModelFirstMessage, setEditModelFirstMessage] = useState<string>("");
    const [editModelAlternateGreetings, setEditModelAlternateGreetings] = useState<string[]>([]);
    const [editModelCharacterBook, setEditModelCharacterBook] = useState<Array<{ name: string; description: string; tags: string }>>([]);
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState<boolean>(false);
    const [newChatTitleInput, setNewChatTitleInput] = useState<string>("New Chat");
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<
        "import-chat" | "manage-instances" | "preferences" | "manage-lorebook" | "manage-personas" | "about-walpaca"
    >("import-chat");

    // --- Manage Lorebook State & Handlers ---
    const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplate[]>([]);
    const [isLorebookLoading, setIsLorebookLoading] = useState<boolean>(false);
    const [lorebookSearchQuery, setLorebookSearchQuery] = useState<string>("");
    const [isLorebookModalOpen, setIsLorebookModalOpen] = useState<boolean>(false);
    const [editingLorebookTemplate, setEditingLorebookTemplate] = useState<LorebookTemplate | null>(null);
    const [lorebookFormName, setLorebookFormName] = useState<string>("");
    const [lorebookFormKeys, setLorebookFormKeys] = useState<string>("");
    const [lorebookFormContent, setLorebookFormContent] = useState<string>("");
    const [lorebookFormFilename, setLorebookFormFilename] = useState<string>("");
    const [lorebookSaving, setLorebookSaving] = useState<boolean>(false);

    const fetchLorebookTemplates = useCallback(async () => {
        setIsLorebookLoading(true);
        try {
            const res = await fetch(`${getApiUrl()}/lorebook`);
            if (res.ok) {
                const data = await res.json();
                setLorebookTemplates(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed fetching lorebook templates:", err);
        } finally {
            setIsLorebookLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentView === "settings" && activeSettingsCategory === "manage-lorebook") {
            fetchLorebookTemplates();
        }
    }, [currentView, activeSettingsCategory, fetchLorebookTemplates]);

    // --- Manage Personas State & Handlers ---
    const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplate[]>([]);
    const [isPersonaLoading, setIsPersonaLoading] = useState<boolean>(false);
    const [personaSearchQuery, setPersonaSearchQuery] = useState<string>("");
    const [personaViewMode, setPersonaViewMode] = useState<"list" | "editor">("list");
    const [editingPersonaTemplate, setEditingPersonaTemplate] = useState<PersonaTemplate | null>(null);

    // Persona Editor Form State
    const [personaFormName, setPersonaFormName] = useState<string>("");
    const [personaFormDescription, setPersonaFormDescription] = useState<string>("");
    const [personaFormScenario, setPersonaFormScenario] = useState<string>("");
    const [personaFormSystemPrompt, setPersonaFormSystemPrompt] = useState<string>("");
    const [personaFormPostHistoryInstructions, setPersonaFormPostHistoryInstructions] = useState<string>("");
    const [personaFormFirstMes, setPersonaFormFirstMes] = useState<string>("");
    const [personaFormAlternateGreetings, setPersonaFormAlternateGreetings] = useState<string[]>([]);
    const [personaFormVoice, setPersonaFormVoice] = useState<string>("af_heart");
    const [personaFormPicture, setPersonaFormPicture] = useState<string>("");
    const [personaFormNumCtx, setPersonaFormNumCtx] = useState<number>(8192);
    const [personaFormTemperature, setPersonaFormTemperature] = useState<number>(0.7);
    const [personaFormTopP, setPersonaFormTopP] = useState<number>(0.9);
    const [personaFormTopK, setPersonaFormTopK] = useState<number>(40);
    const [personaFormRepeatPenalty, setPersonaFormRepeatPenalty] = useState<number>(1.1);
    const [personaFormPresencePenalty, setPersonaFormPresencePenalty] = useState<number>(0.0);
    const [personaFormFrequencyPenalty, setPersonaFormFrequencyPenalty] = useState<number>(0.0);
    const [personaFormLorebookEntries, setPersonaFormLorebookEntries] = useState<Array<{ name: string; keys: string; content: string; enabled: boolean }>>([]);
    const [personaAvatarPreview, setPersonaAvatarPreview] = useState<string>("");
    const [isUploadingPersonaAvatar, setIsUploadingPersonaAvatar] = useState<boolean>(false);

    const [personaSaving, setPersonaSaving] = useState<boolean>(false);
    const [deletingPersonaTemplate, setDeletingPersonaTemplate] = useState<PersonaTemplate | null>(null);

    // Apply Persona to Model Modal state
    const [applyPersonaModalTemplate, setApplyPersonaModalTemplate] = useState<PersonaTemplate | null>(null);
    const [applyPersonaSelectedModelId, setApplyPersonaSelectedModelId] = useState<string>("");
    const [isApplyingPersona, setIsApplyingPersona] = useState<boolean>(false);

    const fetchPersonaTemplates = useCallback(async () => {
        setIsPersonaLoading(true);
        try {
            const res = await fetch(`${getApiUrl()}/personas`);
            if (res.ok) {
                const data = await res.json();
                setPersonaTemplates(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed fetching persona templates:", err);
        } finally {
            setIsPersonaLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentView === "settings" && activeSettingsCategory === "manage-personas") {
            fetchPersonaTemplates();
        }
    }, [currentView, activeSettingsCategory, fetchPersonaTemplates]);

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

        // Show avatar preview immediately as soon as selected
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

    const handleUpdatePersonaLorebookEntry = (idx: number, field: "name" | "keys" | "content" | "enabled", value: any) => {
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
        } catch (err: any) {
            console.error("Error saving persona template:", err);
            alert(err.message || "Error saving template");
        } finally {
            setPersonaSaving(false);
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

    const handleOpenCreateLorebookModal = () => {
        setEditingLorebookTemplate(null);
        setLorebookFormName("");
        setLorebookFormKeys("");
        setLorebookFormContent("");
        setLorebookFormFilename("");
        setIsLorebookModalOpen(true);
    };

    const handleOpenEditLorebookModal = (template: LorebookTemplate) => {
        setEditingLorebookTemplate(template);
        setLorebookFormName(template.name);
        setLorebookFormKeys(Array.isArray(template.keys) ? template.keys.join(", ") : "");
        setLorebookFormContent(template.content || "");
        setLorebookFormFilename(template.filename);
        setIsLorebookModalOpen(true);
    };

    const handleSaveLorebookTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lorebookFormName.trim()) return;

        setLorebookSaving(true);
        try {
            const keysArray = lorebookFormKeys
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean);

            const payload: any = {
                name: lorebookFormName.trim(),
                keys: keysArray,
                content: lorebookFormContent,
            };

            let url = `${getApiUrl()}/lorebook`;
            let method = "POST";

            if (editingLorebookTemplate) {
                url = `${getApiUrl()}/lorebook/${encodeURIComponent(editingLorebookTemplate.filename)}`;
                method = "PUT";
            } else if (lorebookFormFilename.trim()) {
                payload.filename = lorebookFormFilename.trim();
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setIsLorebookModalOpen(false);
                fetchLorebookTemplates();
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed saving lorebook template");
            }
        } catch (err: any) {
            console.error("Error saving lorebook template:", err);
            alert(err.message || "Error saving template");
        } finally {
            setLorebookSaving(false);
        }
    };

    const [deletingLorebookTemplate, setDeletingLorebookTemplate] = useState<LorebookTemplate | null>(null);

    const handleConfirmDeleteLorebookTemplate = async () => {
        if (!deletingLorebookTemplate) return;

        try {
            const filename = deletingLorebookTemplate.filename;
            const res = await fetch(`${getApiUrl()}/lorebook/${encodeURIComponent(filename)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setDeletingLorebookTemplate(null);
                fetchLorebookTemplates();
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed deleting template");
            }
        } catch (err: any) {
            console.error("Error deleting template:", err);
            alert(err.message || "Error deleting template");
        }
    };

    // --- Instances Management State & Handlers ---
    const [instanceSubView, setInstanceSubView] = useState<"list" | "select-type" | "form" | "instance-models" | "edit-model">("list");
    const [selectedInstanceForModels, setSelectedInstanceForModels] = useState<InstanceItem | null>(null);
    const [instanceModelsList, setInstanceModelsList] = useState<any[]>([]);
    const [selectedInstanceType, setSelectedInstanceType] = useState<string>("Ollama");
    const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

    // Chat Instance & Model Selector State
    const [selectedChatInstanceId, setSelectedChatInstanceId] = useState<string>("");
    const [selectedChatModelId, setSelectedChatModelId] = useState<string>("");
    const [isThinkingEnabled, setIsThinkingEnabled] = useState<boolean>(false);
    const [isSelectModelModalOpen, setIsSelectModelModalOpen] = useState<boolean>(false);
    const [modelModalSearchQuery, setModelModalSearchQuery] = useState<string>("");
    const [selectedModalInstanceId, setSelectedModalInstanceId] = useState<string>("");

    // Chat Drag & Drop to Folders State & Handler
    const [dragOverFolderTarget, setDragOverFolderTarget] = useState<string | null>(null);

    // Persona Details Read-Only Modal State
    const [personaDetailsData, setPersonaDetailsData] = useState<PersonaDetailsData | null>(null);
    const [isPersonaDetailsModalOpen, setIsPersonaDetailsModalOpen] = useState<boolean>(false);
    const handleClosePersonaDetailsModal = useCallback(() => {
        setIsPersonaDetailsModalOpen(false);
    }, []);

    // Custom Prompts Modal State & Handler
    const [isCustomPromptsModalOpen, setIsCustomPromptsModalOpen] = useState<boolean>(false);
    const handleSelectPrompt = useCallback((promptContent: string) => {
        setInputText(promptContent);
        if (promptTextareaRef.current) {
            promptTextareaRef.current.value = promptContent;
            autoResizeTextarea(promptTextareaRef.current);
            promptTextareaRef.current.focus();
        }
    }, [autoResizeTextarea]);

    // Import Chat State & Handlers
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [importStatusMessage, setImportStatusMessage] = useState<string>("");
    const [isDraggingImport, setIsDraggingImport] = useState<boolean>(false);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    const parseImportContent = (fileName: string, text: string): any[] => {
        const cleanFileName = fileName.replace(/\.[^/.]+$/, "");
        const trimmed = text.trim();

        // 1. JSON Parsing
        if (fileName.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                const parsed = JSON.parse(text);
                const results: any[] = [];

                const processJsonObject = (obj: any): any | null => {
                    if (!obj || typeof obj !== "object") return null;

                    // ChatGPT export format (mapping object)
                    if (obj.mapping && typeof obj.mapping === "object") {
                        const title = obj.title || cleanFileName;
                        const msgs: any[] = [];
                        Object.values(obj.mapping).forEach((node: any) => {
                            const msg = node?.message;
                            if (msg && msg.content && Array.isArray(msg.content.parts)) {
                                const textParts = msg.content.parts.filter((p: any) => typeof p === "string").join("\n");
                                if (textParts.trim()) {
                                    const authorRole = msg.author?.role;
                                    const role = authorRole === "user" ? "user" : "assistant";
                                    msgs.push({
                                        role,
                                        content: textParts,
                                        model: msg.metadata?.model_slug,
                                        date_time: msg.create_time ? new Date(msg.create_time * 1000).toISOString() : undefined,
                                    });
                                }
                            }
                        });
                        return msgs.length > 0 ? { title, messages: msgs } : null;
                    }

                    // Claude export format (chat_messages array)
                    if (Array.isArray(obj.chat_messages)) {
                        const title = obj.name || obj.title || cleanFileName;
                        const msgs: any[] = obj.chat_messages
                            .map((m: any) => ({
                                role: m.sender === "human" || m.sender === "user" ? "user" : "assistant",
                                content: m.text || m.content || "",
                                date_time: m.created_at,
                            }))
                            .filter((m: any) => m.content.trim());
                        return msgs.length > 0 ? { title, messages: msgs } : null;
                    }

                    // Walpaca / Generic export format (messages array)
                    if (Array.isArray(obj.messages)) {
                        const title = obj.title || obj.name || cleanFileName;
                        const msgs: any[] = obj.messages
                            .map((m: any) => ({
                                role: m.role === "user" || m.isSelf ? "user" : "assistant",
                                content: m.content || "",
                                model: m.model,
                                date_time: m.time || m.date_time,
                                attachments: Array.isArray(m.attachments)
                                    ? m.attachments.map((a: any) => ({
                                          name: a.name || "attachment",
                                          type: a.type || "txt",
                                          content: a.content || "",
                                      }))
                                    : undefined,
                            }))
                            .filter((m: any) => m.content.trim() || (m.attachments && m.attachments.length > 0));
                        return msgs.length > 0 ? { title, messages: msgs } : null;
                    }

                    return null;
                };

                if (Array.isArray(parsed)) {
                    parsed.forEach((item) => {
                        const c = processJsonObject(item);
                        if (c) results.push(c);
                    });
                } else {
                    const c = processJsonObject(parsed);
                    if (c) results.push(c);
                }

                if (results.length > 0) return results;
            } catch (e) {
                console.warn("JSON import parse warning:", e);
            }
        }

        // 2. Markdown Parsing (.md / .markdown)
        if (fileName.endsWith(".md") || fileName.endsWith(".markdown") || text.includes("# ") || text.includes("### ")) {
            let title = cleanFileName;
            const titleMatch = text.match(/^#\s+(.+)$/m);
            if (titleMatch) {
                title = titleMatch[1].trim();
            }

            const messages: any[] = [];
            const sections = text.split(/(?=^###\s+|^----\s*$)/m);

            sections.forEach((sec) => {
                const headerMatch = sec.match(/^###\s+\*\*?([^*\n|]+)\*\*?(\s*\|\s*(.+))?/m);
                if (headerMatch) {
                    const senderStr = headerMatch[1].trim();
                    const timeStr = headerMatch[3]?.trim();
                    const isUser = /user|you/i.test(senderStr);
                    const role: "user" | "assistant" = isUser ? "user" : "assistant";

                    let body = sec
                        .replace(/^###\s+.+$/m, "")
                        .replace(/^----\s*$/m, "")
                        .trim();
                    const attachments: any[] = [];

                    // HTML details tags
                    body = body.replace(/<details>\s*<summary>.*?([^\/\s>]+)<\/summary>\s*```[\w]*\n([\s\S]*?)```\s*<\/details>/gi, (_, attName, attContent) => {
                        attachments.push({ name: attName.trim(), type: "txt", content: attContent.trim() });
                        return "";
                    });

                    // Obsidian callouts (> [!quote]- filename)
                    body = body.replace(/^>\s*\[!(?:quote|info)\]-?\s*(.+)\n((?:>\s*.*\n?)*)/gm, (_, attName, blockContent) => {
                        const cleanContent = blockContent
                            .split("\n")
                            .map((l: string) => l.replace(/^>\s?/, ""))
                            .join("\n")
                            .trim();
                        attachments.push({ name: attName.trim(), type: "txt", content: cleanContent });
                        return "";
                    });

                    body = body.trim();
                    if (body || attachments.length > 0) {
                        messages.push({
                            role,
                            content: body,
                            model: !isUser && senderStr !== "Assistant" ? senderStr : undefined,
                            date_time: timeStr,
                            attachments: attachments.length > 0 ? attachments : undefined,
                        });
                    }
                }
            });

            if (messages.length > 0) {
                return [{ title, messages }];
            }
        }

        // 3. Plain Text Parsing (.txt or fallback)
        let title = cleanFileName;
        const txtTitleMatch = text.match(/^===\s*(.+?)\s*===$/m);
        if (txtTitleMatch) {
            title = txtTitleMatch[1].trim();
        }

        const textLines = text.split("\n");
        const messages: any[] = [];
        let currentSender = "";
        let currentTime = "";
        let currentLines: string[] = [];

        const flushMessage = () => {
            if (currentSender && currentLines.length > 0) {
                const isUser = /you|user/i.test(currentSender);
                const content = currentLines.join("\n").trim();
                if (content) {
                    messages.push({
                        role: isUser ? "user" : "assistant",
                        content,
                        model: !isUser && currentSender !== "Assistant" ? currentSender : undefined,
                        date_time: currentTime || undefined,
                    });
                }
            }
            currentLines = [];
        };

        textLines.forEach((line) => {
            const msgHeaderMatch = line.match(/^\[([^\]]+)\]\s*([^:\n]+):$/);
            if (msgHeaderMatch) {
                flushMessage();
                currentTime = msgHeaderMatch[1].trim();
                currentSender = msgHeaderMatch[2].trim();
            } else if (line.trim() === "----------------------------------------") {
                flushMessage();
                currentSender = "";
            } else if (!line.startsWith("===") && !line.startsWith("Generated from AlpacaWeb")) {
                currentLines.push(line);
            }
        });
        flushMessage();

        if (messages.length > 0) {
            return [{ title, messages }];
        }

        return [
            {
                title: cleanFileName,
                messages: [{ role: "user", content: trimmed }],
            },
        ];
    };

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
            const res = await fetch(`${API_URL}/chats/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chats: allParsedChats }),
            });

            if (!res.ok) {
                throw new Error("Failed to import chats");
            }

            const newChats = await res.json();
            setImportStatusMessage(`Successfully imported ${newChats.length} conversation(s)!`);

            const chatsRes = await fetch(`${API_URL}/chats`);
            if (chatsRes.ok) {
                const updatedList = await chatsRes.json();
                setChatItems(updatedList.map(mapBackendChatToChatItem));
            }

            if (newChats.length > 0 && newChats[0].id) {
                setActiveChatId(newChats[0].id);
                setTimeout(() => {
                    setCurrentView("chat");
                }, 800);
            }
        } catch (e: any) {
            console.error("Import error:", e);
            setImportStatusMessage(`Import failed: ${e.message || "Unknown error"}`);
        } finally {
            setIsImporting(false);
        }
    };

    const handleDropChatToFolder = async (chatId: string, targetFolderId: string | null) => {
        setDragOverFolderTarget(null);
        setDraggedChatId(null);
        if (!chatId) return;

        const targetFolderVal = targetFolderId === "none" || !targetFolderId ? null : targetFolderId;

        setChatItems((prev) => prev.map((c) => (c.id === chatId ? { ...c, folder: targetFolderVal || undefined } : c)));

        try {
            await fetch(`${API_URL}/chats/${chatId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folder: targetFolderVal }),
            });
        } catch (err) {
            console.warn("Could not move chat to folder on backend:", err);
        }
    };

    const [lineContextMenu, setLineContextMenu] = useState<{
        x: number;
        y: number;
        msgId: string;
        lineText: string;
        lineIndex: number;
        voice?: string;
        fullContent: string;
    } | null>(null);
    const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null);
    const [renameFolderNameInput, setRenameFolderNameInput] = useState<string>("");
    const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string } | null>(null);

    // Chat Item Context Menu State
    const [chatContextMenu, setChatContextMenu] = useState<{
        chatId: string;
        chatName: string;
        x: number;
        y: number;
    } | null>(null);

    useEffect(() => {
        const handleGlobalClick = () => {
            setFolderContextMenu(null);
            setLineContextMenu(null);
            setChatContextMenu(null);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setFolderContextMenu(null);
                setLineContextMenu(null);
                setChatContextMenu(null);
            }
        };
        window.addEventListener("click", handleGlobalClick);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("click", handleGlobalClick);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const handleChatContextMenu = (e: React.MouseEvent, chat: ChatItem) => {
        e.preventDefault();
        e.stopPropagation();
        setFolderContextMenu(null);
        setLineContextMenu(null);
        const menuWidth = 180;
        const menuHeight = 200;
        const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
        const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
        setChatContextMenu({
            chatId: chat.id,
            chatName: chat.name,
            x: Math.max(8, x),
            y: Math.max(8, y),
        });
    };

    const handleContextMenuRenameChat = (chatId: string, chatName: string) => {
        setChatContextMenu(null);
        setActiveChatId(chatId);
        setRenameInputVal(chatName);
        setIsRenameModalOpen(true);
    };

    const handleContextMenuDuplicateChat = (chatId: string) => {
        setChatContextMenu(null);
        setActiveChatId(chatId);
        setIsDuplicateModalOpen(true);
    };

    const handleContextMenuExportChat = async (chatId: string) => {
        setChatContextMenu(null);
        if (activeChatId !== chatId) {
            setActiveChatId(chatId);
            await fetchChatMessages(chatId);
        }
        setIsExportModalOpen(true);
    };

    const handleContextMenuDeleteChat = (chatId: string) => {
        setChatContextMenu(null);
        setActiveChatId(chatId);
        setIsDeleteModalOpen(true);
    };

    const handleStartRenameFolder = (folderId: string, folderName: string) => {
        setFolderContextMenu(null);
        setRenamingFolder({ id: folderId, name: folderName });
        setRenameFolderNameInput(folderName);
    };

    const handleConfirmRenameFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingFolder || !renameFolderNameInput.trim()) return;
        const { id } = renamingFolder;
        const newName = renameFolderNameInput.trim();
        setRenamingFolder(null);

        setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));

        try {
            await fetch(`${API_URL}/folders/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
            });
        } catch (err) {
            console.warn("Could not rename folder on backend:", err);
        }
    };

    const handleStartDeleteFolder = (folderId: string, folderName: string) => {
        setFolderContextMenu(null);
        setDeletingFolder({ id: folderId, name: folderName });
    };

    const handleConfirmDeleteFolder = async () => {
        if (!deletingFolder) return;
        const { id } = deletingFolder;
        setDeletingFolder(null);

        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (activeTab === id) {
            setActiveTab("none");
        }

        try {
            await fetch(`${API_URL}/folders/${id}`, {
                method: "DELETE",
            });
            fetchChats(activeTab === id ? "none" : activeTab);
        } catch (err) {
            console.warn("Could not delete folder on backend:", err);
        }
    };

    // Inline Message Editing States & Handlers
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editingMsgContent, setEditingMsgContent] = useState<string>("");
    const [deletingMsg, setDeletingMsg] = useState<Message | null>(null);

    const handleOpenForkModal = (msg: Message) => {
        setForkTargetMsg(msg);
        setIsForkModalOpen(true);
    };

    const handleConfirmForkChat = async () => {
        if (!activeChatId || !forkTargetMsg?.id) {
            setIsForkModalOpen(false);
            return;
        }

        const targetMsgId = forkTargetMsg.id;
        setIsForkModalOpen(false);
        setForkTargetMsg(null);

        try {
            const res = await fetch(`${API_URL}/chats/${activeChatId}/fork`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message_id: targetMsgId }),
            });

            if (!res.ok) {
                throw new Error("Failed to fork chat");
            }

            const newChat = await res.json();

            const chatsRes = await fetch(`${API_URL}/chats`);
            if (chatsRes.ok) {
                const updatedList = await chatsRes.json();
                setChatItems(updatedList.map(mapBackendChatToChatItem));
            }

            if (newChat && newChat.id) {
                setActiveChatId(newChat.id);
            }
        } catch (e: any) {
            console.error("Fork Chat Error:", e);
        }
    };

    const handleStartInlineEdit = (msg: Message) => {
        setEditingMsgId(msg.id);
        setEditingMsgContent(msg.content);
    };

    const handleSaveInlineEdit = async () => {
        if (!editingMsgId) return;
        const updatedContent = editingMsgContent.trim();
        const msgId = editingMsgId;

        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: updatedContent } : m)));
        setEditingMsgId(null);
        setEditingMsgContent("");

        try {
            await fetch(`${API_URL}/messages/${msgId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: updatedContent }),
            });
        } catch (err) {
            console.warn("Could not update message content on backend:", err);
        }
    };

    const handleOpenDeleteMessageModal = (msg: Message) => {
        setDeletingMsg(msg);
    };

    const handleConfirmDeleteMessage = async () => {
        if (!deletingMsg) return;
        const msgId = deletingMsg.id;

        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setDeletingMsg(null);

        try {
            await fetch(`${API_URL}/messages/${msgId}`, {
                method: "DELETE",
            });
        } catch (err) {
            console.warn("Could not delete message on backend:", err);
        }
    };

    const fetchModelsForInstance = async (instId: string) => {
        if (!instId) return;
        const data = await fetchInstanceModels(instId);
        if (Array.isArray(data) && data.length > 0) {
            setInstanceModelsList(data);
            return;
        }
        const inst = instances.find((i) => i.id === instId);
        if (inst) {
            const instName = inst.properties?.name || inst.type;
            if (inst.type === "gemini" || inst.properties?.url?.includes("generativelanguage.googleapis.com")) {
                setInstanceModelsList([
                    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", provider: "Google Gemini", voice: "af_heart", context: "1,048,576 tokens" },
                    { id: "gemini-flash-latest", name: "Gemini Flash (Latest)", provider: "Google Gemini", voice: "af_heart", context: "1,048,576 tokens" },
                    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "Google Gemini", voice: "af_heart", context: "1,048,576 tokens" },
                    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "Google Gemini", voice: "af_heart", context: "1,048,576 tokens" },
                ]);
                return;
            }
            setInstanceModelsList([
                { id: `${inst.id}-m1`, name: `${instName} Model 1`, provider: inst.type, voice: "af_heart", context: "8,192 tokens" },
                { id: `${inst.id}-m2`, name: `${instName} Model 2`, provider: inst.type, voice: "am_adam", context: "16,384 tokens" },
            ]);
        }
    };

    const handleOpenDuplicateModal = () => {
        setIsChatContextMenuOpen(false);
        setIsDuplicateModalOpen(true);
    };

    const handleConfirmDuplicateChat = async () => {
        setIsDuplicateModalOpen(false);
        const targetChat = chatItems.find((c) => c.id === activeChatId) || activeChat;
        if (!targetChat) return;

        const newId = `chat-${Date.now()}`;
        const duplicateName = `${targetChat.name} (Copy)`;
        const newChatObj: ChatItem = {
            ...targetChat,
            id: newId,
            name: duplicateName,
            time: "Just now",
            unreadCount: undefined,
        };

        setChatItems((prev) => [newChatObj, ...prev]);
        setActiveChatId(newId);
        setActiveChat(newChatObj);
        if (typeof window !== "undefined") {
            window.history.pushState(null, "", `/${newId}`);
        }

        try {
            await fetch(`${API_URL}/chats`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: newId,
                    name: duplicateName,
                    folder: targetChat.folder || null,
                }),
            });
        } catch (err) {
            console.warn("Could not duplicate chat on backend API:", err);
        }
    };

    const handleOpenEditModelModal = (mod: any) => {
        setEditingModel(mod);
        const rawId = String(mod.id || "");
        const prefKey = rawId.toLowerCase();
        const pref = modelPreferences[rawId] || modelPreferences[prefKey];
        setEditModelVoice(pref?.voice || mod.voice || "af_heart");
        setEditModelNumCtx(pref?.num_ctx ?? (typeof mod.num_ctx === "number" ? mod.num_ctx : mod.context ? parseInt(String(mod.context).replace(/,/g, ""), 10) || 8192 : 8192));

        const char = pref?.character || {};
        const charData = char.data || char || {};

        setEditModelName(getCharacterName(char) || (pref as any)?.name || mod.name || mod.id || "");
        setEditModelDescription(charData.description || pref?.description || "");
        setEditModelFirstMessage(charData.first_mes || charData.first_message || pref?.first_message || "");

        const greetings = Array.isArray(charData.alternate_greetings) ? charData.alternate_greetings : Array.isArray(pref?.alternate_greetings) ? pref.alternate_greetings : [];
        setEditModelAlternateGreetings(greetings);

        let cbItems: Array<{ name: string; description: string; tags: string }> = [];
        if (Array.isArray(charData.character_book?.entries)) {
            cbItems = charData.character_book.entries.map((e: any) => ({
                name: e.comment || e.name || "",
                description: e.content || e.description || "",
                tags: Array.isArray(e.keys) ? e.keys.join(", ") : Array.isArray(e.tags) ? e.tags.join(", ") : String(e.keys || e.tags || ""),
            }));
        } else if (Array.isArray(charData.character_book)) {
            cbItems = charData.character_book.map((e: any) => ({
                name: e.name || e.comment || "",
                description: e.description || e.content || "",
                tags: Array.isArray(e.tags) ? e.tags.join(", ") : Array.isArray(e.keys) ? e.keys.join(", ") : String(e.tags || e.keys || ""),
            }));
        }
        setEditModelCharacterBook(cbItems);
        setInstanceSubView("edit-model");
    };

    const handleAddGreeting = () => {
        setEditModelAlternateGreetings([...editModelAlternateGreetings, ""]);
    };

    const handleUpdateGreeting = (index: number, val: string) => {
        setEditModelAlternateGreetings(editModelAlternateGreetings.map((g, i) => (i === index ? val : g)));
    };

    const handleRemoveGreeting = (index: number) => {
        setEditModelAlternateGreetings(editModelAlternateGreetings.filter((_, i) => i !== index));
    };

    const handleAddBookItem = () => {
        setEditModelCharacterBook([...editModelCharacterBook, { name: "", description: "", tags: "" }]);
    };

    const handleUpdateBookItem = (index: number, field: "name" | "description" | "tags", val: string) => {
        setEditModelCharacterBook(editModelCharacterBook.map((item, i) => (i === index ? { ...item, [field]: val } : item)));
    };

    const handleRemoveBookItem = (index: number) => {
        setEditModelCharacterBook(editModelCharacterBook.filter((_, i) => i !== index));
    };

    const handleSaveEditModel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingModel) return;

        const rawId = String(editingModel.id || "");
        const prefKey = rawId.toLowerCase();

        const filteredGreetings = editModelAlternateGreetings.map((g) => g.trim()).filter(Boolean);
        const formattedBookEntries = editModelCharacterBook.map((item) => {
            const tagsArr = item.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            return {
                name: item.name.trim(),
                comment: item.name.trim(),
                description: item.description.trim(),
                content: item.description.trim(),
                keys: tagsArr,
                tags: tagsArr,
            };
        });

        const existingPref = modelPreferences[rawId] || modelPreferences[prefKey] || {};
        const existingChar = existingPref.character || {};
        const existingCharData = existingChar.data || {};

        const updatedCharacter = {
            ...existingChar,
            data: {
                ...existingCharData,
                name: editModelName.trim(),
                description: editModelDescription.trim(),
                first_mes: editModelFirstMessage.trim(),
                alternate_greetings: filteredGreetings,
                character_book: {
                    ...(existingCharData.character_book || {}),
                    entries: formattedBookEntries,
                },
            },
            name: editModelName.trim(),
            description: editModelDescription.trim(),
            first_message: editModelFirstMessage.trim(),
            alternate_greetings: filteredGreetings,
            character_book: formattedBookEntries.map((e) => ({
                name: e.name,
                description: e.description,
                tags: e.tags,
            })),
        };

        const updatedPref: ModelPreference = {
            ...(existingPref || { id: rawId }),
            id: rawId,
            voice: editModelVoice,
            num_ctx: editModelNumCtx,
            character: updatedCharacter,
        };

        setStoreModelPreference(rawId, updatedPref);
        setInstanceSubView("instance-models");

        try {
            await fetch(`${API_URL}/model-preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: rawId,
                    voice: editModelVoice,
                    num_ctx: editModelNumCtx,
                    character: updatedCharacter,
                }),
            });
        } catch (err) {
            console.warn("Could not save model preference:", err);
        }
    };

    const handleManageInstanceModels = async (inst: InstanceItem) => {
        setSelectedInstanceForModels(inst);
        setInstanceSubView("instance-models");

        await fetchModelPreferences();
        const data = await fetchInstanceModels(inst.id);
        if (Array.isArray(data) && data.length > 0) {
            setInstanceModelsList(data);
            return;
        }
        const instName = inst.properties?.name || inst.type;
        setInstanceModelsList([
            { id: `${inst.id}-m1`, name: `${instName} Model 1`, provider: inst.type, voice: "af_heart", context: "8,192 tokens" },
            { id: `${inst.id}-m2`, name: `${instName} Model 2`, provider: inst.type, voice: "am_adam", context: "16,384 tokens" },
        ]);
    };

    // Instance Form fields matching user specs
    const [instFormName, setInstFormName] = useState<string>("Instance");
    const [instFormUrl, setInstFormUrl] = useState<string>("http://0.0.0.0:11434");
    const [instFormApiKey, setInstFormApiKey] = useState<string>("");
    const [showApiKeyText, setShowApiKeyText] = useState<boolean>(false);
    const [instFormThink, setInstFormThink] = useState<boolean>(false);
    const [instFormShareName, setInstFormShareName] = useState<number>(2); // 2 = Do Not Share
    const [instFormShowMetadata, setInstFormShowMetadata] = useState<boolean>(false);
    const [instFormAllowSsl, setInstFormAllowSsl] = useState<boolean>(false);
    const [instFormOverrideParams, setInstFormOverrideParams] = useState<boolean>(true);
    const [isOverrideAccordionOpen, setIsOverrideAccordionOpen] = useState<boolean>(true);
    const [instFormTemp, setInstFormTemp] = useState<number>(0.7);
    const [instFormSeed, setInstFormSeed] = useState<number>(0);
    const [instFormNumCtx, setInstFormNumCtx] = useState<number>(16384);
    const [instFormKeepAlivePreset, setInstFormKeepAlivePreset] = useState<string>("Set Timer");
    const [instFormKeepAliveMinutes, setInstFormKeepAliveMinutes] = useState<number>(5);

    const handleOpenAddInstanceModal = () => {
        setInstanceSubView("select-type");
    };

    const handleSelectInstanceType = (typeLabel: string) => {
        setSelectedInstanceType(typeLabel);
        setEditingInstanceId(null); // Add mode

        // Dynamic default values for new instance based on selected provider type
        let defaultName = "Instance";
        let defaultUrl = "http://0.0.0.0:11434";
        if (typeLabel.includes("Ollama")) {
            defaultName = "Ollama External";
            defaultUrl = "http://0.0.0.0:11434";
        } else if (typeLabel.includes("Ollama (Cloud)")) {
            defaultName = "Ollama Cloud";
            defaultUrl = "https://ollama.example.com";
        } else if (typeLabel.includes("OpenAI")) {
            defaultName = "OpenAI ChatGPT";
            defaultUrl = "https://api.openai.com/v1";
        } else if (typeLabel.includes("Gemini")) {
            defaultName = "Google Gemini";
            defaultUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
        } else if (typeLabel.includes("Anthropic")) {
            defaultName = "Anthropic Claude";
            defaultUrl = "https://api.anthropic.com";
        } else if (typeLabel.includes("Deepseek")) {
            defaultName = "Deepseek AI";
            defaultUrl = "https://api.deepseek.com";
        } else if (typeLabel.includes("Groq")) {
            defaultName = "Groq Cloud";
            defaultUrl = "https://api.groq.com/openai/v1";
        } else if (typeLabel.includes("Together")) {
            defaultName = "Together AI";
            defaultUrl = "https://api.together.xyz/v1";
        } else if (typeLabel.includes("Venice")) {
            defaultName = "Venice AI";
            defaultUrl = "https://api.venice.ai/api/v1";
        } else if (typeLabel.includes("OpenRouter")) {
            defaultName = "OpenRouter AI";
            defaultUrl = "https://openrouter.ai/api/v1";
        }

        setInstFormName(defaultName);
        setInstFormUrl(defaultUrl);
        setInstFormApiKey("");
        setShowApiKeyText(false);
        setInstFormThink(false);
        setInstFormShareName(2);
        setInstFormShowMetadata(false);
        setInstFormAllowSsl(false);
        setInstFormOverrideParams(true);
        setIsOverrideAccordionOpen(true);
        setInstFormTemp(0.7);
        setInstFormSeed(0);
        setInstFormNumCtx(16384);
        setInstFormKeepAlivePreset("Set Timer");
        setInstFormKeepAliveMinutes(5);

        setInstanceSubView("form");
    };

    const handleOpenEditInstanceModal = (inst: InstanceItem) => {
        setEditingInstanceId(inst.id); // Edit mode - type is locked!
        setSelectedInstanceType(
            inst.type === "ollama"
                ? "Ollama"
                : inst.type === "openai"
                  ? "OpenAI ChatGPT"
                  : inst.type === "gemini"
                    ? "Google Gemini"
                    : inst.type === "anthropic"
                      ? "Anthropic"
                      : inst.type === "deepseek"
                        ? "Deepseek"
                        : inst.type === "groq"
                          ? "Groq Cloud"
                          : inst.type === "together"
                            ? "Together AI"
                            : inst.type === "venice"
                              ? "Venice"
                              : inst.type === "openrouter"
                                ? "OpenRouter AI"
                                : inst.type,
        );
        setInstFormName(inst.properties?.name || "Instance");
        setInstFormUrl(inst.properties?.url || "http://0.0.0.0:11434");
        setInstFormApiKey(inst.properties?.api && inst.properties.api !== "NOKEY" ? inst.properties.api : "");
        setShowApiKeyText(false);
        setInstFormThink(Boolean(inst.properties?.think));
        setInstFormShareName(inst.properties?.share_name ?? 2);
        setInstFormShowMetadata(Boolean(inst.properties?.show_response_metadata));
        setInstFormAllowSsl(Boolean(inst.properties?.allow_self_signed_ssl));
        setInstFormOverrideParams(inst.properties?.override_parameters ?? true);
        setIsOverrideAccordionOpen(true);
        setInstFormTemp(inst.properties?.temperature ?? 0.7);
        setInstFormSeed(inst.properties?.seed ?? 0);
        setInstFormNumCtx(inst.properties?.num_ctx ?? 16384);
        setInstFormKeepAliveMinutes(inst.properties?.keep_alive ?? 5);

        setInstanceSubView("form");
    };

    const handleDeleteInstance = async (id: string) => {
        setStoreInstances(instances.filter((item) => item.id !== id));
        try {
            await fetch(`${API_URL}/instances/${id}`, { method: "DELETE" });
            fetchInstances(true);
        } catch (err) {
            console.warn("Could not delete instance:", err);
        }
    };

    const handleSaveInstanceForm = async (e: React.FormEvent) => {
        e.preventDefault();

        let backendType = "ollama";
        if (selectedInstanceType.includes("OpenAI")) backendType = "openai";
        else if (selectedInstanceType.includes("Gemini")) backendType = "gemini";
        else if (selectedInstanceType.includes("Anthropic")) backendType = "anthropic";
        else if (selectedInstanceType.includes("Deepseek")) backendType = "deepseek";
        else if (selectedInstanceType.includes("Groq")) backendType = "groq";
        else if (selectedInstanceType.includes("Together")) backendType = "together";
        else if (selectedInstanceType.includes("Venice")) backendType = "venice";
        else if (selectedInstanceType.includes("OpenRouter")) backendType = "openrouter";

        const payload = {
            type: backendType,
            pinned: false,
            properties: {
                name: instFormName.trim() || "Instance",
                url: instFormUrl.trim() || "http://0.0.0.0:11434",
                api: instFormApiKey.trim() || "NOKEY",
                think: instFormThink,
                share_name: Number(instFormShareName),
                show_response_metadata: instFormShowMetadata,
                allow_self_signed_ssl: instFormAllowSsl,
                override_parameters: instFormOverrideParams,
                temperature: Number(instFormTemp),
                seed: Number(instFormSeed),
                num_ctx: Number(instFormNumCtx),
                keep_alive: Number(instFormKeepAliveMinutes),
                default_model: null,
                title_model: null,
            },
        };

        if (editingInstanceId) {
            setStoreInstances(
                instances.map((inst) => (inst.id === editingInstanceId ? { ...inst, type: backendType, properties: { ...inst.properties, ...payload.properties } } : inst)),
            );
            try {
                await fetch(`${API_URL}/instances/${editingInstanceId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                fetchInstances(true);
            } catch (err) {
                console.warn("Could not update instance:", err);
            }
        } else {
            const tempId = `inst-${Date.now()}`;
            const newInst: InstanceItem = { id: tempId, pinned: false, type: backendType, properties: payload.properties };
            setStoreInstances([...instances, newInst]);
            try {
                const res = await fetch(`${API_URL}/instances`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (res.ok) {
                    fetchInstances(true);
                }
            } catch (err) {
                console.warn("Could not create instance:", err);
            }
        }

        setInstanceSubView("list");
    };

    // --- TTS Voice Playback State & Controls ---
    const [ttsState, setTtsState] = useState<{
        msgId: string | null;
        status: "playing" | "paused" | "stopped";
        lineIndex: number;
    }>({ msgId: null, status: "stopped", lineIndex: -1 });

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const ttsStateRef = useRef(ttsState);

    const updateTTSState = (
        newState:
            | { msgId: string | null; status: "playing" | "paused" | "stopped"; lineIndex: number }
            | ((prev: { msgId: string | null; status: "playing" | "paused" | "stopped"; lineIndex: number }) => {
                  msgId: string | null;
                  status: "playing" | "paused" | "stopped";
                  lineIndex: number;
              }),
    ) => {
        if (typeof newState === "function") {
            const next = newState(ttsStateRef.current);
            ttsStateRef.current = next;
            setTtsState(next);
        } else {
            ttsStateRef.current = newState;
            setTtsState(newState);
        }
    };

    const handleStopTTS = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }
        updateTTSState({ msgId: null, status: "stopped", lineIndex: -1 });
        clearMediaSession();
    };

    const handlePauseTTS = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        updateTTSState((prev) => ({ ...prev, status: "paused" }));
        setMediaSessionPlaybackState("paused");
    };

    const handleResumeTTS = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(console.warn);
        }
        updateTTSState((prev) => ({ ...prev, status: "playing" }));
        setMediaSessionPlaybackState("playing");
    };

    // Media Session handlers & Hardware Media Keys registration
    useEffect(() => {
        const cleanupMediaSession = registerMediaSessionHandlers({
            onPlay: () => {
                if (ttsStateRef.current.status === "paused") {
                    handleResumeTTS();
                }
            },
            onPause: () => {
                if (ttsStateRef.current.status === "playing") {
                    handlePauseTTS();
                }
            },
            onStop: () => {
                handleStopTTS();
            },
            onSeekBackward: (offset) => {
                if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (offset || 5));
                }
            },
            onSeekForward: (offset) => {
                if (audioRef.current) {
                    const dur = audioRef.current.duration;
                    if (dur && !isNaN(dur)) {
                        audioRef.current.currentTime = Math.min(dur, audioRef.current.currentTime + (offset || 5));
                    } else {
                        audioRef.current.currentTime += (offset || 5);
                    }
                }
            },
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "MediaPlayPause" || e.code === "MediaPlayPause") {
                e.preventDefault();
                if (ttsStateRef.current.status === "playing") {
                    handlePauseTTS();
                } else if (ttsStateRef.current.status === "paused") {
                    handleResumeTTS();
                }
            } else if (e.key === "MediaStop" || e.code === "MediaStop") {
                e.preventDefault();
                handleStopTTS();
            } else if (e.key === "MediaTrackNext" || e.code === "MediaTrackNext") {
                e.preventDefault();
                if (audioRef.current && audioRef.current.duration) {
                    audioRef.current.currentTime = audioRef.current.duration;
                }
            } else if (e.key === "MediaTrackPrevious" || e.code === "MediaTrackPrevious") {
                e.preventDefault();
                if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            cleanupMediaSession();
            window.removeEventListener("keydown", handleKeyDown);
            clearMediaSession();
        };
    }, []);

    const fetchTTSBlob = async (text: string, voice: string, signal: AbortSignal): Promise<Blob | null> => {
        try {
            const res = await fetch(`${API_URL}/tts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    voice: voice || "af_heart",
                }),
                signal,
            });
            if (!res.ok) {
                console.warn("TTS fetch returned status:", res.status);
                return null;
            }
            return await res.blob();
        } catch (err: any) {
            if (err.name !== "AbortError") {
                console.warn("TTS fetch error:", err);
            }
            return null;
        }
    };

    const handlePlayTTS = async (msgId: string, content: string, voice?: string, fromLineIndex?: number) => {
        if (ttsStateRef.current.msgId === msgId && ttsStateRef.current.status === "paused") {
            handleResumeTTS();
            return;
        }

        handleStopTTS();

        const rawLines = content.split("\n");
        const validLines: { origIndex: number; cleanText: string }[] = [];

        rawLines.forEach((lineText, origIndex) => {
            if (fromLineIndex !== undefined && origIndex < fromLineIndex) return;
            const trimmed = lineText.trim();
            if (!trimmed) return;

            const cleanText = trimmed
                .replace(/```[\s\S]*?```/g, "")
                .replace(/`([^`]+)`/g, "$1")
                .replace(/\*\*([^*]+)\*\*/g, "$1")
                .replace(/\*([^*]+)\*/g, "$1")
                .replace(/^#+\s*/gm, "")
                .replace(/^>\s*/gm, "")
                .replace(/^[-*+]\s+/gm, "")
                .replace(/^\d+\.\s+/gm, "")
                .replace(/\|/g, " ")
                .trim();

            if (cleanText) {
                validLines.push({ origIndex, cleanText });
            }
        });

        if (validLines.length === 0) return;

        const targetMsg = messages.find((m) => m.id === msgId);
        const activeChatObj = chatItems.find((c) => c.id === activeChatId) || activeChat;
        const speakerName = targetMsg?.senderName || "AI Assistant";
        const speakerAvatar = targetMsg?.senderAvatar || activeChatObj?.avatarImg || "";
        const chatTitle = activeChatObj?.name || "Walpaca Chat";

        const controller = new AbortController();
        abortControllerRef.current = controller;

        updateTTSState({ msgId, status: "playing", lineIndex: validLines[0].origIndex });

        // Pipeline background audio fetches back-to-back immediately for all valid lines
        const audioBlobPromises: Promise<Blob | null>[] = validLines.map((item) => fetchTTSBlob(item.cleanText, voice || "af_heart", controller.signal));

        // Stream playback through pre-fetched audio blobs
        for (let i = 0; i < validLines.length; i++) {
            if (ttsStateRef.current.msgId !== msgId || (ttsStateRef.current.status as string) === "stopped") {
                break;
            }

            const currentItem = validLines[i];
            updateTTSState({ msgId, status: "playing", lineIndex: currentItem.origIndex });

            const blob = await audioBlobPromises[i];
            if (!blob || ttsStateRef.current.msgId !== msgId || (ttsStateRef.current.status as string) === "stopped") {
                continue;
            }

            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            const defaultOutput = useAppStore.getState().appPreferences?.default_audio_output;
            await applyAudioOutputDevice(audio, defaultOutput);

            updateMediaSessionMetadata({
                title: currentItem.cleanText.length > 80 ? currentItem.cleanText.slice(0, 77) + "..." : currentItem.cleanText,
                artist: speakerName,
                album: chatTitle,
                artworkSrc: speakerAvatar,
            });
            setMediaSessionPlaybackState("playing");

            await new Promise<void>((resolve) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                audio.onerror = (e) => {
                    console.warn("Audio playback error:", e);
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };

                const checkAndPlay = () => {
                    const st = ttsStateRef.current.status;
                    if (st === "paused") {
                        setMediaSessionPlaybackState("paused");
                        const interval = setInterval(() => {
                            const currentSt = ttsStateRef.current.status;
                            if (currentSt === "playing" || (currentSt as string) === "stopped") {
                                clearInterval(interval);
                                if (currentSt === "playing") {
                                    setMediaSessionPlaybackState("playing");
                                    audio.play().catch(resolve);
                                } else {
                                    resolve();
                                }
                            }
                        }, 100);
                    } else if (st === "stopped" || ttsStateRef.current.msgId !== msgId) {
                        resolve();
                    } else {
                        setMediaSessionPlaybackState("playing");
                        audio.play().catch((err) => {
                            console.warn("audio.play() error:", err);
                            resolve();
                        });
                    }
                };

                checkAndPlay();
            });
        }

        if (ttsStateRef.current.msgId === msgId) {
            updateTTSState({ msgId: null, status: "stopped", lineIndex: -1 });
            clearMediaSession();
        }
    };

    const handlePlayTTSLine = async (msgId: string, lineText: string, origIndex: number, voice?: string) => {
        handleStopTTS();

        const trimmed = lineText.trim();
        if (!trimmed) return;

        const cleanText = trimmed
            .replace(/```[\s\S]*?```/g, "")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1")
            .replace(/^#+\s*/gm, "")
            .replace(/^>\s*/gm, "")
            .replace(/^[-*+]\s+/gm, "")
            .replace(/^\d+\.\s+/gm, "")
            .replace(/\|/g, " ")
            .trim();

        if (!cleanText) return;

        const targetMsg = messages.find((m) => m.id === msgId);
        const activeChatObj = chatItems.find((c) => c.id === activeChatId) || activeChat;
        const speakerName = targetMsg?.senderName || "AI Assistant";
        const speakerAvatar = targetMsg?.senderAvatar || activeChatObj?.avatarImg || "";
        const chatTitle = activeChatObj?.name || "Walpaca Chat";

        const controller = new AbortController();
        abortControllerRef.current = controller;

        updateTTSState({ msgId, status: "playing", lineIndex: origIndex });

        const blob = await fetchTTSBlob(cleanText, voice || "af_heart", controller.signal);
        if (!blob || ttsStateRef.current.msgId !== msgId || (ttsStateRef.current.status as string) === "stopped") {
            updateTTSState({ msgId: null, status: "stopped", lineIndex: -1 });
            clearMediaSession();
            return;
        }

        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        const defaultOutput = useAppStore.getState().appPreferences?.default_audio_output;
        await applyAudioOutputDevice(audio, defaultOutput);

        updateMediaSessionMetadata({
            title: cleanText.length > 80 ? cleanText.slice(0, 77) + "..." : cleanText,
            artist: speakerName,
            album: chatTitle,
            artworkSrc: speakerAvatar,
        });
        setMediaSessionPlaybackState("playing");

        await new Promise<void>((resolve) => {
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                resolve();
            };
            audio.onerror = (e) => {
                console.warn("Audio playback error:", e);
                URL.revokeObjectURL(audioUrl);
                resolve();
            };
            audio.play().catch((err) => {
                console.warn("audio.play() error:", err);
                resolve();
            });
        });

        if (ttsStateRef.current.msgId === msgId) {
            updateTTSState({ msgId: null, status: "stopped", lineIndex: -1 });
            clearMediaSession();
        }
    };

    const getConversationParticipants = () => {
        const map = new Map<string, { id: string; name: string; avatar: string; role: string }>();

        map.set("user", {
            id: "user",
            name: "You",
            avatar: "",
            role: "User",
        });

        messages.forEach((msg) => {
            if (!msg.isSelf) {
                const key = (msg.senderName || "").toLowerCase();
                if (!map.has(key)) {
                    const pref = modelPreferences[key] || modelPreferences[msg.senderName || ""];
                    const avatarSrc = msg.senderAvatar || formatAvatarPicture(pref?.picture) || DEFAULT_MODEL_AVATAR;
                    const charName = isCharEnabled(pref?.character) ? getCharacterName(pref?.character) : undefined;
                    const displayName = charName || getCharacterName(pref?.character) || msg.senderName;
                    const roleLabel = isCharEnabled(pref?.character) ? "Character" : "AI Model";

                    map.set(key, {
                        id: key,
                        name: displayName,
                        avatar: avatarSrc,
                        role: roleLabel,
                    });
                }
            }
        });

        return Array.from(map.values());
    };
    const [activeChatId, setActiveChatId] = useState<string>(routeChatId || "");
    const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [inputText, setInputText] = useState<string>("");
    const [expandedSection, setExpandedSection] = useState<string>("photos");
    const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState<boolean>(false);
    const [newFolderName, setNewFolderName] = useState<string>("");

    const handleOpenRenameModal = () => {
        setIsChatContextMenuOpen(false);
        const currentChat = chatItems.find((c) => c.id === activeChatId) || activeChat;
        if (currentChat) {
            setRenameInputVal(currentChat.name);
            setIsRenameModalOpen(true);
        }
    };

    const handleOpenDeleteModal = () => {
        setIsChatContextMenuOpen(false);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmRenameChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renameInputVal.trim()) return;

        const trimmed = renameInputVal.trim();
        setIsRenameModalOpen(false);

        setChatItems((prev) => prev.map((c) => (c.id === activeChatId ? { ...c, name: trimmed } : c)));
        setActiveChat((prev) => (prev ? { ...prev, name: trimmed } : null));

        try {
            await fetch(`${API_URL}/chats/${activeChatId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });
        } catch (err) {
            console.warn("Could not rename chat on backend API:", err);
        }
    };

    const handleConfirmDeleteChat = async () => {
        setIsDeleteModalOpen(false);
        const deletedId = activeChatId;
        const remaining = chatItems.filter((c) => c.id !== deletedId);

        setChatItems(remaining);
        setActiveChatId(remaining.length > 0 ? remaining[0].id : "");
        setActiveChat(remaining.length > 0 ? remaining[0] : null);

        try {
            await fetch(`${API_URL}/chats/${deletedId}`, {
                method: "DELETE",
            });
        } catch (err) {
            console.warn("Could not delete chat on backend API:", err);
        }
    };

    const handleOpenExportModal = () => {
        setIsChatContextMenuOpen(false);
        setIsExportModalOpen(true);
    };

    const handleExportChat = () => {
        if (!messages || messages.length === 0) {
            alert("No messages to export.");
            return;
        }

        const currentChat = chatItems.find((c) => c.id === activeChatId) || activeChat;
        const chatTitle = currentChat?.name || "Chat";
        const safeTitle = chatTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
        let fileContent = "";
        let mimeType = "text/plain";
        let fileExt = "txt";

        if (exportFormat === "json") {
            mimeType = "application/json";
            fileExt = "json";
            const exportData = {
                title: chatTitle,
                exported_at: new Date().toISOString(),
                messages: messages.map((m) => ({
                    id: m.id,
                    senderName: m.senderName,
                    role: m.isSelf ? "user" : m.senderRole || "assistant",
                    model: m.model,
                    content: m.content,
                    time: m.time,
                    image: m.image,
                    attachments: m.attachments,
                })),
            };
            fileContent = JSON.stringify(exportData, null, 2);
        } else if (exportFormat === "txt") {
            mimeType = "text/plain";
            fileExt = "txt";
            const lines: string[] = [`=== ${chatTitle} ===\n`];
            messages.forEach((m) => {
                const sender = m.isSelf ? "You" : m.senderName || "Assistant";
                lines.push(`[${m.time || ""}] ${sender}:`);
                lines.push(m.content);
                if (m.attachments && m.attachments.length > 0) {
                    m.attachments.forEach((att) => {
                        if (att.type !== "thought" && att.type !== "metadata") {
                            lines.push(`  [Attachment: ${att.name || att.type}]`);
                        }
                    });
                }
                lines.push("----------------------------------------");
            });
            lines.push("Generated from AlpacaWeb");
            fileContent = lines.join("\n");
        } else {
            // Standard MD or Obsidian MD
            mimeType = "text/markdown";
            fileExt = "md";
            const isObsidian = exportFormat === "obsidian";
            const mdLines: string[] = [`# ${chatTitle}\n`];

            messages.forEach((m) => {
                const sender = m.isSelf ? "User" : m.senderName || "Assistant";
                const timeStr = m.time || "";
                mdLines.push(`### **${sender}** | ${timeStr}`);
                mdLines.push(m.content);

                if (m.image) {
                    mdLines.push(`![🖼️ Image](${m.image})`);
                }

                if (m.attachments && m.attachments.length > 0) {
                    m.attachments.forEach((att) => {
                        if (att.type === "thought" || att.type === "metadata") return;
                        const attName = att.name || "Attachment";
                        const attContent = att.content || "";
                        if (isObsidian) {
                            let block = `> [!quote]- ${attName}\n`;
                            attContent.split("\n").forEach((l) => {
                                block += `> ${l}\n`;
                            });
                            mdLines.push(block);
                        } else {
                            mdLines.push(`<details>\n\n<summary>📄 ${attName}</summary>\n\n\`\`\`\n${attContent}\n\`\`\`\n\n</details>`);
                        }
                    });
                }
                mdLines.push("----");
            });
            mdLines.push("Generated from [Walpaca](https://github.com/c42759/walpaca)");
            fileContent = mdLines.join("\n\n");
        }

        const blob = new Blob([fileContent], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${safeTitle}_Export.${fileExt}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setIsExportModalOpen(false);
    };

    const getConversationAttachments = () => {
        const photos: string[] = [];
        const otherFiles: MessageAttachment[] = [];

        messages.forEach((msg) => {
            if (msg.image && !photos.includes(msg.image)) {
                photos.push(msg.image);
            }
            if (msg.attachments && Array.isArray(msg.attachments)) {
                msg.attachments.forEach((att) => {
                    const typeLower = (att.type || "").toLowerCase();
                    if (typeLower === "thought" || typeLower === "brain" || typeLower === "metadata" || typeLower === "data") {
                        return; // Ignore/hide thoughts and metadata from Attachments widget
                    }
                    if (isImageAttachment(att)) {
                        const src = getImageSrc(att);
                        if (src && !photos.includes(src)) {
                            photos.push(src);
                        }
                    } else {
                        otherFiles.push(att);
                    }
                });
            }
        });

        return { photos, otherFiles };
    };

    const [chatItems, setChatItems] = useState<ChatItem[]>(initialMockChatList);
    const [messages, setMessages] = useState<Message[]>([]);

    // --- In-Chat Search State & Match Navigation ---
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
    const [chatSearchQuery, setChatSearchQuery] = useState<string>("");
    const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);

    // Compute matching message IDs in current chat
    const matchingMessageIds = useMemo(() => {
        const q = chatSearchQuery.trim().toLowerCase();
        if (!q) return [];
        return messages
            .filter((m) => (m.content || "").toLowerCase().includes(q))
            .map((m) => m.id);
    }, [chatSearchQuery, messages]);

    // Update active match index when matching list changes
    useEffect(() => {
        if (matchingMessageIds.length > 0) {
            setActiveMatchIndex(matchingMessageIds.length - 1);
        } else {
            setActiveMatchIndex(0);
        }
    }, [matchingMessageIds.length]);

    // Reset search when active chat changes
    useEffect(() => {
        setIsSearchOpen(false);
        setChatSearchQuery("");
        setActiveMatchIndex(0);
    }, [activeChatId]);

    // Scroll to active matching message smoothly
    useEffect(() => {
        if (!isSearchOpen || matchingMessageIds.length === 0) return;
        const targetId = matchingMessageIds[activeMatchIndex];
        if (!targetId) return;
        const el = document.getElementById(`chat-message-${targetId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [activeMatchIndex, matchingMessageIds, isSearchOpen]);

    const handleToggleSearch = () => {
        setIsSearchOpen((prev) => {
            if (prev) {
                setChatSearchQuery("");
                return false;
            }
            return true;
        });
    };

    const handleNextMatch = () => {
        if (matchingMessageIds.length === 0) return;
        setActiveMatchIndex((prev) => (prev + 1) % matchingMessageIds.length);
    };

    const handlePrevMatch = () => {
        if (matchingMessageIds.length === 0) return;
        setActiveMatchIndex((prev) => (prev - 1 + matchingMessageIds.length) % matchingMessageIds.length);
    };

    const API_URL = getApiUrl();

    const fetchChats = async (folderId?: string) => {
        try {
            let url = `${API_URL}/chats`;
            if (folderId && folderId !== "all") {
                url += `?folder=${encodeURIComponent(folderId)}`;
            }
            const res = await fetch(url);
            if (res.ok) {
                const data: BackendChat[] = await res.json();
                if (Array.isArray(data)) {
                    const mapped = data.map(mapBackendChatToChatItem);
                    setChatItems(mapped);
                    return;
                }
            }
        } catch (err) {
            console.warn("Could not fetch chats from backend API, using current list:", err);
        }
    };

    const fetchChatMessages = async (chatId: string) => {
        try {
            const res = await fetch(`${API_URL}/chats/${chatId}`);
            if (res.ok) {
                const data: BackendChat = await res.json();
                const mapped = mapBackendChatToChatItem(data);
                setActiveChat(mapped);
                const rawMsgs = Array.isArray(data.messages) ? data.messages : [];
                setMessages(rawMsgs.map((m) => mapBackendMsgToMessage(m, modelPreferences)));

                // Direct chat load: seed model & instance from last assistant response
                const lastAssistant = [...rawMsgs].reverse().find((m) => m.role === "assistant" || (m.model && m.role !== "user"));
                if (lastAssistant) {
                    if (lastAssistant.model) {
                        setSelectedChatModelId(lastAssistant.model);
                    }
                    if (lastAssistant.instance_id) {
                        setSelectedChatInstanceId(lastAssistant.instance_id);
                        fetchModelsForInstance(lastAssistant.instance_id);
                        fetchInstanceModels(lastAssistant.instance_id);
                    }
                }
            } else {
                setMessages([]);
            }
        } catch (err) {
            console.warn("Could not fetch chat messages from backend API:", err);
            setMessages([]);
        }
    };

    useEffect(() => {
        fetchFolders();
        fetchModelPreferences();
        fetchInstances();
        fetchAppPreferences();
    }, []);

    useEffect(() => {
        fetchChats(activeTab);
    }, [activeTab]);

    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname.replace(/^\//, "");
            if (path && path !== "settings") {
                setActiveChatId(path);
            }
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    useEffect(() => {
        if (routeChatId) {
            setActiveChatId(routeChatId);
        }
    }, [routeChatId]);

    useEffect(() => {
        if (activeChatId) {
            fetchChatMessages(activeChatId);
        } else {
            setActiveChat(null);
            setMessages([]);
        }
    }, [activeChatId]);

    useEffect(() => {
        if (activeChatId) {
            const prefs = useAppStore.getState().appPreferences;
            if (isGeneratingRef.current && !prefs?.auto_scroll) {
                return;
            }
            messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }
    }, [messages, activeChatId]);

    // Auto-poll assistant message when ending with **processing** (background generation active)
    useEffect(() => {
        if (!activeChatId) return;

        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        const isProcessing = Boolean(
            lastMsg &&
            !lastMsg.isSelf &&
            (lastMsg.senderRole === "assistant" || !lastMsg.senderRole || lastMsg.senderRole !== "user") &&
            (lastMsg.content?.trim().endsWith("**processing**") || lastMsg.content?.trim().endsWith("**LLM still processing.**"))
        );

        if (!isProcessing || isGeneratingRef.current) {
            return;
        }

        let isMounted = true;
        let timerId: NodeJS.Timeout | null = null;

        const pollIntervalSec = appPreferences?.processing_poll_interval !== undefined
            ? Math.max(1, Number(appPreferences.processing_poll_interval))
            : 2;

        const pollMessages = async () => {
            try {
                const res = await fetch(`${API_URL}/chats/${activeChatId}`);
                if (!isMounted) return;
                if (res.ok) {
                    const data: BackendChat = await res.json();
                    const rawMsgs = Array.isArray(data.messages) ? data.messages : [];
                    const updatedMessages = rawMsgs.map((m) => mapBackendMsgToMessage(m, modelPreferences));
                    setMessages(updatedMessages);

                    const newLastMsg = updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : null;
                    const stillProcessing = Boolean(
                        newLastMsg &&
                        !newLastMsg.isSelf &&
                        (newLastMsg.senderRole === "assistant" || !newLastMsg.senderRole || newLastMsg.senderRole !== "user") &&
                        (newLastMsg.content?.trim().endsWith("**processing**") || newLastMsg.content?.trim().endsWith("**LLM still processing.**"))
                    );

                    if (stillProcessing && isMounted) {
                        timerId = setTimeout(pollMessages, pollIntervalSec * 1000);
                    }
                }
            } catch (err) {
                console.warn("Error polling processing message:", err);
                if (isMounted) {
                    timerId = setTimeout(pollMessages, pollIntervalSec * 1000);
                }
            }
        };

        timerId = setTimeout(pollMessages, pollIntervalSec * 1000);

        return () => {
            isMounted = false;
            if (timerId) clearTimeout(timerId);
        };
    }, [activeChatId, messages, appPreferences?.processing_poll_interval, modelPreferences]);


    // Requirement 1: Auto-select Instance if only 1 exists or unselected
    useEffect(() => {
        if (instances.length > 0) {
            const activeInst = instances.find((i) => i.is_enabled) || instances[0];
            const targetId = activeInst.id;
            if (instances.length === 1 || !selectedChatInstanceId || !instances.some((inst) => inst.id === selectedChatInstanceId)) {
                setSelectedChatInstanceId(targetId);
                fetchModelsForInstance(targetId);
            }
        }
    }, [instances]);

    // Ensure active instance models are loaded whenever modal opens
    useEffect(() => {
        if (isSelectModelModalOpen) {
            const initialInstId = (selectedChatInstanceId && instances.some((i) => i.id === selectedChatInstanceId))
                ? selectedChatInstanceId
                : (instances.find((i) => i.is_enabled)?.id || instances[0]?.id || "");
            setSelectedModalInstanceId(initialInstId);
            if (initialInstId) {
                fetchModelsForInstance(initialInstId);
                fetchInstanceModels(initialInstId);
            }
        }
    }, [isSelectModelModalOpen, selectedChatInstanceId, instances]);

    // Requirement 2: Auto-select Model/Preference if only 1 exists or unselected
    useEffect(() => {
        const hasAssistantMsg = messages.some((m) => !m.isSelf && (m.senderRole === "assistant" || m.model));
        if (hasAssistantMsg) return;

        const prefs = Array.from(new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values());
        const options = [...prefs.map((p) => p.id), ...instanceModelsList.map((m) => m.id)];
        if (options.length === 1 || (!selectedChatModelId && options.length > 0)) {
            setSelectedChatModelId(options[0]);
        }
    }, [instanceModelsList, modelPreferences, selectedChatInstanceId, messages, selectedChatModelId]);

    // Requirement 3: Auto-select Instance & Model based on last assistant message in active chat
    useEffect(() => {
        if (!messages || messages.length === 0) return;

        const lastAssistantMsg = [...messages].reverse().find((m) => !m.isSelf && (m.senderRole === "assistant" || m.senderName !== "You" || m.model));

        if (lastAssistantMsg) {
            const targetModelIdentifier = String(lastAssistantMsg.model || lastAssistantMsg.senderName || "").trim();
            if (targetModelIdentifier) {
                const prefsList = Array.from(new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values());
                const matchingPref = prefsList.find(
                    (p) =>
                        p.id.toLowerCase() === targetModelIdentifier.toLowerCase() ||
                        (p.model_name && p.model_name.toLowerCase() === targetModelIdentifier.toLowerCase()) ||
                        (p.model_id && p.model_id.toLowerCase() === targetModelIdentifier.toLowerCase()) ||
                        (getCharacterName(p.character) && getCharacterName(p.character)?.toLowerCase() === targetModelIdentifier.toLowerCase()),
                );

                if (matchingPref) {
                    setSelectedChatModelId(matchingPref.id);
                    if (matchingPref.instance_id && (!lastAssistantMsg.instanceId || !instances.some((inst) => inst.id === lastAssistantMsg.instanceId))) {
                        setSelectedChatInstanceId(matchingPref.instance_id);
                        fetchModelsForInstance(matchingPref.instance_id);
                        fetchInstanceModels(matchingPref.instance_id);
                    }
                } else {
                    const matchingMod = instanceModelsList.find(
                        (m) =>
                            String(m.id || "").toLowerCase() === targetModelIdentifier.toLowerCase() || String(m.name || "").toLowerCase() === targetModelIdentifier.toLowerCase(),
                    );
                    if (matchingMod) {
                        setSelectedChatModelId(matchingMod.id);
                    } else {
                        setSelectedChatModelId(targetModelIdentifier);
                    }
                }

                if (lastAssistantMsg.instanceId) {
                    const matchingInst = instances.find((inst) => inst.id === lastAssistantMsg.instanceId);
                    if (matchingInst) {
                        setSelectedChatInstanceId(matchingInst.id);
                        fetchModelsForInstance(matchingInst.id);
                        fetchInstanceModels(matchingInst.id);
                    }
                }
            }
        }
    }, [messages, activeChatId, modelPreferences, instanceModelsList, instances]);

    const handleCreateFolderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        const name = newFolderName.trim();
        try {
            const res = await fetch(`${API_URL}/folders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                const created: ChatFolder = await res.json();
                setFolders((prev) => [...prev, created]);
                setActiveTab(created.id);
            } else {
                const localFolder: ChatFolder = { id: `folder-${Date.now()}`, name };
                setFolders((prev) => [...prev, localFolder]);
                setActiveTab(localFolder.id);
            }
        } catch (err) {
            const localFolder: ChatFolder = { id: `folder-${Date.now()}`, name };
            setFolders((prev) => [...prev, localFolder]);
            setActiveTab(localFolder.id);
        }

        setNewFolderName("");
        setIsCreatingFolder(false);
    };

    const handleOpenNewChatModal = () => {
        setNewChatTitleInput("New Chat");
        setIsNewChatModalOpen(true);
    };

    const handleConfirmCreateNewChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newChatTitleInput.trim()) return;

        const chatName = newChatTitleInput.trim();
        setIsNewChatModalOpen(false);

        try {
            const res = await fetch(`${API_URL}/chats`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: chatName,
                    folder: activeTab !== "none" && activeTab !== "all" ? activeTab : null,
                }),
            });
            if (res.ok) {
                const created: BackendChat = await res.json();
                const mapped = mapBackendChatToChatItem(created);
                setChatItems((prev) => [mapped, ...prev]);
                setActiveChatId(created.id);
                setActiveChat(mapped);
                if (typeof window !== "undefined") {
                    window.history.pushState(null, "", `/${created.id}`);
                }
            } else {
                const localChat: ChatItem = {
                    id: `chat-${Date.now()}`,
                    name: chatName,
                    avatarText: chatName.slice(0, 2).toUpperCase(),
                    lastMessage: "New chat started",
                    time: "now",
                };
                setChatItems((prev) => [localChat, ...prev]);
                setActiveChatId(localChat.id);
                setActiveChat(localChat);
                if (typeof window !== "undefined") {
                    window.history.pushState(null, "", `/${localChat.id}`);
                }
            }
        } catch (err) {
            const localChat: ChatItem = {
                id: `chat-${Date.now()}`,
                name: chatName,
                avatarText: chatName.slice(0, 2).toUpperCase(),
                lastMessage: "New chat started",
                time: "now",
            };
            setChatItems((prev) => [localChat, ...prev]);
            setActiveChatId(localChat.id);
            setActiveChat(localChat);
            if (typeof window !== "undefined") {
                window.history.pushState(null, "", `/${localChat.id}`);
            }
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() && selectedAttachments.length === 0) return;

        const content = inputText.trim();
        const currentAttachments = [...selectedAttachments];
        setInputText("");
        setSelectedAttachments([]);

        if (promptTextareaRef.current) {
            promptTextareaRef.current.style.height = "auto";
            promptTextareaRef.current.style.overflowY = "hidden";
        }

        const attachmentsPayload: MessageAttachment[] = currentAttachments.map((att, idx) => ({
            id: att.id || `att-${Date.now()}-${idx}`,
            type: att.type,
            name: att.name,
            content: att.content,
        }));

        const firstImage = currentAttachments.find((a) => a.type === "image")?.content;

        const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        const userMsg: Message = {
            id: `msg-${Date.now()}`,
            senderName: "You",
            senderAvatar: "",
            isSelf: true,
            content,
            time: nowStr,
            image: firstImage,
            attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
        };

        setMessages((prev) => [...prev, userMsg]);

        // Save user message to backend
        if (activeChatId) {
            try {
                await fetch(`${API_URL}/chats/${activeChatId}/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role: "user",
                        content,
                        model: selectedChatModelId,
                        instance_id: selectedChatInstanceId,
                        attachments: attachmentsPayload,
                    }),
                });
            } catch (err) {
                console.warn("Could not post user message to backend API:", err);
            }
        }

        await handleCallForAnswer();
    };

    const handleCallForAnswer = async () => {
        // Determine Assistant Metadata & System Prompt
        const selectedPrefKey = (selectedChatModelId || "").toLowerCase();
        const selectedPref =
            modelPreferences[selectedChatModelId] || modelPreferences[selectedPrefKey] || Object.values(modelPreferences).find((p) => p.id.toLowerCase() === selectedPrefKey);

        let assistantName = "Assistant";
        let assistantAvatar = DEFAULT_MODEL_AVATAR;
        let systemPrompt = "";

        if (selectedPref) {
            const char = selectedPref.character || {};
            const charData = char.data || char || {};
            assistantName = getCharacterName(char) || (selectedPref as any).name || selectedPref.id;
            if (selectedPref.picture) {
                assistantAvatar = formatAvatarPicture(selectedPref.picture) || assistantAvatar;
            }
            systemPrompt = charData.system_prompt || charData.personality || charData.description || selectedPref.description || "";
        } else if (selectedChatModelId) {
            const instMod = instanceModelsList.find((m) => m.id === selectedChatModelId);
            if (instMod) {
                assistantName = instMod.name || instMod.id;
            } else {
                assistantName = selectedChatModelId;
            }
        }

        const assistantMsgId = `msg-${Date.now()}`;
        const assistantMsg: Message = {
            id: assistantMsgId,
            senderName: assistantName,
            senderAvatar: assistantAvatar,
            senderRole: "assistant",
            model: selectedChatModelId,
            instanceId: selectedChatInstanceId,
            isSelf: false,
            content: "",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        let fullResponseText = "";
        let currentAssistantMsgId = assistantMsgId;
        const genUrl = activeChatId ? `${API_URL}/chats/${activeChatId}/generate` : `${API_URL}/generate`;

        isGeneratingRef.current = true;
        try {
            const genRes = await fetch(genUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: selectedChatModelId,
                    instance_id: selectedChatInstanceId,
                    think: isThinkingEnabled,
                }),
            });

            if (genRes.ok && genRes.body) {
                const reader = genRes.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith("data: ")) continue;
                        const dataStr = trimmed.slice(6).trim();
                        if (dataStr === "[DONE]") continue;

                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.error) {
                                const errText = parsed.error;
                                fullResponseText = errText;
                                setMessages((prev) => prev.map((m) => (m.id === assistantMsgId || m.id === parsed.id ? { ...m, content: errText } : m)));
                            }
                            if (parsed.id) {
                                const serverId = parsed.id;
                                currentAssistantMsgId = serverId;
                                setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, id: serverId } : m)));
                            }
                            if (parsed.thinking) {
                                const thinkChunk = parsed.thinking;
                                setMessages((prev) =>
                                    prev.map((m) => {
                                        if (m.id === assistantMsgId || m.id === parsed.id) {
                                            const existingAtts = m.attachments || [];
                                            const thoughtIdx = existingAtts.findIndex((a) => a.type?.toLowerCase() === "thought" || a.type?.toLowerCase() === "brain");
                                            let updatedAtts = [...existingAtts];
                                            if (thoughtIdx >= 0) {
                                                updatedAtts[thoughtIdx] = {
                                                    ...updatedAtts[thoughtIdx],
                                                    content: updatedAtts[thoughtIdx].content + thinkChunk,
                                                };
                                            } else {
                                                updatedAtts.push({
                                                    id: `thought-${Date.now()}`,
                                                    type: "thought",
                                                    name: "Thought",
                                                    content: thinkChunk,
                                                });
                                            }
                                            return { ...m, attachments: updatedAtts };
                                        }
                                        return m;
                                    }),
                                );
                            }
                            if (parsed.metadata) {
                                const metaContent = parsed.metadata;
                                setMessages((prev) =>
                                    prev.map((m) => {
                                        if (m.id === assistantMsgId || m.id === parsed.id) {
                                            const existingAtts = m.attachments || [];
                                            const metaIdx = existingAtts.findIndex((a) => a.type?.toLowerCase() === "metadata" || a.type?.toLowerCase() === "data");
                                            let updatedAtts = [...existingAtts];
                                            if (metaIdx >= 0) {
                                                updatedAtts[metaIdx] = {
                                                    ...updatedAtts[metaIdx],
                                                    content: metaContent,
                                                };
                                            } else {
                                                updatedAtts.push({
                                                    id: `meta-${Date.now()}`,
                                                    type: "metadata",
                                                    name: "Metadata",
                                                    content: metaContent,
                                                });
                                            }
                                            return { ...m, attachments: updatedAtts };
                                        }
                                        return m;
                                    }),
                                );
                            }
                            if (parsed.content) {
                                fullResponseText += parsed.content;
                                setMessages((prev) => prev.map((m) => (m.id === assistantMsgId || m.id === parsed.id ? { ...m, content: m.content + parsed.content } : m)));
                            }
                        } catch {
                            if (dataStr && !dataStr.startsWith("{")) {
                                fullResponseText += dataStr;
                                setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + dataStr } : m)));
                            }
                        }
                    }
                }
                const currentPrefs = useAppStore.getState().appPreferences;

                if (currentPrefs?.play_sound_notification !== false) {
                    playNotificationSound();
                }

                if (currentPrefs?.desktop_notifications && typeof window !== "undefined" && "Notification" in window) {
                    const isWindowUnfocused = typeof document !== "undefined" && (document.hidden || !document.hasFocus());
                    if (isWindowUnfocused) {
                        const fireDesktopNotification = () => {
                            try {
                                const prefKey = (selectedChatModelId || "").toLowerCase();
                                const modelPref =
                                    modelPreferences[selectedChatModelId || ""] ||
                                    modelPreferences[prefKey] ||
                                    Object.values(modelPreferences).find((p) => p.id?.toLowerCase() === prefKey);
                                const assistantTitle = modelPref?.name || selectedChatModelId || "Walpaca Assistant";
                                const snippet = fullResponseText.trim().replace(/\s+/g, " ").slice(0, 140);
                                const avatarIcon = getModelAvatarPicture(modelPref);
                                const n = new Notification(assistantTitle, {
                                    body: snippet || "Finished delivering response.",
                                    icon: avatarIcon,
                                });
                                n.onclick = () => {
                                    window.focus();
                                    n.close();
                                };
                            } catch (e) {
                                console.warn("Desktop notification error:", e);
                            }
                        };

                        if (Notification.permission === "granted") {
                            fireDesktopNotification();
                        } else if (Notification.permission === "default") {
                            Notification.requestPermission().then((perm) => {
                                if (perm === "granted") {
                                    fireDesktopNotification();
                                }
                            });
                        }
                    }
                }

                if (currentPrefs?.auto_scroll) {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                }

                if (currentPrefs?.auto_play_voice && fullResponseText.trim()) {
                    const prefKey = (selectedChatModelId || "").toLowerCase();
                    const modelPref =
                        modelPreferences[selectedChatModelId || ""] || modelPreferences[prefKey] || Object.values(modelPreferences).find((p) => p.id?.toLowerCase() === prefKey);
                    const currentVoice = modelPref?.voice || "af_heart";
                    handlePlayTTS(currentAssistantMsgId, fullResponseText, currentVoice);
                }
            }
        } catch (err) {
            console.warn("Error during LLM response generation:", err);
        } finally {
            isGeneratingRef.current = false;
        }
    };

    const handleUseCharacterFirstMes = async () => {
        if (!activeChatId || !selectedChatModelId) return;
        const prefKey = selectedChatModelId.toLowerCase();
        const pref = modelPreferences[selectedChatModelId] || modelPreferences[prefKey] || Object.values(modelPreferences).find((p) => p.id.toLowerCase() === prefKey);

        if (!pref) return;
        const char = pref.character || {};
        const charData = char.data || char || {};
        const firstMes = (charData.first_mes || charData.first_message || pref.first_message || "").trim();

        if (!firstMes) return;

        const charName = getCharacterName(char) || (pref as any).name || pref.id;
        const avatarSrc = formatAvatarPicture(pref.picture);
        const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

        const newMsg: Message = {
            id: `msg-${Date.now()}`,
            senderName: charName,
            senderAvatar: avatarSrc,
            senderRole: "assistant",
            model: selectedChatModelId,
            instanceId: selectedChatInstanceId,
            isSelf: false,
            content: firstMes,
            time: nowStr,
        };

        setMessages((prev) => [...prev, newMsg]);

        try {
            await fetch(`${API_URL}/chats/${activeChatId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role: "assistant",
                    content: firstMes,
                    model: selectedChatModelId,
                    instance_id: selectedChatInstanceId,
                }),
            });
        } catch (err) {
            console.warn("Could not post character first message to backend API:", err);
        }
    };

    const handleOpenPersonaDetails = useCallback(
        (target: Message | string | any, explicitPref?: any) => {
            let modelId = "";
            let instanceId = "";
            let senderName = "";
            let avatarSrc = "";

            if (typeof target === "string") {
                senderName = target;
                modelId = target;
            } else if (target && typeof target === "object") {
                senderName = target.senderName || target.name || "";
                modelId = target.model || target.modelId || target.id || "";
                instanceId = target.instanceId || "";
                avatarSrc = target.senderAvatar || target.avatar || "";
            }

            const senderKey = (senderName || "").toLowerCase();
            const modelKey = (modelId || "").toLowerCase();
            const chatModelKey = (selectedChatModelId || "").toLowerCase();

            // Find matching preference
            const pref: ModelPreference | any =
                explicitPref ||
                (modelKey ? modelPreferences[modelId] || modelPreferences[modelKey] : undefined) ||
                (senderKey ? modelPreferences[senderName] || modelPreferences[senderKey] : undefined) ||
                (chatModelKey ? modelPreferences[selectedChatModelId] || modelPreferences[chatModelKey] : undefined) ||
                Object.values(modelPreferences).find((p) => {
                    const pId = (p.id || "").toLowerCase();
                    const pName = (p.name || "").toLowerCase();
                    const cName = (getCharacterName(p.character) || "").toLowerCase();
                    return (
                        (modelKey && (pId === modelKey || pName === modelKey)) ||
                        (senderKey && (cName === senderKey || pName === senderKey || pId === senderKey))
                    );
                });

            // Resolve the actual underlying AI model name being used (not the preference/persona name)
            let actualModelName =
                pref?.model_name ||
                pref?.model_id ||
                (pref as any)?.model ||
                "";

            if (!actualModelName) {
                const candidates = [modelId, (target as any)?.model, selectedChatModelId].filter(Boolean);
                for (const cand of candidates) {
                    const found = instanceModelsList.find(
                        (m) => m.id?.toLowerCase() === cand.toLowerCase() || m.name?.toLowerCase() === cand.toLowerCase()
                    );
                    if (found) {
                        actualModelName = found.name || found.id;
                        break;
                    }
                    for (const instKey of Object.keys(instanceModelsMap)) {
                        const instList = instanceModelsMap[instKey] || [];
                        const foundInMap = instList.find(
                            (m) => m.id?.toLowerCase() === cand.toLowerCase() || m.name?.toLowerCase() === cand.toLowerCase()
                        );
                        if (foundInMap) {
                            actualModelName = foundInMap.name || foundInMap.id;
                            break;
                        }
                    }
                    if (actualModelName) break;
                }
            }

            // Find matching instance
            const effectiveInstanceId = instanceId || pref?.instance_id || selectedChatInstanceId;
            const inst = instances.find((i) => i.id === effectiveInstanceId);
            const instanceName = inst?.properties?.name || inst?.type || "";

            const char = pref?.character || {};
            const charData = (char as any).data || char || {};
            const isCustom = Boolean(pref && (isCharEnabled(pref.character) || pref.picture || pref.voice || pref.description || charData.system_prompt));

            // Unified system prompt
            let unifiedSystem = charData.system_prompt || "";
            if (!unifiedSystem) {
                unifiedSystem = [charData.description || charData.personality || pref?.description, charData.scenario]
                    .filter(Boolean)
                    .join("\n\n");
            } else {
                const extraParts: string[] = [];
                const desc = charData.description || charData.personality || pref?.description;
                if (desc && desc !== unifiedSystem && !unifiedSystem.includes(desc)) {
                    extraParts.push(desc);
                }
                if (charData.scenario && !unifiedSystem.includes(charData.scenario)) {
                    extraParts.push(charData.scenario);
                }
                if (extraParts.length > 0) {
                    unifiedSystem = `${extraParts.join("\n\n")}\n\n${unifiedSystem}`;
                }
            }

            const effectiveName =
                getCharacterName(char) ||
                (pref as any)?.name ||
                senderName ||
                (modelId ? (instanceModelsList.find((m) => m.id === modelId)?.name || modelId) : "AI Assistant");

            const effectiveAvatar =
                formatAvatarPicture(pref?.picture) ||
                avatarSrc ||
                DEFAULT_MODEL_AVATAR;

            const modalPayload: PersonaDetailsData = {
                name: effectiveName,
                avatar: effectiveAvatar,
                modelName: actualModelName || undefined,
                modelId: actualModelName || modelId || pref?.model_name || pref?.id || selectedChatModelId || undefined,
                preferenceName: pref?.name || (pref?.id !== actualModelName ? pref?.id : undefined),
                instanceName: instanceName || undefined,
                voice: pref?.voice || charData.voice || "af_heart",
                numCtx: pref?.num_ctx || charData.num_ctx || (inst?.properties as any)?.num_ctx || 4096,
                systemPrompt: unifiedSystem,
                firstMes: (charData.first_mes || charData.first_message || pref?.first_message || "").trim(),
                alternateGreetings: Array.isArray(charData.alternate_greetings)
                    ? charData.alternate_greetings
                    : Array.isArray(pref?.alternate_greetings)
                    ? pref.alternate_greetings
                    : [],
                generationSettings: charData.generation_settings || pref?.generation_settings || {
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40,
                    repeat_penalty: 1.1,
                    presence_penalty: 0.0,
                    frequency_penalty: 0.0,
                },
                characterBook: charData.character_book || char.character_book || undefined,
                isCustomPersona: isCustom,
            };

            setPersonaDetailsData(modalPayload);
            setIsPersonaDetailsModalOpen(true);
        },
        [modelPreferences, selectedChatModelId, selectedChatInstanceId, instances, instanceModelsList, instanceModelsMap]
    );

    const handleGoToRoot = useCallback(() => {
        setCurrentView("chat");
        setActiveTab("all");
        setActiveChatId("");
        setMessages([]);
        if (typeof window !== "undefined") {
            window.history.pushState(null, "", "/");
        }
    }, [setCurrentView, setActiveTab, setActiveChatId, setMessages]);

    useEffect(() => {
        registerGoToRootHandler(handleGoToRoot);
        registerDropChatToFolderHandler(handleDropChatToFolder);
        return () => {
            registerGoToRootHandler(null);
            registerDropChatToFolderHandler(null);
        };
    }, [handleGoToRoot, handleDropChatToFolder]);

    const handleBackToList = useCallback(() => {
        setActiveChatId("");
        if (typeof window !== "undefined") {
            window.history.pushState(null, "", "/");
        }
    }, [setActiveChatId]);

    return (
        <>
            {/* Inner App Container with Rounded Right / Light Theme Area */}
            <div className="flex-1 flex overflow-hidden bg-[#f9fafc] rounded-none md:rounded-l-[32px] w-full h-full relative">
                {/* ========================================================= */}
                {/* 2. CHAT LIST PANEL (#f9fafc) - Master view */}
                {/* ========================================================= */}
                <div className={`h-full ${activeChatId ? "hidden md:flex shrink-0" : "flex w-full md:w-auto shrink-0"}`}>
                    <ChatListPanel
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        handleOpenNewChatModal={handleOpenNewChatModal}
                        chatItems={chatItems}
                        activeTab={activeTab}
                        activeChatId={activeChatId}
                        setActiveChatId={setActiveChatId}
                        draggedChatId={draggedChatId}
                        setDraggedChatId={setDraggedChatId}
                        setDragOverFolderTarget={setDragOverFolderTarget}
                        getAvatarColor={getAvatarColor}
                        onChatContextMenu={handleChatContextMenu}
                    />
                </div>

                {/* ========================================================= */}
                {/* 3. MAIN CHAT AREA (WHITE) - Detail view */}
                {/* ========================================================= */}
                {(() => {
                    const activeChatObj = chatItems.find((c) => c.id === activeChatId) || activeChat;
                    if (!activeChatId || !activeChatObj) {
                        return (
                            <div className="hidden md:flex flex-1 overflow-hidden">
                                <ChatEmptyState />
                            </div>
                        );
                    }

                    return (
                        <section className="flex-1 flex flex-col bg-white overflow-hidden w-full h-full">
                            {/* Header */}
                            {(() => {
                                const selectedPrefKey = (selectedChatModelId || "").toLowerCase();
                                const selectedPref =
                                    modelPreferences[selectedChatModelId] ||
                                    modelPreferences[selectedPrefKey] ||
                                    Object.values(modelPreferences).find(
                                        (p: any) =>
                                            p?.id?.toLowerCase() === selectedPrefKey ||
                                            p?.model_id?.toLowerCase() === selectedPrefKey ||
                                            p?.model_name?.toLowerCase() === selectedPrefKey ||
                                            (getCharacterName(p?.character) && getCharacterName(p?.character)?.toLowerCase() === selectedPrefKey),
                                    );
                                const selectedMod = instanceModelsList.find(
                                    (m) => m.id === selectedChatModelId || String(m.name || "").toLowerCase() === selectedPrefKey,
                                );
                                const currentModelAvatar = getModelAvatarPicture(selectedPref, selectedMod);

                                const charName = isCharEnabled(selectedPref?.character) ? getCharacterName(selectedPref?.character) : undefined;
                                const modelDisplayName =
                                    charName ||
                                    selectedPref?.name ||
                                    selectedPref?.model_name ||
                                    selectedMod?.name ||
                                    selectedChatModelId ||
                                    "Model";

                                const activeInst =
                                    instances.find((i) => i.id === selectedChatInstanceId) ||
                                    (selectedPref?.instance_id ? instances.find((i) => i.id === selectedPref.instance_id) : undefined) ||
                                    instances.find((i) => i.is_enabled) ||
                                    instances[0];
                                const instanceDisplayName =
                                    activeInst?.properties?.name ||
                                    activeInst?.type ||
                                    "Instance";

                                const headerSubtitle = `${modelDisplayName} @ ${instanceDisplayName}`;

                                return (
                                    <ChatHeader
                                        title={activeChatObj.name}
                                        subtitle={headerSubtitle}
                                        avatar={currentModelAvatar}
                                        onBack={handleBackToList}
                                        onAvatarClick={() => handleOpenPersonaDetails(selectedChatModelId)}
                                        onOpenRename={handleOpenRenameModal}
                                        onOpenDuplicate={handleOpenDuplicateModal}
                                        onOpenExport={handleOpenExportModal}
                                        onOpenDelete={handleOpenDeleteModal}
                                        onSearchClick={handleToggleSearch}
                                        isSearchOpen={isSearchOpen}
                                        searchQuery={chatSearchQuery}
                                        onSearchQueryChange={setChatSearchQuery}
                                        matchCount={matchingMessageIds.length}
                                        activeMatchIndex={activeMatchIndex}
                                        onNextMatch={handleNextMatch}
                                        onPrevMatch={handlePrevMatch}
                                    />
                                );
                            })()}

                            {/* Conversation Messages */}
                            <ChatMessageList
                                messages={messages}
                                activeSearchMsgId={isSearchOpen && matchingMessageIds.length > 0 ? matchingMessageIds[activeMatchIndex] : null}
                                selectedChatModelId={selectedChatModelId}
                                modelPreferences={modelPreferences}
                                handleUseCharacterFirstMes={handleUseCharacterFirstMes}
                                onAvatarClick={handleOpenPersonaDetails}
                                editingMsgId={editingMsgId}
                                editingMsgContent={editingMsgContent}
                                setEditingMsgContent={setEditingMsgContent}
                                setEditingMsgId={setEditingMsgId}
                                autoResizeTextarea={autoResizeTextarea}
                                handleSaveInlineEdit={handleSaveInlineEdit}
                                handleStartInlineEdit={handleStartInlineEdit}
                                handleOpenForkModal={handleOpenForkModal}
                                handleOpenDeleteMessageModal={handleOpenDeleteMessageModal}
                                setActiveImageModal={setActiveImageModal}
                                setActiveAttachmentModal={setActiveAttachmentModal}
                                setLineContextMenu={setLineContextMenu}
                                ttsState={ttsState}
                                handlePlayTTS={handlePlayTTS}
                                handlePauseTTS={handlePauseTTS}
                                handleResumeTTS={handleResumeTTS}
                                handleStopTTS={handleStopTTS}
                                renderMarkdownText={renderMarkdownText}
                                highlightCodeTokens={highlightCodeTokens}
                                handleCallForAnswer={handleCallForAnswer}
                                messagesEndRef={messagesEndRef}
                            />

                            {/* Input Composer */}
                            <ChatInput
                                inputText={inputText}
                                setInputText={setInputText}
                                handleSendMessage={handleSendMessage}
                                selectedAttachments={selectedAttachments}
                                handleAttachmentSelect={handleAttachmentSelect}
                                handleRemoveSelectedAttachment={handleRemoveSelectedAttachment}
                                isThinkingEnabled={isThinkingEnabled}
                                setIsThinkingEnabled={setIsThinkingEnabled}
                                setIsSelectModelModalOpen={setIsSelectModelModalOpen}
                                onOpenCustomPromptsModal={() => setIsCustomPromptsModalOpen(true)}
                                selectedChatInstanceId={selectedChatInstanceId}
                                selectedChatModelId={selectedChatModelId}
                                instances={instances}
                                modelPreferences={modelPreferences}
                                instanceModelsList={instanceModelsList}
                                getCharacterName={getCharacterName}
                                promptTextareaRef={promptTextareaRef}
                                autoResizeTextarea={autoResizeTextarea}
                            />
                        </section>
                    );
                })()}

                {/* ========================================================= */}
                {/* 4. RIGHT INFO DRAWER (#f9fafc) */}
                {/* ========================================================= */}
                {activeChatId && (chatItems.some((c) => c.id === activeChatId) || activeChat?.id === activeChatId) ? (() => {
                    const drawerCards = (
                        <>
                        {/* Context Card */}
                        {(() => {
                            const selectedInst = instances.find((i) => i.id === selectedChatInstanceId);
                            const selectedPrefKey = (selectedChatModelId || "").toLowerCase();
                            const selectedPref =
                                modelPreferences[selectedChatModelId] ||
                                modelPreferences[selectedPrefKey] ||
                                Object.values(modelPreferences).find((p) => p.id.toLowerCase() === selectedPrefKey);

                            const props = selectedInst?.properties as any;
                            const rawNumCtx = props?.num_ctx || props?.context_size || props?.numCtx || props?.context || selectedPref?.num_ctx || 4096;

                            const totalTokens = Number(rawNumCtx) || 4096;

                            let consumedTokens = 0;
                            const assistantMsgs = [...messages].reverse().filter((m) => !m.isSelf);

                            for (const msg of assistantMsgs) {
                                const metaAtt = msg.attachments?.find((a) => a.type?.toLowerCase() === "metadata" || a.type?.toLowerCase() === "data");
                                if (metaAtt && metaAtt.content) {
                                    const promptMatch = metaAtt.content.match(/Prompt Eval Count\s*\|\s*(\d+)/i);
                                    const evalMatch = metaAtt.content.match(/Eval Count\s*\|\s*(\d+)/i);
                                    const promptCount = promptMatch ? parseInt(promptMatch[1], 10) : 0;
                                    const evalCount = evalMatch ? parseInt(evalMatch[1], 10) : 0;
                                    const totalMsgTokens = promptCount + evalCount;
                                    if (totalMsgTokens > 0) {
                                        consumedTokens = totalMsgTokens;
                                        break;
                                    }
                                }
                            }

                            const rawPercentage = (consumedTokens / totalTokens) * 100;
                            const percentage = Math.min(Math.round(rawPercentage), 100);
                            const isOverconsumed = consumedTokens >= totalTokens;

                            let cardBg = "bg-white border-[#edf0f7] text-[#202022]";
                            let iconColor = "#7678ed";
                            let titleColor = "text-[#202022]";
                            let textColor = "text-[#5d6075] font-medium";
                            let trackBg = "bg-[#f0f2f9] border-[#e8ebf3]";
                            let barColor = "bg-emerald-500";
                            let badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";

                            if (isOverconsumed) {
                                cardBg = "bg-rose-50/90 border-rose-200 text-rose-950 shadow-sm";
                                iconColor = "#e11d48";
                                titleColor = "text-rose-900";
                                textColor = "text-rose-800 font-semibold";
                                trackBg = "bg-rose-100 border-rose-200";
                                barColor = "bg-rose-600";
                                badgeBg = "bg-rose-600 text-white border-rose-600 font-extrabold shadow-xs";
                            } else if (rawPercentage >= 90) {
                                barColor = "bg-rose-500";
                                badgeBg = "bg-rose-50 text-rose-700 border-rose-200";
                            } else if (rawPercentage >= 65) {
                                barColor = "bg-amber-500";
                                badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
                            }

                            return (
                                <>
                                    <WidgetWithCustomHeader
                                        header={
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <ServerIcon color={iconColor} />
                                                        <h3 className={`font-bold text-xl ${titleColor}`}>Context</h3>
                                                    </div>
                                                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeBg}`}>{percentage}%</span>
                                                </div>
                                            </>
                                        }
                                        content={
                                            <>
                                                <p className={`text-sm ${textColor}`}>
                                                    Consumed {consumedTokens.toLocaleString()} from {totalTokens.toLocaleString()} tokens.
                                                </p>

                                                <div className={`w-full rounded-full h-2.5 overflow-hidden p-0.5 border ${trackBg}`}>
                                                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percentage}%` }} />
                                                </div>
                                            </>
                                        }
                                    />
                                </>
                            );
                        })()}

                        {/* 1. Members Card (Middle) */}
                        {(() => {
                            const participants = getConversationParticipants();

                            {
                                /* Members List */
                            }
                            return (
                                <>
                                    <WidgetSimple
                                        title={`${participants.length} members`}
                                        content={
                                            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                                                {participants.map((p) => (
                                                    <div key={p.id} className="flex items-center gap-3">
                                                        {p.id === "user" ? (
                                                            <div className="w-10 h-10 rounded-2xl bg-[#7678ed] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                                                                <svg
                                                                    width="20"
                                                                    height="20"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2.2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                >
                                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                                    <circle cx="12" cy="7" r="4" />
                                                                </svg>
                                                            </div>
                                                        ) : (
                                                            <img
                                                                src={p.avatar}
                                                                alt={p.name}
                                                                onClick={() => handleOpenPersonaDetails(p.id)}
                                                                className="w-10 h-10 rounded-2xl object-cover shadow-xs shrink-0 cursor-pointer hover:ring-2 hover:ring-[#7678ed]/50 hover:opacity-90 active:scale-95 transition-all"
                                                                title={`View ${p.name} persona details`}
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <h5 className="font-semibold text-base text-[#202022] truncate">{p.name}</h5>
                                                            <span className="text-sm font-medium text-[#7678ed]">{p.role}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                    />
                                </>
                            );
                        })()}

                        {/* 2. Attachments Card (Bottom - Collapsed by default) */}
                        {(() => {
                            const atts = getConversationAttachments();
                            const totalCount = atts.photos.length + atts.otherFiles.length;

                            return (
                                <>
                                    <WidgetToggle
                                        header={
                                            <>
                                                <h3 className="font-bold text-xl text-[#202022]">Attachments</h3>
                                                <span className="text-sm font-semibold text-white bg-[#7678ed] px-2.5 py-0.5 rounded-full">{totalCount}</span>
                                            </>
                                        }
                                        content={
                                            totalCount === 0 ? (
                                                <p className="text-sm text-[#8e90a6] italic">No attachments in this conversation.</p>
                                            ) : (
                                                <>
                                                    {/* Photos / Images */}
                                                    {atts.photos.length > 0 && (
                                                        <div>
                                                            <p className="text-sm font-semibold text-[#8e90a6] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                                                    <polyline points="21 15 16 10 5 21" />
                                                                </svg>
                                                                Photos ({atts.photos.length})
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {atts.photos.map((src, idx) => (
                                                                    <img
                                                                        key={idx}
                                                                        src={src}
                                                                        alt={`Photo ${idx + 1}`}
                                                                        className="w-full h-20 object-cover rounded-xl shadow-xs cursor-pointer hover:opacity-90 transition-opacity border border-[#edf0f7]"
                                                                        onClick={() => setActiveImageModal({ src, title: `Photo ${idx + 1}` })}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Other Files */}
                                                    {atts.otherFiles.length > 0 && (
                                                        <div>
                                                            <p className="text-sm font-semibold text-[#8e90a6] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                                    <polyline points="14 2 14 8 20 8" />
                                                                </svg>
                                                                Files ({atts.otherFiles.length})
                                                            </p>
                                                            <div className="space-y-1.5">
                                                                {atts.otherFiles.map((item, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() =>
                                                                            setActiveAttachmentModal({
                                                                                title: item.name || "Attachment",
                                                                                type: item.type || "file",
                                                                                content: item.content,
                                                                            })
                                                                        }
                                                                        className="w-full text-left px-3 py-2 rounded-xl bg-[#f8f9fe] hover:bg-[#7678ed] hover:text-white text-[#202022] transition-colors text-sm font-medium flex items-center justify-between border border-[#e8ebf3] group cursor-pointer"
                                                                    >
                                                                        <span className="truncate">{item.name || `File ${idx + 1}`}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )
                                        }
                                    />
                                </>
                            );
                        })()}
                        </>
                    );

                    return (
                        <>
                            {/* Desktop permanent column (>= lg) */}
                            <aside className="hidden lg:flex w-[290px] xl:w-[330px] bg-[#f9fafc] border-l border-[#e8ebf3] p-4 flex-col gap-4 overflow-y-auto shrink-0">
                                {drawerCards}
                            </aside>

                            {/* Mobile / Tablet Slide-over Drawer (< lg) */}
                            {isRightDrawerOpen && (
                                <div className="fixed inset-0 z-50 lg:hidden flex justify-end animate-in fade-in duration-200">
                                    <div
                                        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
                                        onClick={() => setIsRightDrawerOpen(false)}
                                    />
                                    <aside className="relative z-10 w-[85vw] max-w-[340px] h-full bg-[#f9fafc] border-l border-[#e8ebf3] p-4 flex flex-col gap-4 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200">
                                        <div className="flex items-center justify-between pb-2 border-b border-[#e8ebf3] shrink-0">
                                            <span className="font-bold text-base text-[#202022]">Details &amp; Context</span>
                                            <button
                                                type="button"
                                                onClick={() => setIsRightDrawerOpen(false)}
                                                className="p-1.5 rounded-xl hover:bg-[#eaecf9] text-[#8e90a6] hover:text-[#202022] transition-colors cursor-pointer"
                                                title="Close details"
                                            >
                                                <CloseIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                        {drawerCards}
                                    </aside>
                                </div>
                            )}
                        </>
                    );
                })() : null}
            </div>
            {/* Create Folder Modal */}
            {isCreatingFolder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">New Folder</h3>
                            <button onClick={() => setIsCreatingFolder(false)} className="text-white/60 hover:text-white p-1 transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/70 mb-1">Folder Name</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="e.g. Work, Research, Personal"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    className="w-full bg-[#2d2d30] border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-colors"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreatingFolder(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newFolderName.trim()}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30"
                                >
                                    Create Folder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Attachment Content Modal */}
            {activeAttachmentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-white text-[#202022] rounded-3xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border border-[#e8ebf3] animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-[#eef0f6] shrink-0 mb-4 select-text">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-2xl bg-[#f0f2f9] text-[#7678ed] flex items-center justify-center font-bold shrink-0 shadow-xs">
                                    {activeAttachmentModal.type === "thought" ? <BrainIcon className="w-5 h-5" /> : <MetadataIcon className="w-5 h-5" />}
                                </div>
                                <h3 className="text-xl font-bold text-[#202022] tracking-tight">{activeAttachmentModal.title}</h3>
                            </div>
                            <button
                                onClick={() => setActiveAttachmentModal(null)}
                                className="p-1.5 text-[#8e90a6] hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors cursor-pointer"
                                title="Close"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content (Parsed HTML Markdown) */}
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 text-base text-[#202022] leading-relaxed select-text">
                            {renderMarkdownText(activeAttachmentModal.content)}
                        </div>

                        {/* Modal Footer */}
                        <div className="pt-4 mt-4 border-t border-[#eef0f6] flex items-center justify-end shrink-0 select-text">
                            <button
                                onClick={() => setActiveAttachmentModal(null)}
                                className="px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white font-semibold rounded-2xl transition-all text-base shadow-sm cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Size Image Gallery Modal */}
            {activeImageModal && (
                <div
                    className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-8 animate-in fade-in duration-200"
                    onClick={() => setActiveImageModal(null)}
                >
                    <div className="relative max-w-[92vw] max-h-[92vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        {/* Close button */}
                        <button
                            onClick={() => setActiveImageModal(null)}
                            className="absolute -top-12 right-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all cursor-pointer shadow-md"
                            title="Close"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>

                        {/* Image */}
                        <img
                            src={activeImageModal.src}
                            alt={activeImageModal.title || "Full size view"}
                            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20 select-text"
                        />
                        {activeImageModal.title && (
                            <p className="text-white/80 text-sm font-medium mt-3 px-4 py-1 bg-black/50 rounded-full backdrop-blur-xs">{activeImageModal.title}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Custom Rename Chat Modal */}
            {isRenameModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Rename Chat</h3>
                            <button onClick={() => setIsRenameModalOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleConfirmRenameChat} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/70 mb-1">Chat Name</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Enter chat name"
                                    value={renameInputVal}
                                    onChange={(e) => setRenameInputVal(e.target.value)}
                                    className="w-full bg-[#2d2d30] border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-colors font-medium"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRenameModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!renameInputVal.trim()}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Delete Chat Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-[#ff4d4f]">Delete Conversation?</h3>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed mb-6">
                            Are you sure you want to delete this conversation? All messages and attachments in this chat will be permanently removed.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteChat}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#ff4d4f] hover:bg-[#e04345] text-white transition-all shadow-md shadow-[#ff4d4f]/30 cursor-pointer"
                            >
                                Delete Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Fork Chat Confirmation Modal */}
            {isForkModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5 text-[#7678ed] font-bold text-lg">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="18" r="3" />
                                    <circle cx="6" cy="6" r="3" />
                                    <circle cx="18" cy="6" r="3" />
                                    <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
                                    <path d="M12 12v3" />
                                </svg>
                                <span>Fork Conversation?</span>
                            </div>
                            <button onClick={() => setIsForkModalOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed mb-6">
                            This will create a new copy of this chat containing all messages up to and including the selected message.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsForkModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmForkChat}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer flex items-center gap-1.5"
                            >
                                Fork Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom New Chat Modal */}
            {isNewChatModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">New Chat</h3>
                            <button onClick={() => setIsNewChatModalOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleConfirmCreateNewChat} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/70 mb-1">Chat Title</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Enter chat title"
                                    value={newChatTitleInput}
                                    onChange={(e) => setNewChatTitleInput(e.target.value)}
                                    className="w-full bg-[#2d2d30] border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-colors font-medium"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsNewChatModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newChatTitleInput.trim()}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer"
                                >
                                    Create Chat
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Duplicate Chat Modal */}
            {isDuplicateModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold tracking-tight">Duplicate Chat</h3>
                            <button onClick={() => setIsDuplicateModalOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed mb-6">
                            Are you sure you want to duplicate this chat? A new conversation with the same content will be created and opened automatically.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsDuplicateModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDuplicateChat}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer"
                            >
                                Duplicate Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Export Chat Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-[#7678ed]/20 text-[#7678ed] flex items-center justify-center">
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold tracking-tight">Export Chat</h3>
                                    <p className="text-xs text-white/60">Select export format to download transcript</p>
                                </div>
                            </div>
                            <button onClick={() => setIsExportModalOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-3 my-5">
                            <label
                                onClick={() => setExportFormat("md")}
                                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                    exportFormat === "md" ? "bg-[#7678ed]/15 border-[#7678ed] text-white" : "bg-[#2d2d30]/60 border-white/10 text-white/70 hover:bg-[#2d2d30]"
                                }`}
                            >
                                <input type="radio" name="exportFormat" checked={exportFormat === "md"} onChange={() => setExportFormat("md")} className="mt-1 accent-[#7678ed]" />
                                <div>
                                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                                        <span>Standard Markdown (.md)</span>
                                        <span className="px-2 py-0.5 text-[10px] rounded-md bg-white/10 text-white/80 font-mono">DEFAULT</span>
                                    </div>
                                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">Formatted Markdown transcript with timestamps and attachment blocks</p>
                                </div>
                            </label>

                            <label
                                onClick={() => setExportFormat("obsidian")}
                                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                    exportFormat === "obsidian" ? "bg-[#7678ed]/15 border-[#7678ed] text-white" : "bg-[#2d2d30]/60 border-white/10 text-white/70 hover:bg-[#2d2d30]"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="exportFormat"
                                    checked={exportFormat === "obsidian"}
                                    onChange={() => setExportFormat("obsidian")}
                                    className="mt-1 accent-[#7678ed]"
                                />
                                <div>
                                    <div className="text-sm font-semibold text-white">Obsidian Markdown (.md)</div>
                                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">Uses Obsidian callouts (&gt; [!quote]- filename) for attachments</p>
                                </div>
                            </label>

                            <label
                                onClick={() => setExportFormat("json")}
                                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                    exportFormat === "json" ? "bg-[#7678ed]/15 border-[#7678ed] text-white" : "bg-[#2d2d30]/60 border-white/10 text-white/70 hover:bg-[#2d2d30]"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="exportFormat"
                                    checked={exportFormat === "json"}
                                    onChange={() => setExportFormat("json")}
                                    className="mt-1 accent-[#7678ed]"
                                />
                                <div>
                                    <div className="text-sm font-semibold text-white">JSON (.json)</div>
                                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">Structured JSON containing chat metadata, messages, and attachments</p>
                                </div>
                            </label>

                            <label
                                onClick={() => setExportFormat("txt")}
                                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                    exportFormat === "txt" ? "bg-[#7678ed]/15 border-[#7678ed] text-white" : "bg-[#2d2d30]/60 border-white/10 text-white/70 hover:bg-[#2d2d30]"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="exportFormat"
                                    checked={exportFormat === "txt"}
                                    onChange={() => setExportFormat("txt")}
                                    className="mt-1 accent-[#7678ed]"
                                />
                                <div>
                                    <div className="text-sm font-semibold text-white">Plain Text (.txt)</div>
                                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">Simple text transcript suitable for any text editor</p>
                                </div>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleExportChat}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] text-white transition-all shadow-md shadow-[#7678ed]/30 flex items-center gap-2 cursor-pointer"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                <span>Export &amp; Download</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Message Confirmation Modal */}
            {deletingMsg && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-[#ff4d4f]">Delete Message?</h3>
                            <button onClick={() => setDeletingMsg(null)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed mb-6">Are you sure you want to delete this message? This action cannot be undone.</p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeletingMsg(null)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteMessage}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#ff4d4f] hover:bg-[#e04345] text-white transition-all shadow-md shadow-[#ff4d4f]/30 cursor-pointer"
                            >
                                Delete Message
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Select Model Modal */}
            {isSelectModelModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 select-none">
                    <div className="bg-white text-[#202022] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-[calc(100vw-24px)] sm:w-full max-w-xl sm:max-w-2xl max-h-[88dvh] flex flex-col shadow-2xl border border-[#e8ebf3] animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-[#eef0f6] shrink-0 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div>
                                    <h3 className="text-xl font-bold text-[#202022] tracking-tight">Select Model</h3>
                                    <p className="text-xs text-[#8e90a6] mt-0.5">Choose the responding AI model</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSelectModelModalOpen(false)}
                                className="p-1.5 text-[#8e90a6] hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors cursor-pointer"
                                title="Close"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Instance Switcher Tabs if multiple instances exist */}
                        {instances.length > 1 && (
                            <div className="mb-4 space-y-1.5 shrink-0">
                                <label className="block text-[11px] font-bold text-[#5d6075] uppercase tracking-wider">Instance</label>
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                                    {instances.map((inst) => {
                                        const isInstSelected = inst.id === (selectedModalInstanceId || selectedChatInstanceId || instances.find((i) => i.is_enabled)?.id || instances[0]?.id);
                                        const instName = inst.properties?.name || inst.type;
                                        return (
                                            <button
                                                key={`inst-tab-${inst.id}`}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedModalInstanceId(inst.id);
                                                    fetchModelsForInstance(inst.id);
                                                    fetchInstanceModels(inst.id);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                                                    isInstSelected
                                                        ? "bg-[#7678ed] text-white border-[#7678ed] shadow-xs"
                                                        : "bg-[#f9fafc] text-[#5d6075] hover:bg-[#eaecf9] hover:text-[#202022] border-[#e8ebf3]"
                                                }`}
                                            >
                                                {inst.is_enabled && (
                                                    <span className={`w-2 h-2 rounded-full ${isInstSelected ? "bg-emerald-300" : "bg-emerald-500"}`} title="Default instance" />
                                                )}
                                                <span>{instName}</span>
                                                <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-md ${
                                                    isInstSelected ? "bg-white/20 text-white" : "bg-[#eaecf9] text-[#7678ed]"
                                                }`}>
                                                    {inst.type}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Search Input */}
                        <div className="mb-4 relative shrink-0">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#8e90a6"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="absolute left-3.5 top-3.5"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search models..."
                                value={modelModalSearchQuery}
                                onChange={(e) => setModelModalSearchQuery(e.target.value)}
                                className="w-full bg-[#f0f2f9] text-[#202022] placeholder-[#8e90a6] rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#7678ed]/30 transition-all font-medium border border-[#e8ebf3]"
                            />
                        </div>

                        {/* Scrollable Instances & Models List */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                            {(() => {
                                const activeInst = instances.find((i) => i.id === selectedModalInstanceId)
                                    || (selectedChatInstanceId ? instances.find((i) => i.id === selectedChatInstanceId) : null)
                                    || instances.find((i) => i.is_enabled)
                                    || instances[0];

                                if (!activeInst || instances.length === 0) {
                                    return <div className="p-6 text-center text-[#8e90a6] text-sm italic">No active instance connected. Add an instance in settings.</div>;
                                }

                                const activeInstName = activeInst.properties?.name || activeInst.type;
                                const activeModels = (instanceModelsMap[activeInst.id]?.length ? instanceModelsMap[activeInst.id] : instanceModelsList) || [];
                                const activeModelIdSet = new Set(activeModels.flatMap((m) => [m.id?.toLowerCase(), m.name?.toLowerCase()].filter(Boolean)));

                                const query = modelModalSearchQuery.toLowerCase().trim();

                                const matchingPrefs = Array.from(new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values()).filter((pref) => {
                                    if (!pref || !pref.id) return false;
                                    const matchesInstance =
                                        (pref.instance_id && pref.instance_id === activeInst.id) ||
                                        (pref.model_name && activeModelIdSet.has(pref.model_name.toLowerCase())) ||
                                        (pref.model_id && activeModelIdSet.has(pref.model_id.toLowerCase())) ||
                                        activeModelIdSet.has(pref.id.toLowerCase()) ||
                                        (activeModels.length === 0 && (!pref.instance_id || pref.instance_id === activeInst.id));
                                    if (!matchesInstance) return false;

                                    if (!query) return true;
                                    const prefName = (getCharacterName(pref.character) || pref.name || "").toLowerCase();
                                    const modelName = (pref.model_name || "").toLowerCase();
                                    const prefId = pref.id.toLowerCase();
                                    return prefName.includes(query) || modelName.includes(query) || prefId.includes(query);
                                });

                                return (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-3 bg-[#f9fafc] p-3 rounded-2xl border border-[#e8ebf3]">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-bold text-sm text-[#202022]">{activeInstName}</h4>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#eaecf9] text-[#7678ed]">
                                                    {activeInst.type}
                                                </span>
                                                {activeInst.is_enabled ? (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Default
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        Selected
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs font-semibold text-[#8e90a6]">
                                                {matchingPrefs.length} {matchingPrefs.length === 1 ? "model" : "models"}
                                            </span>
                                        </div>

                                        <div className="space-y-2.5">
                                            {matchingPrefs.map((pref) => {
                                                const prefName = getCharacterName(pref.character) || pref.name || pref.model_name || pref.id;
                                                const isSelected = selectedChatInstanceId === activeInst.id && selectedChatModelId === pref.id;
                                                const avatarSrc = getModelAvatarPicture(pref);
                                                const hasCustomAvatar = avatarSrc && avatarSrc !== DEFAULT_MODEL_AVATAR;

                                                return (
                                                    <button
                                                        key={`pref-opt-${activeInst.id}-${pref.id}`}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedChatInstanceId(activeInst.id);
                                                            setSelectedChatModelId(pref.id);
                                                            fetchModelsForInstance(activeInst.id);
                                                            setIsSelectModelModalOpen(false);
                                                        }}
                                                        className={`w-full text-left p-3.5 sm:p-4 rounded-2xl transition-all flex items-center justify-between cursor-pointer border ${
                                                            isSelected
                                                                ? "bg-[#7678ed] text-white border-[#7678ed] shadow-md shadow-[#7678ed]/20"
                                                                : "bg-white hover:bg-[#eaecf9]/60 text-[#202022] border-[#e8ebf3] hover:border-[#7678ed]/40"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3.5 sm:gap-4 truncate">
                                                            <div
                                                                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border shadow-xs ${
                                                                    isSelected ? "border-white/30 bg-white/10" : "border-[#e8ebf3] bg-[#eaecf9]"
                                                                }`}
                                                            >
                                                                {hasCustomAvatar ? (
                                                                    <img
                                                                        src={avatarSrc}
                                                                        alt={prefName}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLElement).style.display = "none";
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span className={`text-base sm:text-lg font-bold uppercase ${isSelected ? "text-white" : "text-[#7678ed]"}`}>
                                                                        {prefName.slice(0, 2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="truncate space-y-1">
                                                                <h4 className={`font-bold text-base sm:text-lg leading-tight truncate ${isSelected ? "text-white" : "text-[#202022]"}`}>
                                                                    {prefName}
                                                                </h4>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`text-xs font-medium truncate ${isSelected ? "text-white/80" : "text-[#7a7d90]"}`}>
                                                                        {pref.model_name ? `Model: ${pref.model_name}` : `ID: ${pref.id}`}
                                                                    </span>
                                                                    {pref.voice && (
                                                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                                                            isSelected ? "bg-white/20 text-white" : "bg-[#eaecf9] text-[#7678ed]"
                                                                        }`}>
                                                                            {pref.voice}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="w-6 h-6 rounded-full bg-white text-[#7678ed] flex items-center justify-center shrink-0 ml-3 shadow-xs">
                                                                <svg
                                                                    width="14"
                                                                    height="14"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="3.5"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                >
                                                                    <polyline points="20 6 9 17 4 12" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}

                                            {matchingPrefs.length === 0 && (
                                                <div className="p-6 text-center text-[#8e90a6] text-xs space-y-1">
                                                    <p className="font-semibold text-[#202022]">No matching model preferences found</p>
                                                    <p>
                                                        {query
                                                            ? `No model preferences match "${query}".`
                                                            : `No configured model preferences match the models available on ${activeInstName}.`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Folder Context Menu */}
            {folderContextMenu && (
                <div
                    className="fixed z-[9999] bg-[#28282b] text-white border border-[#3e3e42] rounded-2xl p-1.5 shadow-2xl min-w-[160px] animate-in fade-in zoom-in-95 duration-150 select-none"
                    style={{ left: `${folderContextMenu.x}px`, top: `${folderContextMenu.y}px` }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 border-b border-[#3e3e42] mb-1">
                        <p className="text-[11px] font-bold text-[#8b8d97] uppercase tracking-wider truncate max-w-[140px]">{folderContextMenu.folderName}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleStartRenameFolder(folderContextMenu.folderId, folderContextMenu.folderName)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Rename
                    </button>
                    <button
                        type="button"
                        onClick={() => handleStartDeleteFolder(folderContextMenu.folderId, folderContextMenu.folderName)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete
                    </button>
                </div>
            )}

            {/* Chat Item Context Menu */}
            {chatContextMenu && (
                <div
                    className="fixed z-[9999] bg-[#28282b] text-white border border-[#3e3e42] rounded-2xl p-1.5 shadow-2xl min-w-[170px] animate-in fade-in zoom-in-95 duration-150 select-none"
                    style={{ left: `${chatContextMenu.x}px`, top: `${chatContextMenu.y}px` }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 border-b border-[#3e3e42] mb-1">
                        <p className="text-[11px] font-bold text-[#8b8d97] uppercase tracking-wider truncate max-w-[140px]">{chatContextMenu.chatName}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleContextMenuRenameChat(chatContextMenu.chatId, chatContextMenu.chatName)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        Rename
                    </button>
                    <button
                        type="button"
                        onClick={() => handleContextMenuDuplicateChat(chatContextMenu.chatId)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Duplicate
                    </button>
                    <button
                        type="button"
                        onClick={() => handleContextMenuExportChat(chatContextMenu.chatId)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export Chat
                    </button>
                    <button
                        type="button"
                        onClick={() => handleContextMenuDeleteChat(chatContextMenu.chatId)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] text-rose-400 hover:text-rose-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete
                    </button>
                </div>
            )}

            {/* Line Context Menu */}
            {lineContextMenu && (
                <div
                    className="fixed z-[9999] bg-[#28282b] text-white border border-[#3e3e42] rounded-2xl p-1.5 shadow-2xl min-w-[170px] animate-in fade-in zoom-in-95 duration-150 select-none"
                    style={{ left: `${lineContextMenu.x}px`, top: `${lineContextMenu.y}px` }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() => {
                            const { msgId, lineText, lineIndex, voice } = lineContextMenu;
                            setLineContextMenu(null);
                            handlePlayTTSLine(msgId, lineText, lineIndex, voice);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Play Line
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const { msgId, fullContent, lineIndex, voice } = lineContextMenu;
                            setLineContextMenu(null);
                            handlePlayTTS(msgId, fullContent, voice, lineIndex);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                            <line x1="19" y1="5" x2="19" y2="19" strokeWidth="2.5" />
                        </svg>
                        Play from here
                    </button>
                </div>
            )}

            {/* Rename Folder Modal */}
            {renamingFolder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Rename Folder</h3>
                            <button onClick={() => setRenamingFolder(null)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleConfirmRenameFolder} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/70 mb-1">Folder Name</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Folder Name"
                                    value={renameFolderNameInput}
                                    onChange={(e) => setRenameFolderNameInput(e.target.value)}
                                    className="w-full bg-[#2d2d30] border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-colors"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRenamingFolder(null)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!renameFolderNameInput.trim()}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer"
                                >
                                    Save Name
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Folder Confirmation Modal */}
            {deletingFolder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-rose-400">Delete Folder?</h3>
                            <button onClick={() => setDeletingFolder(null)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed mb-6">
                            Are you sure you want to delete <strong className="text-white">&ldquo;{deletingFolder.name}&rdquo;</strong>? Chats in this folder will be moved to No Folder.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeletingFolder(null)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteFolder}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/30 cursor-pointer"
                            >
                                Delete Folder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit Lorebook Template Modal */}
            {isLorebookModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white">{editingLorebookTemplate ? "Edit Character Template" : "New Character Template"}</h3>
                            <button onClick={() => setIsLorebookModalOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveLorebookTemplate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/80 mb-1.5">Character / Template Name</label>
                                <input
                                    type="text"
                                    required
                                    value={lorebookFormName}
                                    onChange={(e) => setLorebookFormName(e.target.value)}
                                    placeholder="e.g., Cyberpunk Hacker"
                                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-white/80 mb-1.5">Trigger Keywords (comma-separated)</label>
                                <input
                                    type="text"
                                    value={lorebookFormKeys}
                                    onChange={(e) => setLorebookFormKeys(e.target.value)}
                                    placeholder="e.g., hacker, cyberware, netrunner"
                                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-all"
                                />
                                <span className="text-[11px] text-white/50 block mt-1">Messages containing any of these keywords will trigger this lore context.</span>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-white/80 mb-1.5">Lore Content</label>
                                <textarea
                                    rows={5}
                                    value={lorebookFormContent}
                                    onChange={(e) => setLorebookFormContent(e.target.value)}
                                    placeholder="Enter detailed background story, rules, or character prompt context..."
                                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-all font-mono leading-relaxed resize-y"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setIsLorebookModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={lorebookSaving || !lorebookFormName.trim()}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer"
                                >
                                    {lorebookSaving ? "Saving..." : "Save Template"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Persona Details Read-Only Modal */}
            <PersonaDetailsModal
                isOpen={isPersonaDetailsModalOpen}
                onClose={handleClosePersonaDetailsModal}
                data={personaDetailsData}
            />

            {/* Custom Prompts Selection Modal */}
            <CustomPromptsModal
                isOpen={isCustomPromptsModalOpen}
                onClose={() => setIsCustomPromptsModalOpen(false)}
                onSelectPrompt={handleSelectPrompt}
                getApiUrl={getApiUrl}
            />
        </>
    );
}
