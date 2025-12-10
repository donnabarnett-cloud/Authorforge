import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectGenre, ProjectType, NovelProject, ToastMessage, Achievement, ColoringBookProject, JournalProject } from '../types';
import { createNewProject, importBackup } from '../services/storageService';
import { extractWorldInfo, processManuscriptImport, convertManuscriptFile } from '../services/geminiService';
import { Plus, Book, Clock, MoreVertical, Upload, Loader2, Sparkles, ShieldCheck, Settings, Share2, PenTool, Layout, Trash2, Flame, GraduationCap, Feather, Award, Calendar, Target, Paintbrush, BookCopy, X, HelpCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { v4 as uuidv4 } from 'uuid';
import { UATRunner } from '../components/UATRunner';
import { SettingsModal } from '../components/SettingsModal';
import { UserGuideModal } from '../components/UserGuideModal';

interface DashboardProps {
  projects: Project[];
  onOpenProject: (project: Project, initialView?: string) => void;
  onProjectsUpdate: (projects: Project[]) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  addToast: (type: ToastMessage['type'], message: string, title?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, onOpenProject, onProjectsUpdate, isDarkMode, toggleTheme, addToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTrilogyModalOpen, setIsTrilogyModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [loadingState, setLoadingState] = useState<{ status: 'idle' | 'extracting' | 'creating' | 'processing_import', message?: string }>({ status: 'idle' });
  
  const [projectType, setProjectType] = useState<ProjectType>('novel');
  const [writingMode, setWritingMode] = useState<'fiction' | 'non-fiction'>('fiction'); 
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState<ProjectGenre>(ProjectGenre.FANTASY);
  const [wordCountTarget, setWordCountTarget] = useState<number>(100000);
  const [chapterCount, setChapterCount] = useState<number>(33);
  const [storyBible, setStoryBible] = useState('');
  const [styleGuide, setStyleGuide] = useState('');
  const [language, setLanguage] = useState('UK English');
  const [targetDate, setTargetDate] = useState("");
  
  const [trilogyFiles, setTrilogyFiles] = useState<{name: string, content: string, file: File}[]>([]);
  const importBookRef = useRef<HTMLInputElement>(null);
  const trilogyFileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const resetForm = () => {
    setProjectType('novel'); setNewTitle(''); setNewGenre(ProjectGenre.FANTASY);
    setWordCountTarget(100000); setChapterCount(33); setStoryBible(''); setStyleGuide('');
    setLanguage('UK English'); setLoadingState({ status: 'idle' }); setWritingMode('fiction'); setTargetDate("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setLoadingState({ status: 'creating', message: 'Initializing...' });

    let extractedCharacters: any[] = [];
    let extractedWorldItems: any[] = [];

    if (projectType === 'novel' && storyBible.trim().length > 50) {
      setLoadingState({ status: 'extracting', message: 'Extracting info...' });
      try {
        const info = await extractWorldInfo(storyBible);
        extractedCharacters = info.characters.map(c => ({ ...c, id: uuidv4() }));
        extractedWorldItems = info.worldItems.map(wi => ({ ...wi, id: uuidv4() }));
      } catch (err) {
        addToast('warning', 'Could not fully extract bible info, but creating project anyway.');
        console.error("Bible extraction failed:", err);
      }
    }

    const project = createNewProject(
        newTitle, projectType, newGenre, "Author", wordCountTarget, chapterCount, 
        storyBible, styleGuide, language, extractedCharacters, extractedWorldItems, writingMode, targetDate
    );

    onProjectsUpdate([...projects, project]);
    addToast('success', `Project "${newTitle}" created successfully.`);
    setIsModalOpen(false);
    resetForm();
    
    let initialView = undefined;
    if (project.projectType === 'marketing') initialView = 'marketing_suite';
    if (project.projectType === 'journal') initialView = 'journal_canvas';
    if (project.projectType === 'coloring-book') initialView = 'coloring-book-canvas';
    
    onOpenProject(project, initialView);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingState({ status: 'processing_import', message: `Reading ${file.name}...` });

    try {
      const text = await convertManuscriptFile(file);
      setLoadingState({ status: 'processing_import', message: 'AI Analyzing & Splitting Chapters...' });
      
      const importData = await processManuscriptImport(text);
      
      const baseProject = createNewProject(
        file.name.replace(/\.[^/.]+$/, ""), 
        'novel', 
        ProjectGenre.OTHER, 
        "Imported Author", 
        text.split(/\s+/).length, 
        importData.chapters.length
      ) as NovelProject;

      const fullProject: NovelProject = {
        ...baseProject,
        chapters: importData.chapters,
        characters: importData.characters,
        worldItems: importData.worldItems,
        currentWordCount: importData.chapters.reduce((acc: number, c: any) => acc + c.wordCount, 0)
      };

      onProjectsUpdate([...projects, fullProject]);
      addToast('success', 'Manuscript imported successfully.', 'Import Complete');
      onOpenProject(fullProject);
    } catch (err: any) {
      console.error("Import failed", err);
      addToast('error', `Failed to import file. ${err.message}`);
    } finally {
      setLoadingState({ status: 'idle' });
    }
  };
  
  const handleTrilogyImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trilogyFiles.length < 3) {
        addToast('error', 'Please upload all three manuscript files.');
        return;
    }

    setLoadingState({ status: 'processing_import', message: 'Processing Trilogy...' });

    try {
        const allChapters = [];
        let totalWordCount = 0;

        for (let i = 0; i < trilogyFiles.length; i++) {
            const file = trilogyFiles[i]!;
            setLoadingState({ status: 'processing_import', message: `Reading Book ${i + 1}: ${file.name}...` });
            const text = await convertManuscriptFile(file.file);
            
            setLoadingState({ status: 'processing_import', message: `Analyzing Chapters for Book ${i + 1}...` });
            const { chapters: bookChapters } = await processManuscriptImport(text);
            
            for (const chapter of bookChapters) {
                allChapters.push({
                    ...chapter,
                    title: `Book ${i + 1}: ${chapter.title}`
                });
                totalWordCount += chapter.wordCount;
            }
        }
        
        const projectTitle = trilogyFiles[0]!.name.replace(/\.[^/.]+$/, "") + " (Trilogy)";

        const baseProject = createNewProject(
            projectTitle, 'novel', ProjectGenre.OTHER, "Imported Author", totalWordCount, allChapters.length
        ) as NovelProject;

        const fullProject: NovelProject = {
            ...baseProject,
            chapters: allChapters,
            currentWordCount: totalWordCount,
            synopsis: "A trilogy imported for cohesion analysis."
        };

        onProjectsUpdate([...projects, fullProject]);
        addToast('success', 'Trilogy imported successfully as a single project.', 'Import Complete');
        onOpenProject(fullProject);
        setIsTrilogyModalOpen(false);

    } catch (err: any) {
        console.error("Trilogy import failed", err);
        addToast('error', `Failed to import trilogy. ${err.message}`);
    } finally {
        setLoadingState({ status: 'idle' });
        setTrilogyFiles([]);
    }
  };

  const handleTrilogyFileSelect = (index: number) => {
      trilogyFileRefs[index].current?.click();
  };
  
  const handleTrilogyFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const content = await file.text(); // Simple text read for display
      setTrilogyFiles(prev => {
          const newFiles = [...prev];
          newFiles[index] = { name: file.name, content: content.substring(0, 100), file };
          return newFiles;
      });
  };

  const handleDeleteProject = (id: string) => {
      if (window.confirm("Are you sure you want to delete this project? This cannot be undone.")) {
          onProjectsUpdate(projects.filter(p => p.id !== id));
          addToast('info', 'Project deleted.');
      }
  };

  const ProjectTypeCard = ({ type, icon, label, desc }: { type: ProjectType, icon: React.ReactNode, label: string, desc: string }) => (
      <div onClick={() => setProjectType(type)} className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center text-center space-y-2 ${projectType === type ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
          <div className={`${projectType === type ? 'text-indigo-600' : 'text-slate-400'}`}>{icon}</div>
          <div className="font-bold text-sm text-slate-800 dark:text-white">{label}</div>
          <div className="text-xs text-slate-500">{desc}</div>
      </div>
  );

  const renderHeatmap = () => {
      const activityMap: Record<string, number> = {};
      projects.forEach(p => {
          p.activityLog?.forEach(entry => {
              activityMap[entry.date] = (activityMap[entry.date] || 0) + entry.wordCount;
          });
      });

      const days = Array.from({length: 60}).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (59 - i));
          const iso = d.toISOString().split('T')[0];
          return { date: iso, count: activityMap[iso] || 0 };
      });

      return (
          <div className="flex space-x-1 items-end h-12 mb-2 w-full overflow-hidden">
              {days.map((day, i) => {
                  const height = Math.min(100, Math.max(15, (day.count / 1000) * 100)) + '%';
                  const opacity = day.count > 0 ? 1 : 0.2;
                  const color = day.count > 2000 ? 'bg-green-500' : day.count > 500 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700';
                  return <div key={i} className={`w-2 rounded-t ${color}`} style={{ height, opacity }} title={`${day.date}: ${day.count} words`}></div>;
              })}
          </div>
      );
  };

  // Aggregate Achievements
  const allAchievements = projects.reduce((acc: Achievement[], p) => {
      const projAch = p.achievements || [];
      projAch.forEach(a => {
          if (!acc.some(ex => ex.id === a.id)) acc.push(a);
      });
      return acc;
  }, []);

  // Calculate Daily Target
  const activeNovel = projects.find(p => p.projectType === 'novel' && (p as NovelProject).targetDate) as NovelProject;
  let dailyTarget = 0;
  if (activeNovel && activeNovel.targetDate) {
      const remaining = (activeNovel.wordCountTarget || 0) - (activeNovel.currentWordCount || 0);
      const daysLeft = Math.max(1, Math.ceil((new Date(activeNovel.targetDate).getTime() - Date.now()) / (1000 * 3600 * 24)));
      dailyTarget = Math.ceil(remaining / daysLeft);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-8">
      <input type="file" ref={importBookRef} onChange={handleFileSelect} className="hidden" accept=".txt,.md,.json,.pdf,.docx" />
      <input type="file" ref={trilogyFileRefs[0]} onChange={(e) => handleTrilogyFileChange(e, 0)} className="hidden" accept=".txt,.md,.docx,.pdf" />
      <input type="file" ref={trilogyFileRefs[1]} onChange={(e) => handleTrilogyFileChange(e, 1)} className="hidden" accept=".txt,.md,.docx,.pdf" />
      <input type="file" ref={trilogyFileRefs[2]} onChange={(e) => handleTrilogyFileChange(e, 2)} className="hidden" accept=".txt,.md,.docx,.pdf" />

      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">AuthorForge Studio</h1>
              <p className="text-slate-500 text-sm mt-1">Welcome back, Author.</p>
          </div>
          <div className="flex items-center gap-4">
            {loadingState.status !== 'idle' && (
               <div className="flex items-center text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full text-sm font-medium animate-pulse">
                  <Loader2 className="animate-spin mr-2" size={16}/> {loadingState.message}
               </div>
            )}
            <ThemeToggle isDark={isDarkMode} toggle={toggleTheme} />
            <Button onClick={() => setIsUserGuideOpen(true)} variant="ghost" icon={<HelpCircle size={20} />}>
              User Guide
            </Button>
            <Button onClick={() => setShowSettings(true)} variant="ghost" icon={<Settings size={20} />} className="relative">
            </Button>
            
            <Button onClick={() => importBookRef.current?.click()} variant="secondary" icon={<Upload size={18} />}>Import Book</Button>
            <Button onClick={() => setIsTrilogyModalOpen(true)} variant="secondary" icon={<BookCopy size={18} />}>Import Trilogy</Button>
            
            <Button onClick={() => { setIsModalOpen(true); resetForm(); }} icon={<Plus size={18} />}>New Project</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Stats & Heatmap */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between">
                <div className="w-48 mb-4 md:mb-0">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center"><Flame size={14} className="mr-1 text-orange-500"/> Writing Stats</h3>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {projects.reduce((acc, p) => acc + (p.projectType === 'novel' ? ((p as NovelProject).currentWordCount || 0) : 0), 0).toLocaleString()}
                        <span className="text-xs font-normal text-slate-400 ml-2">total words</span>
                    </div>
                    {dailyTarget > 0 && (
                        <div className="mt-2 text-xs font-medium text-indigo-500 flex items-center">
                            <Target size={12} className="mr-1"/> Daily Goal: {dailyTarget}
                        </div>
                    )}
                </div>
                <div className="flex-1 md:ml-8">
                    {renderHeatmap()}
                </div>
            </div>

            {/* Trophy Cabinet */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center"><Award size={14} className="mr-1 text-amber-500"/> Achievements</h3>
                <div className="flex flex-wrap gap-3">
                    {allAchievements.length > 0 ? allAchievements.map(a => <div key={a.id} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-2xl" title={`${a.label}: ${a.description}`}>{a.icon}</div>) : <p className="text-xs text-slate-400">Start writing to unlock achievements!</p>}
                </div>
            </div>
        </div>


        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {projects.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group relative">
                <div className="p-5" onClick={() => onOpenProject(p)}>
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-lg ${
                            p.projectType === 'novel' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' :
                            p.projectType === 'journal' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                            p.projectType === 'coloring-book' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600' :
                            'bg-sky-100 dark:bg-sky-900/30 text-sky-600'
                        }`}>
                            { p.projectType === 'novel' ? <Book size={20}/> : 
                              p.projectType === 'journal' ? <Feather size={20}/> :
                              p.projectType === 'coloring-book' ? <Paintbrush size={20}/> :
                              <Share2 size={20}/> }
                        </div>
                        <div className="text-xs text-slate-400 capitalize">{p.projectType}</div>
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white truncate mb-1">{p.title}</h3>
                    {p.projectType === 'novel' && <p className="text-sm text-slate-500">{((p as NovelProject).currentWordCount || 0).toLocaleString()} words</p>}
                    {p.projectType === 'journal' && <p className="text-sm text-slate-500">{((p as JournalProject).pages || []).length} pages</p>}
                    {p.projectType === 'coloring-book' && <p className="text-sm text-slate-500">{((p as ColoringBookProject).pages || []).length} pages</p>}
                </div>
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 rounded-b-xl">
                    <div className="flex items-center"><Clock size={12} className="mr-1.5"/> Last opened: {new Date(p.lastOpened || Date.now()).toLocaleDateString()}</div>
                    <button onClick={() => handleDeleteProject(p.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition"><Trash2 size={14}/></button>
                </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Book size={64} className="mx-auto text-slate-300 mb-4"/>
                <p className="text-slate-500">You have no projects yet.</p>
                <Button onClick={() => setIsModalOpen(true)} className="mt-4">Start Your First Novel</Button>
            </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 animate-fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Create New Project</h2>
              <button type="button" onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ProjectTypeCard type="novel" icon={<Book size={24}/>} label="Novel" desc="Full-featured manuscript editor."/>
                    <ProjectTypeCard type="journal" icon={<PenTool size={24}/>} label="Journal" desc="Creative journaling & wellness."/>
                    <ProjectTypeCard type="coloring-book" icon={<Paintbrush size={24}/>} label="Coloring Book" desc="AI-illustrated pages."/>
                    <ProjectTypeCard type="marketing" icon={<Share2 size={24}/>} label="Launch Kit" desc="Social media & ad copy."/>
                </div>
                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Project Title" className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-lg font-bold" required />
                {projectType === 'novel' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Genre</label><select value={newGenre} onChange={e => setNewGenre(e.target.value as ProjectGenre)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"><option>Fantasy</option><option>Sci-Fi</option><option>Mystery</option><option>Thriller</option><option>Romance</option><option>Non-Fiction</option><option>Other</option></select></div>
                            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Target Date</label><input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Word Count Target</label><input type="number" step="1000" value={wordCountTarget} onChange={e => setWordCountTarget(Number(e.target.value))} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"/></div>
                            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Chapter Count</label><input type="number" value={chapterCount} onChange={e => setChapterCount(Number(e.target.value))} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"/></div>
                        </div>
                        <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Story Bible / Lore <span className="text-xs text-slate-400">(Optional)</span></label><textarea value={storyBible} onChange={e => setStoryBible(e.target.value)} rows={4} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700" placeholder="Paste your world-building notes..."></textarea></div>
                    </div>
                )}
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button type="submit" icon={<Plus />}>Create Project</Button>
            </div>
          </form>
        </div>
      )}

      {isTrilogyModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <form onSubmit={handleTrilogyImport} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 animate-fade-in">
                   <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                       <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><BookCopy className="mr-2 text-indigo-500"/> Import Trilogy</h2>
                       <button type="button" onClick={() => setIsTrilogyModalOpen(false)}><X size={20} className="text-slate-400" /></button>
                   </div>
                   <div className="p-6 space-y-4">
                       <p className="text-sm text-slate-600 dark:text-slate-400">Upload your three manuscripts. The AI will combine them into a single project for cohesion analysis.</p>
                       {[0, 1, 2].map(i => (
                           <div key={i}>
                               <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Book {i + 1} Manuscript</label>
                               <div className="flex items-center gap-2">
                                   <Button type="button" variant="secondary" onClick={() => handleTrilogyFileSelect(i)} className="flex-1 justify-start">
                                       {trilogyFiles[i] ? trilogyFiles[i]?.name : `Select Book ${i+1} File...`}
                                   </Button>
                               </div>
                           </div>
                       ))}
                   </div>
                   <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                       <Button type="submit" icon={<Upload />}>Import & Combine</Button>
                   </div>
               </form>
          </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {isUserGuideOpen && <UserGuideModal onClose={() => setIsUserGuideOpen(false)} />}
      
    </div>
  );
};
