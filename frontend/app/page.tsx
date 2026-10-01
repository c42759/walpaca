'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, registerGoToRootHandler, registerDropChatToFolderHandler } from '../store/useAppStore';
import { getApiUrl } from '../lib/api';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';
import { ManagePersonasPanel } from '@/components/settings/ManagePersonasPanel';
import { ManageLorebookPanel } from '@/components/settings/ManageLorebookPanel';
import { ManageInstancesPanel } from '@/components/settings/ManageInstancesPanel';
import { SettingsHelpSidebar } from '@/components/settings/SettingsHelpSidebar';
import { ChatListPanel } from '@/components/chat/ChatListPanel';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { ListItem, List } from '@/components/ui/List';
import {
	BrainIcon,
	MetadataIcon,
	SearchIcon,
	PlusIcon,
	EditIcon,
	TrashIcon,
	CheckIcon,
	ChevronIcon,
	CloseIcon,
	SettingsIcon,
	ChatIcon,
	FolderIcon,
	AttachmentIcon,
} from '@/components/icons/Icons';

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
	type: 'image' | 'plain_text' | 'code';
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
		.replace(/[^a-zA-Z0-9\s]/g, '')
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	let initials = 'CH';
	if (words.length >= 2) {
		initials = `${words[0][0]}${words[1][0]}`.toUpperCase();
	} else if (words.length === 1 && words[0].length >= 2) {
		initials = words[0].slice(0, 2).toUpperCase();
	} else if (c.name.trim().length >= 2) {
		initials = c.name.trim().slice(0, 2).toUpperCase();
	}

	let timeStr = 'now';
	if (c.latest_message_time) {
		const parts = c.latest_message_time.split(' ');
		timeStr = parts[1] ? parts[1].slice(0, 5) : parts[0] || 'now';
	}

	return {
		id: c.id,
		name: c.name,
		avatarText: initials,
		lastMessage: c.latest_message_time ? `Last msg ${timeStr}` : 'No messages yet',
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
	if (typeof char.enabled === 'boolean') return char.enabled;
	if (typeof char.enable === 'boolean') return char.enable;
	if (typeof char.data?.enabled === 'boolean') return char.data.enabled;
	if (typeof char.data?.enable === 'boolean') return char.data.enable;
	return Boolean(getCharacterName(char));
};

const formatAvatarPicture = (picture?: string | null): string | undefined => {
	if (!picture) return undefined;
	if (picture.startsWith('data:') || picture.startsWith('http://') || picture.startsWith('https://') || picture.startsWith('/')) {
		return picture;
	}
	return `data:image/png;base64,${picture}`;
};

const getAvatarColor = (name: string): string => {
	if (!name) return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}

	const gradients = [
		'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', // Indigo
		'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // Violet
		'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', // Pink
		'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', // Rose
		'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', // Orange
		'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
		'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', // Teal
		'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // Cyan
		'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // Blue
		'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)', // Purple
		'linear-gradient(135deg, #059669 0%, #047857 100%)', // Green
		'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', // Indigo-Violet
	];

	const idx = Math.abs(hash) % gradients.length;
	return gradients[idx];
};

const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
	if (!el) return;
	el.style.height = 'auto';
	const maxHeight = typeof window !== 'undefined' ? window.innerHeight * 0.3 : 240;
	if (el.scrollHeight > maxHeight) {
		el.style.height = `${maxHeight}px`;
		el.style.overflowY = 'auto';
	} else {
		el.style.height = `${el.scrollHeight}px`;
		el.style.overflowY = 'hidden';
	}
};

const playNotificationSound = () => {
	if (typeof window === 'undefined') return;
	try {
		const audio = new Audio('/universfield-new-notification-036-485897.mp3');
		audio.volume = 0.6;
		audio.play().catch((err) => {
			console.warn('Notification sound playback prevented or failed:', err);
		});
	} catch (err) {
		console.warn('Notification sound playback error:', err);
	}
};

const DEFAULT_MODEL_AVATAR = '/icon-app.svg';

const getModelAvatarPicture = (pref?: ModelPreference | null, mod?: any): string => {
	const rawPic = pref?.picture || pref?.character?.data?.avatar || pref?.character?.avatar || mod?.picture || mod?.avatar || mod?.senderAvatar;
	return formatAvatarPicture(rawPic) || DEFAULT_MODEL_AVATAR;
};

const isImageAttachment = (att: MessageAttachment | any): boolean => {
	if (!att) return false;
	const typeStr = (att.type || '').toLowerCase();
	if (typeStr.includes('image') || typeStr.includes('photo') || typeStr.includes('png') || typeStr.includes('jpg') || typeStr.includes('jpeg')) {
		return true;
	}
	const contentStr = typeof att.content === 'string' ? att.content.trim() : '';
	if (
		contentStr.startsWith('data:image/') ||
		contentStr.startsWith('iVBOR') ||
		contentStr.startsWith('/9j/') ||
		contentStr.startsWith('R0lGOD') ||
		contentStr.startsWith('UklGR')
	) {
		return true;
	}
	return false;
};

const getImageSrc = (att: MessageAttachment | any): string => {
	const contentStr = typeof att.content === 'string' ? att.content.trim() : '';
	if (contentStr.startsWith('data:') || contentStr.startsWith('http://') || contentStr.startsWith('https://') || contentStr.startsWith('/')) {
		return contentStr;
	}
	return `data:image/png;base64,${contentStr}`;
};

