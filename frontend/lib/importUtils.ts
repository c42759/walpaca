/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ImportedMessage {
	role: 'user' | 'assistant';
	content: string;
	model?: string;
	date_time?: string;
	attachments?: Array<{
		name: string;
		type: string;
		content: string;
	}>;
}

export interface ImportedChat {
	title: string;
	messages: ImportedMessage[];
}

export const parseImportContent = (fileName: string, text: string): ImportedChat[] => {
	const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
	const trimmed = text.trim();

	// 1. JSON Parsing
	if (fileName.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			const parsed = JSON.parse(text);
			const results: ImportedChat[] = [];

			const processJsonObject = (obj: any): ImportedChat | null => {
				if (!obj || typeof obj !== 'object') return null;

				// ChatGPT export format (mapping object)
				if (obj.mapping && typeof obj.mapping === 'object') {
					const title = obj.title || cleanFileName;
					const msgs: ImportedMessage[] = [];
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
					const msgs: ImportedMessage[] = obj.chat_messages
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
					const msgs: ImportedMessage[] = obj.messages
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

		const messages: ImportedMessage[] = [];
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
				const attachments: Array<{ name: string; type: string; content: string }> = [];

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
	const messages: ImportedMessage[] = [];
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
