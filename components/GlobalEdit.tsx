import React, { useState, useEffect } from 'react';
import { NovelProject, GlobalEditSuggestion, ToastMessage, GlobalEditState } from '../types';
import { generateGlobalEdits } from '../services/geminiService';
import { Button } from './Button';
import { Stethoscope, Loader2, Check, X, ArrowRight, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

interface GlobalEditProps {
    project: NovelProject;
    onUpdateProject: (project: NovelProject) => void;
    onClose: () => void;
    addToast: (type: ToastMessage['type'], message: string, title?: string) => void;
    initialState: GlobalEditState;
    onStateChange: React.Dispatch<React.SetStateAction<GlobalEditState>>;
}

// Helper function to escape special regex characters
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

export const GlobalEdit: React.FC<GlobalEditProps> = ({ project, onUpdateProject, onClose, addToast, initialState, onStateChange }) => {
    const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

    const runScan = async () => {
        if (initialState.isRunning) return;

        onStateChange({ ...initialState, isRunning: true, progress: 0, statusText: 'Initializing scan...', suggestions: [] });
        
        try {
            await generateGlobalEdits(
                project,
                (progressText) => { // onProgress
                    onStateChange(prev => ({ ...prev, statusText: progressText }));
                },
                (newSuggestion) => { // onSuggestionFound
                    onStateChange(prev => ({
                        ...prev,
                        suggestions: [...prev.suggestions, newSuggestion],
                        progress: (prev.suggestions.length + 1) / (project.chapters.length || 1) * 100 // Estimate progress
                    }));
                }
            );
            
            onStateChange(prev => ({ ...prev, isRunning: false, statusText: 'Scan complete!' }));

        } catch (e: any) {
            console.error("Global Edit Scan failed:", e);
            addToast('error', e.message, 'Scan Failed');
            onStateChange(prev => ({ ...prev, isRunning: false, statusText: 'Scan failed.' }));
        }
    };

    const applyEdit = (suggestion: GlobalEditSuggestion) => {
        const chapter = project.chapters.find(c => c.id === suggestion.chapterId);
        if (!chapter) return;

        const regex = new RegExp(escapeRegExp(suggestion.originalText), 'g');
        const newContent = chapter.content.replace(regex, suggestion.suggestedText);

        if (newContent === chapter.content) {
            addToast('warning', "Could not find text to replace. It may have been modified already.");
            return;
        }

        const newChapters = project.chapters.map(c => 
            c.id === suggestion.chapterId 
                ? { ...c, content: newContent, wordCount: newContent.split(/\s+/).length, lastModified: Date.now() } 
                : c
        );
        
        onUpdateProject({ ...project, chapters: newChapters });
        setAppliedIds(prev => new Set(prev).add(suggestion.id));
    };

    const applyAll = () => {
        let newChapters = [...project.chapters];
        const newApplied = new Set(appliedIds);
        let changesMade = 0;

        initialState.suggestions.filter(s => !newApplied.has(s.id)).forEach(suggestion => {
            const chapterIndex = newChapters.findIndex(c => c.id === suggestion.chapterId);
            if (chapterIndex === -1) return;

            const chapter = newChapters[chapterIndex];
            
            const regex = new RegExp(escapeRegExp(suggestion.originalText), 'g');
            const newContent = chapter.content.replace(regex, suggestion.suggestedText);
            
            if (newContent !== chapter.content) {
                newChapters[chapterIndex] = { ...chapter, content: newContent, wordCount: newContent.split(/\s+/).length, lastModified: Date.now() };
                newApplied.add(suggestion.id);
                changesMade++;
            }
        });
        
        if (changesMade > 0) {
            onUpdateProject({ ...project, chapters: newChapters });
            setAppliedIds(newApplied);
            addToast('success', `Applied ${changesMade} remaining fixes.`);
        } else {
            addToast('info', 'No remaining fixes could be applied.');
        }

    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col animate-fade-in text-white">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <div>
                    <h2 className="text-2xl font-bold flex items-center"><Stethoscope className="mr-3 text-indigo-500"/> Manuscript Doctor</h2>
                    <p className="text-slate-400 text-sm mt-1">Global analysis across {project.chapters.length} chapters.</p>
                </div>
                <div className="flex gap-4">
                    {initialState.suggestions.length > 0 && (
                        <Button onClick={applyAll} variant="secondary" icon={<CheckCircle2 size={16}/>}>Apply All Remaining</Button>
                    )}
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full"><X size={24}/></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
                {initialState.suggestions.length === 0 && !initialState.isRunning ? (
                    <div className="text-center py-20">
                        <Stethoscope size={64} className="mx-auto text-slate-700 mb-6"/>
                        <h3 className="text-xl font-bold mb-4">Deep Manuscript Scan</h3>
                        <p className="text-slate-400 max-w-lg mx-auto mb-8">
                            The AI will read your entire book to find continuity errors, pacing issues, and prose improvements. 
                            This process now streams results in real-time and runs in the background.
                        </p>
                        <Button size="lg" onClick={runScan} disabled={initialState.isRunning} icon={initialState.isRunning ? <Loader2 className="animate-spin"/> : <Stethoscope/>}>
                            {initialState.isRunning ? 'Reading Manuscript...' : 'Start Diagnosis'}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {initialState.isRunning && (
                            <div className="bg-slate-800 p-4 rounded-lg flex items-center gap-4 text-sm">
                                <Loader2 className="animate-spin text-indigo-400"/>
                                <div className="flex-1">
                                    <p className="font-bold text-white">{initialState.statusText}</p>
                                    <div className="h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                                        <div className="h-full bg-indigo-500" style={{width: `${initialState.progress}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {initialState.suggestions.map((s) => (
                            <div key={s.id} className={`bg-slate-900 border border-slate-800 rounded-xl p-6 transition ${appliedIds.has(s.id) ? 'opacity-50 grayscale' : ''}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                            s.type === 'consistency' ? 'bg-red-900/30 text-red-400' : 
                                            s.type === 'pacing' ? 'bg-amber-900/30 text-amber-400' : 
                                            'bg-blue-900/30 text-blue-400'
                                        }`}>{s.type}</span>
                                        <span className="text-sm text-slate-400 flex items-center"><FileText size={12} className="mr-1"/> {s.chapterTitle}</span>
                                    </div>
                                    {appliedIds.has(s.id) ? (
                                        <span className="text-green-500 flex items-center font-bold text-sm"><Check size={16} className="mr-1"/> Applied</span>
                                    ) : (
                                        <Button size="sm" onClick={() => applyEdit(s)}>Apply Fix</Button>
                                    )}
                                </div>
                                
                                <p className="text-slate-300 mb-4 text-sm italic border-l-2 border-slate-700 pl-3">
                                    <span className="font-bold not-italic text-slate-500 block text-xs mb-1">RATIONALE</span>
                                    {s.rationale}
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-red-900/10 border border-red-900/30 p-3 rounded-lg">
                                        <div className="flex justify-between items-center text-red-500 text-xs font-bold mb-2 uppercase">
                                            <span>Original</span>
                                            <span>{s.originalText.split(/\s+/).filter(Boolean).length} words</span>
                                        </div>
                                        <div className="text-sm text-slate-300 font-mono whitespace-pre-wrap">{s.originalText}</div>
                                    </div>
                                    <div className="bg-green-900/10 border border-green-900/30 p-3 rounded-lg">
                                        <div className="flex justify-between items-center text-green-500 text-xs font-bold mb-2 uppercase">
                                            <span>Suggestion</span>
                                            <span>{s.suggestedText.split(/\s+/).filter(Boolean).length} words</span>
                                        </div>
                                        <div className="text-sm text-slate-300 font-mono whitespace-pre-wrap">{s.suggestedText}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};