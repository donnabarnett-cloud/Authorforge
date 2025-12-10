import React, { useState } from 'react';
import { ScheduledPost, Project, NovelProject } from '../types';
import { Calendar as CalendarIcon, Clock, CheckCircle2, Circle, Hash, Twitter, Linkedin, Facebook, Instagram, Rss, Mail, Send, Download } from 'lucide-react';
import { Button } from './Button';

interface ContentCalendarProps {
    posts: ScheduledPost[];
    project: Project;
    addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export const ContentCalendar: React.FC<ContentCalendarProps> = ({ posts, project, addToast }) => {
    const [showConnectModal, setShowConnectModal] = useState(false);
    // Sort posts by date
    const sortedPosts = [...(posts || [])].sort((a, b) => new Date(a.scheduleDate || '').getTime() - new Date(b.scheduleDate || '').getTime());

    const getIcon = (platform: string) => {
        const p = platform.toLowerCase();
        if (p.includes('twitter')) return <Twitter size={14}/>;
        if (p.includes('linkedin')) return <Linkedin size={14}/>;
        if (p.includes('facebook')) return <Facebook size={14}/>;
        if (p.includes('instagram')) return <Instagram size={14}/>;
        if (p.includes('blog')) return <Rss size={14}/>;
        if (p.includes('newsletter')) return <Mail size={14}/>;
        return <Hash size={14}/>;
    };

    const handlePostNow = (post: ScheduledPost) => {
        // 1. Copy text to clipboard
        navigator.clipboard.writeText(post.content);
        addToast('info', 'Post content copied to clipboard!');

        // 2. Download image if available (using final cover)
        if (project.projectType === 'novel' && (project as NovelProject).marketingData?.finalCoverUrl) {
            const finalCoverUrl = (project as NovelProject).marketingData.finalCoverUrl;
            const a = document.createElement('a');
            a.href = finalCoverUrl;
            a.download = `${project.title}_cover.png`;
            a.click();
        }

        // 3. Open social media site in a new tab
        let url = '';
        const encodedText = encodeURIComponent(post.content);
        switch(post.platform.toLowerCase()) {
            case 'twitter': url = `https://twitter.com/intent/tweet?text=${encodedText}`; break;
            case 'facebook': url = `https://www.facebook.com/`; break;
            case 'instagram': url = `https://www.instagram.com/`; break;
            case 'tiktok': url = `https://www.tiktok.com/`; break;
            case 'linkedin': url = `https://www.linkedin.com/feed/`; break;
            default: return; // Don't open for blog/newsletter
        }
        window.open(url, '_blank');
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold flex items-center dark:text-white"><CalendarIcon className="mr-2 text-indigo-500"/> Content Calendar</h3>
                 <Button onClick={() => setShowConnectModal(true)} variant="secondary" size="sm">Connect Accounts</Button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {sortedPosts.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                        <CalendarIcon size={48} className="mx-auto mb-4 opacity-20"/>
                        <p>No content scheduled.</p>
                        <p className="text-xs mt-2">Generate a campaign to populate your calendar.</p>
                    </div>
                ) : (
                    sortedPosts.map((post, i) => {
                        const date = new Date(post.scheduleDate || Date.now());
                        const isPast = date.getTime() < Date.now();
                        
                        return (
                            <div key={post.id || i} className={`flex items-start p-4 border rounded-lg transition hover:shadow-md ${isPast ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-70' : 'bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-900'}`}>
                                <div className="mr-6 text-center min-w-[60px] flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-700 pr-6">
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                                        {date.toLocaleDateString('en-US', { month: 'short' })}
                                    </div>
                                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                                        {date.getDate()}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase inline-flex items-center gap-1 ${
                                            post.platform.includes('twitter') ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 
                                            post.platform.includes('linkedin') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                            'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                                        }`}>
                                            {getIcon(post.platform)} {post.platform}
                                        </span>
                                        <Button size="sm" variant="secondary" onClick={() => handlePostNow(post)} icon={<Send size={12}/>}>Post Now</Button>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 mb-2 font-medium">"{post.content}"</p>
                                    <div className="flex gap-2">
                                        {post.hashtags?.map(tag => (
                                            <span key={tag} className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">#{tag.replace('#','')}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {showConnectModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                     <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 animate-fade-in">
                        <h2 className="text-lg font-bold mb-4">Streamlined Posting</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Due to platform restrictions, direct API posting is not available. 
                            Instead, the "Post Now" button provides a seamless workflow:
                        </p>
                        <ul className="list-decimal list-inside text-sm space-y-2 text-slate-700 dark:text-slate-300 mb-6">
                            <li>Copies the post text to your clipboard.</li>
                            <li>Downloads the associated image (like your book cover).</li>
                            <li>Opens the social media site in a new tab.</li>
                        </ul>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Simply paste the content and upload the downloaded image to publish your post.
                        </p>
                        <div className="flex justify-end mt-6">
                            <Button onClick={() => setShowConnectModal(false)}>Got it</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
