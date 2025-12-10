import React, { useState, useEffect, useRef } from 'react';
import { Dashboard } from './views/Dashboard';
import { Studio } from './views/Studio';
import { Project, ToastMessage, NovelProject, Achievement } from './types';
import { loadProjects, saveProjects } from './services/storageService';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'studio'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [initialStudioView, setInitialStudioView] = useState<string | undefined>(undefined);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const saveTimeoutRef = useRef<number | null>(null);

  const addToast = (type: ToastMessage['type'], message: string, title?: string) => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, type, message, title }]);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Effect for initial loading from localStorage
  useEffect(() => {
    try {
      const loaded = loadProjects();
      setProjects(loaded);
    } catch (e) {
      console.error("Failed to load projects", e);
      addToast('error', 'Could not load projects from storage.');
    } finally {
        setIsLoaded(true);
    }
    
    const useDark = localStorage.getItem('authorforge_theme') === 'dark';
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (useDark || (!localStorage.getItem('authorforge_theme') && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Centralized save effect. Saves the entire projects array whenever it changes.
  useEffect(() => {
    // Don't save anything until the initial load is complete.
    if (!isLoaded) {
        return;
    }

    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
        try {
            saveProjects(projects);
        } catch (e) {
            console.error("Failed to save projects", e);
            addToast('error', 'Storage full. Some changes may not be saved.');
        }
    }, 1500); // Debounce saving

    return () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
    };
  }, [projects, isLoaded]);


  const toggleTheme = () => {
    setIsDarkMode(prev => {
        const isDark = !prev;
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('authorforge_theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('authorforge_theme', 'light');
        }
        return isDark;
    });
  };

  const handleOpenProject = (project: Project, initialView?: string) => {
    const updatedProject = { ...project, lastOpened: Date.now() };
    setCurrentProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    setInitialStudioView(initialView);
    setView('studio');
  };

  const awardAchievement = (project: NovelProject, id: string, label: string, icon: string, description: string): NovelProject => {
      if (!(project.achievements || []).some(a => a.id === id)) {
          const newAchievement: Achievement = { id, label, icon, description, unlockedAt: Date.now() };
          addToast('success', `Achievement Unlocked: ${label}`, '🏆');
          return { ...project, achievements: [...(project.achievements || []), newAchievement] };
      }
      return project;
  };

  const handleUpdateProject = (updatedProject: Project) => {
    let projectWithAchievements = updatedProject;
    if (projectWithAchievements.projectType === 'novel') {
        let novel = projectWithAchievements as NovelProject;
        const oldNovel = (currentProject?.id === novel.id ? currentProject : projects.find(p => p.id === novel.id)) as NovelProject | undefined;

        // Word count achievements
        if (novel.currentWordCount >= 1000 && (!oldNovel || oldNovel.currentWordCount < 1000)) novel = awardAchievement(novel, '1k_words', 'Novice', '✍️', 'Wrote 1,000 words in a project.');
        if (novel.currentWordCount >= 10000 && (!oldNovel || oldNovel.currentWordCount < 10000)) novel = awardAchievement(novel, '10k_words', 'Scribe', '📜', 'Wrote 10,000 words in a project.');
        if (novel.currentWordCount >= 50000 && (!oldNovel || oldNovel.currentWordCount < 50000)) novel = awardAchievement(novel, '50k_words', 'Author', '✒️', 'Wrote 50,000 words in a project.');
        
        // Feature usage achievements
        if (novel.storyAnalysis && (!oldNovel || !oldNovel.storyAnalysis)) {
             novel = awardAchievement(novel, 'story_analyzer', 'Architect', '🏛️', 'Used the Story Analyzer for the first time.');
        }
        
        projectWithAchievements = novel;
    }

    // Update both currentProject (for immediate UI response in Studio) and the master projects list (for saving and consistency).
    setCurrentProject(projectWithAchievements);
    setProjects(prev => prev.map(p => p.id === projectWithAchievements.id ? projectWithAchievements : p));
  };
  
  const handleAddProjects = (newProjects: Project[]) => {
      setProjects(prev => [...prev, ...newProjects]);
  };

  const handleBackToDashboard = () => {
    setCurrentProject(null);
    setInitialStudioView(undefined);
    setView('dashboard');
  };

  if (!isLoaded) {
      return <div className="min-h-screen bg-gray-50 dark:bg-slate-950"></div>; // Render a blank screen or a loader
  }

  return (
    <ErrorBoundary>
      {view === 'dashboard' && (
        <Dashboard 
          projects={projects} 
          onOpenProject={handleOpenProject}
          onProjectsUpdate={setProjects}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          addToast={addToast}
        />
      )}
      {view === 'studio' && currentProject && (
        <Studio 
          project={currentProject} 
          onUpdateProject={handleUpdateProject}
          onAddProjects={handleAddProjects}
          onBack={handleBackToDashboard}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          initialView={initialStudioView}
          addToast={addToast}
          allProjects={projects}
        />
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ErrorBoundary>
  );
};

export default App;
