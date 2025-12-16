import { GoogleGenAI, Type } from "@google/genai";
import { Project, AnalysisResult, ProjectHealth, MediaAnalysisResult, JournalProject, AISettings, SceneBeat, AudienceProfile, MarketingPost, NovelProject, ContinuityIssue, BetaReaderFeedback, BetaReaderPersona, Relationship, TrendingTopic, SEOScore, AIAgent, GlobalEditSuggestion, AIChatMessage, Character, Chapter, Artifact, ScheduledPost, KeywordAnalysis, CompetitorAnalysis, CategoryAnalysis, BookFormatSettings, StoryAnalysis, Subplot, PlotThread, ForeshadowingOpportunity, ViralMoment, ColoringPage, ColoringBookProject, SocialPlatform, ListingOptimization, TrilogyCohesionReport, JournalPage, ApiKey, AnalysisIssue, TrilogyIssueAndFix, SynopsisAnalysis, MediaAnalysisResult as MediaAnalysisResultType, ProjectHealth as ProjectHealthType, ContinuityIssue as ContinuityIssueType, TrilogyCohesionReport as TrilogyCohesionReportType, BookOutline, WorldItem } from "../types";
import mammoth from 'mammoth';
import { getEncoding } from 'js-tiktoken';
import { v4 as uuidv4 } from 'uuid';
import { retryWithBackoff } from '../utils/helpers';

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

