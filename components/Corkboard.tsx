
import React, { useState } from 'react';
import { NovelProject, Chapter } from '../types';
import { summarizeChapter } from '../services/geminiService';
import { Button } from './Button';
import { FileText, ArrowUp, ArrowDown, Sparkles, Loader2, Tag, CheckCircle2, Circle, Timer } from 'lucide-react';

interface CorkboardProps {
    project: NovelProject;
    onUpdateProject: (project: NovelProject) => void;
    onChapterSelect: (id: string) => void;
}

const PLOT_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export const Corkboard: React.FC<CorkboardProps> = ({ project, onUpdateProject, onChapterSelect }) => {
    const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(null);

    const moveChapter = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === project.chapters.length - 1) return;

        const newChapters = [...project.chapters];
        const temp = newChapters[index];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        newChapters[index] = newChapters[targetIndex];
        newChapters[targetIndex] = temp;
        
        onUpdateProject({ ...project, chapters: newChapters });
    };

    const handleGenerateSummary = async (chapter: Chapter) => {
        if (!chapter.content.trim()) return;
        setGeneratingSummaryId(chapter.id);
        const summary = await summarizeChapter(chapter.content);
        const newChapters = project.chapters.map(c => c.id === chapter.id ? { ...c, summary } : c);
        onUpdateProject({ ...project, chapters: newChapters });
        setGeneratingSummaryId(null);
    };

    const cycleTag = (chapter: Chapter) => {
        const currentTags = chapter.tags || [];
        let newTags: string[] = [];
        
        if (currentTags.length === 0) newTags = [PLOT_COLORS[0]];
        else {
            const idx = PLOT_COLORS.indexOf(currentTags[0]);
            if (idx === -1 || idx === PLOT_COLORS.length - 1) newTags = [];
            else newTags = [PLOT_COLORS[idx + 1]];
        }
        
        const newChapters = project.chapters.map(c => c.id === chapter.id ? { ...c, tags: newTags } : c);
        onUpdateProject({ ...project, chapters: newChapters });
    };

    const cycleStatus = (chapter: Chapter) => {
        const states: Chapter['status'][] = ['draft', 'progress', 'review', 'done'];
        const current = chapter.status || 'draft';
        const next = states[(states.indexOf(current) + 1) % states.length];
        const newChapters = project.chapters.map(c => c.id === chapter.id ? { ...c, status: next } : c);
        onUpdateProject({ ...project, chapters: newChapters });
    };

    const renderStatusIcon = (status?: string) => {
        switch(status) {
            case 'done': return <CheckCircle2 size={14} className="text-green-500"/>;
            case 'review': return <Sparkles size={14} className="text-indigo-500"/>;
            case 'progress': return <Timer size={14} className="text-amber-500"/>;
            default: return <Circle size={14} className="text-slate-300"/>;
        }
    };

    return (
        <div className="p-8 h-full overflow-y-auto bg-slate-100 dark:bg-slate-950">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Story Corkboard</h1>
                <div className="flex items-center text-xs text-slate-500">
                    <span className="mr-2">Plot Threads:</span>
                    {PLOT_COLORS.map(c => <div key={c} className="w-3 h-3 rounded-full mr-1" style={{backgroundColor: c}} />)}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {project.chapters.map((chapter, index) => (
                    <div key={chapter.id} className="bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200 dark:border-slate-800 flex flex-col h-64 transition hover:shadow-lg group relative">
                        {chapter.tags && chapter.tags.length > 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full shadow-sm" style={{backgroundColor: chapter.tags[0]}} />
                        )}
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-t-lg">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <button onClick={() => cycleStatus(chapter)} title="Toggle Status">
                                    {renderStatusIcon(chapter.status)}
                                </button>
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-300 truncate">
                                    {index + 1}. {chapter.title}
                                </span>
                            </div>
                            <div className="flex space-x-1 opacity-50 group-hover:opacity-100 transition shrink-0">
                                <button onClick={() => cycleTag(chapter)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded" title="Cycle Plot Tag"><Tag size={14}/></button>
                                <button onClick={() => moveChapter(index, 'up')} disabled={index === 0} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ArrowUp size={14}/></button>
                                <button onClick={() => moveChapter(index, 'down')} disabled={index === project.chapters.length - 1} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ArrowDown size={14}/></button>
                            </div>
                        </div>
                        
                        <div className="flex-1 p-4 overflow-y-auto text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {chapter.summary ? (
                                chapter.summary
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600">
                                    <FileText size={24} className="mb-2"/>
                                    <p>No summary yet.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] text-slate-400">{chapter.wordCount} words</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleGenerateSummary(chapter)} 
                                    disabled={generatingSummaryId === chapter.id || chapter.wordCount < 10}
                                    className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition disabled:opacity-50"
                                    title="Auto-Summarize"
                                >
                                    {generatingSummaryId === chapter.id ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                </button>
                                <Button size="sm" variant="secondary" onClick={() => onChapterSelect(chapter.id)} className="h-7 text-xs px-2">Open</Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
