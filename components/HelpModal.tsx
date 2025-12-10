
import React from 'react';
import { X, Keyboard, Command, Zap, PenTool, Layout, Search, Bot } from 'lucide-react';

interface HelpModalProps {
    onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-fade-in max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center"><Zap className="mr-2 text-amber-500" size={24}/> AuthorForge Guide</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                </div>
                
                <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-sm font-bold uppercase text-slate-500 mb-4 flex items-center"><Keyboard size={16} className="mr-2"/> Keyboard Shortcuts</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-700 dark:text-slate-300">Command Palette</span>
                                <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-500">Cmd + K</kbd>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-700 dark:text-slate-300">Global Find & Replace</span>
                                <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-500">Cmd + F</kbd>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-700 dark:text-slate-300">Quick Save</span>
                                <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-500">Cmd + S</kbd>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-700 dark:text-slate-300">Distraction Free</span>
                                <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-500">Alt + Z</kbd>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold uppercase text-slate-500 mb-4 flex items-center"><Bot size={16} className="mr-2"/> Ghost Agent</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">The AI Clone can write new chapters or polish existing ones. Select 'Draft' mode to generate text, or 'Polish' mode to refine your own words without adding new plot points.</p>
                        <h3 className="text-sm font-bold uppercase text-slate-500 mb-4 flex items-center"><PenTool size={16} className="mr-2"/> Editor Tools</h3>
                        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                            <li><strong>X-Ray Mode:</strong> Highlights adverbs, passive voice, and filler words.</li>
                            <li><strong>AI Brush:</strong> Highlight text to see the magic menu.</li>
                            <li><strong>Typewriter Mode:</strong> Keeps your cursor centered.</li>
                        </ul>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400">
                    AuthorForge Studio v2.5 • Built for Professional Writers
                </div>
            </div>
        </div>
    );
};
