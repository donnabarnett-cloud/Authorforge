import React from 'react';
import { Check, X, ArrowRight, Split } from 'lucide-react';
import { Button } from './Button';

interface DiffViewerProps {
    original: string;
    modified: string;
    onAccept: () => void;
    onReject: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ original, modified, onAccept, onReject }) => {
    const originalWc = original.split(/\s+/).filter(Boolean).length;
    const modifiedWc = modified.split(/\s+/).filter(Boolean).length;
    const wcChange = modifiedWc - originalWc;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-950 w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col animate-fade-in overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Split size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Review Deep Line Edit</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Compare the AI's suggestions with your original draft.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button onClick={onReject} variant="ghost" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" icon={<X size={18}/>}>Reject All</Button>
                        <Button onClick={onAccept} className="bg-green-600 hover:bg-green-500 text-white px-6 shadow-lg shadow-green-900/20" icon={<Check size={18}/>}>Accept Changes</Button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-hidden flex divide-x divide-slate-200 dark:divide-slate-800">
                    <div className="flex-1 flex flex-col min-w-0 bg-red-50/10 dark:bg-red-900/5">
                        <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-500 border-b border-red-100 dark:border-red-900/30 flex items-center justify-center bg-red-50 dark:bg-red-900/10">Original Draft ({originalWc} words)</div>
                        <div className="flex-1 p-8 overflow-y-auto font-serif text-lg leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-wrap selection:bg-red-100 dark:selection:bg-red-900/30">{original}</div>
                    </div>
                    <div className="w-0 flex items-center justify-center relative z-10">
                        <div className="absolute bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-sm"><ArrowRight size={14} className="text-slate-400"/></div>
                    </div>
                    <div className="flex-1 flex flex-col min-w-0 bg-green-50/10 dark:bg-green-900/5">
                        <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 border-b border-green-100 dark:border-green-900/30 flex items-center justify-center bg-green-50 dark:bg-green-900/10">AI Revision ({modifiedWc} words, <span className={wcChange >= 0 ? 'text-green-500' : 'text-red-500'}>{wcChange >= 0 ? '+' : ''}{wcChange}</span>)</div>
                        <div className="flex-1 p-8 overflow-y-auto font-serif text-lg leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap selection:bg-green-100 dark:selection:bg-green-900/30">{modified}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