const mapBackendMsgToMessage = (m: BackendMessage, prefMap?: Record<string, ModelPreference>): Message => {
	const isSelf = m.role === 'user';
	let timeStr = m.date_time || '';
	if (timeStr.includes(' ')) {
		timeStr = timeStr.split(' ')[1].slice(0, 5);
	}

	const modelKey = m.model ? m.model.toLowerCase() : '';
	const pref = prefMap && modelKey ? prefMap[modelKey] || prefMap[m.model!] : undefined;
	const avatarFromPref = formatAvatarPicture(pref?.picture);
	const charName = isCharEnabled(pref?.character) ? getCharacterName(pref?.character) : undefined;
	const displayName = charName || getCharacterName(pref?.character) || m.model || 'Assistant';

	return {
		id: m.id,
		senderName: isSelf ? 'You' : displayName,
		senderAvatar: isSelf ? undefined : avatarFromPref,
		isSelf,
		content: m.content,
		time: timeStr || 'now',
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
				<strong key={m.index} className='font-bold text-inherit'>
					{m[2]}
				</strong>,
			);
		} else if (m[3] !== undefined) {
			parts.push(
				<strong key={m.index} className='font-bold text-inherit'>
					{m[3]}
				</strong>,
			);
		} else if (m[4] !== undefined) {
			parts.push(
				<del key={m.index} className='line-through opacity-80'>
					{m[4]}
				</del>,
			);
		} else if (m[5] !== undefined) {
			parts.push(
				<em key={m.index} className='italic text-inherit'>
					{m[5]}
				</em>,
			);
		} else if (m[6] !== undefined) {
			parts.push(
				<em key={m.index} className='italic text-inherit'>
					{m[6]}
				</em>,
			);
		} else if (m[7] !== undefined) {
			parts.push(
				<code key={m.index} className='bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5 font-mono text-sm border border-black/5 dark:border-white/5'>
					{m[7]}
				</code>,
			);
		} else if (m[8] !== undefined && m[9] !== undefined) {
			parts.push(
				<a
					key={m.index}
					href={m[9]}
					target='_blank'
					rel='noreferrer'
					className='underline font-medium text-[#7678ed] hover:opacity-80 transition-opacity'
				>
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
	const lines = text.split('\n');
	const elements: React.ReactNode[] = [];
	let inUnorderedList = false;
	let currentUlItems: React.ReactNode[] = [];
	let inOrderedList = false;
	let currentOlItems: React.ReactNode[] = [];
	let inTable = false;
	let currentTableLines: string[] = [];

	const parseTableCells = (line: string): string[] => {
		let raw = line.trim();
		if (raw.startsWith('|')) raw = raw.slice(1);
		if (raw.endsWith('|')) raw = raw.slice(0, -1);
		return raw.split('|').map((cell) => cell.trim());
	};

	const isTableDivider = (line: string): boolean => {
		const cells = parseTableCells(line);
		return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.replace(/\s+/g, '')));
	};

	const flushListsAndTable = () => {
		if (inUnorderedList && currentUlItems.length > 0) {
			elements.push(
				<ul key={`ul-${elements.length}`} className='list-disc list-inside space-y-1 my-2 pl-2'>
					{currentUlItems}
				</ul>,
			);
			currentUlItems = [];
			inUnorderedList = false;
		}
		if (inOrderedList && currentOlItems.length > 0) {
			elements.push(
				<ol key={`ol-${elements.length}`} className='list-decimal list-inside space-y-1 my-2 pl-2'>
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
				<div key={`table-${elements.length}`} className='overflow-x-auto my-3 border border-[#e8ebf3] rounded-2xl shadow-xs select-text'>
					<table className='w-full text-left text-base border-collapse'>
						{headerCells.length > 0 && (
							<thead className='bg-[#f0f2f9] border-b border-[#e8ebf3] text-[#202022]'>
								<tr>
									{headerCells.map((h, i) => (
										<th key={i} className='px-4 py-3 font-bold border-r border-[#e8ebf3] last:border-r-0'>
											{parseFormatting(h)}
										</th>
									))}
								</tr>
							</thead>
						)}
						<tbody className='divide-y divide-[#e8ebf3] text-[#202022]'>
							{rowLines.map((rLine, rIdx) => {
								const cells = parseTableCells(rLine);
								return (
									<tr key={rIdx} className='hover:bg-[#f9fafc] transition-colors'>
										{cells.map((cell, cIdx) => (
											<td key={cIdx} className='px-4 py-2.5 font-normal border-r border-[#e8ebf3] last:border-r-0'>
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
		const hlClass = isHl
			? ' bg-[#7678ed]/20 border-l-4 border-[#7678ed] pl-2.5 py-0.5 rounded-r-xl transition-all duration-300 font-medium text-[#111] shadow-xs'
			: '';
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
		if (trimmed.startsWith('|') && (trimmed.endsWith('|') || trimmed.includes('|'))) {
			if (inUnorderedList || inOrderedList) flushListsAndTable();
			inTable = true;
			currentTableLines.push(trimmed);
			return;
		}

		if (inTable) {
			flushListsAndTable();
		}

		// Headers
		if (trimmed.startsWith('# ')) {
			flushListsAndTable();
			elements.push(
				<h1 key={idx} {...getMenuProps()} className={`text-2xl font-extrabold text-[#202022] my-2${hlClass}`}>
					{parseFormatting(trimmed.slice(2))}
				</h1>,
			);
			return;
		}
		if (trimmed.startsWith('## ')) {
			flushListsAndTable();
			elements.push(
				<h2 key={idx} {...getMenuProps()} className={`text-xl font-bold text-[#202022] my-2${hlClass}`}>
					{parseFormatting(trimmed.slice(3))}
				</h2>,
			);
			return;
		}
		if (trimmed.startsWith('### ')) {
			flushListsAndTable();
			elements.push(
				<h3 key={idx} {...getMenuProps()} className={`text-lg font-bold text-[#202022] my-1.5${hlClass}`}>
					{parseFormatting(trimmed.slice(4))}
				</h3>,
			);
			return;
		}
		if (trimmed.startsWith('#### ')) {
			flushListsAndTable();
			elements.push(
				<h4 key={idx} {...getMenuProps()} className={`text-base font-bold text-[#202022] my-1${hlClass}`}>
					{parseFormatting(trimmed.slice(5))}
				</h4>,
			);
			return;
		}
		if (trimmed.startsWith('##### ') || trimmed.startsWith('###### ')) {
			flushListsAndTable();
			elements.push(
				<h5 key={idx} {...getMenuProps()} className={`text-sm font-bold uppercase tracking-wider text-[#8e90a6] my-1${hlClass}`}>
					{parseFormatting(trimmed.replace(/^#+\s*/, ''))}
				</h5>,
			);
			return;
		}

		// Horizontal rule
		if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
			flushListsAndTable();
			elements.push(<hr key={idx} className='my-3 border-t border-[#e8ebf3]' />);
			return;
		}

		// Blockquote
		if (trimmed.startsWith('> ')) {
			flushListsAndTable();
			elements.push(
				<blockquote
					key={idx}
					{...getMenuProps()}
					className={`border-l-4 border-[#7678ed] pl-3 py-1 my-2 text-[#4a4d63] italic bg-[#f0f2f9]/50 rounded-r-xl${hlClass}`}
				>
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
			elements.push(<div key={idx} className='h-1.5' />);
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
		<div key={keyPrefix} className='space-y-1'>
			{elements}
		</div>
	);
};

const highlightCodeTokens = (code: string, lang?: string): React.ReactNode => {
	if (!code) return null;
	const language = (lang || '').toLowerCase();

	const tokenRegex = new RegExp(
		[
			'(?:\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#[^\\n]*)',
			'(?:"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`)',
			'\\b(?:0x[0-9a-fA-F]+|\\d+\\.\\d+|\\d+)\\b',
			'\\b(?:const|let|var|function|def|fn|class|extends|interface|type|struct|enum|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|delete|import|export|from|as|default|async|await|yield|this|super|self|public|private|protected|static|readonly|abstract|implements|namespace|using|package|include|require|typeof|instanceof|void|null|undefined|true|false|True|False|None|and|or|not|is|in|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|GROUP|BY|ORDER|HAVING|LIMIT|CREATE|TABLE|DROP|ALTER|ADD|INDEX)\\b',
			'\\b(?:string|number|boolean|any|unknown|never|object|symbol|bigint|int|float|double|char|bool|void|Array|Map|Set|Promise|Record|List|Dict|Tuple|React|useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer|Component|HTML|Element|String|Number|Boolean|Object|Function|Math|JSON|Console|process|window|document)\\b',
			'\\b[a-zA-Z_]\\w*\\b',
			'[=\\+\\-\\*/%&\\|\\^!<>~\\?:;\\,\\.\\{\\}\\[\\]\\(\\)]',
		].join('|'),
		'g',
	);

	const elements: React.ReactNode[] = [];
	let lastIndex = 0;

	code.replace(tokenRegex, (match, offset) => {
		if (offset > lastIndex) {
			elements.push(code.slice(lastIndex, offset));
		}
		lastIndex = offset + match.length;

		let colorClass = 'text-[#f8f8f2]';
		if (/^\/\//.test(match) || /^\/\*/.test(match) || (language !== 'css' && /^#[^\n]*/.test(match))) {
			colorClass = 'text-[#75715e] italic';
		} else if (/^["'`]/.test(match)) {
			colorClass = 'text-[#e6db74]';
		} else if (/^\d/.test(match) || /^0x/.test(match)) {
			colorClass = 'text-[#ae81ff]';
		} else if (
			/^(const|let|var|function|def|fn|class|extends|interface|type|struct|enum|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|delete|import|export|from|as|default|async|await|yield|this|super|self|public|private|protected|static|readonly|abstract|implements|namespace|using|package|include|require|typeof|instanceof|void|null|undefined|true|false|True|False|None|and|or|not|is|in|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|GROUP|BY|ORDER|HAVING|LIMIT|CREATE|TABLE|DROP|ALTER|ADD|INDEX)$/i.test(
				match,
			)
		) {
			colorClass = 'text-[#ff79c6] font-semibold';
		} else if (
			/^(string|number|boolean|any|unknown|never|object|symbol|bigint|int|float|double|char|bool|void|Array|Map|Set|Promise|Record|List|Dict|Tuple|React|useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer|Component|HTML|Element|String|Number|Boolean|Object|Function|Math|JSON|Console|process|window|document)$/.test(
				match,
			)
		) {
			colorClass = 'text-[#8be9fd] font-semibold';
		} else if (
			/^[a-zA-Z_]\w*$/.test(match) &&
			code
				.slice(offset + match.length)
				.trim()
				.startsWith('(')
		) {
			colorClass = 'text-[#50fa7b]';
		} else if (/^[=\+\-\*/%&\|^\!<>~\?:;\,\.\{\}\[\]\(\)]$/.test(match)) {
			colorClass = 'text-[#ff79c6]';
		}

		elements.push(
			<span key={offset} className={colorClass}>
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

	const lineCount = code ? code.split('\n').length : 0;

	return (
		<div className='my-3 rounded-2xl bg-[#1e1e24] text-[#f8f8f2] overflow-hidden shadow-md border border-white/10 select-text'>
			<div className='flex items-center justify-between px-4 py-2 bg-[#18181c] border-b border-white/10 text-xs font-sans'>
				<div className='flex items-center gap-2 font-semibold text-white/70 uppercase tracking-wider'>
					<span className='w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block' />
					<span className='w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block' />
					<span className='w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block mr-1.5' />
					<span>{language || 'code'}</span>
					<span className='text-white/40 text-[10px] font-normal lowercase'>({lineCount} lines)</span>
				</div>
				<button
					type='button'
					onClick={handleCopy}
					className='flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer font-medium'
				>
					{copied ? (
						<>
							<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
								<polyline points='20 6 9 17 4 12' />
							</svg>
							<span>Copied!</span>
						</>
					) : (
						<>
							<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
								<rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
								<path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
							</svg>
							<span>Copy code</span>
						</>
					)}
				</button>
			</div>

			<div className='p-4 overflow-x-auto text-sm font-mono leading-relaxed whitespace-pre-wrap'>{highlightCodeTokens(code, language)}</div>
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
		const lang = match[1] || '';
		const codeContent = match[2]?.trim() || '';
		elements.push(<CodeBlock key={`code-${match.index}`} code={codeContent} language={lang} />);
		lastIndex = codeBlockRegex.lastIndex;
	}

	if (lastIndex < text.length) {
		elements.push(renderInlineMarkdown(text.slice(lastIndex), `text-${lastIndex}`, activeLineIndex, onLineContextMenu));
	}

	return <>{elements}</>;
};

const getAttachmentType = (fileName: string, mimeType: string): 'image' | 'plain_text' | 'code' => {
	if (mimeType.startsWith('image/')) return 'image';
	const ext = fileName.split('.').pop()?.toLowerCase() || '';
	const codeExts = [
		'c',
		'h',
		'css',
		'html',
		'js',
		'ts',
		'jsx',
		'tsx',
		'py',
		'java',
		'json',
		'xml',
		'asm',
		'nasm',
		'cs',
		'cpp',
		'cxx',
		'hpp',
		'csv',
		'lsp',
		'lisp',
		'dockerfile',
		'glsl',
		'lua',
		'php',
		'rb',
		'ru',
		'rs',
		'sql',
		'sh',
		'yaml',
		'yml',
		'p8',
		'go',
		'env',
	];
	const imageExts = ['png', 'jpeg', 'jpg', 'webp', 'gif', 'svg', 'bmp'];
	if (imageExts.includes(ext)) return 'image';
	if (codeExts.includes(ext)) return 'code';
	return 'plain_text';
};

const DocumentAttachmentCard = ({ attachment, extension, isSelf }: { attachment: MessageAttachment | any; extension: string; isSelf?: boolean }) => {
	const [expanded, setExpanded] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleCopy = (e: React.MouseEvent) => {
		e.stopPropagation();
		navigator.clipboard.writeText(attachment.content || '');
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const name = attachment.name || `file.${extension}`;
	const lines = attachment.content ? attachment.content.split('\n').length : 0;
	const sizeKb = attachment.content ? (new Blob([attachment.content]).size / 1024).toFixed(1) : '0';

	return (
		<div
			className={`rounded-xl border transition-all overflow-hidden my-1 w-full max-w-full ${
				isSelf ? 'bg-white/10 border-white/25 text-white shadow-xs' : 'bg-white border-[#e2e5f1] text-[#2d3142] shadow-xs'
			}`}
		>
			<div className='flex items-center justify-between px-3.5 py-2.5 gap-3'>
				<div className='flex items-center gap-2.5 min-w-0 flex-1'>
					<div
						className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
							isSelf ? 'bg-white/20 text-white' : 'bg-[#7678ed]/15 text-[#7678ed]'
						}`}
					>
						{extension}
					</div>
					<div className='flex flex-col min-w-0 flex-1'>
						<span className='text-sm font-semibold truncate' title={name}>
							{name}
						</span>
						<span className={`text-[11px] ${isSelf ? 'text-white/75' : 'text-[#8e90a6]'}`}>
							{sizeKb} KB • {lines} line{lines !== 1 ? 's' : ''}
						</span>
					</div>
				</div>

				<div className='flex items-center gap-1 shrink-0'>
					<button
						type='button'
						onClick={handleCopy}
						className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
							isSelf ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-[#f4f6fc] hover:bg-[#eef0f6] text-[#7678ed] border border-[#e2e5f1]'
						}`}
						title='Copy content'
					>
						{copied ? (
							<>
								<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
									<polyline points='20 6 9 17 4 12' />
								</svg>
								<span>Copied</span>
							</>
						) : (
							<>
								<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
									<rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
									<path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
								</svg>
								<span>Copy</span>
							</>
						)}
					</button>

					<button
						type='button'
						onClick={() => setExpanded(!expanded)}
						className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
							isSelf ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-[#f4f6fc] hover:bg-[#eef0f6] text-[#5d6075] border border-[#e2e5f1]'
						}`}
						title={expanded ? 'Collapse preview' : 'View content'}
					>
						<svg
							width='14'
							height='14'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
							className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
						>
							<polyline points='6 9 12 15 18 9' />
						</svg>
					</button>
				</div>
			</div>

			{expanded && (
				<div
					className={`p-3 border-t text-xs font-mono overflow-x-auto max-h-60 leading-relaxed whitespace-pre-wrap select-text ${
						isSelf ? 'bg-black/30 border-white/15 text-white/90' : 'bg-[#1e1e24] border-[#e2e5f1] text-[#f8f8f2]'
					}`}
				>
					{highlightCodeTokens(attachment.content || '', extension)}
				</div>
			)}
		</div>
	);
};

export default function AlpacaWebPage() {
	const messagesEndRef = useRef<HTMLDivElement>(null);
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
			alert('Maximum limit of 4 attachments (images or document files) reached.');
			if (e.target) e.target.value = '';
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
				const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';

				reader.onload = () => {
					if (typeof reader.result === 'string') {
						resolve({
							id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
							name: file.name,
							type: attType,
							content: reader.result,
							size: file.size,
							extension: ext,
						});
					} else {
						reject(new Error('Failed to read file'));
					}
				};
				reader.onerror = () => reject(reader.error);

				if (attType === 'image') {
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
				console.error('Error reading attached files:', err);
			});

		if (e.target) e.target.value = '';
	};

	const handleRemoveSelectedAttachment = (indexToRemove: number) => {
		setSelectedAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
	};

	// Zustand Store Integration for long-lived data caching & navigation
	const {
		instances,
		modelPreferences,
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
		draggedChatId,
		setDraggedChatId,
		folderContextMenu,
		setFolderContextMenu,
		isCreatingFolder,
		setIsCreatingFolder,
	} = useAppStore();

	const [activeAttachmentModal, setActiveAttachmentModal] = useState<{ title: string; type: string; content: string } | null>(null);
	const [activeImageModal, setActiveImageModal] = useState<{ src: string; title?: string } | null>(null);
	const [isChatContextMenuOpen, setIsChatContextMenuOpen] = useState<boolean>(false);
	const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
	const [renameInputVal, setRenameInputVal] = useState<string>('');
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
	const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);
	const [isForkModalOpen, setIsForkModalOpen] = useState<boolean>(false);
	const [forkTargetMsg, setForkTargetMsg] = useState<Message | null>(null);
	const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
	const [exportFormat, setExportFormat] = useState<'md' | 'obsidian' | 'json' | 'txt'>('md');
	const [editingModel, setEditingModel] = useState<any | null>(null);
	const [editModelVoice, setEditModelVoice] = useState<string>('af_heart');
	const [editModelNumCtx, setEditModelNumCtx] = useState<number>(8192);
	const [editModelName, setEditModelName] = useState<string>('');
	const [editModelDescription, setEditModelDescription] = useState<string>('');
	const [editModelFirstMessage, setEditModelFirstMessage] = useState<string>('');
	const [editModelAlternateGreetings, setEditModelAlternateGreetings] = useState<string[]>([]);
	const [editModelCharacterBook, setEditModelCharacterBook] = useState<Array<{ name: string; description: string; tags: string }>>([]);
	const [isNewChatModalOpen, setIsNewChatModalOpen] = useState<boolean>(false);
	const [newChatTitleInput, setNewChatTitleInput] = useState<string>('New Chat');
	const [activeSettingsCategory, setActiveSettingsCategory] = useState<
		'import-chat' | 'manage-instances' | 'preferences' | 'manage-lorebook' | 'manage-personas' | 'about-walpaca'
	>('import-chat');

	// --- Manage Lorebook State & Handlers ---
	const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplate[]>([]);
	const [isLorebookLoading, setIsLorebookLoading] = useState<boolean>(false);
	const [lorebookSearchQuery, setLorebookSearchQuery] = useState<string>('');
	const [isLorebookModalOpen, setIsLorebookModalOpen] = useState<boolean>(false);
	const [editingLorebookTemplate, setEditingLorebookTemplate] = useState<LorebookTemplate | null>(null);
	const [lorebookFormName, setLorebookFormName] = useState<string>('');
	const [lorebookFormKeys, setLorebookFormKeys] = useState<string>('');
	const [lorebookFormContent, setLorebookFormContent] = useState<string>('');
	const [lorebookFormFilename, setLorebookFormFilename] = useState<string>('');
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
			console.error('Failed fetching lorebook templates:', err);
		} finally {
			setIsLorebookLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchLorebookTemplates();
	}, [fetchLorebookTemplates]);

	useEffect(() => {
		if (currentView === 'settings' && activeSettingsCategory === 'manage-lorebook') {
			fetchLorebookTemplates();
		}
	}, [currentView, activeSettingsCategory, fetchLorebookTemplates]);

	// --- Manage Personas State & Handlers ---
	const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplate[]>([]);
	const [isPersonaLoading, setIsPersonaLoading] = useState<boolean>(false);
	const [personaSearchQuery, setPersonaSearchQuery] = useState<string>('');
	const [personaViewMode, setPersonaViewMode] = useState<'list' | 'editor'>('list');
	const [editingPersonaTemplate, setEditingPersonaTemplate] = useState<PersonaTemplate | null>(null);

	// Persona Editor Form State
	const [personaFormName, setPersonaFormName] = useState<string>('');
	const [personaFormDescription, setPersonaFormDescription] = useState<string>('');
	const [personaFormScenario, setPersonaFormScenario] = useState<string>('');
	const [personaFormSystemPrompt, setPersonaFormSystemPrompt] = useState<string>('');
	const [personaFormPostHistoryInstructions, setPersonaFormPostHistoryInstructions] = useState<string>('');
	const [personaFormFirstMes, setPersonaFormFirstMes] = useState<string>('');
	const [personaFormAlternateGreetings, setPersonaFormAlternateGreetings] = useState<string[]>([]);
	const [personaFormVoice, setPersonaFormVoice] = useState<string>('af_heart');
	const [personaFormPicture, setPersonaFormPicture] = useState<string>('');
	const [personaFormNumCtx, setPersonaFormNumCtx] = useState<number>(8192);
	const [personaFormTemperature, setPersonaFormTemperature] = useState<number>(0.7);
	const [personaFormTopP, setPersonaFormTopP] = useState<number>(0.9);
	const [personaFormTopK, setPersonaFormTopK] = useState<number>(40);
	const [personaFormRepeatPenalty, setPersonaFormRepeatPenalty] = useState<number>(1.1);
	const [personaFormPresencePenalty, setPersonaFormPresencePenalty] = useState<number>(0.0);
	const [personaFormFrequencyPenalty, setPersonaFormFrequencyPenalty] = useState<number>(0.0);
	const [personaFormLorebookEntries, setPersonaFormLorebookEntries] = useState<Array<{ name: string; keys: string; content: string; enabled: boolean }>>([]);
	const [personaAvatarPreview, setPersonaAvatarPreview] = useState<string>('');
	const [isUploadingPersonaAvatar, setIsUploadingPersonaAvatar] = useState<boolean>(false);

	const [personaSaving, setPersonaSaving] = useState<boolean>(false);
	const [deletingPersonaTemplate, setDeletingPersonaTemplate] = useState<PersonaTemplate | null>(null);

	// Apply Persona to Model Modal state
	const [applyPersonaModalTemplate, setApplyPersonaModalTemplate] = useState<PersonaTemplate | null>(null);
	const [applyPersonaSelectedModelId, setApplyPersonaSelectedModelId] = useState<string>('');
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
			console.error('Failed fetching persona templates:', err);
		} finally {
			setIsPersonaLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchPersonaTemplates();
	}, [fetchPersonaTemplates]);

	useEffect(() => {
		if (currentView === 'settings' && activeSettingsCategory === 'manage-personas') {
			fetchPersonaTemplates();
		}
	}, [currentView, activeSettingsCategory, fetchPersonaTemplates]);

	const handleOpenCreatePersonaEditor = () => {
		setEditingPersonaTemplate(null);
		setPersonaFormName('');
		setPersonaFormDescription('');
		setPersonaFormScenario('');
		setPersonaFormSystemPrompt('');
		setPersonaFormPostHistoryInstructions('');
		setPersonaFormFirstMes('');
		setPersonaFormAlternateGreetings([]);
		setPersonaFormVoice('af_heart');
		setPersonaFormPicture('');
		setPersonaAvatarPreview('');
		setPersonaFormNumCtx(8192);
		setPersonaFormTemperature(0.7);
		setPersonaFormTopP(0.9);
		setPersonaFormTopK(40);
		setPersonaFormRepeatPenalty(1.1);
		setPersonaFormPresencePenalty(0.0);
		setPersonaFormFrequencyPenalty(0.0);
		setPersonaFormLorebookEntries([]);
		setPersonaViewMode('editor');
	};

	const handleOpenEditPersonaEditor = (template: PersonaTemplate) => {
		setEditingPersonaTemplate(template);
		setPersonaFormName(template.name || '');
		setPersonaFormDescription(template.description || template.personality || '');
		setPersonaFormScenario(template.scenario || '');
		setPersonaFormSystemPrompt(template.system_prompt || '');
		setPersonaFormPostHistoryInstructions(template.post_history_instructions || '');
		setPersonaFormFirstMes(template.first_mes || template.greeting || '');
		setPersonaFormAlternateGreetings(Array.isArray(template.alternate_greetings) ? [...template.alternate_greetings] : []);
		setPersonaFormVoice(template.voice || 'af_heart');
		setPersonaFormPicture(template.picture || '');
		setPersonaAvatarPreview(template.picture || '');
		setPersonaFormNumCtx(template.num_ctx || 8192);
		setPersonaFormTemperature(template.generation_settings?.temperature ?? template.temperature ?? 0.7);
		setPersonaFormTopP(template.generation_settings?.top_p ?? template.top_p ?? 0.9);
		setPersonaFormTopK(template.generation_settings?.top_k ?? template.top_k ?? 40);
		setPersonaFormRepeatPenalty(template.generation_settings?.repeat_penalty ?? template.repeat_penalty ?? 1.1);
		setPersonaFormPresencePenalty(template.generation_settings?.presence_penalty ?? template.presence_penalty ?? 0.0);
		setPersonaFormFrequencyPenalty(template.generation_settings?.frequency_penalty ?? template.frequency_penalty ?? 0.0);

		const rawEntries = template.character_book?.entries || [];
		const parsedEntries = rawEntries.map((e) => ({
			name: e.name || 'Entry',
			keys: Array.isArray(e.keys) ? e.keys.join(', ') : e.keys || '',
			content: e.content || '',
			enabled: e.enabled !== false,
		}));
		setPersonaFormLorebookEntries(parsedEntries);
		setPersonaViewMode('editor');
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
			formData.append('file', file);

			const res = await fetch(`${getApiUrl()}/personas/avatar`, {
				method: 'POST',
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
				alert(errData.error || 'Failed uploading avatar image');
			}
		} catch (err: any) {
			console.error('Error uploading persona avatar:', err);
			alert(err.message || 'Error uploading avatar image');
		} finally {
			setIsUploadingPersonaAvatar(false);
		}
	};

	const handleAddPersonaGreeting = () => {
		setPersonaFormAlternateGreetings((prev) => [...prev, '']);
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
		setPersonaFormLorebookEntries((prev) => [...prev, { name: 'New Entry', keys: 'name, keyword', content: '', enabled: true }]);
	};

	const handleCopyLorebookTemplateToPersona = (filename: string) => {
		if (!filename) return;
		const tmpl = lorebookTemplates.find((l) => l.filename === filename);
		if (!tmpl) return;

		setPersonaFormLorebookEntries((prev) => [
			...prev,
			{
				name: tmpl.name || tmpl.filename.replace('.json', ''),
				keys: Array.isArray(tmpl.keys) ? tmpl.keys.join(', ') : tmpl.keys || '',
				content: tmpl.content || '',
				enabled: true,
			},
		]);
	};

	const handleUpdatePersonaLorebookEntry = (idx: number, field: 'name' | 'keys' | 'content' | 'enabled', value: any) => {
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
							.split(',')
							.map((k) => k.trim())
							.filter(Boolean),
						content: e.content,
						enabled: e.enabled !== false,
					})),
				},
			};

			let url = `${getApiUrl()}/personas`;
			let method = 'POST';

			if (editingPersonaTemplate) {
				url = `${getApiUrl()}/personas/${encodeURIComponent(editingPersonaTemplate.filename)}`;
				method = 'PUT';
			}

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				setPersonaViewMode('list');
				fetchPersonaTemplates();
			} else {
				const errData = await res.json();
				alert(errData.error || 'Failed saving persona template');
			}
		} catch (err: any) {
			console.error('Error saving persona template:', err);
			alert(err.message || 'Error saving template');
		} finally {
			setPersonaSaving(false);
		}
	};

	const handleConfirmDeletePersonaTemplate = async () => {
		if (!deletingPersonaTemplate) return;

		try {
			const filename = deletingPersonaTemplate.filename;
			const res = await fetch(`${getApiUrl()}/personas/${encodeURIComponent(filename)}`, {
				method: 'DELETE',
			});
			if (res.ok) {
				setDeletingPersonaTemplate(null);
				fetchPersonaTemplates();
			} else {
				const errData = await res.json();
				alert(errData.error || 'Failed deleting persona template');
			}
		} catch (err: any) {
			console.error('Error deleting persona template:', err);
			alert(err.message || 'Error deleting template');
		}
	};

	const handleApplyPersonaToModel = async (template: PersonaTemplate, targetModelId: string) => {
		if (!targetModelId) return;
		setIsApplyingPersona(true);
		try {
			const payload = {
				id: targetModelId,
				picture: template.picture || null,
				voice: template.voice || 'af_heart',
				num_ctx: template.num_ctx ? Number(template.num_ctx) : undefined,
				character: {
					name: template.name,
					description: template.description || '',
					personality: template.description || '',
					scenario: template.scenario || '',
					system_prompt: template.system_prompt || '',
					post_history_instructions: template.post_history_instructions || '',
					first_mes: template.first_mes || '',
					alternate_greetings: template.alternate_greetings || [],
					character_book: template.character_book || null,
					generation_settings: template.generation_settings || null,
				},
			};

			const res = await fetch(`${getApiUrl()}/model-preferences`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				await fetchModelPreferences();
				setApplyPersonaModalTemplate(null);
				alert(`Successfully applied persona '${template.name}' to model '${targetModelId}'!`);
			} else {
				const errData = await res.json();
				alert(errData.error || 'Failed applying persona to model');
			}
		} catch (err: any) {
			console.error('Error applying persona to model:', err);
			alert(err.message || 'Error applying persona to model');
		} finally {
			setIsApplyingPersona(false);
		}
	};

	const handleOpenCreateLorebookModal = () => {
		setEditingLorebookTemplate(null);
		setLorebookFormName('');
		setLorebookFormKeys('');
		setLorebookFormContent('');
		setLorebookFormFilename('');
		setIsLorebookModalOpen(true);
	};

	const handleOpenEditLorebookModal = (template: LorebookTemplate) => {
		setEditingLorebookTemplate(template);
		setLorebookFormName(template.name);
		setLorebookFormKeys(Array.isArray(template.keys) ? template.keys.join(', ') : '');
		setLorebookFormContent(template.content || '');
		setLorebookFormFilename(template.filename);
		setIsLorebookModalOpen(true);
	};

	const handleSaveLorebookTemplate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!lorebookFormName.trim()) return;

		setLorebookSaving(true);
		try {
			const keysArray = lorebookFormKeys
				.split(',')
				.map((k) => k.trim())
				.filter(Boolean);

			const payload: any = {
				name: lorebookFormName.trim(),
				keys: keysArray,
				content: lorebookFormContent,
			};

			let url = `${getApiUrl()}/lorebook`;
			let method = 'POST';

			if (editingLorebookTemplate) {
				url = `${getApiUrl()}/lorebook/${encodeURIComponent(editingLorebookTemplate.filename)}`;
				method = 'PUT';
			} else if (lorebookFormFilename.trim()) {
				payload.filename = lorebookFormFilename.trim();
			}

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				setIsLorebookModalOpen(false);
				fetchLorebookTemplates();
			} else {
				const errData = await res.json();
				alert(errData.error || 'Failed saving lorebook template');
			}
		} catch (err: any) {
			console.error('Error saving lorebook template:', err);
			alert(err.message || 'Error saving template');
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
				method: 'DELETE',
			});
			if (res.ok) {
				setDeletingLorebookTemplate(null);
				fetchLorebookTemplates();
			} else {
				const errData = await res.json();
				alert(errData.error || 'Failed deleting template');
			}
		} catch (err: any) {
			console.error('Error deleting template:', err);
			alert(err.message || 'Error deleting template');
		}
	};

	// --- Instances Management State & Handlers ---
	const [instanceSubView, setInstanceSubView] = useState<'list' | 'select-type' | 'form' | 'instance-models' | 'edit-model'>('list');
	const [selectedInstanceForModels, setSelectedInstanceForModels] = useState<InstanceItem | null>(null);
	const [instanceModelsList, setInstanceModelsList] = useState<any[]>([]);
	const [selectedInstanceType, setSelectedInstanceType] = useState<string>('Ollama');
	const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

	// Chat Instance & Model Selector State
	const [selectedChatInstanceId, setSelectedChatInstanceId] = useState<string>('');
	const [selectedChatModelId, setSelectedChatModelId] = useState<string>('');
	const [isThinkingEnabled, setIsThinkingEnabled] = useState<boolean>(false);
	const [isSelectModelModalOpen, setIsSelectModelModalOpen] = useState<boolean>(false);
	const [modelModalSearchQuery, setModelModalSearchQuery] = useState<string>('');

	// Chat Drag & Drop to Folders State & Handler
	const [dragOverFolderTarget, setDragOverFolderTarget] = useState<string | null>(null);

	// Import Chat State & Handlers
	const [isImporting, setIsImporting] = useState<boolean>(false);
	const [importStatusMessage, setImportStatusMessage] = useState<string>('');
	const [isDraggingImport, setIsDraggingImport] = useState<boolean>(false);
	const importFileInputRef = useRef<HTMLInputElement>(null);

	const parseImportContent = (fileName: string, text: string): any[] => {
		const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
		const trimmed = text.trim();

		// 1. JSON Parsing
		if (fileName.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
			try {
				const parsed = JSON.parse(text);
				const results: any[] = [];

				const processJsonObject = (obj: any): any | null => {
					if (!obj || typeof obj !== 'object') return null;

					// ChatGPT export format (mapping object)
					if (obj.mapping && typeof obj.mapping === 'object') {
						const title = obj.title || cleanFileName;
						const msgs: any[] = [];
						Object.values(obj.mapping).forEach((node: any) => {
							const msg = node?.message;
							if (msg && msg.content && Array.isArray(msg.content.parts)) {
								const textParts = msg.content.parts.filter((p: any) => typeof p === 'string').join('\n');
								if (textParts.trim()) {
									const authorRole = msg.author?.role;
									const role = authorRole === 'user' ? 'user' : 'assistant';
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
								role: m.sender === 'human' || m.sender === 'user' ? 'user' : 'assistant',
								content: m.text || m.content || '',
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
								role: m.role === 'user' || m.isSelf ? 'user' : 'assistant',
								content: m.content || '',
								model: m.model,
								date_time: m.time || m.date_time,
								attachments: Array.isArray(m.attachments)
									? m.attachments.map((a: any) => ({
											name: a.name || 'attachment',
											type: a.type || 'txt',
											content: a.content || '',
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
				console.warn('JSON import parse warning:', e);
			}
		}

		// 2. Markdown Parsing (.md / .markdown)
		if (fileName.endsWith('.md') || fileName.endsWith('.markdown') || text.includes('# ') || text.includes('### ')) {
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
					const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

					let body = sec
						.replace(/^###\s+.+$/m, '')
						.replace(/^----\s*$/m, '')
						.trim();
					const attachments: any[] = [];

					// HTML details tags
					body = body.replace(
						/<details>\s*<summary>.*?([^\/\s>]+)<\/summary>\s*```[\w]*\n([\s\S]*?)```\s*<\/details>/gi,
						(_, attName, attContent) => {
							attachments.push({ name: attName.trim(), type: 'txt', content: attContent.trim() });
							return '';
						},
					);

					// Obsidian callouts (> [!quote]- filename)
					body = body.replace(/^>\s*\[!(?:quote|info)\]-?\s*(.+)\n((?:>\s*.*\n?)*)/gm, (_, attName, blockContent) => {
						const cleanContent = blockContent
							.split('\n')
							.map((l: string) => l.replace(/^>\s?/, ''))
							.join('\n')
							.trim();
						attachments.push({ name: attName.trim(), type: 'txt', content: cleanContent });
						return '';
					});

					body = body.trim();
					if (body || attachments.length > 0) {
						messages.push({
							role,
							content: body,
							model: !isUser && senderStr !== 'Assistant' ? senderStr : undefined,
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

		const textLines = text.split('\n');
		const messages: any[] = [];
		let currentSender = '';
		let currentTime = '';
		let currentLines: string[] = [];

		const flushMessage = () => {
			if (currentSender && currentLines.length > 0) {
				const isUser = /you|user/i.test(currentSender);
				const content = currentLines.join('\n').trim();
				if (content) {
					messages.push({
						role: isUser ? 'user' : 'assistant',
						content,
						model: !isUser && currentSender !== 'Assistant' ? currentSender : undefined,
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
			} else if (line.trim() === '----------------------------------------') {
				flushMessage();
				currentSender = '';
			} else if (!line.startsWith('===') && !line.startsWith('Generated from AlpacaWeb')) {
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
				messages: [{ role: 'user', content: trimmed }],
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
				setImportStatusMessage('No valid chat messages found in selected file(s).');
				setIsImporting(false);
				return;
			}

			setImportStatusMessage(`Importing ${allParsedChats.length} conversation(s)...`);
			const res = await fetch(`${API_URL}/chats/import`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ chats: allParsedChats }),
			});

			if (!res.ok) {
				throw new Error('Failed to import chats');
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
					setCurrentView('chat');
				}, 800);
			}
		} catch (e: any) {
			console.error('Import error:', e);
			setImportStatusMessage(`Import failed: ${e.message || 'Unknown error'}`);
		} finally {
			setIsImporting(false);
		}
	};

	const handleDropChatToFolder = async (chatId: string, targetFolderId: string | null) => {
		setDragOverFolderTarget(null);
		setDraggedChatId(null);
		if (!chatId) return;

		const targetFolderVal = targetFolderId === 'none' || !targetFolderId ? null : targetFolderId;

		setChatItems((prev) => prev.map((c) => (c.id === chatId ? { ...c, folder: targetFolderVal || undefined } : c)));

		try {
			await fetch(`${API_URL}/chats/${chatId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folder: targetFolderVal }),
			});
		} catch (err) {
			console.warn('Could not move chat to folder on backend:', err);
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
	const [renameFolderNameInput, setRenameFolderNameInput] = useState<string>('');
	const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string } | null>(null);

	useEffect(() => {
		const handleGlobalClick = () => {
			setFolderContextMenu(null);
			setLineContextMenu(null);
		};
		window.addEventListener('click', handleGlobalClick);
		return () => window.removeEventListener('click', handleGlobalClick);
	}, []);

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
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName }),
			});
		} catch (err) {
			console.warn('Could not rename folder on backend:', err);
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
			setActiveTab('none');
		}

		try {
			await fetch(`${API_URL}/folders/${id}`, {
				method: 'DELETE',
			});
			fetchChats(activeTab === id ? 'none' : activeTab);
		} catch (err) {
			console.warn('Could not delete folder on backend:', err);
		}
	};

	// Inline Message Editing States & Handlers
	const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
	const [editingMsgContent, setEditingMsgContent] = useState<string>('');
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
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message_id: targetMsgId }),
			});

			if (!res.ok) {
				throw new Error('Failed to fork chat');
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
			console.error('Fork Chat Error:', e);
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
		setEditingMsgContent('');

		try {
			await fetch(`${API_URL}/messages/${msgId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: updatedContent }),
			});
		} catch (err) {
			console.warn('Could not update message content on backend:', err);
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
				method: 'DELETE',
			});
		} catch (err) {
			console.warn('Could not delete message on backend:', err);
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
				{ id: `${inst.id}-m1`, name: `${instName} Model 1`, provider: inst.type, voice: 'af_heart', context: '8,192 tokens' },
				{ id: `${inst.id}-m2`, name: `${instName} Model 2`, provider: inst.type, voice: 'am_adam', context: '16,384 tokens' },
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
			time: 'Just now',
			unreadCount: undefined,
		};

		setChatItems((prev) => [newChatObj, ...prev]);
		setActiveChatId(newId);
		if (typeof window !== 'undefined') {
			window.history.pushState(null, '', `/?chat=${newId}`);
		}

		try {
			await fetch(`${API_URL}/chats`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: newId,
					name: duplicateName,
					folder: targetChat.folder || null,
				}),
			});
		} catch (err) {
			console.warn('Could not duplicate chat on backend API:', err);
		}
	};

	const handleOpenEditModelModal = (mod: any) => {
		setEditingModel(mod);
		const rawId = String(mod.id || '');
		const prefKey = rawId.toLowerCase();
		const pref = modelPreferences[rawId] || modelPreferences[prefKey];
		setEditModelVoice(pref?.voice || mod.voice || 'af_heart');
		setEditModelNumCtx(
			pref?.num_ctx ?? (typeof mod.num_ctx === 'number' ? mod.num_ctx : mod.context ? parseInt(String(mod.context).replace(/,/g, ''), 10) || 8192 : 8192),
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
				tags: Array.isArray(e.keys) ? e.keys.join(', ') : Array.isArray(e.tags) ? e.tags.join(', ') : String(e.keys || e.tags || ''),
			}));
		} else if (Array.isArray(charData.character_book)) {
			cbItems = charData.character_book.map((e: any) => ({
				name: e.name || e.comment || '',
				description: e.description || e.content || '',
				tags: Array.isArray(e.tags) ? e.tags.join(', ') : Array.isArray(e.keys) ? e.keys.join(', ') : String(e.tags || e.keys || ''),
			}));
		}
		setEditModelCharacterBook(cbItems);
		setInstanceSubView('edit-model');
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
		setEditModelCharacterBook(editModelCharacterBook.map((item, i) => (i === index ? { ...item, [field]: val } : item)));
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
			const tagsArr = item.tags
				.split(',')
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
		setInstanceSubView('instance-models');

		try {
			await fetch(`${API_URL}/model-preferences`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: rawId,
					voice: editModelVoice,
					num_ctx: editModelNumCtx,
					character: updatedCharacter,
				}),
			});
		} catch (err) {
			console.warn('Could not save model preference:', err);
		}
	};

	const handleManageInstanceModels = async (inst: InstanceItem) => {
		setSelectedInstanceForModels(inst);
		setInstanceSubView('instance-models');

		await fetchModelPreferences();
		const data = await fetchInstanceModels(inst.id);
		if (Array.isArray(data) && data.length > 0) {
			setInstanceModelsList(data);
			return;
		}
		const instName = inst.properties?.name || inst.type;
		setInstanceModelsList([
			{ id: `${inst.id}-m1`, name: `${instName} Model 1`, provider: inst.type, voice: 'af_heart', context: '8,192 tokens' },
			{ id: `${inst.id}-m2`, name: `${instName} Model 2`, provider: inst.type, voice: 'am_adam', context: '16,384 tokens' },
		]);
	};

	// Instance Form fields matching user specs
	const [instFormName, setInstFormName] = useState<string>('Instance');
	const [instFormUrl, setInstFormUrl] = useState<string>('http://0.0.0.0:11434');
	const [instFormApiKey, setInstFormApiKey] = useState<string>('');
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
	const [instFormKeepAlivePreset, setInstFormKeepAlivePreset] = useState<string>('Set Timer');
	const [instFormKeepAliveMinutes, setInstFormKeepAliveMinutes] = useState<number>(5);

	const handleOpenAddInstanceModal = () => {
		setInstanceSubView('select-type');
	};

	const handleSelectInstanceType = (typeLabel: string) => {
		setSelectedInstanceType(typeLabel);
		setEditingInstanceId(null); // Add mode

		// Dynamic default values for new instance based on selected provider type
		let defaultName = 'Instance';
		let defaultUrl = 'http://0.0.0.0:11434';
		if (typeLabel.includes('Ollama')) {
			defaultName = 'Ollama External';
			defaultUrl = 'http://0.0.0.0:11434';
		} else if (typeLabel.includes('Ollama (Cloud)')) {
			defaultName = 'Ollama Cloud';
			defaultUrl = 'https://ollama.example.com';
		} else if (typeLabel.includes('OpenAI')) {
			defaultName = 'OpenAI ChatGPT';
			defaultUrl = 'https://api.openai.com/v1';
		} else if (typeLabel.includes('Gemini')) {
			defaultName = 'Google Gemini';
			defaultUrl = 'https://generativelanguage.googleapis.com';
		} else if (typeLabel.includes('Anthropic')) {
			defaultName = 'Anthropic Claude';
			defaultUrl = 'https://api.anthropic.com';
		} else if (typeLabel.includes('Deepseek')) {
			defaultName = 'Deepseek AI';
			defaultUrl = 'https://api.deepseek.com';
		} else if (typeLabel.includes('Groq')) {
			defaultName = 'Groq Cloud';
			defaultUrl = 'https://api.groq.com/openai/v1';
		} else if (typeLabel.includes('Together')) {
			defaultName = 'Together AI';
			defaultUrl = 'https://api.together.xyz/v1';
		} else if (typeLabel.includes('Venice')) {
			defaultName = 'Venice AI';
			defaultUrl = 'https://api.venice.ai/api/v1';
		} else if (typeLabel.includes('OpenRouter')) {
			defaultName = 'OpenRouter AI';
			defaultUrl = 'https://openrouter.ai/api/v1';
		}

		setInstFormName(defaultName);
		setInstFormUrl(defaultUrl);
		setInstFormApiKey('');
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
		setInstFormKeepAlivePreset('Set Timer');
		setInstFormKeepAliveMinutes(5);

		setInstanceSubView('form');
	};

	const handleOpenEditInstanceModal = (inst: InstanceItem) => {
		setEditingInstanceId(inst.id); // Edit mode - type is locked!
		setSelectedInstanceType(
			inst.type === 'ollama'
				? 'Ollama'
				: inst.type === 'openai'
					? 'OpenAI ChatGPT'
					: inst.type === 'gemini'
						? 'Google Gemini'
						: inst.type === 'anthropic'
							? 'Anthropic'
							: inst.type === 'deepseek'
								? 'Deepseek'
								: inst.type === 'groq'
									? 'Groq Cloud'
									: inst.type === 'together'
										? 'Together AI'
										: inst.type === 'venice'
											? 'Venice'
											: inst.type === 'openrouter'
												? 'OpenRouter AI'
												: inst.type,
		);
		setInstFormName(inst.properties?.name || 'Instance');
		setInstFormUrl(inst.properties?.url || 'http://0.0.0.0:11434');
		setInstFormApiKey(inst.properties?.api && inst.properties.api !== 'NOKEY' ? inst.properties.api : '');
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

		setInstanceSubView('form');
	};

	const handleDeleteInstance = async (id: string) => {
		setStoreInstances(instances.filter((item) => item.id !== id));
		try {
			await fetch(`${API_URL}/instances/${id}`, { method: 'DELETE' });
			fetchInstances(true);
		} catch (err) {
			console.warn('Could not delete instance:', err);
		}
	};

	const handleSaveInstanceForm = async (e: React.FormEvent) => {
		e.preventDefault();

		let backendType = 'ollama';
		if (selectedInstanceType.includes('OpenAI')) backendType = 'openai';
		else if (selectedInstanceType.includes('Gemini')) backendType = 'gemini';
		else if (selectedInstanceType.includes('Anthropic')) backendType = 'anthropic';
		else if (selectedInstanceType.includes('Deepseek')) backendType = 'deepseek';
		else if (selectedInstanceType.includes('Groq')) backendType = 'groq';
		else if (selectedInstanceType.includes('Together')) backendType = 'together';
		else if (selectedInstanceType.includes('Venice')) backendType = 'venice';
		else if (selectedInstanceType.includes('OpenRouter')) backendType = 'openrouter';

		const payload = {
			type: backendType,
			pinned: false,
			properties: {
				name: instFormName.trim() || 'Instance',
				url: instFormUrl.trim() || 'http://0.0.0.0:11434',
				api: instFormApiKey.trim() || 'NOKEY',
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
					inst.id === editingInstanceId ? { ...inst, type: backendType, properties: { ...inst.properties, ...payload.properties } } : inst,
				),
			);
			try {
				await fetch(`${API_URL}/instances/${editingInstanceId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				fetchInstances(true);
			} catch (err) {
				console.warn('Could not update instance:', err);
			}
		} else {
			const tempId = `inst-${Date.now()}`;
			const newInst: InstanceItem = { id: tempId, pinned: false, type: backendType, properties: payload.properties };
			setStoreInstances([...instances, newInst]);
			try {
				const res = await fetch(`${API_URL}/instances`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				if (res.ok) {
					fetchInstances(true);
				}
			} catch (err) {
				console.warn('Could not create instance:', err);
			}
		}

		setInstanceSubView('list');
	};

	// --- TTS Voice Playback State & Controls ---
	const [ttsState, setTtsState] = useState<{
		msgId: string | null;
		status: 'playing' | 'paused' | 'stopped';
		lineIndex: number;
	}>({ msgId: null, status: 'stopped', lineIndex: -1 });

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const ttsStateRef = useRef(ttsState);

	const updateTTSState = (
		newState:
			| { msgId: string | null; status: 'playing' | 'paused' | 'stopped'; lineIndex: number }
			| ((prev: { msgId: string | null; status: 'playing' | 'paused' | 'stopped'; lineIndex: number }) => {
					msgId: string | null;
					status: 'playing' | 'paused' | 'stopped';
					lineIndex: number;
			  }),
	) => {
		if (typeof newState === 'function') {
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
			audioRef.current.src = '';
			audioRef.current = null;
		}
		updateTTSState({ msgId: null, status: 'stopped', lineIndex: -1 });
	};

	const handlePauseTTS = () => {
		if (audioRef.current) {
			audioRef.current.pause();
		}
		updateTTSState((prev) => ({ ...prev, status: 'paused' }));
	};

	const handleResumeTTS = () => {
		if (audioRef.current) {
			audioRef.current.play().catch(console.warn);
		}
		updateTTSState((prev) => ({ ...prev, status: 'playing' }));
	};

	const fetchTTSBlob = async (text: string, voice: string, signal: AbortSignal): Promise<Blob | null> => {
		try {
			const res = await fetch(`${API_URL}/tts`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text,
					voice: voice || 'af_heart',
				}),
				signal,
			});
			if (!res.ok) {
				console.warn('TTS fetch returned status:', res.status);
				return null;
			}
			return await res.blob();
		} catch (err: any) {
			if (err.name !== 'AbortError') {
				console.warn('TTS fetch error:', err);
			}
			return null;
		}
	};

	const handlePlayTTS = async (msgId: string, content: string, voice?: string, fromLineIndex?: number) => {
		if (ttsStateRef.current.msgId === msgId && ttsStateRef.current.status === 'paused') {
			handleResumeTTS();
			return;
		}

		handleStopTTS();

		const rawLines = content.split('\n');
		const validLines: { origIndex: number; cleanText: string }[] = [];

		rawLines.forEach((lineText, origIndex) => {
			if (fromLineIndex !== undefined && origIndex < fromLineIndex) return;
			const trimmed = lineText.trim();
			if (!trimmed) return;

			const cleanText = trimmed
				.replace(/```[\s\S]*?```/g, '')
				.replace(/`([^`]+)`/g, '$1')
				.replace(/\*\*([^*]+)\*\*/g, '$1')
				.replace(/\*([^*]+)\*/g, '$1')
				.replace(/^#+\s*/gm, '')
				.replace(/^>\s*/gm, '')
				.replace(/^[-*+]\s+/gm, '')
				.replace(/^\d+\.\s+/gm, '')
				.replace(/\|/g, ' ')
				.trim();

			if (cleanText) {
				validLines.push({ origIndex, cleanText });
			}
		});

		if (validLines.length === 0) return;

		const controller = new AbortController();
		abortControllerRef.current = controller;

		updateTTSState({ msgId, status: 'playing', lineIndex: validLines[0].origIndex });

		// Pipeline background audio fetches back-to-back immediately for all valid lines
		const audioBlobPromises: Promise<Blob | null>[] = validLines.map((item) => fetchTTSBlob(item.cleanText, voice || 'af_heart', controller.signal));

		// Stream playback through pre-fetched audio blobs
		for (let i = 0; i < validLines.length; i++) {
			if (ttsStateRef.current.msgId !== msgId || (ttsStateRef.current.status as string) === 'stopped') {
				break;
			}

			const currentItem = validLines[i];
			updateTTSState({ msgId, status: 'playing', lineIndex: currentItem.origIndex });

			const blob = await audioBlobPromises[i];
			if (!blob || ttsStateRef.current.msgId !== msgId || (ttsStateRef.current.status as string) === 'stopped') {
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
					console.warn('Audio playback error:', e);
					URL.revokeObjectURL(audioUrl);
					resolve();
				};

				const checkAndPlay = () => {
					const st = ttsStateRef.current.status;
					if (st === 'paused') {
						const interval = setInterval(() => {
							const currentSt = ttsStateRef.current.status;
							if (currentSt === 'playing' || (currentSt as string) === 'stopped') {
								clearInterval(interval);
								if (currentSt === 'playing') {
									audio.play().catch(resolve);
								} else {
									resolve();
								}
							}
						}, 100);
					} else if (st === 'stopped' || ttsStateRef.current.msgId !== msgId) {
						resolve();
					} else {
						audio.play().catch((err) => {
							console.warn('audio.play() error:', err);
							resolve();
						});
					}
				};

				checkAndPlay();
			});
		}

		if (ttsStateRef.current.msgId === msgId) {
			updateTTSState({ msgId: null, status: 'stopped', lineIndex: -1 });
		}
	};

	const handlePlayTTSLine = async (msgId: string, lineText: string, origIndex: number, voice?: string) => {
		handleStopTTS();

		const trimmed = lineText.trim();
		if (!trimmed) return;

		const cleanText = trimmed
			.replace(/```[\s\S]*?```/g, '')
			.replace(/`([^`]+)`/g, '$1')
			.replace(/\*\*([^*]+)\*\*/g, '$1')
			.replace(/\*([^*]+)\*/g, '$1')
			.replace(/^#+\s*/gm, '')
			.replace(/^>\s*/gm, '')
			.replace(/^[-*+]\s+/gm, '')
			.replace(/^\d+\.\s+/gm, '')
			.replace(/\|/g, ' ')
			.trim();

		if (!cleanText) return;

		const controller = new AbortController();
		abortControllerRef.current = controller;

		updateTTSState({ msgId, status: 'playing', lineIndex: origIndex });

		const blob = await fetchTTSBlob(cleanText, voice || 'af_heart', controller.signal);
		if (!blob || ttsStateRef.current.msgId !== msgId || (ttsStateRef.current.status as string) === 'stopped') {
			updateTTSState({ msgId: null, status: 'stopped', lineIndex: -1 });
			return;
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
				console.warn('Audio playback error:', e);
				URL.revokeObjectURL(audioUrl);
				resolve();
			};
			audio.play().catch((err) => {
				console.warn('audio.play() error:', err);
				resolve();
			});
		});

		if (ttsStateRef.current.msgId === msgId) {
			updateTTSState({ msgId: null, status: 'stopped', lineIndex: -1 });
		}
	};

	const getConversationParticipants = () => {
		const map = new Map<string, { id: string; name: string; avatar: string; role: string }>();

		map.set('user', {
			id: 'user',
			name: 'You',
			avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
			role: 'User',
		});

		messages.forEach((msg) => {
			if (!msg.isSelf) {
				const key = (msg.senderName || '').toLowerCase();
				if (!map.has(key)) {
					const pref = modelPreferences[key] || modelPreferences[msg.senderName || ''];
					const avatarSrc = msg.senderAvatar || formatAvatarPicture(pref?.picture) || DEFAULT_MODEL_AVATAR;
					const charName = isCharEnabled(pref?.character) ? getCharacterName(pref?.character) : undefined;
					const displayName = charName || getCharacterName(pref?.character) || msg.senderName;
					const roleLabel = isCharEnabled(pref?.character) ? 'Character' : 'AI Model';

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
	const [activeChatId, setActiveChatId] = useState<string>(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			const chatParam = params.get('chat');
			if (chatParam) return chatParam;
		}
		return 'design-chat';
	});
	const [searchQuery, setSearchQuery] = useState<string>('');
	const [inputText, setInputText] = useState<string>('');
	const [expandedSection, setExpandedSection] = useState<string>('photos');
	const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState<boolean>(false);
	const [newFolderName, setNewFolderName] = useState<string>('');

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

		setChatItems((prev) => prev.map((c) => (c.id === activeChatId ? { ...c, name: trimmed } : c)));

		try {
			await fetch(`${API_URL}/chats/${activeChatId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmed }),
			});
		} catch (err) {
			console.warn('Could not rename chat on backend API:', err);
		}
	};

	const handleConfirmDeleteChat = async () => {
		setIsDeleteModalOpen(false);
		const deletedId = activeChatId;
		const remaining = chatItems.filter((c) => c.id !== deletedId);

		setChatItems(remaining);
		setActiveChatId(remaining.length > 0 ? remaining[0].id : '');

		try {
			await fetch(`${API_URL}/chats/${deletedId}`, {
				method: 'DELETE',
			});
		} catch (err) {
			console.warn('Could not delete chat on backend API:', err);
		}
	};

	const handleOpenExportModal = () => {
		setIsChatContextMenuOpen(false);
		setIsExportModalOpen(true);
	};

	const handleExportChat = () => {
		if (!messages || messages.length === 0) {
			alert('No messages to export.');
			return;
		}

		const currentChat = chatItems.find((c) => c.id === activeChatId);
		const chatTitle = currentChat?.name || 'Chat';
		const safeTitle = chatTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
		let fileContent = '';
		let mimeType = 'text/plain';
		let fileExt = 'txt';

		if (exportFormat === 'json') {
			mimeType = 'application/json';
			fileExt = 'json';
			const exportData = {
				title: chatTitle,
				exported_at: new Date().toISOString(),
				messages: messages.map((m) => ({
					id: m.id,
					senderName: m.senderName,
					role: m.isSelf ? 'user' : m.senderRole || 'assistant',
					model: m.model,
					content: m.content,
					time: m.time,
					image: m.image,
					attachments: m.attachments,
				})),
			};
			fileContent = JSON.stringify(exportData, null, 2);
		} else if (exportFormat === 'txt') {
			mimeType = 'text/plain';
			fileExt = 'txt';
			const lines: string[] = [`=== ${chatTitle} ===\n`];
			messages.forEach((m) => {
				const sender = m.isSelf ? 'You' : m.senderName || 'Assistant';
				lines.push(`[${m.time || ''}] ${sender}:`);
				lines.push(m.content);
				if (m.attachments && m.attachments.length > 0) {
					m.attachments.forEach((att) => {
						if (att.type !== 'thought' && att.type !== 'metadata') {
							lines.push(`  [Attachment: ${att.name || att.type}]`);
						}
					});
				}
				lines.push('----------------------------------------');
			});
			lines.push('Generated from AlpacaWeb');
			fileContent = lines.join('\n');
		} else {
			// Standard MD or Obsidian MD
			mimeType = 'text/markdown';
			fileExt = 'md';
			const isObsidian = exportFormat === 'obsidian';
			const mdLines: string[] = [`# ${chatTitle}\n`];

			messages.forEach((m) => {
				const sender = m.isSelf ? 'User' : m.senderName || 'Assistant';
				const timeStr = m.time || '';
				mdLines.push(`### **${sender}** | ${timeStr}`);
				mdLines.push(m.content);

				if (m.image) {
					mdLines.push(`![🖼️ Image](${m.image})`);
				}

				if (m.attachments && m.attachments.length > 0) {
					m.attachments.forEach((att) => {
						if (att.type === 'thought' || att.type === 'metadata') return;
						const attName = att.name || 'Attachment';
						const attContent = att.content || '';
						if (isObsidian) {
							let block = `> [!quote]- ${attName}\n`;
							attContent.split('\n').forEach((l) => {
								block += `> ${l}\n`;
							});
							mdLines.push(block);
						} else {
							mdLines.push(`<details>\n\n<summary>📄 ${attName}</summary>\n\n\`\`\`\n${attContent}\n\`\`\`\n\n</details>`);
						}
					});
				}
				mdLines.push('----');
			});
			mdLines.push('Generated from [Walpaca](https://github.com/c42759/walpaca)');
			fileContent = mdLines.join('\n\n');
		}

		const blob = new Blob([fileContent], { type: `${mimeType};charset=utf-8` });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
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
					const typeLower = (att.type || '').toLowerCase();
					if (typeLower === 'thought' || typeLower === 'brain' || typeLower === 'metadata' || typeLower === 'data') {
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

	const API_URL = getApiUrl();

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
			console.warn('Could not fetch folders from backend, fallback to initial default folders:', err);
		}
		setFolders([
			{ id: 'work', name: 'Work' },
			{ id: 'friends', name: 'Friends' },
			{ id: 'news', name: 'News' },
			{ id: 'archive', name: 'Archive' },
		]);
	};

	const fetchChats = async (folderId?: string) => {
		try {
			let url = `${API_URL}/chats`;
			if (folderId && folderId !== 'all') {
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
			console.warn('Could not fetch chats from backend API, using current list:', err);
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
			console.warn('Could not fetch chat messages from backend API:', err);
			setMessages([]);
		}
	};

	useEffect(() => {
		fetchFolders();
		fetchModelPreferences();
		fetchInstances();

		const handlePopState = () => {
			if (typeof window !== 'undefined') {
				const params = new URLSearchParams(window.location.search);
				const chatParam = params.get('chat');
				if (chatParam) {
					setActiveChatId(chatParam);
				}
			}
		};

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	useEffect(() => {
		fetchChats(activeTab);
	}, [activeTab]);

	useEffect(() => {
		if (activeChatId) {
			setMessages([]);
			fetchChatMessages(activeChatId);
			if (typeof window !== 'undefined') {
				const url = new URL(window.location.href);
				if (url.searchParams.get('chat') !== activeChatId) {
					url.searchParams.set('chat', activeChatId);
					window.history.pushState({}, '', url.toString());
				}
			}
		} else {
			setMessages([]);
		}
	}, [activeChatId]);

	useEffect(() => {
		if (activeChatId) {
			messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
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

		const lastAssistantMsg = [...messages].reverse().find((m) => !m.isSelf && (m.senderRole === 'assistant' || m.senderName !== 'You' || m.model));

		if (lastAssistantMsg) {
			const targetModelIdentifier = String(lastAssistantMsg.model || lastAssistantMsg.senderName || '').trim();
			if (targetModelIdentifier) {
				const prefsList = Array.from(new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values());
				const matchingPref = prefsList.find(
					(p) =>
						p.id.toLowerCase() === targetModelIdentifier.toLowerCase() ||
						(getCharacterName(p.character) && getCharacterName(p.character)?.toLowerCase() === targetModelIdentifier.toLowerCase()),
				);

				if (matchingPref) {
					setSelectedChatModelId(matchingPref.id);
				} else {
					const matchingMod = instanceModelsList.find(
						(m) =>
							String(m.id || '').toLowerCase() === targetModelIdentifier.toLowerCase() ||
							String(m.name || '').toLowerCase() === targetModelIdentifier.toLowerCase(),
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
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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

		setNewFolderName('');
		setIsCreatingFolder(false);
	};

	const handleOpenNewChatModal = () => {
		setNewChatTitleInput('New Chat');
		setIsNewChatModalOpen(true);
	};

	const handleConfirmCreateNewChat = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newChatTitleInput.trim()) return;

		const chatName = newChatTitleInput.trim();
		setIsNewChatModalOpen(false);

		try {
			const res = await fetch(`${API_URL}/chats`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: chatName,
					folder: activeTab !== 'none' && activeTab !== 'all' ? activeTab : null,
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
					lastMessage: 'New chat started',
					time: 'now',
				};
				setChatItems((prev) => [localChat, ...prev]);
				setActiveChatId(localChat.id);
			}
		} catch (err) {
			const localChat: ChatItem = {
				id: `chat-${Date.now()}`,
				name: chatName,
				avatarText: chatName.slice(0, 2).toUpperCase(),
				lastMessage: 'New chat started',
				time: 'now',
			};
			setChatItems((prev) => [localChat, ...prev]);
			setActiveChatId(localChat.id);
		}
	};

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputText.trim() && selectedAttachments.length === 0) return;

		const content = inputText.trim();
		const currentAttachments = [...selectedAttachments];
		setInputText('');
		setSelectedAttachments([]);

		if (promptTextareaRef.current) {
			promptTextareaRef.current.style.height = 'auto';
			promptTextareaRef.current.style.overflowY = 'hidden';
		}

		const attachmentsPayload: MessageAttachment[] = currentAttachments.map((att, idx) => ({
			id: att.id || `att-${Date.now()}-${idx}`,
			type: att.type,
			name: att.name,
			content: att.content,
		}));

		const firstImage = currentAttachments.find((a) => a.type === 'image')?.content;

		const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
		const userMsg: Message = {
			id: `msg-${Date.now()}`,
			senderName: 'You',
			senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
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
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						role: 'user',
						content,
						model: selectedChatModelId,
						instance_id: selectedChatInstanceId,
						attachments: attachmentsPayload,
					}),
				});
			} catch (err) {
				console.warn('Could not post user message to backend API:', err);
			}
		}

		await handleCallForAnswer();
	};

	const handleCallForAnswer = async () => {
		// Determine Assistant Metadata & System Prompt
		const selectedPrefKey = (selectedChatModelId || '').toLowerCase();
		const selectedPref =
			modelPreferences[selectedChatModelId] ||
			modelPreferences[selectedPrefKey] ||
			Object.values(modelPreferences).find((p) => p.id.toLowerCase() === selectedPrefKey);

		let assistantName = 'Assistant';
		let assistantAvatar = DEFAULT_MODEL_AVATAR;
		let systemPrompt = '';

		if (selectedPref) {
			const char = selectedPref.character || {};
			const charData = char.data || char || {};
			assistantName = getCharacterName(char) || (selectedPref as any).name || selectedPref.id;
			if (selectedPref.picture) {
				assistantAvatar = formatAvatarPicture(selectedPref.picture) || assistantAvatar;
			}
			systemPrompt = charData.system_prompt || charData.personality || charData.description || selectedPref.description || '';
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
			senderRole: 'assistant',
			model: selectedChatModelId,
			instanceId: selectedChatInstanceId,
			isSelf: false,
			content: '',
			time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
		};

		setMessages((prev) => [...prev, assistantMsg]);

		let fullResponseText = '';
		const genUrl = activeChatId ? `${API_URL}/chats/${activeChatId}/generate` : `${API_URL}/generate`;

		try {
			const genRes = await fetch(genUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed || !trimmed.startsWith('data: ')) continue;
						const dataStr = trimmed.slice(6).trim();
						if (dataStr === '[DONE]') continue;

						try {
							const parsed = JSON.parse(dataStr);
							if (parsed.id) {
								const serverId = parsed.id;
								setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, id: serverId } : m)));
							}
							if (parsed.thinking) {
								const thinkChunk = parsed.thinking;
								setMessages((prev) =>
									prev.map((m) => {
										if (m.id === assistantMsgId || m.id === parsed.id) {
											const existingAtts = m.attachments || [];
											const thoughtIdx = existingAtts.findIndex(
												(a) => a.type?.toLowerCase() === 'thought' || a.type?.toLowerCase() === 'brain',
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
													type: 'thought',
													name: 'Thought',
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
											const metaIdx = existingAtts.findIndex(
												(a) => a.type?.toLowerCase() === 'metadata' || a.type?.toLowerCase() === 'data',
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
													type: 'metadata',
													name: 'Metadata',
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
								setMessages((prev) =>
									prev.map((m) => (m.id === assistantMsgId || m.id === parsed.id ? { ...m, content: m.content + parsed.content } : m)),
								);
							}
						} catch {
							if (dataStr && !dataStr.startsWith('{')) {
								fullResponseText += dataStr;
								setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + dataStr } : m)));
							}
						}
					}
				}
				playNotificationSound();
			}
		} catch (err) {
			console.warn('Error during LLM response generation:', err);
		}
	};

	const handleUseCharacterFirstMes = async () => {
		if (!activeChatId || !selectedChatModelId) return;
		const prefKey = selectedChatModelId.toLowerCase();
		const pref =
			modelPreferences[selectedChatModelId] || modelPreferences[prefKey] || Object.values(modelPreferences).find((p) => p.id.toLowerCase() === prefKey);

		if (!pref) return;
		const char = pref.character || {};
		const charData = char.data || char || {};
		const firstMes = (charData.first_mes || charData.first_message || pref.first_message || '').trim();

		if (!firstMes) return;

		const charName = getCharacterName(char) || (pref as any).name || pref.id;
		const avatarSrc = formatAvatarPicture(pref.picture);
		const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

		const newMsg: Message = {
			id: `msg-${Date.now()}`,
			senderName: charName,
			senderAvatar: avatarSrc,
			senderRole: 'assistant',
			model: selectedChatModelId,
			instanceId: selectedChatInstanceId,
			isSelf: false,
			content: firstMes,
			time: nowStr,
		};

		setMessages((prev) => [...prev, newMsg]);

		try {
			await fetch(`${API_URL}/chats/${activeChatId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					role: 'assistant',
					content: firstMes,
					model: selectedChatModelId,
					instance_id: selectedChatInstanceId,
				}),
			});
		} catch (err) {
			console.warn('Could not post character first message to backend API:', err);
		}
	};

	const handleGoToRoot = useCallback(() => {
		setCurrentView('chat');
		setActiveTab('all');
		setActiveChatId('');
		setMessages([]);
		if (typeof window !== 'undefined') {
			window.history.pushState(null, '', '/');
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

	return (
		<>
			{/* Inner App Container with Rounded Right / Light Theme Area */}
			<div className='flex-1 flex overflow-hidden bg-[#f9fafc] rounded-l-[32px]'>
					{currentView === 'settings' ? (
						<div className='flex-1 flex h-full overflow-hidden bg-[#f9fafc] select-text'>
							{/* 1. SETTINGS CATEGORIES SIDEBAR */}
							<SettingsSidebar
								activeSettingsCategory={activeSettingsCategory}
								setActiveSettingsCategory={setActiveSettingsCategory}
								setCurrentView={setCurrentView}
							/>

							{/* 2. MIDDLE SETTINGS CONTENT AREA */}
							<main className='flex-1 bg-[#f9fafc] p-8 overflow-y-auto'>
								<div className='max-w-3xl mx-auto space-y-8'>
									{activeSettingsCategory === 'import-chat' && (
										<div className='space-y-6 animate-in fade-in duration-200'>
											<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex items-center gap-3.5'>
												<div className='w-12 h-12 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/20 text-[#7678ed] flex items-center justify-center shrink-0 shadow-xs'>
													<svg
														width='24'
														height='24'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
														strokeLinecap='round'
														strokeLinejoin='round'
													>
														<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
														<polyline points='17 8 12 3 7 8' />
														<line x1='12' y1='3' x2='12' y2='15' />
													</svg>
												</div>
												<div>
													<h3 className='text-2xl font-bold text-[#202022] tracking-tight'>Import Chat</h3>
													<p className='text-xs text-[#7a7d90] mt-0.5 font-medium'>
														Import conversation logs, JSON backups, Markdown transcripts, or text exports.
													</p>
												</div>
											</div>

											<input
												type='file'
												ref={importFileInputRef}
												onChange={(e) => e.target.files && handleImportFiles(e.target.files)}
												accept='.json,.md,.markdown,.txt'
												multiple
												className='hidden'
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
													isDraggingImport ? 'border-[#7678ed] bg-[#eaecf9]/40' : 'border-[#7678ed]/40 hover:border-[#7678ed]'
												} rounded-3xl p-10 bg-white hover:bg-[#f3f4fd] transition-all flex flex-col items-center justify-center text-center cursor-pointer group shadow-xs`}
											>
												<div className='w-16 h-16 rounded-2xl bg-[#eaecf9] group-hover:bg-[#7678ed] group-hover:text-white text-[#7678ed] flex items-center justify-center mb-4 transition-colors shadow-sm'>
													<svg
														width='28'
														height='28'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
														strokeLinecap='round'
														strokeLinejoin='round'
													>
														<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
														<polyline points='17 8 12 3 7 8' />
														<line x1='12' y1='3' x2='12' y2='15' />
													</svg>
												</div>

												{isImporting ? (
													<div className='space-y-2'>
														<div className='inline-block w-6 h-6 border-2 border-[#7678ed] border-t-transparent rounded-full animate-spin mb-1' />
														<h4 className='text-base font-bold text-[#202022]'>{importStatusMessage}</h4>
													</div>
												) : (
													<>
														<h4 className='text-base font-bold text-[#202022] mb-1'>Drop chat export files here</h4>
														<p className='text-xs text-[#8e90a6] mb-4'>
															Supports Walpaca JSON (.json), ChatGPT export (.json), Claude export (.json), Markdown (.md), and
															Plain Text (.txt)
														</p>
														<button
															type='button'
															onClick={(e) => {
																e.stopPropagation();
																importFileInputRef.current?.click();
															}}
															className='px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-sm font-semibold rounded-2xl transition-all shadow-md shadow-[#7678ed]/20 cursor-pointer'
														>
															Browse Files
														</button>
													</>
												)}

												{importStatusMessage && !isImporting && (
													<p className='mt-3 text-xs font-semibold text-[#7678ed] bg-[#eaecf9] px-3 py-1.5 rounded-xl border border-[#7678ed]/20 animate-in fade-in'>
														{importStatusMessage}
													</p>
												)}
											</div>

											<div className='bg-white border border-[#e8ebf3] rounded-2xl p-6 space-y-4 shadow-xs'>
												<h5 className='text-base font-bold text-[#202022] pb-3 border-b border-[#e8ebf3]'>Supported Import Formats</h5>
												<div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#404252]'>
													<div className='p-3.5 rounded-2xl bg-[#f9fafc] border border-[#e8ebf3] flex items-start gap-3'>
														<div className='w-8 h-8 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center shrink-0 font-mono font-bold text-xs border border-[#7678ed]/20'>
															JSON
														</div>
														<div>
															<div className='font-bold text-[#202022] text-sm'>Walpaca / ChatGPT / Claude</div>
															<div className='text-[#7a7d90] mt-0.5'>
																Import native Walpaca JSON backups, ChatGPT exported archives, or Claude chat exports.
															</div>
														</div>
													</div>
													<div className='p-3.5 rounded-2xl bg-[#f9fafc] border border-[#e8ebf3] flex items-start gap-3'>
														<div className='w-8 h-8 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center shrink-0 font-mono font-bold text-xs border border-[#7678ed]/20'>
															MD
														</div>
														<div>
															<div className='font-bold text-[#202022] text-sm'>Markdown &amp; Obsidian</div>
															<div className='text-[#7a7d90] mt-0.5'>
																Import standard Markdown headers or Obsidian callout archives.
															</div>
														</div>
													</div>
													<div className='p-3.5 rounded-2xl bg-[#f9fafc] border border-[#e8ebf3] flex items-start gap-3'>
														<div className='w-8 h-8 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center shrink-0 font-mono font-bold text-xs border border-[#7678ed]/20'>
															TXT
														</div>
														<div>
															<div className='font-bold text-[#202022] text-sm'>Plain Text Transcripts</div>
															<div className='text-[#7a7d90] mt-0.5'>
																Import timestamped conversation logs or clean text transcripts.
															</div>
														</div>
													</div>
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
															<p className='text-sm text-[#7a7d90] mt-1'>
																Configure local server connections, cloud API backends, and proxy endpoints.
															</p>
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
																Click "Add Instance" above to connect an Ollama local or remote server to Walpaca.
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
																const name = inst.properties?.name || 'Instance';
																const url = inst.properties?.url || 'http://0.0.0.0:11434';
																const typeLabel = inst.type === 'ollama' ? 'Ollama (External)' : inst.type;

																return (
																	<div
																		key={inst.id}
																		className='p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc] flex items-center justify-between hover:border-[#7678ed]/40 transition-all'
																	>
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
																				<svg
																					width='18'
																					height='18'
																					viewBox='0 0 24 24'
																					fill='none'
																					stroke='currentColor'
																					strokeWidth='2'
																					strokeLinecap='round'
																					strokeLinejoin='round'
																				>
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
																				<svg
																					width='18'
																					height='18'
																					viewBox='0 0 24 24'
																					fill='none'
																					stroke='currentColor'
																					strokeWidth='2'
																					strokeLinecap='round'
																					strokeLinejoin='round'
																				>
																					<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																				</svg>
																			</button>
																			<button
																				onClick={() => handleDeleteInstance(inst.id)}
																				className='p-2 text-[#ff4d4f] hover:bg-[#fff0f0] rounded-2xl transition-colors cursor-pointer'
																				title='Delete Instance'
																			>
																				<svg
																					width='18'
																					height='18'
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
															{
																label: 'Ollama',
																tag: 'Local / Remote',
																desc: 'Local or remote AI instance not managed by Walpaca',
																icon: '🦙',
															},
															{
																label: 'Ollama (Cloud)',
																tag: 'Cloud API',
																desc: 'Ollama server hosted on cloud infrastructure',
																icon: '☁️',
															},
															{
																label: 'OpenAI ChatGPT',
																tag: 'Cloud API',
																desc: 'Official OpenAI GPT-4o & ChatGPT API endpoint',
																icon: '🌐',
															},
															{
																label: 'Google Gemini',
																tag: 'Cloud API',
																desc: 'Google Gemini Flash & Pro API model suite',
																icon: '✨',
															},
															{
																label: 'Together AI',
																tag: 'Cloud API',
																desc: 'Together AI open-source model cloud platform',
																icon: '🤝',
															},
															{
																label: 'Venice',
																tag: 'Cloud API',
																desc: 'Venice private uncensored inference network',
																icon: '🔒',
															},
															{
																label: 'Deepseek',
																tag: 'Cloud API',
																desc: 'Deepseek Coder & Reasoner LLM endpoints',
																icon: '🧠',
															},
															{
																label: 'Groq Cloud',
																tag: 'Cloud API',
																desc: 'Groq ultra-fast LPU inference engine',
																icon: '🚀',
															},
															{
																label: 'Anthropic',
																tag: 'Cloud API',
																desc: 'Anthropic Claude 3.5 Sonnet & Haiku API',
																icon: '🎭',
															},
															{
																label: 'OpenRouter AI',
																tag: 'Cloud API',
																desc: 'OpenRouter unified multi-provider routing API',
																icon: '🔀',
															},
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
																	<line x1='19' y1='12' x2='5' y2='12' />
																	<polyline points='12 19 5 12 12 5' />
																</svg>
															</button>
															<div>
																<div className='flex items-center gap-2'>
																	<h3 className='text-2xl font-bold text-[#202022]'>
																		{editingInstanceId ? 'Edit Instance' : 'Create Instance'}
																	</h3>
																	<span
																		className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
																			editingInstanceId
																				? 'bg-amber-100 text-amber-800 border border-amber-300'
																				: 'bg-[#eaecf9] text-[#7678ed]'
																		} flex items-center gap-1.5`}
																	>
																		{editingInstanceId && (
																			<svg
																				width='12'
																				height='12'
																				viewBox='0 0 24 24'
																				fill='none'
																				stroke='currentColor'
																				strokeWidth='2.5'
																			>
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
																		: 'Local or remote AI instance not managed by Walpaca'}
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
															<button
																type='button'
																onClick={handleSaveInstanceForm}
																className='p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-md shadow-[#7678ed]/20 cursor-pointer flex items-center justify-center'
																title='Save Instance'
															>
																<svg
																	width='20'
																	height='20'
																	viewBox='0 0 24 24'
																	fill='none'
																	stroke='currentColor'
																	strokeWidth='2.5'
																	strokeLinecap='round'
																	strokeLinejoin='round'
																>
																	<polyline points='20 6 9 17 4 12' />
																</svg>
															</button>
														</div>
													</div>

													{/* Dynamic Form Body */}
													{(() => {
														const isOllamaProvider = selectedInstanceType.startsWith('Ollama');
														return (
															<form onSubmit={handleSaveInstanceForm} className='space-y-6 text-sm max-w-3xl'>
																{/* Card 1: Basic Information */}
																<div className='bg-[#f9fafc] border border-[#e8ebf3] rounded-3xl p-6 space-y-5 shadow-xs'>
																	<h4 className='font-bold text-base text-[#202022] border-b border-[#e8ebf3] pb-3 flex items-center justify-between'>
																		<span>Basic Configuration</span>
																		<span className='text-xs font-semibold px-2.5 py-1 rounded-full bg-[#eaecf9] text-[#7678ed]'>
																			{isOllamaProvider ? 'Ollama Server' : 'Cloud Provider API'}
																		</span>
																	</h4>

																	{/* Name Field */}
																	<div>
																		<div className='flex items-center justify-between text-xs text-[#7a7d90] mb-1.5'>
																			<label className='font-semibold text-[#202022]'>Name</label>
																			<svg
																				width='14'
																				height='14'
																				viewBox='0 0 24 24'
																				fill='none'
																				stroke='currentColor'
																				strokeWidth='2'
																				strokeLinecap='round'
																				strokeLinejoin='round'
																			>
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
																					{isOllamaProvider ? 'API Key (Optional)' : 'API Key'}
																				</label>
																				{!isOllamaProvider && (
																					<span className='text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider'>
																						Required
																					</span>
																				)}
																			</div>
																			<div className='flex items-center gap-2'>
																				<svg
																					width='14'
																					height='14'
																					viewBox='0 0 24 24'
																					fill='none'
																					stroke='currentColor'
																					strokeWidth='2'
																					strokeLinecap='round'
																					strokeLinejoin='round'
																				>
																					<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																				</svg>
																				<button
																					type='button'
																					onClick={() => setShowApiKeyText(!showApiKeyText)}
																					className='text-[#7a7d90] hover:text-[#202022] transition-colors cursor-pointer'
																				>
																					<svg
																						width='14'
																						height='14'
																						viewBox='0 0 24 24'
																						fill='none'
																						stroke='currentColor'
																						strokeWidth='2'
																						strokeLinecap='round'
																						strokeLinejoin='round'
																					>
																						<path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
																						<circle cx='12' cy='12' r='3' />
																					</svg>
																				</button>
																			</div>
																		</div>
																		<input
																			type={showApiKeyText ? 'text' : 'password'}
																			value={instFormApiKey}
																			onChange={(e) => setInstFormApiKey(e.target.value)}
																			className='w-full bg-white border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm font-medium text-[#202022] outline-none focus:border-[#7678ed] transition-colors font-mono shadow-xs'
																			placeholder={isOllamaProvider ? 'Optional API Key' : 'Enter Provider API Key'}
																		/>
																	</div>

																	{/* URL / Endpoint Field */}
																	<div>
																		<div className='flex items-center justify-between text-xs text-[#7a7d90] mb-1.5'>
																			<label className='font-semibold text-[#202022]'>
																				{isOllamaProvider ? 'Instance URL' : 'API Base URL (Endpoint Override)'}
																			</label>
																			<svg
																				width='14'
																				height='14'
																				viewBox='0 0 24 24'
																				fill='none'
																				stroke='currentColor'
																				strokeWidth='2'
																				strokeLinecap='round'
																				strokeLinejoin='round'
																			>
																				<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																			</svg>
																		</div>
																		<input
																			type='text'
																			value={instFormUrl}
																			onChange={(e) => setInstFormUrl(e.target.value)}
																			className='w-full bg-white border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm font-medium text-[#202022] outline-none focus:border-[#7678ed] transition-colors font-mono shadow-xs'
																			placeholder={
																				isOllamaProvider ? 'http://0.0.0.0:11434' : 'https://api.provider.com/v1'
																			}
																		/>
																	</div>
																</div>

																{/* Card 2: Feature Toggles */}
																<div className='bg-[#f9fafc] border border-[#e8ebf3] rounded-3xl p-6 space-y-5 shadow-xs'>
																	<h4 className='font-bold text-base text-[#202022] border-b border-[#e8ebf3] pb-3'>
																		Behavior & Security Toggles
																	</h4>

																	{/* Thought Processing Toggle */}
																	<div className='flex items-center justify-between gap-4'>
																		<div>
																			<h5 className='font-bold text-[#202022] text-sm'>Thought Processing</h5>
																			<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																				Have compatible reasoning models think about their response before generating a
																				message
																			</p>
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
																			<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																				Automatically share your name with the AI models
																			</p>
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
																			<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																				Add the option to show reply metadata in the message as an attachment
																			</p>
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
																				<h5 className='font-bold text-[#202022] text-sm'>
																					Allow Self-Signed SSL Certificates
																				</h5>
																				<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																					Only use if you trust the server
																				</p>
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
																			<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																				These parameters overrides the behavior of the instance and models
																			</p>
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
																					className={`transition-transform duration-200 ${isOverrideAccordionOpen ? 'rotate-180' : ''}`}
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
																					<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																						Increasing the temperature will make the models answer more creatively
																					</p>
																				</div>
																				<div className='flex items-center gap-2 shrink-0 bg-white border border-[#e8ebf3] rounded-2xl p-1.5 shadow-xs'>
																					<span className='font-mono font-bold text-sm text-[#202022] px-2.5'>
																						{instFormTemp.toFixed(2)}
																					</span>
																					<button
																						type='button'
																						onClick={() =>
																							setInstFormTemp((prev) =>
																								Math.max(0, parseFloat((prev - 0.05).toFixed(2))),
																							)
																						}
																						className='w-8 h-8 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] font-bold flex items-center justify-center cursor-pointer transition-all'
																					>
																						-
																					</button>
																					<button
																						type='button'
																						onClick={() =>
																							setInstFormTemp((prev) =>
																								Math.min(2, parseFloat((prev + 0.05).toFixed(2))),
																							)
																						}
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
																					<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																						Setting this to a specific number other than 0 will make the model
																						generate the same text for the same prompt
																					</p>
																				</div>
																				<div className='flex items-center gap-2 shrink-0 bg-white border border-[#e8ebf3] rounded-2xl p-1.5 shadow-xs'>
																					<span className='font-mono font-bold text-sm text-[#202022] px-2.5'>
																						{instFormSeed}
																					</span>
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
																					<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																						Controls how many tokens (pieces of text) the model can process and
																						remember at once
																					</p>
																				</div>
																				<div className='flex items-center gap-2 shrink-0 bg-white border border-[#e8ebf3] rounded-2xl p-1.5 shadow-xs'>
																					<span className='font-mono font-bold text-sm text-[#202022] px-2.5'>
																						{instFormNumCtx}
																					</span>
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
																		<h4 className='font-bold text-base text-[#202022] border-b border-[#e8ebf3] pb-3'>
																			Idle Keep Alive Settings
																		</h4>

																		<div className='flex items-center justify-between gap-4'>
																			<div>
																				<h5 className='font-bold text-[#202022] text-sm'>Keep Alive Presets</h5>
																				<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																					How the instance should handle idle models
																				</p>
																			</div>
																			<select
																				value={instFormKeepAlivePreset}
																				onChange={(e) => {
																					const val = e.target.value;
																					setInstFormKeepAlivePreset(val);
																					if (val === 'Indefinitely (-1)') setInstFormKeepAliveMinutes(-1);
																					else if (val === 'Immediate Unload (0)') setInstFormKeepAliveMinutes(0);
																					else setInstFormKeepAliveMinutes(5);
																				}}
																				className='bg-white text-[#202022] text-xs font-semibold px-3.5 py-2.5 rounded-xl outline-none border border-[#e8ebf3] focus:border-[#7678ed] cursor-pointer shadow-xs'
																			>
																				<option value='Set Timer'>Set Timer</option>
																				<option value='Indefinitely (-1)'>Indefinitely (-1)</option>
																				<option value='Immediate Unload (0)'>Immediate Unload (0)</option>
																			</select>
																		</div>

																		{instFormKeepAlivePreset === 'Set Timer' && (
																			<div className='flex items-center justify-between gap-4 pt-4 border-t border-[#e8ebf3]'>
																				<div className='flex-1 min-w-0'>
																					<h6 className='font-bold text-[#202022] text-sm'>Minutes</h6>
																					<p className='text-xs text-[#7a7d90] leading-snug mt-0.5'>
																						The amount of time the instance should keep models loaded after they go
																						idle
																					</p>
																				</div>
																				<div className='flex items-center gap-2 shrink-0 bg-white border border-[#e8ebf3] rounded-2xl p-1.5 shadow-xs'>
																					<span className='font-mono font-bold text-sm text-[#202022] px-2.5'>
																						{instFormKeepAliveMinutes}
																					</span>
																					<button
																						type='button'
																						onClick={() =>
																							setInstFormKeepAliveMinutes((prev) => Math.max(1, prev - 1))
																						}
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
															<svg
																width='20'
																height='20'
																viewBox='0 0 24 24'
																fill='none'
																stroke='currentColor'
																strokeWidth='2.5'
																strokeLinecap='round'
																strokeLinejoin='round'
															>
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
															new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values(),
														);

														const unmatchedModels = instanceModelsList.filter(
															(mod) =>
																!preferencesList.some(
																	(pref) =>
																		pref.id.toLowerCase() === String(mod.id || '').toLowerCase() ||
																		pref.id.toLowerCase() === String(mod.name || '').toLowerCase(),
																),
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
																						String(mod.name || '').toLowerCase() === pref.id.toLowerCase(),
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
																											const fallbackElem = e.currentTarget
																												.nextElementSibling as HTMLElement;
																											if (fallbackElem)
																												fallbackElem.style.display = 'flex';
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
																								<h4
																									className='text-base font-bold text-[#202022] truncate'
																									title={displayName}
																								>
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
																							{matchedModel &&
																								(matchedModel.tag ||
																									matchedModel.family ||
																									matchedModel.parameter_size ||
																									matchedModel.quantization_level) && (
																									<div className='bg-[#f8f9fc] border border-[#e8ebf3] rounded-2xl p-3 space-y-2 text-left text-xs'>
																										<div className='grid grid-cols-2 gap-2'>
																											<div>
																												<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																													Tag
																												</span>
																												<span className='font-mono font-bold text-[#202022] truncate block'>
																													{matchedModel.tag || matchedModel.id}
																												</span>
																											</div>
																											<div>
																												<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																													Family
																												</span>
																												<span className='font-semibold text-[#202022] truncate block'>
																													{matchedModel.family || '—'}
																												</span>
																											</div>
																											<div>
																												<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																													Parameter Size
																												</span>
																												<span className='font-semibold text-[#202022] truncate block'>
																													{matchedModel.parameter_size || '—'}
																												</span>
																											</div>
																											<div>
																												<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																													Quantization Level
																												</span>
																												<span className='font-mono font-semibold text-[#202022] truncate block'>
																													{matchedModel.quantization_level || '—'}
																												</span>
																											</div>
																										</div>

																										{matchedModel.modified_at && (
																											<div className='pt-1 border-t border-[#e8ebf3]'>
																												<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																													Modified At
																												</span>
																												<span className='font-mono text-[11px] text-[#5d6075] truncate block'>
																													{typeof matchedModel.modified_at ===
																													'string'
																														? matchedModel.modified_at
																																.replace('T', ' ')
																																.substring(0, 16)
																														: matchedModel.modified_at}
																												</span>
																											</div>
																										)}
																									</div>
																								)}

																							{/* Capability Badges */}
																							{matchedModel &&
																								Array.isArray(matchedModel.capabilities) &&
																								matchedModel.capabilities.length > 0 && (
																									<div className='flex items-center justify-center gap-1.5 flex-wrap pt-1'>
																										{matchedModel.capabilities.includes('code') && (
																											<span className='px-2.5 py-1 bg-[#1e293b] text-[#93c5fd] rounded-xl text-[11px] font-bold flex items-center gap-1'>
																												<span className='font-mono'>&lt;/&gt;</span>{' '}
																												Code
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
																							onClick={() =>
																								handleOpenEditModelModal(
																									matchedModel || { id: pref.id, name: pref.id },
																								)
																							}
																							className='w-full py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-bold rounded-2xl transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-2 cursor-pointer'
																						>
																							<svg
																								width='14'
																								height='14'
																								viewBox='0 0 24 24'
																								fill='none'
																								stroke='currentColor'
																								strokeWidth='2.2'
																								strokeLinecap='round'
																								strokeLinejoin='round'
																							>
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
																											const fallbackElem = e.currentTarget
																												.nextElementSibling as HTMLElement;
																											if (fallbackElem)
																												fallbackElem.style.display = 'flex';
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
																								<h4
																									className='text-base font-bold text-[#202022] truncate'
																									title={displayName}
																								>
																									{displayName}
																								</h4>
																								<p className='text-xs text-[#8e90a6] font-medium mt-0.5 truncate font-mono'>
																									{mod.provider || selectedInstanceForModels.type} •{' '}
																									{mod.context || '8k ctx'}
																								</p>
																								<span className='inline-flex items-center gap-1 mt-2 px-3 py-0.5 bg-[#f0f2f5] text-[#5d6075] border border-[#e8ebf3] rounded-full text-[10px] font-bold uppercase tracking-wider'>
																									No Preference
																								</span>
																							</div>

																							{/* Ollama / Model Specs Grid */}
																							{(mod.tag ||
																								mod.family ||
																								mod.parameter_size ||
																								mod.quantization_level) && (
																								<div className='bg-[#f8f9fc] border border-[#e8ebf3] rounded-2xl p-3 space-y-2 text-left text-xs'>
																									<div className='grid grid-cols-2 gap-2'>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																												Tag
																											</span>
																											<span className='font-mono font-bold text-[#202022] truncate block'>
																												{mod.tag || mod.id}
																											</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																												Family
																											</span>
																											<span className='font-semibold text-[#202022] truncate block'>
																												{mod.family || '—'}
																											</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																												Parameter Size
																											</span>
																											<span className='font-semibold text-[#202022] truncate block'>
																												{mod.parameter_size || '—'}
																											</span>
																										</div>
																										<div>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																												Quantization Level
																											</span>
																											<span className='font-mono font-semibold text-[#202022] truncate block'>
																												{mod.quantization_level || '—'}
																											</span>
																										</div>
																									</div>

																									{mod.modified_at && (
																										<div className='pt-1 border-t border-[#e8ebf3]'>
																											<span className='text-[10px] font-bold text-[#8e90a6] uppercase tracking-wider block'>
																												Modified At
																											</span>
																											<span className='font-mono text-[11px] text-[#5d6075] truncate block'>
																												{typeof mod.modified_at === 'string'
																													? mod.modified_at
																															.replace('T', ' ')
																															.substring(0, 16)
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
																							<svg
																								width='14'
																								height='14'
																								viewBox='0 0 24 24'
																								fill='none'
																								stroke='currentColor'
																								strokeWidth='2.2'
																								strokeLinecap='round'
																								strokeLinejoin='round'
																							>
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
															<svg
																width='20'
																height='20'
																viewBox='0 0 24 24'
																fill='none'
																stroke='currentColor'
																strokeWidth='2.5'
																strokeLinecap='round'
																strokeLinejoin='round'
															>
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
																String(mod.name || '').toLowerCase() === rawId.toLowerCase(),
														);
														const displayName =
															getCharacterName(pref?.character) || (pref as any)?.name || editingModel.name || editingModel.id;
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
													<form
														onSubmit={handleSaveEditModel}
														className='space-y-8 bg-white border border-[#e8ebf3] rounded-3xl p-6 shadow-xs'
													>
														{/* Quick Load Persona Template */}
														{personaTemplates.length > 0 && (
															<div className='p-4 rounded-2xl bg-[#f0f2fb] border border-[#7678ed]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
																<div>
																	<h5 className='text-xs font-bold text-[#7678ed] uppercase tracking-wider'>
																		Load Persona Template
																	</h5>
																	<p className='text-xs text-[#5d6075] mt-0.5'>
																		Instantly populate character name, system instructions, avatar, and TTS voice from a
																		persona template.
																	</p>
																</div>
																<select
																	onChange={(e) => {
																		const selectedFname = e.target.value;
																		if (!selectedFname) return;
																		const tmpl = personaTemplates.find((p) => p.filename === selectedFname);
																		if (tmpl) {
																			setEditModelName(tmpl.name);
																			setEditModelDescription(tmpl.description || tmpl.system_prompt || '');
																			if (tmpl.voice) setEditModelVoice(tmpl.voice);
																		}
																		e.target.value = '';
																	}}
																	className='bg-white border border-[#7678ed]/30 rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:border-[#7678ed] transition-all cursor-pointer shrink-0'
																>
																	<option value=''>Select Persona Template...</option>
																	{personaTemplates.map((p) => (
																		<option key={p.filename} value={p.filename}>
																			{p.name} ({p.filename})
																		</option>
																	))}
																</select>
															</div>
														)}
														{/* 1. General Information */}
														<div className='space-y-4'>
															<div className='pb-2 border-b border-[#e8ebf3]'>
																<h4 className='text-sm font-bold text-[#7678ed] uppercase tracking-wider'>
																	General Information
																</h4>
																<p className='text-xs text-[#7a7d90] mt-0.5'>
																	Basic identity, context window, and voice configuration for this model.
																</p>
															</div>

															<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
																<div>
																	<label className='block text-xs font-bold text-[#5d6075] mb-1.5'>
																		Model / Character Name
																	</label>
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
																<label className='block text-xs font-bold text-[#5d6075] mb-1.5'>
																	First Message (Greeting)
																</label>
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
																	<p className='text-xs text-[#7a7d90]'>
																		Optional alternative opening lines for starting new chats.
																	</p>
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
																<p className='text-xs text-[#8e90a6] italic py-2 text-center'>
																	No alternative greetings added.
																</p>
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
																				<svg
																					width='18'
																					height='18'
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
																	<p className='text-xs text-[#7a7d90]'>
																		Lore items, world facts, and keyword-triggered context memories.
																	</p>
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
																<p className='text-xs text-[#8e90a6] italic py-2 text-center'>
																	No character book items defined.
																</p>
															) : (
																<div className='space-y-4'>
																	{editModelCharacterBook.map((item, idx) => (
																		<div
																			key={idx}
																			className='bg-white p-5 rounded-2xl border border-[#e8ebf3] space-y-4 shadow-xs'
																		>
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
																					<svg
																						width='18'
																						height='18'
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
																				</button>
																			</div>

																			<div>
																				<label className='block text-[11px] font-bold text-[#7a7d90] mb-1 uppercase tracking-wider'>
																					Description / Content
																				</label>
																				<textarea
																					rows={2}
																					value={item.description}
																					onChange={(e) => handleUpdateBookItem(idx, 'description', e.target.value)}
																					placeholder='Content inserted into context when keywords match...'
																					className='w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-xl px-3.5 py-2 text-xs font-medium outline-none focus:border-[#7678ed] resize-y'
																				/>
																			</div>

																			<div>
																				<label className='block text-[11px] font-bold text-[#7a7d90] mb-1 uppercase tracking-wider'>
																					Tags / Keywords (comma separated)
																				</label>
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
																<svg
																	width='16'
																	height='16'
																	viewBox='0 0 24 24'
																	fill='none'
																	stroke='currentColor'
																	strokeWidth='2.2'
																	strokeLinecap='round'
																	strokeLinejoin='round'
																>
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
											<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex items-center gap-3.5'>
												<div className='w-12 h-12 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/20 text-[#7678ed] flex items-center justify-center shrink-0 shadow-xs'>
													<svg
														width='24'
														height='24'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
														strokeLinecap='round'
														strokeLinejoin='round'
													>
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
												</div>
												<div>
													<h3 className='text-2xl font-bold text-[#202022] tracking-tight'>Preferences</h3>
													<p className='text-xs text-[#7a7d90] mt-0.5 font-medium'>
														Configure playback options, user interface defaults, and system notifications.
													</p>
												</div>
											</div>

											<div className='space-y-4 bg-white border border-[#e8ebf3] rounded-2xl p-6 shadow-xs'>
												<div className='flex items-center justify-between pb-4 border-b border-[#e8ebf3]'>
													<div>
														<h4 className='text-base font-bold text-[#202022]'>Auto-play Assistant Voice</h4>
														<p className='text-xs text-[#8e90a6] mt-0.5'>
															Automatically start TTS voice playback when assistant finishes generating response.
														</p>
													</div>
													<input
														type='checkbox'
														className='w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer'
													/>
												</div>

												<div className='flex items-center justify-between pb-4 border-b border-[#e8ebf3]'>
													<div>
														<h4 className='text-base font-bold text-[#202022]'>Desktop Notifications</h4>
														<p className='text-xs text-[#8e90a6] mt-0.5'>
															Send desktop alert when background LLM generation completes.
														</p>
													</div>
													<input
														type='checkbox'
														defaultChecked
														className='w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer'
													/>
												</div>

												<div className='flex items-center justify-between pb-4 border-b border-[#e8ebf3]'>
													<div>
														<h4 className='text-base font-bold text-[#202022]'>Auto-scroll during generation</h4>
														<p className='text-xs text-[#8e90a6] mt-0.5'>
															Keep chat window scrolled to the latest incoming message tokens.
														</p>
													</div>
													<input
														type='checkbox'
														defaultChecked
														className='w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer'
													/>
												</div>

												<div className='pt-2 space-y-2'>
													<h4 className='text-base font-bold text-[#202022]'>Default Audio Output Device</h4>
													<select className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm text-[#202022] font-semibold outline-none focus:border-[#7678ed] transition-all cursor-pointer'>
														<option value='default'>System Default Speaker</option>
														<option value='headphones'>Headphones / Headset</option>
													</select>
												</div>
											</div>
										</div>
									)}

									{activeSettingsCategory === 'manage-lorebook' && (
										<ManageLorebookPanel
											lorebookTemplates={lorebookTemplates}
											isLorebookLoading={isLorebookLoading}
											getApiUrl={getApiUrl}
											fetchLorebookTemplates={fetchLorebookTemplates}
										/>
									)}

									{activeSettingsCategory === 'manage-personas' && (
										<ManagePersonasPanel
											personaTemplates={personaTemplates}
											lorebookTemplates={lorebookTemplates}
											isPersonaLoading={isPersonaLoading}
											getApiUrl={getApiUrl}
											fetchPersonaTemplates={fetchPersonaTemplates}
											setApplyPersonaModalTemplate={setApplyPersonaModalTemplate}
											setApplyPersonaSelectedModelId={setApplyPersonaSelectedModelId}
											setDeletingPersonaTemplate={setDeletingPersonaTemplate}
										/>
									)}

									{activeSettingsCategory === 'about-walpaca' && (
										<div className='space-y-6 animate-in fade-in duration-200 pb-8'>
											{/* Header Section */}
											<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4'>
												<div className='flex items-center gap-3.5'>
													<div className='w-12 h-12 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/20 flex items-center justify-center p-2.5 shrink-0 shadow-xs'>
														<img src='/icon-app.svg' alt='Walpaca Logo' className='w-full h-full object-contain' />
													</div>
													<div>
														<div className='flex items-center gap-2.5'>
															<h3 className='text-2xl font-bold text-[#202022] tracking-tight'>Walpaca</h3>
															<span className='px-2.5 py-0.5 text-xs font-semibold bg-[#eaecf9] text-[#7678ed] rounded-lg border border-[#7678ed]/20'>
																v1.0.0
															</span>
														</div>
														<p className='text-lg text-[#7a7d90] mt-0.5 font-medium'>
															Web interface inspired on{' '}
															<a
																href='https://github.com/Jeffser/Alpaca'
																target='_blank'
																rel='noopener noreferrer'
																className='text-[#7678ed] underline hover:text-[#5d6075]'
															>
																Jeffser/Alpaca
															</a>{' '}
															GTK client.
														</p>
													</div>
												</div>

												<p className='text-lg text-[#404252] leading-relaxed pt-3 border-t border-[#e8ebf3]'>
													Walpaca lets you access your local Alpaca workspace across your network or VPN. It mounts the exact same
													SQLite database file (
													<code className='bg-[#eaecf9] px-1.5 py-0.5 rounded-md text-[#7678ed] font-mono border border-[#7678ed]/20'>
														alpaca.db
													</code>
													) used by the native desktop app, keeping your existing chats and settings synchronized.
												</p>
											</div>

											{/* Features Overview */}
											<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4'>
												<div className='flex items-center gap-2.5 text-[#202022] font-bold text-lg pb-3 border-b border-[#e8ebf3]'>
													<svg
														width='20'
														height='20'
														viewBox='0 0 24 24'
														fill='none'
														stroke='#7678ed'
														strokeWidth='2.2'
														strokeLinecap='round'
														strokeLinejoin='round'
													>
														<polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' />
													</svg>
													<span>Features</span>
												</div>

												<div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#404252]'>
													{[
														{
															icon: '💬',
															title: 'Multi-Model Chats',
															desc: 'Switch between Ollama & Cloud models in the same conversation.',
														},
														{
															icon: '📄',
															title: 'Document Recognition',
															desc: 'Attach text and code files (.txt, .md, .js, .py, .css) for prompt analysis.',
														},
														{
															icon: '🖼️',
															title: 'Image Support',
															desc: 'Attach up to 4 images per message for multimodal vision models.',
														},
														{
															icon: '💻',
															title: 'Syntax Highlighting',
															desc: 'Tokenized code blocks with copy button and line counters.',
														},
														{
															icon: '📥',
															title: 'Export Transcripts',
															desc: 'Export chats to Markdown (.md), Obsidian, JSON, or Plain Text.',
														},
														{
															icon: '🔊',
															title: 'Speech Output',
															desc: 'Line-by-line audio synthesis using Kokoro TTS integration.',
														},
													].map((feat, i) => (
														<div key={i} className='flex items-start gap-3 p-3.5 transition-all'>
															<div className='w-9 h-9 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center shrink-0 font-bold text-base border border-[#7678ed]/20'>
																{feat.icon}
															</div>
															<div>
																<div className='font-bold text-[#202022] text-lg'>{feat.title}</div>
																<div className='text-[#7a7d90] mt-0.5 leading-normal text-sm'>{feat.desc}</div>
															</div>
														</div>
													))}
												</div>
											</div>

											{/* Tech Stack & Credits */}
											<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4 text-xs text-[#404252]'>
												<div className='flex items-center gap-2.5 text-[#202022] font-bold text-lg pb-3 border-b border-[#e8ebf3]'>
													<svg
														width='20'
														height='20'
														viewBox='0 0 24 24'
														fill='none'
														stroke='#7678ed'
														strokeWidth='2.2'
														strokeLinecap='round'
														strokeLinejoin='round'
													>
														<rect x='2' y='3' width='20' height='14' rx='2' ry='2' />
														<line x1='8' y1='21' x2='16' y2='21' />
														<line x1='12' y1='17' x2='12' y2='21' />
													</svg>
													<span>Tech Stack &amp; License</span>
												</div>

												<p className='leading-relaxed text-[#7a7d90] text-lg'>
													Built with Next.js, React, Tailwind CSS, Zustand, and Python Flask. Uses shared SQLite database (
													<code className='font-mono text-[#7678ed] bg-[#eaecf9] px-1.5 py-0.5 rounded-md border border-[#7678ed]/20'>
														alpaca.db
													</code>
													).
												</p>

												<div className='pt-4 flex flex-wrap items-center gap-2.5'>
													<span className='px-3 py-1.5 rounded-xl bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] font-semibold text-sm flex items-center gap-1.5'>
														<span className='w-2 h-2 rounded-full bg-[#7678ed]' />
														Open Source (GPL License)
													</span>
													<a
														href='https://github.com/Jeffser/Alpaca'
														target='_blank'
														rel='noopener noreferrer'
														className='px-3 py-1.5 rounded-xl bg-[#eaecf9] text-[#7678ed] hover:bg-[#7678ed] hover:text-white font-semibold text-sm transition-all flex items-center gap-1.5 border border-[#7678ed]/20'
													>
														<svg width='14' height='14' viewBox='0 0 24 24' fill='currentColor'>
															<path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
														</svg>
														Jeffser/Alpaca
													</a>
													<a
														href='https://github.com/c42759/walpaca'
														target='_blank'
														rel='noopener noreferrer'
														className='px-3 py-1.5 rounded-xl bg-[#eaecf9] text-[#7678ed] hover:bg-[#7678ed] hover:text-white font-semibold text-sm transition-all flex items-center gap-1.5 border border-[#7678ed]/20'
													>
														<svg width='14' height='14' viewBox='0 0 24 24' fill='currentColor'>
															<path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
														</svg>
														c42759/walpaca
													</a>
												</div>
											</div>
										</div>
									)}
								</div>
							</main>

							{/* 3. RIGHT SIDEBAR - HELP & TIPS */}
							<SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
						</div>
					) : (
						<>
							{/* ========================================================= */}
							{/* 2. CHAT LIST PANEL (#f9fafc) */}
							{/* ========================================================= */}
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
							/>

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
																	onClick={handleOpenExportModal}
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
																		<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
																		<polyline points='7 10 12 15 17 10' />
																		<line x1='12' y1='15' x2='12' y2='3' />
																	</svg>
																	Export Chat
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
											{messages.length === 0
												? (() => {
														const selectedPrefKey = (selectedChatModelId || '').toLowerCase();
														const selectedPref =
															modelPreferences[selectedChatModelId] ||
															modelPreferences[selectedPrefKey] ||
															Object.values(modelPreferences).find((p) => p.id.toLowerCase() === selectedPrefKey);
														const char = selectedPref?.character || {};
														const charData = char.data || char || {};
														const firstMes = (
															charData.first_mes ||
															charData.first_message ||
															selectedPref?.first_message ||
															''
														).trim();

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
													})()
												: messages.map((msg) => {
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
																					<div className='leading-relaxed font-normal'>
																						{renderMarkdownText(msg.content)}
																					</div>
																					{imageSources.length > 0 && (
																						<div className='flex flex-row gap-2.5 overflow-x-auto mt-3 pb-1.5 max-w-full'>
																							{imageSources.map((src, idx) => (
																								<img
																									key={idx}
																									src={src}
																									alt={`Attachment ${idx + 1}`}
																									className='h-32 min-w-[128px] max-w-[260px] rounded-xl object-cover border border-white/20 shadow-xs flex-shrink-0 cursor-pointer hover:opacity-95 transition-opacity'
																									onClick={() =>
																										setActiveImageModal({
																											src,
																											title: `Attachment Image ${idx + 1}`,
																										})
																									}
																								/>
																							))}
																						</div>
																					)}
																					{(() => {
																						const docAtts = (msg.attachments || []).filter(
																							(att) =>
																								att.type !== 'thought' &&
																								att.type !== 'metadata' &&
																								!isImageAttachment(att),
																						);
																						if (docAtts.length === 0) return null;
																						return (
																							<div className='flex flex-col gap-2 mt-3 w-full max-w-full'>
																								{docAtts.map((att, idx) => {
																									const ext = att.name
																										? att.name.split('.').pop()?.toLowerCase() || 'txt'
																										: 'file';
																									return (
																										<DocumentAttachmentCard
																											key={att.id || idx}
																											attachment={att}
																											extension={ext}
																											isSelf={msg.isSelf}
																										/>
																									);
																								})}
																							</div>
																						);
																					})()}
																					<div className='flex items-center justify-end gap-2 text-sm text-white/80 mt-2'>
																						<button
																							type='button'
																							onClick={() => handleOpenForkModal(msg)}
																							className='p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer'
																							title='Fork Chat'
																						>
																							<svg
																								width='13'
																								height='13'
																								viewBox='0 0 24 24'
																								fill='none'
																								stroke='currentColor'
																								strokeWidth='2'
																								strokeLinecap='round'
																								strokeLinejoin='round'
																							>
																								<circle cx='12' cy='18' r='3' />
																								<circle cx='6' cy='6' r='3' />
																								<circle cx='18' cy='6' r='3' />
																								<path d='M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9' />
																								<path d='M12 12v3' />
																							</svg>
																						</button>
																						<button
																							type='button'
																							onClick={() => handleStartInlineEdit(msg)}
																							className='p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer'
																							title='Edit Message'
																						>
																							<svg
																								width='13'
																								height='13'
																								viewBox='0 0 24 24'
																								fill='none'
																								stroke='currentColor'
																								strokeWidth='2'
																								strokeLinecap='round'
																								strokeLinejoin='round'
																							>
																								<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																							</svg>
																						</button>
																						<button
																							type='button'
																							onClick={() => handleOpenDeleteMessageModal(msg)}
																							className='p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white hover:text-[#ff7875] transition-all cursor-pointer'
																							title='Delete Message'
																						>
																							<svg
																								width='13'
																								height='13'
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
															const avatarSrc = msg.senderAvatar || formatAvatarPicture(pref?.picture) || DEFAULT_MODEL_AVATAR;
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
																									<svg
																										width='12'
																										height='12'
																										viewBox='0 0 24 24'
																										fill='currentColor'
																									>
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
																									<svg
																										width='12'
																										height='12'
																										viewBox='0 0 24 24'
																										fill='currentColor'
																									>
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
																								<svg
																									width='12'
																									height='12'
																									viewBox='0 0 24 24'
																									fill='currentColor'
																								>
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
																						onClick={() => handleOpenForkModal(msg)}
																						className='p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#8e90a6] hover:text-[#7678ed] hover:border-[#7678ed] hover:bg-[#f4f6fc] transition-all shadow-xs cursor-pointer flex items-center justify-center'
																						title='Fork Chat'
																					>
																						<svg
																							width='14'
																							height='14'
																							viewBox='0 0 24 24'
																							fill='none'
																							stroke='currentColor'
																							strokeWidth='2'
																							strokeLinecap='round'
																							strokeLinejoin='round'
																						>
																							<circle cx='12' cy='18' r='3' />
																							<circle cx='6' cy='6' r='3' />
																							<circle cx='18' cy='6' r='3' />
																							<path d='M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9' />
																							<path d='M12 12v3' />
																						</svg>
																					</button>
																					<button
																						type='button'
																						onClick={() => handleStartInlineEdit(msg)}
																						className='p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#8e90a6] hover:text-[#7678ed] hover:border-[#7678ed] hover:bg-[#f4f6fc] transition-all shadow-xs cursor-pointer flex items-center justify-center'
																						title='Edit Message'
																					>
																						<svg
																							width='14'
																							height='14'
																							viewBox='0 0 24 24'
																							fill='none'
																							stroke='currentColor'
																							strokeWidth='2'
																							strokeLinecap='round'
																							strokeLinejoin='round'
																						>
																							<path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
																						</svg>
																					</button>
																					<button
																						type='button'
																						onClick={() => handleOpenDeleteMessageModal(msg)}
																						className='p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#8e90a6] hover:text-[#ff4d4f] hover:border-[#ff4d4f] hover:bg-[#fff1f0] transition-all shadow-xs cursor-pointer flex items-center justify-center'
																						title='Delete Message'
																					>
																						<svg
																							width='14'
																							height='14'
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
																					renderMarkdownText(
																						msg.content,
																						msg.id === ttsState.msgId ? ttsState.lineIndex : undefined,
																						(e, lineText, lineIdx) => {
																							setLineContextMenu({
																								x: e.clientX,
																								y: e.clientY,
																								msgId: msg.id,
																								lineText,
																								lineIndex: lineIdx,
																								voice: modelVoice,
																								fullContent: msg.content,
																							});
																						},
																					)
																				)}
																				{(() => {
																					const docAtts = (msg.attachments || []).filter(
																						(att) =>
																							att.type !== 'thought' &&
																							att.type !== 'metadata' &&
																							!isImageAttachment(att),
																					);
																					if (docAtts.length === 0) return null;
																					return (
																						<div className='flex flex-col gap-2 mt-3 w-full max-w-full'>
																							{docAtts.map((att, idx) => {
																								const ext = att.name
																									? att.name.split('.').pop()?.toLowerCase() || 'txt'
																									: 'file';
																								return (
																									<DocumentAttachmentCard
																										key={att.id || idx}
																										attachment={att}
																										extension={ext}
																										isSelf={false}
																									/>
																								);
																							})}
																						</div>
																					);
																				})()}
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
							{activeChatId && chatItems.some((c) => c.id === activeChatId) ? (
								<aside className='w-[330px] bg-[#f9fafc] border-l border-[#e8ebf3] p-4 flex flex-col gap-4 overflow-y-auto shrink-0'>
									{/* Context Card */}
									{(() => {
										const selectedInst = instances.find((i) => i.id === selectedChatInstanceId);
										const selectedPrefKey = (selectedChatModelId || '').toLowerCase();
										const selectedPref =
											modelPreferences[selectedChatModelId] ||
											modelPreferences[selectedPrefKey] ||
											Object.values(modelPreferences).find((p) => p.id.toLowerCase() === selectedPrefKey);

										const props = selectedInst?.properties as any;
										const rawNumCtx =
											props?.num_ctx || props?.context_size || props?.numCtx || props?.context || selectedPref?.num_ctx || 4096;

										const totalTokens = Number(rawNumCtx) || 4096;

										let consumedTokens = 0;
										const assistantMsgs = [...messages].reverse().filter((m) => !m.isSelf);

										for (const msg of assistantMsgs) {
											const metaAtt = msg.attachments?.find(
												(a) => a.type?.toLowerCase() === 'metadata' || a.type?.toLowerCase() === 'data',
											);
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

										let cardBg = 'bg-white border-[#edf0f7] text-[#202022]';
										let iconColor = '#7678ed';
										let titleColor = 'text-[#202022]';
										let textColor = 'text-[#5d6075] font-medium';
										let trackBg = 'bg-[#f0f2f9] border-[#e8ebf3]';
										let barColor = 'bg-emerald-500';
										let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';

										if (isOverconsumed) {
											cardBg = 'bg-rose-50/90 border-rose-200 text-rose-950 shadow-sm';
											iconColor = '#e11d48';
											titleColor = 'text-rose-900';
											textColor = 'text-rose-800 font-semibold';
											trackBg = 'bg-rose-100 border-rose-200';
											barColor = 'bg-rose-600';
											badgeBg = 'bg-rose-600 text-white border-rose-600 font-extrabold shadow-xs';
										} else if (rawPercentage >= 90) {
											barColor = 'bg-rose-500';
											badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
										} else if (rawPercentage >= 65) {
											barColor = 'bg-amber-500';
											badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
										}

										return (
											<div className={`rounded-3xl p-5 shadow-xs border flex flex-col gap-3 transition-all duration-300 ${cardBg}`}>
												<div className='flex items-center justify-between'>
													<div className='flex items-center gap-2'>
														<svg
															width='20'
															height='20'
															viewBox='0 0 24 24'
															fill='none'
															stroke={iconColor}
															strokeWidth='2.2'
															strokeLinecap='round'
															strokeLinejoin='round'
														>
															<rect x='2' y='2' width='20' height='8' rx='2' ry='2' />
															<rect x='2' y='14' width='20' height='8' rx='2' ry='2' />
															<line x1='6' y1='6' x2='6.01' y2='6' />
															<line x1='6' y1='18' x2='6.01' y2='18' />
														</svg>
														<h3 className={`font-bold text-xl ${titleColor}`}>Context</h3>
													</div>
													<span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeBg}`}>{percentage}%</span>
												</div>

												<p className={`text-sm ${textColor}`}>
													Consumed {consumedTokens.toLocaleString()} from {totalTokens.toLocaleString()} tokens.
												</p>

												<div className={`w-full rounded-full h-2.5 overflow-hidden p-0.5 border ${trackBg}`}>
													<div
														className={`h-full rounded-full transition-all duration-500 ${barColor}`}
														style={{ width: `${percentage}%` }}
													/>
												</div>
											</div>
										);
									})()}

									{/* 1. Members Card (Middle) */}
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
																<img
																	src={p.avatar}
																	alt={p.name}
																	className='w-10 h-10 rounded-2xl object-cover shadow-xs shrink-0'
																/>
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
														<span className='text-sm font-semibold text-white bg-[#7678ed] px-2.5 py-0.5 rounded-full'>
															{totalCount}
														</span>
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

			{/* Custom Fork Chat Confirmation Modal */}
			{isForkModalOpen && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-3'>
							<div className='flex items-center gap-2.5 text-[#7678ed] font-bold text-lg'>
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
									<circle cx='12' cy='18' r='3' />
									<circle cx='6' cy='6' r='3' />
									<circle cx='18' cy='6' r='3' />
									<path d='M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9' />
									<path d='M12 12v3' />
								</svg>
								<span>Fork Conversation?</span>
							</div>
							<button onClick={() => setIsForkModalOpen(false)} className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'>
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
							This will create a new copy of this chat containing all messages up to and including the selected message.
						</p>
						<div className='flex items-center justify-end gap-3'>
							<button
								type='button'
								onClick={() => setIsForkModalOpen(false)}
								className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleConfirmForkChat}
								className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer flex items-center gap-1.5'
							>
								Fork Chat
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
							<button
								onClick={() => setIsDuplicateModalOpen(false)}
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

			{/* Custom Export Chat Modal */}
			{isExportModalOpen && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-4'>
							<div className='flex items-center gap-2.5'>
								<div className='w-9 h-9 rounded-xl bg-[#7678ed]/20 text-[#7678ed] flex items-center justify-center'>
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
										<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
										<polyline points='7 10 12 15 17 10' />
										<line x1='12' y1='15' x2='12' y2='3' />
									</svg>
								</div>
								<div>
									<h3 className='text-lg font-bold tracking-tight'>Export Chat</h3>
									<p className='text-xs text-white/60'>Select export format to download transcript</p>
								</div>
							</div>
							<button onClick={() => setIsExportModalOpen(false)} className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'>
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

						<div className='space-y-3 my-5'>
							<label
								onClick={() => setExportFormat('md')}
								className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
									exportFormat === 'md'
										? 'bg-[#7678ed]/15 border-[#7678ed] text-white'
										: 'bg-[#2d2d30]/60 border-white/10 text-white/70 hover:bg-[#2d2d30]'
								}`}
							>
								<input
									type='radio'
									name='exportFormat'
									checked={exportFormat === 'md'}
									onChange={() => setExportFormat('md')}
									className='mt-1 accent-[#7678ed]'
								/>
								<div>
									<div className='text-sm font-semibold text-white flex items-center gap-2'>
										<span>Standard Markdown (.md)</span>
										<span className='px-2 py-0.5 text-[10px] rounded-md bg-white/10 text-white/80 font-mono'>DEFAULT</span>
									</div>
									<p className='text-xs text-white/60 mt-0.5 leading-relaxed'>
										Formatted Markdown transcript with timestamps and attachment blocks
									</p>
								</div>
							</label>

							<label
								onClick={() => setExportFormat('obsidian')}
								className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
									exportFormat === 'obsidian'
										? 'bg-[#7678ed]/15 border-[#7678ed] text-white'
										: 'bg-[#2d2d30]/60 border-white/10 text-white/70 hover:bg-[#2d2d30]'
								}`}
							>
								<input
									type='radio'
									name='exportFormat'
									checked={exportFormat === 'obsidian'}
									onChange={() => setExportFormat('obsidian')}
									className='mt-1 accent-[#7678ed]'
								/>
								<div>
									<div className='text-sm font-semibold text-white'>Obsidian Markdown (.md)</div>
									<p className='text-xs text-white/60 mt-0.5 leading-relaxed'>
										Uses Obsidian callouts (&gt; [!quote]- filename) for attachments
									</p>
								</div>
							</label>

							<label
								onClick={() => setExportFormat('json')}
								className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
									exportFormat === 'json'
										? 'bg-[#7678ed]/15 border-[#7678ed] text-white'
										: 'bg-[#2d2d30]/60 border-white/10 text-white/70 hover:bg-[#2d2d30]'
								}`}
							>
								<input
									type='radio'
									name='exportFormat'
									checked={exportFormat === 'json'}
									onChange={() => setExportFormat('json')}
									className='mt-1 accent-[#7678ed]'
								/>
								<div>
									<div className='text-sm font-semibold text-white'>JSON (.json)</div>
									<p className='text-xs text-white/60 mt-0.5 leading-relaxed'>
										Structured JSON containing chat metadata, messages, and attachments
									</p>
								</div>
							</label>

							<label
								onClick={() => setExportFormat('txt')}
								className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
									exportFormat === 'txt'
										? 'bg-[#7678ed]/15 border-[#7678ed] text-white'
										: 'bg-[#2d2d30]/60 border-white/10 text-white/70 hover:bg-[#2d2d30]'
								}`}
							>
								<input
									type='radio'
									name='exportFormat'
									checked={exportFormat === 'txt'}
									onChange={() => setExportFormat('txt')}
									className='mt-1 accent-[#7678ed]'
								/>
								<div>
									<div className='text-sm font-semibold text-white'>Plain Text (.txt)</div>
									<p className='text-xs text-white/60 mt-0.5 leading-relaxed'>Simple text transcript suitable for any text editor</p>
								</div>
							</label>
						</div>

						<div className='flex items-center justify-end gap-3 pt-2'>
							<button
								type='button'
								onClick={() => setIsExportModalOpen(false)}
								className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleExportChat}
								className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] text-white transition-all shadow-md shadow-[#7678ed]/30 flex items-center gap-2 cursor-pointer'
							>
								<svg
									width='16'
									height='16'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.2'
									strokeLinecap='round'
									strokeLinejoin='round'
								>
									<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
									<polyline points='7 10 12 15 17 10' />
									<line x1='12' y1='15' x2='12' y2='3' />
								</svg>
								<span>Export &amp; Download</span>
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

			{/* Select Model & Instance Modal */}
			{isSelectModelModalOpen && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-white text-[#202022] rounded-3xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-[#e8ebf3] animate-in fade-in zoom-in duration-200'>
						{/* Modal Header */}
						<div className='flex items-center justify-between pb-4 border-b border-[#eef0f6] shrink-0 mb-4'>
							<div className='flex items-center gap-2.5'>
								<div className='w-10 h-10 rounded-2xl bg-[#7678ed]/10 text-[#7678ed] flex items-center justify-center font-bold shrink-0 shadow-xs border border-[#7678ed]/20'>
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
										<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
										<circle cx='9' cy='7' r='4' />
										<path d='M22 21v-2a4 4 0 0 0-3-3.87' />
										<path d='M16 3.13a4 4 0 0 1 0 7.75' />
									</svg>
								</div>
								<div>
									<h3 className='text-xl font-bold text-[#202022] tracking-tight'>Select Model & Instance</h3>
									<p className='text-xs text-[#8e90a6] mt-0.5'>Choose the responding AI model and server instance</p>
								</div>
							</div>
							<button
								onClick={() => setIsSelectModelModalOpen(false)}
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

						{/* Search Input */}
						<div className='mb-4 relative shrink-0'>
							<svg
								width='16'
								height='16'
								viewBox='0 0 24 24'
								fill='none'
								stroke='#8e90a6'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'
								className='absolute left-3.5 top-3.5'
							>
								<circle cx='11' cy='11' r='8' />
								<line x1='21' y1='21' x2='16.65' y2='16.65' />
							</svg>
							<input
								type='text'
								placeholder='Search models or instances...'
								value={modelModalSearchQuery}
								onChange={(e) => setModelModalSearchQuery(e.target.value)}
								className='w-full bg-[#f0f2f9] text-[#202022] placeholder-[#8e90a6] rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#7678ed]/30 transition-all font-medium border border-[#e8ebf3]'
							/>
						</div>

						{/* Scrollable Instances & Models List */}
						<div className='flex-1 overflow-y-auto space-y-4 pr-1'>
							{(() => {
								const query = modelModalSearchQuery.toLowerCase().trim();

								const prefList = Array.from(new Map(Object.values(modelPreferences).map((p) => [p.id.toLowerCase(), p])).values()).filter(
									(pref) => {
										if (!query) return true;
										const prefName = (getCharacterName(pref.character) || pref.name || pref.id).toLowerCase();
										return prefName.includes(query) || pref.id.toLowerCase().includes(query);
									},
								);

								const filteredInstanceModels = instanceModelsList.filter((mod) => {
									if (!query) return true;
									const modName = (mod.name || mod.id || '').toLowerCase();
									return modName.includes(query);
								});

								if (instances.length === 0) {
									return (
										<div className='p-6 text-center text-[#8e90a6] text-sm italic'>
											No instances connected. Add an instance in settings.
										</div>
									);
								}

								return (
									<>
										{instances.map((inst) => {
											const instName = inst.properties?.name || inst.type;
											const isCurrentInst = selectedChatInstanceId === inst.id;

											return (
												<div
													key={`inst-modal-${inst.id}`}
													className='bg-[#f9fafc] rounded-2xl p-3.5 border border-[#e8ebf3] space-y-2.5'
												>
													<div className='flex items-center justify-between px-1'>
														<div className='flex items-center gap-2'>
															<span className='text-base'>💻</span>
															<h4 className='font-bold text-sm text-[#202022]'>{instName}</h4>
															<span className='text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#eaecf9] text-[#7678ed]'>
																{inst.type}
															</span>
														</div>
													</div>

													<div className='space-y-1.5 pl-2 border-l-2 border-[#7678ed]/20 ml-2'>
														{/* Model Preferences */}
														{prefList.map((pref) => {
															const prefName = getCharacterName(pref.character) || pref.name || pref.id;
															const isSelected = isCurrentInst && selectedChatModelId === pref.id;

															return (
																<button
																	key={`pref-opt-${inst.id}-${pref.id}`}
																	type='button'
																	onClick={() => {
																		setSelectedChatInstanceId(inst.id);
																		setSelectedChatModelId(pref.id);
																		fetchModelsForInstance(inst.id);
																		setIsSelectModelModalOpen(false);
																	}}
																	className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer border ${
																		isSelected
																			? 'bg-[#7678ed] text-white border-[#7678ed] shadow-md shadow-[#7678ed]/20'
																			: 'bg-white hover:bg-[#eaecf9] text-[#202022] border-[#e8ebf3]'
																	}`}
																>
																	<div className='flex items-center gap-2.5 truncate'>
																		<span className='text-sm shrink-0'>✨</span>
																		<div className='truncate'>
																			<p className='font-semibold text-xs truncate'>{prefName}</p>
																			<p
																				className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-[#8e90a6]'}`}
																			>
																				Model Preference @ {instName}
																			</p>
																		</div>
																	</div>
																	{isSelected && (
																		<svg
																			width='16'
																			height='16'
																			viewBox='0 0 24 24'
																			fill='none'
																			stroke='currentColor'
																			strokeWidth='3'
																			strokeLinecap='round'
																			strokeLinejoin='round'
																			className='shrink-0 ml-2'
																		>
																			<polyline points='20 6 9 17 4 12' />
																		</svg>
																	)}
																</button>
															);
														})}

														{/* Instance Models */}
														{filteredInstanceModels.map((mod) => {
															const modName = mod.name || mod.id;
															const isSelected = isCurrentInst && selectedChatModelId === mod.id;

															return (
																<button
																	key={`mod-opt-${inst.id}-${mod.id}`}
																	type='button'
																	onClick={() => {
																		setSelectedChatInstanceId(inst.id);
																		setSelectedChatModelId(mod.id);
																		fetchModelsForInstance(inst.id);
																		setIsSelectModelModalOpen(false);
																	}}
																	className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer border ${
																		isSelected
																			? 'bg-[#7678ed] text-white border-[#7678ed] shadow-md shadow-[#7678ed]/20'
																			: 'bg-white hover:bg-[#eaecf9] text-[#202022] border-[#e8ebf3]'
																	}`}
																>
																	<div className='flex items-center gap-2.5 truncate'>
																		<span className='text-sm shrink-0'>🤖</span>
																		<div className='truncate'>
																			<p className='font-semibold text-xs truncate'>{modName}</p>
																			<p
																				className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-[#8e90a6]'}`}
																			>
																				Model @ {instName}
																			</p>
																		</div>
																	</div>
																	{isSelected && (
																		<svg
																			width='16'
																			height='16'
																			viewBox='0 0 24 24'
																			fill='none'
																			stroke='currentColor'
																			strokeWidth='3'
																			strokeLinecap='round'
																			strokeLinejoin='round'
																			className='shrink-0 ml-2'
																		>
																			<polyline points='20 6 9 17 4 12' />
																		</svg>
																	)}
																</button>
															);
														})}

														{prefList.length === 0 && filteredInstanceModels.length === 0 && (
															<div className='p-2 text-xs text-[#8e90a6] italic'>No models listed for this instance.</div>
														)}
													</div>
												</div>
											);
										})}
									</>
								);
							})()}
						</div>
					</div>
				</div>
			)}

			{/* Folder Context Menu */}
			{folderContextMenu && (
				<div
					className='fixed z-[9999] bg-[#28282b] text-white border border-[#3e3e42] rounded-2xl p-1.5 shadow-2xl min-w-[160px] animate-in fade-in zoom-in-95 duration-150 select-none'
					style={{ left: `${folderContextMenu.x}px`, top: `${folderContextMenu.y}px` }}
					onClick={(e) => e.stopPropagation()}
				>
					<div className='px-3 py-1.5 border-b border-[#3e3e42] mb-1'>
						<p className='text-[11px] font-bold text-[#8b8d97] uppercase tracking-wider truncate max-w-[140px]'>{folderContextMenu.folderName}</p>
					</div>
					<button
						type='button'
						onClick={() => handleStartRenameFolder(folderContextMenu.folderId, folderContextMenu.folderName)}
						className='w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2 transition-colors cursor-pointer'
					>
						<svg
							width='14'
							height='14'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
						>
							<path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
							<path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
						</svg>
						Rename
					</button>
					<button
						type='button'
						onClick={() => handleStartDeleteFolder(folderContextMenu.folderId, folderContextMenu.folderName)}
						className='w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors cursor-pointer'
					>
						<svg
							width='14'
							height='14'
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
			)}

			{/* Line Context Menu */}
			{lineContextMenu && (
				<div
					className='fixed z-[9999] bg-[#28282b] text-white border border-[#3e3e42] rounded-2xl p-1.5 shadow-2xl min-w-[170px] animate-in fade-in zoom-in-95 duration-150 select-none'
					style={{ left: `${lineContextMenu.x}px`, top: `${lineContextMenu.y}px` }}
					onClick={(e) => e.stopPropagation()}
				>
					<button
						type='button'
						onClick={() => {
							const { msgId, lineText, lineIndex, voice } = lineContextMenu;
							setLineContextMenu(null);
							handlePlayTTSLine(msgId, lineText, lineIndex, voice);
						}}
						className='w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2 transition-colors cursor-pointer'
					>
						<svg width='14' height='14' viewBox='0 0 24 24' fill='currentColor'>
							<polygon points='5 3 19 12 5 21 5 3' />
						</svg>
						Play Line
					</button>
					<button
						type='button'
						onClick={() => {
							const { msgId, fullContent, lineIndex, voice } = lineContextMenu;
							setLineContextMenu(null);
							handlePlayTTS(msgId, fullContent, voice, lineIndex);
						}}
						className='w-full text-left px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[#38383c] hover:text-[#7678ed] flex items-center gap-2 transition-colors cursor-pointer'
					>
						<svg
							width='14'
							height='14'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
						>
							<polygon points='5 3 19 12 5 21 5 3' fill='currentColor' />
							<line x1='19' y1='5' x2='19' y2='19' strokeWidth='2.5' />
						</svg>
						Play from here
					</button>
				</div>
			)}

			{/* Rename Folder Modal */}
			{renamingFolder && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-4'>
							<h3 className='text-lg font-bold'>Rename Folder</h3>
							<button onClick={() => setRenamingFolder(null)} className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'>
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
						<form onSubmit={handleConfirmRenameFolder} className='space-y-4'>
							<div>
								<label className='block text-xs font-semibold text-white/70 mb-1'>Folder Name</label>
								<input
									type='text'
									autoFocus
									placeholder='Folder Name'
									value={renameFolderNameInput}
									onChange={(e) => setRenameFolderNameInput(e.target.value)}
									className='w-full bg-[#2d2d30] border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-colors'
								/>
							</div>
							<div className='flex items-center justify-end gap-3 pt-2'>
								<button
									type='button'
									onClick={() => setRenamingFolder(null)}
									className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
								>
									Cancel
								</button>
								<button
									type='submit'
									disabled={!renameFolderNameInput.trim()}
									className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer'
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
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-2'>
							<h3 className='text-lg font-bold text-rose-400'>Delete Folder?</h3>
							<button onClick={() => setDeletingFolder(null)} className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'>
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
							Are you sure you want to delete <strong className='text-white'>"{deletingFolder.name}"</strong>? Chats in this folder will be moved
							to No Folder.
						</p>
						<div className='flex items-center justify-end gap-3'>
							<button
								type='button'
								onClick={() => setDeletingFolder(null)}
								className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleConfirmDeleteFolder}
								className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/30 cursor-pointer'
							>
								Delete Folder
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Create / Edit Lorebook Template Modal */}
			{isLorebookModalOpen && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-4 pb-3 border-b border-white/10'>
							<h3 className='text-lg font-bold text-white'>{editingLorebookTemplate ? 'Edit Character Template' : 'New Character Template'}</h3>
							<button
								onClick={() => setIsLorebookModalOpen(false)}
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

						<form onSubmit={handleSaveLorebookTemplate} className='space-y-4'>
							<div>
								<label className='block text-xs font-semibold text-white/80 mb-1.5'>Character / Template Name</label>
								<input
									type='text'
									required
									value={lorebookFormName}
									onChange={(e) => setLorebookFormName(e.target.value)}
									placeholder='e.g., Cyberpunk Hacker'
									className='w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-all'
								/>
							</div>

							<div>
								<label className='block text-xs font-semibold text-white/80 mb-1.5'>Trigger Keywords (comma-separated)</label>
								<input
									type='text'
									value={lorebookFormKeys}
									onChange={(e) => setLorebookFormKeys(e.target.value)}
									placeholder='e.g., hacker, cyberware, netrunner'
									className='w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-all'
								/>
								<span className='text-[11px] text-white/50 block mt-1'>
									Messages containing any of these keywords will trigger this lore context.
								</span>
							</div>

							<div>
								<label className='block text-xs font-semibold text-white/80 mb-1.5'>Lore Content</label>
								<textarea
									rows={5}
									value={lorebookFormContent}
									onChange={(e) => setLorebookFormContent(e.target.value)}
									placeholder='Enter detailed background story, rules, or character prompt context...'
									className='w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-all font-mono leading-relaxed resize-y'
								/>
							</div>

							<div className='flex items-center justify-end gap-3 pt-3 border-t border-white/10'>
								<button
									type='button'
									onClick={() => setIsLorebookModalOpen(false)}
									className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
								>
									Cancel
								</button>
								<button
									type='submit'
									disabled={lorebookSaving || !lorebookFormName.trim()}
									className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer'
								>
									{lorebookSaving ? 'Saving...' : 'Save Template'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Apply Persona to Model Modal */}
			{applyPersonaModalTemplate && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-4 pb-3 border-b border-white/10'>
							<h3 className='text-lg font-bold text-white'>Apply Persona to Model</h3>
							<button
								onClick={() => setApplyPersonaModalTemplate(null)}
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

						<div className='space-y-4'>
							<div className='p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3'>
								<div className='w-10 h-10 rounded-xl bg-[#eaecf9] text-[#7678ed] overflow-hidden flex items-center justify-center shrink-0'>
									{applyPersonaModalTemplate.picture ? (
										<img
											src={applyPersonaModalTemplate.picture}
											alt={applyPersonaModalTemplate.name}
											className='w-full h-full object-cover'
										/>
									) : (
										<span>🎭</span>
									)}
								</div>
								<div>
									<h4 className='font-bold text-sm text-white'>{applyPersonaModalTemplate.name}</h4>
									<span className='text-[11px] font-mono text-white/50 block'>{applyPersonaModalTemplate.filename}</span>
								</div>
							</div>

							<div>
								<label className='block text-xs font-semibold text-white/80 mb-1.5'>Select Target Model</label>
								<select
									value={applyPersonaSelectedModelId}
									onChange={(e) => setApplyPersonaSelectedModelId(e.target.value)}
									className='w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#7678ed] transition-all cursor-pointer'
								>
									<option value='' className='bg-[#202022] text-white'>
										Select a model...
									</option>
									{instanceModelsList.map((mod) => (
										<option key={mod.id} value={mod.id} className='bg-[#202022] text-white'>
											{mod.name || mod.id} ({mod.provider || 'AI'})
										</option>
									))}
								</select>
							</div>

							<div className='flex items-center justify-end gap-3 pt-3 border-t border-white/10'>
								<button
									type='button'
									onClick={() => setApplyPersonaModalTemplate(null)}
									className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
								>
									Cancel
								</button>
								<button
									type='button'
									disabled={isApplyingPersona || !applyPersonaSelectedModelId}
									onClick={() => handleApplyPersonaToModel(applyPersonaModalTemplate, applyPersonaSelectedModelId)}
									className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer'
								>
									{isApplyingPersona ? 'Applying...' : 'Apply Persona'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Delete Persona Template Confirmation Modal */}
			{deletingPersonaTemplate && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-2'>
							<h3 className='text-lg font-bold text-rose-400'>Delete Persona?</h3>
							<button
								onClick={() => setDeletingPersonaTemplate(null)}
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
						<p className='text-sm text-white/70 leading-relaxed mb-6'>
							Are you sure you want to delete persona template <strong className='text-white'>"{deletingPersonaTemplate.name}"</strong> (
							<span className='font-mono text-xs text-white/50'>{deletingPersonaTemplate.filename}</span>)? This action cannot be undone.
						</p>
						<div className='flex items-center justify-end gap-3'>
							<button
								type='button'
								onClick={() => setDeletingPersonaTemplate(null)}
								className='px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleConfirmDeletePersonaTemplate}
								className='px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/30 cursor-pointer'
							>
								Delete Persona
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
