import React from 'react';
import { SettingsCategory } from './SettingsSidebar';
import { WidgetSimple } from '../ui/Widget';

export interface SettingsHelpSidebarProps {
	activeSettingsCategory: SettingsCategory;
}

export const SettingsHelpSidebar: React.FC<SettingsHelpSidebarProps> = ({
	activeSettingsCategory,
}) => {
	return (
		<aside className='w-[330px] bg-[#f9fafc] border-l border-[#e8ebf3] p-6 flex flex-col gap-5 overflow-y-auto shrink-0 select-none'>
			<div className='flex items-center gap-2 text-[#7678ed] font-bold text-lg border-b border-[#e8ebf3] pb-3'>
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
					<path d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' />
				</svg>
				<span>Help &amp; Tips</span>
			</div>

			{activeSettingsCategory === 'import-chat' && (
				<>
					<WidgetSimple
						title='Supported File Types'
						content={
							<p className='text-sm text-[#8e90a6]'>
								You can import JSON files exported directly from ChatGPT (
								<code className='bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]'>conversations.json</code>) or Anthropic Claude exports.
							</p>
						}
					/>

					<WidgetSimple
						title='Size Limits'
						content={
							<p className='text-sm text-[#8e90a6]'>
								Single file archives up to 500 MB are processed locally without leaving your browser workspace.
							</p>
						}
					/>
				</>
			)}

			{activeSettingsCategory === 'manage-instances' && (
				<>
					<WidgetSimple
						title='Connecting Ollama'
						content={
							<p className='text-sm text-[#8e90a6]'>
								Ensure Ollama is running locally with{' '}
								<code className='bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]'>OLLAMA_ORIGINS=&quot;*&quot;</code> enabled for web CORS
								access.
							</p>
						}
					/>

					<WidgetSimple
						title='API Key Security'
						content={
							<p className='text-sm text-[#8e90a6]'>
								Cloud API tokens are encrypted in your browser&apos;s local secure storage and never transmitted to third parties.
							</p>
						}
					/>
				</>
			)}

			{activeSettingsCategory === 'manage-model-preferences' && (
				<>
					<WidgetSimple
						title='Model Personas'
						content={
							<p className='text-sm text-[#8e90a6]'>
								Model preferences bind custom character profiles, voice settings, and avatars to specific model IDs.
							</p>
						}
					/>

					<WidgetSimple
						title='Instance Association'
						content={
							<p className='text-sm text-[#8e90a6]'>
								Each card displays the hosting instance providing the model (e.g. Ollama, Google Gemini, OpenAI).
							</p>
						}
					/>
				</>
			)}

			{activeSettingsCategory === 'preferences' && (
				<>
					<WidgetSimple
						title='TTS Audio Output'
						content={
							<p className='text-sm text-[#8e90a6]'>
								Ensure your browser permission allows HTML5 Web Audio auto-play for seamless speech output.
							</p>
						}
					/>
				</>
			)}

			{activeSettingsCategory === 'manage-lorebook' && (
				<>
					<WidgetSimple
						title='Lorebook JSON Format'
						content={
							<>
								<p className='text-sm text-[#8e90a6]'>
									Each template is saved as a JSON file in <code className='bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]'>lorebook/</code>{' '}
									with the structure:
								</p>
								<pre className='bg-[#f9fafc] p-2.5 rounded-xl border border-[#e8ebf3] text-[11px] font-mono text-[#202022] overflow-x-auto'>
									{`{\n  "name": "Character Name",\n  "keys": ["key1", "key2"],\n  "content": "My content here"\n}`}
								</pre>
							</>
						}
					/>

					<WidgetSimple
						title='Keyword Triggering'
						content={
							<>
								<p className='text-sm text-[#8e90a6]'>
									When prompt messages match any trigger key, the character content is automatically evaluated into the model&apos;s system
									prompt.
								</p>
							</>
						}
					/>
				</>
			)}

			{activeSettingsCategory === 'about-walpaca' && (
				<>
					<WidgetSimple
						title='System Status'
						content={
							<>
								<p className='text-sm text-[#8e90a6]'>Frontend UI and Python API services are running.</p>
							</>
						}
					/>

					<WidgetSimple
						title='Database Path'
						content={
							<>
								<p className='text-sm text-[#8e90a6] font-mono'>./alpaca.db</p>
							</>
						}
					/>
				</>
			)}
		</aside>
	);
};