export async function generateBookCoverConcepts(project: NovelProject, ageGroup: string, artStyle: string, themePrompt: string): Promise<string> {
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

export async function generateJournalPrompts(topic: string): Promise<string> {
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

                                       
                                       // ===== STORY-AWARENESS FEATURES FOR TRILOGY SPLITTING =====

// Extract character database with appearances and arcs
export async function extractCharacterDatabase(project: NovelProject): Promise<{ id: string, name: string, role: string, appearances: string[], arcSummary: string }[]> {
  const prompt = `Extract all characters from this manuscript. For each character, provide:
  1. Name
  2. Role (protagonist, antagonist, supporting, etc.)
  3. List of chapter titles where they appear
  4. Brief summary of their character arc
  
  Respond in JSON: { "characters": [{ "name": string, "role": string, "appearances": string[], "arcSummary": string }] }`;
  
  const context = getEfficientProjectContext(project);
  const result = await generateAIContent({
    model: 'gemini-3-pro-preview',
    contents: `${prompt}\n\nMANUSCRIPT:\n${context}`,
    config: { responseMimeType: 'application/json' }
  }, 'analysis');
  
  const parsed = extractJSON<{ characters: any[] }>(result.text);
  return (parsed?.characters || []).map(c => ({ ...c, id: uuidv4() }));
}

// Extract worldbuilding database with locations, rules, and lore
export async function extractWorldbuildingDatabase(project: NovelProject): Promise<{ id: string, name: string, type: string, description: string, rulesOrConstraints?: string }[]> {
  const prompt = `Extract all worldbuilding elements from this manuscript:
  - Locations (cities, buildings, etc.)
  - Magic systems or technology
  - Important objects or artifacts
  - Social structures or factions
  - Rules or constraints of the world
  
  Respond in JSON: { "worldElements": [{ "name": string, "type": "location" | "magic" | "tech" | "object" | "faction" | "rule", "description": string, "rulesOrConstraints"?: string }] }`;
  
  const context = getEfficientProjectContext(project);
  const result = await generateAIContent({
    model: 'gemini-3-pro-preview',
    contents: `${prompt}\n\nMANUSCRIPT:\n${context}`,
    config: { responseMimeType: 'application/json' }
  }, 'analysis');
  
  const parsed = extractJSON<{ worldElements: any[] }>(result.text);
  return (parsed?.worldElements || []).map(w => ({ ...w, id: uuidv4() }));
}

// Generate chapter synopses with timeline stamps
export async function generateChapterSynopsesWithTimeline(project: NovelProject, onProgress: (progressText: string) => void): Promise<{ chapterId: string, synopsis: string, timelineStamp: string, charactersPresent: string[], plotBeats: string[] }[]> {
  const synopses: any[] = [];
  
  for (let i = 0; i < project.chapters.length; i++) {
    const chapter = project.chapters[i];
    onProgress(`Generating synopsis for ${chapter.title} (${i + 1}/${project.chapters.length})...`);
    
    const prompt = `Analyze this chapter and provide:
    1. A 2-3 sentence synopsis
    2. Timeline information (e.g., "Day 1", "3 weeks later", "simultaneous with Chapter X", "flashback to 10 years ago")
    3. Characters present in this chapter
    4. Key plot beats
    
    Respond in JSON: { "synopsis": string, "timelineStamp": string, "charactersPresent": string[], "plotBeats": string[] }`;
    
    const result = await generateAIContent({
      model: 'gemini-2.5-flash',
      contents: `${prompt}\n\nCHAPTER: ${chapter.title}\n\n${chapter.content.substring(0, 5000)}`,
      config: { responseMimeType: 'application/json' }
    }, 'analysis');
    
    const parsed = extractJSON<any>(result.text);
    if (parsed) {
      synopses.push({
        chapterId: chapter.id,
        synopsis: parsed.synopsis || '',
        timelineStamp: parsed.timelineStamp || 'Unknown',
        charactersPresent: parsed.charactersPresent || [],
        plotBeats: parsed.plotBeats || []
      });
    }
    
    // Rate limit buffer
    await new Promise(r => setTimeout(r, 500));
  }
  
  return synopses;
}

// Detect and flag timeline inconsistencies
export async function detectTimelineInconsistencies(synopses: any[]): Promise<{ issue: string, affectedChapters: string[] }[]> {
  const prompt = `Analyze these chapter synopses and timeline stamps for inconsistencies:
  - Characters appearing before they're introduced
  - Events happening out of logical order
  - Timeline jumps that don't make sense
  - Characters knowing things they shouldn't know yet
  
  Respond in JSON: { "inconsistencies": [{ "issue": string, "affectedChapters": string[] }] }`;
  
  const result = await generateAIContent({
    model: 'gemini-3-pro-preview',
    contents: `${prompt}\n\nSYNOPSES:\n${JSON.stringify(synopses, null, 2)}`,
    config: { responseMimeType: 'application/json' }
  }, 'analysis');
  
  const parsed = extractJSON<{ inconsistencies: any[] }>(result.text);
  return parsed?.inconsistencies || [];
}

// Enhanced trilogy doctor that uses story codex
export async function analyzeTrilogyWithCodex(project: NovelProject, onProgress: (progressText: string) => void, onIssueFound: (issue: TrilogyIssueAndFix) => void): Promise<void> {
  const batchSize = currentSettings.activeProvider === 'webllm' ? 5 : 10;
  
  try {
    onProgress('Starting trilogy analysis...');
    
    // Batch chapters for analysis
    const batches = [];
    for (let i = 0; i < project.chapters.length
             
    // Step 1: Extract story codex (characters, worldbuilding, timeline)
    onProgress('Extracting character database...');
    const characters = await extractCharacterDatabase(project);
    
    onProgress('Extracting worldbuilding database...');
    const worldElements = await extractWorldbuildingDatabase(project);
    
    onProgress('Generating chapter synopses with timeline...');
    const synopses = await generateChapterSynopsesWithTimeline(project, onProgress);
    
    onProgress('Detecting timeline inconsistencies...');
    const timelineIssues = await detectTimelineInconsistencies(synopses);
    
    // Report timeline issues as TrilogyIssueAndFix objects
    for (const timelineIssue of timelineIssues) {
      onIssueFound({
        id: uuidv4(),
        type: 'Timeline',
        severity: 'Major',
        description: timelineIssue.issue,
        chaptersInvolved: timelineIssue.affectedChapters,
        suggestedFix: 'Review the timeline and adjust the order or add transitional text to clarify the time jump.'
      });
    }
    ; i += batchSize) {
      batches.push(project.chapters.slice(i, i + batchSize));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const startChapter = batchIndex * batchSize + 1;
      const endChapter = Math.min(startChapter + batchSize - 1, project.chapters.length);
      
      onProgress(`Analyzing chapters ${startChapter}-${endChapter} of ${project.chapters.length}...`);
      
      const batchContext = batch.map(c => `### ${c.title}\n${c.content.substring(0, 3000)}`).join('\n\n');
      
      const prompt = `Analyze these chapters for trilogy-wide issues. For EACH issue found, respond with a JSON array:
[{
  "type": "Continuity" | "Plot" | "Character" | "Pacing" | "World-Building" | "Theme",
  "severity": "Critical" | "Major" | "Minor",
  "description": "Clear explanation",
 "chaptersInvolved": ["Book 1: Chapter 1", "Book 2: Chapter 5"],  "suggestedFix": "Specific fix"
}]

Focus on: 1. Timeline issues 2. Character consistency 3. Plot structure 4. World-building rules 5. Themes 6. Foreshadowing

CHAPTERS:
${batchContext}`;

      const result = await generateAIContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      }, 'analysis');
      
      if (!result.text) {
        console.warn(`Batch ${batchIndex + 1}: No AI response`);
        continue;
      }
      
      const parsed = extractJSON<TrilogyIssueAndFix[]>(result.text);
                console.log(`Batch ${batchIndex + 1} - AI Response:`, result.text);
                console.log(`Batch ${batchIndex + 1} - Parsed:`, parsed, 'Is Array:', Array.isArray(parsed), 'Length:', parsed?.length);
      
      if (parsed && Array.isArray(parsed)) {
        for (const issue of parsed) {
          onIssueFound({ ...issue, id: uuidv4() });
        }
      }
      
      // Rate limit buffer
      await new Promise(r => setTimeout(r, 1000));
    }
    
    onProgress('Trilogy analysis complete!');
    
  } catch (e: any) {
    console.error('Series Doctor error:', e);
    throw new Error(`Series Doctor failed: ${e.message}. Check API key in Settings.`);
  }
  }
