'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore, ModelPreference } from '@/store/useAppStore';
import { getApiUrl } from '@/lib/api';
import { getCharacterName, formatAvatarPicture } from '@/lib/characterUtils';
import { TTS_VOICE_GROUPS } from '@/lib/voiceConstants';
import { SettingsSidebar, SettingsCategory } from '@/components/settings/SettingsSidebar';
import { SettingsHelpSidebar } from '@/components/settings/SettingsHelpSidebar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { TrashIcon, ChevronIcon } from '@/components/icons/Icons';

export interface LorebookTemplate {
	filename: string;
	name: string;
	keys: string[];
	content: string;
	error?: string;
}

export interface PersonaTemplate {
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
	generation_settings?: {
		temperature?: number;
		top_p?: number;
		top_k?: number;
		repeat_penalty?: number;
		presence_penalty?: number;
		frequency_penalty?: number;
	};
	character_book?: {
		name?: string;
		entries?: Array<{
			name?: string;
			keys?: string[] | string;
			content?: string;
			enabled?: boolean;
		}>;
	};
}

export default function EditModelPreferencePage() {
	const params = useParams();
	const router = useRouter();
	const rawModelId = typeof params?.model_id === 'string' ? params.model_id : '';
	const modelId = decodeURIComponent(rawModelId);

	const {
		setCurrentView,
		instances,
		fetchInstances,
		modelPreferences,
		fetchModelPreferences,
		setModelPreference: setStoreModelPreference,
		instanceModelsMap,
		fetchInstanceModels,
	} = useAppStore();

	const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('manage-model-preferences');
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isSaving, setIsSaving] = useState<boolean>(false);

	// External templates for copying
	const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplate[]>([]);
	const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplate[]>([]);

	// Form State
	const [modelFormName, setModelFormName] = useState<string>('');
	const [modelFormVoice, setModelFormVoice] = useState<string>('af_heart');
	const [modelFormPicture, setModelFormPicture] = useState<string>('');
	const [modelAvatarPreview, setModelAvatarPreview] = useState<string>('');
	const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
	const [modelFormNumCtx, setModelFormNumCtx] = useState<number>(8192);

	// Personality & Prompts
	const [modelFormDescription, setModelFormDescription] = useState<string>('');
	const [modelFormScenario, setModelFormScenario] = useState<string>('');
	const [modelFormSystemPrompt, setModelFormSystemPrompt] = useState<string>('');
	const [modelFormPostHistoryInstructions, setModelFormPostHistoryInstructions] = useState<string>('');

	// Greetings
	const [modelFormFirstMes, setModelFormFirstMes] = useState<string>('');
	const [modelFormAlternateGreetings, setModelFormAlternateGreetings] = useState<string[]>([]);

	// Generation Samplers
	const [modelFormTemperature, setModelFormTemperature] = useState<number>(0.7);
	const [modelFormTopP, setModelFormTopP] = useState<number>(0.9);
	const [modelFormTopK, setModelFormTopK] = useState<number>(40);
	const [modelFormRepeatPenalty, setModelFormRepeatPenalty] = useState<number>(1.1);
	const [modelFormPresencePenalty, setModelFormPresencePenalty] = useState<number>(0.0);
	const [modelFormFrequencyPenalty, setModelFormFrequencyPenalty] = useState<number>(0.0);

	// Embedded Lorebook
	const [modelFormLorebookEntries, setModelFormLorebookEntries] = useState<
		Array<{ name: string; keys: string; content: string; enabled: boolean }>
	>([]);

	// Resolve the hosting instance for this model
	const hostingInstance = useMemo(() => {
		for (const inst of instances) {
			const models = instanceModelsMap[inst.id] || [];
			if (models.some((m) => m.id === modelId || m.name === modelId)) {
				return inst.properties?.name || inst.type;
			}
		}
		for (const inst of instances) {
			if (modelId.startsWith(inst.id)) {
				return inst.properties?.name || inst.type;
			}
		}
		const lower = modelId.toLowerCase();
		if (lower.includes('gemini') || lower.includes('gemma')) return 'Google Gemini';
		if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3')) return 'OpenAI ChatGPT';
		return 'Ollama';
	}, [instances, instanceModelsMap, modelId]);

	// Fetch base data
	useEffect(() => {
		Promise.all([
			fetchInstances(),
			fetchModelPreferences(),
			fetch(`${getApiUrl()}/lorebook`)
				.then((res) => (res.ok ? res.json() : []))
				.then((data) => setLorebookTemplates(Array.isArray(data) ? data : []))
				.catch(() => {}),
			fetch(`${getApiUrl()}/personas`)
				.then((res) => (res.ok ? res.json() : []))
				.then((data) => setPersonaTemplates(Array.isArray(data) ? data : []))
				.catch(() => {}),
		]).finally(() => {
			setIsLoading(false);
		});
	}, [fetchInstances, fetchModelPreferences]);

	useEffect(() => {
		if (instances.length > 0) {
			for (const inst of instances) {
				fetchInstanceModels(inst.id).catch(() => {});
			}
		}
	}, [instances, fetchInstanceModels]);

	// Populate form when model preference or ID is ready
	const populateFormFromPreference = useCallback(
		(pref?: ModelPreference | null) => {
			if (!pref) {
				setModelFormName(modelId);
				setModelFormVoice('af_heart');
				setModelFormPicture('');
				setModelAvatarPreview('');
				setModelFormNumCtx(8192);
				setModelFormDescription('');
				setModelFormScenario('');
				setModelFormSystemPrompt('');
				setModelFormPostHistoryInstructions('');
				setModelFormFirstMes('');
				setModelFormAlternateGreetings([]);
				setModelFormTemperature(0.7);
				setModelFormTopP(0.9);
				setModelFormTopK(40);
				setModelFormRepeatPenalty(1.1);
				setModelFormPresencePenalty(0.0);
				setModelFormFrequencyPenalty(0.0);
				setModelFormLorebookEntries([]);
				return;
			}

			const char: any = pref.character || {};
			const charData: any = char.data || char || {};
			const genSettings = charData.generation_settings || {};

			setModelFormName(getCharacterName(char) || pref.name || modelId);
			setModelFormVoice(pref.voice || 'af_heart');
			const pic = pref.picture || charData.picture || '';
			setModelFormPicture(pic);
			setModelAvatarPreview(pic ? formatAvatarPicture(pic) || '' : '');
			setModelFormNumCtx(pref.num_ctx || charData.num_ctx || 8192);

			setModelFormDescription(charData.description || charData.personality || pref.description || '');
			setModelFormScenario(charData.scenario || '');
			setModelFormSystemPrompt(charData.system_prompt || '');
			setModelFormPostHistoryInstructions(charData.post_history_instructions || '');
			setModelFormFirstMes(charData.first_mes || charData.first_message || pref.first_message || '');

			const greetings = Array.isArray(charData.alternate_greetings)
				? charData.alternate_greetings
				: Array.isArray(pref.alternate_greetings)
					? pref.alternate_greetings
					: [];
			setModelFormAlternateGreetings(greetings);

			setModelFormTemperature(genSettings.temperature ?? 0.7);
			setModelFormTopP(genSettings.top_p ?? 0.9);
			setModelFormTopK(genSettings.top_k ?? 40);
			setModelFormRepeatPenalty(genSettings.repeat_penalty ?? 1.1);
			setModelFormPresencePenalty(genSettings.presence_penalty ?? 0.0);
			setModelFormFrequencyPenalty(genSettings.frequency_penalty ?? 0.0);

			const bookEntries = charData.character_book?.entries || charData.character_book || [];
			if (Array.isArray(bookEntries)) {
				setModelFormLorebookEntries(
					bookEntries.map((e: any) => ({
						name: e.name || e.comment || 'Entry',
						keys: Array.isArray(e.keys) ? e.keys.join(', ') : String(e.keys || ''),
						content: e.content || e.description || '',
						enabled: e.enabled !== false,
					})),
				);
			} else {
				setModelFormLorebookEntries([]);
			}
		},
		[modelId],
	);

	useEffect(() => {
		let isMounted = true;
		const loadPref = async () => {
			const existing = modelPreferences[modelId] || modelPreferences[modelId.toLowerCase()];
			if (existing) {
				if (isMounted) populateFormFromPreference(existing);
				return;
			}
			try {
				const res = await fetch(`${getApiUrl()}/model-preferences/${encodeURIComponent(modelId)}`);
				if (res.ok) {
					const data = await res.json();
					if (isMounted) {
						if (data && (data.character || data.picture || data.voice || data.num_ctx)) {
							populateFormFromPreference(data);
						} else {
							populateFormFromPreference(null);
						}
					}
				} else if (isMounted) {
					populateFormFromPreference(null);
				}
			} catch {
				if (isMounted) populateFormFromPreference(null);
			}
		};

		Promise.resolve().then(() => {
			if (isMounted) loadPref();
		});

		return () => {
			isMounted = false;
		};
	}, [modelId, modelPreferences, populateFormFromPreference]);

	// Avatar file change
	const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const localBlobUrl = URL.createObjectURL(file);
		setModelAvatarPreview(localBlobUrl);
		setIsUploadingAvatar(true);

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
					setModelFormPicture(data.picture);
					setModelAvatarPreview(data.picture);
				}
			} else {
				// Fallback to client-side FileReader
				const reader = new FileReader();
				reader.onload = (event) => {
					const dataUrl = event.target?.result as string;
					setModelFormPicture(dataUrl);
					setModelAvatarPreview(dataUrl);
				};
				reader.readAsDataURL(file);
			}
		} catch {
			// Fallback to client-side FileReader
			const reader = new FileReader();
			reader.onload = (event) => {
				const dataUrl = event.target?.result as string;
				setModelFormPicture(dataUrl);
				setModelAvatarPreview(dataUrl);
			};
			reader.readAsDataURL(file);
		} finally {
			setIsUploadingAvatar(false);
		}
	};

	// Greetings handlers
	const handleAddGreeting = () => {
		setModelFormAlternateGreetings((prev) => [...prev, '']);
	};

	const handleUpdateGreeting = (idx: number, val: string) => {
		setModelFormAlternateGreetings((prev) => {
			const next = [...prev];
			next[idx] = val;
			return next;
		});
	};

	const handleRemoveGreeting = (idx: number) => {
		setModelFormAlternateGreetings((prev) => prev.filter((_, i) => i !== idx));
	};

	// Lorebook handlers
	const handleAddLorebookEntry = () => {
		setModelFormLorebookEntries((prev) => [...prev, { name: 'New Entry', keys: 'name, keyword', content: '', enabled: true }]);
	};

	const handleCopyLorebookTemplate = (filename: string) => {
		if (!filename) return;
		const tmpl = lorebookTemplates.find((l) => l.filename === filename);
		if (!tmpl) return;

		setModelFormLorebookEntries((prev) => [
			...prev,
			{
				name: tmpl.name || tmpl.filename.replace('.json', ''),
				keys: Array.isArray(tmpl.keys) ? tmpl.keys.join(', ') : tmpl.keys || '',
				content: tmpl.content || '',
				enabled: true,
			},
		]);
	};

	const handleCopyFromPersonaTemplate = (filename: string) => {
		if (!filename) return;
		const tmpl = personaTemplates.find((p) => p.filename === filename);
		if (!tmpl) return;

		if (tmpl.name) setModelFormName(tmpl.name);
		if (tmpl.voice) setModelFormVoice(tmpl.voice);
		if (tmpl.picture) {
			setModelFormPicture(tmpl.picture);
			setModelAvatarPreview(formatAvatarPicture(tmpl.picture) || '');
		}
		if (tmpl.num_ctx) setModelFormNumCtx(tmpl.num_ctx);
		if (tmpl.description || tmpl.personality) setModelFormDescription(tmpl.description || tmpl.personality || '');
		if (tmpl.scenario) setModelFormScenario(tmpl.scenario);
		if (tmpl.system_prompt) setModelFormSystemPrompt(tmpl.system_prompt);
		if (tmpl.post_history_instructions) setModelFormPostHistoryInstructions(tmpl.post_history_instructions);
		if (tmpl.first_mes) setModelFormFirstMes(tmpl.first_mes);
		if (Array.isArray(tmpl.alternate_greetings)) setModelFormAlternateGreetings([...tmpl.alternate_greetings]);

		const gs = tmpl.generation_settings;
		if (gs) {
			if (typeof gs.temperature === 'number') setModelFormTemperature(gs.temperature);
			if (typeof gs.top_p === 'number') setModelFormTopP(gs.top_p);
			if (typeof gs.top_k === 'number') setModelFormTopK(gs.top_k);
			if (typeof gs.repeat_penalty === 'number') setModelFormRepeatPenalty(gs.repeat_penalty);
			if (typeof gs.presence_penalty === 'number') setModelFormPresencePenalty(gs.presence_penalty);
			if (typeof gs.frequency_penalty === 'number') setModelFormFrequencyPenalty(gs.frequency_penalty);
		}

		const entries = tmpl.character_book?.entries;
		if (Array.isArray(entries) && entries.length > 0) {
			setModelFormLorebookEntries(
				entries.map((e) => ({
					name: e.name || 'Entry',
					keys: Array.isArray(e.keys) ? e.keys.join(', ') : e.keys || '',
					content: e.content || '',
					enabled: e.enabled !== false,
				})),
			);
		}
	};

	const handleUpdateLorebookEntry = (idx: number, field: 'name' | 'keys' | 'content' | 'enabled', value: any) => {
		setModelFormLorebookEntries((prev) => {
			const next = [...prev];
			next[idx] = { ...next[idx], [field]: value };
			return next;
		});
	};

	const handleRemoveLorebookEntry = (idx: number) => {
		setModelFormLorebookEntries((prev) => prev.filter((_, i) => i !== idx));
	};

	// Save Model Preference
	const handleSaveModelPreference = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!modelId) return;

		setIsSaving(true);
		try {
			const characterPayload = {
				name: modelFormName.trim() || modelId,
				description: modelFormDescription.trim(),
				personality: modelFormDescription.trim(),
				scenario: modelFormScenario.trim(),
				system_prompt: modelFormSystemPrompt.trim(),
				post_history_instructions: modelFormPostHistoryInstructions.trim(),
				first_mes: modelFormFirstMes.trim(),
				alternate_greetings: modelFormAlternateGreetings.filter((g) => g.trim().length > 0),
				voice: modelFormVoice,
				picture: modelFormPicture || null,
				num_ctx: Number(modelFormNumCtx) || 8192,
				generation_settings: {
					temperature: Number(modelFormTemperature),
					top_p: Number(modelFormTopP),
					top_k: Number(modelFormTopK),
					repeat_penalty: Number(modelFormRepeatPenalty),
					presence_penalty: Number(modelFormPresencePenalty),
					frequency_penalty: Number(modelFormFrequencyPenalty),
				},
				character_book: {
					name: `${modelFormName.trim() || modelId} Lorebook`,
					entries: modelFormLorebookEntries.map((e) => ({
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

			const payload: ModelPreference = {
				id: modelId,
				name: modelFormName.trim() || modelId,
				description: modelFormDescription.trim(),
				first_message: modelFormFirstMes.trim(),
				alternate_greetings: modelFormAlternateGreetings.filter((g) => g.trim().length > 0),
				picture: modelFormPicture || null,
				voice: modelFormVoice,
				num_ctx: Number(modelFormNumCtx) || 8192,
				character: characterPayload,
			};

			const res = await fetch(`${getApiUrl()}/model-preferences`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: modelId,
					picture: modelFormPicture || null,
					voice: modelFormVoice,
					num_ctx: Number(modelFormNumCtx) || 8192,
					character: characterPayload,
				}),
			});

			if (res.ok) {
				setStoreModelPreference(modelId, payload);
				router.push('/settings/model-preferences');
			} else {
				const err = await res.json();
				alert(err.error || 'Failed saving model preference');
			}
		} catch (err: any) {
			console.error('Error saving model preference:', err);
			alert(err.message || 'Error saving model preference');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className='flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text'>
			{/* 1. SETTINGS CATEGORIES SIDEBAR */}
			<SettingsSidebar
				activeSettingsCategory={activeSettingsCategory}
				setActiveSettingsCategory={setActiveSettingsCategory}
				setCurrentView={setCurrentView}
			/>

			{/* 2. MIDDLE SETTINGS CONTENT AREA */}
			<main className='flex-1 p-8 overflow-y-auto'>
				<div className='max-w-3xl mx-auto space-y-6'>
					{isLoading ? (
						<div className='p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]'>
							Loading model preference...
						</div>
					) : (
						<form onSubmit={handleSaveModelPreference} className='space-y-6'>
							{/* Header Bar */}
							<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
								<div className='flex items-center gap-3'>
									<button
										type='button'
										onClick={() => router.push('/settings/model-preferences')}
										className='p-2 rounded-xl bg-[#f0f2fb] hover:bg-[#eaecf9] text-[#7678ed] transition-all cursor-pointer'
										title='Back to Model Preferences List'
									>
										<ChevronIcon direction='left' className='w-5 h-5' />
									</button>
									<div>
										<div className='flex items-center gap-2 flex-wrap'>
											<h3 className='text-xl font-bold text-[#202022] tracking-tight'>Edit Model Preference</h3>
											<Badge variant='primary'>@{hostingInstance}</Badge>
											<Badge variant='secondary' className='font-mono' title={modelId}>
												{modelId}
											</Badge>
										</div>
										<p className='text-xs text-[#7a7d90] mt-1 font-medium'>
											Configure identity, audio, context size, system prompts, greetings, sampler settings, and lorebook characters for this model.
										</p>
									</div>
								</div>

								<div className='flex items-center gap-3 shrink-0'>
									<Button type='button' variant='outline' onClick={() => router.push('/settings/model-preferences')}>
										Cancel
									</Button>
									<Button type='submit' variant='primary' isLoading={isSaving}>
										Save Preference
									</Button>
								</div>
							</div>

							{/* Template Import Bar */}
							{(personaTemplates.length > 0 || lorebookTemplates.length > 0) && (
								<div className='p-4 rounded-2xl bg-[#f9fafc] border border-[#e8ebf3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs'>
									<span className='font-bold text-[#5d6075]'>Quick Fill from Saved Templates:</span>
									<div className='flex items-center gap-2 flex-wrap'>
										{personaTemplates.length > 0 && (
											<select
												onChange={(e) => {
													if (e.target.value) {
														handleCopyFromPersonaTemplate(e.target.value);
														e.target.value = '';
													}
												}}
												className='bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/20 rounded-xl px-3 py-1.5 font-bold outline-none cursor-pointer'
											>
												<option value=''>Load Persona Template...</option>
												{personaTemplates.map((p) => (
													<option key={p.filename} value={p.filename}>
														🎭 {p.name}
													</option>
												))}
											</select>
										)}
									</div>
								</div>
							)}

							{/* 1. Identity & Audio Card */}
							<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4'>
								<h4 className='text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2'>
									1. Identity & Audio Settings
								</h4>

								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<Input
										label='Model Display / Character Name *'
										value={modelFormName}
										onChange={(e) => setModelFormName(e.target.value)}
										placeholder='e.g. Sora Assistant'
										required
									/>
									<div className='space-y-1.5'>
										<label className='block text-xs font-bold text-[#5d6075]'>Kokoro TTS Voice</label>
										<div className='relative'>
											<select
												value={modelFormVoice}
												onChange={(e) => setModelFormVoice(e.target.value)}
												className='w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-[#7678ed] transition-all cursor-pointer appearance-none pr-10'
											>
												{TTS_VOICE_GROUPS.map((group) => (
													<optgroup key={group.gender} label={`${group.gender} Voices`}>
														{group.voices.map((v) => (
															<option key={v.id} value={v.id}>
																{v.label}
															</option>
														))}
													</optgroup>
												))}
											</select>
											<ChevronIcon className='absolute right-3.5 top-3.5 text-[#8e90a6] w-4 h-4 pointer-events-none' />
										</div>
									</div>
								</div>

								<div className='space-y-4'>
									<label className='block text-xs font-bold text-[#5d6075] mb-1'>Model Avatar Image</label>
									<div className='flex items-center gap-4 bg-[#f9fafc] p-4 rounded-xl border border-[#e8ebf3]'>
										<div className='w-16 h-16 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/30 overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative group'>
											{modelAvatarPreview ? (
												<img src={modelAvatarPreview} alt='Avatar Preview' className='w-full h-full object-cover' />
											) : (
												<span className='text-2xl'>🎭</span>
											)}
											{isUploadingAvatar && (
												<div className='absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold'>
													Uploading...
												</div>
											)}
										</div>

										<div className='flex-1 space-y-1.5'>
											<div className='flex items-center gap-2'>
												<label className='inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold cursor-pointer transition-all shadow-xs'>
													<span>{isUploadingAvatar ? 'Uploading & Converting...' : 'Choose Image File...'}</span>
													<input type='file' accept='image/*' onChange={handleAvatarFileChange} className='hidden' />
												</label>
												{modelAvatarPreview && (
													<button
														type='button'
														onClick={() => {
															setModelFormPicture('');
															setModelAvatarPreview('');
														}}
														className='px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 transition-all'
													>
														Remove
													</button>
												)}
											</div>
											<p className='text-[11px] text-[#7a7d90]'>
												Select an image file (.png, .jpg, .webp). Converted automatically to base64 for portability.
											</p>
										</div>
									</div>
								</div>

								<div>
									<Input
										label='Context Window Size (tokens)'
										type='number'
										value={modelFormNumCtx}
										onChange={(e) => setModelFormNumCtx(Number(e.target.value) || 8192)}
										placeholder='8192'
									/>
								</div>
							</div>

							{/* 2. Prompts & Personality Card */}
							<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4'>
								<h4 className='text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2'>
									2. Personality & System Prompts
								</h4>
								<Textarea
									label='Description / Personality Bio'
									rows={3}
									value={modelFormDescription}
									onChange={(e) => setModelFormDescription(e.target.value)}
									placeholder='Brief backstory, role, personality traits, and overall character tone...'
								/>
								<Textarea
									label='Scenario / Context'
									rows={2}
									value={modelFormScenario}
									onChange={(e) => setModelFormScenario(e.target.value)}
									placeholder='Current setting or environment (e.g. Modern office, futuristic space station...)'
								/>
								<Textarea
									label='System Instructions / Main System Prompt'
									rows={4}
									value={modelFormSystemPrompt}
									onChange={(e) => setModelFormSystemPrompt(e.target.value)}
									placeholder='Core system prompt directing AI behavior, output constraints, formatting, etc.'
									className='font-mono'
								/>
								<Textarea
									label='Post-History Instructions (Suffix)'
									rows={2}
									value={modelFormPostHistoryInstructions}
									onChange={(e) => setModelFormPostHistoryInstructions(e.target.value)}
									placeholder='Instructions injected at the very end of chat history...'
								/>
							</div>

							{/* 3. Greetings Card */}
							<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4'>
								<div className='flex items-center justify-between border-b border-[#e8ebf3] pb-2'>
									<h4 className='text-sm font-bold text-[#7678ed] uppercase tracking-wider'>3. Greetings & Opening Messages</h4>
									<Button type='button' variant='secondary' size='sm' onClick={handleAddGreeting}>
										+ Add Alt Greeting
									</Button>
								</div>

								<Textarea
									label='First Message (Primary Greeting)'
									rows={2}
									value={modelFormFirstMes}
									onChange={(e) => setModelFormFirstMes(e.target.value)}
									placeholder='First message spoken by model when starting a fresh chat session...'
								/>

								{modelFormAlternateGreetings.length > 0 && (
									<div className='space-y-2.5 pt-2'>
										<label className='block text-xs font-bold text-[#5d6075]'>Alternative Greetings</label>
										{modelFormAlternateGreetings.map((greeting, idx) => (
											<div key={idx} className='flex items-center gap-2'>
												<input
													type='text'
													value={greeting}
													onChange={(e) => handleUpdateGreeting(idx, e.target.value)}
													placeholder={`Alt Greeting #${idx + 1}...`}
													className='flex-1 bg-white border border-[#e8ebf3] text-[#202022] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#7678ed]'
												/>
												<button
													type='button'
													onClick={() => handleRemoveGreeting(idx)}
													className='p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer'
													title='Remove'
												>
													<TrashIcon className='w-4 h-4' />
												</button>
											</div>
										))}
									</div>
								)}
							</div>

							{/* 4. Generation Settings & Samplers */}
							<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4'>
								<h4 className='text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2'>
									4. Generation Settings & Samplers
								</h4>
								<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3'>
									<div>
										<label className='block text-[11px] font-bold text-[#5d6075] mb-1'>Temperature</label>
										<input
											type='number'
											step='0.05'
											value={modelFormTemperature}
											onChange={(e) => setModelFormTemperature(parseFloat(e.target.value) || 0.7)}
											className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]'
										/>
									</div>
									<div>
										<label className='block text-[11px] font-bold text-[#5d6075] mb-1'>Top P</label>
										<input
											type='number'
											step='0.05'
											value={modelFormTopP}
											onChange={(e) => setModelFormTopP(parseFloat(e.target.value) || 0.9)}
											className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]'
										/>
									</div>
									<div>
										<label className='block text-[11px] font-bold text-[#5d6075] mb-1'>Top K</label>
										<input
											type='number'
											value={modelFormTopK}
											onChange={(e) => setModelFormTopK(parseInt(e.target.value, 10) || 40)}
											className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]'
										/>
									</div>
									<div>
										<label className='block text-[11px] font-bold text-[#5d6075] mb-1'>Rep. Penalty</label>
										<input
											type='number'
											step='0.05'
											value={modelFormRepeatPenalty}
											onChange={(e) => setModelFormRepeatPenalty(parseFloat(e.target.value) || 1.1)}
											className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]'
										/>
									</div>
									<div>
										<label className='block text-[11px] font-bold text-[#5d6075] mb-1'>Pres. Penalty</label>
										<input
											type='number'
											step='0.1'
											value={modelFormPresencePenalty}
											onChange={(e) => setModelFormPresencePenalty(parseFloat(e.target.value) || 0.0)}
											className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]'
										/>
									</div>
									<div>
										<label className='block text-[11px] font-bold text-[#5d6075] mb-1'>Freq. Penalty</label>
										<input
											type='number'
											step='0.1'
											value={modelFormFrequencyPenalty}
											onChange={(e) => setModelFormFrequencyPenalty(parseFloat(e.target.value) || 0.0)}
											className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-2 text-xs font-semibold text-[#202022] outline-none focus:bg-white focus:border-[#7678ed]'
										/>
									</div>
								</div>
							</div>

							{/* 5. Embedded Character Lorebook */}
							<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4'>
								<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e8ebf3] pb-3'>
									<div>
										<h4 className='text-sm font-bold text-[#7678ed] uppercase tracking-wider'>
											5. Embedded Character Lorebook & World Info
										</h4>
										<p className='text-xs text-[#7a7d90] mt-0.5'>
											Manage lorebook entries for this model or copy entries from your saved Lorebook templates.
										</p>
									</div>
									<div className='flex items-center gap-2 shrink-0'>
										{lorebookTemplates.length > 0 && (
											<select
												onChange={(e) => {
													if (e.target.value) {
														handleCopyLorebookTemplate(e.target.value);
														e.target.value = '';
													}
												}}
												className='bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/20 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer'
											>
												<option value=''>+ Copy from Lorebook...</option>
												{lorebookTemplates.map((l) => (
													<option key={l.filename} value={l.filename}>
														📖 {l.name}
													</option>
												))}
											</select>
										)}
										<Button type='button' variant='secondary' size='sm' onClick={handleAddLorebookEntry}>
											+ Add Entry
										</Button>
									</div>
								</div>

								{modelFormLorebookEntries.length === 0 ? (
									<div className='text-center py-6 text-xs text-[#7a7d90] bg-[#f9fafc] rounded-xl border border-dashed border-[#e8ebf3]'>
										No character lorebook entries configured for this model. Click &ldquo;+ Add Entry&rdquo; or copy from a template above.
									</div>
								) : (
									<div className='space-y-4'>
										{modelFormLorebookEntries.map((entry, idx) => (
											<div key={idx} className='p-4 rounded-xl bg-[#f9fafc] border border-[#e8ebf3] space-y-3 relative group'>
												<div className='flex items-center justify-between gap-2'>
													<input
														type='text'
														value={entry.name}
														onChange={(e) => handleUpdateLorebookEntry(idx, 'name', e.target.value)}
														placeholder='Entry Name / Title'
														className='font-bold text-xs text-[#202022] bg-white border border-[#e8ebf3] px-2.5 py-1.5 rounded-lg outline-none focus:border-[#7678ed] w-full sm:w-1/3'
													/>
													<div className='flex items-center gap-3'>
														<label className='flex items-center gap-1.5 text-xs text-[#5d6075] cursor-pointer'>
															<input
																type='checkbox'
																checked={entry.enabled}
																onChange={(e) => handleUpdateLorebookEntry(idx, 'enabled', e.target.checked)}
																className='rounded text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed]'
															/>
															<span>Enabled</span>
														</label>
														<button
															type='button'
															onClick={() => handleRemoveLorebookEntry(idx)}
															className='p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all'
															title='Remove Entry'
														>
															<TrashIcon className='w-4 h-4' />
														</button>
													</div>
												</div>

												<div>
													<label className='block text-[11px] font-bold text-[#5d6075] mb-1'>Trigger Keywords (comma separated)</label>
													<input
														type='text'
														value={entry.keys}
														onChange={(e) => handleUpdateLorebookEntry(idx, 'keys', e.target.value)}
														placeholder='e.g. sora, sword, academy, magic'
														className='w-full bg-white border border-[#e8ebf3] text-[#202022] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#7678ed]'
													/>
												</div>

												<div>
													<label className='block text-[11px] font-bold text-[#5d6075] mb-1'>Injected Content / World Lore</label>
													<textarea
														rows={2}
														value={entry.content}
														onChange={(e) => handleUpdateLorebookEntry(idx, 'content', e.target.value)}
														placeholder='Lore injected into context when keywords match...'
														className='w-full bg-white border border-[#e8ebf3] text-[#202022] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#7678ed]'
													/>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Bottom Action Footer */}
							<div className='flex items-center justify-end gap-3 pt-2'>
								<Button type='button' variant='outline' onClick={() => router.push('/settings/model-preferences')}>
									Cancel
								</Button>
								<Button type='submit' variant='primary' isLoading={isSaving}>
									Save Preference
								</Button>
							</div>
						</form>
					)}
				</div>
			</main>

			{/* 3. RIGHT SIDEBAR - HELP & TIPS */}
			<SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
		</div>
	);
}
