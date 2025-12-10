import React, { useState, useEffect, useRef } from 'react';
import { NovelProject, AIAgent, Project } from '../types';
import { generateNextChapterAgent } from '../services/geminiService';
import { Ghost, Play, Square, Loader2, Minimize2, Users, X, Book, Hammer, Target } from 'lucide-react';
import { Button } from './Button';

interface AgentConsoleProps {
  project: NovelProject;
  allProjects?: Project[];
  onUpdateProject: (project: NovelProject) => void;
  onClose: () => void;
}

type RunMode = 'write_one' | 'write_all' | 'polish_all';

export const AgentConsole: React.FC<AgentConsoleProps> = ({ project, allProjects, onUpdateProject, onClose }) => {
  const [logs, setLogs] = useState<string[]>(["Ghostwriter Initialized...", "Waiting for command..."]);
  const [isWorking, setIsWorking] = useState(false);
  const [runMode, setRunMode] = useState<RunMode>('write_one');
  const [instructions, setInstructions] = useState("");
  
  const calculatedDefaultWc = project.chapterCountTarget > 0 ? Math.floor(project.wordCountTarget / project.chapterCountTarget) : 3000;
  const [targetWordCount, setTargetWordCount] = useState(Math.max(3000, calculatedDefaultWc));

  const logsEndRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);

  const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const handleStartAgent = async () => {
      stopRef.current = false;
      setIsWorking(true);
      addLog(`Command: ${runMode.replace(/_/g, ' ')}.`);

      let currentProjectState = { ...project };

      const chaptersToProcess = runMode === 'write_all'
          ? currentProjectState.chapters.filter(c => c.content.trim().length < 10)
          : runMode === 'polish_all'
          ? currentProjectState.chapters
          : [currentProjectState.chapters.find(c => c.content.trim().length < 10)].filter(Boolean) as any[];

      if (chaptersToProcess.length === 0) {
          addLog("No chapters to process for this mode. Stopping.");
          setIsWorking(false);
          return;
      }

      for (let i = 0; i < chaptersToProcess.length; i++) {
          if (stopRef.current) {
              addLog("GHOSTWRITER STOPPED BY USER.");
              break;
          }

          const targetChapter = chaptersToProcess[i];
          const isPolish = runMode.includes('polish');
          const task = isPolish ? 'Polishing' : 'Writing';
          addLog(`${task} chapter ${i + 1}/${chaptersToProcess.length}: "${targetChapter.title}"...`);

          try {
             let fullInstructions = instructions;
             if (isPolish) {
                 fullInstructions = `Perform a deep line edit on this chapter to polish the prose to an award-winning standard. Do not change the plot. ${instructions}`;
             }

             const wordCountForRun = isPolish ? Math.max(targetChapter.wordCount, targetWordCount) : targetWordCount;

             const result = await generateNextChapterAgent(currentProjectState, fullInstructions, targetChapter.title, allProjects, wordCountForRun, isPolish);
             addLog(`Drafting content for "${result.title}"...`);

             const originalWordCount = targetChapter.wordCount;
             const newWordCount = result.content.split(/\s+/).filter(Boolean).length;
             
             const chapterIndex = currentProjectState.chapters.findIndex(c => c.id === targetChapter.id);
             
             const updatedChapter = { 
                 ...targetChapter, 
                 title: result.title, 
                 content: result.content, 
                 wordCount: newWordCount, 
                 lastModified: Date.now() 
             };
             
             const newChapters = [...currentProjectState.chapters];
             newChapters[chapterIndex] = updatedChapter;
             
             currentProjectState = { 
                 ...currentProjectState, 
                 chapters: newChapters, 
                 currentWordCount: currentProjectState.currentWordCount - originalWordCount + newWordCount 
             };
             
             onUpdateProject(currentProjectState);
             addLog(`Chapter "${result.title}" completed (${newWordCount} words).`);

          } catch (e) { addLog(`Error: ${e}`); break; }
      }
      addLog("All tasks complete.");
      setIsWorking(false);
  };

  return (
    <div className="fixed bottom-0 right-0 md:right-8 z-40 w-full md:w-[500px] shadow-2xl rounded-t-xl overflow-hidden border border-slate-700 font-mono text-sm bg-slate-900 flex flex-col h-[600px] animate-fade-in">
        <div className="bg-slate-800 p-3 flex justify-between items-center text-white border-b border-slate-700">
            <div className="flex items-center"><Ghost className="mr-2" size={18} /><span className="font-bold tracking-wider">GHOSTWRITER CONSOLE</span></div>
            <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex-1 bg-slate-950 p-4 overflow-y-auto space-y-1 text-indigo-100">
            {logs.map((log, i) => <div key={i} className="break-words opacity-90">{log}</div>)}
            {isWorking && <div className="flex items-center text-indigo-400 animate-pulse mt-2"><Loader2 size={14} className="animate-spin mr-2"/> Processing...</div>}
            <div ref={logsEndRef} />
        </div>
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-4">
             {!isWorking ? (
                 <>
                    <div className="flex gap-2">
                        <div className="flex-1 bg-slate-800 rounded p-1 flex items-center border border-slate-700">
                            <label className="text-xs text-slate-400 px-2">Run Mode:</label>
                            <select 
                                className="bg-transparent text-white text-xs w-full outline-none"
                                value={runMode}
                                onChange={(e) => setRunMode(e.target.value as RunMode)}
                            >
                                <option value="write_one">Write First Empty Chapter</option>
                                <option value="write_all">Write All Empty Chapters</option>
                                <option value="polish_all">Polish Entire Manuscript</option>
                            </select>
                        </div>
                        <div className="w-40 bg-slate-800 rounded p-1 flex items-center border border-slate-700">
                            <label className="text-xs text-slate-400 px-2 flex items-center gap-1"><Target size={12}/> Words:</label>
                            <input
                                type="number"
                                value={targetWordCount}
                                onChange={(e) => setTargetWordCount(parseInt(e.target.value))}
                                className="bg-transparent text-white text-xs w-full outline-none"
                                step="100"
                            />
                        </div>
                    </div>
                    <div>
                         <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="w-full h-16 p-2 rounded border bg-slate-800 border-slate-700 text-xs text-white" placeholder="Specific instructions for this run (e.g., focus on character X's perspective)..."/>
                    </div>
                    <Button onClick={handleStartAgent} className="w-full" icon={<Play size={16}/>}>Activate Ghostwriter</Button>
                 </>
             ) : (
                 <Button onClick={() => stopRef.current = true} variant="danger" className="w-full" icon={<Square size={16}/>}>Stop Ghostwriter</Button>
             )}
        </div>
    </div>
  );
};
