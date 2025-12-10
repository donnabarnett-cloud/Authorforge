import React, { useState } from 'react';
import { NovelProject } from '../types';
import { generateWebsiteFromBook } from '../services/geminiService';
import { Button } from './Button';
import { LayoutTemplate, Loader2, Download } from 'lucide-react';

interface WebsiteBuilderProps {
    project: NovelProject;
    onUpdateProject: (project: NovelProject) => void;
}

export const WebsiteBuilder: React.FC<WebsiteBuilderProps> = ({ project, onUpdateProject }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const websiteHtml = project.marketingData?.website?.html;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const html = await generateWebsiteFromBook(project);
            const newMarketingData = { ...project.marketingData, website: { html } };
            onUpdateProject({ ...project, marketingData: newMarketingData });
        } catch (e) {
            console.error("Website generation failed", e);
        }
        setIsGenerating(false);
    };

    const handleDownload = () => {
        if (!websiteHtml) return;
        const blob = new Blob([websiteHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.title.replace(/\s+/g, '_')}_website.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col p-6 animate-fade-in">
            {websiteHtml ? (
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg dark:text-white">Website Preview</h3>
                        <Button onClick={handleDownload} icon={<Download size={16}/>}>Download HTML</Button>
                    </div>
                    <iframe
                        srcDoc={websiteHtml}
                        title="Website Preview"
                        className="flex-1 w-full h-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white"
                        sandbox="allow-scripts allow-popups"
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <LayoutTemplate size={48} className="mb-4 opacity-20"/>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Generate Your Author Website</h2>
                    <p className="max-w-md mx-auto mt-2 mb-6">Let the AI read your novel and automatically create a beautiful, single-page promotional website with character profiles, synopsis, and more.</p>
                    <Button size="lg" onClick={handleGenerate} disabled={isGenerating} icon={isGenerating ? <Loader2 className="animate-spin"/> : <LayoutTemplate />}>
                        {isGenerating ? 'Building Your Site...' : 'Generate Website'}
                    </Button>
                </div>
            )}
        </div>
    );
};
