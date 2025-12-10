import React, { useState, useRef, useEffect } from 'react';
import { Project, NovelProject, Chapter, ChapterSnapshot, JournalProject, ToastMessage, UATActions, Sticker, MarketingProject, MarketingPost, AnalysisResult, ColoringBookProject, Character, WorldItem, TrashItem, GlobalEditSuggestion, TrilogyDoctorState, GlobalEditState } from '../types';
import { smartRewriteChapter } from '../services/geminiService';
import { Sidebar } from '../components/Sidebar';
import { Editor } from '../components/Editor';
import { RightPanel } from '../components/RightPanel';
import { Corkboard } from '../components/Corkboard';
import { CharacterView } from '../components/CharacterView';
import { WorldView } from '../components/WorldView';
import { MediaStudio } from '../components/MediaStudio';
import { PublishingStudio } from '../components/PublishingStudio';
import { JournalCanvas } from '../components/JournalCanvas';
import { TeamStudio } from '../components/TeamStudio';
import { Button } from '../components/Button';
import { BookSweep } from '../components/BookSweep';
import { AgentConsole } from '../components/AgentConsole';
import { SettingsModal } from '../components/SettingsModal';
import { UATRunner } from '../components/UATRunner';
import { CommandPalette } from '../components/CommandPalette';
import { HelpModal } from '../components/HelpModal';
import { TrilogySplitter } from '../components/TrilogySplitter';
import { GlobalEdit } from '../components/GlobalEdit';
import { BookFormatter } from '../components/BookFormatter';
import { ClaudeStudio } from '../components/ClaudeStudio';
import { TrilogyFixer } from '../components/TrilogyFixer';
import { v4 as uuidv4 } from 'uuid';

interface StudioProps {
  project: Project;
  allProjects?: Project[];
  onUpdateProject: (project: Project) => void;
  onAddProjects?: (projects: Project[]) => void;
  onBack: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  initialView?: string;
  addToast: (type: ToastMessage['type'], message: string, title?: string) => void;
}