// Fix all trilogy issues automatically
export async function fixAllTrilogyIssues(
  project: NovelProject,
  issues: TrilogyIssueAndFix[],
  onProgress: (progressText: string) => void
): Promise<NovelProject> {
  const updatedProject = JSON.parse(JSON.stringify(project)) as NovelProject;
  
  onProgress(`Starting to fix ${issues.length} issues...`);
  
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    onProgress(`Fixing issue ${i + 1}/${issues.length}: ${issue.type}...`);
    
    try {
      // Use AI to apply the suggested fix to the relevant chapters
              // Ensure chaptersInvolved is always an array
              const chaptersArray = Array.isArray(issue.chaptersInvolved) ? issue.chaptersInvolved : [issue.chaptersInvolved];
      for (const chapterRef of chaptersArray) {
        // Find chapter by title match (chapters are flat in NovelProject)
        const chapter = updatedProject.chapters.find(c => c.title === chapterRef);
        if (!chapter) continue;        
        const fixPrompt = `Apply this fix to the chapter content:

ISSUE: ${issue.description}

SUGGESTED FIX: ${issue.suggestedFix}

CHAPTER CONTENT:
${chapter.content}

Provide the updated chapter content that implements the fix. Return ONLY the updated content, no explanations.`;
        
        const result = await generateAIContent({
          model: 'gemini-2.5-flash',
          contents: fixPrompt,
          config: { responseMimeType: 'text/plain' }
        }, 'fix');
        
        chapter.content = result.text.trim();
      }
    } catch (e) {
      console.error(`Failed to fix issue ${issue.id}:`, e);
    }
  }
  
  onProgress('All fixes applied successfully!');
  return updatedProject;
}

