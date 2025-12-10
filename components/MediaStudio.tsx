import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Video, Wand2, Loader2, Upload, Microscope, User, Grid, Plus, Trash2, Download, Layout, Key, Play, Pause, Type, Mic, Music, X, FastForward, Clock, BookOpen, RefreshCw } from 'lucide-react';
import { generateImage, editImage, generateVideo, analyzeMedia, getVideosOperation, generateBookCoverConcepts, extractViralMoments, generateColoringBookPages, generateColoringBookFromTheme, getAISettings } from '../services/geminiService';
import { Button } from './Button';
import { Character, MoodBoardItem, NovelProject, ViralMoment, ColoringPage, Project, ColoringBookProject } from '../types';

type Mode = 'mood_board' | 'cover_designer' | 'generate_image' | 'edit_image' | 'generate_video' | 'analyze' | 'coloring_book';

interface MediaStudioProps {
    characters?: Character[];
    project: Project;
    onUpdateProject: (p: Project) => void;
}

const fontPairings = [
    { name: "Classic Serif", title: 'font-serif font-bold', author: 'font-sans' },
    { name: "Modern Sans", title: 'font-sans font-extrabold uppercase tracking-wider', author: 'font-serif italic' },
    { name: "Stylized Mono", title: 'font-mono uppercase', author: 'font-sans' },
];

