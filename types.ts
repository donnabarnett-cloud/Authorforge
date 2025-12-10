import { v4 as uuidv4 } from 'uuid';

export interface IllustrationPrompt {
    prompt: string;
    style: string;
    subject: string;
}

export type AIProvider = 'gemini' | 'webllm' | 'unknown';

export interface ApiKey {
  id: string;
  key: string;
  provider: AIProvider;
  status: 'valid' | 'invalid' | 'pending';
  model?: string;
}

export interface AISettings {
  apiKeys: ApiKey[];
  activeProvider: AIProvider;
  webLlmModelId?: string;
  
  // Common settings
  dailyTokenLimit: number;
  modelConfig: { temperature: number, topK: number, topP: number };
  globalSystemPrompt?: string;
  userPreferences?: {
    style?: string;
    tone?: string;
  };
}


export interface AIChatMessage {
  id: string;
  role: 'model' | 'user';
  text: string;
  timestamp: number;
  personaId?: string;
  parts?: any[];
  attachment?: {
    fileName: string;
    content: string;
  };
}

export interface Artifact {
  id: string;
  type: 'application/vnd.ant.code' | 'text/markdown' | 'image/svg+xml';
  title: string;
  content: string;
  language?: string;
}

export interface AIAgent {
    id: string;
    name: string;
    role: string;
    expertise: string[];
    personality: string;
    systemPrompt: string;
    avatar: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  traits: string[];
  relationships?: Relationship[];
  visualSummary?: string; // Visual Anchor for consistent image generation
}

export interface Relationship {
  targetId: string;
  targetName: string;
  type: string;
  description: string;
}

