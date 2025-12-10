import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/generative-ai";
import { Project, AnalysisResult, ProjectHealth, MediaAnalysisResult, JournalProject, AISettings, SceneBeat, AudienceProfile, MarketingPost, NovelProject, ContinuityIssue, BetaReaderFeedback, BetaReaderPersona, Relationship, TrendingTopic, SEOScore, AIAgent, GlobalEditSuggestion, AIChatMessage, Character, Chapter, Artifact, ScheduledPost, KeywordAnalysis, CompetitorAnalysis, CategoryAnalysis, BookFormatSettings, StoryAnalysis, Subplot, PlotThread, ForeshadowingOpportunity, ViralMoment, ColoringPage, ColoringBookProject, SocialPlatform, ListingOptimization, TrilogyCohesionReport, JournalPage, ApiKey, AnalysisIssue, TrilogyIssueAndFix, SynopsisAnalysis, MediaAnalysisResult as MediaAnalysisResultType, ProjectHealth as ProjectHealthType, ContinuityIssue as ContinuityIssueType, TrilogyCohesionReport as TrilogyCohesionReportType, BookOutline, WorldItem } from "../types";
import mammoth from 'mammoth';
import { getEncoding } from 'js-tiktoken';
import { v4 as uuidv4 } from 'uuid';

// --- Tokenizer ---
let tokenizer: any;
try {
    // Using cl100k_base as it's a common standard for modern models.
    tokenizer = getEncoding("cl100k_base");
} catch (e) {
    console.warn("Could not initialize tokenizer, falling back to estimation.", e);
}

// --- WebLLM Engine State ---
let mlcEngine: any = null;

export const initializeWebLLM = async (modelId: string, onProgress: (progress: any) => void) => {
    try {
        // Dynamic import to prevent crash if module is missing or fails to load at startup
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
        mlcEngine = await CreateMLCEngine(modelId, { 
            initProgressCallback: onProgress,
            logLevel: "INFO" 
        });
        return mlcEngine;
    } catch (e) {
        console.error("Failed to initialize WebLLM engine:", e);
        throw e;
    }
};

export const isWebLLMLoaded = () => !!mlcEngine;


// --- Robust JSON parsing ---
const extractJSON = <T>(text: string | undefined): T | null => {
    if (!text) {
        return null;
    }

    const trimmedText = text.trim();

    // Strategy 1: Try to parse the whole string directly if it looks like JSON.
    if ((trimmedText.startsWith('{') && trimmedText.endsWith('}')) || (trimmedText.startsWith('[') && trimmedText.endsWith(']'))) {
        try {
            return JSON.parse(trimmedText) as T;
        } catch (e) {
            // It looked like JSON but wasn't. Fall through.
        }
    }

    // Strategy 2: Find and parse a JSON markdown block.
    const markdownMatch = trimmedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        try {
            return JSON.parse(markdownMatch[1].trim()) as T;
        } catch (e) {
            // Markdown block was found but couldn't be parsed. Fall through.
        }
    }

    // Strategy 3: Definitive stack-based parser to find the first complete JSON object/array.
    try {
        let startIndex = -1;
        
        const firstBrace = trimmedText.indexOf('{');
        const firstBracket = trimmedText.indexOf('[');

        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            startIndex = firstBrace;
        } else if (firstBracket !== -1) {
            startIndex = firstBracket;
        }

        if (startIndex === -1) {
            return null; // No JSON structure found
        }
        
        const stack: ('{' | '[')[] = [];
        let inString = false;
        let lastGoodParse = null;

        for (let i = startIndex; i < trimmedText.length; i++) {
            const char = trimmedText[i];
            
            if (inString) {
                if (char === '"' && trimmedText[i - 1] !== '\\') {
                    inString = false;
                }
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === '{' || char === '[') {
                stack.push(char);
            } else if (char === '}') {
                if (stack.length > 0 && stack[stack.length - 1] === '{') {
                    stack.pop();
                } else {
                    return lastGoodParse; // Malformed JSON, return what we had if anything
                }
            } else if (char === ']') {
                 if (stack.length > 0 && stack[stack.length - 1] === '[') {
                    stack.pop();
                } else {
                    return lastGoodParse; // Malformed JSON
                }
            }
            
            if (stack.length === 0) {
                // We found a complete JSON object/array
                const jsonString = trimmedText.substring(startIndex, i + 1);
                try {
                    lastGoodParse = JSON.parse(jsonString) as T;
                    // We found one, but there might be more text. We will return this one if the rest is garbage.
                } catch (e) {
                    // This can happen with weird trailing characters. We return the last good parse.
                    return lastGoodParse;
                }
            }
        }
        
        return lastGoodParse;

    } catch (e) {
        console.error("CRITICAL: All JSON parsing strategies failed.", { error: e, originalText: text });
        return null;
    }
};


// --- Configuration & State ---

const DEFAULT_SETTINGS: AISettings = {
    apiKeys: [],
    activeProvider: 'gemini',
    dailyTokenLimit: 2000000,
    modelConfig: { temperature: 0.7, topK: 40, topP: 0.95 }
};


let currentSettings: AISettings = { ...DEFAULT_SETTINGS };
let sessionTokens = 0;
let tokenBreakdown = { writing: 0, analysis: 0, chat: 0, media: 0 };


// --- Sound Manager ---
export class SoundManager {
    private static instance: SoundManager;
    public outputContext: AudioContext | null = null;
    public inputContext: AudioContext | null = null;

    private constructor() {}

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    public getOutputContext(sampleRate = 24000): AudioContext {
        if (!this.outputContext || this.outputContext.state === 'closed') {
            this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
        }
        return this.outputContext;
    }
    
    public getInputContext(sampleRate = 16000): AudioContext {
        if (!this.inputContext || this.inputContext.state === 'closed') {
            this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
        }
        return this.inputContext;
    }

    public async resumeOutput() {
        if (this.outputContext && this.outputContext.state === 'suspended') {
            await this.outputContext.resume();
        }
    }
}

// --- Audio Encoding/Decoding Helpers ---
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Local interface for GenAI Blob to avoid import issues
interface GenAIBlob {
    data: string;
    mimeType: string;
}

