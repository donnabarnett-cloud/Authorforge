import React from 'react';
import { NovelProject, TrilogyIssueAndFix, ToastMessage, TrilogyDoctorState } from '../types';
import { runTrilogyDoctor, fixSingleTrilogyIssue, generateFixPlan } from '../services/geminiService';
import { Button } from './Button';
import { GitMerge, Loader2, X, AlertTriangle, FileText, Wand2, Check } from 'lucide-react';

interface TrilogyFixerProps {
  project: NovelProject;
  onClose: () => void;
  onProjectUpdate: (updated: NovelProject) => void;
  onOpenMuseChat: (contextMessage: string) => void;
  addToast: (type: ToastMessage['type'], message: string, title?: string) => void;
  initialState: TrilogyDoctorState;
  onStateChange: React.Dispatch<React.SetStateAction<TrilogyDoctorState>>;
}

export const TrilogyFixer: React.FC<TrilogyFixerProps> = ({ 
  project, 
  onClose, 
  onProjectUpdate,
  onOpenMuseChat,
  addToast, 
  initialState, 
  onStateChange 
}) => {
  const [fixingIssues, setFixingIssues] = React.useState<Set<string>>(new Set());
  const [fixedIssues, setFixedIssues] = React.useState<Set<string>>(new Set());
    const [viewingPlan, setViewingPlan] = React.useState<string | null>(null); // issueId currently viewing
  const [fixPlans, setFixPlans] = React.useState<Map<string, any[]>>(new Map()); // issueId -> ChapterFixDetail[]
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null); // issueId currently loading

  const runScan = async () => {
    if (initialState.isRunning) return;
    onStateChange({ isRunning: true, statusText: 'Initializing scan...', issues: [] });
    setFixedIssues(new Set()); // Reset fixed issues on new scan
    
    try {
      await runTrilogyDoctor(
        project,
        (progressText) => {
          onStateChange(prev => ({ ...prev, statusText: progressText }));
        },
        (newIssue) => {
          onStateChange(prev => ({
            ...prev,
            issues: [...prev.issues, newIssue]
          }));
        }
      );
      
      onStateChange(prev => ({ ...prev, isRunning: false, statusText: 'Scan complete!' }));
    } catch (e: any) {
      console.error('Trilogy Doctor Scan failed:', e);
      addToast('error', e.message, 'Scan Failed');
      onStateChange(prev => ({ ...prev, isRunning: false, statusText: `Scan failed: ${e.message}` }));
    }
  };

  const handleFixSingle = async (issue: TrilogyIssueAndFix) => {
    if (fixingIssues.has(issue.id)) return;

    setFixingIssues(prev => new Set(prev).add(issue.id));
    
    try {
      const updatedProject = await fixSingleTrilogyIssue(
        project,
        issue,
        (progressText) => {
          addToast('info', progressText, 'Applying Fix');
        }
      );
      
      onProjectUpdate(updatedProject);
      setFixedIssues(prev => new Set(prev).add(issue.id));
      addToast('success', `Fix applied successfully!`, issue.type + ' Issue Fixed');
    } catch (e: any) {
      console.error('Fix failed:', e);
      addToast('error', e.message, 'Fix Failed');
    } finally {
      setFixingIssues(prev => {
        const newSet = new Set(prev);
        newSet.delete(issue.id);
        return newSet;
      });
    }
  };

    const handleViewFixPlan = async (issue: TrilogyIssueAndFix) => {
    if (viewingPlan === issue.id) {
      // Toggle off if already viewing
      setViewingPlan(null);
      return;
    }

    // Check if plan already generated
    if (fixPlans.has(issue.id)) {
      setViewingPlan(issue.id);
      return;
    }

    // Generate new fix plan
    setLoadingPlan(issue.id);
    try {
      const plan = await generateFixPlan(issue, project);
      setFixPlans(prev => new Map(prev).set(issue.id, plan));
      setViewingPlan(issue.id);
    } catch (e: any) {
      addToast('error', 'Failed to generate fix plan: ' + e.message, 'Plan Generation Failed');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleOpenInGhostwriter = (issue: TrilogyIssueAndFix) => {
    const chapterTitles = issue.chaptersInvolved.map(c => c.chapterTitle).join(', ');
    const contextMessage = `I need help fixing this ${issue.type.toLowerCase()} issue in my trilogy:\n\n**Issue:**\n${issue.description}\n\n**Chapters Involved:**\n${chapterTitles}\n\n**Suggested Fix:**\n${issue.suggestedFix}\n\nCan you help me implement this fix?`;
    
    onOpenMuseChat(contextMessage);
    onClose();
  };

  const handleFixAll = async () => {
    if (initialState.issues.length === 0 || initialState.isRunning) return;

    const unfixedIssues = initialState.issues.filter(issue => !fixedIssues.has(issue.id));
    if (unfixedIssues.length === 0) {
      addToast('info', 'All issues have already been fixed!', 'Nothing to Fix');
      return;
    }

    for (const issue of unfixedIssues) {
      await handleFixSingle(issue);
      // Small delay between fixes
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col animate-fade-in text-white">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
        <div>
          <h2 className="text-2xl font-bold flex items-center"><GitMerge className="mr-3 text-indigo-500"/> Series Doctor</h2>
          <p className="text-slate-400 text-sm mt-1">Deep structural & continuity analysis for your entire trilogy.</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full"><X size={24}/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
        {initialState.issues.length === 0 && !initialState.isRunning ? (
          <div className="text-center py-20">
            <GitMerge size={64} className="mx-auto text-slate-700 mb-6"/>
            <h3 className="text-xl font-bold mb-4">Trilogy Architecture & Continuity Scan</h3>
            <p className="text-slate-400 max-w-lg mx-auto mb-8">
              The AI will perform a multi-pass audit of your entire trilogy, focusing on high-level plot structure, character arcs, pacing, and granular continuity errors. It will ignore prose and focus only on the story's integrity.
            </p>
            <Button 
              size="lg" 
              onClick={runScan} 
              disabled={initialState.isRunning} 
              icon={initialState.isRunning ? <Loader2 className="animate-spin"/> : <GitMerge/>}
            >
              {initialState.isRunning ? 'Analyzing Series...' : 'Start Series Diagnosis'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {initialState.isRunning && (
              <div className="bg-slate-800 p-4 rounded-lg flex items-center gap-4 text-sm sticky top-0 z-10">
                <Loader2 className="animate-spin text-indigo-400"/>
                <div className="flex-1">
                  <p className="font-bold text-white">{initialState.statusText}</p>
                </div>
              </div>
            )}
            
            {!initialState.isRunning && initialState.issues.length > 0 && (
              <div className="flex justify-between items-center mb-6 bg-slate-800/50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-slate-400">
                    Found {initialState.issues.length} {initialState.issues.length === 1 ? 'issue' : 'issues'} • 
                    Fixed {fixedIssues.size} • 
                    Remaining {initialState.issues.length - fixedIssues.size}
                  </p>
                </div>
                <Button 
                  size="lg" 
                  onClick={handleFixAll} 
                  disabled={fixingIssues.size > 0 || initialState.issues.length === fixedIssues.size}
                  icon={fixingIssues.size > 0 ? <Loader2 className="animate-spin"/> : <Wand2/>}
                  variant="primary"
                >
                  {fixingIssues.size > 0 ? 'Fixing...' : `Fix All Remaining (${initialState.issues.length - fixedIssues.size})`}
                </Button>
              </div>
            )}

            {initialState.issues.map((issue) => {
              const isFixing = fixingIssues.has(issue.id);
              const isFixed = fixedIssues.has(issue.id);
              
              return (
                <div 
                  key={issue.id} 
                  className={`bg-slate-900 border rounded-xl p-6 transition ${
                    isFixed ? 'border-green-800 opacity-60' : 'border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        issue.type === 'Continuity' ? 'bg-red-900/30 text-red-400' : 
                        issue.type === 'Pacing' ? 'bg-amber-900/30 text-amber-400' : 
                        'bg-blue-900/30 text-blue-400'
                      }`}>{issue.type}</span>
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <FileText size={12}/>
                        {issue.chaptersInvolved.map(c => c.chapterTitle).join(', ')}
                      </span>
                      {isFixed && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <Check size={14}/> Fixed
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      
                                            <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleViewFixPlan(issue)}
                        disabled={loadingPlan === issue.id}
                        icon={loadingPlan === issue.id ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
                      >
                        {loadingPlan === issue.id ? 'Generating...' : viewingPlan === issue.id ? 'Hide Fix Plan' : 'View Fix Plan'}
                      </Button><Button 
                        size="sm" 
                        variant="secondary" 
                        icon={<Wand2 size={14}/>}
                        onClick={() => handleOpenInGhostwriter(issue)}
                      >
                        Open in Ghostwriter
                      </Button>
                      <Button 
                        size="sm" 
                        variant="primary"
                        onClick={() => handleFixSingle(issue)}
                        disabled={isFixing || isFixed}
                        icon={isFixing ? <Loader2 size={14} className="animate-spin"/> : isFixed ? <Check size={14}/> : <Wand2 size={14}/>}
                      >
                        {isFixing ? 'Fixing...' : isFixed ? 'Fixed' : 'Apply Fix'}
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-slate-300 mb-4 text-sm border-l-2 border-slate-700 pl-3">
                    {issue.description}
                  </p>
                  
                  <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="flex justify-between items-center text-indigo-400 text-xs font-bold mb-2 uppercase">
                      <span>Suggested Fix</span>
                    </div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap">{issue.suggestedFix}</div>
                  </div>
                </div>
                                                      );
                          })}
                                      };
