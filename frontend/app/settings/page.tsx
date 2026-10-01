'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore, InstanceItem, ModelPreference } from '@/store/useAppStore';
import { getApiUrl } from '@/lib/api';
import { parseImportContent } from '@/lib/importUtils';
import { getCharacterName } from '@/lib/characterUtils';

import { SettingsSidebar, SettingsCategory } from '@/components/settings/SettingsSidebar';
import { SettingsHelpSidebar } from '@/components/settings/SettingsHelpSidebar';
import { ManageLorebookPanel } from '@/components/settings/ManageLorebookPanel';
import { ManagePersonasPanel, PersonaTemplate, LorebookTemplate } from '@/components/settings/ManagePersonasPanel';

export default function SettingsPage() {
	const router = useRouter();
	const {
		instances,
		fetchInstances,
		setInstances: setStoreInstances,
		modelPreferences,
		fetchModelPreferences,
		setModelPreference: setStoreModelPreference,
		fetchInstanceModels,
		setCurrentView,
	} = useAppStore();

	const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('import-chat');

	// --- Lorebook State ---
	const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplate[]>([]);
	const [isLorebookLoading, setIsLorebookLoading] = useState<boolean>(false);

	const fetchLorebookTemplates = async () => {
		setIsLorebookLoading(true);
		try {
			const res = await fetch(`${getApiUrl()}/lorebook`);
			if (res.ok) {
				const data = await res.json();
				setLorebookTemplates(Array.isArray(data) ? data : []);
			}
		} catch (err) {
			console.warn('Could not fetch lorebook templates:', err);
		} finally {
			setIsLorebookLoading(false);
		}
	};

	// --- Persona State & Modals ---
	const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplate[]>([]);
	const [isPersonaLoading, setIsPersonaLoading] = useState<boolean>(false);
	const [applyPersonaModalTemplate, setApplyPersonaModalTemplate] = useState<PersonaTemplate | null>(null);
	const [applyPersonaSelectedModelId, setApplyPersonaSelectedModelId] = useState<string>('');
	const [isApplyingPersona, setIsApplyingPersona] = useState<boolean>(false);
	const [deletingPersonaTemplate, setDeletingPersonaTemplate] = useState<PersonaTemplate | null>(null);

	const fetchPersonaTemplates = async () => {
		setIsPersonaLoading(true);
		try {
			const res = await fetch(`${getApiUrl()}/personas`);
			if (res.ok) {
				const data = await res.json();
				setPersonaTemplates(Array.isArray(data) ? data : []);
			}
		} catch (err) {
			console.warn('Could not fetch persona templates:', err);
		} finally {
			setIsPersonaLoading(false);
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

	// --- Instances Management State ---
	const [instanceSubView, setInstanceSubView] = useState<'list' | 'select-type' | 'form' | 'instance-models' | 'edit-model'>('list');
	const [selectedInstanceForModels, setSelectedInstanceForModels] = useState<InstanceItem | null>(null);
	const [instanceModelsList, setInstanceModelsList] = useState<any[]>([]);
	const [selectedInstanceType, setSelectedInstanceType] = useState<string>('Ollama');
	const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

	// Instance Form fields
	const [instFormName, setInstFormName] = useState<string>('Instance');
	const [instFormUrl, setInstFormUrl] = useState<string>('http://0.0.0.0:11434');
	const [instFormApiKey, setInstFormApiKey] = useState<string>('');
	const [showApiKeyText, setShowApiKeyText] = useState<boolean>(false);
	const [instFormThink, setInstFormThink] = useState<boolean>(false);
	const [instFormShareName, setInstFormShareName] = useState<number>(2);
	const [instFormShowMetadata, setInstFormShowMetadata] = useState<boolean>(false);
	const [instFormAllowSsl, setInstFormAllowSsl] = useState<boolean>(false);
	const [instFormOverrideParams, setInstFormOverrideParams] = useState<boolean>(true);
	const [instFormTemp, setInstFormTemp] = useState<number>(0.7);
	const [instFormSeed, setInstFormSeed] = useState<number>(0);
	const [instFormNumCtx, setInstFormNumCtx] = useState<number>(16384);
	const [instFormKeepAliveMinutes, setInstFormKeepAliveMinutes] = useState<number>(5);

	// Edit Model State
	const [editingModel, setEditingModel] = useState<any | null>(null);
	const [editModelVoice, setEditModelVoice] = useState<string>('af_heart');
	const [editModelNumCtx, setEditModelNumCtx] = useState<number>(8192);
	const [editModelName, setEditModelName] = useState<string>('');
	const [editModelDescription, setEditModelDescription] = useState<string>('');
	const [editModelFirstMessage, setEditModelFirstMessage] = useState<string>('');
	const [editModelAlternateGreetings, setEditModelAlternateGreetings] = useState<string[]>([]);
	const [editModelCharacterBook, setEditModelCharacterBook] = useState<Array<{ name: string; description: string; tags: string }>>([]);

	// Import Chat State
	const [isImporting, setIsImporting] = useState<boolean>(false);
	const [importStatusMessage, setImportStatusMessage] = useState<string>('');
	const [isDraggingImport, setIsDraggingImport] = useState<boolean>(false);
	const importFileInputRef = useRef<HTMLInputElement>(null);

	// Lifecycle
	useEffect(() => {
		fetchInstances();
		fetchModelPreferences();

		let isMounted = true;
		(async () => {
			try {
				const [lbRes, perRes] = await Promise.all([
					fetch(`${getApiUrl()}/lorebook`),
					fetch(`${getApiUrl()}/personas`),
				]);
				if (lbRes.ok && isMounted) {
					const data = await lbRes.json();
					setLorebookTemplates(Array.isArray(data) ? data : []);
				}
				if (perRes.ok && isMounted) {
					const data = await perRes.json();
					setPersonaTemplates(Array.isArray(data) ? data : []);
				}
			} catch (err) {
				console.warn('Initial settings load error:', err);
			}
		})();

		return () => {
			isMounted = false;
		};
	}, [fetchInstances, fetchModelPreferences]);

	// Handlers: Instances
	const handleOpenAddInstanceModal = () => {
		setInstanceSubView('select-type');
	};

	const handleSelectInstanceType = (typeLabel: string) => {
		setSelectedInstanceType(typeLabel);
		setEditingInstanceId(null);

		let defaultName = 'Instance';
		let defaultUrl = 'http://0.0.0.0:11434';
		if (typeLabel.includes('Ollama')) {
			defaultName = 'Ollama External';
			defaultUrl = 'http://0.0.0.0:11434';
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
		setInstFormTemp(0.7);
		setInstFormSeed(0);
		setInstFormNumCtx(16384);
		setInstFormKeepAliveMinutes(5);

		setInstanceSubView('form');
	};

	const handleOpenEditInstanceModal = (inst: InstanceItem) => {
		setEditingInstanceId(inst.id);
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
		setInstFormTemp(inst.properties?.temperature ?? 0.7);
		setInstFormSeed(inst.properties?.seed ?? 0);
		setInstFormNumCtx(inst.properties?.num_ctx ?? 16384);
		setInstFormKeepAliveMinutes(inst.properties?.keep_alive ?? 5);

		setInstanceSubView('form');
	};

	const handleDeleteInstance = async (id: string) => {
		setStoreInstances(instances.filter((item) => item.id !== id));
		try {
			await fetch(`${getApiUrl()}/instances/${id}`, { method: 'DELETE' });
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
				await fetch(`${getApiUrl()}/instances/${editingInstanceId}`, {
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
				const res = await fetch(`${getApiUrl()}/instances`, {
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
		const charData = (char as any).data || char || {};

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
				description: e.content || '',
				tags: Array.isArray(e.keys) ? e.keys.join(', ') : String(e.keys || ''),
			}));
		} else if (Array.isArray(charData.character_book)) {
			cbItems = charData.character_book.map((e: any) => ({
				name: e.name || '',
				description: e.description || e.content || '',
				tags: Array.isArray(e.tags) ? e.tags.join(', ') : String(e.tags || ''),
			}));
		}
		setEditModelCharacterBook(cbItems);
		setInstanceSubView('edit-model');
	};

	const handleSaveModelPreference = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingModel) return;

		const rawId = String(editingModel.id || '');
		const prefKey = rawId.toLowerCase();
		const existingPref = modelPreferences[rawId] || modelPreferences[prefKey];
		const existingChar = existingPref?.character || {};
		const existingCharData = (existingChar as any).data || existingChar || {};

		const updatedCharacter = {
			...existingCharData,
			name: editModelName.trim(),
			description: editModelDescription.trim(),
			personality: editModelDescription.trim(),
			first_mes: editModelFirstMessage.trim(),
			alternate_greetings: editModelAlternateGreetings,
			character_book: {
				...(existingCharData.character_book || {}),
				entries: editModelCharacterBook.map((b) => ({
					comment: b.name,
					name: b.name,
					content: b.description,
					keys: b.tags.split(',').map((t) => t.trim()).filter(Boolean),
					enabled: true,
				})),
			},
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
			await fetch(`${getApiUrl()}/model-preferences`, {
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
				setImportStatusMessage('No valid chat messages found in selected file(s).');
				setIsImporting(false);
				return;
			}

			setImportStatusMessage(`Importing ${allParsedChats.length} conversation(s)...`);
			const res = await fetch(`${getApiUrl()}/chats/import`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ chats: allParsedChats }),
			});

			if (!res.ok) {
				throw new Error('Failed to import chats');
			}

			const newChats = await res.json();
			setImportStatusMessage(`Successfully imported ${newChats.length} conversation(s)!`);

			if (newChats.length > 0 && newChats[0].id) {
				setTimeout(() => {
					setCurrentView('chat');
					router.push(`/?chat=${newChats[0].id}`);
				}, 1000);
			}
		} catch (e: any) {
			console.error('Import error:', e);
			setImportStatusMessage(`Import failed: ${e.message || 'Unknown error'}`);
		} finally {
			setIsImporting(false);
		}
	};

	return (
		<>
			{/* Inner Settings Area matching App Layout */}
			<div className='flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text'>
				{/* 1. SETTINGS CATEGORIES SIDEBAR matching ChatListPanel Layout */}
				<SettingsSidebar
					activeSettingsCategory={activeSettingsCategory}
					setActiveSettingsCategory={setActiveSettingsCategory}
					setCurrentView={setCurrentView}
				/>

				{/* 2. MIDDLE SETTINGS CONTENT AREA */}
				<main className='flex-1 p-8 overflow-y-auto'>
					<div className='max-w-3xl mx-auto space-y-8'>
						{/* View: Import Chat */}
						{activeSettingsCategory === 'import-chat' && (
							<div className='space-y-6 animate-in fade-in duration-200'>
								<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex items-center gap-3.5'>
									<div className='w-12 h-12 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/20 text-[#7678ed] flex items-center justify-center shrink-0 shadow-xs'>
										<svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
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
										<svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
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
												Supports Walpaca JSON (.json), ChatGPT export (.json), Claude export (.json), Markdown (.md), and Plain Text (.txt)
											</p>
											<button
												type='button'
												onClick={(e) => {
													e.stopPropagation();
													importFileInputRef.current?.click();
												}}
												className='px-5 py-2.5 rounded-2xl bg-[#7678ed] hover:bg-[#6869d9] text-white font-semibold text-xs transition-all shadow-sm'
											>
												Browse Local Files
											</button>
										</>
									)}
								</div>

								{importStatusMessage && !isImporting && (
									<div className='p-4 rounded-2xl bg-[#eaecf9] text-[#7678ed] font-medium text-xs text-center border border-[#7678ed]/20'>
										{importStatusMessage}
									</div>
								)}
							</div>
						)}

						{/* View: Manage Instances */}
						{activeSettingsCategory === 'manage-instances' && (
							<div>
								{/* View 1: List */}
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
													Click &ldquo;Add Instance&rdquo; above to connect an Ollama local or remote server to Walpaca.
												</p>
												<button
													onClick={handleOpenAddInstanceModal}
													className='px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold rounded-2xl transition-all shadow-xs'
												>
													+ Add First Instance
												</button>
											</div>
										) : (
											<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
												{instances.map((inst) => (
													<div
														key={inst.id}
														className='p-5 rounded-2xl bg-white border border-[#e8ebf3] hover:border-[#7678ed]/40 transition-all shadow-xs flex flex-col justify-between'
													>
														<div>
															<div className='flex items-center justify-between mb-2'>
																<h4 className='text-base font-bold text-[#202022]'>
																	{inst.properties?.name || inst.type}
																</h4>
																<span className='px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#eaecf9] text-[#7678ed]'>
																	{inst.type}
																</span>
															</div>
															<p className='text-xs text-[#8e90a6] font-mono truncate mb-4'>
																{inst.properties?.url || 'http://0.0.0.0:11434'}
															</p>
														</div>

														<div className='flex items-center justify-between pt-3 border-t border-[#e8ebf3] gap-2'>
															<button
																onClick={() => handleManageInstanceModels(inst)}
																className='px-3 py-1.5 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] text-xs font-semibold transition-all'
															>
																Models
															</button>
															<div className='flex items-center gap-1'>
																<button
																	onClick={() => handleOpenEditInstanceModal(inst)}
																	className='p-1.5 text-[#7a7d90] hover:text-[#7678ed] transition-colors rounded-lg hover:bg-[#eaecf9]'
																	title='Edit'
																>
																	<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																		<path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
																		<path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
																	</svg>
																</button>
																<button
																	onClick={() => handleDeleteInstance(inst.id)}
																	className='p-1.5 text-[#7a7d90] hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50'
																	title='Delete'
																>
																	<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
																		<polyline points='3 6 5 6 21 6' />
																		<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
																	</svg>
																</button>
															</div>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								)}

								{/* View 2: Select Provider Type */}
								{instanceSubView === 'select-type' && (
									<div className='space-y-6 animate-in fade-in duration-200'>
										<div className='flex items-center gap-3'>
											<button
												onClick={() => setInstanceSubView('list')}
												className='p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer'
											>
												<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
													<line x1='19' y1='12' x2='5' y2='12' />
													<polyline points='12 19 5 12 12 5' />
												</svg>
											</button>
											<div>
												<h3 className='text-2xl font-bold text-[#202022]'>Select Provider Type</h3>
												<p className='text-xs text-[#7a7d90] mt-0.5'>Choose the backend engine for this instance</p>
											</div>
										</div>

										<div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
											{[
												{ name: 'Ollama', desc: 'Local Ollama instance on localhost:11434', icon: '🦙' },
												{ name: 'OpenAI ChatGPT', desc: 'Official OpenAI API (GPT-4o, o1, etc.)', icon: '⚡' },
												{ name: 'Google Gemini', desc: 'Gemini Pro / Flash models via Generative AI', icon: '✨' },
												{ name: 'Anthropic Claude', desc: 'Claude 3.5 Sonnet & Haiku models', icon: '🧠' },
												{ name: 'Deepseek AI', desc: 'DeepSeek Chat & DeepSeek Reasoner API', icon: '🐋' },
												{ name: 'Groq Cloud', desc: 'Ultra-fast LPU inference endpoints', icon: '🚀' },
												{ name: 'Together AI', desc: 'Open-weights cloud inference engine', icon: '🤝' },
												{ name: 'OpenRouter AI', desc: 'Unified API routing across dozens of models', icon: '🌐' },
											].map((prov) => (
												<button
													key={prov.name}
													onClick={() => handleSelectInstanceType(prov.name)}
													className='p-4 rounded-2xl bg-white border border-[#e8ebf3] hover:border-[#7678ed] hover:shadow-sm transition-all text-left flex items-center gap-3.5 group cursor-pointer'
												>
													<div className='w-11 h-11 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-xl shrink-0 group-hover:scale-105 transition-transform'>
														{prov.icon}
													</div>
													<div>
														<h4 className='text-sm font-bold text-[#202022]'>{prov.name}</h4>
														<p className='text-xs text-[#7a7d90] mt-0.5'>{prov.desc}</p>
													</div>
												</button>
											))}
										</div>
									</div>
								)}

								{/* View 3: Instance Form */}
								{instanceSubView === 'form' && (
									<div className='space-y-6 animate-in fade-in duration-200'>
										<div className='flex items-center gap-3'>
											<button
												onClick={() => setInstanceSubView(editingInstanceId ? 'list' : 'select-type')}
												className='p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer'
											>
												<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
													<line x1='19' y1='12' x2='5' y2='12' />
													<polyline points='12 19 5 12 12 5' />
												</svg>
											</button>
											<div>
												<h3 className='text-2xl font-bold text-[#202022]'>
													{editingInstanceId ? 'Edit Instance' : `Add ${selectedInstanceType}`}
												</h3>
												<p className='text-xs text-[#7a7d90] mt-0.5'>Configure connection and execution parameters</p>
											</div>
										</div>

										<form onSubmit={handleSaveInstanceForm} className='bg-white p-6 rounded-2xl border border-[#e8ebf3] shadow-xs space-y-4'>
											<div>
												<label className='block text-xs font-semibold text-[#202022] mb-1.5'>Instance Name</label>
												<input
													type='text'
													value={instFormName}
													onChange={(e) => setInstFormName(e.target.value)}
													className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] outline-none focus:border-[#7678ed] transition-all'
													placeholder='e.g. My Ollama Box'
													required
												/>
											</div>

											<div>
												<label className='block text-xs font-semibold text-[#202022] mb-1.5'>Server Endpoint URL</label>
												<input
													type='text'
													value={instFormUrl}
													onChange={(e) => setInstFormUrl(e.target.value)}
													className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] font-mono outline-none focus:border-[#7678ed] transition-all'
													placeholder='http://0.0.0.0:11434'
													required
												/>
											</div>

											<div>
												<div className='flex items-center justify-between mb-1.5'>
													<label className='block text-xs font-semibold text-[#202022]'>API Key</label>
													<button
														type='button'
														onClick={() => setShowApiKeyText(!showApiKeyText)}
														className='text-[11px] text-[#7678ed] hover:underline'
													>
														{showApiKeyText ? 'Hide' : 'Show'}
													</button>
												</div>
												<input
													type={showApiKeyText ? 'text' : 'password'}
													value={instFormApiKey}
													onChange={(e) => setInstFormApiKey(e.target.value)}
													className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] font-mono outline-none focus:border-[#7678ed] transition-all'
													placeholder='Optional for local Ollama'
												/>
											</div>

											<div className='pt-2 flex items-center justify-between border-t border-[#e8ebf3]'>
												<span className='text-xs font-semibold text-[#202022]'>Enable Reasoning / Thinking Output</span>
												<input
													type='checkbox'
													checked={instFormThink}
													onChange={(e) => setInstFormThink(e.target.checked)}
													className='w-4 h-4 rounded text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer'
												/>
											</div>

											<div className='pt-4 flex items-center justify-end gap-3 border-t border-[#e8ebf3]'>
												<button
													type='button'
													onClick={() => setInstanceSubView('list')}
													className='px-4 py-2 rounded-xl text-xs font-semibold text-[#7a7d90] hover:text-[#202022] hover:bg-[#eaecf9] transition-all'
												>
													Cancel
												</button>
												<button
													type='submit'
													className='px-5 py-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold shadow-xs transition-all'
												>
													Save Instance
												</button>
											</div>
										</form>
									</div>
								)}

								{/* View 4: Instance Models */}
								{instanceSubView === 'instance-models' && selectedInstanceForModels && (
									<div className='space-y-6 animate-in fade-in duration-200'>
										<div className='flex items-center gap-3'>
											<button
												onClick={() => setInstanceSubView('list')}
												className='p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer'
											>
												<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
													<line x1='19' y1='12' x2='5' y2='12' />
													<polyline points='12 19 5 12 12 5' />
												</svg>
											</button>
											<div>
												<h3 className='text-2xl font-bold text-[#202022]'>
													Models — {selectedInstanceForModels.properties?.name || selectedInstanceForModels.type}
												</h3>
												<p className='text-xs text-[#7a7d90] mt-0.5'>Configure voice and preferences for each model</p>
											</div>
										</div>

										<div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
											{instanceModelsList.map((mod) => (
												<div
													key={mod.id}
													className='p-4 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex items-center justify-between gap-3'
												>
													<div className='min-w-0'>
														<h4 className='text-sm font-bold text-[#202022] truncate'>{mod.name || mod.id}</h4>
														<span className='text-[11px] font-mono text-[#7a7d90] block truncate'>{mod.id}</span>
													</div>
													<button
														onClick={() => handleOpenEditModelModal(mod)}
														className='px-3 py-1.5 rounded-xl bg-[#eaecf9] hover:bg-[#7678ed] hover:text-white text-[#7678ed] text-xs font-semibold transition-all shrink-0'
													>
														Configure
													</button>
												</div>
											))}
										</div>
									</div>
								)}

								{/* View 5: Edit Model */}
								{instanceSubView === 'edit-model' && editingModel && (
									<div className='space-y-6 animate-in fade-in duration-200'>
										<div className='flex items-center gap-3'>
											<button
												onClick={() => setInstanceSubView('instance-models')}
												className='p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer'
											>
												<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
													<line x1='19' y1='12' x2='5' y2='12' />
													<polyline points='12 19 5 12 12 5' />
												</svg>
											</button>
											<div>
												<h3 className='text-2xl font-bold text-[#202022]'>
													Edit Model — {editingModel.name || editingModel.id}
												</h3>
												<p className='text-xs text-[#7a7d90] mt-0.5'>Configure persona details and TTS voice</p>
											</div>
										</div>

										<form onSubmit={handleSaveModelPreference} className='bg-white p-6 rounded-2xl border border-[#e8ebf3] shadow-xs space-y-4'>
											<div>
												<label className='block text-xs font-semibold text-[#202022] mb-1.5'>Display Name</label>
												<input
													type='text'
													value={editModelName}
													onChange={(e) => setEditModelName(e.target.value)}
													className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] outline-none focus:border-[#7678ed] transition-all'
													placeholder='Model Display Name'
												/>
											</div>

											<div>
												<label className='block text-xs font-semibold text-[#202022] mb-1.5'>TTS Voice</label>
												<input
													type='text'
													value={editModelVoice}
													onChange={(e) => setEditModelVoice(e.target.value)}
													className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] font-mono outline-none focus:border-[#7678ed] transition-all'
													placeholder='af_heart'
												/>
											</div>

											<div>
												<label className='block text-xs font-semibold text-[#202022] mb-1.5'>Context Size (Tokens)</label>
												<input
													type='number'
													value={editModelNumCtx}
													onChange={(e) => setEditModelNumCtx(Number(e.target.value))}
													className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] font-mono outline-none focus:border-[#7678ed] transition-all'
													placeholder='8192'
												/>
											</div>

											<div>
												<label className='block text-xs font-semibold text-[#202022] mb-1.5'>First Message (Greeting)</label>
												<textarea
													value={editModelFirstMessage}
													onChange={(e) => setEditModelFirstMessage(e.target.value)}
													rows={3}
													className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-4 py-2.5 text-sm text-[#202022] outline-none focus:border-[#7678ed] transition-all resize-none'
													placeholder='Initial greeting when starting new chat...'
												/>
											</div>

											<div className='pt-4 flex items-center justify-end gap-3 border-t border-[#e8ebf3]'>
												<button
													type='button'
													onClick={() => setInstanceSubView('instance-models')}
													className='px-4 py-2 rounded-xl text-xs font-semibold text-[#7a7d90] hover:text-[#202022] hover:bg-[#eaecf9] transition-all'
												>
													Cancel
												</button>
												<button
													type='submit'
													className='px-5 py-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold shadow-xs transition-all'
												>
													Save Preferences
												</button>
											</div>
										</form>
									</div>
								)}
							</div>
						)}

						{/* View: Manage Lorebook */}
						{activeSettingsCategory === 'manage-lorebook' && (
							<ManageLorebookPanel
								lorebookTemplates={lorebookTemplates}
								isLorebookLoading={isLorebookLoading}
								getApiUrl={getApiUrl}
								fetchLorebookTemplates={fetchLorebookTemplates}
							/>
						)}

						{/* View: Manage Personas */}
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

						{/* View: Preferences */}
						{activeSettingsCategory === 'preferences' && (
							<div className='space-y-6 animate-in fade-in duration-200'>
								<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex items-center gap-3.5'>
									<div className='w-12 h-12 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/20 text-[#7678ed] flex items-center justify-center shrink-0 shadow-xs'>
										<svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
											<line x1='4' y1='21' x2='4' y2='14' />
											<line x1='4' y1='10' x2='4' y2='3' />
											<line x1='12' y1='21' x2='12' y2='12' />
											<line x1='12' y1='8' x2='12' y2='3' />
											<line x1='20' y1='21' x2='20' y2='16' />
											<line x1='20' y1='12' x2='20' y2='3' />
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

						{/* View: About Walpaca */}
						{activeSettingsCategory === 'about-walpaca' && (
							<div className='space-y-6 animate-in fade-in duration-200 pb-8'>
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
											<p className='text-xs text-[#7a7d90] mt-0.5 font-medium'>
												Web interface inspired on Jeffser/Alpaca GTK client.
											</p>
										</div>
									</div>

									<p className='text-xs text-[#404252] leading-relaxed pt-3 border-t border-[#e8ebf3]'>
										Walpaca lets you access your local Alpaca workspace across your network or VPN. It mounts the exact same SQLite database file (alpaca.db) used by the native desktop app, keeping your existing chats and settings synchronized.
									</p>
								</div>

								<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4'>
									<div className='text-[#202022] font-bold text-base pb-3 border-b border-[#e8ebf3] flex items-center gap-2'>
										<span>⚡</span>
										<span>Features</span>
									</div>
									<div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#404252]'>
										{[
											{ icon: '💬', title: 'Multi-Model Chats', desc: 'Switch between Ollama & Cloud models in the same conversation.' },
											{ icon: '📄', title: 'Document Recognition', desc: 'Attach text and code files (.txt, .md, .js, .py) for prompt analysis.' },
											{ icon: '🖼️', title: 'Image Support', desc: 'Attach up to 4 images per message for multimodal vision models.' },
											{ icon: '💻', title: 'Syntax Highlighting', desc: 'Tokenized code blocks with copy button and line counters.' },
											{ icon: '📥', title: 'Export Transcripts', desc: 'Export chats to Markdown (.md), Obsidian, JSON, or Plain Text.' },
											{ icon: '🔊', title: 'Speech Output', desc: 'Line-by-line audio synthesis using Kokoro TTS integration.' },
										].map((feat, i) => (
											<div key={i} className='flex items-start gap-3 p-3 rounded-xl bg-[#f9fafc] border border-[#e8ebf3]'>
												<span className='text-xl shrink-0'>{feat.icon}</span>
												<div>
													<div className='font-bold text-[#202022] text-xs'>{feat.title}</div>
													<div className='text-[#7a7d90] mt-0.5 text-[11px] leading-relaxed'>{feat.desc}</div>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						)}
					</div>
				</main>

				{/* 3. RIGHT SIDEBAR - HELP & TIPS */}
				<SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
			</div>

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
								<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>

						<div className='space-y-4'>
							<div className='p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3'>
								<div className='w-10 h-10 rounded-xl bg-[#eaecf9] text-[#7678ed] overflow-hidden flex items-center justify-center shrink-0'>
									{applyPersonaModalTemplate.picture ? (
										<img src={applyPersonaModalTemplate.picture} alt={applyPersonaModalTemplate.name} className='w-full h-full object-cover' />
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

			{/* Delete Persona Confirmation Modal */}
			{deletingPersonaTemplate && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none'>
					<div className='bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200'>
						<div className='flex items-center justify-between mb-2'>
							<h3 className='text-lg font-bold text-rose-400'>Delete Persona?</h3>
							<button
								onClick={() => setDeletingPersonaTemplate(null)}
								className='text-white/60 hover:text-white p-1 transition-colors cursor-pointer'
							>
								<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
									<line x1='18' y1='6' x2='6' y2='18' />
									<line x1='6' y1='6' x2='18' y2='18' />
								</svg>
							</button>
						</div>
						<p className='text-sm text-white/70 leading-relaxed mb-6'>
							Are you sure you want to delete persona template <strong className='text-white'>&ldquo;{deletingPersonaTemplate.name}&rdquo;</strong>? This action cannot be undone.
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