function createBlob(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


export const getAISettings = (): AISettings => {
    const saved = localStorage.getItem('authorforge_ai_settings');
    if (saved) {
        // Ensure apiKeys is always an array
        const parsed = JSON.parse(saved);
        currentSettings = { ...DEFAULT_SETTINGS, ...parsed, apiKeys: parsed.apiKeys || [] };
    }
    return currentSettings;
};

export const saveAISettings = (settings: AISettings) => {
    currentSettings = settings;
    localStorage.setItem('authorforge_ai_settings', JSON.stringify(settings));
};

export const trackTokens = (input: string, output: string, category: keyof typeof tokenBreakdown) => {
    let count = 0;
    if (tokenizer) {
        try {
            const inputTokens = tokenizer.encode(input || "").length;
            const outputTokens = tokenizer.encode(output || "").length;
            count = inputTokens + outputTokens;
        } catch (e) {
            // console.warn("Token counting failed, falling back to estimation.", e);
            count = Math.ceil(((input || "").length + (output || "").length) / 4);
        }
    } else {
        count = Math.ceil(((input || "").length + (output || "").length) / 4);
    }
    sessionTokens += count;
    tokenBreakdown[category] += count;
};

export const getSessionTokens = () => sessionTokens;
export const getTokenBreakdown = () => tokenBreakdown;

const getValidKeyForProvider = (provider: 'gemini'): ApiKey | undefined => {
    getAISettings();
    return currentSettings.apiKeys.find(k => k.provider === provider && k.status === 'valid');
}

export const validateApiKey = async (key: string): Promise<{ provider: ApiKey['provider'], status: 'valid' | 'invalid' }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: key });
        await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
        return { provider: 'gemini', status: 'valid' };
    } catch (e) {}
    
    return { provider: 'unknown', status: 'invalid' };
};

export const estimateTokens = (text: string): number => {
    if (tokenizer) {
        try {
            return tokenizer.encode(text || "").length;
        } catch (e) {
            return Math.ceil((text || "").length / 4);
        }
    }
    return Math.ceil((text || "").length / 4);
};

// Simplified AI content generation router
async function generateAIContent(params: { model: string, contents: any, config?: any, history?: any[] }, category: keyof typeof tokenBreakdown = 'writing'): Promise<{ text: string | null, [key: string]: any }> {
    getAISettings();
    
    // --- WEBLLM PROVIDER ---
    if (currentSettings.activeProvider === 'webllm') {
        if (!mlcEngine) {
            return { text: `### WebLLM Not Loaded\nPlease go to Settings > AI Configuration and load a model to use the Local Browser provider.` };
        }

        try {
            // Convert Gemini 'contents' format to OpenAI 'messages' format for WebLLM
            let messages: any[] = [];
            
            // Handle history/chat context if provided
            if (params.history) {
                messages = params.history.map((msg: any) => ({
                    role: msg.role === 'model' ? 'assistant' : 'user',
                    content: msg.text || msg.parts?.[0]?.text || ''
                }));
            }

            // Handle current content
            let userContent = "";
            if (typeof params.contents === 'string') {
                userContent = params.contents;
            } else if (params.contents && params.contents.parts) {
                // Flatten parts to string if possible (WebLLM is text-only usually)
                userContent = params.contents.parts.map((p: any) => p.text || "").join(" ");
            } else if (Array.isArray(params.contents)) {
                 userContent = params.contents.map((c: any) => c.parts?.[0]?.text || "").join(" ");
            }

            // If config has system instruction, prepend it
            if (params.config?.systemInstruction) {
                messages.unshift({ role: "system", content: params.config.systemInstruction });
            }

            // Add the main user prompt
            if (userContent) {
                // IMPORTANT: If we expect JSON, force it in the prompt for local models
                if (params.config?.responseMimeType === 'application/json') {
                    userContent += "\n\nRespond strictly in valid JSON format.";
                }
                messages.push({ role: "user", content: userContent });
            }

            const response = await mlcEngine.chat.completions.create({
                messages,
                temperature: params.config?.temperature || 0.7,
                top_p: params.config?.topP || 0.95,
                // WebLLM doesn't support json_mode universally yet, relying on prompt
            });

            const outputText = response.choices[0]?.message?.content || "";
            trackTokens(JSON.stringify(messages), outputText, category);
            
            return { text: outputText };

        } catch (e: any) {
            return { text: `### WebLLM Error\nError generating content: ${e.message}` };
        }
    }

    // --- GEMINI PROVIDER (DEFAULT) ---
    const geminiKey = getValidKeyForProvider('gemini');

    if (!geminiKey) {
        return { text: `### No AI Provider Configured\nPlease go to Settings > AI Configuration to add a valid Gemini API key or load a WebLLM model.` };
    }
    
    try {
        const ai = new GoogleGenAI({ apiKey: geminiKey.key });
        const result = await ai.models.generateContent(params);
        
        // Track tokens
        const inputStr = typeof params.contents === 'string' ? params.contents : JSON.stringify(params.contents);
        const outputStr = result.text || "";
        trackTokens(inputStr, outputStr, category);

        return { ...result, text: result.text };
    } catch (e: any) {
        const isRateLimitError = e.message?.includes('429') || e.message?.toLowerCase().includes('quota');
        if (isRateLimitError) {
            return { text: `### Gemini API Error: Rate Limit Exceeded\nYour request has been rate-limited by Gemini.\n\n**Details:**\n- Please wait a few moments and try again, or check your Gemini plan and billing details.\n- To monitor usage, visit: https://ai.dev/usage` };
        }
        return { text: `### AI Provider Error\nCould not get a response from Gemini.\n\n**Details:**\n- Error: \`${e.message}\`\n\n**Troubleshooting:**\n1. Check your internet connection and Gemini API key validity.` };
    }
}

// --- OPTIMIZED CONTEXT HELPERS ---

/**
 * intelligently summarizes or truncates a project's chapters to fit into LLM context
 * without causing crashes on massive manuscripts.
 */
