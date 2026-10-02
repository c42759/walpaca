import React from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input, Textarea } from "../ui/Input";
import { PlusIcon, EditIcon, TrashIcon, CheckIcon, CloseIcon } from "../icons/Icons";

export interface Instance {
    id: string;
    type: string;
    properties?: {
        name?: string;
        url?: string;
        api_key?: string;
        think?: boolean;
        share_name?: number;
        show_metadata?: boolean;
        allow_ssl?: boolean;
        override_params?: boolean;
        temp?: number;
        seed?: number;
        num_ctx?: number;
        keep_alive_preset?: string;
        keep_alive_minutes?: number;
    };
}

export interface ManageInstancesPanelProps {
    instances: Instance[];
    instanceSubView: "list" | "select-type" | "form" | "instance-models";
    setInstanceSubView: (view: "list" | "select-type" | "form" | "instance-models") => void;
    handleOpenAddInstanceModal: () => void;
    handleOpenEditInstanceModal: (instance: Instance) => void;
    handleDeleteInstance: (id: string) => void;
    handleManageInstanceModels: (instance: Instance) => void;
    selectedInstanceType: string;
    handleSelectInstanceType: (type: string) => void;
    editingInstanceId: string | null;
    instFormName: string;
    setInstFormName: (name: string) => void;
    instFormApiKey: string;
    setInstFormApiKey: (key: string) => void;
    instFormUrl: string;
    setInstFormUrl: (url: string) => void;
    instFormThink: boolean;
    setInstFormThink: (think: boolean) => void;
    instFormShareName: number;
    setInstFormShareName: (share: number) => void;
    instFormShowMetadata: boolean;
    setInstFormShowMetadata: (show: boolean) => void;
    instFormAllowSsl: boolean;
    setInstFormAllowSsl: (allow: boolean) => void;
    instFormOverrideParams: boolean;
    setInstFormOverrideParams: (override: boolean) => void;
    isOverrideAccordionOpen: boolean;
    setIsOverrideAccordionOpen: (open: boolean) => void;
    instFormTemp: number;
    setInstFormTemp: React.Dispatch<React.SetStateAction<number>>;
    instFormSeed: number;
    setInstFormSeed: React.Dispatch<React.SetStateAction<number>>;
    instFormNumCtx: number;
    setInstFormNumCtx: React.Dispatch<React.SetStateAction<number>>;
    instFormKeepAlivePreset: string;
    setInstFormKeepAlivePreset: (preset: string) => void;
    instFormKeepAliveMinutes: number;
    setInstFormKeepAliveMinutes: React.Dispatch<React.SetStateAction<number>>;
    handleSaveInstanceForm: (e: React.FormEvent) => void;
    showApiKeyText: boolean;
    setShowApiKeyText: (show: boolean) => void;
}

