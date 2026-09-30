"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

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

const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const getModelAvatarPicture = (pref?: ModelPreference | null, mod?: any): string | undefined => {
  const rawPic =
    pref?.picture ||
    pref?.character?.data?.avatar ||
    pref?.character?.avatar ||
    mod?.picture ||
    mod?.avatar ||
    mod?.senderAvatar;
  return formatAvatarPicture(rawPic);
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

  // Zustand Store Integration for long-lived data caching
  const {
    instances,
    modelPreferences,
    fetchInstances,
    fetchModelPreferences,
    fetchInstanceModels,
    setInstances: setStoreInstances,
    setModelPreference: setStoreModelPreference,
    removeModelPreference: storeRemoveModelPreference,
  } = useAppStore();

  const [activeAttachmentModal, setActiveAttachmentModal] = useState<{ title: string; type: string; content: string } | null>(null);
  const [activeImageModal, setActiveImageModal] = useState<{ src: string; title?: string } | null>(null);
  const [isChatContextMenuOpen, setIsChatContextMenuOpen] = useState<boolean>(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [renameInputVal, setRenameInputVal] = useState<string>("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);
  const [editingModel, setEditingModel] = useState<any | null>(null);
  const [editModelVoice, setEditModelVoice] = useState<string>("af_heart");
  const [editModelNumCtx, setEditModelNumCtx] = useState<number>(8192);
  const [editModelName, setEditModelName] = useState<string>("");
  const [editModelDescription, setEditModelDescription] = useState<string>("");
  const [editModelFirstMessage, setEditModelFirstMessage] = useState<string>("");
  const [editModelAlternateGreetings, setEditModelAlternateGreetings] = useState<string[]>([]);
  const [editModelCharacterBook, setEditModelCharacterBook] = useState<
    Array<{ name: string; description: string; tags: string }>
  >([]);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState<boolean>(false);
  const [newChatTitleInput, setNewChatTitleInput] = useState<string>("New Chat");
  const [currentView, setCurrentView] = useState<"chat" | "settings">("chat");
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<
    "import-chat" | "manage-instances" | "preferences" | "about-walpaca"
  >("import-chat");

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

  // Inline Message Editing States & Handlers
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgContent, setEditingMsgContent] = useState<string>("");
  const [deletingMsg, setDeletingMsg] = useState<Message | null>(null);

  const handleStartInlineEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditingMsgContent(msg.content);
  };

  const handleSaveInlineEdit = async () => {
    if (!editingMsgId) return;
    const updatedContent = editingMsgContent.trim();
    const msgId = editingMsgId;

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, content: updatedContent } : m))
    );
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
    const targetChat = chatItems.find((c) => c.id === activeChatId);
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
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/?chat=${newId}`);
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
    const rawId = String(mod.id || '');
    const prefKey = rawId.toLowerCase();
    const pref = modelPreferences[rawId] || modelPreferences[prefKey];
    setEditModelVoice(pref?.voice || mod.voice || 'af_heart');
    setEditModelNumCtx(
      pref?.num_ctx ??
        (typeof mod.num_ctx === 'number'
          ? mod.num_ctx
          : mod.context
          ? parseInt(String(mod.context).replace(/,/g, ''), 10) || 8192
          : 8192)
    );

    const char = pref?.character || {};
    const charData = char.data || char || {};

    setEditModelName(getCharacterName(char) || (pref as any)?.name || mod.name || mod.id || '');
    setEditModelDescription(charData.description || pref?.description || '');
    setEditModelFirstMessage(charData.first_mes || charData.first_message || pref?.first_message || '');

    const greetings = Array.isArray(charData.alternate_greetings)
      ? charData.alternate_greetings
      : Array.isArray(pref?.alternate_greetings)
      ? pref.alternate_greetings
      : [];
    setEditModelAlternateGreetings(greetings);

    let cbItems: Array<{ name: string; description: string; tags: string }> = [];
    if (Array.isArray(charData.character_book?.entries)) {
      cbItems = charData.character_book.entries.map((e: any) => ({
        name: e.comment || e.name || '',
        description: e.content || e.description || '',
        tags: Array.isArray(e.keys)
          ? e.keys.join(', ')
          : Array.isArray(e.tags)
          ? e.tags.join(', ')
          : String(e.keys || e.tags || ''),
      }));
    } else if (Array.isArray(charData.character_book)) {
      cbItems = charData.character_book.map((e: any) => ({
        name: e.name || e.comment || '',
        description: e.description || e.content || '',
        tags: Array.isArray(e.tags)
          ? e.tags.join(', ')
          : Array.isArray(e.keys)
          ? e.keys.join(', ')
          : String(e.tags || e.keys || ''),
      }));
    }
    setEditModelCharacterBook(cbItems);
    setInstanceSubView("edit-model");
  };

  const handleAddGreeting = () => {
    setEditModelAlternateGreetings([...editModelAlternateGreetings, '']);
  };

  const handleUpdateGreeting = (index: number, val: string) => {
    setEditModelAlternateGreetings(editModelAlternateGreetings.map((g, i) => (i === index ? val : g)));
  };

  const handleRemoveGreeting = (index: number) => {
    setEditModelAlternateGreetings(editModelAlternateGreetings.filter((_, i) => i !== index));
  };

  const handleAddBookItem = () => {
    setEditModelCharacterBook([...editModelCharacterBook, { name: '', description: '', tags: '' }]);
  };

  const handleUpdateBookItem = (index: number, field: 'name' | 'description' | 'tags', val: string) => {
    setEditModelCharacterBook(
      editModelCharacterBook.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleRemoveBookItem = (index: number) => {
    setEditModelCharacterBook(editModelCharacterBook.filter((_, i) => i !== index));
  };

  const handleSaveEditModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel) return;

    const rawId = String(editingModel.id || '');
    const prefKey = rawId.toLowerCase();

    const filteredGreetings = editModelAlternateGreetings.map((g) => g.trim()).filter(Boolean);
    const formattedBookEntries = editModelCharacterBook.map((item) => {
      const tagsArr = item.tags.split(',').map((t) => t.trim()).filter(Boolean);
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
  const [instFormTemp, setInstFormTemp] = useState<number>(0.70);
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
      defaultUrl = "https://generativelanguage.googleapis.com";
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
    setInstFormTemp(0.70);
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
        : inst.type
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
    setInstFormTemp(inst.properties?.temperature ?? 0.70);
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
        instances.map((inst) =>
          inst.id === editingInstanceId ? { ...inst, type: backendType, properties: { ...inst.properties, ...payload.properties } } : inst
        )
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
        const rawMsgs = Array.isArray(data.messages) ? data.messages : [];
        setMessages(rawMsgs.map((m) => mapBackendMsgToMessage(m, modelPreferences)));
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
      setMessages([]);
      fetchChatMessages(activeChatId);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.get("chat") !== activeChatId) {
          url.searchParams.set("chat", activeChatId);
          window.history.pushState({}, "", url.toString());
        }
      }
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  useEffect(() => {
    if (activeChatId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, activeChatId]);

  // Requirement 1: Auto-select Instance if only 1 exists or unselected
  useEffect(() => {
    if (instances.length > 0) {
      if (instances.length === 1 || !selectedChatInstanceId) {
        const defaultInstId = instances[0].id;
        setSelectedChatInstanceId(defaultInstId);
        fetchModelsForInstance(defaultInstId);
      }
    }
  }, [instances]);

  // Requirement 2: Auto-select Model/Preference if only 1 exists or unselected
  useEffect(() => {
    const prefs = Array.from(new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values());
    const options = [...prefs.map((p) => p.id), ...instanceModelsList.map((m) => m.id)];
    if (options.length === 1 || (!selectedChatModelId && options.length > 0)) {
      setSelectedChatModelId(options[0]);
    }
  }, [instanceModelsList, modelPreferences, selectedChatInstanceId]);

  // Requirement 3: Auto-select Instance & Model based on last assistant message in active chat
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const lastAssistantMsg = [...messages].reverse().find(
      (m) => !m.isSelf && (m.senderRole === "assistant" || m.senderName !== "You" || m.model)
    );

    if (lastAssistantMsg) {
      const targetModelIdentifier = String(lastAssistantMsg.model || lastAssistantMsg.senderName || "").trim();
      if (targetModelIdentifier) {
        const prefsList = Array.from(
          new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values()
        );
        const matchingPref = prefsList.find(
          (p) =>
            p.id.toLowerCase() === targetModelIdentifier.toLowerCase() ||
            (getCharacterName(p.character) && getCharacterName(p.character)?.toLowerCase() === targetModelIdentifier.toLowerCase())
        );

        if (matchingPref) {
          setSelectedChatModelId(matchingPref.id);
        } else {
          const matchingMod = instanceModelsList.find(
            (m) =>
              String(m.id || "").toLowerCase() === targetModelIdentifier.toLowerCase() ||
              String(m.name || "").toLowerCase() === targetModelIdentifier.toLowerCase()
          );
          if (matchingMod) {
            setSelectedChatModelId(matchingMod.id);
          }
        }

        if ((lastAssistantMsg as any).instanceId) {
          const matchingInst = instances.find((inst) => inst.id === (lastAssistantMsg as any).instanceId);
          if (matchingInst) {
            setSelectedChatInstanceId(matchingInst.id);
            fetchModelsForInstance(matchingInst.id);
          }
        }
      }
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
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      senderName: "You",
      senderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
      isSelf: true,
      content,
      time: nowStr,
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
      modelPreferences[selectedChatModelId] ||
      modelPreferences[selectedPrefKey] ||
      Object.values(modelPreferences).find((p) => p.id.toLowerCase() === selectedPrefKey);

    let assistantName = "Assistant";
    let assistantAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80";
    let systemPrompt = "";

    if (selectedPref) {
      const char = selectedPref.character || {};
      const charData = char.data || char || {};
      assistantName = getCharacterName(char) || (selectedPref as any).name || selectedPref.id;
      if (selectedPref.picture) {
        assistantAvatar = formatAvatarPicture(selectedPref.picture) || assistantAvatar;
      }
      systemPrompt =
        charData.system_prompt ||
        charData.personality ||
        charData.description ||
        selectedPref.description ||
        "";
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
    const genUrl = activeChatId ? `${API_URL}/chats/${activeChatId}/generate` : `${API_URL}/generate`;

    try {
      const genRes = await fetch(genUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedChatModelId,
          instance_id: selectedChatInstanceId,
          system: systemPrompt || undefined,
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
              if (parsed.id) {
                const serverId = parsed.id;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, id: serverId } : m))
                );
              }
              if (parsed.thinking) {
                const thinkChunk = parsed.thinking;
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id === assistantMsgId || m.id === parsed.id) {
                      const existingAtts = m.attachments || [];
                      const thoughtIdx = existingAtts.findIndex(
                        (a) => a.type?.toLowerCase() === "thought" || a.type?.toLowerCase() === "brain"
                      );
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
                  })
                );
              }
              if (parsed.metadata) {
                const metaContent = parsed.metadata;
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id === assistantMsgId || m.id === parsed.id) {
                      const existingAtts = m.attachments || [];
                      const metaIdx = existingAtts.findIndex(
                        (a) => a.type?.toLowerCase() === "metadata" || a.type?.toLowerCase() === "data"
                      );
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
                  })
                );
              }
              if (parsed.content) {
                fullResponseText += parsed.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId || m.id === parsed.id ? { ...m, content: m.content + parsed.content } : m))
                );
              }
            } catch {
              if (dataStr && !dataStr.startsWith("{")) {
                fullResponseText += dataStr;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + dataStr } : m))
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Error during LLM response generation:", err);
    }
  };

  const handleUseCharacterFirstMes = async () => {
    if (!activeChatId || !selectedChatModelId) return;
    const prefKey = selectedChatModelId.toLowerCase();
    const pref =
      modelPreferences[selectedChatModelId] ||
      modelPreferences[prefKey] ||
      Object.values(modelPreferences).find((p) => p.id.toLowerCase() === prefKey);

    if (!pref) return;
    const char = pref.character || {};
    const charData = char.data || char || {};
    const firstMes = (charData.first_mes || charData.first_message || pref.first_message || '').trim();

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

  return (
		<main className='topo-bg min-h-screen w-screen flex justify-center font-sans antialiased text-[#202022] box-border'>
			{/* Outer Floating Application Window */}
			<div className='w-full min-w-[90vw] h-[calc(100vh-0px)] md:h-[calc(100vh-0px)] lg:h-100vh-0px)] bg-[#202022] flex overflow-hidden border-8 border-[#202022]'>
				{/* ========================================================= */}
				{/* 1. SLIM LEFT NAVIGATION RAIL (#202022) */}
				{/* ========================================================= */}
				<aside className='w-[100px] bg-[#202022] flex flex-col items-center justify-between py-6 px-2 select-none shrink-0 border-r border-[#2d2d30]'>
					{/* Top Alpaca Prism Logo */}
					<div className='flex flex-col items-center gap-8 w-full'>
						<div onClick={() => setCurrentView("chat")} className='w-12 h-12 flex items-center justify-center text-white cursor-pointer hover:opacity-85 transition-opacity'>
							<img src='/icon-white.svg' alt='Walpaca' className='w-9 h-9 object-contain' />
						</div>

						{/* Navigation Tabs (Backend Folders API Integrated) */}
						<nav className='flex flex-col items-center gap-3 w-full overflow-y-auto max-h-[calc(100vh-220px)] px-1'>
							{/* All chats tab */}
							<button
								onClick={() => { setActiveTab('all'); setCurrentView('chat'); }}
								className={`w-full py-3 px-1 rounded-2xl flex flex-col items-center gap-1.5 transition-all relative cursor-pointer ${
									activeTab === 'all' && currentView === 'chat' ? 'bg-[#2e2f33] text-white shadow-inner' : 'text-[#8b8d97] hover:text-white'
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
								const isActive = activeTab === folder.id && currentView === 'chat';
								return (
									<button
										key={folder.id}
										onClick={() => { setActiveTab(folder.id); setCurrentView('chat'); }}
										className={`w-full py-3 px-1 rounded-2xl flex flex-col items-center gap-1.5 transition-all relative cursor-pointer ${
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
					<button
						onClick={() => setCurrentView('settings')}
						className={`w-full py-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
							currentView === 'settings' ? 'bg-[#2e2f33] text-white shadow-inner' : 'text-[#8b8d97] hover:text-white'
						}`}
						title='Settings'
					>
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
					{currentView === 'settings' ? (
						<div className='flex-1 flex h-full overflow-hidden bg-[#f9fafc] select-text'>
							{/* 1. SETTINGS CATEGORIES SIDEBAR */}
							<aside className='w-[260px] border-r border-[#e8ebf3] bg-[#f9fafc] p-5 flex flex-col justify-between shrink-0 select-none'>
								<div>
									<h2 className='text-xl font-bold text-[#202022] mb-6 px-2 tracking-tight'>Settings</h2>
									<nav className='space-y-1.5'>
										{[
											{
												id: 'import-chat',
												label: 'Import Chat',
												icon: (
													<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
														<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
														<polyline points='17 8 12 3 7 8' />
														<line x1='12' y1='3' x2='12' y2='15' />
													</svg>
												),
											},
											{
												id: 'manage-instances',
												label: 'Manage Instances',
												icon: (
													<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
														<rect x='2' y='2' width='20' height='8' rx='2' ry='2' />
														<rect x='2' y='14' width='20' height='8' rx='2' ry='2' />
														<line x1='6' y1='6' x2='6.01' y2='6' />
														<line x1='6' y1='18' x2='6.01' y2='18' />
													</svg>
												),
											},
											{
												id: 'preferences',
												label: 'Preferences',
												icon: (
													<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
														<line x1='4' y1='21' x2='4' y2='14' />
														<line x1='4' y1='10' x2='4' y2='3' />
														<line x1='12' y1='21' x2='12' y2='12' />
														<line x1='12' y1='8' x2='12' y2='3' />
														<line x1='20' y1='21' x2='20' y2='16' />
														<line x1='20' y1='12' x2='20' y2='3' />
														<line x1='1' y1='14' x2='7' y2='14' />
														<line x1='9' y1='8' x2='15' y2='8' />
														<line x1='17' y1='16' x2='23' y2='16' />
													</svg>
												),
											},
											{
												id: 'about-walpaca',
												label: 'About Walpaca',
												icon: (
													<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
														<circle cx='12' cy='12' r='10' />
														<line x1='12' y1='16' x2='12' y2='12' />
														<line x1='12' y1='8' x2='12.01' y2='8' />
													</svg>
												),
											},
										].map((cat) => {
											const isActive = activeSettingsCategory === cat.id;
											return (
												<button
													key={cat.id}
													onClick={() => setActiveSettingsCategory(cat.id as any)}
													className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-base font-semibold transition-all cursor-pointer ${
														isActive
															? 'bg-[#7678ed] text-white shadow-md shadow-[#7678ed]/20'
															: 'text-[#5d6075] hover:bg-[#ebedf7] hover:text-[#202022]'
													}`}
												>
													<span className={isActive ? 'text-white' : 'text-[#7678ed]'}>{cat.icon}</span>
													<span className='truncate'>{cat.label}</span>
												</button>
											);
										})}
									</nav>
								</div>

								<button
									onClick={() => setCurrentView('chat')}
									className='w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] font-semibold text-sm transition-all cursor-pointer shadow-xs'
								>
									<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
										<line x1='19' y1='12' x2='5' y2='12' />
										<polyline points='12 19 5 12 12 5' />
									</svg>
									Back to Chat
								</button>
							</aside>

							{/* 2. MIDDLE SETTINGS CONTENT AREA */}
							<main className='flex-1 bg-white p-8 overflow-y-auto'>
								<div className='max-w-3xl mx-auto space-y-8'>
									{activeSettingsCategory === 'import-chat' && (
										<div className='space-y-6 animate-in fade-in duration-200'>
											<div>
												<h3 className='text-2xl font-bold text-[#202022]'>Import Chat</h3>
												<p className='text-sm text-[#7a7d90] mt-1'>Import conversation logs, JSON backups, or zip archives from other LLM providers.</p>
											</div>

											<div className='border-2 border-dashed border-[#7678ed]/40 hover:border-[#7678ed] rounded-3xl p-10 bg-[#f9fafc] hover:bg-[#f3f4fd] transition-all flex flex-col items-center justify-center text-center cursor-pointer group'>
												<div className='w-16 h-16 rounded-2xl bg-[#eaecf9] group-hover:bg-[#7678ed] group-hover:text-white text-[#7678ed] flex items-center justify-center mb-4 transition-colors shadow-sm'>
													<svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
														<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
														<polyline points='17 8 12 3 7 8' />
														<line x1='12' y1='3' x2='12' y2='15' />
													</svg>
												</div>
												<h4 className='text-base font-bold text-[#202022] mb-1'>Drop chat export files here</h4>
												<p className='text-sm text-[#8e90a6] mb-4'>Supports ChatGPT export (.json), Claude export (.json), and Walpaca backup (.zip)</p>
												<button className='px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-sm font-semibold rounded-2xl transition-all shadow-sm cursor-pointer'>
													Browse Files
												</button>
											</div>

											<div className='bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl p-5 space-y-3'>
												<h5 className='text-sm font-bold text-[#202022]'>Import Preferences</h5>
												<div className='space-y-2.5 text-sm text-[#404252]'>
													<label className='flex items-center gap-3 cursor-pointer'>
														<input type='checkbox' defaultChecked className='w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed]' />
														<span>Merge imported conversations into existing folders</span>
													</label>
													<label className='flex items-center gap-3 cursor-pointer'>
														<input type='checkbox' defaultChecked className='w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed]' />
														<span>Auto-detect custom model avatars and names</span>
													</label>
													<label className='flex items-center gap-3 cursor-pointer'>
														<input type='checkbox' className='w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed]' />
														<span>Index imported message text for local semantic search</span>
													</label>
												</div>
											</div>
										</div>
									)}

									{activeSettingsCategory === 'manage-instances' && (
										<div>
											{/* View 1: Configured Instances List */}
											{instanceSubView === 'list' && (
												<div className='space-y-6 animate-in fade-in duration-200'>
													<div className='flex items-center justify-between'>
														<div>
															<h3 className='text-2xl font-bold text-[#202022]'>Manage Instances</h3>
															<p className='text-sm text-[#7a7d90] mt-1'>Configure local server connections, cloud API backends, and proxy endpoints.</p>
														</div>
														<button
															onClick={handleOpenAddInstanceModal}
															className='p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer'
															title='Add Instance'
														>
															<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
																<line x1='12' y1='5' x2='12' y2='19' />
																<line x1='6' y1='12' x2='18' y2='12' />
															</svg>
														</button>
													</div>

													{instances.length === 0 ? (
														<div className='p-8 rounded-2xl border border-dashed border-[#7678ed]/30 bg-[#f9fafc] text-center space-y-3'>
															<div className='w-12 h-12 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-xl mx-auto'>
																⚡
															</div>
															<p className='text-base font-bold text-[#202022]'>No Instances Configured</p>
															<p className='text-xs text-[#8e90a6] max-w-sm mx-auto'>
																Click "Add Instance" above to connect an Ollama local or remote server to Alpaca.
															</p>
															<button
																onClick={handleOpenAddInstanceModal}
																className='px-4 py-2 bg-[#7678ed] text-white text-xs font-semibold rounded-xl hover:bg-[#6869d9] transition-all cursor-pointer'
															>
																+ Add First Instance
															</button>
														</div>
													) : (
														<div className='space-y-3.5'>
															{instances.map((inst) => {
																const name = inst.properties?.name || "Instance";
																const url = inst.properties?.url || "http://0.0.0.0:11434";
																const typeLabel = inst.type === "ollama" ? "Ollama (External)" : inst.type;

																return (
																	<div key={inst.id} className='p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc] flex items-center justify-between hover:border-[#7678ed]/40 transition-all'>
																		<div className='flex items-center gap-3.5'>
																			<div className='w-10 h-10 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-base shrink-0'>
																				⚡
																			</div>
																			<div>
																				<div className='flex items-center gap-2'>
																					<h4 className='text-base font-bold text-[#202022]'>{name}</h4>
																					<span className='px-2 py-0.5 bg-[#eaecf9] text-[#7678ed] rounded-md text-[10px] font-bold uppercase tracking-wider'>
																						{typeLabel}
																					</span>
																				</div>
																				<p className='text-xs text-[#8e90a6] font-mono'>{url}</p>
																			</div>
																		</div>

																		<div className='flex items-center gap-1.5'>
																			<button
																				onClick={() => handleManageInstanceModels(inst)}
																				className='p-2 text-[#7678ed] hover:bg-[#eaecf9] rounded-2xl transition-colors cursor-pointer'
																				title='Manage Models'
																			>
																				<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																					<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
																					<circle cx='9' cy='7' r='4' />
																					<path d='M22 21v-2a4 4 0 0 0-3-3.87' />
																					<path d='M16 3.13a4 4 0 0 1 0 7.75' />
																				</svg>
																			</button>
																			<button
																				onClick={() => handleOpenEditInstanceModal(inst)}
																				className='p-2 text-[#7678ed] hover:bg-[#eaecf9] rounded-2xl transition-colors cursor-pointer'
																				title='Edit Instance'
																			>
																				<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																					<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																				</svg>
																			</button>
																			<button
																				onClick={() => handleDeleteInstance(inst.id)}
																				className='p-2 text-[#ff4d4f] hover:bg-[#fff0f0] rounded-2xl transition-colors cursor-pointer'
																				title='Delete Instance'
																			>
																				<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																					<polyline points='3 6 5 6 21 6' />
																					<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
																				</svg>
																			</button>
																		</div>
																	</div>
																);
															})}
														</div>
													)}
												</div>
											)}

											{/* View 2: Step 1 Provider Selection Full-Page View */}
											{instanceSubView === 'select-type' && (
												<div className='space-y-6 animate-in fade-in duration-200 select-none'>
													<div className='flex items-center gap-3'>
														<button
															onClick={() => setInstanceSubView('list')}
															className='p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer'
															title='Back to Instances'
														>
															<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
																<line x1='19' y1='12' x2='5' y2='12' />
																<polyline points='12 19 5 12 12 5' />
															</svg>
														</button>
														<div>
															<h3 className='text-2xl font-bold text-[#202022]'>Add Instance</h3>
															<p className='text-sm text-[#7a7d90] mt-0.5'>Select a type of instance to add to your workspace</p>
														</div>
													</div>

													<div className='grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2'>
														{[
															{ label: "Ollama", tag: "Local / Remote", desc: "Local or remote AI instance not managed by Walpaca", icon: "🦙" },
															{ label: "Ollama (Cloud)", tag: "Cloud API", desc: "Ollama server hosted on cloud infrastructure", icon: "☁️" },
															{ label: "OpenAI ChatGPT", tag: "Cloud API", desc: "Official OpenAI GPT-4o & ChatGPT API endpoint", icon: "🌐" },
															{ label: "Google Gemini", tag: "Cloud API", desc: "Google Gemini Flash & Pro API model suite", icon: "✨" },
															{ label: "Together AI", tag: "Cloud API", desc: "Together AI open-source model cloud platform", icon: "🤝" },
															{ label: "Venice", tag: "Cloud API", desc: "Venice private uncensored inference network", icon: "🔒" },
															{ label: "Deepseek", tag: "Cloud API", desc: "Deepseek Coder & Reasoner LLM endpoints", icon: "🧠" },
															{ label: "Groq Cloud", tag: "Cloud API", desc: "Groq ultra-fast LPU inference engine", icon: "🚀" },
															{ label: "Anthropic", tag: "Cloud API", desc: "Anthropic Claude 3.5 Sonnet & Haiku API", icon: "🎭" },
															{ label: "OpenRouter AI", tag: "Cloud API", desc: "OpenRouter unified multi-provider routing API", icon: "🔀" },
														].map((provider) => (
															<div
																key={provider.label}
																onClick={() => handleSelectInstanceType(provider.label)}
																className='p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc] hover:bg-[#f2f4fa] hover:border-[#7678ed] transition-all cursor-pointer flex items-start gap-3.5 group shadow-xs'
															>
																<div className='w-11 h-11 rounded-2xl bg-[#eaecf9] group-hover:bg-[#7678ed] group-hover:text-white text-[#7678ed] flex items-center justify-center font-bold text-lg shrink-0 transition-colors'>
																	{provider.icon}
																</div>
																<div className='flex-1 min-w-0'>
																	<div className='flex items-center justify-between gap-2 mb-1'>
																		<h4 className='text-base font-bold text-[#202022] group-hover:text-[#7678ed] transition-colors truncate'>
																			{provider.label}
																		</h4>
																		<span className='px-2 py-0.5 bg-[#eaecf9] text-[#7678ed] rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0'>
																			{provider.tag}
																		</span>
																	</div>
																	<p className='text-xs text-[#7a7d90] line-clamp-2 leading-relaxed'>{provider.desc}</p>
																</div>
															</div>
														))}
													</div>
												</div>
											)}

											{/* View 3: Step 2 Instance Configuration Full-Page View */}
											{instanceSubView === 'form' && (
												<div className='space-y-6 animate-in fade-in duration-200 select-text'>
													{/* Action Header Bar */}
													<div className='flex items-center justify-between pb-4 border-b border-[#e8ebf3] shrink-0'>
														<div className='flex items-center gap-3'>
															<button
																type='button'
																onClick={() => setInstanceSubView(editingInstanceId ? 'list' : 'select-type')}
																className='p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer'
																title='Back'
															>
																<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
																	<line x1='19' y1='12' x2='5' y2='12' />
																	<polyline points='12 19 5 12 12 5' />
																</svg>
															</button>
															<div>
																<div className='flex items-center gap-2'>
																	<h3 className='text-2xl font-bold text-[#202022]'>
																		{editingInstanceId ? 'Edit Instance' : 'Create Instance'}
																	</h3>
																	<span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
																		editingInstanceId ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-[#eaecf9] text-[#7678ed]'
																	} flex items-center gap-1.5`}>
																		{editingInstanceId && (
																			<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
																				<rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
																				<path d='M7 11V7a5 5 0 0 1 10 0v4' />
																			</svg>
																		)}
																		{selectedInstanceType}
																	</span>
																</div>
																<p className='text-sm text-[#7a7d90] mt-0.5'>
																	{editingInstanceId
																		? 'LLM server type cannot be changed when editing an existing instance'
																		: 'Local or remote AI instance not managed by Alpaca'}
																</p>
															</div>
														</div>

														<div className='flex items-center gap-2'>
															<button
																type='button'
																onClick={() => setInstanceSubView(editingInstanceId ? 'list' : 'select-type')}
																className='p-2.5 rounded-2xl border border-[#e8ebf3] hover:bg-[#f4f6fc] text-[#5d6075] transition-all cursor-pointer flex items-center justify-center'
																title='Cancel'
															>
																<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
																	<line x1='18' y1='6' x2='6' y2='18' />
																	<line x1='6' y1='6' x2='18' y2='18' />
																</svg>
															</button>
															<button
																type='button'
																onClick={handleSaveInstanceForm}
																className='p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-md shadow-[#7678ed]/20 cursor-pointer flex items-center justify-center'
																title='Save Instance'
															>
																<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
																	<polyline points='20 6 9 17 4 12' />
																</svg>
															</button>
														</div>
													</div>

													{/* Dynamic Form Body */}
													{(() => {
														const isOllamaProvider = selectedInstanceType.startsWith("Ollama");
														return (
															<form onSubmit={handleSaveInstanceForm} className='space-y-6 text-sm max-w-3xl'>
																{/* Card 1: Basic Information */}
																<div className='bg-[#f9fafc] border border-[#e8ebf3] rounded-3xl p-6 space-y-5 shadow-xs'>
																	<h4 className='font-bold text-base text-[#202022] border-b border-[#e8ebf3] pb-3 flex items-center justify-between'>
																		<span>Basic Configuration</span>
																		<span className='text-xs font-semibold px-2.5 py-1 rounded-full bg-[#eaecf9] text-[#7678ed]'>
																			{isOllamaProvider ? "Ollama Server" : "Cloud Provider API"}
																		</span>
																	</h4>

																	{/* Name Field */}
																	<div>
																		<div className='flex items-center justify-between text-xs text-[#7a7d90] mb-1.5'>
																			<label className='font-semibold text-[#202022]'>Name</label>
																			<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																				<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																			</svg>
																		</div>
																		<input
																			type='text'
																			value={instFormName}
																			onChange={(e) => setInstFormName(e.target.value)}
																			className='w-full bg-white border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm font-medium text-[#202022] outline-none focus:border-[#7678ed] transition-colors shadow-xs'
																			placeholder='Instance Name (e.g. Phanteks)'
																		/>
																	</div>

																	{/* API Key Field */}
																	<div>
																		<div className='flex items-center justify-between text-xs text-[#7a7d90] mb-1.5'>
																			<div className='flex items-center gap-1.5'>
																				<label className='font-semibold text-[#202022]'>
																					{isOllamaProvider ? "API Key (Optional)" : "API Key"}
																				</label>
																				{!isOllamaProvider && (
																					<span className='text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider'>
																						Required
																					</span>
																				)}
																			</div>
																			<div className='flex items-center gap-2'>
																				<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																					<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																				</svg>
																				<button
																					type='button'
																					onClick={() => setShowApiKeyText(!showApiKeyText)}
																					className='text-[#7a7d90] hover:text-[#202022] transition-colors cursor-pointer'
																				>
																					<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																						<path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
																						<circle cx='12' cy='12' r='3' />
																					</svg>
																				</button>
																			</div>
																		</div>
																		<input
																			type={showApiKeyText ? "text" : "password"}
																			value={instFormApiKey}
																			onChange={(e) => setInstFormApiKey(e.target.value)}
																			className='w-full bg-white border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm font-medium text-[#202022] outline-none focus:border-[#7678ed] transition-colors font-mono shadow-xs'
																			placeholder={isOllamaProvider ? "Optional API Key" : "Enter Provider API Key"}
																		/>
																	</div>

																	{/* URL / Endpoint Field */}
																	<div>
																		<div className='flex items-center justify-between text-xs text-[#7a7d90] mb-1.5'>
																			<label className='font-semibold text-[#202022]'>
																				{isOllamaProvider ? "Instance URL" : "API Base URL (Endpoint Override)"}
																			</label>
																			<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																				<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																			</svg>
																		</div>
																		<input
																			type='text'
																			value={instFormUrl}
																			onChange={(e) => setInstFormUrl(e.target.value)}
																			className='w-full bg-white border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm font-medium text-[#202022] outline-none focus:border-[#7678ed] transition-colors font-mono shadow-xs'
																			placeholder={isOllamaProvider ? "http://0.0.0.0:11434" : "https://api.provider.com/v1"}
																		/>
																	</div>
																</div>

																{/* Card 2: Feature Toggles */}
																<div className='bg-[#f9fafc] border border-[#e8ebf3] rounded-3xl p-6 space-y-5 shadow-xs'>
																	<h4 className='font-bold text-base text-[#202022] border-b border-[#e8ebf3] pb-3'>Behavior & Security Toggles</h4>

																	{/* Thought Processing Toggle */}
																	<div className='flex items-center justify-between gap-4'>
																		<div>
																			<h5 className='font-bold text-[#202022] text-sm'>Thought Processing</h5>
																			<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>Have compatible reasoning models think about their response before generating a message</p>
																		</div>
																		<label className='relative inline-flex items-center cursor-pointer shrink-0'>
																			<input
																				type='checkbox'
																				checked={instFormThink}
																				onChange={(e) => setInstFormThink(e.target.checked)}
																				className='sr-only peer'
																			/>
																			<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7678ed]"></div>
																		</label>
																	</div>

																	{/* Share Name Select */}
																	<div className='flex items-center justify-between gap-4 pt-4 border-t border-[#e8ebf3]'>
																		<div>
																			<h5 className='font-bold text-[#202022] text-sm'>Share Name</h5>
																			<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>Automatically share your name with the AI models</p>
																		</div>
																		<select
																			value={instFormShareName}
																			onChange={(e) => setInstFormShareName(Number(e.target.value))}
																			className='bg-white text-[#202022] text-xs font-semibold px-3.5 py-2.5 rounded-xl outline-none border border-[#e8ebf3] focus:border-[#7678ed] cursor-pointer shadow-xs'
																		>
																			<option value={2}>Do Not Share</option>
																			<option value={1}>Share First Name</option>
																			<option value={0}>Share Full Name</option>
																		</select>
																	</div>

																	{/* Show Response Metadata Toggle */}
																	<div className='flex items-center justify-between gap-4 pt-4 border-t border-[#e8ebf3]'>
																		<div>
																			<h5 className='font-bold text-[#202022] text-sm'>Show Response Metadata</h5>
																			<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>Add the option to show reply metadata in the message as an attachment</p>
																		</div>
																		<label className='relative inline-flex items-center cursor-pointer shrink-0'>
																			<input
																				type='checkbox'
																				checked={instFormShowMetadata}
																				onChange={(e) => setInstFormShowMetadata(e.target.checked)}
																				className='sr-only peer'
																			/>
																			<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7678ed]"></div>
																		</label>
																	</div>

																	{/* Allow Self-Signed SSL Toggle */}
																	{isOllamaProvider && (
																		<div className='flex items-center justify-between gap-4 pt-4 border-t border-[#e8ebf3]'>
																			<div>
																				<h5 className='font-bold text-[#202022] text-sm'>Allow Self-Signed SSL Certificates</h5>
																				<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>Only use if you trust the server</p>
																			</div>
																			<label className='relative inline-flex items-center cursor-pointer shrink-0'>
																				<input
																					type='checkbox'
																					checked={instFormAllowSsl}
																					onChange={(e) => setInstFormAllowSsl(e.target.checked)}
																					className='sr-only peer'
																				/>
																				<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7678ed]"></div>
																			</label>
																		</div>
																	)}
																</div>

																{/* Card 3: Override Parameters Accordion */}
																<div className='bg-[#f9fafc] border border-[#7678ed]/40 rounded-3xl p-6 space-y-5 shadow-xs'>
																	<div className='flex items-center justify-between gap-4'>
																		<div>
																			<h5 className='font-bold text-[#202022] text-sm'>Override Parameters</h5>
																			<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>These parameters overrides the behavior of the instance and models</p>
																		</div>
																		<div className='flex items-center gap-3 shrink-0'>
																			<label className='relative inline-flex items-center cursor-pointer'>
																				<input
																					type='checkbox'
																					checked={instFormOverrideParams}
																					onChange={(e) => setInstFormOverrideParams(e.target.checked)}
																					className='sr-only peer'
																				/>
																				<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7678ed]"></div>
																			</label>
																			<button
																				type='button'
																				onClick={() => setIsOverrideAccordionOpen(!isOverrideAccordionOpen)}
																				className='p-1 text-[#7a7d90] hover:text-[#202022] transition-colors cursor-pointer'
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
																					className={`transition-transform duration-200 ${isOverrideAccordionOpen ? "rotate-180" : ""}`}
																				>
																					<path d='M6 9l6 6 6-6' />
																				</svg>
																			</button>
																		</div>
																	</div>

																	{instFormOverrideParams && isOverrideAccordionOpen && (
																		<div className='space-y-4 pt-4 border-t border-[#e8ebf3] animate-in fade-in duration-150'>
																			{/* Temperature Stepper */}
																			<div className='flex items-center justify-between gap-4'>
																				<div className='flex-1 min-w-0'>
																					<h6 className='font-bold text-[#202022] text-sm'>Temperature</h6>
																					<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>Increasing the temperature will make the models answer more creatively</p>
																				</div>
																				<div className='flex items-center gap-2 shrink-0 bg-white border border-[#e8ebf3] rounded-2xl p-1.5 shadow-xs'>
																					<span className='font-mono font-bold text-sm text-[#202022] px-2.5'>{instFormTemp.toFixed(2)}</span>
																					<button
																						type='button'
																						onClick={() => setInstFormTemp((prev) => Math.max(0, parseFloat((prev - 0.05).toFixed(2))))}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						-
																					</button>
																					<button
																						type='button'
																						onClick={() => setInstFormTemp((prev) => Math.min(2, parseFloat((prev + 0.05).toFixed(2))))}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						+
																					</button>
																				</div>
																			</div>

																			{/* Seed Stepper */}
																			<div className='flex items-center justify-between gap-4 pt-4 border-t border-[#e8ebf3]'>
																				<div className='flex-1 min-w-0'>
																					<h6 className='font-bold text-[#202022] text-sm'>Seed</h6>
																					<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>Setting this to a specific number other than 0 will make the model generate the same text for the same prompt</p>
																				</div>
																				<div className='flex items-center gap-2 shrink-0 bg-white border border-[#e8ebf3] rounded-2xl p-1.5 shadow-xs'>
																					<span className='font-mono font-bold text-sm text-[#202022] px-2.5'>{instFormSeed}</span>
																					<button
																						type='button'
																						onClick={() => setInstFormSeed((prev) => Math.max(0, prev - 1))}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						-
																					</button>
																					<button
																						type='button'
																						onClick={() => setInstFormSeed((prev) => prev + 1)}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						+
																					</button>
																				</div>
																			</div>

																			{/* Context Window Size Stepper */}
																			<div className='flex items-center justify-between gap-4 pt-4 border-t border-[#e8ebf3]'>
																				<div className='flex-1 min-w-0'>
																					<h6 className='font-bold text-[#202022] text-sm'>Context Window Size</h6>
																					<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>Controls how many tokens (pieces of text) the model can process and remember at once</p>
																				</div>
																				<div className='flex items-center gap-2 shrink-0 bg-white border border-[#e8ebf3] rounded-2xl p-1.5 shadow-xs'>
																					<span className='font-mono font-bold text-sm text-[#202022] px-2.5'>{instFormNumCtx}</span>
																					<button
																						type='button'
																						onClick={() => setInstFormNumCtx((prev) => Math.max(1024, prev - 2048))}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						-
																					</button>
																					<button
																						type='button'
																						onClick={() => setInstFormNumCtx((prev) => prev + 2048)}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						+
																					</button>
																				</div>
																			</div>
																		</div>
																	)}
																</div>

																{/* Card 4: Keep Alive Settings (Ollama specific) */}
																{isOllamaProvider && (
																	<div className='bg-[#f9fafc] border border-[#e8ebf3] rounded-3xl p-6 space-y-5 shadow-xs'>
																		<h4 className='font-bold text-base text-[#202022] border-b border-[#e8ebf3] pb-3'>Idle Keep Alive Settings</h4>

																		<div className='flex items-center justify-between gap-4'>
																			<div>
																				<h5 className='font-bold text-[#202022] text-sm'>Keep Alive Presets</h5>
																				<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>How the instance should handle idle models</p>
																			</div>
																			<select
																				value={instFormKeepAlivePreset}
																				onChange={(e) => {
																					const val = e.target.value;
																					setInstFormKeepAlivePreset(val);
																					if (val === "Indefinitely (-1)") setInstFormKeepAliveMinutes(-1);
																					else if (val === "Immediate Unload (0)") setInstFormKeepAliveMinutes(0);
																					else setInstFormKeepAliveMinutes(5);
																				}}
																				className='bg-white text-[#202022] text-xs font-semibold px-3.5 py-2.5 rounded-xl outline-none border border-[#e8ebf3] focus:border-[#7678ed] cursor-pointer shadow-xs'
																			>
																				<option value='Set Timer'>Set Timer</option>
																				<option value='Indefinitely (-1)'>Indefinitely (-1)</option>
																				<option value='Immediate Unload (0)'>Immediate Unload (0)</option>
																			</select>
																		</div>

																		{instFormKeepAlivePreset === "Set Timer" && (
																			<div className='flex items-center justify-between gap-4 pt-4 border-t border-[#e8ebf3]'>
																				<div className='flex-1 min-w-0'>
																					<h6 className='font-bold text-[#202022] text-sm'>Minutes</h6>
																					<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>The amount of time the instance should keep models loaded after they go idle</p>
																				</div>
																				<div className='flex items-center gap-2 shrink-0 bg-white border border-[#e8ebf3] rounded-2xl p-1.5 shadow-xs'>
																					<span className='font-mono font-bold text-sm text-[#202022] px-2.5'>{instFormKeepAliveMinutes}</span>
																					<button
																						type='button'
																						onClick={() => setInstFormKeepAliveMinutes((prev) => Math.max(1, prev - 1))}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						-
																					</button>
																					<button
																						type='button'
																						onClick={() => setInstFormKeepAliveMinutes((prev) => prev + 1)}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						+
																					</button>
																				</div>
																			</div>
																		)}
																	</div>
																)}
															</form>
														);
													})()}
												</div>
											)}

											{/* View 4: Instance Models View */}
											{instanceSubView === 'instance-models' && selectedInstanceForModels && (
												<div className='space-y-8 animate-in fade-in duration-200 select-none'>
													<div className='flex items-center gap-3'>
														<button
															onClick={() => setInstanceSubView('list')}
															className='p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer'
															title='Back to Instances'
														>
															<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
																<line x1='19' y1='12' x2='5' y2='12' />
																<polyline points='12 19 5 12 12 5' />
															</svg>
														</button>
														<div>
															<h3 className='text-2xl font-bold text-[#202022]'>
																Models — {selectedInstanceForModels.properties?.name || selectedInstanceForModels.type}
															</h3>
															<p className='text-sm text-[#7a7d90] mt-0.5'>
																Configure default TTS voices and settings for models on this instance.
															</p>
														</div>
													</div>

													{(() => {
														const preferencesList = Array.from(
															new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values()
														);

														const unmatchedModels = instanceModelsList.filter(
															(mod) =>
																!preferencesList.some(
																	(pref) =>
																		pref.id.toLowerCase() === String(mod.id || '').toLowerCase() ||
																		pref.id.toLowerCase() === String(mod.name || '').toLowerCase()
																)
														);

														return (
															<div className='space-y-10'>
																{/* Section 1: Model Preferences */}
																<div className='space-y-4'>
																	<div>
																		<h4 className='text-lg font-bold text-[#202022] flex items-center gap-2'>
																			<span>Model Preferences</span>
																			<span className='px-2 py-0.5 bg-[#eaecf9] text-[#7678ed] rounded-full text-xs font-semibold'>
																				{preferencesList.length}
																			</span>
																		</h4>
																		<p className='text-xs text-[#7a7d90]'>
																			Configured model preferences mapped to available instance models.
																		</p>
																	</div>

																	{preferencesList.length === 0 ? (
																		<div className='p-8 text-center bg-[#f9fafc] rounded-3xl border border-[#e8ebf3] text-sm text-[#8e90a6] font-medium'>
																			No model preferences found.
																		</div>
																	) : (
																		<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
																			{preferencesList.map((pref) => {
																				const matchedModel = instanceModelsList.find(
																					(mod) =>
																						String(mod.id || '').toLowerCase() === pref.id.toLowerCase() ||
																						String(mod.name || '').toLowerCase() === pref.id.toLowerCase()
																				);

																				const displayName =
																					getCharacterName(pref?.character) ||
																					(pref as any)?.name ||
																					matchedModel?.name ||
																					matchedModel?.id ||
																					pref.id;
																				const displayVoice = pref?.voice || matchedModel?.voice || 'af_heart';
																				const displayPicture = getModelAvatarPicture(pref, matchedModel);

																				return (
																					<div
																						key={pref.id}
																						className='p-5 rounded-3xl border border-[#e8ebf3] bg-white flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md hover:border-[#7678ed]/40 transition-all'
																					>
																						<div className='space-y-3 text-center'>
																							{/* Big Avatar */}
																							<div className='relative w-36 h-36 mx-auto'>
																								{displayPicture ? (
																									<img
																										src={displayPicture}
																										alt={displayName}
																										className='w-36 h-36 rounded-2xl object-cover shadow-sm border-2 border-white transition-transform duration-200 hover:scale-[1.02]'
																										onError={(e) => {
																											e.currentTarget.style.display = 'none';
																											const fallbackElem = e.currentTarget.nextElementSibling as HTMLElement;
																											if (fallbackElem) fallbackElem.style.display = 'flex';
																										}}
																									/>
																								) : null}
																								<div
																									className='w-36 h-36 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-3xl shadow-sm border-2 border-white'
																									style={{ display: displayPicture ? 'none' : 'flex' }}
																								>
																									🤖
																								</div>
																							</div>

																							{/* Details */}
																							<div>
																								<h4 className='text-base font-bold text-[#202022] truncate' title={displayName}>
																									{displayName}
																								</h4>
																								<p className='text-xs text-[#8e90a6] font-medium mt-0.5 truncate font-mono'>
																									ID: {pref.id}
																								</p>

																								{matchedModel ? (
																									<span className='inline-flex items-center gap-1 mt-2 px-3 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider'>
																										<span className='w-1.5 h-1.5 rounded-full bg-emerald-500'></span>
																										Matched: {matchedModel.name || matchedModel.id}
																									</span>
																								) : (
																									<span className='inline-flex items-center gap-1 mt-2 px-3 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider'>
																										<span className='w-1.5 h-1.5 rounded-full bg-amber-500'></span>
																										No Model Matched
																									</span>
																								)}
																							</div>

																							{/* Ollama / Model Specs Grid */}
																							{matchedModel && (matchedModel.tag || matchedModel.family || matchedModel.parameter_size || matchedModel.quantization_level) && (
																								<div className='bg-[#f8f9fc] border border-[#e8ebf3] rounded-2xl p-3 space-y-2 text-left text-xs'>
																									<div className='grid grid-cols-2 gap-2'>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Tag</span>
																											<span className='font-mono font-bold text-[#202022] truncate block'>{matchedModel.tag || matchedModel.id}</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Family</span>
																											<span className='font-semibold text-[#202022] truncate block'>{matchedModel.family || '—'}</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Parameter Size</span>
																											<span className='font-semibold text-[#202022] truncate block'>{matchedModel.parameter_size || '—'}</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Quantization Level</span>
																											<span className='font-mono font-semibold text-[#202022] truncate block'>{matchedModel.quantization_level || '—'}</span>
																										</div>
																									</div>

																									{matchedModel.modified_at && (
																										<div className='pt-1 border-t border-[#e8ebf3]'>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Modified At</span>
																											<span className='font-mono text-[11px] text-[#5d6075] truncate block'>
																												{typeof matchedModel.modified_at === 'string'
																													? matchedModel.modified_at.replace('T', ' ').substring(0, 16)
																													: matchedModel.modified_at}
																											</span>
																										</div>
																									)}
																								</div>
																							)}

																							{/* Capability Badges */}
																							{matchedModel && Array.isArray(matchedModel.capabilities) && matchedModel.capabilities.length > 0 && (
																								<div className='flex items-center justify-center gap-1.5 flex-wrap pt-1'>
																									{matchedModel.capabilities.includes('code') && (
																										<span className='px-2.5 py-1 bg-[#1e293b] text-[#93c5fd] rounded-xl text-[11px] font-bold flex items-center gap-1'>
																											<span className='font-mono'>&lt;/&gt;</span> Code
																										</span>
																									)}
																									{matchedModel.capabilities.includes('vision') && (
																										<span className='px-2.5 py-1 bg-[#4c1d95] text-[#f472b6] rounded-xl text-[11px] font-bold flex items-center gap-1'>
																											<span>👁</span> Vision
																										</span>
																									)}
																									{matchedModel.capabilities.includes('reasoning') && (
																										<span className='px-2.5 py-1 bg-[#581c87] text-[#c084fc] rounded-xl text-[11px] font-bold flex items-center gap-1'>
																											<span>🧠</span> Reasoning
																										</span>
																									)}
																								</div>
																							)}

																							{/* Selected TTS Display */}
																							<div className='bg-[#eaecf9]/50 border border-[#7678ed]/10 rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-[#5d6075]'>
																								<span>TTS Voice</span>
																								<span className='font-mono font-bold text-[#7678ed] truncate max-w-[110px]'>
																									{displayVoice}
																								</span>
																							</div>
																						</div>

																						{/* Edit Model Button */}
																						<button
																							type='button'
																							onClick={() => handleOpenEditModelModal(matchedModel || { id: pref.id, name: pref.id })}
																							className='w-full py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-bold rounded-2xl transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-2 cursor-pointer'
																						>
																							<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
																								<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																							</svg>
																							Edit Model
																						</button>
																					</div>
																				);
																			})}
																		</div>
																	)}
																</div>

																{/* Section 2: Models Without Preferences */}
																<div className='space-y-4 pt-4 border-t border-[#e8ebf3]'>
																	<div>
																		<h4 className='text-lg font-bold text-[#202022] flex items-center gap-2'>
																			<span>Models Without Preferences</span>
																			<span className='px-2 py-0.5 bg-[#f0f2f5] text-[#7a7d90] rounded-full text-xs font-semibold'>
																				{unmatchedModels.length}
																			</span>
																		</h4>
																		<p className='text-xs text-[#7a7d90]'>
																			Models available on this instance that have no configured model preferences.
																		</p>
																	</div>

																	{unmatchedModels.length === 0 ? (
																		<div className='p-8 text-center bg-[#f9fafc] rounded-3xl border border-[#e8ebf3] text-sm text-[#8e90a6] font-medium'>
																			All instance models have matching preferences.
																		</div>
																	) : (
																		<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
																			{unmatchedModels.map((mod) => {
																				const displayName = mod.name || mod.id;
																				const displayVoice = mod.voice || 'af_heart';
																				const displayPicture = getModelAvatarPicture(null, mod);

																				return (
																					<div
																						key={mod.id}
																						className='p-5 rounded-3xl border border-[#e8ebf3] bg-white flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md hover:border-[#7678ed]/40 transition-all opacity-95 hover:opacity-100'
																					>
																						<div className='space-y-3 text-center'>
																							{/* Big Avatar */}
																							<div className='relative w-36 h-36 mx-auto'>
																								{displayPicture ? (
																									<img
																										src={displayPicture}
																										alt={displayName}
																										className='w-36 h-36 rounded-2xl object-cover shadow-sm border-2 border-white transition-transform duration-200 hover:scale-[1.02]'
																										onError={(e) => {
																											e.currentTarget.style.display = 'none';
																											const fallbackElem = e.currentTarget.nextElementSibling as HTMLElement;
																											if (fallbackElem) fallbackElem.style.display = 'flex';
																										}}
																									/>
																								) : null}
																								<div
																									className='w-36 h-36 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-3xl shadow-sm border-2 border-white'
																									style={{ display: displayPicture ? 'none' : 'flex' }}
																								>
																									🤖
																								</div>
																							</div>

																							{/* Details */}
																							<div>
																								<h4 className='text-base font-bold text-[#202022] truncate' title={displayName}>
																									{displayName}
																								</h4>
																								<p className='text-xs text-[#8e90a6] font-medium mt-0.5 truncate font-mono'>
																									{mod.provider || selectedInstanceForModels.type} • {mod.context || '8k ctx'}
																								</p>
																								<span className='inline-flex items-center gap-1 mt-2 px-3 py-0.5 bg-[#f0f2f5] text-[#5d6075] border border-[#e8ebf3] rounded-full text-[10px] font-bold uppercase tracking-wider'>
																									No Preference
																								</span>
																							</div>

																							{/* Ollama / Model Specs Grid */}
																							{(mod.tag || mod.family || mod.parameter_size || mod.quantization_level) && (
																								<div className='bg-[#f8f9fc] border border-[#e8ebf3] rounded-2xl p-3 space-y-2 text-left text-xs'>
																									<div className='grid grid-cols-2 gap-2'>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Tag</span>
																											<span className='font-mono font-bold text-[#202022] truncate block'>{mod.tag || mod.id}</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Family</span>
																											<span className='font-semibold text-[#202022] truncate block'>{mod.family || '—'}</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Parameter Size</span>
																											<span className='font-semibold text-[#202022] truncate block'>{mod.parameter_size || '—'}</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Quantization Level</span>
																											<span className='font-mono font-semibold text-[#202022] truncate block'>{mod.quantization_level || '—'}</span>
																										</div>
																									</div>

																									{mod.modified_at && (
																										<div className='pt-1 border-t border-[#e8ebf3]'>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>Modified At</span>
																											<span className='font-mono text-[11px] text-[#5d6075] truncate block'>
																												{typeof mod.modified_at === 'string'
																													? mod.modified_at.replace('T', ' ').substring(0, 16)
																													: mod.modified_at}
																											</span>
																										</div>
																									)}
																								</div>
																							)}

																							{/* Capability Badges */}
																							{Array.isArray(mod.capabilities) && mod.capabilities.length > 0 && (
																								<div className='flex items-center justify-center gap-1.5 flex-wrap pt-1'>
																									{mod.capabilities.includes('code') && (
																										<span className='px-2.5 py-1 bg-[#1e293b] text-[#93c5fd] rounded-xl text-[11px] font-bold flex items-center gap-1'>
																											<span className='font-mono'>&lt;/&gt;</span> Code
																										</span>
																									)}
																									{mod.capabilities.includes('vision') && (
																										<span className='px-2.5 py-1 bg-[#4c1d95] text-[#f472b6] rounded-xl text-[11px] font-bold flex items-center gap-1'>
																											<span>👁</span> Vision
																										</span>
																									)}
																									{mod.capabilities.includes('reasoning') && (
																										<span className='px-2.5 py-1 bg-[#581c87] text-[#c084fc] rounded-xl text-[11px] font-bold flex items-center gap-1'>
																											<span>🧠</span> Reasoning
																										</span>
																									)}
																								</div>
																							)}

																							{/* Selected TTS Display */}
																							<div className='bg-[#eaecf9]/50 border border-[#7678ed]/10 rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-[#5d6075]'>
																								<span>TTS Voice</span>
																								<span className='font-mono font-bold text-[#7678ed] truncate max-w-[110px]'>
																									{displayVoice}
																								</span>
																							</div>
																						</div>

																						{/* Edit Model Button */}
																						<button
																							type='button'
																							onClick={() => handleOpenEditModelModal(mod)}
																							className='w-full py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-bold rounded-2xl transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-2 cursor-pointer'
																						>
																							<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
																								<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																							</svg>
																							Edit Model
																						</button>
																					</div>
																				);
																			})}
																		</div>
																	)}
																</div>
															</div>
														);
													})()}
												</div>
											)}

											{/* View 5: Edit Model Page View */}
											{instanceSubView === 'edit-model' && editingModel && (
												<div className='space-y-8 animate-in fade-in duration-200 select-none'>
													{/* Header with Back Button */}
													<div className='flex items-center gap-3'>
														<button
															onClick={() => setInstanceSubView('instance-models')}
															className='p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer'
															title='Back to Manage Models'
														>
															<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
																<line x1='19' y1='12' x2='5' y2='12' />
																<polyline points='12 19 5 12 12 5' />
															</svg>
														</button>
														<div>
															<h3 className='text-2xl font-bold text-[#202022]'>
																Edit Model — {editingModel.name || editingModel.id}
															</h3>
															<p className='text-sm text-[#7a7d90] mt-0.5'>
																Configure persona details, greetings, character book lore, and default TTS voice.
															</p>
														</div>
													</div>

													{/* Top Card Information (Previous Information Preview) */}
													{(() => {
														const rawId = String(editingModel.id || '');
														const pref = modelPreferences[rawId] || modelPreferences[rawId.toLowerCase()];
														const matchedModel = instanceModelsList.find(
															(mod) =>
																String(mod.id || '').toLowerCase() === rawId.toLowerCase() ||
																String(mod.name || '').toLowerCase() === rawId.toLowerCase()
														);
														const displayName = getCharacterName(pref?.character) || (pref as any)?.name || editingModel.name || editingModel.id;
														const displayPicture = getModelAvatarPicture(pref, editingModel);
														const displayVoice = pref?.voice || editingModel.voice || 'af_heart';
														const displayCtx = editModelNumCtx
															? `${editModelNumCtx.toLocaleString()} tokens`
															: pref?.num_ctx
															? `${pref.num_ctx.toLocaleString()} tokens`
															: editingModel.context || '8,192 tokens';

														return (
															<div className='p-6 rounded-3xl border border-[#e8ebf3] bg-white flex flex-col md:flex-row items-center gap-6 shadow-sm'>
																{/* Avatar */}
																<div className='relative w-32 h-32 shrink-0 mx-auto md:mx-0'>
																	{displayPicture ? (
																		<img
																			src={displayPicture}
																			alt={displayName}
																			className='w-32 h-32 rounded-2xl object-cover shadow-sm border-2 border-white'
																			onError={(e) => {
																				e.currentTarget.style.display = 'none';
																				const fallbackElem = e.currentTarget.nextElementSibling as HTMLElement;
																				if (fallbackElem) fallbackElem.style.display = 'flex';
																			}}
																		/>
																	) : null}
																	<div
																		className='w-32 h-32 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-4xl shadow-sm border-2 border-white'
																		style={{ display: displayPicture ? 'none' : 'flex' }}
																	>
																		🤖
																	</div>
																</div>

																{/* Model Details */}
																<div className='flex-1 space-y-2 text-center md:text-left min-w-0'>
																	<div className='flex flex-wrap items-center justify-center md:justify-start gap-2'>
																		<h4 className='text-xl font-bold text-[#202022] truncate'>{displayName}</h4>
																		{matchedModel ? (
																			<span className='inline-flex items-center gap-1 px-3 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider'>
																				<span className='w-1.5 h-1.5 rounded-full bg-emerald-500'></span>
																				Matched: {matchedModel.name || matchedModel.id}
																			</span>
																		) : (
																			<span className='inline-flex items-center gap-1 px-3 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider'>
																				<span className='w-1.5 h-1.5 rounded-full bg-amber-500'></span>
																				No Model Matched
																			</span>
																		)}
																	</div>

																	<p className='text-xs text-[#8e90a6] font-medium font-mono'>
																		ID: {editingModel.id || rawId}
																	</p>

																	<div className='flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1 text-xs text-[#5d6075]'>
																		<span className='px-3 py-1 bg-[#eaecf9]/80 rounded-xl font-semibold text-[#7678ed]'>
																			Provider: {editingModel.provider || selectedInstanceForModels?.type || 'Ollama'}
																		</span>
																		<span className='px-3 py-1 bg-[#eaecf9]/80 rounded-xl font-semibold text-[#7678ed]'>
																			TTS Voice: {displayVoice}
																		</span>
																	</div>
																</div>
															</div>
														);
													})()}

													{/* Main Form Below */}
													<form onSubmit={handleSaveEditModel} className='space-y-8 bg-white border border-[#e8ebf3] rounded-3xl p-6 shadow-xs'>
														{/* 1. General Information */}
														<div className='space-y-4'>
															<div className='pb-2 border-b border-[#e8ebf3]'>
																<h4 className='text-sm font-bold text-[#7678ed] uppercase tracking-wider'>General Information</h4>
																<p className='text-xs text-[#7a7d90] mt-0.5'>Basic identity, context window, and voice configuration for this model.</p>
															</div>

															<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
																<div>
																	<label className='block text-xs font-bold text-[#5d6075] mb-1.5'>Model / Character Name</label>
																	<input
																		type='text'
																		value={editModelName}
																		onChange={(e) => setEditModelName(e.target.value)}
																		placeholder='e.g. Sora Assistant'
																		className='w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-[#7678ed] transition-all'
																	/>
																</div>

																<div>
																	<label className='block text-xs font-bold text-[#5d6075] mb-1.5'>Default TTS Voice</label>
																	<select
																		value={editModelVoice}
																		onChange={(e) => setEditModelVoice(e.target.value)}
																		className='w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-[#7678ed] transition-all cursor-pointer'
																	>
																		<option value='af_heart'>af_heart (Female Warm)</option>
																		<option value='af_bella'>af_bella (Female Expressive)</option>
																		<option value='af_sky'>af_sky (Female Soft)</option>
																		<option value='am_adam'>am_adam (Male Deep)</option>
																		<option value='am_michael'>am_michael (Male Smooth)</option>
																	</select>
																</div>
															</div>

															<div>
																<label className='block text-xs font-bold text-[#5d6075] mb-1.5'>Description</label>
																<textarea
																	rows={3}
																	value={editModelDescription}
																	onChange={(e) => setEditModelDescription(e.target.value)}
																	placeholder='Model persona description, system instructions, or background context...'
																	className='w-full bg-white border border-[#e8ebf3] text-[#202022] rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[#7678ed] resize-y'
																/>
															</div>

															<div>
																<label className='block text-xs font-bold text-[#5d6075] mb-1.5'>First Message (Greeting)</label>
																<textarea
																	rows={2}
																	value={editModelFirstMessage}
																	onChange={(e) => setEditModelFirstMessage(e.target.value)}
																	placeholder='Initial greeting sent by model when starting a conversation...'
																	className='w-full bg-white border border-[#e8ebf3] text-[#202022] rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[#7678ed] resize-y'
																/>
															</div>
														</div>

														{/* 2. Alternative Greetings */}
														<div className='space-y-4 pt-4 border-t border-[#e8ebf3]'>
															<div className='flex items-center justify-between pb-2 border-b border-[#e8ebf3]'>
																<div>
																	<h4 className='text-base font-bold text-[#202022]'>Alternative Greetings</h4>
																	<p className='text-xs text-[#7a7d90]'>Optional alternative opening lines for starting new chats.</p>
																</div>
																<button
																	type='button'
																	onClick={handleAddGreeting}
																	className='px-3.5 py-2 rounded-2xl bg-[#eaecf9] hover:bg-[#e0e3f5] text-[#7678ed] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer'
																>
																	+ Add Greeting
																</button>
															</div>

															{editModelAlternateGreetings.length === 0 ? (
																<p className='text-xs text-[#8e90a6] italic py-2 text-center'>No alternative greetings added.</p>
															) : (
																<div className='space-y-3'>
																	{editModelAlternateGreetings.map((greeting, idx) => (
																		<div key={idx} className='flex items-center gap-3'>
																			<input
																				type='text'
																				value={greeting}
																				onChange={(e) => handleUpdateGreeting(idx, e.target.value)}
																				placeholder={`Greeting #${idx + 1}...`}
																				className='flex-1 bg-white border border-[#e8ebf3] text-[#202022] rounded-2xl px-4 py-2.5 text-sm font-medium outline-none focus:border-[#7678ed]'
																			/>
																			<button
																				type='button'
																				onClick={() => handleRemoveGreeting(idx)}
																				className='p-2.5 text-red-500 hover:bg-red-50 rounded-2xl transition-all cursor-pointer'
																				title='Remove Greeting'
																			>
																				<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																					<polyline points='3 6 5 6 21 6' />
																					<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
																				</svg>
																			</button>
																		</div>
																	))}
																</div>
															)}
														</div>

														{/* 3. Character Book */}
														<div className='space-y-4 pt-4 border-t border-[#e8ebf3]'>
															<div className='flex items-center justify-between pb-2 border-b border-[#e8ebf3]'>
																<div>
																	<h4 className='text-base font-bold text-[#202022]'>Character Book</h4>
																	<p className='text-xs text-[#7a7d90]'>Lore items, world facts, and keyword-triggered context memories.</p>
																</div>
																<button
																	type='button'
																	onClick={handleAddBookItem}
																	className='px-3.5 py-2 rounded-2xl bg-[#eaecf9] hover:bg-[#e0e3f5] text-[#7678ed] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer'
																>
																	+ Add Item
																</button>
															</div>

															{editModelCharacterBook.length === 0 ? (
																<p className='text-xs text-[#8e90a6] italic py-2 text-center'>No character book items defined.</p>
															) : (
																<div className='space-y-4'>
																	{editModelCharacterBook.map((item, idx) => (
																		<div key={idx} className='bg-white p-5 rounded-2xl border border-[#e8ebf3] space-y-4 shadow-xs'>
																			<div className='flex items-center justify-between gap-3'>
																				<input
																					type='text'
																					value={item.name}
																					onChange={(e) => handleUpdateBookItem(idx, 'name', e.target.value)}
																					placeholder='Item Name (e.g. World Lore)...'
																					className='flex-1 bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-[#7678ed]'
																				/>
																				<button
																					type='button'
																					onClick={() => handleRemoveBookItem(idx)}
																					className='p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer'
																					title='Remove Item'
																				>
																					<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																						<polyline points='3 6 5 6 21 6' />
																						<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
																					</svg>
																				</button>
																			</div>

																			<div>
																				<label className='block text-[11px] font-bold text-[#7a7d90] mb-1 uppercase tracking-wider'>Description / Content</label>
																				<textarea
																					rows={2}
																					value={item.description}
																					onChange={(e) => handleUpdateBookItem(idx, 'description', e.target.value)}
																					placeholder='Content inserted into context when keywords match...'
																					className='w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-xl px-3.5 py-2 text-xs font-medium outline-none focus:border-[#7678ed] resize-y'
																				/>
																			</div>

																			<div>
																				<label className='block text-[11px] font-bold text-[#7a7d90] mb-1 uppercase tracking-wider'>Tags / Keywords (comma separated)</label>
																				<input
																					type='text'
																					value={item.tags}
																					onChange={(e) => handleUpdateBookItem(idx, 'tags', e.target.value)}
																					placeholder='e.g. empire, capital, history'
																					className='w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-xl px-3.5 py-2 text-xs font-medium outline-none focus:border-[#7678ed]'
																				/>
																			</div>
																		</div>
																	))}
																</div>
															)}
														</div>

														{/* Form Action Buttons */}
														<div className='flex items-center justify-end gap-3 pt-6 border-t border-[#e8ebf3]'>
															<button
																type='button'
																onClick={() => setInstanceSubView('instance-models')}
																className='px-5 py-2.5 rounded-2xl text-xs font-bold text-[#7a7d90] hover:bg-[#eaecf8] transition-colors cursor-pointer'
															>
																Cancel
															</button>
															<button
																type='submit'
																className='px-6 py-2.5 rounded-2xl text-xs font-bold bg-[#7678ed] hover:bg-[#6869d9] text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer flex items-center gap-2'
															>
																<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
																	<polyline points='20 6 9 17 4 12' />
																</svg>
																Save Model Preference
															</button>
														</div>
													</form>
												</div>
											)}
										</div>
									)}

									{activeSettingsCategory === 'preferences' && (
										<div className='space-y-6 animate-in fade-in duration-200'>
											<div>
												<h3 className='text-2xl font-bold text-[#202022]'>Preferences</h3>
												<p className='text-sm text-[#7a7d90] mt-1'>Configure playback options, user interface defaults, and system notifications.</p>
											</div>

											<div className='space-y-4 bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl p-6'>
												<div className='flex items-center justify-between pb-4 border-b border-[#e8ebf3]'>
													<div>
														<h4 className='text-base font-bold text-[#202022]'>Auto-play Assistant Voice</h4>
														<p className='text-xs text-[#8e90a6]'>Automatically start TTS voice playback when assistant finishes generating response.</p>
													</div>
													<input type='checkbox' className='w-5 h-5 rounded text-[#7678ed] focus:ring-[#7678ed]' />
												</div>

												<div className='flex items-center justify-between pb-4 border-b border-[#e8ebf3]'>
													<div>
														<h4 className='text-base font-bold text-[#202022]'>Desktop Notifications</h4>
														<p className='text-xs text-[#8e90a6]'>Send desktop alert when background LLM generation completes.</p>
													</div>
													<input type='checkbox' defaultChecked className='w-5 h-5 rounded text-[#7678ed] focus:ring-[#7678ed]' />
												</div>

												<div className='flex items-center justify-between pb-4 border-b border-[#e8ebf3]'>
													<div>
														<h4 className='text-base font-bold text-[#202022]'>Auto-scroll during generation</h4>
														<p className='text-xs text-[#8e90a6]'>Keep chat window scrolled to the latest incoming message tokens.</p>
													</div>
													<input type='checkbox' defaultChecked className='w-5 h-5 rounded text-[#7678ed] focus:ring-[#7678ed]' />
												</div>

												<div className='pt-2'>
													<h4 className='text-base font-bold text-[#202022] mb-2'>Default Audio Output Device</h4>
													<select className='w-full bg-white border border-[#e8ebf3] rounded-xl px-3.5 py-2.5 text-sm text-[#202022] font-semibold outline-none focus:border-[#7678ed]'>
														<option value='default'>System Default Speaker</option>
														<option value='headphones'>Headphones / Headset</option>
													</select>
												</div>
											</div>
										</div>
									)}

									{activeSettingsCategory === 'about-walpaca' && (
										<div className='space-y-6 animate-in fade-in duration-200'>
											<div className='p-8 rounded-3xl bg-gradient-to-br from-[#202022] to-[#2d2d30] text-white shadow-xl relative overflow-hidden'>
												<div className='relative z-10 space-y-4'>
													<div className='w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-2.5'>
														<img src='/icon-white.svg' alt='Walpaca Logo' className='w-full h-full object-contain' />
													</div>
													<div>
														<h3 className='text-3xl font-extrabold tracking-tight'>Walpaca</h3>
														<p className='text-sm text-white/70 font-mono mt-1'>Version 1.0.0 (Build 2026.09.29-release)</p>
													</div>
													<p className='text-sm text-white/80 leading-relaxed max-w-xl'>
														Next-generation local & multi-model AI assistant workspace featuring high-performance TTS audio streaming, character persona engines, and custom folder management.
													</p>
													<div className='flex items-center gap-3 pt-2'>
														<button className='px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all border border-white/15 cursor-pointer'>
															Documentation
														</button>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</main>

							{/* 3. RIGHT SIDEBAR - HELP & TIPS */}
							<aside className='w-[320px] bg-[#f9fafc] border-l border-[#e8ebf3] p-6 flex flex-col gap-5 overflow-y-auto shrink-0 select-none'>
								<div className='flex items-center gap-2 text-[#7678ed] font-bold text-lg border-b border-[#e8ebf3] pb-3'>
									<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
										<path d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' />
									</svg>
									<span>Help & Tips</span>
								</div>

								{activeSettingsCategory === 'import-chat' && (
									<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
										<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
											<h5 className='font-bold text-[#202022] text-sm'>Supported File Types</h5>
											<p className='text-xs text-[#7a7d90]'>
												You can import JSON files exported directly from ChatGPT (<code className='bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]'>conversations.json</code>) or Anthropic Claude exports.
											</p>
										</div>
										<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
											<h5 className='font-bold text-[#202022] text-sm'>Size Limits</h5>
											<p className='text-xs text-[#7a7d90]'>Single file archives up to 500 MB are processed locally without leaving your browser workspace.</p>
										</div>
									</div>
								)}

								{activeSettingsCategory === 'manage-instances' && (
									<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
										<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
											<h5 className='font-bold text-[#202022] text-sm'>Connecting Ollama</h5>
											<p className='text-xs text-[#7a7d90]'>
												Ensure Ollama is running locally with <code className='bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]'>OLLAMA_ORIGINS="*"</code> enabled for web CORS access.
											</p>
										</div>
										<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
											<h5 className='font-bold text-[#202022] text-sm'>API Key Security</h5>
											<p className='text-xs text-[#7a7d90]'>Cloud API tokens are encrypted in your browser's local secure storage and never transmitted to third parties.</p>
										</div>
									</div>
								)}

								{activeSettingsCategory === 'preferences' && (
									<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
										<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
											<h5 className='font-bold text-[#202022] text-sm'>TTS Audio Output</h5>
											<p className='text-xs text-[#7a7d90]'>Ensure your browser permission allows HTML5 Web Audio auto-play for seamless speech output.</p>
										</div>
									</div>
								)}

								{activeSettingsCategory === 'about-walpaca' && (
									<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
										<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
											<h5 className='font-bold text-[#202022] text-sm'>System Health</h5>
											<p className='text-xs text-[#7a7d90]'>All core sub-services (Frontend Next.js app and Python API backend) operating nominally.</p>
										</div>
									</div>
								)}
							</aside>
						</div>
					) : (
						<>
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
								.filter((chat) => {
									const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
									const matchesFolder = activeTab === "all" || chat.folder === activeTab;
									return matchesSearch && matchesFolder;
								})
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
															onClick={handleOpenDuplicateModal}
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
																<rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
																<path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
															</svg>
															Duplicate
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
								<div className='flex-1 overflow-y-auto px-8 py-6 space-y-6 flex flex-col'>
									{messages.length === 0 ? (() => {
										const selectedPrefKey = (selectedChatModelId || '').toLowerCase();
										const selectedPref =
											modelPreferences[selectedChatModelId] ||
											modelPreferences[selectedPrefKey] ||
											Object.values(modelPreferences).find((p) => p.id.toLowerCase() === selectedPrefKey);
										const char = selectedPref?.character || {};
										const charData = char.data || char || {};
										const firstMes = (charData.first_mes || charData.first_message || selectedPref?.first_message || '').trim();

										return (
											<div className='flex flex-col items-center justify-center h-full min-h-[350px] text-center p-8 select-none my-auto'>
												<div className='w-24 h-24 rounded-3xl bg-[#f0f2f9] flex items-center justify-center mb-6 text-[#7678ed] shadow-inner'>
													<img src='/icon-black.svg' alt='Alpaca Logo' className='w-14 h-14 opacity-70' />
												</div>
												<h3 className='text-2xl font-bold text-[#202022] mb-2'>No messages yet</h3>
												<p className='text-base text-[#8e90a6] max-w-sm mb-6'>
													Start a conversation by typing a message below or using a character template.
												</p>
												{selectedPref && firstMes ? (
													<button
														type='button'
														onClick={handleUseCharacterFirstMes}
														className='px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-sm font-semibold rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer flex items-center gap-2'
													>
														<span>✨</span>
														<span>Use Character</span>
													</button>
												) : null}
											</div>
										);
									})() : (
										messages.map((msg) => {
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

											const isEditingUser = editingMsgId === msg.id;

											return (
												<div key={msg.id} className='flex items-start justify-end gap-3.5 w-full'>
													<div className='flex flex-col items-end flex-1 w-full min-w-0'>
														<div className='bg-[#7678ed] text-white rounded-2xl rounded-tr-sm px-5 py-4 text-lg shadow-[0_4px_14px_rgba(118,120,237,0.35)] w-full'>
															{isEditingUser ? (
																<div className='flex flex-col gap-3 w-full my-1'>
																	<textarea
																		ref={autoResizeTextarea}
																		rows={1}
																		value={editingMsgContent}
																		onChange={(e) => {
																			setEditingMsgContent(e.target.value);
																			autoResizeTextarea(e.currentTarget);
																		}}
																		onInput={(e) => autoResizeTextarea(e.currentTarget)}
																		className='w-full bg-white/10 text-white placeholder-white/50 rounded-xl p-3.5 text-base outline-none border border-white/30 focus:border-white transition-all resize-none overflow-hidden font-normal leading-relaxed'
																		autoFocus
																	/>
																	<div className='flex items-center justify-end gap-2'>
																		<button
																			type='button'
																			onClick={() => setEditingMsgId(null)}
																			className='px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer'
																		>
																			Cancel
																		</button>
																		<button
																			type='button'
																			onClick={handleSaveInlineEdit}
																			disabled={!editingMsgContent.trim()}
																			className='px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#7678ed] hover:bg-white/90 disabled:opacity-50 transition-all shadow-xs cursor-pointer'
																		>
																			Save
																		</button>
																	</div>
																</div>
															) : (
																<>
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
																		<button
																			type='button'
																			onClick={() => handleStartInlineEdit(msg)}
																			className='p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer'
																			title='Edit Message'
																		>
																			<svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																				<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																			</svg>
																		</button>
																		<button
																			type='button'
																			onClick={() => handleOpenDeleteMessageModal(msg)}
																			className='p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white hover:text-[#ff7875] transition-all cursor-pointer'
																			title='Delete Message'
																		>
																			<svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																				<polyline points='3 6 5 6 21 6' />
																				<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
																			</svg>
																		</button>
																		<span>{msg.time}</span>
																	</div>
																</>
															)}
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
											const isEditingAssistant = editingMsgId === msg.id;

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
																	<button
																		type='button'
																		onClick={() => handleStartInlineEdit(msg)}
																		className='p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#8e90a6] hover:text-[#7678ed] hover:border-[#7678ed] hover:bg-[#f4f6fc] transition-all shadow-xs cursor-pointer flex items-center justify-center'
																		title='Edit Message'
																	>
																		<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																			<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																		</svg>
																	</button>
																	<button
																		type='button'
																		onClick={() => handleOpenDeleteMessageModal(msg)}
																		className='p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#8e90a6] hover:text-[#ff4d4f] hover:border-[#ff4d4f] hover:bg-[#fff1f0] transition-all shadow-xs cursor-pointer flex items-center justify-center'
																		title='Delete Message'
																	>
																		<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																			<polyline points='3 6 5 6 21 6' />
																			<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
																		</svg>
																	</button>
																</div>
															</div>
															<div className='leading-relaxed'>
																{isEditingAssistant ? (
																	<div className='flex flex-col gap-3 w-full my-2'>
																		<textarea
																			ref={autoResizeTextarea}
																			rows={1}
																			value={editingMsgContent}
																			onChange={(e) => {
																				setEditingMsgContent(e.target.value);
																				autoResizeTextarea(e.currentTarget);
																			}}
																			onInput={(e) => autoResizeTextarea(e.currentTarget)}
																			className='w-full bg-white border border-[#e2e5f1] text-[#202022] rounded-xl p-3.5 text-base outline-none focus:border-[#7678ed] focus:ring-1 focus:ring-[#7678ed] transition-all resize-none overflow-hidden font-normal leading-relaxed'
																			autoFocus
																		/>
																		<div className='flex items-center justify-end gap-2'>
																			<button
																				type='button'
																				onClick={() => setEditingMsgId(null)}
																				className='px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#e2e5f1] hover:bg-[#d5d8e6] text-[#5d6075] transition-all cursor-pointer'
																			>
																				Cancel
																			</button>
																			<button
																				type='button'
																				onClick={handleSaveInlineEdit}
																				disabled={!editingMsgContent.trim()}
																				className='px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-xs cursor-pointer'
																			>
																				Save
																			</button>
																		</div>
																	</div>
																) : (
																	renderMarkdownText(msg.content, msg.id === ttsState.msgId ? ttsState.lineIndex : undefined)
																)}
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
									})
									)}
									{messages.length > 0 && messages[messages.length - 1].isSelf && (
										<div className='flex justify-center my-3 animate-in fade-in duration-200 select-none'>
											<button
												type='button'
												onClick={handleCallForAnswer}
												className='px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-sm font-semibold rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer flex items-center gap-2'
											>
												<span>🤖</span>
												<span>Call for an answer</span>
											</button>
										</div>
									)}
									<div ref={messagesEndRef} />
								</div>

								{/* Input Composer */}
								<form onSubmit={handleSendMessage} className='p-4 px-8 border-t border-[#eef0f6] bg-white flex items-center gap-2.5'>
									{/* 1. Instance Selector with PC Icon */}
									<div className='relative shrink-0 flex items-center bg-[#f0f2f9] border border-[#e8ebf3] rounded-2xl px-3 py-1 hover:bg-[#eaecf9] transition-all shadow-xs'>
										<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='#7678ed' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='shrink-0 mr-1.5'>
											<rect x='2' y='3' width='20' height='14' rx='2' ry='2' />
											<line x1='8' y1='21' x2='16' y2='21' />
											<line x1='12' y1='17' x2='12' y2='21' />
										</svg>
										<select
											value={selectedChatInstanceId}
											onChange={(e) => {
												setSelectedChatInstanceId(e.target.value);
												fetchModelsForInstance(e.target.value);
											}}
											className='bg-transparent text-[#202022] text-xs font-bold outline-none cursor-pointer max-w-[110px] truncate py-1.5'
											title='Select Instance'
										>
											{instances.length === 0 ? (
												<option value=''>No Instance</option>
											) : (
												instances.map((inst) => (
													<option key={inst.id} value={inst.id}>
														💻 {inst.properties?.name || inst.type}
													</option>
												))
											)}
										</select>
									</div>

									{/* 2. Model Selector with Manage Models Icon */}
									<div className='relative shrink-0 flex items-center bg-[#f0f2f9] border border-[#e8ebf3] rounded-2xl px-3 py-1 hover:bg-[#eaecf9] transition-all shadow-xs'>
										<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='#7678ed' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='shrink-0 mr-1.5'>
											<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
											<circle cx='9' cy='7' r='4' />
											<path d='M22 21v-2a4 4 0 0 0-3-3.87' />
											<path d='M16 3.13a4 4 0 0 1 0 7.75' />
										</svg>
										<select
											value={selectedChatModelId}
											onChange={(e) => setSelectedChatModelId(e.target.value)}
											className='bg-transparent text-[#202022] text-xs font-bold outline-none cursor-pointer max-w-[140px] truncate py-1.5'
											title='Select Responding Model'
										>
											{(() => {
												const prefList = Array.from(
													new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values()
												);

												return (
													<>
														{/* Preferences on top */}
														{prefList.length > 0 && (
															<optgroup label='Model Preferences'>
																{prefList.map((pref) => (
																	<option key={`pref-${pref.id}`} value={pref.id}>
																		✨ {getCharacterName(pref.character) || (pref as any).name || pref.id} (Pref)
																	</option>
																))}
															</optgroup>
														)}

														{/* Instance models below */}
														{instanceModelsList.length > 0 && (
															<optgroup label='Instance Models'>
																{instanceModelsList.map((mod) => (
																	<option key={`mod-${mod.id}`} value={mod.id}>
																		🤖 {mod.name || mod.id}
																	</option>
																))}
															</optgroup>
														)}

														{prefList.length === 0 && instanceModelsList.length === 0 && (
															<option value=''>No Models Available</option>
														)}
													</>
												);
											})()}
										</select>
									</div>

									{/* 3. Thinking Mode Brain Toggle Button */}
									<button
										type='button'
										onClick={() => setIsThinkingEnabled((prev) => !prev)}
										className={`p-2.5 rounded-2xl transition-all cursor-pointer shrink-0 border flex items-center justify-center ${
											isThinkingEnabled
												? 'bg-[#7678ed]/10 border-[#7678ed] text-[#7678ed] opacity-100 shadow-xs'
												: 'bg-[#f0f2f9] border-[#e8ebf3] text-[#8e90a6] hover:bg-[#eaecf9] opacity-40 hover:opacity-70'
										}`}
										title={isThinkingEnabled ? 'Thinking Mode Enabled (think=True)' : 'Thinking Mode Disabled (click to enable)'}
									>
										<BrainIcon className='w-5 h-5' />
									</button>

									{/* Attach file button */}
									<button
										type='button'
										className='p-2.5 text-[#8e90a6] hover:text-[#7678ed] hover:bg-[#f4f6fc] rounded-2xl transition-colors cursor-pointer shrink-0'
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
						</>
					)}
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

			{/* Custom Duplicate Chat Modal */}
			{isDuplicateModalOpen && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-4'>
							<h3 className='text-lg font-bold tracking-tight'>Duplicate Chat</h3>
							<button onClick={() => setIsDuplicateModalOpen(false)} className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'>
								<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>
						<p className='text-sm text-white/70 leading-relaxed mb-6'>
							Are you sure you want to duplicate this chat? A new conversation with the same content will be created and opened automatically.
						</p>
						<div className='flex items-center justify-end gap-3'>
							<button
								type='button'
								onClick={() => setIsDuplicateModalOpen(false)}
								className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleConfirmDuplicateChat}
								className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer'
							>
								Duplicate Chat
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Message Confirmation Modal */}
			{deletingMsg && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-2'>
							<h3 className='text-lg font-bold text-[#ff4d4f]'>Delete Message?</h3>
							<button onClick={() => setDeletingMsg(null)} className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'>
								<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>
						<p className='text-sm text-white/70 leading-relaxed mb-6'>
							Are you sure you want to delete this message? This action cannot be undone.
						</p>
						<div className='flex items-center justify-end gap-3'>
							<button
								type='button'
								onClick={() => setDeletingMsg(null)}
								className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleConfirmDeleteMessage}
								className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#ff4d4f] hover:bg-[#e04345] text-white transition-all shadow-md shadow-[#ff4d4f]/30 cursor-pointer'
							>
								Delete Message
							</button>
						</div>
					</div>
				</div>
			)}

		</main>
  );
}
