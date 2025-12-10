import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Play, Loader2, CheckCircle, XCircle, FileText, BarChart, HardDrive } from 'lucide-react';
import { UATActions, TestLog } from '../types';
import { Button } from './Button';

interface UATRunnerProps {
    onClose?: () => void;
    actions?: UATActions;
}

export const UATRunner: React.FC<UATRunnerProps> = ({ onClose, actions }) => {
    const [logs, setLogs] = useState<TestLog[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    
    const addLog = (step: string, status: TestLog['status'], message: string = '', latency?: number) => {
        setLogs(prev => [...prev, { id: Date.now().toString(), step, status, message, timestamp: Date.now(), latency }]);
    };
    
    const runTest = async (name: string, testFn: () => Promise<any>) => {
        addLog(name, 'info', 'Starting...');
        const startTime = Date.now();
        try {
            const result = await testFn();
            const latency = Date.now() - startTime;
            addLog(name, 'pass', `Completed successfully.`, latency);
            return result;
        } catch (e: any) {
            const latency = Date.now() - startTime;
            addLog(name, 'fail', e.message || 'Unknown error', latency);
            throw e; // Stop the test suite on failure
        }
    };

    const runAllTests = async () => {
        if (!actions) {
            addLog("Setup", 'fail', 'UAT Actions not available.');
            return;
        }

        setIsRunning(true);
        setLogs([]);
        addLog('System', 'info', 'Starting full User Acceptance Test suite...');

        try {
            await runTest("Get Project Type", () => Promise.resolve(actions.getProjectType()));
            
            if (actions.getProjectType() === 'novel') {
                await runTest("Navigate to Manuscript", () => actions.navigateSidebar('manuscript'));
                
                const chapters = await runTest("Get Chapter List", async () => {
                    const list = actions.getChapterList();
                    if (!list || list.length === 0) throw new Error("No chapters found.");
                    return list;
                });
                
                await runTest("Select First Chapter", () => actions.selectChapter(chapters[0].id));
                await runTest("Get Editor Content", async () => {
                    const content = actions.getEditorContent();
                    addLog("Get Editor Content", 'info', `Content length: ${content.length} chars`);
                });
            }
            
            await runTest("Open Right Panel", () => Promise.resolve(actions.openRightPanel()));
            
            await runTest("Run Omni-Sweep", async () => {
                const result = await actions.runOmniSweep();
                if (!result || !result.qualityScore) throw new Error("Analysis did not return a valid result.");
                addLog("Run Omni-Sweep", 'info', `Quality Score: ${result.qualityScore}`);
                return result;
            });
            
            await runTest("Navigate to Media Studio", () => actions.navigateSidebar('media'));
            
            await runTest("Save Project (Simulated)", () => Promise.resolve(actions.saveProject()));
            
            addLog('System', 'pass', 'All tests completed successfully!');

        } catch (e) {
            addLog('System', 'fail', 'Test suite failed. See logs for details.');
        } finally {
            setIsRunning(false);
        }
    };

    const getStatusIcon = (status: TestLog['status']) => {
        switch (status) {
            case 'pass': return <CheckCircle size={14} className="text-green-500" />;
            case 'fail': return <XCircle size={14} className="text-red-500" />;
            default: return <FileText size={14} className="text-slate-500" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[80vh]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><ShieldCheck className="mr-2 text-indigo-500" /> System & Agent Console</h2>
                    <div className="flex items-center gap-4">
                        <Button onClick={runAllTests} disabled={isRunning} icon={isRunning ? <Loader2 className="animate-spin"/> : <Play />}>
                            {isRunning ? 'Running...' : 'Run Full Test'}
                        </Button>
                        {onClose && <button onClick={onClose}><X size={20} className="text-slate-400" /></button>}
                    </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto font-mono text-xs">
                    {logs.map(log => (
                        <div key={log.id} className={`flex items-start gap-3 p-2 rounded ${log.status === 'fail' ? 'bg-red-500/10' : ''}`}>
                            <div className="mt-0.5">{getStatusIcon(log.status)}</div>
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{log.step}</span>
                                    {log.latency && <span className="text-slate-400">{log.latency}ms</span>}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{log.message}</div>
                            </div>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 font-sans">
                            <ShieldCheck size={48} className="mb-4 opacity-20"/>
                            <p>User Acceptance Test Runner</p>
                            <p className="text-sm">Click "Run Full Test" to check system health.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
