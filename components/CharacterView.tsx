import React, { useState, useEffect } from 'react';
import { Character, Relationship, Project, NovelProject } from '../types';
import { Trash2, Loader2, Sparkles, Download } from 'lucide-react';
import { Button } from './Button';
import { analyzeCharacterRelationships, generateVisualAnchor } from '../services/geminiService';

interface CharacterViewProps {
  character: Character;
  project: Project;
  onUpdate: (updated: Character) => void;
  onDelete: (id: string) => void;
}

export const CharacterView: React.FC<CharacterViewProps> = ({ character, project, onUpdate, onDelete }) => {
  const [relationships, setRelationships] = useState<Relationship[]>(character.relationships || []);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [isLoadingAnchor, setIsLoadingAnchor] = useState(false);

  useEffect(() => {
      setRelationships(character.relationships || []);
  }, [character.relationships]);

  const handleChange = (field: keyof Character, value: any) => {
    onUpdate({ ...character, [field]: value });
  };

  const handleAnalyzeRelationships = async () => {
      if (project.projectType !== 'novel') return;
      setIsLoadingRelationships(true);
      const rels = await analyzeCharacterRelationships(project as NovelProject, character.id);
      setRelationships(rels);
      onUpdate({ ...character, relationships: rels });
      setIsLoadingRelationships(false);
  };
  
  const handleGenerateAnchor = async () => {
      if (!character.description) return;
      setIsLoadingAnchor(true);
      const anchor = await generateVisualAnchor(character.description);
      onUpdate({ ...character, visualSummary: anchor });
      setIsLoadingAnchor(false);
  };

  const handleExport = () => {
    const content = `
Character Profile: ${character.name}
Role: ${character.role}
Traits: ${character.traits.join(', ')}

Description/Voice:
${character.description}

Visual Anchor Prompt:
${character.visualSummary || 'Not generated.'}

Relationships:
${relationships.map(r => `- ${r.targetName} (${r.type}): ${r.description}`).join('\n') || 'None analyzed.'}
    `;
    const blob = new Blob([content.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name.replace(/\s+/g, '_')}_profile.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-8">
      <div className="flex justify-between items-start mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Character Profile</h1>
        <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport} icon={<Download size={14} />}>
                Export
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(character.id)} icon={<Trash2 size={14} />}>
                Delete
            </Button>
        </div>
      </div>

      <div className="space-y-6 bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                  <input type="text" value={character.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"/>
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <input type="text" value={character.role} onChange={(e) => handleChange('role', e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"/>
              </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description / Voice</label>
              <textarea value={character.description} onChange={(e) => handleChange('description', e.target.value)} rows={5} className="w-full p-2 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600" />
              <div className="text-xs text-right text-slate-400 mt-1">{character.description.split(/\s+/).filter(Boolean).length} words</div>
          </div>
          <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Traits (comma separated)</label>
              <input type="text" value={character.traits.join(', ')} onChange={(e) => handleChange('traits', e.target.value.split(',').map(t => t.trim()))} className="w-full p-2 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"/>
          </div>
           <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Visual Anchor Prompt</label>
              <div className="flex gap-2">
                  <textarea value={character.visualSummary || ""} onChange={(e) => handleChange('visualSummary', e.target.value)} rows={3} className="w-full p-2 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600" placeholder="A prompt for generating consistent images of this character..."/>
                  <Button variant="secondary" onClick={handleGenerateAnchor} icon={isLoadingAnchor ? <Loader2 className="animate-spin"/> : <Sparkles/>}>Generate</Button>
              </div>
          </div>
      </div>
      
      {project.projectType === 'novel' && (
          <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Relationships</h2>
                  <Button onClick={handleAnalyzeRelationships} disabled={isLoadingRelationships} variant="secondary" icon={isLoadingRelationships ? <Loader2 className="animate-spin"/> : <Sparkles/>}>Analyze</Button>
              </div>
              <div className="space-y-3">
                  {relationships.map((rel, index) => (
                      <div key={rel.targetId || index} className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="font-bold text-slate-900 dark:text-white">{rel.targetName} - <span className="font-normal text-indigo-500">{rel.type}</span></div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{rel.description}</p>
                      </div>
                  ))}
                  {relationships.length === 0 && !isLoadingRelationships && <p className="text-sm text-slate-500">No relationships analyzed yet. Click 'Analyze' to scan the manuscript.</p>}
              </div>
          </div>
      )}
    </div>
  );
};