export const Studio: React.FC<StudioProps> = ({ project, allProjects, onUpdateProject, onAddProjects, onBack, isDarkMode, toggleTheme, initialView, addToast }) => {
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(project.projectType === 'novel' ? (project as NovelProject).chapters[0]?.id : null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedWorldItemId, setSelectedWorldItemId] = useState<string | null>(null);
  
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const getDefaultTab = () => {
      if (initialView) return initialView;
      if (project.projectType === 'marketing') return 'marketing_suite';
      if (project.projectType === 'journal') return 'journal_canvas';
      if (project.projectType === 'coloring-book') return 'coloring-book-canvas';
      return 'manuscript';
  };

  const [activeSidebarTab, setActiveSidebarTab] = useState(getDefaultTab());
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [isZenMode, setIsZenMode] = useState(false); 
  
  const [showBookSweep, setShowBookSweep] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [showGlobalEdit, setShowGlobalEdit] = useState(false);
  const [showSeriesDoctor, setShowSeriesDoctor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUAT, setShowUAT] = useState(false);
  const [showBookFormatter, setShowBookFormatter] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTrilogySplitter, setShowTrilogySplitter] = useState(false);
  
  const [xRayMode, setXRayMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  
  const [isApplyingFixes, setIsApplyingFixes] = useState(false);
  
  // State for background Global Edit (Manuscript Doctor)
  const [globalEditState, setGlobalEditState] = useState<GlobalEditState>({
      isRunning: false,
      progress: 0,
      statusText: '',
      suggestions: [],
  });

  // State for background Trilogy Doctor
  const [trilogyDoctorState, setTrilogyDoctorState] = useState<TrilogyDoctorState>({
      isRunning: false,
      statusText: '',
      issues: [],
  });


  useEffect(() => { if (initialView) setActiveSidebarTab(initialView); }, [initialView]);

  useEffect(() => {
    if (project.projectType === 'novel') {
      const novelProject = project as NovelProject;
      const chapters = novelProject.chapters || [];
      const chapterExists = chapters.some(c => c.id === currentChapterId);

      if (!chapterExists && chapters.length > 0) {
        setCurrentChapterId(chapters[0].id);
      } 
      else if (chapters.length === 0) {
        setCurrentChapterId(null);
      }
    }
  }, [project, currentChapterId]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
              e.preventDefault();
              setShowCommandPalette(prev => !prev);
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
              e.preventDefault();
          }
          if (e.key === '?' && e.shiftKey) {
              setShowHelp(prev => !prev);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const rightPanelRef = useRef<{ runAnalysis: () => Promise<AnalysisResult | null>, fixAll: () => Promise<void>, getAnalysis: () => AnalysisResult | null }>(null);

  // Helper to safely get the project that has characters
  const getCharacterHoldingProject = (): NovelProject | ColoringBookProject | null => {
    if (project.projectType === 'novel') return project as NovelProject;
    if (project.projectType === 'coloring-book') return project as ColoringBookProject;
    return null;
  };

  const novelProject = project.projectType === 'novel' ? (project as NovelProject) : null;
  const journalProject = project.projectType === 'journal' ? (project as JournalProject) : null;
  
  const currentChapter = novelProject?.chapters.find(c => c.id === currentChapterId);
  const currentCharacter = getCharacterHoldingProject()?.characters?.find(c => c.id === selectedCharacterId);
  const currentWorldItem = novelProject?.worldItems.find(c => c.id === selectedWorldItemId);

  const handleUpdateChapter = (id: string, newContent: string, newTitle: string) => {
    if (!novelProject) return;
    const wordCount = newContent.split(/\s+/).filter(Boolean).length;
    const newChapters = novelProject.chapters.map(c => 
        c.id === id ? { ...c, content: newContent, title: newTitle, wordCount, lastModified: Date.now() } : c
    );
    const newWordCount = newChapters.reduce((acc, c) => acc + c.wordCount, 0);
    onUpdateProject({ ...novelProject, chapters: newChapters, currentWordCount: newWordCount } as NovelProject);
  };
  
  const handleUpdateChapterTitle = (id: string, newTitle: string) => {
    if (!novelProject) return;
    const newChapters = novelProject.chapters.map(c => c.id === id ? { ...c, title: newTitle } : c);
    onUpdateProject({ ...novelProject, chapters: newChapters } as NovelProject);
  };
  
  const handleAddChapter = () => {
    if (!novelProject) return;
    const newChapter: Chapter = {
      id: uuidv4(),
      title: `Chapter ${novelProject.chapters.length + 1}`,
      content: '',
      wordCount: 0,
      lastModified: Date.now(),
    };
    const newChapters = [...novelProject.chapters, newChapter];
    onUpdateProject({ ...novelProject, chapters: newChapters, chapterCountTarget: newChapters.length } as NovelProject);
    setCurrentChapterId(newChapter.id);
  };
  
  const handleDeleteChapter = (id: string) => {
    if (!novelProject) return;
    const chapterToDelete = novelProject.chapters.find(c => c.id === id);
    if (!chapterToDelete) return;
    
    const trashItem: TrashItem = { id: uuidv4(), originalId: id, type: 'chapter', name: chapterToDelete.title, data: chapterToDelete, deletedAt: Date.now() };
    const newChapters = novelProject.chapters.filter(c => c.id !== id);
    
    onUpdateProject({ ...novelProject, chapters: newChapters, recycleBin: [...(novelProject.recycleBin || []), trashItem] } as NovelProject);
    
    if (currentChapterId === id) {
        setCurrentChapterId(newChapters.length > 0 ? newChapters[0].id : null);
    }
  };

  const handleAddCharacter = () => {
    const characterProject = getCharacterHoldingProject();
    if (!characterProject) return;

    const newChar: Character = { id: uuidv4(), name: 'New Character', role: 'Protagonist', description: '', traits: [] };
    onUpdateProject({ 
        ...characterProject, 
        characters: [...(characterProject.characters || []), newChar] 
    } as typeof characterProject);
    setSelectedCharacterId(newChar.id);
  };
  
  const handleUpdateCharacter = (updated: Character) => {
    const characterProject = getCharacterHoldingProject();
    if (!characterProject) return;

    const newChars = (characterProject.characters || []).map(c => c.id === updated.id ? updated : c);
    onUpdateProject({ ...characterProject, characters: newChars } as typeof characterProject);
  };
  
  const handleDeleteCharacter = (id: string) => {
    const characterProject = getCharacterHoldingProject();
    if (!characterProject) return;

    const charToDelete = (characterProject.characters || []).find(c => c.id === id);
    if (!charToDelete) return;
    
    const trashItem: TrashItem = { id: uuidv4(), originalId: id, type: 'character', name: charToDelete.name, data: charToDelete, deletedAt: Date.now() };
    const newChars = (characterProject.characters || []).filter(c => c.id !== id);
    
    onUpdateProject({ 
      ...characterProject, 
      characters: newChars, 
      recycleBin: [...(characterProject.recycleBin || []), trashItem] 
    } as typeof characterProject);
    
    if (selectedCharacterId === id) setSelectedCharacterId(null);
  };
  
  const handleAddWorldItem = () => {
    if (!novelProject) return;
    const newItem: WorldItem = { id: uuidv4(), name: 'New Item', category: 'Location', description: '' };
    onUpdateProject({ ...novelProject, worldItems: [...novelProject.worldItems, newItem] } as NovelProject);
    setSelectedWorldItemId(newItem.id);
  };
  
  const handleUpdateWorldItem = (updated: WorldItem) => {
    if (!novelProject) return;
    const newItems = novelProject.worldItems.map(i => i.id === updated.id ? updated : i);
    onUpdateProject({ ...novelProject, worldItems: newItems } as NovelProject);
  };
  
  const handleDeleteWorldItem = (id: string) => {
    if (!novelProject) return;
    const itemToDelete = novelProject.worldItems.find(i => i.id === id);
    if (!itemToDelete) return;
    
    const trashItem: TrashItem = { id: uuidv4(), originalId: id, type: 'worldItem', name: itemToDelete.name, data: itemToDelete, deletedAt: Date.now() };
    const newItems = novelProject.worldItems.filter(i => i.id !== id);
    
    onUpdateProject({ ...novelProject, worldItems: newItems, recycleBin: [...(novelProject.recycleBin || []), trashItem] } as NovelProject);
    
    if (selectedWorldItemId === id) setSelectedWorldItemId(null);
  };

  const handleApplySuggestion = async (suggestion: string) => {
    if (!currentChapter || !novelProject) return;
    setIsApplyingFixes(true);
    try {
      const newContent = await smartRewriteChapter(currentChapter.content, suggestion, novelProject as NovelProject, currentChapter.wordCount);
      handleUpdateChapter(currentChapter.id, newContent, currentChapter.title);
      addToast('success', 'AI suggestion applied.');
    } catch (e) {
      console.error(e);
      addToast('error', 'Failed to apply suggestion.');
    }
    setIsApplyingFixes(false);
  };

  const handleSaveSnapshot = (note: string) => {
    if (!currentChapter) return;
    const newSnapshot: ChapterSnapshot = {
      id: uuidv4(),
      timestamp: Date.now(),
      content: currentChapter.content,
      wordCount: currentChapter.wordCount,
      note: note || `Snapshot at ${new Date().toLocaleString()}`
    };
    const updatedChapter = { ...currentChapter, snapshots: [newSnapshot, ...(currentChapter.snapshots || [])] };
    const newChapters = novelProject!.chapters.map(c => c.id === currentChapter.id ? updatedChapter : c);
    onUpdateProject({ ...novelProject!, chapters: newChapters } as NovelProject);
    addToast('success', 'Snapshot saved!');
  };

  const handleRestoreSnapshot = (snapshot: ChapterSnapshot) => {
    if (!currentChapter) return;
    handleUpdateChapter(currentChapter.id, snapshot.content, currentChapter.title);
    addToast('info', 'Chapter restored from snapshot.');
  };
  
  const handleUpdateProjectFont = (font: 'serif' | 'sans' | 'mono') => {
      if(novelProject) onUpdateProject({ ...novelProject, editorFont: font } as NovelProject);
  };

  const getEditorContext = () => {
    if (!currentChapter || !novelProject) return { genre: '', title: '', storyBible: '', styleGuide: '', previousContext: '', characters: undefined, fullProject: novelProject };
    return {
      genre: novelProject.genre,
      storyBible: novelProject.storyBible,
      styleGuide: novelProject.styleGuide,
      characters: novelProject.characters,
      fullProject: novelProject
    };
  };

  const uatActions: UATActions = {
      navigateSidebar: async (tab) => setActiveSidebarTab(tab),
      selectChapter: async (id) => setCurrentChapterId(id),
      addChapter: async () => handleAddChapter(),
      typeInEditor: async (text) => currentChapter && handleUpdateChapter(currentChapter.id, currentChapter.content + text, currentChapter.title),
      openRightPanel: () => setRightPanelOpen(true),
      runOmniSweep: async () => rightPanelRef.current?.runAnalysis() || null,
      applyFixes: async () => rightPanelRef.current?.fixAll(),
      getEditorContent: () => currentChapter?.content || "",
      getProjectContext: () => ({ genre: novelProject?.genre || '', title: novelProject?.title || '', bible: novelProject?.storyBible || '', style: novelProject?.styleGuide || '', previousContext: '', characters: '' }),
      getChapterList: () => novelProject?.chapters.map(c => ({id: c.id, title: c.title})) || [],
      getCurrentChapterId: () => currentChapterId,
      getCurrentChapterWordCount: () => currentChapter?.wordCount || 0,
      getAverageChapterWordCount: () => novelProject ? Math.floor((novelProject.currentWordCount || 0) / (novelProject.chapters.length || 1)) : 0,
      getLastAnalysis: () => currentChapter?.lastAnalysis || null,
      exportProject: () => {},
      saveProject: () => {}, // Autosaved
      toggleFeature: (feature) => {
        if (feature === 'zen') setIsZenMode(p => !p);
        if (feature === 'xray') setXRayMode(p => !p);
        if (feature === 'typewriter') setTypewriterMode(p => !p);
        if (feature === 'help') setShowHelp(true);
      },
      getProjectType: () => project.projectType,
      createCharacter: async () => handleAddCharacter(),
      createWorldItem: async () => handleAddWorldItem(),
      openCommandPalette: () => setShowCommandPalette(true),
      addToMoodboard: async () => {},
      corkboardReorder: async () => {},
      addJournalPage: async () => {},
      addJournalSticker: async () => {},
      generateMarketingAsset: async () => {},
      toggleTheme: () => toggleTheme(),
      getTeam: () => project.team || [],
  };

  const coloringBookProject = project.projectType === 'coloring-book' ? (project as ColoringBookProject) : null;
  
  const renderMainContent = () => {
    if (activeSidebarTab === 'manuscript' && novelProject && currentChapter) {
        return (
            <Editor
                key={currentChapter.id}
                content={currentChapter.content}
                onChange={(newContent) => handleUpdateChapter(currentChapter.id, newContent, currentChapter.title)}
                title={currentChapter.title}
                onTitleChange={(newTitle) => handleUpdateChapterTitle(currentChapter.id, newTitle)}
                projectContext={getEditorContext()}
                isZenMode={isZenMode}
                onToggleZenMode={() => setIsZenMode(!isZenMode)}
                snapshots={currentChapter.snapshots}
                onSaveSnapshot={handleSaveSnapshot}
                onRestoreSnapshot={handleRestoreSnapshot}
                addToast={addToast}
                editorFont={novelProject.editorFont}
                onUpdateFont={handleUpdateProjectFont}
                xRayModeState={xRayMode}
                setXRayModeState={setXRayMode}
                typewriterModeState={typewriterMode}
                setTypewriterModeState={setTypewriterMode}
                scrollContainerRef={mainScrollRef}
            />
        );
    }
    if (activeSidebarTab === 'corkboard' && novelProject) {
        return <Corkboard project={novelProject} onUpdateProject={onUpdateProject} onChapterSelect={id => { setActiveSidebarTab('manuscript'); setCurrentChapterId(id); }} />;
    }
    if (activeSidebarTab === 'characters') {
        return currentCharacter 
            ? <CharacterView character={currentCharacter} project={project} onUpdate={handleUpdateCharacter} onDelete={handleDeleteCharacter} />
            : <div className="flex items-center justify-center h-full text-slate-400">Select a character or create one.</div>;
    }
    if (activeSidebarTab === 'world') {
        return currentWorldItem 
            ? <WorldView item={currentWorldItem} onUpdate={handleUpdateWorldItem} onDelete={handleDeleteWorldItem} />
            : <div className="flex items-center justify-center h-full text-slate-400">Select a world item or create one.</div>;
    }
    if (activeSidebarTab === 'media' && (novelProject || coloringBookProject)) {
        return <MediaStudio project={(novelProject || coloringBookProject)!} characters={(novelProject || coloringBookProject)?.characters} onUpdateProject={onUpdateProject}/>;
    }
    if (activeSidebarTab === 'publishing') {
        return <PublishingStudio project={project} onUpdateProject={onUpdateProject} addToast={addToast}/>;
    }
    if (activeSidebarTab === 'journal_canvas' && journalProject) {
        return <JournalCanvas project={journalProject} onUpdate={onUpdateProject} />;
    }
    if (activeSidebarTab === 'coloring-book-canvas' && coloringBookProject) {
        return <MediaStudio project={coloringBookProject} characters={coloringBookProject.characters} onUpdateProject={onUpdateProject}/>;
    }
    if (activeSidebarTab === 'team') {
        return <TeamStudio project={project} onUpdateProject={onUpdateProject} />;
    }
    if (activeSidebarTab === 'claude') {
        return <ClaudeStudio project={project} addToast={addToast} />;
    }

    return (
        <div className="flex items-center justify-center h-full text-slate-400">
            {novelProject?.chapters.length === 0 ? 'Add a chapter to begin.' : 'Select a view.'}
        </div>
    );
  };


  return (
    <div className={`flex h-screen overflow-hidden ${isZenMode ? 'is-zen' : ''}`}>
      {!isZenMode && (
        <Sidebar 
          project={project} 
          activeTab={activeSidebarTab}
          onTabChange={tab => {
              setActiveSidebarTab(tab);
              setSelectedCharacterId(null);
              setSelectedWorldItemId(null);
          }}
          currentChapterId={currentChapterId}
          selectedItemId={selectedCharacterId || selectedWorldItemId}
          onChapterSelect={id => { setActiveSidebarTab('manuscript'); setCurrentChapterId(id); }}
          onCharacterSelect={id => { setActiveSidebarTab('characters'); setSelectedCharacterId(id); }}
          onWorldItemSelect={id => { setActiveSidebarTab('world'); setSelectedWorldItemId(id); }}
          onAddChapter={handleAddChapter}
          onAddCharacter={handleAddCharacter}
          onAddWorldItem={handleAddWorldItem}
          onBackToDashboard={onBack}
          onOpenBookSweep={() => setShowBookSweep(true)}
          onOpenAgent={() => setShowAgent(true)}
          onOpenSettings={() => setShowSettings(true)}
          onSplitTrilogy={() => setShowTrilogySplitter(true)}
          onOpenGlobalEdit={() => setShowGlobalEdit(true)}
          onOpenSeriesDoctor={() => setShowSeriesDoctor(true)}
          onExportProject={() => setShowBookFormatter(true)}
          onUpdateProject={onUpdateProject}
        />
      )}
      <main ref={mainScrollRef} className="flex-1 overflow-y-auto">
        {renderMainContent()}
      </main>

      {!isZenMode && rightPanelOpen && (
        <RightPanel
          ref={rightPanelRef}
          onClose={() => setRightPanelOpen(false)}
          currentContext={currentChapter?.content || ""}
          onApplySuggestion={handleApplySuggestion}
          isGenerating={isApplyingFixes}
          project={project}
          currentChapter={currentChapter}
          onUpdateAnalysis={(result) => {
            if (currentChapter && novelProject) {
              const newChapters = novelProject.chapters.map(c => c.id === currentChapter.id ? { ...c, lastAnalysis: result } : c);
              onUpdateProject({ ...novelProject, chapters: newChapters } as NovelProject);
            }
          }}
        />
      )}

      {showBookSweep && novelProject && <BookSweep project={novelProject} onUpdateProject={onUpdateProject} onClose={() => setShowBookSweep(false)} />}
      {showAgent && novelProject && <AgentConsole project={novelProject} allProjects={allProjects} onUpdateProject={onUpdateProject} onClose={() => setShowAgent(false)} />}
      {showGlobalEdit && novelProject && (
          <GlobalEdit 
              project={novelProject} 
              onUpdateProject={onUpdateProject} 
              onClose={() => setShowGlobalEdit(false)} 
              addToast={addToast}
              initialState={globalEditState}
              onStateChange={setGlobalEditState}
          />
      )}
       {showSeriesDoctor && novelProject && (
          <TrilogyFixer
              project={novelProject} 
              onClose={() => setShowSeriesDoctor(false)} 
              addToast={addToast}
              initialState={trilogyDoctorState}
              onStateChange={setTrilogyDoctorState}
          />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showUAT && <UATRunner actions={uatActions} onClose={() => setShowUAT(false)}/>}
      {showCommandPalette && <CommandPalette 
        project={project} 
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(view, id) => {
            setActiveSidebarTab(view);
            if (view === 'manuscript' && id) setCurrentChapterId(id);
        }}
        onAction={(action) => {
            if(action === 'zen') setIsZenMode(p => !p);
            if(action === 'export') setShowBookFormatter(true);
            if(action === 'split_trilogy') setShowTrilogySplitter(true);
        }}
      />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showTrilogySplitter && novelProject && onAddProjects && (
          <TrilogySplitter 
            project={novelProject} 
            onClose={() => setShowTrilogySplitter(false)}
            onSplitConfirm={(newProjects) => {
                onAddProjects(newProjects);
                setShowTrilogySplitter(false);
                addToast('success', 'Trilogy projects created!', 'Success');
            }}
          />
      )}
      {showBookFormatter && novelProject && (
          <BookFormatter 
            project={novelProject}
            onUpdateProject={onUpdateProject}
            onClose={() => setShowBookFormatter(false)}
          />
      )}
    </div>
  );
};