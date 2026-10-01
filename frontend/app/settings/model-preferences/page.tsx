'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SettingsSidebar, SettingsCategory } from '@/components/settings/SettingsSidebar';
import { SettingsHelpSidebar } from '@/components/settings/SettingsHelpSidebar';
import { ManageModelPreferencesPanel } from '@/components/settings/ManageModelPreferencesPanel';

export default function ModelPreferencesSettingsPage() {
	const { setCurrentView } = useAppStore();
	const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('manage-model-preferences');

	return (
		<div className='flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text'>
			{/* 1. SETTINGS CATEGORIES SIDEBAR */}
			<SettingsSidebar
				activeSettingsCategory={activeSettingsCategory}
				setActiveSettingsCategory={setActiveSettingsCategory}
				setCurrentView={setCurrentView}
			/>

			{/* 2. MIDDLE SETTINGS CONTENT AREA */}
			<main className='flex-1 overflow-y-auto'>
				<ManageModelPreferencesPanel />
			</main>

			{/* 3. RIGHT SIDEBAR - HELP & TIPS */}
			<SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
		</div>
	);
}
