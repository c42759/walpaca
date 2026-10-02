export interface VoiceOption {
    id: string;
    name: string;
    flag: string;
    language: string;
    label: string;
}

export interface VoiceGroup {
    gender: "Female" | "Male";
    voices: VoiceOption[];
}

export const TTS_VOICE_GROUPS: VoiceGroup[] = [
    {
        gender: "Female",
        voices: [
            // American English
            { id: "af_heart", name: "Heart", flag: "🇺🇸", language: "US English", label: "🇺🇸 Heart (US English)" },
            { id: "af_bella", name: "Bella", flag: "🇺🇸", language: "US English", label: "🇺🇸 Bella (US English)" },
            { id: "af_sarah", name: "Sarah", flag: "🇺🇸", language: "US English", label: "🇺🇸 Sarah (US English)" },
            { id: "af_sky", name: "Sky", flag: "🇺🇸", language: "US English", label: "🇺🇸 Sky (US English)" },
            { id: "af_nicole", name: "Nicole", flag: "🇺🇸", language: "US English", label: "🇺🇸 Nicole (US English)" },
            { id: "af_jessica", name: "Jessica", flag: "🇺🇸", language: "US English", label: "🇺🇸 Jessica (US English)" },
            { id: "af_river", name: "River", flag: "🇺🇸", language: "US English", label: "🇺🇸 River (US English)" },
            { id: "af_nova", name: "Nova", flag: "🇺🇸", language: "US English", label: "🇺🇸 Nova (US English)" },
            { id: "af_alloy", name: "Alloy", flag: "🇺🇸", language: "US English", label: "🇺🇸 Alloy (US English)" },
            { id: "af_aoede", name: "Aoede", flag: "🇺🇸", language: "US English", label: "🇺🇸 Aoede (US English)" },
            { id: "af_kore", name: "Kore", flag: "🇺🇸", language: "US English", label: "🇺🇸 Kore (US English)" },

            // British English
            { id: "bf_alice", name: "Alice", flag: "🇬🇧", language: "UK English", label: "🇬🇧 Alice (UK English)" },
            { id: "bf_emma", name: "Emma", flag: "🇬🇧", language: "UK English", label: "🇬🇧 Emma (UK English)" },
            { id: "bf_isabella", name: "Isabella", flag: "🇬🇧", language: "UK English", label: "🇬🇧 Isabella (UK English)" },
            { id: "bf_lily", name: "Lily", flag: "🇬🇧", language: "UK English", label: "🇬🇧 Lily (UK English)" },

            // Spanish
            { id: "ef_dora", name: "Dora", flag: "🇪🇸", language: "Spanish", label: "🇪🇸 Dora (Spanish)" },

            // French
            { id: "ff_siwis", name: "Siwis", flag: "🇫🇷", language: "French", label: "🇫🇷 Siwis (French)" },

            // Hindi / Indian English
            { id: "hf_beta", name: "Beta", flag: "🇮🇳", language: "Hindi / Indian English", label: "🇮🇳 Beta (Hindi / Indian English)" },
            { id: "hf_alpha", name: "Alpha", flag: "🇮🇳", language: "Hindi / Indian English", label: "🇮🇳 Alpha (Hindi / Indian English)" },

            // Italian
            { id: "if_sara", name: "Sara", flag: "🇮🇹", language: "Italian", label: "🇮🇹 Sara (Italian)" },

            // Portuguese
            { id: "pf_dora", name: "Dora", flag: "🇵🇹", language: "Portuguese", label: "🇵🇹 Dora (Portuguese)" },

            // Japanese
            { id: "jf_alpha", name: "Alpha", flag: "🇯🇵", language: "Japanese", label: "🇯🇵 Alpha (Japanese)" },
            { id: "jf_gongitsune", name: "Gongitsune", flag: "🇯🇵", language: "Japanese", label: "🇯🇵 Gongitsune (Japanese)" },
            { id: "jf_nezumi", name: "Nezumi", flag: "🇯🇵", language: "Japanese", label: "🇯🇵 Nezumi (Japanese)" },
            { id: "jf_tebukuro", name: "Tebukuro", flag: "🇯🇵", language: "Japanese", label: "🇯🇵 Tebukuro (Japanese)" },

            // Mandarin Chinese
            { id: "zf_xiaoxiao", name: "Xiaoxiao", flag: "🇨🇳", language: "Mandarin", label: "🇨🇳 Xiaoxiao (Mandarin)" },
            { id: "zf_xiaobei", name: "Xiaobei", flag: "🇨🇳", language: "Mandarin", label: "🇨🇳 Xiaobei (Mandarin)" },
            { id: "zf_xiaoni", name: "Xiaoni", flag: "🇨🇳", language: "Mandarin", label: "🇨🇳 Xiaoni (Mandarin)" },
            { id: "zf_xiaoyi", name: "Xiaoyi", flag: "🇨🇳", language: "Mandarin", label: "🇨🇳 Xiaoyi (Mandarin)" },
        ],
    },
    {
        gender: "Male",
        voices: [
            // American English
            { id: "am_adam", name: "Adam", flag: "🇺🇸", language: "US English", label: "🇺🇸 Adam (US English)" },
            { id: "am_michael", name: "Michael", flag: "🇺🇸", language: "US English", label: "🇺🇸 Michael (US English)" },
            { id: "am_liam", name: "Liam", flag: "🇺🇸", language: "US English", label: "🇺🇸 Liam (US English)" },
            { id: "am_eric", name: "Eric", flag: "🇺🇸", language: "US English", label: "🇺🇸 Eric (US English)" },
            { id: "am_fenrir", name: "Fenrir", flag: "🇺🇸", language: "US English", label: "🇺🇸 Fenrir (US English)" },
            { id: "am_echo", name: "Echo", flag: "🇺🇸", language: "US English", label: "🇺🇸 Echo (US English)" },
            { id: "am_onyx", name: "Onyx", flag: "🇺🇸", language: "US English", label: "🇺🇸 Onyx (US English)" },
            { id: "am_puck", name: "Puck", flag: "🇺🇸", language: "US English", label: "🇺🇸 Puck (US English)" },
            { id: "am_santa", name: "Santa", flag: "🇺🇸", language: "US English", label: "🇺🇸 Santa (US English)" },

            // British English
            { id: "bm_george", name: "George", flag: "🇬🇧", language: "UK English", label: "🇬🇧 George (UK English)" },
            { id: "bm_daniel", name: "Daniel", flag: "🇬🇧", language: "UK English", label: "🇬🇧 Daniel (UK English)" },
            { id: "bm_fable", name: "Fable", flag: "🇬🇧", language: "UK English", label: "🇬🇧 Fable (UK English)" },
            { id: "bm_lewis", name: "Lewis", flag: "🇬🇧", language: "UK English", label: "🇬🇧 Lewis (UK English)" },

            // Spanish
            { id: "em_alex", name: "Alex", flag: "🇪🇸", language: "Spanish", label: "🇪🇸 Alex (Spanish)" },
            { id: "em_santa", name: "Santa", flag: "🇪🇸", language: "Spanish", label: "🇪🇸 Santa (Spanish)" },

            // Hindi / Indian English
            { id: "hm_omega", name: "Omega", flag: "🇮🇳", language: "Hindi / Indian English", label: "🇮🇳 Omega (Hindi / Indian English)" },
            { id: "hm_psi", name: "Psi", flag: "🇮🇳", language: "Hindi / Indian English", label: "🇮🇳 Psi (Hindi / Indian English)" },

            // Italian
            { id: "im_nicola", name: "Nicola", flag: "🇮🇹", language: "Italian", label: "🇮🇹 Nicola (Italian)" },

            // Portuguese
            { id: "pm_alex", name: "Alex", flag: "🇵🇹", language: "Portuguese", label: "🇵🇹 Alex (Portuguese)" },
            { id: "pm_santa", name: "Santa", flag: "🇵🇹", language: "Portuguese", label: "🇵🇹 Santa (Portuguese)" },

            // Japanese
            { id: "jm_kumo", name: "Kumo", flag: "🇯🇵", language: "Japanese", label: "🇯🇵 Kumo (Japanese)" },

            // Mandarin Chinese
            { id: "zm_yunjian", name: "Yunjian", flag: "🇨🇳", language: "Mandarin", label: "🇨🇳 Yunjian (Mandarin)" },
            { id: "zm_yunxi", name: "Yunxi", flag: "🇨🇳", language: "Mandarin", label: "🇨🇳 Yunxi (Mandarin)" },
            { id: "zm_yunxia", name: "Yunxia", flag: "🇨🇳", language: "Mandarin", label: "🇨🇳 Yunxia (Mandarin)" },
            { id: "zm_yunyang", name: "Yunyang", flag: "🇨🇳", language: "Mandarin", label: "🇨🇳 Yunyang (Mandarin)" },
        ],
    },
];

const voiceMap = new Map<string, VoiceOption>();
for (const group of TTS_VOICE_GROUPS) {
    for (const voice of group.voices) {
        voiceMap.set(voice.id.toLowerCase(), voice);
    }
}

export function getVoiceDisplayName(voiceId?: string | null): string {
    if (!voiceId) return "🇺🇸 Heart";
    const matched = voiceMap.get(voiceId.toLowerCase());
    if (matched) {
        return `${matched.flag} ${matched.name}`;
    }
    return voiceId;
}