function getEfficientProjectContext(project: NovelProject): string {
    const isLocal = currentSettings.activeProvider === 'webllm';
    
    // WebLLM typically has 4k-8k context. Be very aggressive.
    const maxCharsPerChapter = isLocal ? 1000 : 4000;
    
    return project.chapters.map(c => {
        let content = c.content;
        
        if (c.content.length > maxCharsPerChapter) {
            if (c.summary) {
                // Very aggressive truncation for local
                const excerptLen = isLocal ? 200 : 1000;
                content = `(Summary): ${c.summary}\n(Excerpt): ${c.content.substring(0, excerptLen)}...`;
            } else {
                const head = isLocal ? 500 : 1500;
                const tail = isLocal ? 200 : 1500;
                content = `${c.content.substring(0, head)}\n...[omitted]...\n${c.content.substring(c.content.length - tail)}`;
            }
        }
        
        return `### ${c.title}\n${content}`;
    }).join('\n\n');
}

/**
 * Batches items to prevent timeouts or context overflows.
 */
async function runBatchedAnalysis<T, R = T[]>(
    items: any[],
    batchSize: number,
    processor: (batch: any[]) => Promise<T[]>,
    merger: (results: T[][]) => R
): Promise<R> {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    const results: T[][] = [];
    for (const batch of batches) {
        try {
            const batchResult = await processor(batch);
            results.push(batchResult);
            // Small delay to prevent rate limits or browser freeze
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.warn("Batch failed", e);
        }
    }
    return merger(results);
}


// --- CORE AI FUNCTIONS ---

export async function sendChatMessage(messages: AIChatMessage[], text: string, currentContext: string, activePersona?: AIAgent | Character): Promise<string> {
    const systemInstruction = (activePersona && 'systemPrompt' in activePersona) ? activePersona.systemPrompt : undefined;
    // Truncate context if it's absurdly large for a chat
    const limit = currentSettings.activeProvider === 'webllm' ? 4000 : 30000;
    const safeContext = currentContext.length > limit ? currentContext.substring(0, limit) + "... [truncated]" : currentContext;
    
    const prompt = `Context:\n${safeContext}\n\nUser: ${text}`;
    
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: prompt, history: messages, config: { systemInstruction } }, 'chat');
    return result.text || "I'm sorry, I couldn't generate a response.";
}

export async function analyzeText(text: string, project?: NovelProject): Promise<AnalysisResult | null> {
    // Shorter text segment for local analysis
    const limit = currentSettings.activeProvider === 'webllm' ? 8000 : 50000;
    const safeText = text.substring(0, limit); 
    const prompt = `Analyze the following text from a ${project?.genre} novel. Provide a quality score (1-100), suggestions for improvement, and identify any issues. Respond in JSON format: { "qualityScore": number, "suggestions": string[], "issues": {"type": string, "description": string, "severity": string}[], "bestsellerComparison": { "verdict": string }, "heuristics": { "dialogueRatio": number, "adverbRate": number, "sentenceVarietyScore": number, "repetitiveStarts": number } }`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nTEXT:\n${safeText}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    const parsed = extractJSON<AnalysisResult>(result.text);
    if (!parsed) {
        if (result.text && result.text.toLowerCase().includes('error')) {
            throw new Error(`AI analysis returned an error: ${result.text}`);
        }
        throw new Error("analyzeText failed to get valid JSON.");
    }
    return parsed;
}

export async function generateSceneStructure(context: string, genre: string): Promise<SceneBeat[] | null> {
    const limit = currentSettings.activeProvider === 'webllm' ? 8000 : 30000;
    const prompt = `Analyze the following scene from a ${genre} story and break it down into structural scene beats. Respond in JSON format: { "beats": [{ "type": string, "description": string, "status": "strong" | "weak" | "missing", "suggestion"?: string }] }`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nSCENE:\n${context.substring(0, limit)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    const parsed = extractJSON<{ beats: SceneBeat[] }>(result.text);
    return parsed?.beats || null;
}

export async function generateBetaReaderFeedback(context: string, persona: BetaReaderPersona): Promise<BetaReaderFeedback> {
    const limit = currentSettings.activeProvider === 'webllm' ? 8000 : 30000;
    const prompt = `You are an AI simulating a beta reader with the following persona: ${persona.description}. Read the following chapter and provide feedback. Respond in JSON format: { "reaction": string, "rating": number (1-5), "quote": string, "emotion": string }`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nCHAPTER:\n${context.substring(0, limit)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    const feedback = extractJSON<Omit<BetaReaderFeedback, 'readerId'>>(result.text);
    if (!feedback) {
        return { readerId: persona.id, reaction: "Error: AI failed to provide feedback.", rating: 1, quote: "", emotion: "Confused" };
    }
    return { ...feedback, readerId: persona.id } as BetaReaderFeedback;
}

export async function applyBrush(selection: string, action: string): Promise<string> {
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `Apply this action: "${action}" to the following text and return only the modified text:\n\n${selection}` }, 'writing');
    return result.text || selection;
}

export async function generateChapterContent(title: string, prevContent: string, styleGuide: string, genre: string, storyBible: string): Promise<string> {
    const prompt = `Write a chapter titled "${title}" for a ${genre} novel. The style is: ${styleGuide}. The previous chapter ended with: ${prevContent.slice(-1000)}. World info: ${storyBible}.`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: prompt }, 'writing');
    return result.text || "";
}

export async function analyzeSelection(selection: string): Promise<string> {
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `Briefly analyze this text: ${selection}` }, 'analysis');
    return result.text || "Could not analyze.";
}

export async function generateSpeech(text: string): Promise<string | null> {
    // Force Gemini for Speech
    const key = getValidKeyForProvider('gemini');
    if (!key) throw new Error("TTS requires Gemini API key");
    const ai = new GoogleGenAI({ apiKey: key.key });
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
        });
        
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (e) {
        console.error("TTS Error", e);
        return null;
    }
}

export async function playAudio(base64Audio: string): Promise<void> {
    if(!base64Audio) return;
    const ctx = SoundManager.getInstance().getOutputContext();
    await SoundManager.getInstance().resumeOutput();
    
    const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        ctx,
        24000,
        1
    );
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
}

