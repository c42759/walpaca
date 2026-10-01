'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getApiUrl } from '@/lib/api';
import { SettingsSidebar, SettingsCategory } from '@/components/settings/SettingsSidebar';
import { SettingsHelpSidebar } from '@/components/settings/SettingsHelpSidebar';
import { ManageLorebookPanel } from '@/components/settings/ManageLorebookPanel';
import { LorebookTemplate } from '@/components/settings/ManagePersonasPanel';

export default function LorebookSettingsPage() {
	const { setCurrentView } = useAppStore();
	const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('manage-lorebook');

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

	useEffect(() => {
		fetchLorebookTemplates();
	}, []);

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
					<ManageLorebookPanel
						lorebookTemplates={lorebookTemplates}
						isLorebookLoading={isLorebookLoading}
						getApiUrl={getApiUrl}
						fetchLorebookTemplates={fetchLorebookTemplates}
					/>
				</div>
			</main>

			{/* 3. RIGHT SIDEBAR - HELP & TIPS */}
			<SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
		</div>
	);
}
