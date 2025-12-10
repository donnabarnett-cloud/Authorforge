import React, { useState, useEffect, useRef } from 'react';
import { Search, BookOpen, Users, Globe, PenTool, Image, Settings, Share2, FileText, Scissors } from 'lucide-react';
import { Project } from '../types';

interface CommandPaletteProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: string, id?: string) => void;
    onAction: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ project, isOpen, onClose, onNavigate, onAction }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            // Delay focus slightly to ensure element is visible and ready
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    const commands = [
        { id: 'manuscript', label: 'Go to Manuscript', icon: <BookOpen size={16}/>, action: () => onNavigate('manuscript') },
        { id: 'characters', label: 'Go to Characters', icon: <Users size={16}/>, action: () => onNavigate('characters') },
        { id: 'world', label: 'Go to World Bible', icon: <Globe size={16}/>, action: () => onNavigate('world') },
        { id: 'media', label: 'Go to Media Studio', icon: <Image size={16}/>, action: () => onNavigate('media') },
        { id: 'publishing', label: 'Go to Publishing', icon: <Share2 size={16}/>, action: () => onNavigate('publishing') },
        { id: 'zen', label: 'Toggle Zen Mode', icon: <PenTool size={16}/>, action: () => onAction('zen') },
        { id: 'export', label: 'Export Project', icon: <Share2 size={16}/>, action: () => onAction('export') },
    ];

    if (project.projectType === 'novel') {
        commands.push({ id: 'split', label: 'Split into Trilogy', icon: <Scissors size={16}/>, action: () => onAction('split_trilogy') });
        // Add chapters to commands
        (project as any).chapters.forEach((c: any) => {
            commands.push({ 
                id: c.id, 
                label: `Open Chapter: ${c.title}`, 
                icon: <FileText size={16}/>, 
                action: () => onNavigate('manuscript', c.id) 
            });
        });
    }

    const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCommands[selectedIndex]) {
                filteredCommands[selectedIndex].action();
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center">
                    <Search className="text-slate-400 mr-3" size={20}/>
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command or search chapters..."
                        className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 dark:text-white placeholder-slate-400"
                    />
                    <div className="text-xs text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded">ESC to close</div>
                </div>
                <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
                    {filteredCommands.length === 0 ? (
                        <div className="p-4 text-center text-slate-500">No results found.</div>
                    ) : (
                        filteredCommands.map((cmd, index) => (
                            <div 
                                key={cmd.id}
                                onClick={() => { cmd.action(); onClose(); }}
                                className={`flex items-center p-3 rounded-lg cursor-pointer transition ${index === selectedIndex ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <div className={`mr-3 ${index === selectedIndex ? 'text-indigo-200' : 'text-slate-400'}`}>{cmd.icon}</div>
                                <span className="font-medium">{cmd.label}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