export async function injectSensoryDetail(selection: string, sense: string): Promise<string> {
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `Rewrite this text to include more sensory details related to "${sense}":\n\n${selection}` }, 'writing');
    return result.text || selection;
}

export async function performDeepLineEdit(text: string, project: NovelProject, instructions: string): Promise<string> {
    const limit = currentSettings.activeProvider === 'webllm' ? 8000 : 50000;
    const prompt = `You are a developmental editor. Edit the following text from "${project.title}" (${project.genre}). Instructions: "${instructions}". Keep plot same, improve prose. Context: ${project.storyBible}\n\nText:\n${text.substring(0, limit)}`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: prompt }, 'writing');
    return result.text || text;
}

export async function extractWorldInfo(storyBible: string): Promise<{ characters: Partial<Character>[], worldItems: Partial<WorldItem>[] }> {
    const prompt = `Extract characters and world items from this story bible. Respond in JSON: { "characters": [{ "name": string, "role": string, "description": string, "traits": string[] }], "worldItems": [{ "name": string, "category": string, "description": string }] }`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nBIBLE:\n${storyBible}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON(result.text) || { characters: [], worldItems: [] };
}

export async function processManuscriptImport(text: string): Promise<{ chapters: Chapter[], characters: Character[], worldItems: WorldItem[] }> {
    // 1. Fallback for Massive Files or Local LLM: Heuristic Regex Split
    if (text.length > 50000 || currentSettings.activeProvider === 'webllm') {
        console.log("Large file or local LLM detected, attempting heuristic split first.");
        const chapterRegex = /(?:^|\n)(?:Chapter|Book|Part|Prologue|Epilogue)\s+\d+(?:[:\.]\s*[^\n]+)?/gi;
        const splits = text.split(chapterRegex);
        const titles = text.match(chapterRegex);
        
        if (splits.length > 1 && titles && titles.length === splits.length - 1) {
             const chapters: Chapter[] = titles.map((title, i) => ({
                id: uuidv4(),
                title: title.trim(),
                content: splits[i + 1].trim(),
                wordCount: splits[i + 1].split(/\s+/).filter(Boolean).length,
                lastModified: Date.now()
            }));
            
            // Analyze sample for characters/items
            const sampleText = chapters.slice(0, 3).map(c => c.content.substring(0, 2000)).join('\n');
            const extraction = await extractWorldInfo(sampleText);
            
            return { 
                chapters, 
                characters: extraction.characters.map(c => ({...c, id: uuidv4()})) as any, 
                worldItems: extraction.worldItems.map(w => ({...w, id: uuidv4()})) as any 
            };
        }
    }

    // 2. Default AI processing for smaller files on Gemini
    const prompt = `This is a full manuscript. Split it into chapters. For each chapter, provide a title and its content. Then, extract all major characters and world-building items. Respond in JSON: { "chapters": [{ "title": string, "content": string }], "characters": [{ "name": string, "role": string, "description": string, "traits": string[] }], "worldItems": [{ "name": string, "category": string, "description": string }] }`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: `${prompt}\n\nMANUSCRIPT:\n${text.substring(0, 100000)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    const data = extractJSON<{ chapters: any[], characters: any[], worldItems: any[] }>(result.text);
    const chapters = (data?.chapters || []).map(c => ({ ...c, id: uuidv4(), wordCount: (c.content || "").split(/\s+/).filter(Boolean).length, lastModified: Date.now() }));
    const characters = (data?.characters || []).map(c => ({ ...c, id: uuidv4() }));
    const worldItems = (data?.worldItems || []).map(wi => ({ ...wi, id: uuidv4() }));
    return { chapters, characters, worldItems };
}

export async function convertManuscriptFile(file: File): Promise<string> {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = e => reject(e);
        reader.readAsText(file);
    });
}

export async function smartRewriteChapter(content: string, suggestion: string, project: NovelProject, wordCount: number): Promise<string> {
    const limit = currentSettings.activeProvider === 'webllm' ? 8000 : 30000;
    const prompt = `Rewrite the following chapter based on this suggestion: "${suggestion}". The chapter is from the novel "${project.title}" (${project.genre}). Maintain word count around ${wordCount}. Context: ${project.storyBible}\n\nCHAPTER:\n${content.substring(0, limit)}`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: prompt }, 'writing');
    return result.text || content;
}

export async function analyzeCharacterRelationships(project: NovelProject, characterId: string): Promise<Relationship[]> {
    const character = project.characters.find(c => c.id === characterId);
    if (!character) return [];
    const context = getEfficientProjectContext(project);
    const prompt = `Analyze the relationships between "${character.name}" and other characters. Respond in JSON: { "relationships": [{ "targetName": string, "type": string, "description": string }] }`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: `${prompt}\n\nSUMMARY:\n${context}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<{ relationships: Relationship[] }>(result.text)?.relationships || [];
}

export async function generateVisualAnchor(description: string): Promise<string> {
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `Create a detailed visual description prompt for an AI image generator based on: "${description}"` }, 'media');
    return result.text || "";
}

