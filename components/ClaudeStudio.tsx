import React, { useState, useRef, useEffect } from 'react';
import { Project, AIChatMessage, Artifact, ToastMessage } from '../types';
import { chatWithArtifacts, convertManuscriptFile } from '../services/geminiService';
import { Send, Sparkles, Code, FileText, X, Copy, Download, Loader2, PanelRightOpen, Terminal, Layout, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ClaudeStudioProps {
    project: Project;
    addToast: (type: ToastMessage['type'], message: string, title?: string) => void;
}

export const ClaudeStudio: React.FC<ClaudeStudioProps> = ({ project, addToast }) => {
    const [messages, setMessages] = useState<AIChatMessage[]>([
        { id: '1', role: 'model', text: 'Hello. I am Muse. **(Note: This is a preview feature. Responses are currently mocked.)** Attach a file or ask me anything about your project.', timestamp: Date.now() }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    
    // Artifact State
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [currentArtifactId, setCurrentArtifactId] = useState<string | null>(null);
    const [isArtifactOpen, setIsArtifactOpen] = useState(false);
    const [previewMode, setPreviewMode] = useState<'code' | 'preview'>('preview');

    // Attachment State
    const [attachment, setAttachment] = useState<{ fileName: string, content: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        addToast('info', `Reading ${file.name}...`);
        try {
            const content = await convertManuscriptFile(file);
            setAttachment({ fileName: file.name, content });
            addToast('success', `${file.name} attached successfully.`);
        } catch (err) {
            console.error(err);
            addToast('error', `Failed to read file: ${(err as Error).message}`);
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && !attachment) || isTyping) return;
        
        const userMsg: AIChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: Date.now(), attachment: attachment || undefined };
        const newHistory = [...messages, userMsg];
        
        setMessages(prev => [...prev, userMsg, { id: (Date.now()+1).toString(), role: 'model', text: "", timestamp: Date.now() }]);
        setInput("");
        setAttachment(null);
        setIsTyping(true);

        const activeArtifact = artifacts.find(a => a.id === currentArtifactId);
        let accumulatedText = "";

        try {
            const stream = await chatWithArtifacts(newHistory, input, project, activeArtifact);
            
            const reader = stream.getReader();
            while (true) {
                const { done, value: chunk } = await reader.read();
                if (done) break;

                const chunkText = chunk.text || "";
                accumulatedText += chunkText;
                
                const artifactRegex = /<antArtifact\s+identifier="([^"]+)"\s+type="([^"]+)"\s+language="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antArtifact>/g;
                let match;
                const newArtifacts: Artifact[] = [];
                
                while ((match = artifactRegex.exec(accumulatedText)) !== null) {
                     newArtifacts.push({ id: match[1], type: match[2] as any, language: match[3], title: match[4], content: match[5].trim() });
                }
                
                // Handle incomplete artifact tag at end of stream buffer
                const openTagMatch = accumulatedText.match(/<antArtifact\s+identifier="([^"]+)"\s+type="([^"]+)"\s+language="([^"]+)"\s+title="([^"]+)">((?!<\/antArtifact>)[\s\S])*$/);
                
                if (openTagMatch) {
                     const currentContent = openTagMatch[0].substring(openTagMatch[0].indexOf('>') + 1);
                     newArtifacts.push({ id: openTagMatch[1], type: openTagMatch[2] as any, language: openTagMatch[3], title: openTagMatch[4], content: currentContent });
                }

                if (newArtifacts.length > 0) {
                    setArtifacts(prev => {
                        const next = [...prev];
                        newArtifacts.forEach(newArt => {
                            const idx = next.findIndex(a => a.id === newArt.id);
                            if (idx !== -1) next[idx] = newArt;
                            else next.push(newArt);
                        });
                        return next;
                    });
                    const latest = newArtifacts[newArtifacts.length - 1];
                    if (latest.id !== currentArtifactId) {
                        setCurrentArtifactId(latest.id);
                        setIsArtifactOpen(true);
                    }
                }

                let cleanText = accumulatedText.replace(artifactRegex, '\n\n*[Generated Artifact]*\n\n');
                if (openTagMatch) {
                    cleanText = cleanText.substring(0, openTagMatch.index);
                }

                setMessages(prev => {
                    const newArr = [...prev];
                    const last = newArr[newArr.length - 1];
                    if (last.role === 'model') newArr[newArr.length - 1] = { ...last, text: cleanText };
                    return newArr;
                });
            }

        } catch (e) {
             console.error(e);
             setMessages(prev => {
                 const newArr = [...prev];
                 newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], text: "Error: Could not generate response." };
                 return newArr;
             });
        }
        
        setIsTyping(false);
    };

    const currentArtifact = artifacts.find(a => a.id === currentArtifactId);

    const handleDownloadArtifact = (artifact: Artifact) => {
        const blob = new Blob([artifact.content], {type: 'text/plain;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${artifact.title.replace(/\s+/g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getSandboxSrc = (artifact: Artifact) => {
        return `
            <!DOCTYPE html><html><head><meta charset="UTF-8" /><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/react@18/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><script src="https://unpkg.com/lucide-react@0.263.1/dist/umd/lucide-react.js"></script><script src="https://unpkg.com/recharts/umd/Recharts.js"></script><style>body{margin:0;padding:20px;font-family:-apple-system,system-ui,sans-serif;background-color:#fff}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}</style></head><body><div id="root"></div><script type="text/babel">const{useState,useEffect,useRef,useMemo,useCallback}=React;const{LineChart,Line,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,AreaChart,Area,PieChart,Pie,Cell}=Recharts;if(window.lucide&&window.lucide.icons){Object.keys(window.lucide.icons).forEach(key=>{window[key]=window.lucide.icons[key]})}window.onerror=function(a,b,c,d,e){document.body.innerHTML+='<div style="color:red;padding:10px;background:#ffeeee;border:1px solid red;margin-bottom:10px;border-radius:4px;font-family:monospace;"><strong>Error:</strong> '+a+"</div>"};try{const rawCode=${JSON.stringify(artifact.content)};const processedCode=rawCode.replace(/import\\s+.*?from\\s+['"].*?['"];?/g,"");${artifact.content.replace(/import\s+.*?from\s+['"].*?['"];?/g, '')}
const root=ReactDOM.createRoot(document.getElementById('root'));if(typeof App!=='undefined')root.render(<App/>);else if(typeof Component!=='undefined')root.render(<Component/>);else if(typeof Main!=='undefined')root.render(<Main/>);else{const match=rawCode.match(/function\\s+([A-Z][a-zA-Z0-9]*)/);const exportMatch=rawCode.match(/export\\s+default\\s+([A-Z][a-zA-Z0-9]*)/);let TargetComp=null;if(exportMatch)TargetComp=eval(exportMatch[1]);else if(match)TargetComp=eval(match[1]);if(TargetComp){root.render(<TargetComp/>)}else{document.body.innerHTML+='<div style="color:#666;padding:20px;text-align:center;">Preview ready. Ensure your React component is named "App", "Main", or exported as default.</div>'}}}catch(e){console.error(e)}</script></body></html>
        `;
    };

    return (
        <div className="flex h-full bg-[#f0eee6] dark:bg-[#1e1e1e] font-sans text-[#2d2d2d] dark:text-[#e0e0e0] overflow-hidden">
            <div className={`flex flex-col h-full transition-all duration-300 ${isArtifactOpen ? 'w-1/2 border-r border-[#dcdcdc] dark:border-[#333]' : 'w-full max-w-3xl mx-auto border-x border-[#dcdcdc] dark:border-[#333]'}`}>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-[#d97757] flex items-center justify-center text-white shrink-0 shadow-sm"><Sparkles size={16}/></div>}
                            <div className={`max-w-[85%] leading-relaxed ${msg.role === 'user' ? 'bg-[#e7e5e0] dark:bg-[#333] p-3 rounded-xl rounded-tr-sm text-sm' : 'prose dark:prose-invert max-w-none text-[15px]'}`}>
                                {msg.role === 'user' && msg.attachment && (
                                    <div className="mb-2 p-2 bg-slate-200 dark:bg-slate-700/50 rounded-md text-xs flex items-center gap-2">
                                        <Paperclip size={14} className="text-slate-500" />
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{msg.attachment.fileName}</span>
                                    </div>
                                )}
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                                {msg.role === 'model' && msg.text.includes("[Generated Artifact]") && !isArtifactOpen && (
                                    <button onClick={() => setIsArtifactOpen(true)} className="mt-3 text-xs bg-[#f5f5f5] dark:bg-[#2a2a2a] border border-[#ddd] dark:border-[#444] px-3 py-2 rounded-md hover:border-[#d97757] text-[#d97757] font-medium flex items-center transition-colors">
                                        <PanelRightOpen size={14} className="mr-2"/> View Generated Content
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {isTyping && <div className="flex gap-4"><div className="w-8 h-8 rounded-full bg-[#d97757] flex items-center justify-center text-white shadow-sm"><Sparkles size={16}/></div><div className="text-sm text-gray-500 animate-pulse flex items-center">Muse is thinking...</div></div>}
                    <div ref={messagesEndRef} />
                </div>
                
                <div className="p-4 bg-[#f0eee6] dark:bg-[#1e1e1e]">
                    <div className="bg-white dark:bg-[#2d2d2d] border border-[#dcdcdc] dark:border-[#444] rounded-xl shadow-sm p-3 focus-within:ring-2 focus-within:ring-[#d97757]/50 transition-all relative">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt,.md,.json,.pdf,.docx" />
                        
                        {attachment && (
                            <div className="mb-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-md text-xs flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Paperclip size={14} className="text-slate-500" />
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{attachment.fileName}</span>
                                </div>
                                <button onClick={() => setAttachment(null)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                            </div>
                        )}

                        <textarea 
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Message Muse, or attach a file..."
                            className="w-full bg-transparent border-none outline-none resize-none max-h-40 min-h-[40px] text-[15px] dark:text-gray-200 placeholder:text-gray-400 pl-8"
                            rows={1}
                        />

                        <button onClick={() => fileInputRef.current?.click()} className="absolute left-4 top-5 text-slate-400 hover:text-[#d97757] transition-colors" title="Attach file">
                            <Paperclip size={18}/>
                        </button>

                        <div className="flex justify-between items-center mt-2 pl-8">
                             <div className="text-xs text-gray-400 flex items-center">
                                 <Layout size={12} className="mr-1"/> Project Context Active
                             </div>
                             <button 
                                onClick={handleSend} 
                                disabled={(!input.trim() && !attachment) || isTyping}
                                className={`p-1.5 rounded-lg transition-colors ${ (input.trim() || attachment) ? 'bg-[#d97757] text-white hover:bg-[#c56a4c]' : 'bg-gray-200 dark:bg-[#444] text-gray-400'}`}
                             >
                                <Send size={16}/>
                             </button>
                        </div>
                    </div>
                </div>
            </div>

            {isArtifactOpen && (
                <div className="flex-1 flex flex-col bg-white dark:bg-[#121212] h-full shadow-xl z-10 transition-all duration-300 border-l border-[#dcdcdc] dark:border-[#333]">
                    <div className="h-12 border-b border-[#eee] dark:border-[#333] flex items-center justify-between px-4 bg-[#fafafa] dark:bg-[#1e1e1e]">
                        <div className="flex items-center gap-2 overflow-hidden">
                            {currentArtifact ? (
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Current Artifact</span>
                                    <span className="text-sm font-semibold truncate flex items-center gap-2 text-[#333] dark:text-[#eee]">
                                        {currentArtifact.type === 'application/vnd.ant.code' ? <Code size={14} className="text-blue-500"/> : <FileText size={14} className="text-orange-500"/>}
                                        {currentArtifact.title}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-sm text-gray-400">No artifact selected</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {currentArtifact && (currentArtifact.type === 'application/vnd.ant.code' || currentArtifact.language === 'html' || currentArtifact.language === 'react') && (
                                <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1 text-xs font-medium">
                                    <button 
                                        onClick={() => setPreviewMode('code')}
                                        className={`px-3 py-1 rounded-md transition-all ${previewMode === 'code' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                                    >
                                        Code
                                    </button>
                                    <button 
                                        onClick={() => setPreviewMode('preview')}
                                        className={`px-3 py-1 rounded-md transition-all ${previewMode === 'preview' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                                    >
                                        Preview
                                    </button>
                                </div>
                            )}
                            <button onClick={() => currentArtifact && handleDownloadArtifact(currentArtifact)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Download">
                                <Download size={16}/>
                            </button>
                            <button onClick={() => setIsArtifactOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                <X size={18}/>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {currentArtifact ? (
                            previewMode === 'preview' && (currentArtifact.type === 'application/vnd.ant.code' || currentArtifact.language === 'html' || currentArtifact.language === 'react') ? (
                                <iframe 
                                    srcDoc={getSandboxSrc(currentArtifact)} 
                                    className="w-full h-full border-none bg-white" 
                                    title="Artifact Preview"
                                    sandbox="allow-scripts"
                                />
                            ) : (
                                <div className="w-full h-full overflow-auto p-4 bg-[#f8f9fa] dark:bg-[#1e1e1e]">
                                    <pre className="font-mono text-sm text-[#333] dark:text-[#ccc] whitespace-pre-wrap">{currentArtifact.content}</pre>
                                </div>
                            )
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                No artifact loaded
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};