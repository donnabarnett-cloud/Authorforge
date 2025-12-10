import { Project, NovelProject, ProjectGenre, ProjectType, JournalProject, MarketingProject, AIAgent, ColoringBookProject, Character, ColoringPage, BookOutline, ChapterOutline, TrashItem, JournalPage } from '../types';
import { v4 as uuidv4 } from 'uuid';

const LEGACY_STORAGE_KEY = 'authorforge_projects';

// Safe wrapper for localStorage
const safeStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.error("LocalStorage access failed", e);
            return null;
        }
    },
    setItem: (key: string, value: string): boolean => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.error("LocalStorage quota exceeded");
                alert("Warning: Local Storage is full. Your latest changes might not be saved. Please export your projects or delete old ones.");
            } else {
                console.error("LocalStorage write failed", e);
            }
            return false;
        }
    }
};

// Helper function to safely filter arrays of objects, removing nulls or non-objects
const sanitizeArray = <T>(arr: any): T[] => {
    if (!Array.isArray(arr)) {
        return [];
    }
    return arr.filter(item => item && typeof item === 'object') as T[];
};

export const loadProjects = (): Project[] => {
    const data: string | null = safeStorage.getItem(LEGACY_STORAGE_KEY);
    
    if (!data) {
        return [];
    }
    
    let parsedData: any;
    try {
        parsedData = JSON.parse(data);
        if (!Array.isArray(parsedData)) {
            throw new Error("Stored data is not an array.");
        }
    } catch (e) {
        console.error("Project data corrupted, creating backup.", e);
        safeStorage.setItem(LEGACY_STORAGE_KEY + '_corrupt_backup_' + Date.now(), data);
        return [];
    }

    // Stage 1: Filter out completely invalid entries (null, not objects, or missing critical keys)
    const rawProjects: any[] = parsedData.filter((p: any) => p && typeof p === 'object' && p.id && p.projectType);

    // Stage 2: Deep migration and validation for each project
    return rawProjects.map((p: any) => {
        // --- BASE PROJECT DEFAULTS ---
        const migratedProject: Project = {
            id: p.id,
            projectType: p.projectType,
            title: typeof p.title === 'string' ? p.title : "Untitled Project",
            author: typeof p.author === 'string' ? p.author : "Author",
            createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
            lastOpened: typeof p.lastOpened === 'number' ? p.lastOpened : Date.now(),
            activityLog: sanitizeArray(p.activityLog),
            achievements: sanitizeArray(p.achievements),
            recycleBin: sanitizeArray(p.recycleBin),
            team: sanitizeArray(p.team),
        };

        // --- PROJECT-TYPE SPECIFIC MIGRATION ---
        if (migratedProject.projectType === 'novel') {
            const novel = migratedProject as NovelProject;
            novel.genre = p.genre || ProjectGenre.OTHER;
            novel.writingMode = p.writingMode || 'fiction';
            novel.wordCountTarget = typeof p.wordCountTarget === 'number' ? p.wordCountTarget : 50000;
            novel.chapterCountTarget = typeof p.chapterCountTarget === 'number' ? p.chapterCountTarget : 20;
            novel.synopsis = typeof p.synopsis === 'string' ? p.synopsis : "";
            novel.storyBible = typeof p.storyBible === 'string' ? p.storyBible : "";
            novel.styleGuide = typeof p.styleGuide === 'string' ? p.styleGuide : "";
            novel.language = typeof p.language === 'string' ? p.language : "UK English";
            novel.editorFont = p.editorFont || 'serif';
            
            novel.chapters = sanitizeArray(p.chapters).map((c: any) => ({
                id: c.id || uuidv4(),
                title: typeof c.title === 'string' ? c.title : 'Untitled Chapter',
                content: typeof c.content === 'string' ? c.content : '',
                wordCount: typeof c.wordCount === 'number' ? c.wordCount : (c.content || "").split(/\s+/).filter(Boolean).length,
                lastModified: typeof c.lastModified === 'number' ? c.lastModified : Date.now(),
                snapshots: sanitizeArray(c.snapshots),
            }));

            // **CRITICAL DATA INTEGRITY FIX**: Recalculate total word count from sanitized chapters.
            novel.currentWordCount = novel.chapters.reduce((acc, ch) => acc + (ch.wordCount || 0), 0);
            
            novel.characters = sanitizeArray(p.characters);
            novel.worldItems = sanitizeArray(p.worldItems);
            novel.moodBoard = sanitizeArray(p.moodBoard);
        } else if (migratedProject.projectType === 'journal') {
            const journal = migratedProject as JournalProject;
            journal.pages = sanitizeArray<JournalPage>(p.pages);
            journal.pages.forEach(page => {
                page.stickers = sanitizeArray(page.stickers);
            });
        } else if (migratedProject.projectType === 'coloring-book') {
            const cb = migratedProject as ColoringBookProject;
            cb.characters = sanitizeArray(p.characters);
            cb.pages = sanitizeArray(p.pages);
        } else if (migratedProject.projectType === 'marketing') {
            const marketing = migratedProject as MarketingProject;
            if (p.assets && typeof p.assets === 'object') {
                 marketing.assets = {
                    blurbs: sanitizeArray(p.assets.blurbs),
                    socialPosts: sanitizeArray(p.assets.socialPosts),
                    adCopy: sanitizeArray(p.assets.adCopy),
                    keywords: sanitizeArray(p.assets.keywords),
                    trailer: sanitizeArray(p.assets.trailer),
                    trendingTopics: sanitizeArray(p.assets.trendingTopics),
                    contentCalendar: sanitizeArray(p.assets.contentCalendar),
                    articles: sanitizeArray(p.assets.articles),
                 }
            } else {
                marketing.assets = { blurbs: [], socialPosts: [], adCopy: [], keywords: [] };
            }
        }
        
        return migratedProject;
    });
};

