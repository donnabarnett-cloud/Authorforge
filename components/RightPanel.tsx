import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { MessageSquare, BarChart2, Lightbulb, Send, Loader2, Sparkles, X, Wand2, Hammer, Star, StarHalf, Heart, Gauge, Quote, AlertOctagon, TrendingUp, AlertTriangle, LayoutTemplate, Repeat, Activity, Anchor, Target, ShieldAlert, UserCircle, RefreshCcw, CheckCircle2, Users, BookCopy, Download } from 'lucide-react';
import { AIChatMessage, AnalysisResult, Project, SceneBeat, Character, Chapter, BetaReaderPersona, BetaReaderFeedback, AIAgent, NovelProject, ColoringBookProject } from '../types';
import { sendChatMessage, analyzeText, generateSceneStructure, generateBetaReaderFeedback } from '../services/geminiService';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Bar, Legend, BarChart as ReBarChart } from 'recharts';
import { Button } from './Button';

interface RightPanelProps {
  currentContext: string; 
  onClose: () => void;
  onApplySuggestion?: (suggestion: string) => Promise<void>;
  isGenerating?: boolean;
  project?: Project;
  currentChapter?: Chapter; 
  onUpdateAnalysis?: (result: AnalysisResult) => void; 
}

const BETA_READERS: BetaReaderPersona[] = [
    { id: 'fan', name: 'Chloe', type: 'Fan', avatar: '😍', description: 'Loves emotional moments, ships characters, easily excited.' },
    { id: 'critic', name: 'Marcus', type: 'Critic', avatar: '🧐', description: 'Hard to please. Looks for plot holes, logical errors, and pacing issues.' },
    { id: 'editor', name: 'Sarah', type: 'Editor', avatar: '📝', description: 'Focuses on clarity, structure, and marketability. Brutally honest.' },
    { id: 'casual', name: 'Dave', type: 'Casual', avatar: '🍺', description: 'Reads for fun. Gets bored easily. Needs hooks and action.' },
    { id: 'skeptic', name: 'Dr. X', type: 'Skeptic', avatar: '🤨', description: 'Questions world-building logic and magic systems.' },
];