export const ManageInstancesPanel: React.FC<ManageInstancesPanelProps> = ({
    instances,
    instanceSubView,
    setInstanceSubView,
    handleOpenAddInstanceModal,
    handleOpenEditInstanceModal,
    handleDeleteInstance,
    handleManageInstanceModels,
    selectedInstanceType,
    handleSelectInstanceType,
    editingInstanceId,
    instFormName,
    setInstFormName,
    instFormApiKey,
    setInstFormApiKey,
    instFormUrl,
    setInstFormUrl,
    instFormThink,
    setInstFormThink,
    instFormShareName,
    setInstFormShareName,
    instFormShowMetadata,
    setInstFormShowMetadata,
    instFormAllowSsl,
    setInstFormAllowSsl,
    instFormOverrideParams,
    setInstFormOverrideParams,
    isOverrideAccordionOpen,
    setIsOverrideAccordionOpen,
    instFormTemp,
    setInstFormTemp,
    instFormSeed,
    setInstFormSeed,
    instFormNumCtx,
    setInstFormNumCtx,
    instFormKeepAlivePreset,
    setInstFormKeepAlivePreset,
    instFormKeepAliveMinutes,
    setInstFormKeepAliveMinutes,
    handleSaveInstanceForm,
    showApiKeyText,
    setShowApiKeyText,
}) => {
    return (
        <div>
            {/* View 1: Configured Instances List */}
            {instanceSubView === "list" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-[#202022]">Manage Instances</h3>
                            <p className="text-sm text-[#7a7d90] mt-1">Configure local server connections, cloud API backends, and proxy endpoints.</p>
                        </div>
                        <button
                            onClick={handleOpenAddInstanceModal}
                            className="p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                            title="Add Instance"
                        >
                            <PlusIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {instances.length === 0 ? (
                        <div className="p-8 rounded-2xl border border-dashed border-[#7678ed]/30 bg-[#f9fafc] text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-xl mx-auto">⚡</div>
                            <p className="text-base font-bold text-[#202022]">No Instances Configured</p>
                            <p className="text-xs text-[#8e90a6] max-w-sm mx-auto">Click "Add Instance" above to connect an Ollama local or remote server to Walpaca.</p>
                            <button
                                onClick={handleOpenAddInstanceModal}
                                className="px-4 py-2 bg-[#7678ed] text-white text-xs font-semibold rounded-xl hover:bg-[#6869d9] transition-all cursor-pointer"
                            >
                                + Add First Instance
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {instances.map((inst) => {
                                const name = inst.properties?.name || "Instance";
                                const url = inst.properties?.url || "http://0.0.0.0:11434";
                                const typeLabel = inst.type === "ollama" ? "Ollama (External)" : inst.type;

                                return (
                                    <div
                                        key={inst.id}
                                        className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc] flex items-center justify-between hover:border-[#7678ed]/40 transition-all"
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-10 h-10 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-base shrink-0">⚡</div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-base font-bold text-[#202022]">{name}</h4>
                                                    <span className="px-2 py-0.5 bg-[#eaecf9] text-[#7678ed] rounded-md text-[10px] font-bold uppercase tracking-wider">
                                                        {typeLabel}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[#8e90a6] font-mono">{url}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleManageInstanceModels(inst)}
                                                className="p-2 text-[#7678ed] hover:bg-[#eaecf9] rounded-2xl transition-colors cursor-pointer"
                                                title="Manage Models"
                                            >
                                                <EditIcon className="w-4.5 h-4.5" />
                                            </button>
                                            <button
                                                onClick={() => handleOpenEditInstanceModal(inst)}
                                                className="p-2 text-[#7678ed] hover:bg-[#eaecf9] rounded-2xl transition-colors cursor-pointer"
                                                title="Edit Instance"
                                            >
                                                <EditIcon className="w-4.5 h-4.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteInstance(inst.id)}
                                                className="p-2 text-[#ff4d4f] hover:bg-[#fff0f0] rounded-2xl transition-colors cursor-pointer"
                                                title="Delete Instance"
                                            >
                                                <TrashIcon className="w-4.5 h-4.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* View 2: Provider Selection */}
            {instanceSubView === "select-type" && (
                <div className="space-y-6 animate-in fade-in duration-200 select-none">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setInstanceSubView("list")}
                            className="p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer"
                            title="Back to Instances"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>
                        <div>
                            <h3 className="text-2xl font-bold text-[#202022]">Add Instance</h3>
                            <p className="text-sm text-[#7a7d90] mt-0.5">Select a type of instance to add to your workspace</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                        {[
                            { label: "Ollama", tag: "Local / Remote", desc: "Local or remote AI instance not managed by Walpaca", icon: "🦙" },
                            { label: "Ollama (Cloud)", tag: "Cloud API", desc: "Ollama server hosted on cloud infrastructure", icon: "☁️" },
                            { label: "OpenAI ChatGPT", tag: "Cloud API", desc: "Official OpenAI GPT-4o & ChatGPT API endpoint", icon: "🌐" },
                            { label: "Google Gemini", tag: "Cloud API", desc: "Google Gemini Flash & Pro API model suite", icon: "✨" },
                            { label: "Together AI", tag: "Cloud API", desc: "Together AI open-source model cloud platform", icon: "🤝" },
                            { label: "Venice", tag: "Cloud API", desc: "Venice private uncensored inference network", icon: "🔒" },
                            { label: "Deepseek", tag: "Cloud API", desc: "Deepseek Coder & Reasoner LLM endpoints", icon: "🧠" },
                            { label: "Groq Cloud", tag: "Cloud API", desc: "Groq ultra-fast LPU inference engine", icon: "🚀" },
                            { label: "Anthropic", tag: "Cloud API", desc: "Anthropic Claude 3.5 Sonnet & Haiku API", icon: "🎭" },
                            { label: "OpenRouter AI", tag: "Cloud API", desc: "OpenRouter unified multi-provider routing API", icon: "🔀" },
                        ].map((provider) => (
                            <div
                                key={provider.label}
                                onClick={() => handleSelectInstanceType(provider.label)}
                                className="p-4 rounded-2xl border border-[#e8ebf3] bg-[#f9fafc] hover:bg-[#f2f4fa] hover:border-[#7678ed] transition-all cursor-pointer flex items-start gap-3.5 group shadow-xs"
                            >
                                <div className="w-11 h-11 rounded-2xl bg-[#eaecf9] group-hover:bg-[#7678ed] group-hover:text-white text-[#7678ed] flex items-center justify-center font-bold text-lg shrink-0 transition-colors">
                                    {provider.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h4 className="text-base font-bold text-[#202022] group-hover:text-[#7678ed] transition-colors truncate">{provider.label}</h4>
                                        <span className="px-2 py-0.5 bg-[#eaecf9] text-[#7678ed] rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0">
                                            {provider.tag}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#7a7d90] line-clamp-2 leading-relaxed">{provider.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* View 3: Instance Configuration Form */}
            {instanceSubView === "form" && (
                <div className="space-y-6 animate-in fade-in duration-200 select-text">
                    <div className="flex items-center justify-between pb-4 border-b border-[#e8ebf3] shrink-0">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setInstanceSubView(editingInstanceId ? "list" : "select-type")}
                                className="p-2 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] transition-all cursor-pointer"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                            <div>
                                <h3 className="text-2xl font-bold text-[#202022]">{editingInstanceId ? "Edit Instance" : "Create Instance"}</h3>
                                <p className="text-sm text-[#7a7d90] mt-0.5">{selectedInstanceType}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSaveInstanceForm}
                                className="p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center"
                            >
                                <CheckIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSaveInstanceForm} className="space-y-6 text-sm max-w-3xl">
                        <div className="bg-[#f9fafc] border border-[#e8ebf3] rounded-3xl p-6 space-y-5 shadow-xs">
                            <h4 className="font-bold text-base text-[#202022] border-b border-[#e8ebf3] pb-3">Basic Configuration</h4>
                            <div>
                                <label className="font-semibold text-[#202022] block mb-1.5 text-xs">Name</label>
                                <input
                                    type="text"
                                    value={instFormName}
                                    onChange={(e) => setInstFormName(e.target.value)}
                                    className="w-full bg-white border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm font-medium text-[#202022] outline-none focus:border-[#7678ed] transition-colors shadow-xs"
                                    placeholder="Instance Name"
                                />
                            </div>

                            <div>
                                <label className="font-semibold text-[#202022] block mb-1.5 text-xs">API Key</label>
                                <input
                                    type={showApiKeyText ? "text" : "password"}
                                    value={instFormApiKey}
                                    onChange={(e) => setInstFormApiKey(e.target.value)}
                                    className="w-full bg-white border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm font-medium text-[#202022] outline-none focus:border-[#7678ed] transition-colors font-mono shadow-xs"
                                    placeholder="API Key"
                                />
                            </div>

                            <div>
                                <label className="font-semibold text-[#202022] block mb-1.5 text-xs">Instance URL / Endpoint</label>
                                <input
                                    type="text"
                                    value={instFormUrl}
                                    onChange={(e) => setInstFormUrl(e.target.value)}
                                    className="w-full bg-white border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm font-medium text-[#202022] outline-none focus:border-[#7678ed] transition-colors font-mono shadow-xs"
                                    placeholder="http://0.0.0.0:11434"
                                />
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
