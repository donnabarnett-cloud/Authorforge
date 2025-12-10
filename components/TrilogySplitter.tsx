import React, { useState } from 'react';
import { NovelProject, Chapter, BookOutline } from '../types';
import { generateSeriesOutline } from '../services/geminiService';
import { createTrilogyProjects } from '../services/storageService';
import { Button } from './Button';
import { Loader2, BookCopy, Sparkles, AlertTriangle, Book, ArrowRight, Target, Hash, Bot, FileText } from 'lucide-react';

interface TrilogySplitterProps {
    project: NovelProject;
    onClose: () => void;
    onSplitConfirm: (newProjects: NovelProject[]) => void;
}

export const TrilogySplitter: React.FC<TrilogySplitterProps> = ({ project, onClose, onSplitConfirm }) => {
    const [volumes, setVolumes] = useState([
        { title: `${project.title}: Part 1`, chapterCount: 33, wordCountTarget: 95000, synopsis: '' },
        { title: `${project.title}: Part 2`, chapterCount: 33, wordCountTarget: 95000, synopsis: '' },
        { title: `${project.title}: Part 3`, chapterCount: 33, wordCountTarget: 95000, synopsis: '' },
    ]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [outline, setOutline] = useState<BookOutline[] | null>(null);

    const handleAIAnalysis = async () => {
        setIsAnalyzing(true);
        setOutline(null);
        try {
            const result = await generateSeriesOutline(project, volumes);
            if (result && result.length === 3) {
                setOutline(result);
                // Also update the titles in the config form from the AI's response
                setVolumes(result.map((book, i) => ({
                    ...volumes[i],
                    title: book.title,
                })));
            } else {
                alert("The AI failed to generate a valid trilogy outline. Please try again.");
            }
        } catch (e) {
            console.error("Trilogy expansion outline generation failed", e);
            alert("An error occurred while generating the outline. Check the console for details.");
        }
        setIsAnalyzing(false);
    };

    const handleConfirm = () => {
        if (!outline) return;
        const newProjects = createTrilogyProjects(project, outline, volumes);
        onSplitConfirm(newProjects);
    };

    const updateVolume = (index: number, field: string, value: any) => {
        const newVolumes = [...volumes];
        (newVolumes[index] as any)[field] = value;
        setVolumes(newVolumes);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-fade-in flex flex-col h-[95vh]">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center"><BookCopy className="mr-3 text-indigo-500" /> Trilogy Deconstructor</h2>
                        <p className="text-sm text-slate-500 mt-1">Expand your single manuscript into a full trilogy using AI-powered plot expansion.</p>
                    </div>
                    <Button variant="ghost" onClick={onClose}><span className="text-2xl">&times;</span></Button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Configuration Panel */}
                    <div className="w-full lg:w-[28rem] bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto border-r border-slate-200 dark:border-slate-800">
                        <div>
                            <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800 border dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-500">Source Manuscript</p>
                                <p className="font-bold text-lg dark:text-white truncate">{project.title}</p>
                            </div>
                        </div>

                        {[0, 1, 2].map(i => (
                            <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                                <span className={`text-xs font-bold uppercase ${i === 0 ? 'text-blue-500' : i === 1 ? 'text-amber-500' : 'text-green-500'}`}>Plan Book {i + 1}</span>
                                <input type="text" value={volumes[i].title} onChange={e => updateVolume(i, 'title', e.target.value)} className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold" />
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center"><Hash size={10} className="mr-1"/> Chapters</label>
                                        <input type="number" value={volumes[i].chapterCount} onChange={e => updateVolume(i, 'chapterCount', parseInt(e.target.value))} className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center"><Target size={10} className="mr-1"/> Target Words</label>
                                        <input type="number" value={volumes[i].wordCountTarget} onChange={e => updateVolume(i, 'wordCountTarget', parseInt(e.target.value))} className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
                             <Button onClick={handleAIAnalysis} disabled={isAnalyzing} className="w-full" icon={isAnalyzing ? <Loader2 className="animate-spin"/> : <Sparkles/>}>
                                {isAnalyzing ? 'Expanding Story...' : 'Generate Trilogy Outline'}
                            </Button>
                        </div>
                    </div>
                    {/* Visual Splitter */}
                    <div className="flex-1 p-6 overflow-y-auto">
                         {isAnalyzing ? (
                             <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                 <Loader2 size={48} className="animate-spin text-indigo-500 mb-4"/>
                                 <p className="font-bold text-lg">Expanding Your Epic...</p>
                                 <p className="text-sm">The AI is reading your book and deconstructing it into three detailed outlines.</p>
                             </div>
                         ) : !outline ? (
                              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                                 <Bot size={64} className="mb-4 opacity-20"/>
                                 <h3 className="text-xl font-bold text-slate-800 dark:text-white">Generated Outlines Appear Here</h3>
                                 <p className="max-w-md">Configure your new trilogy on the left, then click "Generate Trilogy Outline". The AI will create a detailed plan for each book.</p>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                                 {outline.map((bookOutline, i) => (
                                     <div key={i} className="flex flex-col h-full">
                                         <h3 className={`font-bold text-lg mb-4 ${i === 0 ? 'text-blue-500' : i === 1 ? 'text-amber-500' : 'text-green-500'}`}>{bookOutline.title}</h3>
                                         <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                                             {bookOutline.chapters.map((ch: any, chapterIndex: number) => (
                                                 <div key={chapterIndex} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                                     <div className="flex justify-between items-start">
                                                         <p className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><FileText size={14} className="text-slate-400"/> {ch.title}</p>
                                                         <span className="text-[10px] text-slate-400">{ch.plotSummary.split(/\s+/).filter(Boolean).length} words</span>
                                                     </div>
                                                     <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{ch.plotSummary}</p>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>

                </div>
                 <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/50">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded text-xs text-amber-700 dark:text-amber-400 flex gap-2 items-center mr-auto">
                        <AlertTriangle size={20} className="shrink-0"/>
                        <p>This will create <strong>3 new projects</strong> in your dashboard. The original project will remain unchanged.</p>
                    </div>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!outline} icon={<ArrowRight size={16}/>}>Create 3 New Projects</Button>
                </div>
            </div>
        </div>
    );
};