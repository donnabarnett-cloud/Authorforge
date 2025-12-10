import React, { useState, useEffect } from 'react';
import { NovelProject, Chapter, BookSweepStatus, AnalysisResult, ProjectHealth, ContinuityIssue, StoryAnalysis, Subplot, TrilogyCohesionReport } from '../types';
import { analyzeText, smartRewriteChapter, analyzeProjectHealth, analyzeContinuity, generateSynopsis, analyzeThemesAndPlot, analyzeTrilogyCohesion } from '../services/geminiService';
import { Activity, Play, CheckCircle2, AlertTriangle, Loader2, X, Wand2, Hammer, Star, BarChart, Zap, Users, SkipForward, GitMerge, Target, BookOpen, Clock, GitCommit, Eye, Sparkles, Network, BookCopy, Download } from 'lucide-react';
import { Button } from './Button';
import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend } from 'recharts';

interface BookSweepProps {
  project: NovelProject;
  onUpdateProject: (project: NovelProject) => void;
  onClose: () => void;
}

export const BookSweep: React.FC<BookSweepProps> = ({ project, onUpdateProject, onClose }) => {
  const [activeTab, setActiveTab] = useState<'synopsis' | 'health' | 'continuity' | 'themes' | 'trilogy'>('health');
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StoryAnalysis | null>(project.storyAnalysis || null);
  const [isApplyingFixes, setIsApplyingFixes] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);

  const handleRunScan = async (scanType: typeof activeTab) => {
      setIsLoading(true);
      let newAnalysis: StoryAnalysis = { ...(analysis || { synopsis: { logline: '', fullSynopsis: '' }, timeline: [], characterArcs: [], plotThreads: [], subplots: [], foreshadowing: [] }) };
      
      try {
          if (scanType === 'synopsis') {
              const synopsis = await generateSynopsis(project);
              newAnalysis = { ...newAnalysis, synopsis };
          } else if (scanType === 'health') {
              const health = await analyzeProjectHealth(project);
              newAnalysis = { ...newAnalysis, projectHealth: health };
          } else if (scanType === 'continuity') {
              const issues = await analyzeContinuity(project);
              newAnalysis = { ...newAnalysis, continuityIssues: issues };
          } else if (scanType === 'themes') {
              const themes = await analyzeThemesAndPlot(project);
              newAnalysis = { ...newAnalysis, plotThreads: themes.plotThreads, foreshadowing: themes.foreshadowing, subplots: themes.subplots };
          } else if (scanType === 'trilogy') {
              const report = await analyzeTrilogyCohesion(project);
              newAnalysis = { ...newAnalysis, trilogyReport: report };
          }
          setAnalysis(newAnalysis);
          onUpdateProject({ ...project, storyAnalysis: newAnalysis });
      } catch(e) { console.error("Analysis failed", e); }

      setIsLoading(false);
  };
  
  const handleApplyAllFixes = async () => {
    if (!analysis) return;
    setIsApplyingFixes(true);
    setFixProgress(0);

    let issues: string[] = [];
    if (activeTab === 'health' && analysis.projectHealth) {
        issues = analysis.projectHealth.globalIssues;
    } else if (activeTab === 'continuity' && analysis.continuityIssues) {
        issues = analysis.continuityIssues.map(i => i.description);
    } else if (activeTab === 'themes' && analysis.plotThreads) {
        issues = analysis.plotThreads.map(t => `Address plot thread: ${t.thread} (Payoff: ${t.payoff.status})`);
    } else if (activeTab === 'trilogy' && analysis.trilogyReport) {
        issues = [
            ...analysis.trilogyReport.namingIssues.map(i => i.details),
            ...analysis.trilogyReport.timelineIssues.map(i => i.details),
        ];
    }
    
    if (issues.length === 0) {
        setIsApplyingFixes(false);
        return;
    }

    const instructions = `Perform a deep developmental edit on each chapter to resolve these global issues. Preserve the author's voice and do not change the core plot, only refine it based on this feedback:\n- ${issues.join('\n- ')}`;

    let updatedProject = { ...project };
    for (let i = 0; i < updatedProject.chapters.length; i++) {
        const chapter = updatedProject.chapters[i];
        try {
            const newContent = await smartRewriteChapter(chapter.content, instructions, updatedProject, chapter.wordCount);
            const newChapter = { ...chapter, content: newContent, wordCount: newContent.split(/\s+/).length, lastModified: Date.now() };
            updatedProject.chapters[i] = newChapter;
            updatedProject = { ...updatedProject, chapters: [...updatedProject.chapters] };
            onUpdateProject(updatedProject); // Update project state after each chapter
        } catch (e) {
            console.error(`Failed to rewrite chapter ${chapter.title}`, e);
        }
        setFixProgress(((i + 1) / updatedProject.chapters.length) * 100);
        // Add a delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    setIsApplyingFixes(false);
  };

  const hasIssuesToFix = () => {
      if (!analysis) return false;
      if (activeTab === 'health' && (analysis?.projectHealth?.globalIssues?.length ?? 0) > 0) return true;
      if (activeTab === 'continuity' && (analysis?.continuityIssues?.length ?? 0) > 0) return true;
      if (activeTab === 'themes' && (analysis?.plotThreads?.length ?? 0) > 0) return true;
      if (activeTab === 'trilogy' && ((analysis?.trilogyReport?.namingIssues?.length ?? 0) > 0 || (analysis?.trilogyReport?.timelineIssues?.length ?? 0) > 0)) return true;
      return false;
  };

  const handleExportReport = () => {
    if (!analysis) return;

    let content = `Story Analyzer Report for "${project.title}"\n`;
    content += `Report Generated: ${new Date().toLocaleString()}\n\n`;

    if (analysis.synopsis?.fullSynopsis) {
        content += `--- SYNOPSIS ---\nLogline: ${analysis.synopsis.logline}\n\n${analysis.synopsis.fullSynopsis}\n\n`;
    }
    if (analysis.projectHealth) {
        content += `--- PROJECT HEALTH ---\nGlobal Issues:\n${analysis.projectHealth.globalIssues.join('\n- ')}\n\n`;
    }
    if (analysis.continuityIssues) {
        content += `--- CONTINUITY ISSUES ---\n${analysis.continuityIssues.map(i => `- [${i.severity}] ${i.description} (${i.location})`).join('\n')}\n\n`;
    }
    if (analysis.plotThreads) {
        content += `--- PLOT THREADS ---\n${analysis.plotThreads.map(t => `- ${t.thread} (Setup: ${t.setup.chapterTitle}, Payoff: ${t.payoff.chapterTitle} [${t.payoff.status}])`).join('\n')}\n\n`;
    }
    if (analysis.trilogyReport) {
        content += `--- TRILOGY COHESION ---\nNaming Issues:\n${analysis.trilogyReport.namingIssues.map(i => `- ${i.details}`).join('\n')}\n\nTimeline Issues:\n${analysis.trilogyReport.timelineIssues.map(i => `- ${i.details}`).join('\n')}\n\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Story_Analyzer_${project.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col overflow-hidden animate-fade-in text-white">
      {isApplyingFixes && (
         <div className="absolute inset-0 z-20 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-indigo-500" size={64}/>
            <p className="mt-4 text-lg font-bold">Applying AI Fixes...</p>
            <p className="text-sm text-slate-400">The AI is rewriting your manuscript. Please wait.</p>
            <div className="w-64 h-2 bg-slate-700 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${fixProgress}%` }}></div>
            </div>
         </div>
      )}
      <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center">
         <h2 className="text-2xl font-bold flex items-center"><Activity className="mr-3 text-indigo-500" /> Story Analyzer</h2>
         <div className="flex space-x-2">
             {analysis && <Button onClick={handleExportReport} variant="secondary" icon={<Download size={14}/>}>Export Report</Button>}
             {([
                 { id: 'synopsis', label: 'Synopsis', icon: <BookOpen size={14}/> },
                 { id: 'health', label: 'Project Health', icon: <Zap size={14}/> },
                 { id: 'continuity', label: 'Continuity', icon: <GitMerge size={14}/> },
                 { id: 'themes', label: 'Themes & Plot', icon: <GitCommit size={14}/> },
                 { id: 'trilogy', label: 'Trilogy Cohesion', icon: <BookCopy size={14}/> }
             ] as const).map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === t.id ? 'bg-indigo-600' : 'text-slate-400 hover:bg-slate-800'}`}>{t.icon}{t.label}</button>)}
             <button onClick={onClose} className="bg-slate-800 p-3 rounded-full hover:bg-slate-700"><X size={20} /></button>
         </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto w-full">
         {isLoading && <div className="text-center py-20"><Loader2 className="mx-auto text-indigo-500 mb-4 animate-spin" size={64}/><p className="text-lg font-bold">Analyzing Manuscript...</p><p className="text-sm text-slate-400">This can take a minute for large projects.</p></div>}
         
         {!isLoading && activeTab === 'synopsis' && (
             !analysis?.synopsis?.fullSynopsis ? (
                 <div className="text-center py-20"><BookOpen className="mx-auto text-slate-700 mb-4" size={64}/><Button onClick={() => handleRunScan('synopsis')} size="lg" icon={<Sparkles />}>Generate Synopsis</Button></div>
             ) : (
                 <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 animate-fade-in">
                    <h3 className="text-xs font-bold uppercase text-indigo-400 mb-2">Logline</h3>
                    <p className="text-xl font-bold italic mb-6">"{analysis?.synopsis?.logline}"</p>
                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Full Synopsis</h3>
                    <div className="prose prose-invert prose-slate max-w-none whitespace-pre-wrap">{analysis?.synopsis?.fullSynopsis}</div>
                 </div>
             )
         )}
         {!isLoading && activeTab === 'health' && (
             !(analysis?.projectHealth?.characterUsage?.length) ? (
                 <div className="text-center py-20"><Zap className="mx-auto text-slate-700 mb-4" size={64}/><Button onClick={() => handleRunScan('health')} size="lg" icon={<Sparkles />}>Analyze Project Health</Button></div>
             ) : (
                 <div className="space-y-6 animate-fade-in">
                    {hasIssuesToFix() && <Button onClick={handleApplyAllFixes} icon={<Wand2 size={16}/>}>Apply All AI Fixes</Button>}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                             <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">POV Balance</h3>
                             <ResponsiveContainer width="100%" height={200}>
                                 <ReBarChart data={analysis.projectHealth?.povBalance} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                     <XAxis type="number" hide />
                                     <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={80} tickLine={false} axisLine={false} />
                                     <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}}/>
                                     <Bar dataKey="percentage" fill="#818cf8" background={{ fill: '#1e293b' }} unit="%" />
                                 </ReBarChart>
                             </ResponsiveContainer>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                             <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">Character Mentions</h3>
                              <ResponsiveContainer width="100%" height={200}>
                                 <ReBarChart data={analysis.projectHealth?.characterUsage}>
                                     <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                                     <YAxis stroke="#64748b" fontSize={10}/>
                                     <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}}/>
                                     <Bar dataKey="count" fill="#a78bfa" />
                                 </ReBarChart>
                             </ResponsiveContainer>
                        </div>
                    </div>
                     <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                         <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">Pacing & Tension Map</h3>
                          <ResponsiveContainer width="100%" height={300}>
                             <LineChart data={analysis.projectHealth?.pacingMap} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <XAxis dataKey="title" stroke="#64748b" fontSize={10} tickFormatter={(value) => value.replace('Chapter ', 'Ch ')} />
                                <YAxis stroke="#64748b" fontSize={10}/>
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}}/>
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                                <Line type="monotone" dataKey="pacingScore" name="Pacing" stroke="#818cf8" strokeWidth={2} dot={{r: 2}} activeDot={{r: 6}} />
                                <Line type="monotone" dataKey="tensionScore" name="Tension" stroke="#f472b6" strokeWidth={2} dot={{r: 2}} activeDot={{r: 6}} />
                             </LineChart>
                         </ResponsiveContainer>
                    </div>
                 </div>
             )
         )}
         {!isLoading && activeTab === 'continuity' && (
             !analysis?.continuityIssues ? (
                 <div className="text-center py-20"><GitMerge className="mx-auto text-slate-700 mb-4" size={64}/><Button onClick={() => handleRunScan('continuity')} size="lg" icon={<Sparkles />}>Scan for Contradictions</Button></div>
             ) : (
                 <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">Continuity Engine Report</h3>
                        {hasIssuesToFix() && <Button onClick={handleApplyAllFixes} icon={<Wand2 size={16}/>}>Apply All AI Fixes</Button>}
                    </div>
                    {(analysis?.continuityIssues?.length ?? 0) === 0 && (
                        <div className="text-center py-10 bg-green-900/10 border border-green-800 rounded-lg">
                            <CheckCircle2 className="mx-auto text-green-500 mb-2" size={32}/>
                            <p className="font-bold text-green-400">No continuity issues found!</p>
                        </div>
                    )}
                    {analysis?.continuityIssues?.map((issue: ContinuityIssue, i: number) => (
                        <div key={i} className="bg-red-900/20 p-4 rounded-xl border border-red-800 border-l-4 border-l-red-500 flex gap-4">
                           <AlertTriangle className="text-red-500 shrink-0 mt-1" size={20}/>
                           <div>
                               <div className="flex gap-2 mb-1"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-bold uppercase">{issue.type}</span><span className="text-slate-500 text-xs">{issue.location}</span></div>
                               <p className="text-white">{issue.description}</p>
                           </div>
                        </div>
                    ))}
                    {analysis?.timeline && (
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                            <h4 className="text-sm font-bold uppercase text-slate-400 mb-4 flex items-center"><Clock className="mr-2"/> Event Timeline</h4>
                            <div className="space-y-3">
                            {analysis?.timeline.map((event, i) => (
                                <div key={i} className="flex items-center gap-4 text-sm border-b border-slate-800 pb-2">
                                    <span className="font-bold text-slate-500 w-32 truncate">{event.chapterTitle}</span>
                                    <span className="text-slate-300">{event.event}</span>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                 </div>
             )
         )}
         {!isLoading && activeTab === 'themes' && (
              !(analysis?.plotThreads?.length) ? (
                 <div className="text-center py-20"><GitCommit className="mx-auto text-slate-700 mb-4" size={64}/><Button onClick={() => handleRunScan('themes')} size="lg" icon={<Sparkles />}>Analyze Themes & Plot</Button></div>
             ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                    <div className="space-y-8">
                        {hasIssuesToFix() && <div className="md:col-span-2"><Button onClick={handleApplyAllFixes} icon={<Wand2 size={16}/>}>Apply All AI Fixes</Button></div>}
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                             <h3 className="text-lg font-bold mb-4 text-indigo-400 flex items-center"><GitCommit className="mr-2"/> Plot Threads</h3>
                             <div className="space-y-4">
                               {analysis?.plotThreads?.map((thread, i) => (
                                   <div key={i} className="p-4 bg-slate-800/50 rounded-lg border border-slate-800">
                                       <h4 className="font-bold text-white mb-2">{thread.thread}</h4>
                                       <div className="text-xs space-y-2">
                                           <div className="flex items-start gap-2"><span className="font-bold text-green-400 w-12">Setup:</span><span className="text-slate-300">[{thread.setup.chapterTitle}] {thread.setup.description}</span></div>
                                           <div className={`flex items-start gap-2 ${thread.payoff.status !== 'resolved' ? 'text-amber-400' : 'text-green-400'}`}><span className="font-bold w-12">Payoff:</span><span className="text-slate-300">[{thread.payoff.chapterTitle}] {thread.payoff.description} ({thread.payoff.status})</span></div>
                                       </div>
                                   </div>
                               ))}
                             </div>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                             <h3 className="text-lg font-bold mb-4 text-indigo-400 flex items-center"><Network className="mr-2"/> Subplots</h3>
                             <div className="space-y-4">
                               {analysis?.subplots?.map((subplot: Subplot, i: number) => (
                                   <div key={i} className="p-4 bg-slate-800/50 rounded-lg border border-slate-800">
                                       <h4 className="font-bold text-white mb-2 flex justify-between items-center">{subplot.title} <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${subplot.progression === 'resolved' ? 'bg-green-900/30 text-green-300' : 'bg-amber-900/30 text-amber-300'}`}>{subplot.progression}</span></h4>
                                       <p className="text-xs text-slate-300 italic mb-2">"{subplot.summary}"</p>
                                       <div className="text-xs text-slate-400">Characters: {subplot.involvedCharacters.join(', ')}</div>
                                   </div>
                               ))}
                             </div>
                        </div>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                        <h3 className="text-lg font-bold mb-4 text-indigo-400 flex items-center"><Eye className="mr-2"/> Foreshadowing</h3>
                        <div className="space-y-3">
                            {analysis?.foreshadowing?.map((item, i) => (
                                <div key={i} className="p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                                    <h4 className="font-semibold text-white text-sm">{item.element} <span className="text-xs text-slate-500">in {item.chapterTitle}</span></h4>
                                    <p className="text-xs text-slate-300 italic mt-1">"{item.suggestion}"</p>
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>
             )
         )}
         {!isLoading && activeTab === 'trilogy' && (
             !analysis?.trilogyReport ? (
                 <div className="text-center py-20">
                    <BookCopy className="mx-auto text-slate-700 mb-4" size={64}/>
                    <h3 className="text-xl font-bold mb-2">Trilogy Cohesion Analysis</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">Scan all books in this unified project for naming inconsistencies, timeline errors, and overall plot arc cohesion.</p>
                    <Button onClick={() => handleRunScan('trilogy')} size="lg" icon={<Sparkles />}>Run Trilogy Analysis</Button>
                 </div>
             ) : (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold">Trilogy Cohesion Report</h3>
                        {hasIssuesToFix() && <Button onClick={handleApplyAllFixes} icon={<Wand2 size={16}/>}>Apply All AI Fixes</Button>}
                    </div>
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                        <h4 className="text-lg font-bold text-indigo-400 mb-4">Naming Consistency</h4>
                        {(analysis?.trilogyReport?.namingIssues?.length ?? 0) === 0 ? <p className="text-sm text-green-400">No naming issues found.</p> : (
                            <div className="space-y-3">
                                {analysis?.trilogyReport?.namingIssues?.map((issue, i) => (
                                    <div key={i} className="p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                                        <p className="font-semibold text-white">{issue.details}</p>
                                        <p className="text-xs text-slate-400">Involved: {issue.namesInvolved.join(', ')}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                        <h4 className="text-lg font-bold text-indigo-400 mb-4">Timeline & Age Progression</h4>
                        {(analysis?.trilogyReport?.timelineIssues?.length ?? 0) === 0 ? <p className="text-sm text-green-400">No timeline issues found.</p> : (
                            <div className="space-y-3">
                                {analysis?.trilogyReport?.timelineIssues?.map((issue, i) => (
                                    <div key={i} className="p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                                        <p className="font-semibold text-white">{issue.characterName}: {issue.issue}</p>
                                        <p className="text-xs text-slate-400">{issue.details}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                        <h4 className="text-lg font-bold text-indigo-400 mb-4">Narrative Flow & Arc</h4>
                        <div className="space-y-4 text-sm text-slate-300 prose prose-invert max-w-none">
                            <div>
                                <h5 className="font-bold text-slate-400">Book 1 to 2 Transition:</h5>
                                <p>{analysis?.trilogyReport?.flowAnalysis?.book1to2}</p>
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-400">Book 2 to 3 Transition:</h5>
                                <p>{analysis?.trilogyReport?.flowAnalysis?.book2to3}</p>
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-400">Overall Trilogy Arc:</h5>
                                <p>{analysis?.trilogyReport?.flowAnalysis?.overallArc}</p>
                            </div>
                        </div>
                    </div>
                </div>
             )
         )}
      </div>
    </div>
  );
};