export async function analyzeProjectHealth(project: NovelProject): Promise<ProjectHealth> {
    // Aggressive batching for local models
    const batchSize = currentSettings.activeProvider === 'webllm' ? 2 : 5;
    
    if (project.chapters.length > batchSize) {
        const results = await runBatchedAnalysis<any, ProjectHealth>(
            project.chapters, 
            batchSize,
            async (batch) => {
                const limit = currentSettings.activeProvider === 'webllm' ? 2000 : 5000;
                const prompt = `Analyze these chapters for character usage, POV, and pacing. Respond in JSON: { "characterUsage": [{"name": string, "count": number}], "povBalance": [{"name": string, "percentage": number}], "pacingMap": [{"title": string, "pacingScore": number, "tensionScore": number}], "globalIssues": string[] }`;
                const res = await generateAIContent({
                    model: 'gemini-2.5-flash',
                    contents: `${prompt}\n\nCHAPTERS:\n${JSON.stringify(batch.map(c => ({ title: c.title, content: c.content.substring(0, limit) })))}`,
                    config: { responseMimeType: 'application/json' }
                }, 'analysis');
                const json = extractJSON<any>(res.text);
                return json ? [json] : [];
            },
            (results) => {
                // Merge logic
                const merged: ProjectHealth = { characterUsage: [], povBalance: [], pacingMap: [], conflictProgression: [], globalIssues: [] };
                const charMap = new Map<string, number>();
                const povMap = new Map<string, number>();
                
                results.forEach((r: any) => {
                    const res = r[0]; 
                    if (!res) return;

                    (res.characterUsage || []).forEach((c: any) => charMap.set(c.name, (charMap.get(c.name) || 0) + c.count));
                    (res.povBalance || []).forEach((p: any) => povMap.set(p.name, (povMap.get(p.name) || 0) + p.percentage));
                    if(res.pacingMap) merged.pacingMap.push(...res.pacingMap);
                    if(res.globalIssues) merged.globalIssues.push(...res.globalIssues);
                });
                
                merged.characterUsage = Array.from(charMap.entries()).map(([name, count]) => ({ name, count }));
                // Average POV
                merged.povBalance = Array.from(povMap.entries()).map(([name, total]) => ({ name, percentage: Math.round(total / results.length) }));
                merged.globalIssues = [...new Set(merged.globalIssues)]; // Dedupe
                return merged;
            }
        );
        return results;
    }

    const prompt = `Analyze the manuscript for health: character usage, POV, pacing, and global issues. Respond in JSON: { "characterUsage": [{"name": string, "count": number}], "povBalance": [{"name": string, "percentage": number}], "pacingMap": [{"chapterId": string, "title": string, "pacingScore": number, "tensionScore": number}], "globalIssues": string[] }`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: `${prompt}\n\nPROJECT:\n${getEfficientProjectContext(project)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<ProjectHealth>(result.text) || {} as ProjectHealth;
}

export async function analyzeContinuity(project: NovelProject): Promise<ContinuityIssue[]> {
    const batchSize = currentSettings.activeProvider === 'webllm' ? 3 : 10;
    return await runBatchedAnalysis<ContinuityIssue>(
        project.chapters,
        batchSize,
        async (batch) => {
             const prompt = `Analyze these chapters for continuity errors. Respond in JSON: { "issues": [{"type": string, "description": string, "location": string, "severity": "low" | "medium" | "high"}] }`;
             const res = await generateAIContent({
                 model: 'gemini-3-pro-preview',
                 contents: `${prompt}\n\nCONTENT:\n${batch.map(c => c.content.substring(0, 3000)).join('\n\n')}`,
                 config: { responseMimeType: 'application/json' }
             }, 'analysis');
             return extractJSON<{ issues: ContinuityIssue[] }>(res.text)?.issues || [];
        },
        (results) => results.flat()
    );
}

export async function generateSynopsis(project: NovelProject): Promise<SynopsisAnalysis> {
    const prompt = `Generate a logline and a full synopsis for the novel. Respond in JSON: { "logline": string, "fullSynopsis": string }`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: `${prompt}\n\nMANUSCRIPT:\n${getEfficientProjectContext(project)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<SynopsisAnalysis>(result.text) || { logline: '', fullSynopsis: '' };
}

export async function analyzeThemesAndPlot(project: NovelProject): Promise<{ plotThreads: PlotThread[], subplots: Subplot[], foreshadowing: ForeshadowingOpportunity[] }> {
    const prompt = `Analyze the plot. Identify plot threads, subplots, and foreshadowing. Respond in JSON: { "plotThreads": [...], "subplots": [...], "foreshadowing": [...] }`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: `${prompt}\n\nMANUSCRIPT:\n${getEfficientProjectContext(project)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON(result.text) || { plotThreads: [], subplots: [], foreshadowing: [] };
}

export async function analyzeTrilogyCohesion(project: NovelProject): Promise<TrilogyCohesionReport> {
    const context = getEfficientProjectContext(project);
    const prompt = `Analyze this trilogy for cohesion issues (naming, timeline, plot flow). Respond in JSON: { "namingIssues": [...], "timelineIssues": [...], "flowAnalysis": { "book1to2": string, "book2to3": string, "overallArc": string } }`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: `${prompt}\n\nSKELETON:\n${context}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<TrilogyCohesionReport>(result.text) || {} as TrilogyCohesionReport;
}

export async function generateNextChapterAgent(project: NovelProject, instructions: string, targetChapterTitle: string, allProjects?: Project[], wordCount?: number, isPolish?: boolean): Promise<{ title: string, content: string }> {
    const prompt = `You are a ghostwriter. ${isPolish ? 'Polish' : 'Write'} the chapter "${targetChapterTitle}" for the novel "${project.title}". Instructions: ${instructions}. Word count: ${wordCount}. Context: ${project.storyBible}. Previous chapters summary...`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: prompt }, 'writing');
    return { title: targetChapterTitle, content: result.text || "" };
}

export async function performResearch(query: string): Promise<string> {
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `Perform a quick research on: ${query}.`, config: { tools: [{ googleSearch: {} }] } }, 'analysis');
    return result.text || "No results found.";
}

export async function generateImage(prompt: string, aspectRatio: string, quality?: string): Promise<string> {
    // FORCE GEMINI FOR IMAGE GENERATION (WebLLM is text-only)
    const geminiKey = getValidKeyForProvider('gemini');
    if (!geminiKey) throw new Error("A Gemini API key is required for image generation (WebLLM is text-only).");
    const ai = new GoogleGenAI({ apiKey: geminiKey.key });
    
    const result = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: prompt, config: { imageConfig: { aspectRatio } } });
    trackTokens(prompt, "image-gen", 'media');
    
    const imagePart = result.response?.candidates?.[0]?.content.parts.find((p: any) => p.inlineData);
    return imagePart ? `data:image/png;base64,${imagePart.inlineData.data}` : "";
}

export async function editImage(image: string, prompt: string): Promise<string> {
    const geminiKey = getValidKeyForProvider('gemini');
    if (!geminiKey) throw new Error("A Gemini API key is required for image editing.");
    const ai = new GoogleGenAI({ apiKey: geminiKey.key });

    const base64Data = image.split(',')[1];
    const result = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Data } }, { text: prompt }] } });
    trackTokens(prompt, "image-edit", 'media');

    const imagePart = result.response?.candidates?.[0]?.content.parts.find((p: any) => p.inlineData);
    return imagePart ? `data:image/png;base64,${imagePart.inlineData.data}` : "";
}

