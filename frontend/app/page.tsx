"use client";

import React, { useState, useEffect, useRef } from "react";

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

interface Message {
  id: string;
  senderName: string;
  senderAvatar?: string;
  model?: string;
  isSelf: boolean;
  content: string;
  time: string;
  views?: number;
  reactions?: { emoji: string; count: number }[];
  image?: string;
  attachments?: MessageAttachment[];
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
  date_time: string;
  content: string;
  attachments?: any[];
}

interface ModelPreference {
  id: string;
  picture?: string | null;
  voice?: string | null;
  character?: any;
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
  const words = c.name.trim().split(" ");
  const initials = words.length > 1 && words[1]
    ? `${words[0][0]}${words[1][0]}`.toUpperCase()
    : c.name.slice(0, 2).toUpperCase();

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


const BrainIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
  </svg>
);

const MetadataIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
    <line x1="12" y1="2" x2="12" y2="22" opacity="0.4" />
  </svg>
);

const mapBackendMsgToMessage = (m: BackendMessage, prefMap?: Record<string, ModelPreference>): Message => {
  const isSelf = m.role === "user";
  let timeStr = m.date_time || "";
  if (timeStr.includes(" ")) {
    timeStr = timeStr.split(" ")[1].slice(0, 5);
  }

  const modelKey = m.model ? m.model.toLowerCase() : "";
  const pref = prefMap && modelKey ? (prefMap[modelKey] || prefMap[m.model!]) : undefined;
  const avatarFromPref = formatAvatarPicture(pref?.picture);
  const charName = isCharEnabled(pref?.character) ? getCharacterName(pref?.character) : undefined;
  const displayName = charName || getCharacterName(pref?.character) || m.model || "Assistant";

  return {
    id: m.id,
    senderName: isSelf ? "You" : displayName,
    senderAvatar: isSelf ? undefined : avatarFromPref,
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
      parts.push(<strong key={m.index} className="font-bold text-inherit">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      parts.push(<strong key={m.index} className="font-bold text-inherit">{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      parts.push(<del key={m.index} className="line-through opacity-80">{m[4]}</del>);
    } else if (m[5] !== undefined) {
      parts.push(<em key={m.index} className="italic text-inherit">{m[5]}</em>);
    } else if (m[6] !== undefined) {
      parts.push(<em key={m.index} className="italic text-inherit">{m[6]}</em>);
    } else if (m[7] !== undefined) {
      parts.push(<code key={m.index} className="bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5 font-mono text-sm border border-black/5 dark:border-white/5">{m[7]}</code>);
    } else if (m[8] !== undefined && m[9] !== undefined) {
      parts.push(
        <a key={m.index} href={m[9]} target="_blank" rel="noreferrer" className="underline font-medium text-[#7678ed] hover:opacity-80 transition-opacity">
          {m[8]}
        </a>
      );
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < str.length) {
    parts.push(str.slice(lastIdx));
  }

  return parts;
};

const renderInlineMarkdown = (text: string, keyPrefix: string, activeLineIndex?: number) => {
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
        </ul>
      );
      currentUlItems = [];
      inUnorderedList = false;
    }
    if (inOrderedList && currentOlItems.length > 0) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 pl-2">
          {currentOlItems}
        </ol>
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
        </div>
      );
      currentTableLines = [];
      inTable = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const isHl = activeLineIndex === idx;
    const hlClass = isHl ? " bg-[#7678ed]/20 border-l-4 border-[#7678ed] pl-2.5 py-0.5 rounded-r-xl transition-all duration-300 font-medium text-[#111] shadow-xs" : "";

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
      elements.push(<h1 key={idx} className={`text-2xl font-extrabold text-[#202022] my-2${hlClass}`}>{parseFormatting(trimmed.slice(2))}</h1>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushListsAndTable();
      elements.push(<h2 key={idx} className={`text-xl font-bold text-[#202022] my-2${hlClass}`}>{parseFormatting(trimmed.slice(3))}</h2>);
      return;
    }
    if (trimmed.startsWith("### ")) {
      flushListsAndTable();
      elements.push(<h3 key={idx} className={`text-lg font-bold text-[#202022] my-1.5${hlClass}`}>{parseFormatting(trimmed.slice(4))}</h3>);
      return;
    }
    if (trimmed.startsWith("#### ")) {
      flushListsAndTable();
      elements.push(<h4 key={idx} className={`text-base font-bold text-[#202022] my-1${hlClass}`}>{parseFormatting(trimmed.slice(5))}</h4>);
      return;
    }
    if (trimmed.startsWith("##### ") || trimmed.startsWith("###### ")) {
      flushListsAndTable();
      elements.push(<h5 key={idx} className={`text-sm font-bold uppercase tracking-wider text-[#8e90a6] my-1${hlClass}`}>{parseFormatting(trimmed.replace(/^#+\s*/, ""))}</h5>);
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
        <blockquote key={idx} className={`border-l-4 border-[#7678ed] pl-3 py-1 my-2 text-[#4a4d63] italic bg-[#f0f2f9]/50 rounded-r-xl${hlClass}`}>
          {parseFormatting(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // Unordered List (- or * or +)
    const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (inOrderedList) flushListsAndTable();
      inUnorderedList = true;
      currentUlItems.push(<li key={idx} className={`leading-relaxed${hlClass}`}>{parseFormatting(ulMatch[1])}</li>);
      return;
    }

    // Ordered List (1. 2.)
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUnorderedList) flushListsAndTable();
      inOrderedList = true;
      currentOlItems.push(<li key={idx} className={`leading-relaxed${hlClass}`}>{parseFormatting(olMatch[1])}</li>);
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
    elements.push(<p key={idx} className={`leading-relaxed my-1${hlClass}`}>{parseFormatting(line)}</p>);
  });

  flushListsAndTable();
  return <div key={keyPrefix} className="space-y-1">{elements}</div>;
};

const renderMarkdownText = (text: string, activeLineIndex?: number) => {
  if (!text) return null;

  const codeBlockRegex = /```(\w+)?\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  const elements: React.ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(renderInlineMarkdown(text.slice(lastIndex, match.index), `text-${lastIndex}`, activeLineIndex));
    }
    const lang = match[1] || "";
    const codeContent = match[2]?.trim() || "";
    elements.push(
      <div key={`code-${match.index}`} className="my-2.5 rounded-2xl bg-[#1e1e24] text-[#f8f8f2] p-4 text-sm font-mono overflow-x-auto shadow-inner border border-white/10 select-text">
        {lang && <div className="text-xs text-white/50 mb-1.5 pb-1 border-b border-white/10 font-sans uppercase tracking-wider font-semibold">{lang}</div>}
        <pre className="whitespace-pre-wrap font-mono leading-relaxed">{codeContent}</pre>
      </div>
    );
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(renderInlineMarkdown(text.slice(lastIndex), `text-${lastIndex}`, activeLineIndex));
  }

  return <>{elements}</>;
};

export default function AlpacaWebPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [modelPreferences, setModelPreferences] = useState<Record<string, ModelPreference>>({});
  const [activeAttachmentModal, setActiveAttachmentModal] = useState<{ title: string; type: string; content: string } | null>(null);
  const [activeImageModal, setActiveImageModal] = useState<{ src: string; title?: string } | null>(null);
  const [isChatContextMenuOpen, setIsChatContextMenuOpen] = useState<boolean>(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [renameInputVal, setRenameInputVal] = useState<string>("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState<boolean>(false);
  const [newChatTitleInput, setNewChatTitleInput] = useState<string>("New Chat");

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
        })
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
  };

  const handlePauseTTS = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    updateTTSState((prev) => ({ ...prev, status: "paused" }));
  };

  const handleResumeTTS = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(console.warn);
    }
    updateTTSState((prev) => ({ ...prev, status: "playing" }));
  };

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

  const handlePlayTTS = async (msgId: string, content: string, voice?: string) => {
    if (ttsStateRef.current.msgId === msgId && ttsStateRef.current.status === "paused") {
      handleResumeTTS();
      return;
    }

    handleStopTTS();

    const rawLines = content.split("\n");
    const validLines: { origIndex: number; cleanText: string }[] = [];

    rawLines.forEach((lineText, origIndex) => {
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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    updateTTSState({ msgId, status: "playing", lineIndex: validLines[0].origIndex });

    // Pipeline background audio fetches back-to-back immediately for all valid lines
    const audioBlobPromises: Promise<Blob | null>[] = validLines.map((item) =>
      fetchTTSBlob(item.cleanText, voice || "af_heart", controller.signal)
    );

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
            const interval = setInterval(() => {
              const currentSt = ttsStateRef.current.status;
              if (currentSt === "playing" || (currentSt as string) === "stopped") {
                clearInterval(interval);
                if (currentSt === "playing") {
                  audio.play().catch(resolve);
                } else {
                  resolve();
                }
              }
            }, 100);
          } else if (st === "stopped" || ttsStateRef.current.msgId !== msgId) {
            resolve();
          } else {
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
    }
  };

  const getConversationParticipants = () => {
    const map = new Map<string, { id: string; name: string; avatar: string; role: string }>();

    map.set("user", {
      id: "user",
      name: "You",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
      role: "User",
    });

    messages.forEach((msg) => {
      if (!msg.isSelf) {
        const key = (msg.senderName || "").toLowerCase();
        if (!map.has(key)) {
          const pref = modelPreferences[key] || modelPreferences[msg.senderName || ""];
          const avatarSrc = msg.senderAvatar || formatAvatarPicture(pref?.picture) || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80";
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
  const [activeTab, setActiveTab] = useState<string>("all");
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const chatParam = params.get("chat");
      if (chatParam) return chatParam;
    }
    return "design-chat";
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [expandedSection, setExpandedSection] = useState<string>("photos");
  const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");

  const handleOpenRenameModal = () => {
    setIsChatContextMenuOpen(false);
    const activeChat = chatItems.find((c) => c.id === activeChatId);
    if (activeChat) {
      setRenameInputVal(activeChat.name);
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

    setChatItems((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, name: trimmed } : c))
    );

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

    try {
      await fetch(`${API_URL}/chats/${deletedId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("Could not delete chat on backend API:", err);
    }
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

  const fetchFolders = async () => {
    try {
      const res = await fetch(`${API_URL}/folders`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFolders(data);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not fetch folders from backend, fallback to initial default folders:", err);
    }
    setFolders([
      { id: "work", name: "Work" },
      { id: "friends", name: "Friends" },
      { id: "news", name: "News" },
      { id: "archive", name: "Archive" },
    ]);
  };

  const fetchChats = async (folderId?: string) => {
    try {
      let url = `${API_URL}/chats`;
      if (folderId && folderId !== "all") {
        url += `?folder=${encodeURIComponent(folderId)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data: BackendChat[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(mapBackendChatToChatItem);
          setChatItems(mapped);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not fetch chats from backend API, using current list:", err);
    }
  };

  const fetchModelPreferences = async () => {
    try {
      const res = await fetch(`${API_URL}/model-preferences`);
      if (res.ok) {
        const data: ModelPreference[] = await res.json();
        if (Array.isArray(data)) {
          const prefMap: Record<string, ModelPreference> = {};
          data.forEach((p) => {
            if (p.id) {
              prefMap[p.id.toLowerCase()] = p;
              prefMap[p.id] = p;
            }
          });
          setModelPreferences(prefMap);
        }
      }
    } catch (err) {
      console.warn("Could not fetch model preferences from backend API:", err);
    }
  };

  const fetchChatMessages = async (chatId: string) => {
    try {
      const res = await fetch(`${API_URL}/chats/${chatId}`);
      if (res.ok) {
        const data: BackendChat = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m) => mapBackendMsgToMessage(m, modelPreferences)));
        }
      }
    } catch (err) {
      console.warn("Could not fetch chat messages from backend API:", err);
    }
  };

  useEffect(() => {
    fetchFolders();
    fetchModelPreferences();

    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const chatParam = params.get("chat");
        if (chatParam) {
          setActiveChatId(chatParam);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    fetchChats(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeChatId) {
      fetchChatMessages(activeChatId);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.get("chat") !== activeChatId) {
          url.searchParams.set("chat", activeChatId);
          window.history.pushState({}, "", url.toString());
        }
      }
    }
  }, [activeChatId]);

  useEffect(() => {
    if (activeChatId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, activeChatId]);

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
          folder: activeTab !== "all" ? activeTab : null,
        }),
      });
      if (res.ok) {
        const created: BackendChat = await res.json();
        const mapped = mapBackendChatToChatItem(created);
        setChatItems((prev) => [mapped, ...prev]);
        setActiveChatId(created.id);
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
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText("");

    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderName: "You",
      senderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
      isSelf: true,
      content,
      time: nowStr,
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      if (activeChatId) {
        await fetch(`${API_URL}/chats/${activeChatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "user",
            content,
          }),
        });
      }
    } catch (err) {
      console.warn("Could not post message to backend API:", err);
    }
  };

  return (
		<main className='topo-bg min-h-screen w-screen flex items-center justify-center p-[30px] md:p-[40px] lg:p-[50px] font-sans antialiased text-[#202022] box-border'>
			{/* Outer Floating Application Window */}
			<div className='w-full min-w-[90vw] h-[calc(100vh-60px)] md:h-[calc(100vh-80px)] lg:h-[calc(100vh-100px)] min-h-[90vh] bg-[#202022] rounded-[36px] shadow-[0_24px_70px_rgba(32,32,34,0.35)] flex overflow-hidden border-8 border-[#202022]'>
				{/* ========================================================= */}
				{/* 1. SLIM LEFT NAVIGATION RAIL (#202022) */}
				{/* ========================================================= */}
				<aside className='w-[100px] bg-[#202022] flex flex-col items-center justify-between py-6 px-2 select-none shrink-0 border-r border-[#2d2d30]'>
					{/* Top Alpaca Prism Logo */}
					<div className='flex flex-col items-center gap-8 w-full'>
						<div className='w-12 h-12 flex items-center justify-center text-white cursor-pointer hover:opacity-85 transition-opacity'>
							<img src='/icon-white.svg' alt='Alpaca Logo' className='w-9 h-9 object-contain' />
						</div>

						{/* Navigation Tabs (Backend Folders API Integrated) */}
						<nav className='flex flex-col items-center gap-3 w-full overflow-y-auto max-h-[calc(100vh-220px)] px-1'>
							{/* All chats tab */}
							<button
								onClick={() => setActiveTab('all')}
								className={`w-full py-3 px-1 rounded-2xl flex flex-col items-center gap-1.5 transition-all relative ${
									activeTab === 'all' ? 'bg-[#2e2f33] text-white shadow-inner' : 'text-[#8b8d97] hover:text-white'
								}`}
								title='All chats'
							>
								<div className='relative'>
									<svg
										width='22'
										height='22'
										viewBox='0 0 24 24'
										fill='none'
										stroke='currentColor'
										strokeWidth='2'
										strokeLinecap='round'
										strokeLinejoin='round'
									>
										<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
									</svg>
									<span className='absolute -top-1.5 -right-2.5 bg-[#ff7a55] text-white text-sm font-bold px-1.5 py-0.2 rounded-full leading-tight shadow-sm'>
										{chatItems.length}
									</span>
								</div>
								<span className='text-sm font-medium tracking-tight'>All chats</span>
							</button>

							{/* Dynamic Folders from /api/folders */}
							{folders.map((folder) => {
								const isActive = activeTab === folder.id;
								return (
									<button
										key={folder.id}
										onClick={() => setActiveTab(folder.id)}
										className={`w-full py-3 px-1 rounded-2xl flex flex-col items-center gap-1.5 transition-all relative ${
											isActive ? 'bg-[#2e2f33] text-white shadow-inner' : 'text-[#8b8d97] hover:text-white'
										}`}
										title={folder.name}
									>
										<div className='relative'>
											<svg
												width='22'
												height='22'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'
											>
												<path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' />
											</svg>
										</div>
										<span className='text-sm font-medium tracking-tight truncate w-full text-center px-1'>{folder.name}</span>
									</button>
								);
							})}

							{/* Add Folder Button */}
							<button
								onClick={() => setIsCreatingFolder(true)}
								className='w-full py-2.5 px-1 rounded-2xl flex flex-col items-center gap-1 text-[#7678ed] hover:bg-[#2d2d30] hover:text-white transition-all border border-dashed border-[#7678ed]/40 mt-1 cursor-pointer'
								title='Create New Folder'
							>
								<svg
									width='20'
									height='20'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.2'
									strokeLinecap='round'
									strokeLinejoin='round'
								>
									<line x1='12' y1='5' x2='12' y2='19' />
									<line x1='6' y1='12' x2='18' y2='12' />
								</svg>
								<span className='text-xs font-medium tracking-tight'>+ Folder</span>
							</button>
						</nav>
					</div>

					{/* Bottom Settings */}
					<button className='w-full py-3 rounded-2xl flex flex-col items-center gap-1.5 text-[#8b8d97] hover:text-white transition-all cursor-pointer'>
						<svg
							width='22'
							height='22'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
						>
							<path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' />
							<circle cx='12' cy='12' r='3' />
						</svg>
						<span className='text-sm font-medium tracking-tight'>Settings</span>
					</button>
				</aside>

				{/* Inner App Container with Rounded Right / Light Theme Area */}
				<div className='flex-1 flex overflow-hidden bg-[#f9fafc] rounded-l-[32px]'>
					{/* ========================================================= */}
					{/* 2. CHAT LIST PANEL (#f9fafc) */}
					{/* ========================================================= */}
					<section className='w-[350px] border-r border-[#e8ebf3] flex flex-col bg-[#f9fafc] shrink-0'>
						{/* Search Bar Header */}
						<div className='p-4 pb-3 flex items-center gap-2'>
							<div className='relative flex-1 flex items-center bg-[#eaecf9] rounded-2xl px-3.5 py-2.5 transition-colors focus-within:bg-[#e2e5f8]'>
								<svg
									width='18'
									height='18'
									viewBox='0 0 24 24'
									fill='none'
									stroke='#7678ed'
									strokeWidth='2.2'
									strokeLinecap='round'
									strokeLinejoin='round'
									className='mr-2.5 shrink-0 opacity-80'
								>
									<circle cx='11' cy='11' r='8' />
									<line x1='21' y1='21' x2='16.65' y2='16.65' />
								</svg>
								<input
									type='text'
									placeholder='Search'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className='bg-transparent text-lg text-[#202022] placeholder-[#8e90a6] outline-none w-full font-medium'
								/>
							</div>
							<button
								onClick={handleOpenNewChatModal}
								className='p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer'
								title='Create New Chat'
							>
								<svg
									width='18'
									height='18'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.5'
									strokeLinecap='round'
									strokeLinejoin='round'
								>
									<line x1='12' y1='5' x2='12' y2='19' />
									<line x1='6' y1='12' x2='18' y2='12' />
								</svg>
							</button>
						</div>

						{/* Chat List Scrollable Items */}
						<div className='flex-1 overflow-y-auto px-2 space-y-1.5 pb-4'>
							{chatItems
								.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
								.map((chat) => {
									const isSelected = activeChatId === chat.id;
									return (
										<div
											key={chat.id}
											onClick={() => setActiveChatId(chat.id)}
											className={`relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
												isSelected ? 'bg-[#edeffb] shadow-[0_2px_8px_rgba(118,120,237,0.08)]' : 'hover:bg-[#f2f4fa]'
											}`}
										>
											{/* Avatar */}
											{chat.avatarText ? (
												<div className='w-12 h-12 rounded-2xl bg-[#202022] text-white flex items-center justify-center font-bold text-lg tracking-wide shrink-0 shadow-sm'>
													{chat.avatarText}
												</div>
											) : (
												<img src={chat.avatarImg} alt={chat.name} className='w-12 h-12 rounded-2xl object-cover shrink-0 shadow-sm' />
											)}

											{/* Info */}
											<div className='flex-1 min-w-0'>
												<div className='flex items-center justify-between gap-1 mb-0.5'>
													<h4 className='font-semibold text-lg text-[#202022] truncate'>{chat.name}</h4>
													<span className='text-sm text-[#8e90a6] font-medium shrink-0'>{chat.time}</span>
												</div>
												<div className='flex items-center justify-between gap-1'>
													<p className={`text-base truncate ${isSelected ? 'text-[#7678ed] font-medium' : 'text-[#7a7d90]'}`}>
														{chat.lastMessage}
													</p>

													{/* Pin / Badge / Delivered */}
													<div className='flex items-center gap-1.5 shrink-0'>
														{chat.unreadCount && (
															<span className='bg-[#ff7a55] text-white text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none'>
																{chat.unreadCount}
															</span>
														)}
														{chat.isPinned && (
															<svg width='13' height='13' viewBox='0 0 24 24' fill='#7678ed' stroke='#7678ed' strokeWidth='1.5'>
																<path d='M12 2L15 8L21 9L17 14L18 20L12 17L6 20L7 14L3 9L9 8L12 2Z' />
															</svg>
														)}
														{chat.isDelivered && (
															<svg
																width='15'
																height='15'
																viewBox='0 0 24 24'
																fill='none'
																stroke='#7678ed'
																strokeWidth='2.5'
																strokeLinecap='round'
																strokeLinejoin='round'
															>
																<polyline points='18 6 9 17 4 12' />
															</svg>
														)}
													</div>
												</div>
											</div>
										</div>
									);
								})}
						</div>
					</section>

					{/* ========================================================= */}
					{/* 3. MAIN CHAT AREA (WHITE) */}
					{/* ========================================================= */}
					{(() => {
						const activeChat = chatItems.find((c) => c.id === activeChatId);
						if (!activeChatId || !activeChat) {
							return (
								<section className='flex-1 flex flex-col items-center justify-center bg-white p-8 text-center select-none'>
									<div className='w-24 h-24 rounded-3xl bg-[#f0f2f9] flex items-center justify-center mb-6 text-[#7678ed] shadow-inner'>
										<img src='/icon-black.svg' alt='Alpaca Logo' className='w-14 h-14 opacity-70' />
									</div>
									<h3 className='text-2xl font-bold text-[#202022] mb-2'>No chat select</h3>
									<p className='text-base text-[#8e90a6] max-w-sm'>
										Select a conversation from the chat list on the left to view messages and continue chatting.
									</p>
								</section>
							);
						}

						return (
							<section className='flex-1 flex flex-col bg-white overflow-hidden'>
								{/* Header */}
								<div className='h-[76px] px-8 border-b border-[#eef0f6] flex items-center justify-between shrink-0'>
									<div>
										<h2 className='text-2xl font-bold text-[#202022] tracking-tight'>{activeChat.name}</h2>
										<p className='text-base text-[#8e90a6] font-medium mt-0.5'>Active chat session</p>
									</div>

									{/* Action Icons */}
									<div className='flex items-center gap-4 text-[#8e90a6] relative'>
										<button className='p-2 hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors'>
											<svg
												width='20'
												height='20'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'
											>
												<circle cx='11' cy='11' r='8' />
												<line x1='21' y1='21' x2='16.65' y2='16.65' />
											</svg>
										</button>

										{/* 3 Dots Context Menu */}
										<div className='relative'>
											<button
												onClick={() => setIsChatContextMenuOpen(!isChatContextMenuOpen)}
												className='p-2 hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors cursor-pointer'
												title='Chat options'
											>
												<svg
													width='20'
													height='20'
													viewBox='0 0 24 24'
													fill='none'
													stroke='currentColor'
													strokeWidth='2'
													strokeLinecap='round'
													strokeLinejoin='round'
												>
													<circle cx='12' cy='12' r='1' />
													<circle cx='12' cy='5' r='1' />
													<circle cx='12' cy='19' r='1' />
												</svg>
											</button>

											{isChatContextMenuOpen && (
												<>
													{/* Backdrop to close context menu on click outside */}
													<div className='fixed inset-0 z-30' onClick={() => setIsChatContextMenuOpen(false)} />
													{/* Dropdown Menu */}
													<div className='absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-[#e8ebf3] py-2 z-40 select-none animate-in fade-in duration-150'>
														<button
															onClick={handleOpenRenameModal}
															className='w-full text-left px-4 py-2.5 text-base font-semibold text-[#202022] hover:bg-[#f4f6fc] transition-colors flex items-center gap-2.5 cursor-pointer'
														>
															<svg
																width='16'
																height='16'
																viewBox='0 0 24 24'
																fill='none'
																stroke='currentColor'
																strokeWidth='2'
																strokeLinecap='round'
																strokeLinejoin='round'
															>
																<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
															</svg>
															Rename
														</button>
														<button
															onClick={handleOpenDeleteModal}
															className='w-full text-left px-4 py-2.5 text-base font-semibold text-[#ff4d4f] hover:bg-[#fff1f0] transition-colors flex items-center gap-2.5 cursor-pointer'
														>
															<svg
																width='16'
																height='16'
																viewBox='0 0 24 24'
																fill='none'
																stroke='currentColor'
																strokeWidth='2'
																strokeLinecap='round'
																strokeLinejoin='round'
															>
																<polyline points='3 6 5 6 21 6' />
																<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
															</svg>
															Delete
														</button>
													</div>
												</>
											)}
										</div>
									</div>
								</div>

								{/* Conversation Messages */}
								<div className='flex-1 overflow-y-auto px-8 py-6 space-y-6'>
									{messages.map((msg) => {
										if (msg.isSelf) {
											{
												/* User message (Role 'user' -> Right side, full width) */
											}
											const imageAttachments = (msg.attachments || []).filter(isImageAttachment);
											const imageSources: string[] = [];
											if (msg.image) imageSources.push(msg.image);
											imageAttachments.forEach((att) => {
												const src = getImageSrc(att);
												if (src && !imageSources.includes(src)) imageSources.push(src);
											});

											return (
												<div key={msg.id} className='flex items-start justify-end gap-3.5 w-full'>
													<div className='flex flex-col items-end flex-1 w-full min-w-0'>
														<div className='bg-[#7678ed] text-white rounded-2xl rounded-tr-sm px-5 py-4 text-lg shadow-[0_4px_14px_rgba(118,120,237,0.35)] w-full'>
															<div className='leading-relaxed font-normal'>{renderMarkdownText(msg.content)}</div>
															{imageSources.length > 0 && (
																<div className='flex flex-row gap-2.5 overflow-x-auto mt-3 pb-1.5 max-w-full'>
																	{imageSources.map((src, idx) => (
																		<img
																			key={idx}
																			src={src}
																			alt={`Attachment ${idx + 1}`}
																			className='h-32 min-w-[128px] max-w-[260px] rounded-xl object-cover border border-white/20 shadow-xs flex-shrink-0 cursor-pointer hover:opacity-95 transition-opacity'
																			onClick={() => setActiveImageModal({ src, title: `Attachment Image ${idx + 1}` })}
																		/>
																	))}
																</div>
															)}
															<div className='flex items-center justify-end gap-2 text-sm text-white/80 mt-2'>
																<span>{msg.time}</span>
															</div>
														</div>
													</div>
													<div
														className='w-10 h-10 rounded-2xl bg-[#7678ed] text-white flex items-center justify-center font-bold text-sm shrink-0 mt-1 shadow-sm'
														title='You'
													>
														<svg
															width='20'
															height='20'
															viewBox='0 0 24 24'
															fill='none'
															stroke='currentColor'
															strokeWidth='2.2'
															strokeLinecap='round'
															strokeLinejoin='round'
														>
															<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
															<circle cx='12' cy='7' r='4' />
														</svg>
													</div>
												</div>
											);
										} else {
											{
												/* Assistant / Incoming message (Role 'assistant' -> Left side, full width) */
											}
											const prefKey = (msg.senderName || '').toLowerCase();
											const pref =
												modelPreferences[prefKey] ||
												modelPreferences[msg.senderName || ''] ||
												(msg.model ? modelPreferences[msg.model.toLowerCase()] : undefined);
											const avatarSrc =
												msg.senderAvatar ||
												formatAvatarPicture(pref?.picture) ||
												'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80';
											const charName = isCharEnabled(pref?.character) ? getCharacterName(pref?.character) : undefined;
											const displayName = charName || getCharacterName(pref?.character) || msg.senderName;
											const modelVoice = pref?.voice || undefined;

											const isThisMsgPlaying = ttsState.msgId === msg.id && ttsState.status === 'playing';
											const isThisMsgActive = ttsState.msgId === msg.id && ttsState.status !== 'stopped';

											const thoughtAtt = msg.attachments?.find(
												(a) => a.type?.toLowerCase() === 'thought' || a.type?.toLowerCase() === 'brain',
											);
											const metadataAtt = msg.attachments?.find(
												(a) => a.type?.toLowerCase() === 'metadata' || a.type?.toLowerCase() === 'data',
											);

											return (
												<div key={msg.id} className='flex items-start gap-3.5 w-full'>
													<img
														src={avatarSrc}
														alt={displayName}
														className='w-10 h-10 rounded-2xl object-cover shrink-0 mt-1 shadow-sm'
													/>
													<div className='flex flex-col items-start flex-1 w-full min-w-0'>
														<div className='bg-[#f0f2f9] rounded-2xl rounded-tl-sm px-5 py-4 text-lg text-[#202022] shadow-[0_1px_3px_rgba(0,0,0,0.02)] w-full'>
															<div className='flex items-center justify-between gap-3 mb-1.5'>
																<div className='flex items-center gap-2'>
																	{/* TTS Controls in front of displayName */}
																	{isThisMsgActive ? (
																		<div className='flex items-center gap-1'>
																			{isThisMsgPlaying ? (
																				<button
																					type='button'
																					onClick={handlePauseTTS}
																					className='p-1.5 rounded-xl bg-[#7678ed] text-white hover:bg-[#6869d9] transition-all shadow-xs cursor-pointer flex items-center justify-center'
																					title='Pause Speech'
																				>
																					<svg width='12' height='12' viewBox='0 0 24 24' fill='currentColor'>
																						<rect x='6' y='4' width='4' height='16' rx='1' />
																						<rect x='14' y='4' width='4' height='16' rx='1' />
																					</svg>
																				</button>
																			) : (
																				<button
																					type='button'
																					onClick={handleResumeTTS}
																					className='p-1.5 rounded-xl bg-[#7678ed] text-white hover:bg-[#6869d9] transition-all shadow-xs cursor-pointer flex items-center justify-center'
																					title='Resume Speech'
																				>
																					<svg width='12' height='12' viewBox='0 0 24 24' fill='currentColor'>
																						<polygon points='5 3 19 12 5 21 5 3' />
																					</svg>
																				</button>
																			)}
																			<button
																				type='button'
																				onClick={handleStopTTS}
																				className='p-1.5 rounded-xl bg-[#ff7a55] text-white hover:bg-[#e06845] transition-all shadow-xs cursor-pointer flex items-center justify-center'
																				title='Stop Speech'
																			>
																				<svg width='12' height='12' viewBox='0 0 24 24' fill='currentColor'>
																					<rect x='4' y='4' width='16' height='16' rx='2' />
																				</svg>
																			</button>
																		</div>
																	) : (
																		<button
																			type='button'
																			onClick={() => handlePlayTTS(msg.id, msg.content, modelVoice)}
																			className='p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#7678ed] hover:bg-[#7678ed] hover:text-white transition-all shadow-xs cursor-pointer flex items-center justify-center'
																			title='Play Speech'
																		>
																			<svg width='12' height='12' viewBox='0 0 24 24' fill='currentColor'>
																				<polygon points='5 3 19 12 5 21 5 3' />
																			</svg>
																		</button>
																	)}
																	<p className='text-base font-semibold text-[#7678ed]'>{displayName}</p>
																</div>
																<div className='flex items-center gap-1.5 shrink-0'>
																	{thoughtAtt && (
																		<button
																			type='button'
																			onClick={() =>
																				setActiveAttachmentModal({
																					title: thoughtAtt.name || 'Thought',
																					type: 'thought',
																					content: thoughtAtt.content,
																				})
																			}
																			className='px-2.5 py-1 rounded-xl bg-white border border-[#e2e5f1] hover:bg-[#7678ed] hover:text-white text-[#7678ed] transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer'
																			title='View Thought / Reasoning'
																		>
																			<BrainIcon className='w-3.5 h-3.5' />
																			<span>Thought</span>
																		</button>
																	)}
																	{metadataAtt && (
																		<button
																			type='button'
																			onClick={() =>
																				setActiveAttachmentModal({
																					title: metadataAtt.name || 'Metadata',
																					type: 'metadata',
																					content: metadataAtt.content,
																				})
																			}
																			className='px-2.5 py-1 rounded-xl bg-white border border-[#e2e5f1] hover:bg-[#7678ed] hover:text-white text-[#7678ed] transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer'
																			title='View Metadata'
																		>
																			<MetadataIcon className='w-3.5 h-3.5' />
																			<span>Metadata</span>
																		</button>
																	)}
																</div>
															</div>
															<div className='leading-relaxed'>
																{renderMarkdownText(msg.content, msg.id === ttsState.msgId ? ttsState.lineIndex : undefined)}
															</div>
															<div className='flex items-center justify-between gap-4 mt-2.5 pt-1'>
																{msg.reactions && msg.reactions.length > 0 && (
																	<div className='flex items-center gap-1.5'>
																		{msg.reactions.map((r, i) => (
																			<span
																				key={i}
																				className='inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white border border-[#e2e5f1] rounded-full text-base font-medium text-[#4a4d63] shadow-xs'
																			>
																				<span>{r.emoji}</span> {r.count}
																			</span>
																		))}
																	</div>
																)}
																<div className='flex items-center gap-2 text-sm text-[#8e90a6]'>
																	{msg.views !== undefined && (
																		<span className='flex items-center gap-1'>
																			<svg
																				width='14'
																				height='14'
																				viewBox='0 0 24 24'
																				fill='none'
																				stroke='currentColor'
																				strokeWidth='2'
																			>
																				<path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
																				<circle cx='12' cy='12' r='3' />
																			</svg>
																			{msg.views}
																		</span>
																	)}
																	<span>{msg.time}</span>
																</div>
															</div>
														</div>
													</div>
												</div>
											);
										}
									})}
									<div ref={messagesEndRef} />
								</div>

								{/* Input Composer */}
								<form onSubmit={handleSendMessage} className='p-4 px-8 border-t border-[#eef0f6] bg-white flex items-center gap-3'>
									<button
										type='button'
										className='p-2.5 text-[#8e90a6] hover:text-[#7678ed] hover:bg-[#f4f6fc] rounded-2xl transition-colors'
										title='Attach file'
									>
										<svg
											width='20'
											height='20'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='2'
											strokeLinecap='round'
											strokeLinejoin='round'
										>
											<path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48' />
										</svg>
									</button>

									<input
										type='text'
										placeholder='Write a message...'
										value={inputText}
										onChange={(e) => setInputText(e.target.value)}
										className='flex-1 bg-[#f0f2f9] text-[#202022] placeholder-[#8e90a6] rounded-2xl px-5 py-3.5 text-lg outline-none focus:ring-2 focus:ring-[#7678ed]/30 transition-all font-medium'
									/>

									<button
										type='button'
										className='p-2.5 text-[#8e90a6] hover:text-[#7678ed] hover:bg-[#f4f6fc] rounded-2xl transition-colors'
										title='Emoji'
									>
										<svg
											width='20'
											height='20'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='2'
											strokeLinecap='round'
											strokeLinejoin='round'
										>
											<circle cx='12' cy='12' r='10' />
											<path d='M8 14s1.5 2 4 2 4-2 4-2' />
											<line x1='9' y1='9' x2='9.01' y2='9' />
											<line x1='15' y1='9' x2='15.01' y2='9' />
										</svg>
									</button>

									<button
										type='submit'
										className='w-11 h-11 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl flex items-center justify-center transition-all shadow-md shadow-[#7678ed]/30 shrink-0'
										title='Send'
									>
										<svg
											width='18'
											height='18'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='2.5'
											strokeLinecap='round'
											strokeLinejoin='round'
										>
											<line x1='22' y1='2' x2='11' y2='13' />
											<polygon points='22 2 15 22 11 13 2 9 22 2' />
										</svg>
									</button>
								</form>
							</section>
						);
					})()}

					{/* ========================================================= */}
					{/* 4. RIGHT INFO DRAWER (#f9fafc) */}
					{/* ========================================================= */}
					{activeChatId && chatItems.some((c) => c.id === activeChatId) ? (
						<aside className='w-[330px] bg-[#f9fafc] border-l border-[#e8ebf3] p-4 flex flex-col gap-4 overflow-y-auto shrink-0'>
							{/* 1. Members Card (Top) */}
							{(() => {
								const participants = getConversationParticipants();
								return (
									<div className='bg-white rounded-3xl p-5 shadow-xs border border-[#edf0f7]'>
										<div className='flex items-center justify-between mb-4'>
											<h3 className='font-bold text-xl text-[#202022]'>{participants.length} members</h3>
										</div>

										{/* Members List */}
										<div className='space-y-3.5 max-h-[300px] overflow-y-auto pr-1'>
											{participants.map((p) => (
												<div key={p.id} className='flex items-center gap-3'>
													{p.id === 'user' ? (
														<div className='w-10 h-10 rounded-2xl bg-[#7678ed] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs'>
															<svg
																width='20'
																height='20'
																viewBox='0 0 24 24'
																fill='none'
																stroke='currentColor'
																strokeWidth='2.2'
																strokeLinecap='round'
																strokeLinejoin='round'
															>
																<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
																<circle cx='12' cy='7' r='4' />
															</svg>
														</div>
													) : (
														<img src={p.avatar} alt={p.name} className='w-10 h-10 rounded-2xl object-cover shadow-xs shrink-0' />
													)}
													<div className='flex-1 min-w-0'>
														<h5 className='font-semibold text-base text-[#202022] truncate'>{p.name}</h5>
														<span className='text-sm font-medium text-[#7678ed]'>{p.role}</span>
													</div>
												</div>
											))}
										</div>
									</div>
								);
							})()}

							{/* 2. Attachments Card (Bottom - Collapsed by default) */}
							{(() => {
								const atts = getConversationAttachments();
								const totalCount = atts.photos.length + atts.otherFiles.length;

								return (
									<div className='bg-white rounded-3xl p-5 shadow-xs border border-[#edf0f7]'>
										{/* Card Header with Collapse Toggle */}
										<button
											onClick={() => setIsAttachmentsExpanded(!isAttachmentsExpanded)}
											className='w-full flex items-center justify-between cursor-pointer select-none'
										>
											<div className='flex items-center gap-2'>
												<h3 className='font-bold text-xl text-[#202022]'>Attachments</h3>
												<span className='text-sm font-semibold text-white bg-[#7678ed] px-2.5 py-0.5 rounded-full'>{totalCount}</span>
											</div>
											<div className='p-1 text-[#8e90a6] hover:text-[#202022] transition-colors'>
												<svg
													width='18'
													height='18'
													viewBox='0 0 24 24'
													fill='none'
													stroke='currentColor'
													strokeWidth='2.2'
													strokeLinecap='round'
													strokeLinejoin='round'
													className={`transition-transform duration-200 ${isAttachmentsExpanded ? 'rotate-180' : ''}`}
												>
													<polyline points='6 9 12 15 18 9' />
												</svg>
											</div>
										</button>

										{/* Collapsible Content */}
										{isAttachmentsExpanded && (
											<div className='mt-4 pt-3 border-t border-[#edf0f7] space-y-4'>
												{totalCount === 0 ? (
													<p className='text-sm text-[#8e90a6] italic'>No attachments in this conversation.</p>
												) : (
													<>
														{/* Photos / Images */}
														{atts.photos.length > 0 && (
															<div>
																<p className='text-sm font-semibold text-[#8e90a6] uppercase tracking-wider mb-2 flex items-center gap-1.5'>
																	<svg
																		width='15'
																		height='15'
																		viewBox='0 0 24 24'
																		fill='none'
																		stroke='currentColor'
																		strokeWidth='2'
																	>
																		<rect x='3' y='3' width='18' height='18' rx='2' ry='2' />
																		<circle cx='8.5' cy='8.5' r='1.5' />
																		<polyline points='21 15 16 10 5 21' />
																	</svg>
																	Photos ({atts.photos.length})
																</p>
																<div className='grid grid-cols-2 gap-2'>
																	{atts.photos.map((src, idx) => (
																		<img
																			key={idx}
																			src={src}
																			alt={`Photo ${idx + 1}`}
																			className='w-full h-20 object-cover rounded-xl shadow-xs cursor-pointer hover:opacity-90 transition-opacity border border-[#edf0f7]'
																			onClick={() => setActiveImageModal({ src, title: `Photo ${idx + 1}` })}
																		/>
																	))}
																</div>
															</div>
														)}

														{/* Other Files */}
														{atts.otherFiles.length > 0 && (
															<div>
																<p className='text-sm font-semibold text-[#8e90a6] uppercase tracking-wider mb-2 flex items-center gap-1.5'>
																	<svg
																		width='15'
																		height='15'
																		viewBox='0 0 24 24'
																		fill='none'
																		stroke='currentColor'
																		strokeWidth='2'
																	>
																		<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
																		<polyline points='14 2 14 8 20 8' />
																	</svg>
																	Files ({atts.otherFiles.length})
																</p>
																<div className='space-y-1.5'>
																	{atts.otherFiles.map((item, idx) => (
																		<button
																			key={idx}
																			onClick={() =>
																				setActiveAttachmentModal({
																					title: item.name || 'Attachment',
																					type: item.type || 'file',
																					content: item.content,
																				})
																			}
																			className='w-full text-left px-3 py-2 rounded-xl bg-[#f8f9fe] hover:bg-[#7678ed] hover:text-white text-[#202022] transition-colors text-sm font-medium flex items-center justify-between border border-[#e8ebf3] group cursor-pointer'
																		>
																			<span className='truncate'>{item.name || `File ${idx + 1}`}</span>
																		</button>
																	))}
																</div>
															</div>
														)}
													</>
												)}
											</div>
										)}
									</div>
								);
							})()}
						</aside>
					) : null}
				</div>
			</div>
			{/* Create Folder Modal */}
			{isCreatingFolder && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-4'>
							<h3 className='text-lg font-bold'>New Folder</h3>
							<button onClick={() => setIsCreatingFolder(false)} className='text-white/60 hover:text-white p-1 transition-colors'>
								<svg
									width='18'
									height='18'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.2'
									strokeLinecap='round'
									strokeLinejoin='round'
								>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>
						<form onSubmit={handleCreateFolderSubmit} className='space-y-4'>
							<div>
								<label className='block text-xs font-semibold text-white/70 mb-1'>Folder Name</label>
								<input
									type='text'
									autoFocus
									placeholder='e.g. Work, Research, Personal'
									value={newFolderName}
									onChange={(e) => setNewFolderName(e.target.value)}
									className='w-full bg-[#2d2d30] border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-colors'
								/>
							</div>
							<div className='flex items-center justify-end gap-3 pt-2'>
								<button
									type='button'
									onClick={() => setIsCreatingFolder(false)}
									className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors'
								>
									Cancel
								</button>
								<button
									type='submit'
									disabled={!newFolderName.trim()}
									className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30'
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
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-white text-[#202022] rounded-3xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border border-[#e8ebf3] animate-in fade-in zoom-in duration-200'>
						{/* Modal Header */}
						<div className='flex items-center justify-between pb-4 border-b border-[#eef0f6] shrink-0 mb-4 select-text'>
							<div className='flex items-center gap-2.5'>
								<div className='w-9 h-9 rounded-2xl bg-[#f0f2f9] text-[#7678ed] flex items-center justify-center font-bold shrink-0 shadow-xs'>
									{activeAttachmentModal.type === 'thought' ? <BrainIcon className='w-5 h-5' /> : <MetadataIcon className='w-5 h-5' />}
								</div>
								<h3 className='text-xl font-bold text-[#202022] tracking-tight'>{activeAttachmentModal.title}</h3>
							</div>
							<button
								onClick={() => setActiveAttachmentModal(null)}
								className='p-1.5 text-[#8e90a6] hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors cursor-pointer'
								title='Close'
							>
								<svg
									width='20'
									height='20'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.2'
									strokeLinecap='round'
									strokeLinejoin='round'
								>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>

						{/* Modal Content (Parsed HTML Markdown) */}
						<div className='flex-1 overflow-y-auto pr-2 space-y-3 text-base text-[#202022] leading-relaxed select-text'>
							{renderMarkdownText(activeAttachmentModal.content)}
						</div>

						{/* Modal Footer */}
						<div className='pt-4 mt-4 border-t border-[#eef0f6] flex items-center justify-end shrink-0 select-text'>
							<button
								onClick={() => setActiveAttachmentModal(null)}
								className='px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white font-semibold rounded-2xl transition-all text-base shadow-sm cursor-pointer'
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
					className='fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-8 animate-in fade-in duration-200'
					onClick={() => setActiveImageModal(null)}
				>
					<div className='relative max-w-[92vw] max-h-[92vh] flex flex-col items-center justify-center' onClick={(e) => e.stopPropagation()}>
						{/* Close button */}
						<button
							onClick={() => setActiveImageModal(null)}
							className='absolute -top-12 right-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all cursor-pointer shadow-md'
							title='Close'
						>
							<svg
								width='22'
								height='22'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2.5'
								strokeLinecap='round'
								strokeLinejoin='round'
							>
								<line x1='18' y1='6' x2='6' y2='18' />
								<line x1='6' y1='6' x2='18' y2='18' />
							</svg>
						</button>

						{/* Image */}
						<img
							src={activeImageModal.src}
							alt={activeImageModal.title || 'Full size view'}
							className='max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20 select-text'
						/>
						{activeImageModal.title && (
							<p className='text-white/80 text-sm font-medium mt-3 px-4 py-1 bg-black/50 rounded-full backdrop-blur-xs'>
								{activeImageModal.title}
							</p>
						)}
					</div>
				</div>
			)}
			{/* Custom Rename Chat Modal */}
			{isRenameModalOpen && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-4'>
							<h3 className='text-lg font-bold'>Rename Chat</h3>
							<button onClick={() => setIsRenameModalOpen(false)} className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'>
								<svg
									width='18'
									height='18'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.2'
									strokeLinecap='round'
									strokeLinejoin='round'
								>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>
						<form onSubmit={handleConfirmRenameChat} className='space-y-4'>
							<div>
								<label className='block text-xs font-semibold text-white/70 mb-1'>Chat Name</label>
								<input
									type='text'
									autoFocus
									placeholder='Enter chat name'
									value={renameInputVal}
									onChange={(e) => setRenameInputVal(e.target.value)}
									className='w-full bg-[#2d2d30] border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-colors font-medium'
								/>
							</div>
							<div className='flex items-center justify-end gap-3 pt-2'>
								<button
									type='button'
									onClick={() => setIsRenameModalOpen(false)}
									className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
								>
									Cancel
								</button>
								<button
									type='submit'
									disabled={!renameInputVal.trim()}
									className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer'
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
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-2'>
							<h3 className='text-lg font-bold text-[#ff4d4f]'>Delete Conversation?</h3>
							<button onClick={() => setIsDeleteModalOpen(false)} className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'>
								<svg
									width='18'
									height='18'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.2'
									strokeLinecap='round'
									strokeLinejoin='round'
								>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>
						<p className='text-sm text-white/70 leading-relaxed mb-6'>
							Are you sure you want to delete this conversation? All messages and attachments in this chat will be permanently removed.
						</p>
						<div className='flex items-center justify-end gap-3'>
							<button
								type='button'
								onClick={() => setIsDeleteModalOpen(false)}
								className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleConfirmDeleteChat}
								className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#ff4d4f] hover:bg-[#e04345] text-white transition-all shadow-md shadow-[#ff4d4f]/30 cursor-pointer'
							>
								Delete Chat
							</button>
						</div>
					</div>
				</div>
			)}
			{/* Custom New Chat Modal */}
			{isNewChatModalOpen && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-4'>
							<h3 className='text-lg font-bold'>New Chat</h3>
							<button
								onClick={() => setIsNewChatModalOpen(false)}
								className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'
							>
								<svg
									width='18'
									height='18'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.2'
									strokeLinecap='round'
									strokeLinejoin='round'
								>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>
						<form onSubmit={handleConfirmCreateNewChat} className='space-y-4'>
							<div>
								<label className='block text-xs font-semibold text-white/70 mb-1'>Chat Title</label>
								<input
									type='text'
									autoFocus
									placeholder='Enter chat title'
									value={newChatTitleInput}
									onChange={(e) => setNewChatTitleInput(e.target.value)}
									className='w-full bg-[#2d2d30] border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-colors font-medium'
								/>
							</div>
							<div className='flex items-center justify-end gap-3 pt-2'>
								<button
									type='button'
									onClick={() => setIsNewChatModalOpen(false)}
									className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
								>
									Cancel
								</button>
								<button
									type='submit'
									disabled={!newChatTitleInput.trim()}
									className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer'
								>
									Create Chat
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</main>
  );
}
