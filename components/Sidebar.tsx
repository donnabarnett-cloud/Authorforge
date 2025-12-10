import React, { useState } from 'react';
import { Project, NovelProject, Chapter, Character, WorldItem, TrashItem, ColoringBookProject } from '../types';
import { restoreFromTrash } from '../services/storageService';
import { BookOpen, Users, Globe, Image, Share2, Search, Trash2, RotateCcw, X, Plus, FileText, Settings, Mic, Layout, PenTool, Activity, Ghost, BookCopy, Briefcase, Stethoscope, Sparkles, Paintbrush, Download, GitMerge } from 'lucide-react';
import { Button } from './Button';

interface SidebarProps {
  project: Project;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentChapterId?: string | null;
  selectedItemId?: string | null;
  onChapterSelect?: (id: string) => void;
  onCharacterSelect?: (id: string) => void;
  onWorldItemSelect?: (id: string) => void;
  onAddChapter?: () => void;
  onAddCharacter?: () => void;
  onAddWorldItem?: () => void;
  onBackToDashboard: () => void;
  onOpenBookSweep?: () => void;
  onOpenAgent?: () => void;
  onOpenSettings?: () => void;
  onSplitTrilogy?: () => void;
  onOpenGlobalEdit?: () => void;
  onOpenSeriesDoctor?: () => void;
  onExportProject?: () => void;
  onUpdateProject: (project: Project) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    project, activeTab, onTabChange, 
    currentChapterId, selectedItemId, 
    onChapterSelect, onCharacterSelect, onWorldItemSelect, 
    onAddChapter, onAddCharacter, onAddWorldItem, 
    onBackToDashboard, onOpenBookSweep, onOpenAgent, onOpenSettings, onSplitTrilogy, onOpenGlobalEdit, onOpenSeriesDoctor, onExportProject, onUpdateProject
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [showTrash, setShowTrash] = useState(false);
    
    const isNovel = project.projectType === 'novel';
    const novelProject = isNovel ? project as NovelProject : null;
    const isTrilogy = novelProject && novelProject.chapters.some(c => /^Book \d+:\s*/.test(c.title));

    const isColoringBook = project.projectType === 'coloring-book';
    const coloringBookProject = isColoringBook ? project as ColoringBookProject : null;

