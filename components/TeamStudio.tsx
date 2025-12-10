import React, { useState } from 'react';
import { Project, AIAgent } from '../types';
import { Button } from './Button';
import { Users, Plus, Trash2, Edit3, Save, X, Bot, Briefcase, Zap, MessageSquare, Download } from 'lucide-react';

interface TeamStudioProps {
    project: Project;
    onUpdateProject: (project: Project) => void;
}

export const TeamStudio: React.FC<TeamStudioProps> = ({ project, onUpdateProject }) => {
    const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleSaveAgent = (agent: AIAgent) => {
        const team = project.team || [];
        const index = team.findIndex(a => a.id === agent.id);
        let newTeam;
        if (index >= 0) {
            newTeam = [...team];
            newTeam[index] = agent;
        } else {
            newTeam = [...team, agent];
        }
        onUpdateProject({ ...project, team: newTeam });
        setEditingAgent(null);
        setIsCreating(false);
    };

    const handleDeleteAgent = (id: string) => {
        if (confirm("Fire this agent? They will be removed from your team.")) {
            const newTeam = (project.team || []).filter(a => a.id !== id);
            onUpdateProject({ ...project, team: newTeam });
        }
    };

    const handleExportAgent = (agent: AIAgent) => {
        const content = `
AI Agent Profile: ${agent.name}
Role: ${agent.role}
Avatar: ${agent.avatar}
Expertise: ${agent.expertise.join(', ')}

Personality:
${agent.personality}

System Prompt:
${agent.systemPrompt}
        `;
        const blob = new Blob([content.trim()], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Agent_${agent.name.replace(/\s+/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const createNewAgent = () => {
        const newAgent: AIAgent = {
            id: Date.now().toString(),
            name: "New Agent",
            role: "Generalist",
            expertise: [],
            personality: "Helpful and concise.",
            systemPrompt: "You are a helpful AI assistant.",
            avatar: "🤖"
        };
        setEditingAgent(newAgent);
        setIsCreating(true);
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center"><Users className="mr-3 text-indigo-500" /> AI Team Studio</h1>
                    <p className="text-slate-500 mt-1">Recruit and train specialized AI agents to help build your world.</p>
                </div>
                <Button onClick={createNewAgent} icon={<Plus size={18} />}>Recruit Agent</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4">
                {(project.team || []).map(agent => (
                    <div key={agent.id} className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition group relative">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => handleExportAgent(agent)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition" title="Export Agent"><Download size={16}/></button>
                            <button onClick={() => setEditingAgent(agent)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"><Edit3 size={16}/></button>
                            <button onClick={() => handleDeleteAgent(agent.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"><Trash2 size={16}/></button>
                        </div>
                        
                        <div className="flex items-center mb-4">
                            <div className="text-4xl mr-4 bg-slate-100 dark:bg-slate-800 w-16 h-16 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700">{agent.avatar}</div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{agent.name}</h3>
                                <div className="text-xs uppercase font-bold text-indigo-500 tracking-wider flex items-center"><Briefcase size={12} className="mr-1"/> {agent.role}</div>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center"><Zap size={10} className="mr-1"/> Expertise</div>
                                <div className="flex flex-wrap gap-1">
                                    {agent.expertise.map((exp, i) => <span key={i} className="text-xs px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">{exp}</span>)}
                                </div>
                            </div>
                            
                            <div>
                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Personality</div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{agent.personality}"</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {editingAgent && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center"><Bot className="mr-2 text-indigo-500" /> {isCreating ? 'Recruit Agent' : 'Edit Agent'}</h2>
                            <button onClick={() => { setEditingAgent(null); setIsCreating(false); }} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Name</label>
                                    <input type="text" value={editingAgent.name} onChange={e => setEditingAgent({...editingAgent, name: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-700" placeholder="e.g. The Architect"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Role Title</label>
                                    <input type="text" value={editingAgent.role} onChange={e => setEditingAgent({...editingAgent, role: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-700" placeholder="e.g. Plot Consultant"/>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Avatar (Emoji)</label>
                                <input type="text" value={editingAgent.avatar} onChange={e => setEditingAgent({...editingAgent, avatar: e.target.value})} className="w-16 text-center p-2 border rounded dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-700 text-2xl"/>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Expertise (Comma separated)</label>
                                <input type="text" value={editingAgent.expertise.join(', ')} onChange={e => setEditingAgent({...editingAgent, expertise: e.target.value.split(',').map(s => s.trim())})} className="w-full p-2 border rounded dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-700" placeholder="e.g. History, Weapons, Dialect"/>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Personality</label>
                                <textarea value={editingAgent.personality} onChange={e => setEditingAgent({...editingAgent, personality: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-700 h-20 resize-none" placeholder="Describe how they act..."/>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">System Prompt</label>
                                <div className="text-xs text-slate-500 mb-2">This is the hidden instruction that defines the AI's behavior. Be specific.</div>
                                <textarea value={editingAgent.systemPrompt} onChange={e => setEditingAgent({...editingAgent, systemPrompt: e.target.value})} className="w-full p-3 border rounded dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-700 h-32 font-mono text-sm" placeholder="You are [Name]. Your goal is..."/>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950 rounded-b-xl">
                            <Button variant="ghost" onClick={() => { setEditingAgent(null); setIsCreating(false); }}>Cancel</Button>
                            <Button onClick={() => handleSaveAgent(editingAgent)} icon={<Save size={16}/>}>Save Agent</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};