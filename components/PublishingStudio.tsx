import React, { useState, useEffect } from 'react';
import { Project, NovelProject, MarketingPost, ToastMessage, AudienceProfile, MarketingProject, TrendingTopic, SEOArticle, ScheduledPost, MarketingData, SocialPlatform, ListingOptimization } from '../types';
import { generateMarketingCopy, generateAudienceProfile, generateLaunchCampaign, generateMediaKit, discoverTrends, generateSEOArticle, repurposeContent, generatePlatformSpecificCampaign, generateListingOptimization } from '../services/geminiService';
import { Button } from './Button';
import { Share2, Book, Copy, CheckCircle2, Loader2, Target, Hash, Calendar, Rocket, Users, FileText, TrendingUp, Search, ExternalLink, RefreshCw, PenTool, Layout, Wand2, Compass, List, Edit } from 'lucide-react';
import { ContentCalendar } from './ContentCalendar';
import { WebsiteBuilder } from './WebsiteBuilder';
import { KeywordExplorer } from './KeywordExplorer';
import { CompetitionAnalyzer } from './CompetitionAnalyzer';
import { CategoryFinder } from './CategoryFinder';

interface PublishingStudioProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  addToast: (type: ToastMessage['type'], message: string, title?: string) => void;
}

export const PublishingStudio: React.FC<PublishingStudioProps> = ({ project, onUpdateProject, addToast }) => {
    const [activeTab, setActiveTab] = useState<'market_research' | 'listing_optimizer' | 'campaign_generator' | 'seo' | 'calendar' | 'website'>('market_research');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram', 'twitter', 'tiktok']);
    
    const getMarketingData = () => (project.projectType === 'novel' ? (project as NovelProject).marketingData : undefined);
    
    const updateMarketingData = (updates: Partial<MarketingData>) => {
        if (project.projectType === 'novel') {
            const novelProject = project as NovelProject;
            const newMarketingData = { ...(novelProject.marketingData || {}), ...updates };
            onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);
        }
    };
    
    const [niche, setNiche] = useState(project.projectType === 'novel' ? (project as NovelProject).genre : 'Technology');
    const [trends, setTrends] = useState<TrendingTopic[]>([]);
    const [selectedTrend, setSelectedTrend] = useState<TrendingTopic | null>(null);

    const [currentArticle, setCurrentArticle] = useState<SEOArticle | null>(null);

    useEffect(() => {
        const marketingData = getMarketingData();
        setTrends(marketingData?.trends || []);
        setCurrentArticle(marketingData?.articles?.[0] || null);
    }, [project]);

    const handleGenerateCampaign = async () => {
        if (project.projectType !== 'novel') return;
        setIsLoading(true);
        try {
            const posts = await generatePlatformSpecificCampaign(project as NovelProject, selectedPlatforms);
            const novelProject = project as NovelProject;
            const existingCalendar = novelProject.marketingData?.calendar || [];
            const newMarketingData = { ...novelProject.marketingData, calendar: [...existingCalendar, ...posts] };
            onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);
            addToast('success', `Generated ${posts.length}-post campaign for ${selectedPlatforms.join(', ')}!`);
            setActiveTab('calendar');
        } catch (e) {
            addToast('error', 'Failed to generate campaign.');
            console.error(e);
        }
        setIsLoading(false);
    };

    const handleGenerateListing = async () => {
        if (project.projectType !== 'novel') return;
        setIsLoading(true);
        try {
            const keywords = getMarketingData()?.keywordAnalysis?.map(k => k.keyword) || [];
            const listing = await generateListingOptimization(project as NovelProject, keywords);
            updateMarketingData({ listingOptimization: listing });
            addToast('success', 'Amazon listing copy generated!');
        } catch (e) {
            addToast('error', 'Failed to generate listing copy.');
            console.error(e);
        }
        setIsLoading(false);
    };

    const handleWriteArticle = async () => {
        if (!selectedTrend) return;
        setIsLoading(true);
        const { content, score } = await generateSEOArticle(selectedTrend.topic, [niche, 'trends', 'news'], "General Audience");
        const newArticle: SEOArticle = { id: Date.now().toString(), topic: selectedTrend.topic, content, keywords: [niche], score, status: 'draft' };
        
        const currentArticles = getMarketingData()?.articles || [];
        updateMarketingData({ articles: [newArticle, ...currentArticles] });
        
        setIsLoading(false);
        setActiveTab('seo');
    };

    const handleRepurpose = async () => {
        if (!currentArticle?.content) return;
        setIsLoading(true);
        const platforms: SocialPlatform[] = ['twitter', 'linkedin', 'instagram'];
        const posts = await repurposeContent(currentArticle.content, platforms);
        
        const scheduledPosts: ScheduledPost[] = posts.map((p, i) => {
            const date = new Date();
            date.setDate(date.getDate() + i + 1);
            return { ...p, id: Date.now().toString() + i, status: 'scheduled', scheduleDate: date.toISOString() };
        });
        
        updateMarketingData({ calendar: [...(getMarketingData()?.calendar || []), ...scheduledPosts] });
        setIsLoading(false);
        setActiveTab('calendar');
        addToast('success', `${posts.length} posts generated and scheduled!`);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('info', 'Copied to clipboard');
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-8 h-full flex flex-col">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center"><Share2 className="mr-3 text-indigo-500" /> Amazon KDP Launchpad</h1>
            
            <div className="flex space-x-1 mb-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50 dark:bg-slate-900/50 p-1 rounded-lg">
                {[
                    { id: 'market_research', label: 'Market Research', icon: <Compass size={14}/> },
                    { id: 'listing_optimizer', label: 'Listing Optimizer', icon: <Edit size={14}/> },
                    { id: 'campaign_generator', label: 'Campaign Generator', icon: <Rocket size={14}/> },
                    { id: 'seo', label: 'SEO Writer', icon: <PenTool size={14}/> },
                    { id: 'calendar', label: 'Calendar', icon: <Calendar size={14}/> },
                    { id: 'website', label: 'Website', icon: <Layout size={14}/> },
                ].map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as any)} 
                        className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <span className="mr-2">{tab.icon}</span>{tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'market_research' && (
                    <div className="space-y-8 animate-fade-in">
                        <KeywordExplorer project={project} onUpdateProject={onUpdateProject} />
                        <CompetitionAnalyzer project={project} onUpdateProject={onUpdateProject} />
                        <CategoryFinder project={project} onUpdateProject={onUpdateProject} />
                    </div>
                )}
                {activeTab === 'listing_optimizer' && (
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-slate-800 dark:text-white flex items-center"><Edit className="mr-2 text-indigo-500"/> Amazon Listing Optimizer</h3>
                             <Button onClick={handleGenerateListing} disabled={isLoading || project.projectType !== 'novel'} icon={isLoading ? <Loader2 className="animate-spin"/> : <Wand2 />}>
                                {getMarketingData()?.listingOptimization ? 'Regenerate' : 'Generate Listing Copy'}
                             </Button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Uses your synopsis and researched keywords to create a high-converting Amazon product page.</p>

                        {isLoading && <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-indigo-500" size={32}/></div>}
                        
                        {getMarketingData()?.listingOptimization && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Title & Subtitle Suggestions</h4>
                                    <div className="space-y-3">
                                        {getMarketingData()?.listingOptimization?.titleSuggestions.map((title, i) => (
                                            <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <p className="font-bold text-lg text-slate-900 dark:text-white">{title}</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 italic">{getMarketingData()?.listingOptimization?.subtitleSuggestions[i]}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex justify-between items-center">
                                        <span>Amazon Book Description</span>
                                        <span className="font-normal text-slate-400">{getMarketingData()?.listingOptimization?.amazonDescription.split(/\s+/).filter(Boolean).length} words</span>
                                    </h4>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: getMarketingData()?.listingOptimization?.amazonDescription || "" }} />
                                </div>
                            </div>
                        )}

                    </div>
                )}
                {activeTab === 'campaign_generator' && (
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center"><Rocket className="mr-2 text-indigo-500"/> Platform-Specific Campaign Generator</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Let the AI create tailored content (video scripts, threads, captions) for your chosen social media platforms, using your book's synopsis and themes.</p>
                        
                        <div className="mb-6">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Select Target Platforms</label>
                            <div className="flex flex-wrap gap-2">
                                {(['instagram', 'tiktok', 'facebook', 'twitter'] as SocialPlatform[]).map(p => (
                                    <button 
                                        key={p}
                                        onClick={() => {
                                            setSelectedPlatforms(prev => 
                                                prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                            );
                                        }}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium border-2 flex items-center gap-2 transition ${selectedPlatforms.includes(p) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <CheckCircle2 size={16} className={`transition-transform ${selectedPlatforms.includes(p) ? 'scale-100 text-indigo-500' : 'scale-0'}`}/>
                                        <span className="capitalize">{p === 'twitter' ? 'X/Twitter' : p}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button onClick={handleGenerateCampaign} disabled={isLoading || selectedPlatforms.length === 0 || project.projectType !== 'novel'} icon={isLoading ? <Loader2 className="animate-spin"/> : <Rocket />}>
                            Generate Campaign
                        </Button>
                    </div>
                )}
                {activeTab === 'website' && project.projectType === 'novel' && (
                    <WebsiteBuilder project={project as NovelProject} onUpdateProject={onUpdateProject} />
                )}
                {activeTab === 'seo' && (<div className="h-full flex flex-col animate-fade-in">{currentArticle ? (<div className="grid grid-cols-3 gap-6 h-full"><div className="col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-full"><div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center"><h3 className="font-bold truncate pr-4">{currentArticle.topic}</h3><div className="flex gap-2"><div className="text-xs text-slate-400 self-center">{currentArticle.content.split(/\s+/).filter(Boolean).length} words</div><Button size="sm" variant="secondary" onClick={() => copyToClipboard(currentArticle.content)} icon={<Copy size={14}/>}>Copy</Button><Button size="sm" onClick={handleRepurpose} icon={<RefreshCw size={14}/>}>Repurpose</Button></div></div><div className="flex-1 overflow-y-auto p-6 prose dark:prose-invert max-w-none"><div dangerouslySetInnerHTML={{ __html: currentArticle.content.replace(/\n/g, '<br/>') }} /></div></div><div className="col-span-1 space-y-6 overflow-y-auto">{currentArticle.score && (<div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"><h4 className="text-xs font-bold uppercase text-slate-500 mb-4">SEO Scorecard</h4><div className="flex items-center justify-center mb-6 relative"><svg className="w-32 h-32 transform -rotate-90"><circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-800" /><circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={351} strokeDashoffset={351 - (351 * currentArticle.score.score) / 100} className={currentArticle.score.score > 80 ? "text-green-500" : currentArticle.score.score > 50 ? "text-amber-500" : "text-red-500"} /></svg><span className="absolute text-3xl font-bold text-slate-800 dark:text-white">{currentArticle.score.score}</span></div><div className="space-y-3 text-sm"><div className="flex justify-between"><span>Readability</span><span className="font-bold">{currentArticle.score.readability}</span></div><div className="flex justify-between"><span>Keyword Density</span><span className="font-bold">{currentArticle.score.keywordDensity}%</span></div><div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800"><span className="text-xs font-bold uppercase text-slate-500 block mb-2">Suggestions</span><ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">{currentArticle.score.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div></div></div>)}</div></div>) : (<div className="flex flex-col items-center justify-center h-full text-slate-400"><PenTool size={64} className="mb-4 opacity-20"/><p>Select a trend to write an article, or write manually.</p><div className="mt-4 w-full max-w-md"><textarea className="w-full p-4 border rounded-lg bg-white dark:bg-slate-900" placeholder="Paste existing content to analyze..." value={currentArticle?.content || ''} onChange={e => setCurrentArticle(prev => prev ? {...prev, content: e.target.value} : null)}></textarea><Button className="mt-2 w-full" onClick={() => setActiveTab('calendar')}>Go to Calendar</Button></div></div>)}</div>)}
                {activeTab === 'calendar' && (<div className="h-full animate-fade-in"><ContentCalendar posts={getMarketingData()?.calendar || []} addToast={addToast} project={project}/></div>)}
            </div>
        </div>
    );
};