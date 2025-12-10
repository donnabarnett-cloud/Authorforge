import React, { useState, useEffect } from 'react';
import { Project, CategoryAnalysis, NovelProject } from '../types';
import { findNicheCategories } from '../services/geminiService';
import { Button } from './Button';
import { Compass, Loader2, Award, X } from 'lucide-react';

interface CategoryFinderProps {
    project: Project;
    onUpdateProject: (project: Project) => void;
}

export const CategoryFinder: React.FC<CategoryFinderProps> = ({ project, onUpdateProject }) => {
    const [query, setQuery] = useState((project as any).genre || '');
    const [results, setResults] = useState<CategoryAnalysis[]>((project as NovelProject).marketingData?.categoryAnalysis || []);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (project.projectType === 'novel') {
            setResults((project as NovelProject).marketingData?.categoryAnalysis || []);
        }
    }, [project]);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query.trim()) return;
        setIsLoading(true);
        const res = await findNicheCategories(query);
        setResults(res);
        if (project.projectType === 'novel') {
            const novelProject = project as NovelProject;
            const newMarketingData = { ...novelProject.marketingData, categoryAnalysis: res };
            onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);
        }
        setIsLoading(false);
    };

    const clearResults = () => {
        setResults([]);
        if (project.projectType === 'novel') {
            const novelProject = project as NovelProject;
            const newMarketingData = { ...novelProject.marketingData, categoryAnalysis: [] };
            onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center"><Compass className="mr-2 text-indigo-500"/> Niche Category Finder</h3>
                {results.length > 0 && <Button variant="ghost" size="sm" onClick={clearResults} icon={<X size={14}/>}>Clear</Button>}
            </div>

            <form onSubmit={handleSearch} className="flex gap-4 mb-6">
                <input 
                    type="text" 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                    className="flex-1 p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    placeholder="Enter a broad genre, e.g., 'Thriller'..."
                />
                <Button size="lg" type="submit" disabled={isLoading} icon={isLoading ? <Loader2 className="animate-spin"/> : <Compass />}>
                    Find Niches
                </Button>
            </form>

            {isLoading && <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-indigo-500" size={32}/></div>}
            
            {!isLoading && results.length > 0 && (
                <div className="space-y-3">
                    {results.map((res, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h4 className="font-semibold text-slate-900 dark:text-white">{res.categoryName}</h4>
                                <p className="text-xs text-slate-500">{res.path}</p>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-green-600 dark:text-green-400">{res.salesToBestseller}</div>
                                <div className="text-xs text-slate-400">sales/day to #1</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};