export const MediaStudio: React.FC<MediaStudioProps> = ({ characters, project, onUpdateProject }) => {
    const [mode, setMode] = useState<Mode>(project.projectType === 'coloring-book' ? 'coloring_book' : 'mood_board');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [resultMetadata, setResultMetadata] = useState<any>(null); // Store video metadata for extensions
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [selectedCharId, setSelectedCharId] = useState<string>("");
    const [needsApiKey, setNeedsApiKey] = useState(false);
    
    // Cover Designer State
    const [coverTitle, setCoverTitle] = useState(project?.title || '');
    const [coverAuthor, setCoverAuthor] = useState((project as any).author || '');
    const [coverTagline, setCoverTagline] = useState('');
    const [ageGroup, setAgeGroup] = useState('Adult');
    const [artStyle, setArtStyle] = useState('Photorealistic');
    const [viralMoments, setViralMoments] = useState<ViralMoment[]>((project as NovelProject).marketingData?.viralMoments || []);
    const [selectedThemePrompt, setSelectedThemePrompt] = useState<string>('');
    
    // Coloring Book State
    const [coloringBookPages, setColoringBookPages] = useState<ColoringPage[]>([]);
    const [coloringBookPageCount, setColoringBookPageCount] = useState(12);
    const [coloringBookPageSize, setColoringBookPageSize] = useState<'A4' | 'A5' | 'US-Letter'>('A4');

    const [selectedCover, setSelectedCover] = useState<string | null>(null);
    const [coverLayout, setCoverLayout] = useState(0);
    const [fontPairing, setFontPairing] = useState(0);
    const coverCanvasRef = useRef<HTMLCanvasElement>(null);
    const uploadRef = useRef<HTMLInputElement>(null);

    const moodBoard = (project as NovelProject)?.moodBoard || [];
    const coverConcepts = (project as NovelProject)?.marketingData?.coverConcepts || [];
    
    useEffect(() => {
        if((project as NovelProject)?.marketingData?.coverConcepts && (project as NovelProject).marketingData.coverConcepts.length > 0 && !selectedCover) {
            setSelectedCover((project as NovelProject).marketingData.coverConcepts[0]);
        }
        if (project) {
            setCoverTitle(project.title);
            setCoverAuthor((project as any).author);
            setColoringBookPages((project.projectType === 'novel' ? (project as NovelProject).marketingData?.coloringBookPages : (project as ColoringBookProject).pages) || []);
            setViralMoments((project as NovelProject).marketingData?.viralMoments || []);
        }
    }, [project]);


    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleAddToMoodBoard = (url: string, caption: string) => {
        if (project.projectType === 'novel' && onUpdateProject) {
            const newItem: MoodBoardItem = { id: Date.now().toString(), url, caption, type: 'vibe' };
            onUpdateProject({ ...project, moodBoard: [newItem, ...moodBoard] } as NovelProject);
        }
    };

    const removeFromMoodBoard = (id: string) => {
        if (project.projectType === 'novel' && onUpdateProject) {
            onUpdateProject({ ...project, moodBoard: moodBoard.filter(i => i.id !== id) } as NovelProject);
        }
    };

    const requestApiKey = async () => {
        try {
            if ((window as any).aistudio?.openSelectKey) {
                await (window as any).aistudio.openSelectKey();
                setNeedsApiKey(false);
                // Re-trigger the action after key selection
                handleAction();
            } else {
                setProcessingStatus("Error: API key selection is only available in the hosted AI Studio environment.");
            }
        } catch (e) { console.error("Failed to open key selection", e); }
    };

    const handleScanManuscript = async () => {
        if (project.projectType !== 'novel') return;
        setIsProcessing(true);
        setProcessingStatus("Scanning manuscript for viral moments...");
        try {
            const moments = await extractViralMoments(project as NovelProject);
            setViralMoments(moments);
            const novelProject = project as NovelProject;
            const newMarketingData = { ...novelProject.marketingData, viralMoments: moments };
            onUpdateProject({ ...novelProject, marketingData: newMarketingData } as NovelProject);

        } catch (e) { console.error("Failed to extract moments", e); }
        setIsProcessing(false);
        setProcessingStatus('');
    };
    
    const handleGenerateCovers = async () => {
        if (project.projectType !== 'novel' || !onUpdateProject) return;
        setIsProcessing(true);
        setProcessingStatus("Generating cover concepts...");
        try {
            const images = await generateBookCoverConcepts(project as NovelProject, ageGroup, artStyle, selectedThemePrompt);
            const newMarketingData = { ...(project as NovelProject).marketingData, coverConcepts: images };
            onUpdateProject({ ...project, marketingData: newMarketingData } as NovelProject);
            if(images.length > 0) setSelectedCover(images[0]);
        } catch (e) { console.error("Cover generation failed", e); }
        setIsProcessing(false);
        setProcessingStatus('');
    };

    const handleGenerateColoringBook = async () => {
        if (!project || !onUpdateProject) return;
        setIsProcessing(true);
        try {
            let pages: ColoringPage[] = [];
            if (project.projectType === 'novel') {
                pages = await generateColoringBookPages(project as NovelProject, coloringBookPageCount, (progress) => {
                    setProcessingStatus(progress);
                });
                const newMarketingData = { ...(project as NovelProject).marketingData, coloringBookPages: pages };
                onUpdateProject({ ...project, marketingData: newMarketingData } as NovelProject);
            } else if (project.projectType === 'coloring-book') {
                const cbProject = { ...project, pageSize: coloringBookPageSize, pageCount: coloringBookPageCount } as ColoringBookProject;
                pages = await generateColoringBookFromTheme(cbProject, (progress) => {
                    setProcessingStatus(progress);
                });
                onUpdateProject({ ...cbProject, pages: pages } as ColoringBookProject);
            }
            setColoringBookPages(pages);
        } catch (e) {
            console.error("Coloring book generation failed", e);
            setProcessingStatus(`Error: ${(e as Error).message}`);
        } finally {
            setIsProcessing(false);
            if (!processingStatus.includes('Error')) setProcessingStatus('');
        }
    };
    
    const handleDownloadColoringBook = () => {
        if (!coloringBookPages || coloringBookPages.length === 0) return;

        const dims = { A4: {w: '210mm', h: '297mm'}, A5: {w: '148mm', h: '210mm'}, 'US-Letter': {w: '8.5in', h: '11in'} };
        const size = dims[coloringBookPageSize];

        let pagesHtml = coloringBookPages.map(page => `
            <div style="width:${size.w}; height:${size.h}; page-break-after:always; display:flex; flex-direction:column; justify-content:center; align-items:center; padding: 1cm; box-sizing: border-box;">
                <img src="${page.imageUrl}" style="max-width:100%; max-height:85%; object-fit:contain; border: 1px solid #ccc;"/>
                <p style="margin-top:1cm; font-family: sans-serif; font-size: 12pt; color: #555; text-align:center;">${page.caption}</p>
            </div>
        `).join('');

        const fullHtml = `<html><head><title>${project?.title || 'Coloring Book'} - Coloring Book</title><style>@media print { @page { size: ${coloringBookPageSize}; margin: 0; } body { margin: 0; } }</style></head><body>${pagesHtml}</body></html>`;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(fullHtml);
            printWindow.document.close();
            printWindow.print();
        }
    };

    
    const handleDownloadCover = () => {
        if (!selectedCover || !coverCanvasRef.current) return;
        const canvas = coverCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = selectedCover;
        img.onload = () => {
            canvas.width = 1000;
            canvas.height = 1500;
            ctx.drawImage(img, 0, 0, 1000, 1500);

            const titleFont = fontPairings[fontPairing].title.includes('serif') ? '80px Playfair Display' : fontPairings[fontPairing].title.includes('mono') ? '70px JetBrains Mono' : '90px Inter';
            const authorFont = fontPairings[fontPairing].author.includes('serif') ? '30px Merriweather' : '30px Inter';
            const taglineFont = '24px Inter';

            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            const applyText = (text: string, style: string, x: number, y: number, maxWidth: number) => {
                ctx.font = style;
                ctx.fillText(text, x, y, maxWidth);
            };

            switch(coverLayout) {
                case 1: // Top / Bottom
                    applyText(coverTitle, titleFont, 500, 200, 900);
                    if (coverTagline) applyText(coverTagline, taglineFont, 500, 300, 800);
                    applyText(coverAuthor, authorFont, 500, 1350, 900);
                    break;
                case 2: // Top Title
                    applyText(coverTitle, titleFont, 500, 200, 900);
                    if (coverTagline) applyText(coverTagline, taglineFont, 500, 300, 800);
                    applyText(coverAuthor, authorFont, 500, 350, 900);
                    break;
                case 3: // Bottom Title
                    applyText(coverAuthor, authorFont, 500, 1150, 900);
                    applyText(coverTitle, titleFont, 500, 1250, 900);
                    if (coverTagline) applyText(coverTagline, taglineFont, 500, 1350, 800);
                    break;
                case 0: // Center
                default:
                    applyText(coverTitle, titleFont, 500, 700, 900);
                    if (coverTagline) applyText(coverTagline, taglineFont, 500, 800, 800);
                    applyText(coverAuthor, authorFont, 500, 850, 900);
                    break;
            }
            
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = `${coverTitle.replace(/\s+/g, '_')}_cover.png`;
            a.click();
        };
    };

    const handleAction = async () => {
        if (mode !== 'analyze' && !prompt.trim() && !uploadedImage) return;
        setIsProcessing(true);
        setProcessingStatus('Initializing...');
        setResultUrl(null);
        setAnalysisResult(null);
        setNeedsApiKey(false);

        const selectedChar = characters?.find(c => c.id === selectedCharId);
        const visualAnchor = selectedChar?.visualSummary;
        
        try {
            if (mode === 'generate_image') {
                setProcessingStatus('Generating image...');
                const imageUrl = await generateImage(visualAnchor ? `${prompt}, ${visualAnchor}` : prompt, aspectRatio);
                setResultUrl(imageUrl);
            } else if (mode === 'edit_image') {
                if (!uploadedImage) { alert("Upload image first."); setIsProcessing(false); return; }
                setProcessingStatus('Editing image...');
                const imageUrl = await editImage(uploadedImage, prompt);
                setResultUrl(imageUrl);
            } else if (mode === 'generate_video') {
                setProcessingStatus('Starting video generation...');
                let operation = await generateVideo(prompt, aspectRatio, uploadedImage || undefined);
                
                setProcessingStatus('Processing video... (This can take minutes)');
                while (operation && !operation.done) {
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    setProcessingStatus('Checking video status...');
                    operation = await getVideosOperation(operation);
                }

                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                const geminiKey = getAISettings().apiKeys.find(k => k.provider === 'gemini' && k.status === 'valid');

                if (downloadLink && geminiKey?.key) {
                    const response = await fetch(`${downloadLink}&key=${geminiKey.key}`);
                    const blob = await response.blob();
                    const objectURL = URL.createObjectURL(blob);
                    setResultUrl(objectURL);
                    setResultMetadata(operation.response?.generatedVideos?.[0]?.video);
                } else {
                    throw new Error("Video generation finished but no URL was returned, or Gemini key is missing.");
                }

            } else if (mode === 'analyze') {
                 if (!uploadedImage) { alert("Upload media first."); setIsProcessing(false); return; }
                 setProcessingStatus('Analyzing media...');
                 const res = await analyzeMedia(uploadedImage);
                 setAnalysisResult(res);
            }
        } catch (e: any) {
            console.error("Media action failed", e);
            setProcessingStatus(`Error: ${e.message}`);
            if (e.message?.includes("API key")) { setNeedsApiKey(true); }
        }
        setIsProcessing(false);
        if (!processingStatus.includes('Error')) setProcessingStatus('');
    };

    const handleDownloadResult = () => {
        if (!resultUrl) return;
        const a = document.createElement('a');
        a.href = resultUrl;
        a.download = `authorforge_${Date.now()}.${resultUrl.startsWith('blob:') ? 'mp4' : 'png'}`;
        a.click();
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-8 h-full flex flex-col">
            <input type="file" ref={uploadRef} onChange={handleUpload} className="hidden" accept="image/*"/>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center"><Layout className="mr-3 text-indigo-500"/> Creative Assets Studio</h1>
            </div>
            
            <div className="flex space-x-4 mb-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                { project.projectType === 'novel' && <button onClick={() => setMode('mood_board')} className={`pb-4 px-2 font-medium whitespace-nowrap transition ${mode === 'mood_board' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Mood Board</button> }
                { project.projectType === 'novel' && <button onClick={() => setMode('cover_designer')} className={`pb-4 px-2 font-medium whitespace-nowrap transition ${mode === 'cover_designer' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Cover Designer</button> }
                <button onClick={() => setMode('coloring_book')} className={`pb-4 px-2 font-medium whitespace-nowrap transition ${mode === 'coloring_book' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Coloring Book</button>
                <button onClick={() => { setMode('generate_image'); setResultUrl(null); }} className={`pb-4 px-2 font-medium whitespace-nowrap transition ${mode === 'generate_image' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Stock / Gen</button>
                <button onClick={() => { setMode('edit_image'); setResultUrl(null); }} className={`pb-4 px-2 font-medium whitespace-nowrap transition ${mode === 'edit_image' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Edit Asset</button>
                { project.projectType === 'novel' && <button onClick={() => { setMode('generate_video'); setResultUrl(null); setAspectRatio('16:9'); }} className={`pb-4 px-2 font-medium whitespace-nowrap transition ${mode === 'generate_video' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Video (Veo)</button> }
                <button onClick={() => { setMode('analyze'); setResultUrl(null); }} className={`pb-4 px-2 font-medium whitespace-nowrap transition ${mode === 'analyze' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Analyze</button>
            </div>

            {needsApiKey && (<div className="bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500 text-amber-700 dark:text-amber-400 p-4 mb-6 rounded-r shadow flex justify-between items-center"><div><p className="font-bold">Paid API Key Required</p><p className="text-sm">High-quality media generation requires a billed Google Cloud Project.</p><a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs underline hover:text-amber-900">View Billing Docs</a></div><Button onClick={requestApiKey} size="sm" icon={<Key size={14}/>}>Select API Key</Button></div>)}

            {mode === 'mood_board' ? (
                <div className="flex-1 overflow-y-auto">{moodBoard.length === 0 ? (<div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl"><Grid size={64} className="mx-auto text-slate-300 mb-4"/><p className="text-slate-500 mb-4">Your Mood Board is empty.</p><Button onClick={() => setMode('generate_image')}>Generate Assets</Button></div>) : (<div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">{moodBoard.map((item) => (<div key={item.id} className="break-inside-avoid relative group rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-sm hover:shadow-md transition"><img src={item.url} alt={item.caption} className="w-full h-auto object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><button onClick={() => removeFromMoodBoard(item.id)} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"><Trash2 size={16}/></button></div><div className="p-2 text-xs text-slate-600 dark:text-slate-300 font-medium truncate">{item.caption}</div></div>))}</div>)}</div>
            ) : mode === 'cover_designer' ? (
                <div className="w-full h-full flex gap-8 animate-fade-in">
                    {/* Left Controls */}
                    <div className="w-[28rem] flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 overflow-y-auto">
                        <h3 className="font-bold text-lg dark:text-white">Cover Designer Studio</h3>
                        
                        <div className="space-y-3">
                            <div><label className="text-xs font-bold text-slate-500">Title</label><input type="text" value={coverTitle} onChange={e => setCoverTitle(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"/></div>
                            <div><label className="text-xs font-bold text-slate-500">Author</label><input type="text" value={coverAuthor} onChange={e => setCoverAuthor(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"/></div>
                            <div><label className="text-xs font-bold text-slate-500">Tagline (optional)</label><input type="text" value={coverTagline} onChange={e => setCoverTagline(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700"/></div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-500">Generate Art</label>
                             <div className="grid grid-cols-2 gap-2">
                                <div><label className="text-xs">Age Group</label><select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 text-sm"><option>Young Adult</option><option>Adult</option><option>Middle Grade</option></select></div>
                                <div><label className="text-xs">Art Style</label><select value={artStyle} onChange={e => setArtStyle(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 text-sm"><option>Photorealistic</option><option>Digital Painting</option><option>Anime/Manga</option><option>Vector Art</option><option>Fantasy Art</option></select></div>
                            </div>
                             <textarea value={selectedThemePrompt} onChange={e => setSelectedThemePrompt(e.target.value)} rows={2} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 text-sm" placeholder="e.g., A lone figure on a cliff overlooking a stormy sea..."/>
                             {viralMoments.length > 0 && <div className="flex flex-wrap gap-1">{viralMoments.slice(0,5).map(m => <button key={m.prompt} onClick={()=>setSelectedThemePrompt(m.prompt)} className="text-[10px] bg-slate-100 dark:bg-slate-800 p-1 rounded hover:bg-indigo-100">{m.description.substring(0,20)}...</button>)}</div>}
                             <Button onClick={handleScanManuscript} variant="secondary" size="sm" icon={<BookOpen size={14}/>}>Scan Manuscript for Scenes</Button>
                             <Button onClick={handleGenerateCovers} disabled={isProcessing} icon={isProcessing ? <Loader2 className="animate-spin"/> : <Wand2/>}>{processingStatus || "Generate 4 Concepts"}</Button>
                        </div>
                         
                        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                             <label className="text-xs font-bold text-slate-500">Typography & Layout</label>
                             <div className="grid grid-cols-2 gap-2">
                                 <select value={fontPairing} onChange={e=>setFontPairing(Number(e.target.value))} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 text-sm">{fontPairings.map((f,i)=><option key={i} value={i}>{f.name}</option>)}</select>
                                 <select value={coverLayout} onChange={e=>setCoverLayout(Number(e.target.value))} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 text-sm"><option value={0}>Centered</option><option value={1}>Top/Bottom</option><option value={2}>All Top</option><option value={3}>All Bottom</option></select>
                             </div>
                             <Button onClick={handleDownloadCover} disabled={!selectedCover} icon={<Download/>}>Finalize & Download Cover</Button>
                        </div>
                    </div>
                     {/* Right Previews */}
                    <div className="flex-1 flex flex-col gap-4">
                         <div className="h-2/3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center p-4 relative">
                            <canvas ref={coverCanvasRef} className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"/>
                             {selectedCover ? (<div className="relative w-full h-full flex items-center justify-center"><img src={selectedCover} alt="Selected Cover" className="max-w-full max-h-full object-contain rounded-md shadow-lg"/><div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-8 pointer-events-none"><h1 className={`text-5xl drop-shadow-lg ${fontPairings[fontPairing].title}`}>{coverTitle}</h1><h2 className={`text-2xl mt-4 drop-shadow-md ${fontPairings[fontPairing].author}`}>{coverAuthor}</h2></div></div>) : (<div className="text-slate-400">Concepts appear here</div>)}
                         </div>
                         <div className="h-1/3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                             <div className="grid grid-cols-4 gap-4 h-full">
                                {coverConcepts.map((img, i) => <img key={i} src={img} onClick={() => setSelectedCover(img)} className={`w-full h-full object-cover rounded-md cursor-pointer border-4 ${selectedCover === img ? 'border-indigo-500' : 'border-transparent'}`}/>)}
                             </div>
                         </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};