// ForwardRef to allow parent (Agent) to trigger internal methods
export const RightPanel = forwardRef<{ runAnalysis: () => Promise<AnalysisResult | null>, fixAll: () => Promise<void>, getAnalysis: () => AnalysisResult | null }, RightPanelProps>(({ currentContext, onClose, onApplySuggestion, isGenerating = false, project, currentChapter, onUpdateAnalysis }, ref) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis' | 'structure' | 'beta'>('analysis');
  const [messages, setMessages] = useState<AIChatMessage[]>([{ id: '1', role: 'model', text: 'Hello! I am your AI writing partner.', timestamp: Date.now() }]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sceneBeats, setSceneBeats] = useState<SceneBeat[] | null>(null);
  const [isAnalyzingStructure, setIsAnalyzingStructure] = useState(false);
  const [activePersona, setActivePersona] = useState<Character | AIAgent | null>(null); 
  
  const [betaFeedback, setBetaFeedback] = useState<BetaReaderFeedback[]>([]);
  const [readingPersonaId, setReadingPersonaId] = useState<string | null>(null);

  // Effect to load cached analysis if available and relevant
  useEffect(() => {
      // OPTIMIZE: Initialize state directly from props to prevent potential UI flicker
      // when switching between chapters with cached analysis data.
      const initialAnalysis = currentChapter?.lastAnalysis && currentChapter.lastModified && currentChapter.lastAnalysis.timestamp > currentChapter.lastModified
        ? currentChapter.lastAnalysis
        : null;
      setAnalysis(initialAnalysis);
      setSceneBeats(null);
      setBetaFeedback([]);
  }, [currentChapter?.id, currentChapter?.lastAnalysis, currentChapter?.lastModified]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (text: string = inputValue) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: text, timestamp: Date.now(), personaId: activePersona?.id }]);
    setInputValue(''); setIsTyping(true);
    
    // Pass activePersona to service
    const responseText = await sendChatMessage(messages, text, currentContext, activePersona || undefined);
    
    setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'model', text: responseText, timestamp: Date.now(), personaId: activePersona?.id }]);
    setIsTyping(false);
  };

  const runAnalysis = async (force = false) => {
    setActiveTab('analysis');
    
    // Cache Check: Use existing if fresh unless forced
    if (!force && currentChapter && currentChapter.lastAnalysis && currentChapter.lastAnalysis.timestamp && currentChapter.lastModified) {
        if (currentChapter.lastAnalysis.timestamp > currentChapter.lastModified) {
            console.log("[Omni-Sweep] Using Cached Analysis (Content Unchanged)");
            setAnalysis(currentChapter.lastAnalysis);
            return currentChapter.lastAnalysis;
        }
    }

    setIsAnalyzing(true);
    const result = await analyzeText(currentContext, project?.projectType === 'novel' ? project as NovelProject : undefined);
    setAnalysis(result);
    if (onUpdateAnalysis && result) onUpdateAnalysis(result);
    setIsAnalyzing(false);
    return result;
  };

  const runStructureAnalysis = async () => {
      setIsAnalyzingStructure(true);
      const genre = (project as any)?.genre || 'Fiction';
      const beats = await generateSceneStructure(currentContext, genre);
      setSceneBeats(beats);
      setIsAnalyzingStructure(false);
  }
  
  const requestBetaRead = async (persona: BetaReaderPersona) => {
      setReadingPersonaId(persona.id);
      const feedback = await generateBetaReaderFeedback(currentContext, persona);
      setBetaFeedback(prev => [feedback, ...prev]);
      setReadingPersonaId(null);
  }

  const handleFixAll = async () => {
      if (analysis && onApplySuggestion && !isGenerating) {
          const specificIssues = analysis.issues ? analysis.issues.map(i => i.suggestion || i.description).filter(Boolean) : [];
          const generalSuggestions = analysis.suggestions || [];
          
          const instructions = specificIssues.length > 0 
            ? "Fix these specific issues:\n" + specificIssues.map(s => `- ${s}`).join("\n")
            : "Fix these issues:\n" + generalSuggestions.join("\n");
          
          await onApplySuggestion(instructions);
      }
  };
  
  useImperativeHandle(ref, () => ({
      runAnalysis: () => runAnalysis(true),
      fixAll: handleFixAll,
      getAnalysis: () => analysis,
  }));
  
  const renderAnalysis = () => {
    if (isAnalyzing) {
        return <div className="flex flex-col items-center justify-center h-full text-slate-400"><Loader2 size={32} className="animate-spin text-indigo-500"/><p className="mt-4 text-sm">Analyzing Chapter...</p></div>;
    }
    if (!analysis) {
        return <div className="flex flex-col items-center justify-center h-full text-slate-400"><Button onClick={() => runAnalysis(true)} icon={<Sparkles size={16}/>}>Run Omni-Sweep</Button></div>;
    }

    const { qualityScore, suggestions, issues, bestsellerComparison, heuristics, readerExperience, genreAnalysis } = analysis;
    const scoreColor = qualityScore > 85 ? 'text-green-500' : qualityScore > 60 ? 'text-amber-500' : 'text-red-500';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className={`text-5xl font-bold ${scoreColor}`}>{qualityScore}</div>
                    <div>
                        <div className="font-bold text-slate-800 dark:text-white">Bestseller Potential</div>
                        <div className="text-xs text-slate-500">{bestsellerComparison?.verdict}</div>
                    </div>
                </div>
                 <Button onClick={() => runAnalysis(true)} variant="ghost" size="sm" icon={<RefreshCcw size={14}/>}>Rescan</Button>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-sm mb-2 text-slate-800 dark:text-white flex items-center"><Lightbulb size={14} className="mr-2 text-indigo-500"/> Key Suggestions</h4>
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-2">
                    {suggestions.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
            </div>
            
            {issues && issues.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <h4 className="font-bold text-sm mb-2 text-red-800 dark:text-red-300 flex items-center"><AlertTriangle size={14} className="mr-2"/> Issues to Address</h4>
                    <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-2">
                        {issues.map((issue, i) => <li key={i} title={issue.location}>{issue.description}</li>)}
                    </ul>
                </div>
            )}
            
            <details className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
                <summary className="font-bold text-sm text-slate-800 dark:text-white cursor-pointer">Heuristic Analysis</summary>
                <div className="grid grid-cols-2 gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
                    <div>Dialogue Ratio: <span className="font-bold text-slate-800 dark:text-white">{heuristics?.dialogueRatio?.toFixed(2)}%</span></div>
                    <div>Adverb Rate: <span className="font-bold text-slate-800 dark:text-white">{heuristics?.adverbRate?.toFixed(2)}%</span></div>
                    <div>Sentence Variety: <span className="font-bold text-slate-800 dark:text-white">{heuristics?.sentenceVarietyScore}</span></div>
                    <div>Repetitive Starts: <span className="font-bold text-slate-800 dark:text-white">{heuristics?.repetitiveStarts}</span></div>
                </div>
            </details>
        </div>
    );
  };
  
  return (
    <aside className="w-96 bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div className="flex space-x-1">
          {[
              { id: 'chat', label: 'Chat', icon: MessageSquare },
              { id: 'analysis', label: 'Sweep', icon: BarChart2 },
              { id: 'structure', label: 'Scene', icon: LayoutTemplate },
              { id: 'beta', label: 'Readers', icon: Users }
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center px-3 py-1.5 rounded-lg font-bold text-sm transition ${activeTab === tab.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <tab.icon size={14} className="mr-2"/> {tab.label}
              </button>
          ))}
        </div>
        <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
                <div className="flex-1 space-y-4 overflow-y-auto">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            <div className={`p-3 rounded-lg text-sm max-w-xs ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{msg.text}</div>
                        </div>
                    ))}
                    {isTyping && <div className="flex gap-2"><div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm"><Loader2 size={16} className="animate-spin text-slate-400"/></div></div>}
                    <div ref={messagesEndRef} />
                </div>
            </div>
        )}
        
        {activeTab === 'analysis' && renderAnalysis()}

        {activeTab === 'structure' && (
            isAnalyzingStructure ? <div className="flex flex-col items-center justify-center h-full text-slate-400"><Loader2 size={32} className="animate-spin text-indigo-500"/><p className="mt-4 text-sm">Analyzing Scene Beats...</p></div> :
            !sceneBeats ? <div className="flex flex-col items-center justify-center h-full text-slate-400"><Button onClick={runStructureAnalysis} icon={<Sparkles size={16}/>}>Analyze Scene Structure</Button></div> :
            <div className="space-y-3">
                {sceneBeats.map((beat, i) => (
                    <div key={i} className={`p-3 rounded-lg border-l-4 ${beat.status === 'strong' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : beat.status === 'weak' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                        <div className="font-bold text-sm text-slate-800 dark:text-white">{beat.type}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{beat.description}</p>
                        {beat.suggestion && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 italic">"{beat.suggestion}"</p>}
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'beta' && (
             <div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {BETA_READERS.map(p => <button key={p.id} onClick={() => requestBetaRead(p)} disabled={readingPersonaId === p.id} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"><div className="text-3xl">{p.avatar}</div><div className="text-[10px] font-bold">{p.name}</div></button>)}
                </div>
                 {betaFeedback.length > 0 && <div className="space-y-4">
                    {betaFeedback.map(fb => {
                        const persona = BETA_READERS.find(p => p.id === fb.readerId);
                        return (
                            <div key={fb.readerId} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2 font-bold text-sm"><span className="text-2xl">{persona?.avatar}</span> {persona?.name}</div>
                                    <div className="flex items-center gap-1 text-amber-500">
                                        {[...Array(Math.floor(fb.rating))].map((_, i) => <Star key={i} size={14} fill="currentColor"/>)}
                                        {fb.rating % 1 !== 0 && <StarHalf size={14} fill="currentColor"/>}
                                    </div>
                                </div>
                                <p className="text-sm italic text-slate-700 dark:text-slate-300">"{fb.reaction}"</p>
                                <p className="text-xs mt-2 text-slate-500">Emotion: <span className="font-bold">{fb.emotion}</span></p>
                            </div>
                        )
                    })}
                </div>}
             </div>
        )}
      </div>

      {activeTab === 'chat' && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <div className="relative">
              <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Ask anything..." className="w-full p-3 pr-12 rounded-lg bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500"/>
              <button onClick={() => handleSend()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"><Send size={16}/></button>
            </div>
          </div>
      )}
    </aside>
  );
});
