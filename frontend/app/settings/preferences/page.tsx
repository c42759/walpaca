'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getApiUrl } from '@/lib/api';
import { SettingsSidebar, SettingsCategory } from '@/components/settings/SettingsSidebar';
import { SettingsHelpSidebar } from '@/components/settings/SettingsHelpSidebar';

interface PreferencesData {
	auto_play_voice: boolean;
	desktop_notifications: boolean;
	auto_scroll: boolean;
	default_audio_output: string;
}

export default function PreferencesSettingsPage() {
	const { setCurrentView } = useAppStore();
	const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('preferences');

	const [preferences, setPreferences] = useState<PreferencesData>({
		auto_play_voice: false,
		desktop_notifications: true,
		auto_scroll: true,
		default_audio_output: 'default',
	});

	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [saveStatus, setSaveStatus] = useState<string>('');

	// Load preferences from API
	useEffect(() => {
		let isMounted = true;
		(async () => {
			try {
				const res = await fetch(`${getApiUrl()}/preferences`);
				if (res.ok) {
					const data = await res.json();
					if (isMounted) {
						setPreferences((prev) => ({ ...prev, ...data }));
					}
				}
			} catch (err) {
				console.warn('Could not load preferences:', err);
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			isMounted = false;
		};
	}, []);

	const handleUpdatePreference = async (key: keyof PreferencesData, value: boolean | string) => {
		const updated = { ...preferences, [key]: value };
		setPreferences(updated);
		setSaveStatus('Saving...');

		try {
			const res = await fetch(`${getApiUrl()}/preferences`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [key]: value }),
			});
			if (res.ok) {
				setSaveStatus('Preferences saved');
				setTimeout(() => setSaveStatus(''), 2000);
			} else {
				setSaveStatus('Error saving preferences');
			}
		} catch (err) {
			console.error('Error saving preference:', err);
			setSaveStatus('Error saving preferences');
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
				<div className='max-w-3xl mx-auto space-y-8'>
					<div className='space-y-6 animate-in fade-in duration-200'>
						<div className='p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex items-center justify-between gap-3.5'>
							<div className='flex items-center gap-3.5'>
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

							{saveStatus && (
								<span className='px-3 py-1 rounded-full text-xs font-semibold bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/20 animate-in fade-in duration-150'>
									{saveStatus}
								</span>
							)}
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
									disabled={isLoading}
									checked={preferences.auto_play_voice}
									onChange={(e) => handleUpdatePreference('auto_play_voice', e.target.checked)}
									className='w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer disabled:opacity-50'
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
									disabled={isLoading}
									checked={preferences.desktop_notifications}
									onChange={(e) => handleUpdatePreference('desktop_notifications', e.target.checked)}
									className='w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer disabled:opacity-50'
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
									disabled={isLoading}
									checked={preferences.auto_scroll}
									onChange={(e) => handleUpdatePreference('auto_scroll', e.target.checked)}
									className='w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer disabled:opacity-50'
								/>
							</div>

							<div className='pt-2 space-y-2'>
								<h4 className='text-base font-bold text-[#202022]'>Default Audio Output Device</h4>
								<select
									disabled={isLoading}
									value={preferences.default_audio_output}
									onChange={(e) => handleUpdatePreference('default_audio_output', e.target.value)}
									className='w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm text-[#202022] font-semibold outline-none focus:border-[#7678ed] transition-all cursor-pointer disabled:opacity-50'
								>
									<option value='default'>System Default Speaker</option>
									<option value='headphones'>Headphones / Headset</option>
								</select>
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
