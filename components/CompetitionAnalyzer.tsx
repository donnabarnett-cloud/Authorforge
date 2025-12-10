import React, { useState, useEffect } from 'react';
import { Project, CompetitorAnalysis, NovelProject } from '../types';
import { analyzeCompetitor } from '../services/geminiService';
import { Button } from './Button';
import { BarChart, Loader2, Users, X } from 'lucide-react';

interface CompetitionAnalyzerProps {
    project: Project;
    onUpdateProject: (project: Project) => void;
}

export const CompetitionAnalyzer: React.FC<CompetitionAnalyzerProps> = ({ project, onUpdateProject }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<CompetitorAnalysis[]>((project as NovelProject).marketingData?.competitorAnalysis || []);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (project.projectType === 'novel') {
            setResults((project as NovelProject).marketingData?.competitorAnalysis || []);
        }
    }, [project]);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query.trim()) return;
        setIsLoading(true);
        const res = await analyzeCompetitor(query);
        if (res) {
            const newResults = [res, ...results];
            setResults(newResults);
            if (project.projectType === 'novel') {
                const novelProject = project as NovelProject;
                const newMarketingData = { ...novelProject.marketingData, competitorAnalysis: newResults };
                onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);
            }
        }
        setIsLoading(false);
        setQuery('');
    };

    const clearResults = () => {
        setResults([]);
         if (project.projectType === 'novel') {
            const novelProject = project as NovelProject;
            const newMarketingData = { ...novelProject.marketingData, competitorAnalysis: [] };
            onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center"><Users className="mr-2 text-indigo-500"/> Competition Analyzer</h3>
                {results.length > 0 && <Button variant="ghost" size="sm" onClick={clearResults} icon={<X size={14}/>}>Clear All</Button>}
            </div>

            <form onSubmit={handleSearch} className="flex gap-4 mb-6">
                <input 
                    type="text" 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                    className="flex-1 p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    placeholder="Enter competitor ASIN or Title/Author..."
                />
                <Button size="lg" type="submit" disabled={isLoading} icon={isLoading ? <Loader2 className="animate-spin"/> : <BarChart />}>
                    Analyze
                </Button>
            </form>

            {isLoading && <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-indigo-500" size={32}/></div>}

            {results.length > 0 && (
                <div className="space-y-4">
                    {results.map((result, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-lg text-slate-900 dark:text-white">{result.title}</h4>
                            <p className="text-sm text-slate-500 mb-4">by {result.author}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-700 p-4 rounded-lg">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">Est. Monthly Sales</div>
                                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{result.estimatedMonthlySales}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-700 p-4 rounded-lg">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">Primary Keywords</div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {result.primaryKeywords.map(kw => <span key={kw} className="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded">{kw}</span>)}
                                    </div>
                                </div>
                                <div className="md:col-span-2 bg-white dark:bg-slate-700 p-4 rounded-lg">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">Top Categories</div>
                                    <ul className="mt-2 space-y-1 text-sm">
                                        {result.categories.map(cat => <li key={cat.name} className="flex justify-between"><span>{cat.name}</span> <span className="font-bold">#{cat.rank}</span></li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};