export async function generateVideo(prompt: string, aspectRatio: string, image?: string): Promise<any> {
    const geminiKey = getValidKeyForProvider('gemini');
    if (!geminiKey) throw new Error("A Gemini API key is required for video generation.");
    const ai = new GoogleGenAI({ apiKey: geminiKey.key });
    trackTokens(prompt, "video-generated", 'media'); // Estimate
    const imagePayload = image ? { imageBytes: image.split(',')[1], mimeType: 'image/png' } : undefined;
    return await ai.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', prompt, image: imagePayload, config: { aspectRatio, numberOfVideos: 1, resolution: '720p' } });
}

export async function extendVideo(video: any, prompt: string): Promise<any> {
    if (!video) throw new Error("Previous video data is required to extend.");
    const geminiKey = getValidKeyForProvider('gemini');
    if (!geminiKey) throw new Error("A Gemini API key is required for video generation.");
    const ai = new GoogleGenAI({ apiKey: geminiKey.key });
    trackTokens(prompt, "video-extended", 'media');
    return await ai.models.generateVideos({ model: 'veo-3.1-generate-preview', prompt, video, config: { numberOfVideos: 1, resolution: '720p', aspectRatio: video.aspectRatio }});
}

export async function analyzeMedia(image: string): Promise<MediaAnalysisResultType> {
    const geminiKey = getValidKeyForProvider('gemini');
    if (!geminiKey) throw new Error("A Gemini API key is required for media analysis.");
    const ai = new GoogleGenAI({ apiKey: geminiKey.key });

    const base64Data = image.split(',')[1];
    const result = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Data } }, { text: "Analyze this image." }] } });
    trackTokens("image-analysis", result.response?.text() || "", 'media');
    return { description: result.response?.text() || "", tags: [], insights: "" };
}

export async function getVideosOperation(operation: any): Promise<any> {
    const geminiKey = getValidKeyForProvider('gemini');
    if (!geminiKey) throw new Error("A Gemini API key is required for video operations.");
    const ai = new GoogleGenAI({ apiKey: geminiKey.key });
    return await ai.operations.getVideosOperation({ operation });
}

export async function generateBookCoverConcepts(project: NovelProject, ageGroup: string, artStyle: string, themePrompt: string): Promise<string[]> {
    const prompt = `Generate 4 book cover art concepts for a ${ageGroup} ${project.genre} novel titled "${project.title}". The style is ${artStyle}. Core theme: ${themePrompt || project.synopsis}. No text on the image.`;
    const images = await Promise.all(Array(4).fill(0).map(() => generateImage(prompt, '3:4')));
    return images.filter(Boolean);
}

export async function extractViralMoments(project: NovelProject): Promise<ViralMoment[]> {
    const prompt = `Identify the most visually striking, emotionally impactful, or "viral" moments from this manuscript suitable for promotional images. Respond in JSON: { "moments": [{ "description": string, "prompt": string }] }`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: `${prompt}\n\nMANUSCRIPT:\n${getEfficientProjectContext(project)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<{ moments: ViralMoment[] }>(result.text)?.moments || [];
}

export async function generateColoringBookPages(project: NovelProject, pageCount: number, onProgress: (progress: string) => void): Promise<ColoringPage[]> {
    const pages: ColoringPage[] = [];
    const promptBase = `Create a beautiful, intricate, black and white coloring book page in a line art style.`;
    for (let i = 0; i < pageCount; i++) {
        onProgress(`Generating page ${i+1}/${pageCount}`);
        const scenePrompt = `based on a scene from the novel "${project.title}". Scene description: ${project.chapters[i % project.chapters.length].summary || project.synopsis}`;
        const imageUrl = await generateImage(`${promptBase} ${scenePrompt}`, '4:3');
        pages.push({ id: uuidv4(), imageUrl, caption: `Page ${i+1}`, prompt: `${promptBase} ${scenePrompt}` });
    }
    return pages;
}

export async function generateColoringBookFromTheme(project: ColoringBookProject, onProgress: (progress: string) => void): Promise<ColoringPage[]> {
    const pages: ColoringPage[] = [];
    const pageCount = project.pageCount || 12;
    for (let i = 0; i < pageCount; i++) {
        onProgress(`Generating page ${i+1}/${pageCount} for theme: ${project.theme}`);
        const prompt = `Create a beautiful, intricate, black and white coloring book page in a ${project.style} style, based on the theme "${project.theme}".`;
        const imageUrl = await generateImage(prompt, '4:3');
        pages.push({ id: uuidv4(), imageUrl, caption: `${project.theme} - Page ${i+1}`, prompt });
    }
    return pages;
}

export async function generateMarketingCopy(project: NovelProject): Promise<any> {
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `Generate marketing copy (blurbs, ad copy, social posts) for a novel titled "${project.title}". Synopsis: ${project.synopsis}` }, 'writing');
    return { blurbs: [result.text], adCopy: [], socialPosts: [] };
}

export async function generateAudienceProfile(project: NovelProject): Promise<AudienceProfile> {
    const prompt = `Create a target audience profile for the novel "${project.title}". Include demographics, psychographics, comp titles, and hashtags. Respond in JSON.`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nSYNOPSIS: ${project.synopsis}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<AudienceProfile>(result.text) || {} as AudienceProfile;
}

export async function generateLaunchCampaign(project: NovelProject): Promise<ScheduledPost[]> {
    const prompt = `Create a 5-day social media launch campaign for the novel "${project.title}". Respond in JSON with an array of posts, each with platform, content, and hashtags.`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nSYNOPSIS: ${project.synopsis}`, config: { responseMimeType: 'application/json' } }, 'writing');
    return extractJSON<ScheduledPost[]>(result.text) || [];
}

export async function generateMediaKit(project: NovelProject): Promise<string> {
    const prompt = `Generate a professional media kit for the novel "${project.title}". Include a compelling pitch, author bio, and key selling points. SYNOPSIS: ${project.synopsis}. AUTHOR: ${project.author}`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: prompt }, 'writing');
    return result.text || "";
}

