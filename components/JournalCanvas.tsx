import React, { useState, useRef } from 'react';
import { JournalProject, JournalPage, Sticker } from '../types';
import { Button } from './Button';
import { Plus, Trash2, Printer, Sparkles, Loader2, Grid, Layout, Type, FileText, Move, Download, Image as ImageIcon, Palette, X, Sticker as StickerIcon, Heart, Star, Sun, Moon, Flower, Smile, CheckCircle2, Calendar, Activity, Droplet, Maximize2, Minimize2, Copy, Upload, Undo, Redo, BookOpen, BrainCircuit, Dumbbell, ListChecks, Wand2 } from 'lucide-react';
import { generateJournalPrompts, generateImage, illustrateDreamEntry, generateStickerFromPrompt } from '../services/geminiService';

interface JournalCanvasProps {
    project: JournalProject;
    onUpdate: (project: JournalProject) => void;
}

const PRESET_STYLES = [
    { label: "Junk Journal", prompt: "Vintage collage aesthetic, torn paper textures, botanical illustrations, coffee stains, grunge scrapbooking style, muted earth tones" },
    { label: "Wellness", prompt: "Soft watercolor wash, pastel gradients, calming nature motifs, eucalyptus leaves, minimalist zen vibe, spa aesthetic" },
    { label: "Dark Academia", prompt: "Old parchment texture, ink splatters, antique library atmosphere, moody but legible, leather texture edges" },
    { label: "Celestial", prompt: "Subtle starry night pattern, constellations, moon phases, gold foil accents on deep indigo (low opacity for writing)" },
];

const STICKER_PACK = [
    { id: 'heart', icon: <Heart size={24} fill="#f472b6" className="text-pink-400"/> },
    { id: 'star', icon: <Star size={24} fill="#facc15" className="text-yellow-400"/> },
    { id: 'sun', icon: <Sun size={24} className="text-orange-400"/> },
    { id: 'moon', icon: <Moon size={24} fill="#94a3b8" className="text-slate-400"/> },
    { id: 'flower', icon: <Flower size={24} className="text-indigo-400"/> },
    { id: 'smile', icon: <Smile size={24} className="text-green-400"/> },
];

const INK_COLORS = [
    { label: "Black", value: "#1e293b" },
    { label: "Grey", value: "#94a3b8" },
    { label: "Blue", value: "#1d4ed8" },
    { label: "Gold", value: "#d97706" },
    { label: "White", value: "#ffffff" },
];

const TEMPLATES: {id: JournalPage['type'], label: string, icon: React.ReactNode, desc: string}[] = [
    {id: 'lined', label: 'Lined', icon: <Type size={24}/>, desc: 'Classic ruled paper for writing.'},
    {id: 'dot', label: 'Dot Grid', icon: <Grid size={24}/>, desc: 'Versatile grid for notes & sketches.'},
    {id: 'daily-stoic', label: 'Daily Stoic', icon: <Sun size={24}/>, desc: 'Structured morning & evening reflection.'},
    {id: 'reading-log', label: 'Reading Log', icon: <BookOpen size={24}/>, desc: 'Track books with ratings and notes.'},
    {id: 'fitness-tracker', label: 'Wellness Log', icon: <Dumbbell size={24}/>, desc: 'Monitor workouts, mood & hydration.'},
    {id: 'project-planner', label: 'Project Planner', icon: <ListChecks size={24}/>, desc: 'Organize tasks and deadlines.'},
    {id: 'mind-map', label: 'Mind Map', icon: <BrainCircuit size={24}/>, desc: 'Visually brainstorm your ideas.'},
    {id: 'dream-log', label: 'Dream Log', icon: <Moon size={24}/>, desc: 'Record and interpret your dreams.'},
    {id: 'blank', label: 'Blank', icon: <FileText size={24}/>, desc: 'A clean slate for pure creativity.'},
];