    const searchResults = novelProject && searchQuery ? [
        ...(novelProject?.chapters || []).filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).map(c => ({ ...c, type: 'chapter' })),
        ...(novelProject?.characters || []).filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(c => ({ ...c, type: 'character', title: c.name }))
    ] : [];

    const handleRestore = (item: TrashItem) => {
        const { project: updatedProject, restored } = restoreFromTrash(project, item.id);
        if (restored) {
            onUpdateProject(updatedProject);
        }
    };

    const renderTrash = () => (
        <div className="p-4 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Recycle Bin</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowTrash(false)}>Back</Button>
            </div>
            {(project.recycleBin || []).length === 0 ? (
                <p className="text-sm text-slate-500 flex-1 flex items-center justify-center">The recycle bin is empty.</p>
            ) : (
                <div className="space-y-2 overflow-y-auto">
                    {(project.recycleBin || []).map(item => (
                        <div key={item.id} className="bg-slate-100 dark:bg-slate-800 p-2 rounded flex justify-between items-center">
                            <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.type} - {new Date(item.deletedAt).toLocaleDateString()}</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => handleRestore(item)} icon={<RotateCcw size={14}/>}>
                                Restore
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderContent = () => {
        if (showTrash) return renderTrash();
        
        const mainTabs = [
            { id: 'manuscript', label: 'Manuscript', icon: BookOpen, projectType: 'novel' },
            { id: 'corkboard', label: 'Corkboard', icon: Layout, projectType: 'novel' },
            { id: 'characters', label: 'Characters', icon: Users, projectType: ['novel', 'coloring-book'] },
            { id: 'world', label: 'World Bible', icon: Globe, projectType: 'novel' },
            { id: 'media', label: 'Media Studio', icon: Image, projectType: 'novel' },
            { id: 'publishing', label: 'Publishing', icon: Share2, projectType: 'novel' },
            { id: 'team', label: 'AI Team', icon: Briefcase },
            { id: 'claude', label: 'Muse Chat', icon: Sparkles },
        ];
        
        const activeProjectTabs = mainTabs.filter(tab => {
            if (!tab.projectType) return true; // always show team/muse
            return Array.isArray(tab.projectType) ? tab.projectType.includes(project.projectType) : tab.projectType === project.projectType
        });

        return (
            <>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-bold text-lg mb-1 truncate text-slate-800 dark:text-white">{project.title}</h2>
                    <p className="text-xs text-slate-500 capitalize">{project.projectType}</p>
                </div>

                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                    {activeProjectTabs.map(tab => (
                        <button key={tab.id} onClick={() => onTabChange(tab.id)} className={`w-full flex items-center p-2 rounded text-sm font-medium transition ${activeTab === tab.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            <tab.icon size={16} className="mr-3" /> {tab.label}
                        </button>
                    ))}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'manuscript' && novelProject && (
                        <div>
                            <Button onClick={onAddChapter} icon={<Plus size={14} />} className="w-full mb-4" size="sm">New Chapter</Button>
                            <div className="space-y-1">
                                {novelProject?.chapters?.map(chapter => (
                                    <div key={chapter.id} onClick={() => onChapterSelect && onChapterSelect(chapter.id)} className={`flex items-center p-2 rounded cursor-pointer text-sm truncate ${currentChapterId === chapter.id ? 'bg-slate-200 dark:bg-slate-700 font-bold text-slate-800 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                        <span className="flex-1 truncate">{chapter.title}</span>
                                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{chapter.wordCount}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500 font-bold px-2 flex justify-between">
                                <span>Total Words</span>
                                <span>{novelProject?.currentWordCount?.toLocaleString() ?? 0}</span>
                            </div>
                        </div>
                    )}
                    {activeTab === 'characters' && (
                        <div>
                            <Button onClick={onAddCharacter} icon={<Plus size={14} />} className="w-full mb-4" size="sm">New Character</Button>
                            {(novelProject?.characters || coloringBookProject?.characters || []).map((char: Character) => (
                                <div key={char.id} onClick={() => onCharacterSelect && onCharacterSelect(char.id)} className={`p-2 rounded cursor-pointer text-sm truncate ${selectedItemId === char.id ? 'bg-slate-200 dark:bg-slate-700 font-bold text-slate-800 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                    {char.name}
                                </div>
                            ))}
                        </div>
                    )}
                     {activeTab === 'world' && novelProject && (
                        <div>
                            <Button onClick={onAddWorldItem} icon={<Plus size={14} />} className="w-full mb-4" size="sm">New World Item</Button>
                            {novelProject?.worldItems?.map((item: WorldItem) => (
                                <div key={item.id} onClick={() => onWorldItemSelect && onWorldItemSelect(item.id)} className={`p-2 rounded cursor-pointer text-sm truncate ${selectedItemId === item.id ? 'bg-slate-200 dark:bg-slate-700 font-bold text-slate-800 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                    {item.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </>
        )
    };
    
    return (
        <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col flex-shrink-0">
            <div className="flex-1 flex flex-col overflow-y-auto">
                {renderContent()}
            </div>

            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <div className="grid grid-cols-3 gap-1">
                     <Button variant="ghost" onClick={onOpenBookSweep} title="Story Analyzer" className="flex-col h-16 text-xs gap-1"><Activity size={18}/> Analyzer</Button>
                     <Button variant="ghost" onClick={onOpenAgent} title="Ghostwriter" className="flex-col h-16 text-xs gap-1"><Ghost size={18}/> Ghost</Button>
                     <Button variant="ghost" onClick={onOpenGlobalEdit} title="Manuscript Doctor" className="flex-col h-16 text-xs gap-1"><Stethoscope size={18}/> Doctor</Button>
                     
                     {isNovel && !isTrilogy && <Button variant="ghost" onClick={onSplitTrilogy} title="Trilogy Deconstructor" className="flex-col h-16 text-xs gap-1"><BookCopy size={18}/> Trilogy</Button>}
                     {isTrilogy && onOpenSeriesDoctor && <Button variant="ghost" onClick={onOpenSeriesDoctor} title="Series Doctor" className="flex-col h-16 text-xs gap-1"><GitMerge size={18}/> Series Dr</Button>}

                     <Button variant="ghost" onClick={() => setShowTrash(true)} title="Recycle Bin" className="flex-col h-16 text-xs gap-1"><Trash2 size={18}/> Trash</Button>
                     {isNovel && <Button variant="ghost" onClick={() => { if(onExportProject) onExportProject() }} title="Export Manuscript (.txt)" className="flex-col h-16 text-xs gap-1"><Download size={18}/> Export</Button>}
                </div>
                 <Button variant="ghost" onClick={onBackToDashboard} className="w-full mt-1">Back to Dashboard</Button>
            </div>
        </aside>
    );
};