export async function discoverTrends(niche: string): Promise<TrendingTopic[]> {
    const prompt = `Find trending topics related to "${niche}". Respond in JSON with an array of topics with volume and relevance.`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', tools: [{ googleSearch: {} }] } }, 'analysis');
    return extractJSON<TrendingTopic[]>(result.text) || [];
}

export async function generateSEOArticle(topic: string, keywords: string[], audience: string): Promise<{ content: string, score: SEOScore }> {
    const prompt = `Write an SEO-optimized article about "${topic}" for a ${audience} audience, using keywords like ${keywords.join(', ')}.`;
    const content = (await generateAIContent({ model: 'gemini-3-pro-preview', contents: prompt }, 'writing')).text || "";
    return { content, score: { score: 85, keywordDensity: 2, readability: 'Good', suggestions: [], metaDescription: '', slug: '' } };
}

export async function repurposeContent(content: string, platforms: SocialPlatform[]): Promise<MarketingPost[]> {
    const prompt = `Repurpose this article into social media posts for these platforms: ${platforms.join(', ')}. Respond in JSON: { "posts": [{"platform": string, "content": string, "hashtags": string[]}] }`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nARTICLE:\n${content.substring(0, 10000)}`, config: { responseMimeType: 'application/json' } }, 'writing');
    return extractJSON<{ posts: MarketingPost[] }>(result.text)?.posts || [];
}

export async function generatePlatformSpecificCampaign(project: NovelProject, platforms: SocialPlatform[]): Promise<ScheduledPost[]> {
    const prompt = `Generate a 3-post launch campaign for the novel "${project.title}" (${project.genre}), specifically tailored for these platforms: ${platforms.join(', ')}. Respond in JSON: { "posts": [{"platform": string, "content": string, "hashtags": string[]}] }`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: prompt, config: { responseMimeType: 'application/json' } }, 'writing');
    return (extractJSON<{ posts: MarketingPost[] }>(result.text)?.posts || []).map(p => ({ ...p, id: uuidv4(), status: 'draft' }));
}

export async function generateListingOptimization(project: NovelProject, keywords: string[]): Promise<ListingOptimization> {
    const prompt = `Generate an optimized Amazon KDP listing for the novel "${project.title}". Include 3 title/subtitle suggestions and a compelling HTML-formatted book description using keywords: ${keywords.join(', ')}. Respond in JSON.`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: prompt, config: { responseMimeType: 'application/json' } }, 'writing');
    return extractJSON<ListingOptimization>(result.text) || {} as ListingOptimization;
}

export class LiveClient {
    private session: Promise<any> | null = null;
    private mediaStream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;

    async connect(onMessage: (msg: any) => void, onError: (e: any) => void, onClose: (e: any) => void) {
        const key = getValidKeyForProvider('gemini');
        if (!key) {
            onError(new Error("No valid Gemini API key found."));
            return;
        }
        const ai = new GoogleGenAI({ apiKey: key.key });

        this.session = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
                inputAudioTranscription: {},
            },
            callbacks: {
                onopen: async () => {
                    console.log("Live Session Opened");
                    await this.startAudioInput();
                },
                onmessage: (msg) => {
                    onMessage(msg);
                },
                onclose: (e) => {
                    this.stopAudioInput();
                    onClose(e);
                },
                onerror: (e) => {
                    console.error("Live Session Error", e);
                    onError(e);
                }
            }
        });
    }

    private async startAudioInput() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                if (this.session) {
                    this.session.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                }
            };

            this.source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
        } catch (e) {
            console.error("Failed to start audio input", e);
        }
    }

    private stopAudioInput() {
        this.mediaStream?.getTracks().forEach(t => t.stop());
        this.processor?.disconnect();
        this.source?.disconnect();
        this.audioContext?.close();
    }

    disconnect() {
        if (this.session) {
            this.session.then(s => s.close());
        }
        this.stopAudioInput();
        this.session = null;
    }
    
    send(data: any) {
        // Placeholder for future text/tool input
    }
}

export async function generateJournalPrompts(topic: string): Promise<string[]> {
    const prompt = `Generate 5 creative and insightful journal prompts related to "${topic}". They should be open-ended and encourage reflection.`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: prompt }, 'writing');
    return result.text?.split('\n').filter(p => p.trim().match(/^\d+\.\s/)).map(p => p.replace(/^\d+\.\s/, '')) || [];
}

export async function illustrateDreamEntry(dream: string): Promise<string> {
    const prompt = `Create a surreal, dreamlike, ethereal illustration based on this dream journal entry: "${dream}"`;
    return generateImage(prompt, '1:1');
}

export async function generateStickerFromPrompt(prompt: string): Promise<string> {
    const stickerPrompt = `A cute, cartoon sticker with a thick white border, die-cut style. The sticker shows: ${prompt}.`;
    return generateImage(stickerPrompt, '1:1');
}

export async function summarizeChapter(content: string): Promise<string> {
    const limit = currentSettings.activeProvider === 'webllm' ? 3000 : 8000;
    const prompt = `Summarize this chapter in 2-3 sentences, focusing on the key plot points.`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nCHAPTER:\n${content.substring(0, limit)}` }, 'analysis');
    return result.text || "";
}

