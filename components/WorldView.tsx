import React from 'react';
import { WorldItem } from '../types';
import { Trash2, Download } from 'lucide-react';
import { Button } from './Button';

interface WorldViewProps {
  item: WorldItem;
  onUpdate: (updated: WorldItem) => void;
  onDelete: (id: string) => void;
}

export const WorldView: React.FC<WorldViewProps> = ({ item, onUpdate, onDelete }) => {
  const handleChange = (field: keyof WorldItem, value: any) => {
    onUpdate({ ...item, [field]: value });
  };

  const handleExport = () => {
    const content = `
World Bible Entry: ${item.name}
Category: ${item.category}

Description:
${item.description}
    `;
    const blob = new Blob([content.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name.replace(/\s+/g, '_')}_entry.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-8">
      <div className="flex justify-between items-start mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">World Bible Entry</h1>
        <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport} icon={<Download size={14} />}>
                Export
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(item.id)} icon={<Trash2 size={14} />}>
                Delete
            </Button>
        </div>
      </div>

      <div className="space-y-6 bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input type="text" value={item.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select value={item.category} onChange={(e) => handleChange('category', e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600">
                    <option>Location</option>
                    <option>Item</option>
                    <option>Lore</option>
                    <option>Magic System</option>
                    <option>Creature</option>
                    <option>Organization</option>
                </select>
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea value={item.description} onChange={(e) => handleChange('description', e.target.value)} rows={8} className="w-full p-2 border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600" />
            <div className="text-xs text-right text-slate-400 mt-1">{item.description.split(/\s+/).filter(Boolean).length} words</div>
        </div>
      </div>
    </div>
  );
};