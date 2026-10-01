'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore, ModelPreference } from '@/store/useAppStore';
import { getApiUrl } from '@/lib/api';
import { getCharacterName, formatAvatarPicture } from '@/lib/characterUtils';
import { TTS_VOICE_GROUPS, getVoiceDisplayName } from '@/lib/voiceConstants';
import { EditIcon, TrashIcon, SearchIcon, ChevronIcon } from '@/components/icons/Icons';
import { Badge } from '../ui/Badge';

export const ManageModelPreferencesPanel: React.FC = () => {
	const {
		instances,
		fetchInstances,
		modelPreferences,
		fetchModelPreferences,
		setModelPreference: setStoreModelPreference,
		removeModelPreference: removeStoreModelPreference,
		instanceModelsMap,
		fetchInstanceModels,
	} = useAppStore();

	const [searchQuery, setSearchQuery] = useState('');
	const [isLoading, setIsLoading] = useState(true);

	// Edit Modal State
	const [editingPref, setEditingPref] = useState<ModelPreference | null>(null);
	const [editName, setEditName] = useState('');
	const [editVoice, setEditVoice] = useState('af_heart');
	const [editNumCtx, setEditNumCtx] = useState(8192);
	const [editDescription, setEditDescription] = useState('');
	const [editFirstMessage, setEditFirstMessage] = useState('');
	const [editPicture, setEditPicture] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	// Delete Modal State
	const [deletingPref, setDeletingPref] = useState<ModelPreference | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Fetch instances and model preferences on mount
	useEffect(() => {
		Promise.all([fetchInstances(), fetchModelPreferences()]).finally(() => {
			setIsLoading(false);
		});
	}, [fetchInstances, fetchModelPreferences]);

	// Fetch models for each instance to correlate models with their hosting instance
	useEffect(() => {
		if (instances.length > 0) {
			for (const inst of instances) {
				fetchInstanceModels(inst.id).catch(() => {});
			}
		}
	}, [instances, fetchInstanceModels]);

	// Convert modelPreferences map to array
	const preferencesList: ModelPreference[] = useMemo(() => {
		const values = Object.values(modelPreferences);
		// Deduplicate in case case-insensitive duplicates exist in store dictionary
		const seen = new Set<string>();
		const unique: ModelPreference[] = [];
		for (const p of values) {
			const idKey = p.id.toLowerCase();
			if (!seen.has(idKey)) {
				seen.add(idKey);
				unique.push(p);
			}
		}
		return unique;
	}, [modelPreferences]);

	const getInstanceColor = (type: string): string => {
		const t = (type || '').toLowerCase();
		if (t === 'gemini') return 'bg-amber-50 text-amber-700 border-amber-200';
		if (t === 'openai') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (t === 'openrouter') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
		if (t === 'anthropic') return 'bg-orange-50 text-orange-700 border-orange-200';
		if (t === 'deepseek') return 'bg-blue-50 text-blue-700 border-blue-200';
		return 'bg-purple-50 text-purple-700 border-purple-200';
	};

	// Resolve the hosting instance for a given model ID
	const getInstanceForModel = useCallback(
		(modelId: string): { name: string; type: string; color: string } => {
			// 1. Direct match in fetched instance models
			for (const inst of instances) {
				const models = instanceModelsMap[inst.id] || [];
				if (models.some((m) => m.id === modelId || m.name === modelId)) {
					return {
						name: inst.properties?.name || inst.type,
						type: inst.type,
						color: getInstanceColor(inst.type),
					};
				}
			}

			// 2. ID prefix match (e.g. dummy model IDs like <instance_id>-m1)
			for (const inst of instances) {
				if (modelId.startsWith(inst.id)) {
					return {
						name: inst.properties?.name || inst.type,
						type: inst.type,
						color: getInstanceColor(inst.type),
					};
				}
			}

			// 3. Provider heuristics based on model naming patterns
			const lowerId = modelId.toLowerCase();
			if (lowerId.includes('gemini') || lowerId.includes('gemma')) {
				const geminiInst = instances.find((i) => i.type === 'gemini' || i.properties?.url?.includes('generativelanguage'));
				if (geminiInst) {
					return {
						name: geminiInst.properties?.name || 'Google Gemini',
						type: 'gemini',
						color: getInstanceColor('gemini'),
					};
				}
				return { name: 'Google Gemini', type: 'gemini', color: getInstanceColor('gemini') };
			}

			if (lowerId.includes('gpt') || lowerId.includes('o1') || lowerId.includes('o3')) {
				const openaiInst = instances.find((i) => i.type === 'openai');
				if (openaiInst) {
					return {
						name: openaiInst.properties?.name || 'OpenAI ChatGPT',
						type: 'openai',
						color: getInstanceColor('openai'),
					};
				}
				return { name: 'OpenAI ChatGPT', type: 'openai', color: getInstanceColor('openai') };
			}

			// 4. Default to first Ollama instance or fallback
			const ollamaInst = instances.find((i) => i.type === 'ollama');
			if (ollamaInst) {
				return {
					name: ollamaInst.properties?.name || 'Ollama',
					type: 'ollama',
					color: getInstanceColor('ollama'),
				};
			}

			return { name: 'Ollama Instance', type: 'ollama', color: getInstanceColor('ollama') };
		},
		[instances, instanceModelsMap],
	);

	const getAvatarBg = (name: string): string => {
		if (!name) return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		const gradients = [
			'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
			'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
			'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
			'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
			'linear-gradient(135deg, #10b981 0%, #059669 100%)',
			'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
		];
		return gradients[Math.abs(hash) % gradients.length];
	};

	// Filtered list based on search
	const filteredPreferences = useMemo(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return preferencesList;

		return preferencesList.filter((pref) => {
			const charName = (getCharacterName(pref.character) || pref.name || '').toLowerCase();
			const modelId = pref.id.toLowerCase();
			const instInfo = getInstanceForModel(pref.id);
			const instName = instInfo.name.toLowerCase();
			const instType = instInfo.type.toLowerCase();
			const voice = (pref.voice || '').toLowerCase();

			return charName.includes(q) || modelId.includes(q) || instName.includes(q) || instType.includes(q) || voice.includes(q);
		});
	}, [preferencesList, searchQuery, getInstanceForModel]);

	// Open Edit Modal
	const handleOpenEdit = (pref: ModelPreference) => {
		setEditingPref(pref);
		const char = pref.character || {};
		const charData = (char as any).data || char || {};
		setEditName(getCharacterName(char) || pref.name || pref.id);
		setEditVoice(pref.voice || 'af_heart');
		setEditNumCtx(pref.num_ctx || 8192);
		setEditDescription(charData.description || pref.description || '');
		setEditFirstMessage(charData.first_mes || charData.first_message || pref.first_message || '');
		setEditPicture(pref.picture || null);
	};

	// Save Edit
	const handleSaveEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingPref) return;

		setIsSaving(true);
		try {
			const existingChar = editingPref.character || {};
			const existingCharData = (existingChar as any).data || existingChar || {};

			const updatedCharacter = {
				...existingCharData,
				name: editName.trim(),
				description: editDescription.trim(),
				first_mes: editFirstMessage.trim(),
			};

			const payload = {
				id: editingPref.id,
				name: editName.trim(),
				picture: editPicture,
				voice: editVoice,
				num_ctx: Number(editNumCtx) || 8192,
				character: updatedCharacter,
			};

			const res = await fetch(`${getApiUrl()}/model-preferences`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				const saved = await res.json();
				setStoreModelPreference(editingPref.id, saved);
				setEditingPref(null);
			}
		} catch (err) {
			console.error('Failed to save model preference:', err);
		} finally {
			setIsSaving(false);
		}
	};

	// Open Delete Modal
	const handleOpenDelete = (pref: ModelPreference) => {
		setDeletingPref(pref);
	};

	// Confirm Delete
	const handleConfirmDelete = async () => {
		if (!deletingPref) return;
		setIsDeleting(true);
		try {
			const encodedId = encodeURIComponent(deletingPref.id);
			const res = await fetch(`${getApiUrl()}/model-preferences/${encodedId}`, {
				method: 'DELETE',
			});
			if (res.ok) {
				removeStoreModelPreference(deletingPref.id);
				setDeletingPref(null);
			}
		} catch (err) {
			console.error('Failed to delete model preference:', err);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className='p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200'>
			{/* Header */}
			<div className='flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs'>
				<div>
					<h3 className='text-xl font-bold text-[#202022] tracking-tight'>Manage Model Preferences</h3>
					<p className='text-sm text-[#7a7d90] mt-1 font-medium'>
						Configure character persona, profile avatar, Kokoro TTS voice, and context window limits for each AI model.
					</p>
				</div>
				<div className='flex items-center gap-3'>
					<span className='px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/20'>
						{preferencesList.length} {preferencesList.length === 1 ? 'Model Preference' : 'Model Preferences'}
					</span>
				</div>
			</div>

			{/* Search Bar */}
			<div className='relative'>
				<input
					type='text'
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder='Search model preferences by character name, model ID, instance, or voice...'
					className='w-full bg-white border border-[#e8ebf3] rounded-2xl pl-11 pr-4 py-3 text-sm text-[#202022] placeholder-[#a0a3b5] outline-none focus:border-[#7678ed] transition-all shadow-xs'
				/>
				<SearchIcon className='absolute left-4 top-3.5 text-[#a0a3b5] w-4 h-4' />
			</div>

			{/* Cards Grid */}
			{isLoading ? (
				<div className='p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]'>
					Loading model preferences...
				</div>
			) : filteredPreferences.length === 0 ? (
				<div className='p-12 text-center bg-white rounded-2xl border border-[#e8ebf3] space-y-3'>
					<div className='w-12 h-12 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-xl mx-auto'>🎭</div>
					<h4 className='font-bold text-[#202022] text-base'>
						{searchQuery ? 'No model preferences match your search' : 'No Model Preferences Configured'}
					</h4>
					<p className='text-xs text-[#7a7d90] max-w-sm mx-auto'>
						{searchQuery
							? 'Try adjusting your search query to find models by name, ID, or instance.'
							: 'Model preferences customize AI personality, avatar, and voice. They are created when assigning personas or editing model settings.'}
					</p>
				</div>
			) : (
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5'>
					{filteredPreferences.map((pref) => {
						const charName = getCharacterName(pref.character) || pref.name || pref.id;
						const avatarSrc = formatAvatarPicture(pref.picture);
						const instInfo = getInstanceForModel(pref.id);
						const voiceLabel = getVoiceDisplayName(pref.voice);

						return (
							// <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
							<div
								key={pref.id}
								className='p-5 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#7678ed]/40 transition-all'
							>
								<div className='space-y-3 flex'>
									{/* Avatar */}
									<div
										style={!avatarSrc ? { background: getAvatarBg(charName) } : undefined}
										className='w-30 h-30 mr-4 rounded-2xl border border-[#e8ebf3] overflow-hidden flex items-center justify-center shrink-0 shadow-xs relative bg-[#eaecf9]'
									>
										{avatarSrc ? (
											<img
												src={avatarSrc}
												alt={charName}
												className='w-full h-full object-cover'
												onError={(e) => {
													// Fallback on image broken
													(e.target as HTMLElement).style.display = 'none';
												}}
											/>
										) : (
											<span className='text-white font-bold text-xl uppercase'>{charName.slice(0, 2)}</span>
										)}
									</div>
									<div>
										<h4 className='font-bold text-[#202022] text-base leading-snug'>{charName}</h4>
										<span className='text-[11px] font-mono text-[#a0a3b5] block mt-0.5 mb-2'>{voiceLabel}</span>
										<div className='flex items-center gap-1.5 flex-wrap'>
											<Badge key={instInfo.name} variant='primary'>
												@{instInfo.name}
											</Badge>
											<Badge variant='secondary' className='font-mono' title={pref.id}>
												{pref.id}
											</Badge>
										</div>
									</div>
								</div>

								<div className={'flex items-center justify-between pt-3 border-t border-[#e8ebf3] gap-2 justify-end'}>
									<div className='flex items-center gap-1'>
										<button
											onClick={() => handleOpenEdit(pref)}
											className='p-1.5 text-[#7a7d90] hover:text-[#7678ed] transition-colors rounded-lg hover:bg-[#eaecf9]'
											title='Edit'
										>
											<EditIcon className='w-4 h-4' />
										</button>
										<button
											onClick={() => handleOpenDelete(pref)}
											className='p-1.5 text-[#7a7d90] hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50'
											title='Delete'
										>
											<TrashIcon className='w-4 h-4' />
										</button>
									</div>
								</div>
							</div>
							// </div>
						);
					})}
				</div>
			)}

			{/* Edit Model Preference Modal */}
			{editingPref && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150'>
					<div className='bg-white rounded-3xl border border-[#e8ebf3] shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar'>
						<div className='flex items-center justify-between pb-3 border-b border-[#e8ebf3]'>
							<div>
								<h3 className='text-lg font-bold text-[#202022]'>Edit Model Preference</h3>
								<code className='text-xs text-[#7678ed] font-mono'>{editingPref.id}</code>
							</div>
							<button onClick={() => setEditingPref(null)} className='text-[#8e90a6] hover:text-[#202022] text-sm font-semibold p-1'>
								✕
							</button>
						</div>

						<form onSubmit={handleSaveEdit} className='space-y-4'>
							{/* Character / Display Name */}
							<div className='space-y-1.5'>
								<label className='text-xs font-semibold text-[#4b4e6d]'>Character / Display Name</label>
								<input
									type='text'
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									placeholder='Assistant, Sydney, Kuro...'
									className='w-full px-3.5 py-2.5 rounded-xl border border-[#e8ebf3] text-sm text-[#202022] focus:border-[#7678ed] outline-none transition-all'
									required
								/>
							</div>

							{/* Voice Selection */}
							<div className='space-y-1.5'>
								<label className='text-xs font-semibold text-[#4b4e6d]'>Kokoro TTS Voice</label>
								<div className='relative'>
									<select
										value={editVoice}
										onChange={(e) => setEditVoice(e.target.value)}
										className='w-full px-3.5 py-2.5 rounded-xl border border-[#e8ebf3] text-sm text-[#202022] focus:border-[#7678ed] outline-none appearance-none bg-white transition-all pr-10'
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

							{/* Context Window */}
							<div className='space-y-1.5'>
								<label className='text-xs font-semibold text-[#4b4e6d]'>Context Window (Tokens)</label>
								<input
									type='number'
									value={editNumCtx}
									onChange={(e) => setEditNumCtx(Number(e.target.value) || 8192)}
									className='w-full px-3.5 py-2.5 rounded-xl border border-[#e8ebf3] text-sm text-[#202022] focus:border-[#7678ed] outline-none transition-all font-mono'
									min={1024}
									step={1024}
								/>
							</div>

							{/* Avatar Picture (Data URI or URL) */}
							<div className='space-y-1.5'>
								<label className='text-xs font-semibold text-[#4b4e6d]'>Avatar Image Data URI or URL</label>
								<div className='flex items-center gap-3'>
									{editPicture ? (
										<img
											src={formatAvatarPicture(editPicture)}
											alt='Preview'
											className='w-12 h-12 rounded-xl object-cover border border-[#e8ebf3]'
										/>
									) : (
										<div className='w-12 h-12 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-sm'>
											No Pic
										</div>
									)}
									<input
										type='text'
										value={editPicture || ''}
										onChange={(e) => setEditPicture(e.target.value || null)}
										placeholder='data:image/png;base64,... or https://...'
										className='flex-1 px-3.5 py-2.5 rounded-xl border border-[#e8ebf3] text-xs text-[#202022] focus:border-[#7678ed] outline-none font-mono transition-all'
									/>
									{editPicture && (
										<button
											type='button'
											onClick={() => setEditPicture(null)}
											className='text-xs text-red-500 font-semibold hover:underline'
										>
											Clear
										</button>
									)}
								</div>
							</div>

							{/* Description */}
							<div className='space-y-1.5'>
								<label className='text-xs font-semibold text-[#4b4e6d]'>Description / Personality</label>
								<textarea
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
									placeholder='Character personality and behavioral notes...'
									rows={3}
									className='w-full px-3.5 py-2.5 rounded-xl border border-[#e8ebf3] text-sm text-[#202022] focus:border-[#7678ed] outline-none transition-all'
								/>
							</div>

							{/* First Message Greeting */}
							<div className='space-y-1.5'>
								<label className='text-xs font-semibold text-[#4b4e6d]'>First Message Greeting</label>
								<textarea
									value={editFirstMessage}
									onChange={(e) => setEditFirstMessage(e.target.value)}
									placeholder='Default opening greeting for new chats...'
									rows={2}
									className='w-full px-3.5 py-2.5 rounded-xl border border-[#e8ebf3] text-sm text-[#202022] focus:border-[#7678ed] outline-none transition-all'
								/>
							</div>

							{/* Form Actions */}
							<div className='flex items-center justify-end gap-3 pt-3 border-t border-[#e8ebf3]'>
								<button
									type='button'
									onClick={() => setEditingPref(null)}
									className='px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#4b4e6d] text-xs font-semibold transition-all'
								>
									Cancel
								</button>
								<button
									type='submit'
									disabled={isSaving}
									className='px-5 py-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50'
								>
									{isSaving ? 'Saving...' : 'Save Changes'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{deletingPref && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150'>
					<div className='bg-white rounded-3xl border border-[#e8ebf3] shadow-2xl max-w-md w-full p-6 space-y-4'>
						<h3 className='text-lg font-bold text-[#202022]'>Delete Model Preference</h3>
						<p className='text-xs text-[#7a7d90] leading-relaxed'>
							Are you sure you want to remove the model preference for{' '}
							<span className='font-bold text-[#202022]'>{getCharacterName(deletingPref.character) || deletingPref.name || deletingPref.id}</span>{' '}
							(<code className='font-mono text-[#7678ed]'>{deletingPref.id}</code>)? This will revert the model to default settings.
						</p>

						<div className='flex items-center justify-end gap-3 pt-3 border-t border-[#e8ebf3]'>
							<button
								onClick={() => setDeletingPref(null)}
								disabled={isDeleting}
								className='px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#4b4e6d] text-xs font-semibold transition-all'
							>
								Cancel
							</button>
							<button
								onClick={handleConfirmDelete}
								disabled={isDeleting}
								className='px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50'
							>
								{isDeleting ? 'Deleting...' : 'Delete Preference'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