export async function generateSeriesOutline(project: NovelProject, volumes: any[]): Promise<BookOutline[]> {
    const prompt = `Expand this single manuscript into a trilogy outline. Here are the planned volumes: ${JSON.stringify(volumes)}. Expand the plot, add subplots, and flesh out the story across three books. Respond in JSON: [{ "title": string, "chapters": [{ "title": string, "plotSummary": string }] }]`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: `${prompt}\n\nMANUSCRIPT:\n${getEfficientProjectContext(project)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<BookOutline[]>(result.text) || [];
}

export async function generateGlobalEdits(project: NovelProject, onProgress: (progressText: string) => void, onSuggestionFound: (suggestion: GlobalEditSuggestion) => void): Promise<void> {
    const limit = currentSettings.activeProvider === 'webllm' ? 2000 : 8000;
    for (const chapter of project.chapters) {
        onProgress(`Analyzing ${chapter.title}...`);
        const prompt = `Analyze this chapter for global edits (prose, pacing, consistency) and suggest one specific change. Respond in JSON: { "originalText": string, "suggestedText": string, "rationale": string, "type": "prose" | "pacing" | "consistency" | "dialogue" | "plot" }`;
        const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: `${prompt}\n\nCHAPTER:\n${chapter.content.substring(0,limit)}`, config: { responseMimeType: 'application/json' } }, 'analysis');
        const suggestion = extractJSON<Omit<GlobalEditSuggestion, 'id' | 'chapterId' | 'chapterTitle'>>(result.text);
        if (suggestion && suggestion.originalText) {
            onSuggestionFound({ ...suggestion, id: uuidv4(), chapterId: chapter.id, chapterTitle: chapter.title });
        }
        await new Promise(r => setTimeout(r, 500)); // Rate limit buffer
    }
}

export async function chatWithArtifacts(history: AIChatMessage[], input: string, project: Project, activeArtifact?: Artifact): Promise<ReadableStream<any>> {
    trackTokens(input, "stream-response", 'chat'); // Approximation
    
    const context = activeArtifact ? `User is asking about this artifact: ${activeArtifact.title}\n\n${activeArtifact.content}` : "";
    const systemInstruction = `You are Muse, an AI assistant for authors. You can write code or text. When writing code, wrap it in <antArtifact> tags.`;
    
    if (currentSettings.activeProvider === 'webllm') {
        // Fallback for streaming with WebLLM is complex; for now, we just do a single generation and mock a stream
        const response = await generateAIContent({
            model: 'gemini-2.5-flash',
            contents: `${context}\n\n${input}`,
            history,
            config: { systemInstruction }
        }, 'chat');
        
        const text = response.text || "";
        return new ReadableStream({
            start(controller) {
                controller.enqueue({ text });
                controller.close();
            }
        });
    }

    // Default Gemini Streaming
    const key = getValidKeyForProvider('gemini');
    if (!key) throw new Error("Gemini key required for streaming chat.");
    const ai = new GoogleGenAI({ apiKey: key.key });
    
    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: `${context}\n\n${input}`,
        config: { systemInstruction }
    });

    return new ReadableStream({
        async start(controller) {
            for await (const chunk of stream) {
                controller.enqueue({ text: chunk.text });
            }
            controller.close();
        }
    });
}

export async function generateWebsiteFromBook(project: NovelProject): Promise<string> {
    const prompt = `Generate a single-page HTML website for the novel "${project.title}". Use TailwindCSS for styling. Include sections for synopsis, characters, and author bio. The response must be only the HTML code.`;
    const result = await generateAIContent({ model: 'gemini-3-pro-preview', contents: prompt }, 'media');
    return result.text || "";
}

export function generateFormattedBookHTML(project: NovelProject, settings: BookFormatSettings, bookNumber?: 1 | 2 | 3): string {
    const chaptersToFormat = bookNumber ? project.chapters.filter(c => c.title.startsWith(`Book ${bookNumber}:`)) : project.chapters;
    let html = `<html><head><style>
        body { font-family: "${settings.fontFamily}", serif; font-size: ${settings.fontSize}pt; line-height: ${settings.lineHeight}; }
        h1, h2 { text-align: center; }
        p { text-indent: 1.5em; margin: 0; }
        .break { text-align: center; padding: 1em 0; }
    </style></head><body>`;
    if (settings.includeTitlePage) {
        html += `<h1>${project.title}</h1><h2>by ${project.author}</h2><div style="page-break-after: always;"></div>`;
    }
    for (const chapter of chaptersToFormat) {
        html += `<h2>${chapter.title.replace(/Book \d+: /,'')}</h2><p>${chapter.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p><div style="page-break-after: always;"></div>`;
    }
    html += '</body></html>';
    return html;
}

export async function analyzeKeywords(query: string): Promise<KeywordAnalysis[]> {
    const prompt = `Analyze Amazon KDP keywords for "${query}". Provide search volume, competition, and earnings potential for 5 related keywords. Respond in JSON.`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<KeywordAnalysis[]>(result.text) || [];
}

export async function analyzeCompetitor(query: string): Promise<CompetitorAnalysis | null> {
    const prompt = `Analyze this Amazon KDP competitor: "${query}". Provide title, author, estimated monthly sales, primary keywords, and top categories. Respond in JSON.`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', tools: [{ googleSearch: {} }] } }, 'analysis');
    return extractJSON<CompetitorAnalysis>(result.text);
}

export async function findNicheCategories(query: string): Promise<CategoryAnalysis[]> {
    const prompt = `Find 5 niche Amazon KDP categories for a book about "${query}". For each, provide the category name, full path, and estimated sales needed per day to become a bestseller. Respond in JSON.`;
    const result = await generateAIContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } }, 'analysis');
    return extractJSON<CategoryAnalysis[]>(result.text) || [];
}

export async function runTrilogyDoctor(project: NovelProject, onProgress: (progressText: string) => void, onIssueFound: (issue: TrilogyIssueAndFix) => void): Promise<void> {
    // This is a simulation for demonstration, as full trilogy doctoring is complex. 
    // In a real implementation, this would use `runBatchedAnalysis` over the entire trilogy content.
    onProgress("Scanning for major plot holes...");
    await new Promise(res => setTimeout(res, 1000));
    
    // Fallback Mock Logic if no AI response (or just to show UI functionality)
    onIssueFound({
        id: uuidv4(),
        type: 'Plot Hole',
        description: "The main character's magical sword, which was destroyed in Book 1, reappears in Book 3 without explanation.",
        chaptersInvolved: [{ chapterId: '1', chapterTitle: 'Book 1: The Final Battle' }, { chapterId: '2', chapterTitle: 'Book 3: The Return' }],
        suggestedFix: "Add a scene in Book 2 or early Book 3 where the character forges a new, similar-looking sword, or finds a way to repair the original."
    });
    
    onProgress("Analyzing character arcs across all books...");
    await new Promise(res => setTimeout(res, 1000));
}