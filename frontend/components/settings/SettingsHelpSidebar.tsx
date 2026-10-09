import React from "react";
import { SettingsCategory } from "./SettingsSidebar";
import { WidgetSimple } from "../ui/Widget";
import { TipIcon } from "@/components/icons/Icons";

export interface SettingsHelpSidebarProps {
    activeSettingsCategory: SettingsCategory;
}

export const SettingsHelpSidebar: React.FC<SettingsHelpSidebarProps> = ({ activeSettingsCategory }) => {
    return (
        <aside className="hidden xl:flex w-[280px] 2xl:w-[330px] bg-[#f9fafc] border-l border-[#e8ebf3] p-4 lg:p-6 flex-col gap-4 lg:gap-5 overflow-y-auto shrink-0 select-none">
            <div className="flex items-center gap-2 text-[#7678ed] font-bold text-lg border-b border-[#e8ebf3] pb-3">
                <TipIcon className="w-5 h-5" />
                <span>Help &amp; Tips</span>
            </div>

            {activeSettingsCategory === "import-chat" && (
                <>
                    <WidgetSimple
                        title="Supported File Types"
                        content={
                            <p className="text-sm text-[#8e90a6]">
                                You can import JSON files exported directly from ChatGPT (
                                <code className="bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]">conversations.json</code>) or Anthropic Claude exports.
                            </p>
                        }
                    />

                    <WidgetSimple
                        title="Size Limits"
                        content={<p className="text-sm text-[#8e90a6]">Single file archives up to 500 MB are processed locally without leaving your browser workspace.</p>}
                    />
                </>
            )}

            {activeSettingsCategory === "manage-instances" && (
                <>
                    <WidgetSimple
                        title="Connecting Ollama"
                        content={
                            <p className="text-sm text-[#8e90a6]">
                                Ensure Ollama is running locally with <code className="bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]">OLLAMA_ORIGINS=&quot;*&quot;</code> enabled
                                for web CORS access.
                            </p>
                        }
                    />

                    <WidgetSimple
                        title="API Key Security"
                        content={
                            <p className="text-sm text-[#8e90a6]">
                                Cloud API tokens are encrypted in your browser&apos;s local secure storage and never transmitted to third parties.
                            </p>
                        }
                    />
                </>
            )}

            {activeSettingsCategory === "manage-model-preferences" && (
                <>
                    <WidgetSimple
                        title="Model Personas"
                        content={<p className="text-sm text-[#8e90a6]">Model preferences bind custom character profiles, voice settings, and avatars to specific model IDs.</p>}
                    />

                    <WidgetSimple
                        title="Instance Association"
                        content={<p className="text-sm text-[#8e90a6]">Each card displays the hosting instance providing the model (e.g. Ollama, Google Gemini, OpenAI).</p>}
                    />
                </>
            )}

            {activeSettingsCategory === "preferences" && (
                <>
                    <WidgetSimple
                        title="TTS Audio Output"
                        content={<p className="text-sm text-[#8e90a6]">Ensure your browser permission allows HTML5 Web Audio auto-play for seamless speech output.</p>}
                    />
                </>
            )}

            {activeSettingsCategory === "manage-lorebook" && (
                <>
                    <WidgetSimple
                        title="Lorebook JSON Format"
                        content={
                            <>
                                <p className="text-sm text-[#8e90a6]">
                                    Each template is saved as a JSON file in <code className="bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]">lorebook/</code> with the structure:
                                </p>
                                <pre className="bg-[#f9fafc] p-2.5 rounded-xl border border-[#e8ebf3] text-[11px] font-mono text-[#202022] overflow-x-auto">
                                    {`{\n  "name": "Character Name",\n  "keys": ["key1", "key2"],\n  "content": "My content here"\n}`}
                                </pre>
                            </>
                        }
                    />

                    <WidgetSimple
                        title="Keyword Triggering"
                        content={
                            <>
                                <p className="text-sm text-[#8e90a6]">
                                    When prompt messages match any trigger key, the character content is automatically evaluated into the model&apos;s system prompt.
                                </p>
                            </>
                        }
                    />
                </>
            )}

            {activeSettingsCategory === "manage-prompts" && (
                <>
                    <WidgetSimple
                        title="Custom Prompts"
                        content={
                            <p className="text-sm text-[#8e90a6]">
                                Save reusable prompt snippets and templates. Select them directly in the chat view to quickly populate your message composer.
                            </p>
                        }
                    />

                    <WidgetSimple
                        title="Prompt Storage"
                        content={
                            <p className="text-sm text-[#8e90a6]">
                                Custom prompts are stored as clean JSON files inside <code className="bg-[#eaecf9] px-1 py-0.5 rounded text-[#7678ed]">prompts/</code>.
                            </p>
                        }
                    />
                </>
            )}

            {activeSettingsCategory === "about-walpaca" && (
                <>
                    <WidgetSimple
                        title="System Status"
                        content={
                            <>
                                <p className="text-sm text-[#8e90a6]">Frontend UI and Python API services are running.</p>
                            </>
                        }
                    />

                    <WidgetSimple
                        title="Database Path"
                        content={
                            <>
                                <p className="text-sm text-[#8e90a6] font-mono">./alpaca.db</p>
                            </>
                        }
                    />
                </>
            )}
        </aside>
    );
};