// Fix a single trilogy issue using AI
export async function fixSingleTrilogyIssue(
  project: NovelProject,
  issue: TrilogyIssueAndFix,
  onProgress: (progressText: string) => void
): Promise<NovelProject> {
  const updatedProject = JSON.parse(JSON.stringify(project)) as NovelProject;
  
  onProgress(`Analyzing issue: ${issue.type}...`);
  
  try {
    // Apply fix to each chapter involved in the issue
          // Ensure chaptersInvolved is always an array
          const chaptersArray = Array.isArray(issue.chaptersInvolved) ? issue.chaptersInvolved : [issue.chaptersInvolved];
    for (const chapterRef of chaptersArray) {
      const chapter = updatedProject.chapters.find(c => c.title === chapterRef);
      if (!chapter) continue;

      onProgress(`Fixing ${chapter.title}...`);
      
      const fixPrompt = `Apply this fix to the chapter content:

ISSUE TYPE: ${issue.type}
ISSUE: ${issue.description}
SUGGESTED FIX: ${issue.suggestedFix}

CHAPTER CONTENT:
${chapter.content}

Provide the updated chapter content that implements the fix. Return ONLY the updated content, no explanations.`;
      
      const result = await generateAIContent({
        model: 'gemini-2.5-flash',
        contents: fixPrompt,
        config: { responseMimeType: 'text/plain' }
      }, 'analysis');
      
      if (result.text) {
        chapter.content = result.text.trim();
        chapter.wordCount = chapter.content.split(/\s+/).filter(Boolean).length;
        chapter.lastModified = Date.now();
      }
    }
    
    onProgress('Fix applied successfully!');
    return updatedProject;
    
  } catch (e: any) {
    console.error('Failed to fix issue:', e);
    throw new Error(`Failed to fix issue: ${e.message}. Check API key in Settings.`);
  }
}

// Generate detailed chapter-by-chapter fix plan
export async function generateFixPlan(
  issue: TrilogyIssueAndFix,
  project: NovelProject
): Promise<string> {
  try {
    
    // Generate x plan for each chapter involved
          // Guard: Check if chaptersInvolved exists and is an array
    if (!issue.chaptersInvolved) {                    return 'No chapters involved in this issue.';
                  }

        // Normalize chaptersInvolved to always be an array
        const chaptersArray = Array.isArray(issue.chaptersInvolved) ? issue.chaptersInvolved : [issue.chaptersInvolved];
    for (const chapterRef of chaptersArray) {
      const chapter = project.chapters.find(c => c.title === chapterRef);
      if (!chapter) continue;

      const planPrompt = `Analyze this ${issue.type} issue and provide SPECIFIC, ACTIONABLE steps to fix it in this chapter.

ISSUE TYPE: ${issue.type}
ISSUE DESCRIPTION: ${issue.description}
GENERAL FIX: ${issue.suggestedFix}

CHAPTER: ${chapter.title}
CHAPTER CONTENT (first 2000 chars):
${chapter.content.substring(0, 2000)}

Provide a JSON response with this structure:
{
  "actions": [
    {
      "type": "find-replace" | "add-content" | "remove-content" | "rewrite-section",
      "description": "Clear description of what to change",
      "findText": "exact text to find (if find-replace)",
      "replaceWith": "exact replacement text (if find-replace)",
      "sectionStart": "text marking start of section (if rewrite)",
      "sectionEnd": "text marking end of section (if rewrite)",
      "newContent": "new content to add/insert (if add-content or rewrite)"
    }
  ]
}

Be SPECIFIC. Include exact text snippets for find-replace operations.`;

      const result = await generateAIContent({
        model: 'gemini-2.5-flash',
        contents: planPrompt,
        config: { responseMimeType: 'application/json' }
      }, 'analysis');

    return result.text || 'No fix plan generated';
          }

  } catch (e: any) {
    console.error('Failed to generate fix plan:', e);
    return `Error generating fix plan: ${e.message}`;
}

    // ===== BOOK TRAILER GENERATION (AUDIO + SLIDESHOW) =====

// Generate script for 1-minute book trailer
export async function generateBookTrailerScript(project: NovelProject): Promise<{ script: string, scenes: string[] }> {
  const prompt = `Create a compelling 1-minute book trailer script for "${project.title}" (${project.genre}).
  
  The script should:
  - Be exactly 60 seconds when read aloud (approximately 150 words)
  - Hook the audience immediately
  - Tease the main conflict without spoilers
  - End with a compelling call-to-action
  - Include 5-6 scene descriptions for background visuals
  
  Synopsis: ${project.synopsis}
  
  Respond in JSON: {
    "script": "The narration script (150 words max)",
    "scenes": ["Scene 1 description for image generation", "Scene 2...", etc]
  }`;
  
  const result = await generateAIContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  }, 'writing');
  
  return extractJSON<{ script: string, scenes: string[] }>(result.text) || { script: '', scenes: [] };
}