export const saveProjects = (projects: Project[]) => {
    const data = JSON.stringify(projects);
    safeStorage.setItem(LEGACY_STORAGE_KEY, data);
};

const DEFAULT_TEAM: AIAgent[] = [
    {
        id: 'agent_architect',
        name: 'The Architect',
        role: 'Plotter',
        expertise: ['Structure', 'Pacing', 'Outlining', 'World Building'],
        personality: 'Logical, structural, and big-picture focused.',
        systemPrompt: 'You are The Architect. Focus on story structure, beats, and logical consistency. Ignore prose quality; prioritize plot mechanics.',
        avatar: '📐'
    },
    {
        id: 'agent_wordsmith',
        name: 'The Wordsmith',
        role: 'Drafter',
        expertise: ['Prose', 'Dialogue', 'Description', 'Voice'],
        personality: 'Creative, poetic, and flow-obsessed.',
        systemPrompt: 'You are The Wordsmith. Focus on beautiful prose, sensory details, and character voice. Prioritize "Show, Don\'t Tell".',
        avatar: '🖋️'
    },
    {
        id: 'agent_critic',
        name: 'The Critic',
        role: 'Editor',
        expertise: ['Grammar', 'Consistency', 'Clarity', 'Marketability'],
        personality: 'Sharp, critical, and brutally honest.',
        systemPrompt: 'You are The Critic. Act as a ruthless editor. Find weak verbs, adverbs, and plot holes. Do not sugarcoat feedback.',
        avatar: '🧐'
    },
    {
        id: 'agent_publicist',
        name: 'The Publicist',
        role: 'Marketer',
        expertise: ['Blurbs', 'Hooks', 'Social Media', 'Ad Copy'],
        personality: 'Hype-man, persuasive, and trend-aware.',
        systemPrompt: 'You are The Publicist. Focus on selling the story. Write catchy hooks, blurbs, and tweets. Think about the target audience.',
        avatar: '📣'
    }
];

export const createNewProject = (
    title: string, 
    projectType: ProjectType, 
    genre: ProjectGenre = ProjectGenre.OTHER, 
    author: string = "Author", 
    wordCountTarget: number = 50000, 
    chapterCountTarget: number = 20,
    storyBible: string = "",
    styleGuide: string = "",
    language: string = "UK English",
    characters: any[] = [],
    worldItems: any[] = [],
    writingMode: 'fiction' | 'non-fiction' = 'fiction',
    targetDate: string = ""
): Project => {
    const base: Project = {
        id: uuidv4(),
        projectType,
        title,
        author,
        createdAt: Date.now(),
        lastOpened: Date.now(),
        activityLog: [],
        achievements: [],
        recycleBin: [],
        team: [...DEFAULT_TEAM]
    };

    if (projectType === 'novel') {
        const novel: NovelProject = {
            ...base,
            projectType: 'novel',
            genre,
            writingMode,
            wordCountTarget,
            chapterCountTarget,
            currentWordCount: 0,
            synopsis: "",
            storyBible,
            styleGuide,
            language,
            targetDate,
            chapters: Array.from({ length: chapterCountTarget || 1 }, (_, i) => ({
                id: uuidv4(),
                title: `Chapter ${i + 1}`,
                content: '',
                wordCount: 0,
                lastModified: Date.now(),
                snapshots: []
            })),
            characters: characters || [],
            worldItems: worldItems || [],
            editorFont: 'serif'
        };
        return novel;
    } else if (projectType === 'journal') {
        const journal: JournalProject = {
            ...base,
            projectType: 'journal',
            pageSize: 'A4',
            style: 'minimal',
            pageCount: 1,
            pages: [{
                id: uuidv4(),
                type: 'lined',
                title: 'Page 1',
                content: '',
                stickers: [],
                inkColor: '#1e293b'
            }]
        };
        return journal;
    } else if (projectType === 'coloring-book') {
        const coloringBook: ColoringBookProject = {
            ...base,
            projectType: 'coloring-book',
            theme: "Enchanted Forests",
            style: "Intricate Line Art",
            pageSize: 'A4',
            characters: [] as Character[],
            pages: [] as ColoringPage[],
        };
        return coloringBook;
    }
     else {
        const marketing: MarketingProject = {
            ...base,
            projectType: 'marketing',
            assets: {
                blurbs: [],
                socialPosts: [],
                adCopy: [],
                keywords: []
            }
        };
        return marketing;
    }
};

