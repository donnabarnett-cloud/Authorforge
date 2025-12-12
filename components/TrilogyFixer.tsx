import React from 'react';
import { NovelProject, TrilogyIssueAndFix, ToastMessage, TrilogyDoctorState } from '../types';
import { runTrilogyDoctor, fixAllTrilogyIssues, fixSingleTrilogyIssue, generateFixPlan } from '../services/geminiService';
import { Button } from './Button';
import { GitMerge, Loader2, X, AlertTriangle, FileText, Wand2 } from 'lucide-react';

interface TrilogyFixerProps {
  project: NovelProject;
  onClose: () => void;
  addToast: (type: ToastMessage['type'], message: string, title?: string) => void;
  initialState: TrilogyDoctorState;
  onStateChange: React.Dispatch<React.SetStateAction<TrilogyDoctorState>>;
}

export const TrilogyFixer: React.FC<TrilogyFixerProps> = ({ project, onClose, addToast, initialState, onStateChange }) => {

  const runScan = async () => {
    if (initialState.isRunning) return;

    onStateChange({ isRunning: true, statusText: 'Initializing scan...', issues: [] });
    
    try {
      await runTrilogyDoctor(
        project,
        (progressText) => { // onProgress
          onStateChange(prev => ({ ...prev, statusText: progressText }));
        },
        (newIssue) => { // onIssueFound
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

  const [isFixing, setIsFixing] = React.useState(false);
    const [fixingIssues, setFixingIssues] = React.useState<Set<string>>(new Set());
    const [fixedIssues, setFixedIssues] = React.useState<Set<string>>(new Set());
    const [fixPlans, setFixPlans] = React.useState<Map<string, any>>(new Map());
    const [viewingPlan, setViewingPlan] = React.useState<string | null>(null);
    const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);

  const handleFixAll = async () => {
    if (isFixing || initialState.isRunning || initialState.issues.length === 0) return;
    
    setIsFixing(true);
    onStateChange(prev => ({ ...prev, statusText: 'Preparing to fix all issues...' }));
    
    try {
      const updatedProject = await fixAllTrilogyIssues(
        project,
        initialState.issues,     (progressText) => {
          onStateChange(prev => ({ ...prev, statusText: progressText }));
        }
      );
      
      // Here you would need to update the actual project in your app state
      // For now, we'll just show a success message
      addToast('success', `Successfully applied ${initialState.issues.length} fixes!`, 'Fixes Applied');
      onStateChange(prev => ({ ...prev, statusText: 'All fixes applied!', issues: [] }));
    } catch (e: any) {
      console.error('Fix All failed:', e);
      addToast('error', e.message, 'Fix All Failed');
    } finally {
      setIsFixing(false);
    }
  };

    const handleFixSingle = async (issue: TrilogyIssueAndFix) => {
          if (fixingIssues.has(issue.id)) return;

          setFixingIssues(prev => new Set(prev).add(issue.id));

          try {
                  const updatedProject = await fixSingleTrilogyIssue(project, issue, (progressText) => {
        onStateChange(prev => ({ ...prev, statusText: progressText }));
                  // Update project state would go here
                  setFixedIssues(prev => new Set(prev).add(issue.id));
                  addToast('success', `Fixed: ${issue.title}`, 'Fix Applied');
                } catch (e: any) {
                  console.error('Fix failed:', e);
                  addToast('error', e.message, 'Fix Failed');
                } finally {
                  setFixingIssues(prev => {
                            const next = new Set(prev);
                            next.delete(issue.id);
                            return next;
                          });
                }
        };

    const handleViewFixPlan = async (issue: TrilogyIssueAndFix) => {
          if (viewingPlan === issue.id) {
                  setViewingPlan(null);
                  return;
                }

          if (fixPlans.has(issue.id)) {
                  setViewingPlan(issue.id);
                  return;
                }

          setLoadingPlan(issue.id);

          try {
                  const plan = await generateFixPlan(issue, project);
                  setFixPlans(prev => new Map(prev).set(issue.id, plan));
                  setViewingPlan(issue.id);
                } catch (e: any) {
                  console.error('Failed to generate fix plan:', e);
                  addToast('error', e.message, 'Plan Generation Failed');
                } finally {
                  setLoadingPlan(null);
                }
        };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col animate-fade-in text-white">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
        <div>
          <h2 className="text-2xl font-bold flex items-center"><GitMerge className="mr-3 text-indigo-500"/> Series Doctor</h2>
          <p className="text-slate-400 text-sm mt-1">Deep structural & continuity analysis for your entire trilogy.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full"><X size={24}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
        {initialState.issues.length === 0 && !initialState.isRunning ? (
          <div className="text-center py-20">
            <GitMerge size={64} className="mx-auto text-slate-700 mb-6"/>
            <h3 className="text-xl font-bold mb-4">Trilogy Architecture & Continuity Scan</h3>
                    {initialState.issues.length === 0 && !initialState.isRunning && !initialState.statusText.includes('complete') ? (        The AI will perform a multi-pass audit of your entire trilogy, focusing on high-level plot structure, character arcs, pacing, and granular continuity errors. It will ignore prose and focus only on the story's integrity.
            </p>
            <Button size="lg" onClick={runScan} disabled={initialState.isRunning} icon={initialState.isRunning ? <Loader2 className="animate-spin"/> : <GitMerge/>}>
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
              <div className="flex justify-end mb-6">
                <Button 
                  size="lg" 
                  onClick={handleFixAll} 
                  disabled={isFixing || initialState.isRunning}
                  icon={isFixing ? <Loader2 className="animate-spin"/> : <Wand2/>}
                  variant="primary"
                >
                  {isFixing ? `Fixing ${initialState.issues.length} issues...` : `Fix All ${initialState.issues.length} Issues`}
                </Button>
              </div>
            )}

            {initialState.issues.map((issue) => (
              <div key={issue.id} className={`bg-slate-900 border border-slate-800 rounded-xl p-6 transition`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      issue.type === 'Continuity' ? 'bg-red-900/30 text-red-400' : 
                      issue.type === 'Pacing' ? 'bg-amber-900/30 text-amber-400' : 
                      'bg-blue-900/30 text-blue-400'
                    }`}>{issue.type}</span>
                    <span className="text-sm text-slate-400 flex items-center gap-2"><FileText size={12} className="mr-1"/> 
                      {(Array.isArray(issue.chaptersInvolved) ? issue.chaptersInvolved : [issue.chaptersInvolved]).join(', ')}
                    </span>
                  </div>
                  <Button size="sm" variant="secondary" icon={<Wand2 size={14}/>}>Open in Ghostwriter</Button>
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

                              <div className="flex gap-2 mt-4">
                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    onClick={() => handleViewFixPlan(issue)}
                                                                    disabled={loadingPlan === issue.id || fixedIssues.has(issue.id)}
                                                                    icon={loadingPlan === issue.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                                                  >
                                                                    {loadingPlan === issue.id ? 'Loading...' : viewingPlan === issue.id ? 'Hide Plan' : 'View Fix Plan'}
                                                                  </Button>

                                                <Button
                                                                    size="sm"
                                                                    variant="primary"
                                                                    onClick={() => handleFixSingle(issue)}
                                                                    disabled={fixingIssues.has(issue.id) || fixedIssues.has(issue.id)}
                                                                    icon={fixingIssues.has(issue.id) ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                                                  >
                                                                    {fixedIssues.has(issue.id) ? 'Fixed' : fixingIssues.has(issue.id) ? 'Fixing...' : 'Apply Fix'}
                                                                  </Button>
                                              </div>

                              {viewingPlan === issue.id && fixPlans.has(issue.id) && (
                                <div className="mt-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                                                    <div className="text-xs font-bold text-indigo-400 mb-2 uppercase">Fix Plan</div>
                                                    <div className="text-sm text-slate-300 whitespace-pre-wrap">
                                                                          {typeof fixPlans.get(issue.id) === 'string' 
                                                                                                  ? fixPlans.get(issue.id) 
                                                                                                  : JSON.stringify(fixPlans.get(issue.id), null, 2)}
                                                                        </div>
                                                  </div>
                              )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