// Generate audio from text using Web Speech API or return audio URL
export async function generateTrailerAudio(script: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Check if browser supports Speech Synthesis
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported in this browser'));
      return;
    }
    
    // Create speech synthesis utterance
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.9; // Slightly slower for dramatic effect
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Use MediaRecorder to capture audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const mediaStreamDestination = audioContext.createMediaStreamDestination();
    const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
    const audioChunks: BlobPart[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      resolve(audioBlob);
    };
    
    // Start recording and speak
    mediaRecorder.start();
    window.speechSynthesis.speak(utterance);
    
    utterance.onend = () => {
      mediaRecorder.stop();
      audioContext.close();
    };
    
    utterance.onerror = (error) => {
      mediaRecorder.stop();
      audioContext.close();
      reject(error);
    };
  });
}

// Generate scene images for the trailer
export async function generateTrailerSceneImages(scenes: string[]): Promise<string[]> {
  const images: string[] = [];
  
  for (const scene of scenes) {
    const imagePrompt = `Cinematic book trailer scene: ${scene}. Dramatic lighting, professional composition, movie poster quality.`;
    try {
      const imageUrl = await generateImage(imagePrompt, '16:9');
      images.push(imageUrl);
    } catch (e) {
      console.error('Failed to generate scene image:', e);
      images.push(''); // Placeholder for failed image
    }
  }
  
  return images;
}

// Create book trailer video (audio + slideshow)
export async function generateBookTrailer(
  project: NovelProject,
  onProgress: (progress: string) => void
): Promise<{ videoBlob: Blob, script: string, images: string[] }> {
  try {
    onProgress('Generating trailer script...');
    const { script, scenes } = await generateBookTrailerScript(project);
    
    onProgress('Generating scene images...');
    const images = await generateTrailerSceneImages(scenes);
    
    onProgress('Generating voiceover audio...');
    const audioBlob = await generateTrailerAudio(script);
    
    onProgress('Compiling trailer video...');
    // Create video with slideshow and audio
    const videoBlob = await createVideoWithSlideshow(images, audioBlob, 60);
    
    onProgress('Trailer complete!');
    return { videoBlob, script, images };
  } catch (error: any) {
    throw new Error(`Failed to generate book trailer: ${error.message}`);
  }
}

// Helper function to create video from images and audio
async function createVideoWithSlideshow(
  images: string[],
  audioBlob: Blob,
  duration: number
): Promise<Blob> {
  // This creates a simple video using Canvas API and MediaRecorder
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // Create video stream from canvas
    const stream = canvas.captureStream(30); // 30 FPS
    
    // Add audio track to video stream
    const audioContext = new AudioContext();
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const audioBuffer = await audioContext.decodeAudioData(reader.result as ArrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        const dest = audioContext.createMediaStreamDestination();
        source.connect(dest);
        
        // Combine video and audio streams
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = dest.stream.getAudioTracks()[0];
        const combinedStream = new MediaStream([videoTrack, audioTrack]);
        
        const mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: 'video/webm;codecs=vp9,opus'
        });
        
        const chunks: BlobPart[] = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: 'video/webm' });
          resolve(videoBlob);
        };
        
        // Start recording
        mediaRecorder.start();
        source.start(0);
        
        // Draw slideshow
        const timePerImage = duration / images.length;
        let currentImageIndex = 0;
        
        const drawFrame = async () => {
          if (currentImageIndex < images.length) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = images[currentImageIndex];
            
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              currentImageIndex++;
              
              if (currentImageIndex < images.length) {
                setTimeout(drawFrame, timePerImage * 1000);
              } else {
                // Video complete
                setTimeout(() => {
                  mediaRecorder.stop();
                  source.stop();
                }, 500);
              }
            };
          }
        };
        
        drawFrame();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read audio blob'));
    reader.readAsArrayBuffer(audioBlob);
  });
}
    }
