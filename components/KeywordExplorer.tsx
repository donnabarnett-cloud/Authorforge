import React, { useState, useEffect } from 'react';
import { Project, KeywordAnalysis, NovelProject } from '../types';
import { analyzeKeywords } from '../services/geminiService';
import { Button } from './Button';
import { Search, Loader2, BarChart, TrendingUp, Shield, X } from 'lucide-react';

interface KeywordExplorerProps {
    project: Project;
    onUpdateProject: (project: Project) => void;
}

export const KeywordExplorer: React.FC<KeywordExplorerProps> = ({ project, onUpdateProject }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<KeywordAnalysis[]>((project as NovelProject).marketingData?.keywordAnalysis || []);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (project.projectType === 'novel') {
            setResults((project as NovelProject).marketingData?.keywordAnalysis || []);
        }
    }, [project]);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query.trim()) return;
        setIsLoading(true);
        const res = await analyzeKeywords(query);
        setResults(res);
        if (project.projectType === 'novel') {
            const novelProject = project as NovelProject;
            const newMarketingData = { ...novelProject.marketingData, keywordAnalysis: res };
            onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);
        }
        setIsLoading(false);
    };

    const clearResults = () => {
        setResults([]);
        if (project.projectType === 'novel') {
            const novelProject = project as NovelProject;
            const newMarketingData = { ...novelProject.marketingData, keywordAnalysis: [] };
            onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);
        }
    };

    const getBadgeColor = (level: string) => {
        const l = level.toLowerCase();
        if (l.includes('high')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
        if (l.includes('medium')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center"><Search className="mr-2 text-indigo-500"/> Keyword Explorer</h3>
                {results.length > 0 && <Button variant="ghost" size="sm" onClick={clearResults} icon={<X size={14}/>}>Clear</Button>}
            </div>
            <form onSubmit={handleSearch} className="flex gap-4 mb-6">
                <input 
                    type="text" 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                    className="flex-1 p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    placeholder="e.g., 'epic fantasy with dragons'..."
                />
                <Button size="lg" type="submit" disabled={isLoading} icon={isLoading ? <Loader2 className="animate-spin"/> : <Search />}>
                    Analyze
                </Button>
            </form>

            {isLoading && <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-indigo-500" size={32}/></div>}
            
            {!isLoading && results.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">Keyword</th>
                                <th scope="col" className="px-6 py-3">Search Volume</th>
                                <th scope="col" className="px-6 py-3">Competition</th>
                                <th scope="col" className="px-6 py-3">Earnings Potential</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((res, i) => (
                                <tr key={i} className="bg-white border-b dark:bg-slate-900 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                    <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">
                                        {res.keyword}
                                    </th>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getBadgeColor(res.searchVolume)}`}>{res.searchVolume}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getBadgeColor(res.competition)}`}>{res.competition}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getBadgeColor(res.earningsPotential)}`}>{res.earningsPotential}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};