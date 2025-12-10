
import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { performResearch } from '../services/geminiService';
import { Button } from './Button';

export const ResearchView: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setIsLoading(true);
        const res = await performResearch(query);
        setResults(res);
        setIsLoading(false);
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-8 h-full flex flex-col">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Research Assistant</h1>
            <form onSubmit={handleSearch} className="mb-8 relative">
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search facts..." className="w-full p-4 pl-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20}/>
                <div className="absolute right-2 top-2 bottom-2">
                    <Button type="submit" disabled={isLoading} icon={isLoading ? <Loader2 className="animate-spin"/> : null}>{isLoading ? 'Searching...' : 'Search'}</Button>
                </div>
            </form>
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-y-auto">
                {results ? <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-slate-800 dark:text-slate-300">{results}</div> : <div className="flex flex-col items-center justify-center h-full text-slate-400"><Search size={48} className="mb-4 opacity-20"/><p>Enter a query to research details.</p></div>}
            </div>
        </div>
    );
};
