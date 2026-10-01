import React from 'react';
import { SettingsCategory } from './SettingsSidebar';

export interface SettingsHelpSidebarProps {
	activeSettingsCategory: SettingsCategory;
}

export const SettingsHelpSidebar: React.FC<SettingsHelpSidebarProps> = ({
	activeSettingsCategory,
}) => {
	return (
		<aside className='w-[320px] bg-[#f9fafc] border-l border-[#e8ebf3] p-6 flex flex-col gap-5 overflow-y-auto shrink-0 select-none'>
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
				<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm'>Supported File Types</h5>
						<p className='text-xs text-[#7a7d90]'>
							You can import JSON files exported directly from ChatGPT (
							<code className='bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]'>conversations.json</code>) or Anthropic Claude exports.
						</p>
					</div>
					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm'>Size Limits</h5>
						<p className='text-xs text-[#7a7d90]'>
							Single file archives up to 500 MB are processed locally without leaving your browser workspace.
						</p>
					</div>
				</div>
			)}

			{activeSettingsCategory === 'manage-instances' && (
				<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm'>Connecting Ollama</h5>
						<p className='text-xs text-[#7a7d90]'>
							Ensure Ollama is running locally with{' '}
							<code className='bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]'>OLLAMA_ORIGINS=&quot;*&quot;</code> enabled for web CORS access.
						</p>
					</div>
					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm'>API Key Security</h5>
						<p className='text-xs text-[#7a7d90]'>
							Cloud API tokens are encrypted in your browser&apos;s local secure storage and never transmitted to third parties.
						</p>
					</div>
				</div>
			)}

			{activeSettingsCategory === 'preferences' && (
				<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm'>TTS Audio Output</h5>
						<p className='text-xs text-[#7a7d90]'>
							Ensure your browser permission allows HTML5 Web Audio auto-play for seamless speech output.
						</p>
					</div>
				</div>
			)}

			{activeSettingsCategory === 'manage-lorebook' && (
				<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm'>Lorebook JSON Format</h5>
						<p className='text-xs text-[#7a7d90]'>
							Each template is saved as a JSON file in{' '}
							<code className='bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]'>lorebook/</code> with the structure:
						</p>
						<pre className='bg-[#f9fafc] p-2.5 rounded-xl border border-[#e8ebf3] text-[11px] font-mono text-[#202022] overflow-x-auto'>
							{`{
"name": "Character Name",
"keys": ["key1", "key2"],
"content": "My content here"
}`}
						</pre>
					</div>
					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm'>Keyword Triggering</h5>
						<p className='text-xs text-[#7a7d90]'>
							When prompt messages match any trigger key, the character content is automatically evaluated into the model&apos;s system prompt.
						</p>
					</div>
				</div>
			)}

			{activeSettingsCategory === 'about-walpaca' && (
				<div className='space-y-4 text-sm text-[#404252] leading-relaxed'>
					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm flex items-center gap-2'>
							<span className='w-2 h-2 rounded-full bg-[#27c93f] inline-block' />
							<span>System Status</span>
						</h5>
						<p className='text-xs text-[#7a7d90]'>Frontend UI and Python API services are running.</p>
					</div>

					<div className='p-4 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs space-y-2'>
						<h5 className='font-bold text-[#202022] text-sm'>Database Path</h5>
						<p className='text-xs text-[#7a7d90] font-mono'>./alpaca.db</p>
					</div>
				</div>
			)}
		</aside>
	);
};