export const createTrilogyProjects = (
    original: NovelProject,
    bookOutlines: BookOutline[],
    bookConfigs: { title: string; chapterCount: number; wordCountTarget: number }[]
): NovelProject[] => {
    
    const createVolume = (outline: BookOutline, volumeNumber: number): NovelProject => {
        const config = bookConfigs[volumeNumber - 1]; // Get user config for this book

        const clone: Partial<NovelProject> = {
            id: uuidv4(),
            projectType: 'novel',
            title: outline.title,
            author: original.author,
            genre: original.genre,
            writingMode: original.writingMode,
            storyBible: original.storyBible,
            styleGuide: original.styleGuide,
            language: original.language,
            characters: original.characters, // Share characters
            worldItems: original.worldItems, // Share world items
            team: original.team,
            editorFont: original.editorFont,
            createdAt: Date.now(),
            lastOpened: Date.now(),
            activityLog: [],
            achievements: [],
            recycleBin: [],
        };
        
        clone.chapters = outline.chapters.map((chOutline) => ({
            id: uuidv4(),
            title: chOutline.title,
            content: '', // Content is empty, ready for the ghostwriter
            summary: chOutline.plotSummary, // The plot outline goes into the summary
            wordCount: 0,
            lastModified: Date.now(),
        }));
        
        // Use user-defined word count target and actual chapter count from AI outline
        clone.wordCountTarget = config.wordCountTarget;
        clone.chapterCountTarget = outline.chapters.length; // Use actual length for accuracy
        clone.currentWordCount = 0;
        clone.synopsis = `Book ${volumeNumber} of the ${original.title} series.`;

        return clone as NovelProject;
    };

    // Creates projects for all outlines provided (1, 2, 3...)
    return bookOutlines.map((outline, i) => createVolume(outline, i + 1));
};


export const restoreFromTrash = (project: Project, trashId: string): { project: Project, restored: boolean } => {
    const bin = project.recycleBin || [];
    const item = bin.find(i => i.id === trashId);
    if (!item) return { project, restored: false };
    
    // Deep clone to ensure we don't accidentally mutate state before we're ready
    let newProject = JSON.parse(JSON.stringify(project));
    let restored = false;
    
    // Helper to avoid ID collisions
    const safeRestore = (collection: any[], data: any, nameField: string = 'name') => {
        // If the ID already exists in the collection (unlikely but possible), generate a new one
        const exists = collection.some(i => i.id === data.id);
        if (exists) {
            return {
                ...data,
                id: uuidv4(),
                [nameField]: `${data[nameField]} (Restored)`
            };
        }
        return data;
    };

    if (project.projectType === 'novel') {
        const novel = newProject as NovelProject;
        if (item.type === 'chapter' && item.data) {
            const restoredChapter = safeRestore(novel.chapters, item.data, 'title');
            novel.chapters.push(restoredChapter);
            restored = true;
        } else if (item.type === 'character' && item.data) {
            const restoredChar = safeRestore(novel.characters, item.data, 'name');
            novel.characters.push(restoredChar);
            restored = true;
        } else if (item.type === 'worldItem' && item.data) {
            const restoredItem = safeRestore(novel.worldItems, item.data, 'name');
            novel.worldItems.push(restoredItem);
            restored = true;
        }
    } else if (project.projectType === 'journal') {
        const journal = newProject as JournalProject;
        if (item.type === 'page' && item.data) {
            const restoredPage = safeRestore(journal.pages, item.data, 'title');
            journal.pages.push(restoredPage);
            restored = true;
        }
    }
    
    // Only remove from bin if successfully restored to the collection
    if (restored) {
        newProject.recycleBin = bin.filter((i: any) => i.id !== trashId);
    }
    
    return { project: newProject, restored };
};

export const exportBackup = () => {
    const projects = loadProjects();
    const settings = localStorage.getItem('authorforge_ai_settings');
    const backup = {
        version: 1,
        timestamp: Date.now(),
        projects,
        settings: settings ? JSON.parse(settings) : {}
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `authorforge_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const importBackup = (fileContent: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            const backup = JSON.parse(fileContent);
            
            if (backup.projects) {
                saveProjects(backup.projects);
            }
            if (backup.settings) {
                localStorage.setItem('authorforge_ai_settings', JSON.stringify(backup.settings));
            }
            resolve();
        } catch (err) {
            console.error("Failed to parse backup file", err);
            reject(err);
        }
    });
};