export interface WorldItem {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface ChapterSnapshot {
  id: string;
  timestamp: number;
  content: string;
  wordCount: number;
  note: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  lastModified: number;
  summary?: string;
  lastAnalysis?: AnalysisResult;
  snapshots?: ChapterSnapshot[];
  status?: 'draft' | 'progress' | 'review' | 'done';
  tags?: string[];
}

export enum ProjectGenre {
  FANTASY = 'Fantasy',
  SCIFI = 'Sci-Fi',
  MYSTERY = 'Mystery',
  THRILLER = 'Thriller',
  ROMANCE = 'Romance',
  NONFICTION = 'Non-Fiction',
  OTHER = 'Other'
}

export type ProjectType = 'novel' | 'journal' | 'marketing' | 'coloring-book';

export interface Achievement {
  id: string;
  label: string;
  icon: string;
  description: string;
  unlockedAt?: number;
}

export interface TrashItem {
  id: string;
  originalId: string;
  type: 'chapter' | 'character' | 'worldItem' | 'page';
  name: string;
  data: any;
  deletedAt: number;
}

export interface MoodBoardItem {
    id: string;
    url: string;
    caption: string;
    type: 'character' | 'setting' | 'vibe';
}

export interface Project {
  id: string;
  projectType: ProjectType;
  title: string;
  author: string;
  createdAt: number;
  lastOpened: number;
  activityLog: { date: string, wordCount: number }[];
  achievements: Achievement[];
  recycleBin: TrashItem[];
  team?: AIAgent[];
}

export interface SEOArticle {
    id: string;
    topic: string;
    content: string;
    keywords: string[];
    score?: SEOScore;
    status: 'draft' | 'published';
}

// --- NEW MARKET RESEARCH TYPES ---
export interface KeywordAnalysis {
  keyword: string;
  searchVolume: string;
  competition: string;
  earningsPotential: string;
}

export interface CompetitorAnalysis {
  title: string;
  author: string;
  estimatedMonthlySales: string;
  primaryKeywords: string[];
  categories: { name: string, rank: number }[];
}

export interface CategoryAnalysis {
  categoryName: string;
  path: string;
  salesToBestseller: number;
}

export interface CoverDesign {
    imageUrl: string;
    prompt: string;
}

export interface ViralMoment {
    description: string;
    prompt: string;
}

export interface ColoringPage {
    id: string;
    imageUrl: string;
    caption: string;
    prompt: string;
}

export interface ListingOptimization {
  titleSuggestions: string[];
  subtitleSuggestions: string[];
  amazonDescription: string;
}

export interface MarketingData {
    trends?: TrendingTopic[];
    articles?: SEOArticle[];
    calendar?: ScheduledPost[];
    coverConcepts?: string[];
    website?: { html: string };
    keywordAnalysis?: KeywordAnalysis[];
    competitorAnalysis?: CompetitorAnalysis[];
    categoryAnalysis?: CategoryAnalysis[];
    coverDesigns?: CoverDesign[];
    viralMoments?: ViralMoment[];
    coloringBookPages?: ColoringPage[];
    finalCoverUrl?: string;
    listingOptimization?: ListingOptimization;
}

// --- NEW BOOK FORMATTING TYPE ---
export interface BookFormatSettings {
  trimSize: '5x8' | '5.5x8.5' | '6x9';
  fontSize: number;
  lineHeight: number;
  fontFamily: 'Merriweather' | 'Crimson Pro' | 'Playfair Display';
  includeTitlePage: boolean;
  includeCopyright: boolean;
  theme: 'classic' | 'modern' | 'ornate';
  chapterHeadingStyle: 'default' | 'centered' | 'fancy-line';
  sceneBreakStyle: 'asterisks' | 'line' | 'flourish';
}

// --- STORY ANALYZER TYPES ---
export interface SynopsisAnalysis {
  logline: string;
  fullSynopsis: string;
}
export interface TimelineEvent {
  event: string;
  chapterId: string;
  chapterTitle: string;
}
export interface CharacterArc {
  characterName: string;
  arcSummary: string;
  keyMoments: { chapterTitle: string; description: string }[];
}
export interface PlotThread {
  thread: string;
  setup: { chapterTitle: string; description: string };
  payoff: { chapterTitle: string; description: string; status: 'resolved' | 'unresolved' | 'partial' };
}
export interface Subplot {
  title: string;
  summary: string;
  progression: 'setup' | 'developing' | 'resolved' | 'abandoned';
  involvedCharacters: string[];
}
export interface ForeshadowingOpportunity {
  element: string;
  suggestion: string;
  chapterTitle: string;
}

// --- NEW TRILOGY ANALYSIS TYPES ---
export interface TrilogyNamingIssue {
  issueType: 'duplicate' | 'similar' | 'inconsistentSpelling';
  namesInvolved: string[];
  details: string;
  location: string;
}

export interface TrilogyTimelineIssue {
  characterName: string;
  issue: string; // e.g., "Inconsistent age progression"
  details: string;
  chaptersInvolved: string[];
}

export interface TrilogyFlowAnalysis {
    book1to2: string; // Analysis of the transition
    book2to3: string;
    overallArc?: string;
}

export interface TrilogyCohesionReport {
  namingIssues: TrilogyNamingIssue[];
  timelineIssues: TrilogyTimelineIssue[];
  flowAnalysis: TrilogyFlowAnalysis;
}

export interface StoryAnalysis {
  synopsis: SynopsisAnalysis;
  timeline: TimelineEvent[];
  characterArcs: CharacterArc[];
  plotThreads: PlotThread[];
  subplots: Subplot[];
  foreshadowing: ForeshadowingOpportunity[];
  projectHealth?: ProjectHealth;
  continuityIssues?: ContinuityIssue[];
  trilogyReport?: TrilogyCohesionReport;
}

export interface NovelProject extends Project {
  projectType: 'novel';
  genre: ProjectGenre;
  writingMode: 'fiction' | 'non-fiction';
  wordCountTarget: number;
  chapterCountTarget: number;
  currentWordCount: number;
  synopsis: string;
  storyBible: string;
  styleGuide: string;
  language: string;
  chapters: Chapter[];
  characters: Character[];
  worldItems: WorldItem[];
  editorFont?: 'serif' | 'sans' | 'mono';
  targetDate?: string;
  moodBoard?: MoodBoardItem[];
  marketingData?: MarketingData;
  formatSettings?: BookFormatSettings;
  storyAnalysis?: StoryAnalysis;
}

export interface Sticker {
  id: string;
  type: 'icon' | 'image';
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface JournalPage {
  id: string;
  type: 'lined' | 'dot' | 'grid' | 'blank' 
      // Wellness
      | 'gratitude-log' | 'mood-tracker' | 'dream-log' | 'symptom-tracker'
      // Productivity
      | 'weekly-planner' | 'monthly-calendar' | 'habit-tracker' | 'goal-planner'
      // Creative
      | 'story-idea-generator' | 'character-profile'
      // Financial
      | 'budget-tracker' | 'expense-log'
      // Legacy / Simple
      | 'planner' | 'tracker' | 'prompt' 
      // Upgraded simple templates
      | 'daily-stoic' | 'reading-log' | 'fitness-tracker' | 'project-planner' | 'mind-map';
  title: string;
  content: string;
  stickers?: Sticker[];
  inkColor?: string;
  backgroundUrl?: string;
  font?: 'serif' | 'sans' | 'handwriting';
  dreamIllustrationUrl?: string;
}

export interface JournalProject extends Project {
    projectType: 'journal';
    pageSize: 'A4' | 'A5' | 'US-Letter';
    style: string;
    pageCount: number;
    pages: JournalPage[];
}

export interface ColoringBookProject extends Project {
  projectType: 'coloring-book';
  theme: string;
  style: string;
  pageSize: 'A4' | 'A5' | 'US-Letter';
  characters: Character[];
  pages: ColoringPage[];
  pageCount?: number;
}

export type SocialPlatform = 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'blog' | 'newsletter';

export interface MarketingPost {
  platform: SocialPlatform;
  content: string;
  hashtags: string[];
  imagePrompt?: string;
  scheduleDate?: string;
}

export interface ScheduledPost extends MarketingPost {
    id: string;
    status: 'draft' | 'scheduled' | 'published';
}

export interface TrailerScene {
    id: string;
    imageUrl?: string;
    text: string;
    duration: number;
    transition: 'fade' | 'cut';
}

export interface TrendingTopic {
    id: string;
    topic: string;
    volume: string;
    relevance: number;
    sourceUrl?: string;
    selected?: boolean;
}

export interface SEOScore {
    score: number;
    keywordDensity: number;
    readability: string;
    suggestions: string[];
    metaDescription: string;
    slug: string;
}

export interface MarketingProject extends Project {
    projectType: 'marketing';
    assets: {
        blurbs: string[];
        socialPosts: MarketingPost[];
        adCopy: string[];
        keywords: string[];
        trailer?: TrailerScene[];
        trendingTopics?: TrendingTopic[];
        contentCalendar?: ScheduledPost[];
        articles?: SEOArticle[];
    };
}

export interface AnalysisIssue {
  type: string;
  description: string;
  severity: string;
  location?: string;
  suggestion?: string;
}

export interface HeuristicStats {
  adverbCount: number;
  adverbRate: number;
  passiveCount: number;
  passiveRate: number;
  sentenceCount: number;
  avgSentenceLength: number;
  dialogueRatio: number;
  paragraphStats: { id: number, wordCount: number, avgSentenceLength: number }[];
  fillerWordCount: number;
  weakVerbCount: number;
  sentenceVarietyScore: number;
  clicheCount: number;
  glueIndex: number;
  repetitiveStarts: number;
  sentenceLengthDistribution?: { short: number; medium: number; long: number; veryLong: number };
  paragraphLengthDistribution?: { short: number; medium: number; long: number };
}

export interface GenreAnalysis {
  score: number;
  rationale: string;
}

export interface AnalysisResult {
  qualityScore: number;
  readabilityScore?: number;
  tone?: string;
  pacing?: string;
  suggestions: string[];
  issues: AnalysisIssue[];
  bestsellerComparison?: { verdict: string, dialogueTarget?: number, adverbTarget?: number };
  heuristics?: HeuristicStats;
  readerExperience?: { emotionalVerdict: string };
  timestamp?: number;
  genreAnalysis?: GenreAnalysis;
}

export interface UserTestReport {
    summary: string;
    logs: TestLog[];
    status: 'pass' | 'fail';
}

export interface TestLog {
    id: string;
    step: string;
    status: 'pass' | 'fail' | 'info' | 'warning';
    message: string;
    timestamp: number;
    latency?: number;
}

export interface ProjectHealth {
  characterUsage: { name: string, count: number }[];
  povBalance: { name: string, percentage: number }[];
  pacingMap: { chapterId: string, title: string, pacingScore: number, tensionScore: number }[];
  globalIssues: string[];
  conflictProgression: { chapterTitle: string; conflict: string }[];
}

export interface MediaAnalysisResult {
  description: string;
  tags: string[];
  insights: string;
}

export interface SceneBeat {
  type: string;
  description: string;
  status: 'strong' | 'weak' | 'missing';
  suggestion?: string;
}

export interface AudienceProfile {
  demographic: string;
  psychographics: string;
  compTitles: string[];
  hashtags: string[];
}

export interface ContinuityIssue {
  type: string;
  description: string;
  location: string;
  severity: string;
}

export interface BetaReaderFeedback {
  readerId: string;
  reaction: string;
  rating: number;
  quote: string;
  emotion: string;
}

export interface BetaReaderPersona {
  id: string;
  name: string;
  type: string;
  avatar: string;
  description: string;
}

export interface SearchResult {
  id: string;
}

export interface GlobalEditSuggestion {
    id: string;
    chapterId: string;
    chapterTitle: string;
    originalText: string;
    suggestedText: string;
    rationale: string;
    type: 'consistency' | 'pacing' | 'prose' | 'dialogue' | 'plot';
}

export interface GlobalEditState {
    isRunning: boolean;
    progress: number; // 0-100
    statusText: string;
    suggestions: GlobalEditSuggestion[];
}

export interface TrilogyIssueAndFix {
    id: string;
    type: 'Plot Hole' | 'Continuity' | 'Character Arc' | 'Pacing' | 'Structural';
    description: string;
    chaptersInvolved: { chapterId: string; chapterTitle: string; }[];
    suggestedFix: string; // This will be a detailed instruction for a rewrite
}

export interface TrilogyDoctorState {
    isRunning: boolean;
    statusText: string;
    issues: TrilogyIssueAndFix[];
}

export interface UATActions {
    navigateSidebar: (tab: string) => Promise<void>;
    selectChapter: (id: string) => Promise<void>;
    addChapter: () => Promise<void>;
    typeInEditor: (text: string) => Promise<void>;
    openRightPanel: () => void;
    runOmniSweep: () => Promise<AnalysisResult | null>;
    applyFixes: () => Promise<void>;
    getEditorContent: () => string;
    getProjectContext: () => { genre: string, title: string, bible: string, style: string, previousContext: string, characters: string };
    getChapterList: () => { id: string, title: string }[];
    getCurrentChapterId: () => string | null;
    getCurrentChapterWordCount: () => number;
    getAverageChapterWordCount: () => number;
    getLastAnalysis: () => AnalysisResult | null;
    exportProject: () => void;
    saveProject: () => void;
    toggleFeature: (feature: 'zen' | 'xray' | 'typewriter' | 'help') => void;
    getProjectType: () => ProjectType;
    createCharacter: () => Promise<void>;
    createWorldItem: () => Promise<void>;
    openCommandPalette: () => void;
    addToMoodboard: () => Promise<void>;
    corkboardReorder: () => Promise<void>;
    addJournalPage: () => Promise<void>;
    addJournalSticker: () => Promise<void>;
    generateMarketingAsset: () => Promise<void>;
    toggleTheme: () => void;
    getTeam: () => AIAgent[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
}

export interface TestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail';
  duration: number;
}

export interface BookSweepStatus {
  chapterId: string;
  status: 'idle' | 'analyzing' | 'analyzed' | 'rewriting' | 'complete' | 'skipped';
  issuesFixed: number;
  score: number;
  analysis?: AnalysisResult;
}

export interface ChapterOutline {
    title: string;
    plotSummary: string;
}
export interface BookOutline {
    title: string;
    chapters: ChapterOutline[];
}