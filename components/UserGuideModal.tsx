import React from 'react';
import { X, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from './Button';

interface UserGuideModalProps {
    onClose: () => void;
}

const guideContent = `
# Welcome to AuthorForge Studio!

This guide will walk you through every feature of the app to help you get the most out of your AI-powered writing partner.

## 1. Getting Started: The Dashboard

The Dashboard is your central hub for managing all your creative projects.

-   **New Project:** Click this to create a new project. You can choose from:
    -   **Novel:** The core experience for writing long-form fiction or non-fiction.
    -   **Journal:** A creative space for journaling, wellness tracking, and idea generation.
    -   **Coloring Book:** An AI-powered tool to generate beautiful, intricate coloring book pages from a theme or even from your novel.
    -   **Launch Kit:** A dedicated workspace for generating marketing assets like social media posts and ad copy.
-   **Import Book:** Have an existing manuscript? Import a \`.docx\`, \`.pdf\`, or \`.txt\` file, and the AI will automatically split it into chapters for you.
-   **Import Trilogy:** For authors working on a series, this allows you to import three separate manuscript files. The AI combines them into a single, unified project, perfect for running the **Trilogy Cohesion** analysis.

## 2. The Studio: Your Creative Cockpit

Opening a project takes you to the Studio, which is divided into three main sections.

### The Left Sidebar: Navigation & Tools

This is your main navigation panel.

-   **Manuscript:** View and manage all your chapters. Click a chapter to open it in the editor.
-   **Corkboard:** A visual representation of your story. Drag and drop chapter cards to reorder your plot, and use the AI to generate summaries for each.
-   **Characters, World Bible:** Your story's database. Create detailed profiles for characters and lore. The AI uses this information to maintain consistency when writing.
-   **Media Studio:** A creative suite for generating visual assets. Design book covers, generate concept art, or create promotional videos with the Veo model.
-   **Publishing:** Your launchpad. Access powerful market research tools, an Amazon listing optimizer, and a social media campaign generator.
-   **AI Team & Muse Chat:** Advanced AI interaction tools (more on these later).
-   **Quick Action Buttons (Bottom):**
    -   **Analyzer (Story Analyzer):** A deep-dive structural edit of your entire novel.
    -   **Ghost (Ghostwriter Console):** Put the AI on autopilot to write or polish chapters.
    -   **Doctor (Manuscript Doctor):** A project-wide scan that finds and suggests fixes for prose, pacing, and dialogue issues *in the background*.
    -   **Trilogy (Trilogy Deconstructor):** Expand a single, finished manuscript into a detailed, three-book outline.

### The Center Panel: The Editor

This is where you write. It's more than just a text box:

-   **Zen Mode:** A full-screen, distraction-free writing environment.
-   **AI Brush:** Highlight any text to bring up a magic menu. You can improve prose, fix grammar, or even inject sensory details (sight, sound, etc.).
-   **Deep Line Edit:** A powerful AI edit that reads your *entire manuscript* for context before refining a single sentence or paragraph, ensuring character voice and plot consistency are maintained.
-   **X-Ray Mode:** A read-only view that highlights potential writing issues like adverbs and passive voice.

### The Right Panel: Your AI Partner

This panel is your co-pilot.

-   **Chat:** Have a conversation with the AI, one of your characters, or a specialized agent from your AI Team.
-   **Sweep (Omni-Sweep):** A professional-grade analysis of the *current chapter*. It provides a "Bestseller Potential" score and detailed feedback on pacing, prose, and genre fit.
-   **Scene (Scene Doctor):** Breaks down your current scene into its core beats (Goal, Conflict, Disaster, etc.) and tells you what's strong or weak.
-   **Readers (AI Focus Group):** Get instant feedback on your chapter from a panel of simulated beta readers, from a fawning fan to a harsh critic.

## 3. Core AI Features: Tips & Tricks

-   **Ghostwriter Console:** When using this on a new project (like one created from the Trilogy Splitter), the AI is smart. If a previous chapter is empty, it will read that chapter's *summary* from the Corkboard to get context. **Pro Tip:** A detailed outline on the Corkboard leads to a much more consistent first draft from the Ghostwriter.
-   **Manuscript Doctor:** This is a background task! You can start a scan, close the window, and keep writing. The results will stream in as they're found, and you can review them at any time.
-   **Story Analyzer vs. Omni-Sweep:** The **Story Analyzer** (from the sidebar) is a *whole-book* structural analysis. It looks for plot holes, character arc issues, and continuity errors across all chapters. The **Omni-Sweep** (in the right panel) is a *single-chapter* line-edit and quality check. Use both for a comprehensive edit.

## 4. Publishing & Marketing: From Draft to Launch

The **Publishing** tab in the sidebar is your KDP command center.

-   **Market Research:** Analyze keywords, spy on competitors, and find profitable, underserved book categories on Amazon.
-   **Listing Optimizer:** The AI uses your synopsis and keyword research to write a high-converting Amazon book description, title, and subtitle.
-   **Campaign Generator:** Create a multi-day social media launch campaign, complete with post copy, hashtags, and AI image prompts, tailored to platforms like TikTok, X/Twitter, and Instagram.

## 5. API Keys & AI Routing

Go to **Dashboard > Settings** to manage your API keys.

-   **Why Multiple Keys?** The app uses an intelligent routing system.
    -   **Groq:** Used for fast, real-time tasks like chat and quick edits.
    -   **Gemini:** Used for powerful, large-context tasks like full manuscript analysis, video generation, and image editing.
-   **Automatic Fallback:** If you hit your Gemini rate limit, the app will automatically fall back to Groq for any tasks it can handle, so you can keep working. If a task *requires* Gemini (like a full trilogy analysis), it will show a clear error message.

We hope this guide helps you on your writing journey. Happy forging!
`;

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-fade-in flex flex-col h-[90vh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center"><BookOpen className="mr-3 text-indigo-500" /> User Guide</h2>
                    <Button variant="ghost" onClick={onClose}><X size={24}/></Button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        <ReactMarkdown>{guideContent}</ReactMarkdown>
                    </div>
                </div>
                 <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400">
                    You can reopen this guide from the Dashboard at any time.
                </div>
            </div>
        </div>
    );
};