export const JournalCanvas: React.FC<JournalCanvasProps> = ({ project, onUpdate }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDesigning, setIsDesigning] = useState(false);
    const [selectedPageId, setSelectedPageId] = useState<string | null>(project.pages[0]?.id || null);
    const [bgPrompt, setBgPrompt] = useState("");
    const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
    const [activeTab, setActiveTab] = useState<'design' | 'pages'>('design');
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [history, setHistory] = useState<JournalProject[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [stickerPrompt, setStickerPrompt] = useState('');
    
    const printRef = useRef<HTMLDivElement>(null);
    const stickerInputRef = useRef<HTMLInputElement>(null);

    const pushHistory = (newProjectState: JournalProject) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newProjectState);
        if (newHistory.length > 10) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const updateProject = (newProject: JournalProject) => {
        pushHistory(project);
        onUpdate(newProject);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const prev = history[historyIndex - 1];
            setHistoryIndex(historyIndex - 1);
            onUpdate(prev);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const next = history[historyIndex + 1];
            setHistoryIndex(historyIndex + 1);
            onUpdate(next);
        }
    };

    const addPage = (type: JournalPage['type']) => {
        const template = TEMPLATES.find(t => t.id === type);
        const newPage: JournalPage = {
            id: Date.now().toString(),
            type,
            title: template ? template.label : 'New Page',
            content: '',
            stickers: [],
            inkColor: '#1e293b'
        };
        updateProject({ ...project, pages: [...project.pages, newPage] });
        setSelectedPageId(newPage.id);
        setViewMode('single');
        setShowTemplateModal(false);
    };

    const updatePage = (id: string, updates: Partial<JournalPage>) => {
        updateProject({ ...project, pages: project.pages.map(p => p.id === id ? { ...p, ...updates } : p) });
    };

    const addStickerToPage = (pageId: string, type: string, isImage = false) => {
        const newSticker: Sticker = {
            id: Date.now().toString(),
            type: isImage ? 'image' : 'icon',
            content: type,
            x: 50,
            y: 50,
            scale: 1,
            rotation: 0
        };
        const page = project.pages.find(p => p.id === pageId);
        if (page) updatePage(pageId, { stickers: [...(page.stickers || []), newSticker] });
    };

    const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && selectedPageId) {
            const reader = new FileReader();
            reader.onload = (ev) => addStickerToPage(selectedPageId, ev.target?.result as string, true);
            reader.readAsDataURL(file);
        }
    };
    
    const handleGenerateSticker = async () => {
        if (!stickerPrompt.trim() || !selectedPageId) return;
        setIsGenerating(true);
        const imageUrl = await generateStickerFromPrompt(stickerPrompt);
        if (imageUrl) {
            addStickerToPage(selectedPageId, imageUrl, true);
        }
        setIsGenerating(false);
        setStickerPrompt('');
    };
    
    const handleIllustrateDream = async () => {
        const page = project.pages.find(p => p.id === selectedPageId);
        if (!page || !page.content) return;
        setIsGenerating(true);
        const imageUrl = await illustrateDreamEntry(page.content);
        if (imageUrl) {
            updatePage(page.id, { dreamIllustrationUrl: imageUrl });
        }
        setIsGenerating(false);
    };

    const removeSticker = (pageId: string, stickerId: string) => {
        const page = project.pages.find(p => p.id === pageId);
        if (page) updatePage(pageId, { stickers: (page.stickers || []).filter(s => s.id !== stickerId) });
    };

    const handleGenerateBackground = async () => {
        if (!selectedPageId || !bgPrompt.trim()) return;
        setIsDesigning(true);
        const finalPrompt = `Professional stationery background texture, flat lay paper design: ${bgPrompt}. High resolution, light opacity, watermark style, subtle details, perfect for writing notes over.`;
        const imageUrl = await generateImage(finalPrompt, "3:4", "1K");
        if (imageUrl) updatePage(selectedPageId, { backgroundUrl: imageUrl });
        setIsDesigning(false);
    };

    const handlePrint = () => {
        const content = printRef.current?.innerHTML || "";
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`<html><head><title>Print Page</title><style>body { margin: 0; } .page-content { width: ${project.pageSize === 'A4' ? '210mm' : project.pageSize === 'A5' ? '148mm' : '8.5in'}; height: ${project.pageSize === 'A4' ? '297mm' : project.pageSize === 'A5' ? '210mm' : '11in'}; background-size: cover; position: relative; overflow: hidden; } @media print { @page { size: ${project.pageSize}; margin: 0; } }</style></head><body>${content}</body></html>`);
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
        }
    };

    const handleExportAll = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        let pagesHtml = project.pages.map(p => {
            const bgStyle = p.backgroundUrl ? `background-image: url('${p.backgroundUrl}'); background-size: cover; background-position: center;` : 'background-color: white;';
            const fontStack = p.font === 'serif' ? 'font-family: Georgia, serif;' : p.font === 'handwriting' ? 'font-family: cursive;' : 'font-family: sans-serif;';
            
            let overlay = renderTemplateOverlay(p.type, p.inkColor || '#1e293b', true);
            let stickersHtml = (p.stickers || []).map(sticker => {
                // This is a simplification; true drag/drop/scale/rotate requires more complex logic to translate to static HTML
                if (sticker.type === 'image') return `<img src="${sticker.content}" style="position:absolute; left:${sticker.x}%; top:${sticker.y}%; width: 60px; transform: scale(${sticker.scale}) rotate(${sticker.rotation}deg);"/>`;
                return ''; // SVG icons are harder to embed statically here.
            }).join('');

            return `
                <div class="page" style="width:${project.pageSize === 'A4' ? '210mm' : project.pageSize === 'A5' ? '148mm' : '8.5in'};height:${project.pageSize === 'A4' ? '297mm' : project.pageSize === 'A5' ? '210mm' : '11in'};position:relative;overflow:hidden;page-break-after:always;${bgStyle}">
                    ${overlay}
                    ${stickersHtml}
                    <div style="position:relative;z-index:10;padding:40px;height:100%;">
                        <h1 style="${fontStack}font-size:2em;color:${p.inkColor};margin-bottom:20px;">${p.title}</h1>
                        <div style="${fontStack}font-size:1.2em;line-height:1.6;color:${p.inkColor};white-space:pre-wrap;">${p.content}</div>
                    </div>
                </div>
            `;
        }).join('');

        printWindow.document.write(`<html><head><title>${project.title} - Full Export</title><style>body { margin: 0; padding: 0; } @media print { @page { size: ${project.pageSize}; margin: 0; } .page { page-break-after: always; } }</style></head><body>${pagesHtml}</body></html>`);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 1000);
    };

    const selectedPage = project.pages.find(p => p.id === selectedPageId);

    const renderTemplateOverlay = (type: string, color: string = '#94a3b8', forExport: boolean = false) => {
        const commonProps = forExport ? {} : { className: "absolute inset-0 w-full h-full opacity-60 pointer-events-none", preserveAspectRatio:"none" };
        const style = forExport ? `position:absolute;inset:0;opacity:0.6;background-image:linear-gradient(${color} 1px, transparent 1px);background-size:100% 28px;margin-top:3rem;` : undefined;

        if (type === 'lined') return forExport ? `<div style="${style}"></div>` : <div className="absolute inset-0 pointer-events-none opacity-60" style={{ backgroundImage: `linear-gradient(${color} 1px, transparent 1px)`, backgroundSize: '100% 28px', marginTop: '3rem' }}></div>;
        if (type === 'dot') return forExport ? `<div style="position:absolute;inset:0;opacity:0.6;background-image:radial-gradient(${color} 1px, transparent 1px);background-size:20px 20px;"></div>` : <div className="absolute inset-0 pointer-events-none opacity-60" style={{ backgroundImage: `radial-gradient(${color} 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>;
        if (type === 'grid') return forExport ? `<div style="position:absolute;inset:0;opacity:0.6;background-image:linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px);background-size:20px 20px;"></div>` : <div className="absolute inset-0 pointer-events-none opacity-60" style={{ backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>;
        
        // Complex SVG templates
        if (type === 'daily-stoic') return <div {...commonProps} style={{color}} className="p-12 text-sm"> <div className="h-1/2 border-b border-current pb-4"> <h3 className="font-bold text-lg mb-2">AM</h3> <p className="text-xs opacity-80">I am grateful for...</p> </div> <div className="h-1/2 pt-4"> <h3 className="font-bold text-lg mb-2">PM</h3> <p className="text-xs opacity-80">What went well today...</p> </div> </div>;
        if (type === 'reading-log') return <div {...commonProps} style={{color}} className="p-12"> {[0,1,2,3].map(i => <div key={i} className="flex items-center gap-4 border-b border-current py-4"><div className="w-1/2"></div><div className="flex gap-1">{[1,2,3,4,5].map(s => <Star key={s} size={12}/>)}</div></div>)}</div>;
        if (type === 'fitness-tracker') return <div {...commonProps} style={{color}} className="p-12"><h3 className="font-bold text-lg mb-4">Wellness Log</h3><div className="flex justify-between mb-4"><span>Workout</span><span>Mood</span><span>Hydration</span></div><div className="h-4/5 border-t border-current"></div></div>;
        if (type === 'project-planner') return <div {...commonProps} style={{color}} className="p-12"><h3 className="font-bold text-lg mb-4">Project Planner</h3><div className="grid grid-cols-2 gap-4 h-4/5"> <div className="border-r border-current pr-2"> <h4 className="font-semibold text-sm">Tasks</h4> </div> <div> <h4 className="font-semibold text-sm">Notes</h4> </div> </div></div>;
        if (type === 'mind-map') return <div {...commonProps} style={{color}} className="p-12 flex items-center justify-center"><div className="w-24 h-24 border-2 border-current rounded-full flex items-center justify-center text-center">Central Idea</div></div>;

        return null;
    };
    
    const pageSizeStyles = {
        'A4': { width: '210mm', height: '297mm' },
        'A5': { width: '148mm', height: '210mm' },
        'US-Letter': { width: '8.5in', height: '11in' },
    };
    
    return (
        <div className="flex h-full bg-gray-100 dark:bg-slate-950">
            <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-lg z-10">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2"><h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><Layout size={18} className="mr-2 text-indigo-500"/> Creator</h2><div className="flex bg-slate-100 dark:bg-slate-800 rounded p-1"><button onClick={undo} disabled={historyIndex <= 0} className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30"><Undo size={14}/></button><button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30"><Redo size={14}/></button></div></div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded p-1"><button onClick={() => setActiveTab('design')} className={`flex-1 py-1 text-xs font-bold rounded transition ${activeTab === 'design' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-400'}`}>Design</button><button onClick={() => setActiveTab('pages')} className={`flex-1 py-1 text-xs font-bold rounded transition ${activeTab === 'pages' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-400'}`}>Page Manager</button></div>
                </div>
                
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <Button onClick={() => setShowTemplateModal(true)} icon={<Plus size={14}/>} className="w-full h-9 text-sm">Add Page</Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'design' && selectedPage && (
                        <>
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                                <label className="text-xs font-bold uppercase text-slate-500 mb-2">Page Size</label>
                                <select value={project.pageSize} onChange={e => updateProject({...project, pageSize: e.target.value as any})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 text-sm">
                                    <option value="A4">A4 (210x297mm)</option>
                                    <option value="A5">A5 (148x210mm)</option>
                                    <option value="US-Letter">US Letter (8.5x11in)</option>
                                </select>
                            </div>
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold uppercase text-indigo-500 flex items-center"><ImageIcon size={12} className="mr-1"/> Background</h3>{selectedPage.backgroundUrl && <button onClick={() => updatePage(selectedPage.id, { backgroundUrl: undefined })} className="text-[10px] text-red-400 flex items-center"><X size={10}/> Clear</button>}</div>
                                <div className="flex flex-wrap gap-1.5 mb-3">{PRESET_STYLES.map(style => <button key={style.label} onClick={() => setBgPrompt(style.prompt)} className="px-2 py-1 text-[10px] rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 transition">{style.label}</button>)}</div>
                                <textarea rows={2} value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} placeholder="Describe texture..." className="w-full text-xs p-2 rounded border bg-white dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"/>
                                <Button size="sm" onClick={handleGenerateBackground} disabled={isDesigning || !bgPrompt.trim()} className="w-full text-xs h-8 mt-2" icon={isDesigning ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}>{isDesigning ? 'Designing...' : 'Generate'}</Button>
                            </div>

                            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center"><Droplet size={12} className="mr-1"/> Ink & Type</h3>
                                <div className="flex gap-2 mb-3">{INK_COLORS.map(color => <button key={color.value} onClick={() => updatePage(selectedPage.id, { inkColor: color.value })} className={`w-6 h-6 rounded-full border-2 ${selectedPage.inkColor === color.value ? 'border-indigo-500 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color.value }} title={color.label}/>)}</div>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded"><button onClick={() => updatePage(selectedPage.id, { font: 'serif' })} className={`flex-1 py-1 text-xs rounded ${selectedPage.font === 'serif' ? 'bg-white dark:bg-slate-700 shadow' : ''}`}>Serif</button><button onClick={() => updatePage(selectedPage.id, { font: 'handwriting' })} className={`flex-1 py-1 text-xs rounded ${selectedPage.font === 'handwriting' ? 'bg-white dark:bg-slate-700 shadow' : ''}`}>Hand</button></div>
                            </div>

                            <div className="p-4">
                                <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold uppercase text-slate-500 flex items-center"><StickerIcon size={12} className="mr-1"/> Stickers</h3><button onClick={() => stickerInputRef.current?.click()} className="text-[10px] text-indigo-500 flex items-center hover:underline"><Upload size={10} className="mr-1"/> Upload</button><input type="file" ref={stickerInputRef} className="hidden" accept="image/*" onChange={handleStickerUpload}/></div>
                                <div className="grid grid-cols-4 gap-2">{STICKER_PACK.map(sticker => <button key={sticker.id} onClick={() => addStickerToPage(selectedPage.id, sticker.id)} className="p-2 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-indigo-50 transition">{sticker.icon}</button>)}</div>
                                <div className="mt-2 flex gap-2"><input value={stickerPrompt} onChange={e=>setStickerPrompt(e.target.value)} placeholder="AI sticker..." className="flex-1 w-0 text-xs p-1 border rounded dark:bg-slate-800"/><Button size="sm" onClick={handleGenerateSticker} disabled={isGenerating} icon={isGenerating ? <Loader2 className="animate-spin"/> : <Wand2 size={12}/>}/></div>
                            </div>
                        </>
                    )}
                    {activeTab === 'pages' && (
                        <div className="p-2 space-y-2">
                            <div className="mb-2 text-xs font-bold text-slate-400 px-2">{project.pages.length} Pages</div>
                            {project.pages.map((page, i) => <div key={page.id} onClick={() => { setSelectedPageId(page.id); setViewMode('single'); }} className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition ${selectedPageId === page.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}><span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{i + 1}. {page.title}</span></div>)}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <Button onClick={handleExportAll} className="w-full" icon={<Download size={14}/>}>Export Full PDF</Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-200 dark:bg-slate-950 p-4 md:p-8">
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button onClick={() => setViewMode(viewMode === 'single' ? 'grid' : 'single')} className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow">{viewMode === 'single' ? <Grid size={18}/> : <Maximize2 size={18}/>}</button>
                    {viewMode === 'single' && <Button onClick={handlePrint} variant="primary" icon={<Printer size={16}/>}>Print Page</Button>}
                </div>
                
                {viewMode === 'single' && selectedPage ? (
                    <div className="flex flex-col items-center h-full justify-center">
                        <div ref={printRef} className="relative bg-white shadow-2xl transition-all duration-300 overflow-hidden group scale-[0.6] md:scale-[0.8] lg:scale-100 origin-center" style={{ ...pageSizeStyles[project.pageSize], backgroundImage: selectedPage.backgroundUrl ? `url(${selectedPage.backgroundUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                            {renderTemplateOverlay(selectedPage.type, selectedPage.inkColor)}
                            {selectedPage.stickers?.map((sticker, i) => (
                                <div key={i} className="absolute cursor-move hover:scale-110 transition-transform" style={{ left: `${sticker.x}%`, top: `${sticker.y}%` }}>
                                    {sticker.type === 'image' ? <img src="${sticker.content}" alt="sticker" className="w-16 h-16 object-contain"/> : STICKER_PACK.find(sp => sp.id === sticker.content)?.icon}
                                    <button onClick={() => removeSticker(selectedPage.id, sticker.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition print:hidden"><X size={8}/></button>
                                </div>
                            ))}
                            {selectedPage.dreamIllustrationUrl && <img src="${selectedPage.dreamIllustrationUrl}" className="absolute bottom-12 right-12 w-1/3 rounded-lg shadow-lg opacity-80" alt="Dream Illustration"/>}
                            <div className="relative z-10 p-12 h-full flex flex-col">
                                <div className="flex items-center mb-8">
                                    <input type="text" value={selectedPage.title} onChange={(e) => updatePage(selectedPage.id, { title: e.target.value })} className={`flex-1 text-3xl font-bold bg-transparent border-none focus:ring-0 ${selectedPage.font === 'serif' ? 'font-serif' : selectedPage.font === 'sans' ? 'font-sans' : 'font-mono'}`} style={{ color: selectedPage.inkColor || '#1e293b' }} placeholder="Title"/>
                                    <span className="text-xs text-slate-400">{selectedPage.content.split(/\s+/).filter(Boolean).length} words</span>
                                </div>
                                <textarea value={selectedPage.content} onChange={(e) => updatePage(selectedPage.id, { content: e.target.value })} className={`w-full h-full bg-transparent border-none resize-none focus:ring-0 text-xl leading-[28px] ${selectedPage.font === 'serif' ? 'font-serif' : selectedPage.font === 'sans' ? 'font-sans' : 'font-mono'}`} style={{ color: selectedPage.inkColor || '#1e293b' }} placeholder="Write here..."/>
                            </div>
                            {selectedPage.type === 'dream-log' && <Button onClick={handleIllustrateDream} disabled={isGenerating} size="sm" className="absolute bottom-4 right-4 z-20" icon={isGenerating ? <Loader2 className="animate-spin"/> : <Wand2/>}>Illustrate Dream</Button>}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto p-4">{project.pages.map((p,i) => <div key={p.id} onClick={() => { setSelectedPageId(p.id); setViewMode('single'); }} className="aspect-[3/4] bg-white rounded shadow cursor-pointer hover:shadow-lg border p-2 text-xs font-bold text-center flex items-end justify-center relative overflow-hidden"><div className="absolute inset-0 bg-cover opacity-50" style={{backgroundImage: `url(${p.backgroundUrl})`}}></div><span className="z-10 bg-white/80 px-2 rounded">{i+1}. {p.title}</span></div>)}</div>
                )}
            </div>
            {showTemplateModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-fade-in p-4">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-xl w-full max-w-3xl">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-lg dark:text-white">Template Library</h3>
                             <button onClick={() => setShowTemplateModal(false)}><X size={18}/></button>
                         </div>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1">
                             {TEMPLATES.map(t => (
                                 <div key={t.id} onClick={() => addPage(t.id)} className="p-4 border dark:border-slate-800 rounded-lg text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group">
                                     <div className="text-indigo-500 w-12 h-12 flex items-center justify-center mx-auto mb-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">{t.icon}</div>
                                     <h4 className="font-bold text-sm dark:text-white">{t.label}</h4>
                                     <p className="text-xs text-slate-500">{t.desc}</p>
                                 </div>
                             ))}
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};