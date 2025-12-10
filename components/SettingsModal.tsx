import React, { useState, useEffect, useRef } from 'react';
import { X, Key, ShieldCheck, ExternalLink, AlertTriangle, CheckCircle2, Loader2, Server, Cloud, Cpu, Coins, BarChart3, Sparkles, Download, Upload, HardDrive, Sliders, UserCog, Share2, Eye, EyeOff, Plus, Trash2, HelpCircle, Laptop } from 'lucide-react';
import { getAISettings, saveAISettings, getSessionTokens, getTokenBreakdown, validateApiKey, initializeWebLLM, isWebLLMLoaded } from '../services/geminiService';
import { exportBackup, importBackup } from '../services/storageService';
import { AISettings, AIProvider, ApiKey, SocialPlatform } from '../types';
import { Button } from './Button';
import { v4 as uuidv4 } from 'uuid';

interface SettingsModalProps {
    onClose: () => void;
}

const WEBLLM_MODELS = [
  { id: "Llama-3.1-8B-Instruct-q4f32_1-MLC", label: "Llama 3.1 (8B) - Balanced", size: "~5GB" },
  { id: "Hermes-3-Llama-3.1-8B-q4f16_1-MLC", label: "Hermes 3 (8B) - Creative Writing", size: "~5GB" },
  { id: "Qwen2.5-7B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 (7B) - Smart & Fast", size: "~4.5GB" },
  { id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", label: "Mistral 7B - High Quality", size: "~4GB" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const [settings, setSettings] = useState<AISettings>(getAISettings());
    const [saved, setSaved] = useState(false);
    const [tokens, setTokens] = useState(getSessionTokens());
    const [breakdown, setBreakdown] = useState(getTokenBreakdown());
    const [activeTab, setActiveTab] = useState<'ai' | 'usage' | 'data'>('ai');
    const restoreRef = useRef<HTMLInputElement>(null);
    
    // Key Management State
    const [newKey, setNewKey] = useState('');
    const [isAddingKey, setIsAddingKey] = useState(false);

    // WebLLM State
    const [webLlmProgress, setWebLlmProgress] = useState<string>('');
    const [isWebLlmLoading, setIsWebLlmLoading] = useState(false);
    const [webLlmReady, setWebLlmReady] = useState(isWebLLMLoaded());
    
    useEffect(() => {
        const t = setInterval(() => {
            setTokens(getSessionTokens());
            setBreakdown(getTokenBreakdown());
        }, 2000);
        return () => clearInterval(t);
    }, []);

    const handleSave = () => {
        const finalSettings = {
            ...settings,
            apiKeys: settings.apiKeys.filter(k => k.status !== 'pending')
        };
        saveAISettings(finalSettings);
        setSettings(finalSettings);
        setSaved(true);
        setTimeout(() => onClose(), 1000);
    };

    const handleRestoreChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const content = await file.text();
        try {
            await importBackup(content);
            alert("Backup restored! The application will now reload.");
            window.location.reload();
        } catch (err) {
            alert("Failed to restore backup. The selected file is invalid or corrupted.");
        }
    };
    
    const handleAddKey = async () => {
        if (!newKey.trim() || isAddingKey) return;

        setIsAddingKey(true);
        const tempId = uuidv4();

        const pendingKey: ApiKey = { id: tempId, key: newKey, provider: 'unknown', status: 'pending' };
        setSettings(prev => ({...prev, apiKeys: [...prev.apiKeys, pendingKey]}));
        setNewKey('');

        try {
            const { provider, status } = await validateApiKey(newKey);
            setSettings(prev => ({
                ...prev,
                apiKeys: prev.apiKeys.map(k => k.id === tempId ? { ...k, provider, status } : k)
            }));
        } catch (e) {
            console.error("Key validation failed:", e);
            setSettings(prev => ({
                ...prev,
                apiKeys: prev.apiKeys.map(k => k.id === tempId ? { ...k, provider: 'unknown', status: 'invalid' } : k)
            }));
        }
        
        setIsAddingKey(false);
    };
    
    const handleRemoveKey = (id: string) => {
        setSettings(prev => ({
            ...prev,
            apiKeys: prev.apiKeys.filter(k => k.id !== id)
        }));
    };

    const handleLoadWebLLM = async () => {
        if (!settings.webLlmModelId || isWebLlmLoading) return;
        setIsWebLlmLoading(true);
        setWebLlmProgress('Initializing...');
        
        try {
            await initializeWebLLM(settings.webLlmModelId, (progress: any) => {
                setWebLlmProgress(progress.text || `Loading: ${Math.round(progress.progress * 100)}%`);
            });
            setWebLlmReady(true);
            setWebLlmProgress('Ready');
        } catch (e) {
            console.error(e);
            setWebLlmProgress('Failed to load model.');
        } finally {
            setIsWebLlmLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <input type="file" ref={restoreRef} className="hidden" accept=".json" onChange={handleRestoreChange} />
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-fade-in flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><Sliders size={20} className="mr-2 text-indigo-500" /> Settings</h2>
                    <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
                </div>
                
                <div className="flex p-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                    <button onClick={() => setActiveTab('ai')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition ${activeTab === 'ai' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-slate-500'}`}><Key size={14}/> AI Config</button>
                    <button onClick={() => setActiveTab('usage')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition ${activeTab === 'usage' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-slate-500'}`}><BarChart3 size={14}/> Usage & Costs</button>
                    <button onClick={() => setActiveTab('data')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition ${activeTab === 'data' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-slate-500'}`}><HardDrive size={14}/> Data</button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {activeTab === 'ai' && (
                        <>
                            {/* Gemini Config */}
                            <div className={`p-4 rounded-lg border transition ${settings.activeProvider === 'gemini' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <Cloud size={16} className="text-indigo-500"/> Google Gemini (Cloud)
                                    </h3>
                                    <button 
                                        onClick={() => setSettings({...settings, activeProvider: 'gemini'})}
                                        className={`px-3 py-1 rounded text-xs font-bold uppercase transition ${settings.activeProvider === 'gemini' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}
                                    >
                                        {settings.activeProvider === 'gemini' ? 'Active' : 'Select'}
                                    </button>
                                </div>
                                
                                <div className="space-y-2">
                                    {settings.apiKeys.map(apiKey => (
                                        <div key={apiKey.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-md border border-slate-200 dark:border-slate-700">
                                            <div>
                                                {apiKey.status === 'pending' && <Loader2 size={16} className="text-slate-400 animate-spin"/>}
                                                {apiKey.status === 'valid' && <CheckCircle2 size={16} className="text-green-500"/>}
                                                {apiKey.status === 'invalid' && <AlertTriangle size={16} className="text-red-500"/>}
                                            </div>
                                            <div className="flex-1 font-mono text-sm text-slate-700 dark:text-slate-300">
                                                {apiKey.key.substring(0, 4)}...{apiKey.key.substring(apiKey.key.length - 4)}
                                            </div>
                                            <button onClick={() => handleRemoveKey(apiKey.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                                    <input 
                                        type="password"
                                        value={newKey}
                                        onChange={e => setNewKey(e.target.value)}
                                        className="flex-1 w-0 p-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                                        placeholder="Add Gemini API key..."
                                        disabled={isAddingKey}
                                    />
                                    <Button onClick={handleAddKey} disabled={isAddingKey || !newKey.trim()} size="sm" icon={isAddingKey ? <Loader2 className="animate-spin"/> : <Plus/>}>
                                        Add
                                    </Button>
                                </div>
                            </div>

                            {/* WebLLM Config */}
                            <div className={`p-4 rounded-lg border transition ${settings.activeProvider === 'webllm' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <Laptop size={16} className="text-green-500"/> WebLLM (Local Browser)
                                    </h3>
                                    <button 
                                        onClick={() => setSettings({...settings, activeProvider: 'webllm'})}
                                        className={`px-3 py-1 rounded text-xs font-bold uppercase transition ${settings.activeProvider === 'webllm' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}
                                    >
                                        {settings.activeProvider === 'webllm' ? 'Active' : 'Select'}
                                    </button>
                                </div>
                                
                                <select 
                                    value={settings.webLlmModelId || ''}
                                    onChange={(e) => setSettings({...settings, webLlmModelId: e.target.value})}
                                    className="w-full p-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 mb-2"
                                >
                                    <option value="" disabled>Select a Model</option>
                                    {WEBLLM_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.label} ({m.size})</option>
                                    ))}
                                </select>

                                <Button 
                                    onClick={handleLoadWebLLM} 
                                    disabled={!settings.webLlmModelId || isWebLlmLoading || webLlmReady} 
                                    className="w-full"
                                    size="sm"
                                    variant="secondary"
                                    icon={isWebLlmLoading ? <Loader2 className="animate-spin"/> : webLlmReady ? <CheckCircle2/> : <Download/>}
                                >
                                    {isWebLlmLoading ? 'Downloading...' : webLlmReady ? 'Model Loaded' : 'Load Model'}
                                </Button>

                                {(isWebLlmLoading || webLlmProgress) && (
                                    <div className="text-xs font-mono text-slate-500 mt-2 bg-slate-200 dark:bg-slate-800 p-2 rounded">
                                        {webLlmProgress}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'usage' && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Total Session Tokens</h3>
                                <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">{tokens.toLocaleString()}</div>
                                <div className="text-xs text-slate-400 mt-1">Approx. {Math.round(tokens * 0.75).toLocaleString()} words processed</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center"><Coins size={14} className="mr-1.5 text-amber-500"/> Cost Estimator</h4>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <div className="text-2xl font-bold text-slate-800 dark:text-white">${((tokens / 1000000) * 0.50).toFixed(4)}</div>
                                            <div className="text-[10px] text-slate-400">Based on ~$0.50/1M tokens (avg)</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center"><Cpu size={14} className="mr-1.5 text-blue-500"/> Active Model</h4>
                                    <div className="flex items-center gap-2">
                                        {settings.activeProvider === 'gemini' ? <Sparkles size={20} className="text-indigo-500"/> : <Laptop size={20} className="text-green-500"/>}
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-white text-sm">{settings.activeProvider === 'gemini' ? 'Gemini 1.5' : 'Llama 3 (Local)'}</div>
                                            <div className="text-[10px] text-green-500">{settings.activeProvider === 'gemini' ? 'Cloud API' : 'Browser GPU'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Usage Breakdown</h4>
                                <div className="space-y-3">
                                    {Object.entries(breakdown).map(([key, value]) => (
                                        <div key={key}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="capitalize text-slate-700 dark:text-slate-300 font-medium">{key}</span>
                                                <span className="text-slate-500">{value.toLocaleString()}</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${
                                                        key === 'writing' ? 'bg-indigo-500' : 
                                                        key === 'analysis' ? 'bg-purple-500' : 
                                                        key === 'media' ? 'bg-pink-500' : 'bg-green-500'
                                                    }`} 
                                                    style={{ width: `${Math.max(0, Math.min(100, ((value as number) / (tokens || 1)) * 100))}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase text-slate-500">Data Management</h3>
                            <div className="flex gap-2">
                                <Button onClick={exportBackup} variant="secondary" size="sm" icon={<Download size={14}/>} className="flex-1">Backup All Projects</Button>
                                <Button onClick={() => restoreRef.current?.click()} variant="secondary" size="sm" icon={<Upload size={14}/>} className="flex-1">Restore from Backup</Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Button onClick={handleSave} icon={saved ? <ShieldCheck size={16}/> : undefined}>{saved ? 'Saved!' : 'Save & Close'}</Button>
                </div>
            </div>
        </div>
    );
};
