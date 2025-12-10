import React, { useState, useEffect, useRef } from 'react';
import { Edit3, Loader2, Sparkles, X, Microscope, Volume2, Mic, Eye, Ear, Hand, Expand, Minimize, History, RotateCcw, Timer, Flag, Zap, User, ArrowUp, ArrowDown, VolumeX, BookOpen, Clock, Bold, Italic, Heading, Wand2, Glasses } from 'lucide-react';
import { applyBrush, generateChapterContent, analyzeSelection, generateSpeech, playAudio, injectSensoryDetail, performDeepLineEdit } from '../services/geminiService';
import { Button } from './Button';
import { ChapterSnapshot, Character, ToastMessage, AIAgent, NovelProject } from '../types';
import { DiffViewer } from './DiffViewer';

interface EditorProps {
  content: string;
  onChange: (newContent: string) => void;
  title: string;
  onTitleChange: (newTitle: string) => void;
  projectContext?: {
    styleGuide: string;
    genre: string;
    storyBible: string;
    characters?: Character[];
    team?: AIAgent[];
    fullProject?: NovelProject;
  };
  isZenMode: boolean;
  onToggleZenMode: () => void;
  snapshots?: ChapterSnapshot[];
  onSaveSnapshot?: (note: string) => void;
  onRestoreSnapshot?: (snapshot: ChapterSnapshot) => void;
  addToast?: (type: ToastMessage['type'], message: string) => void;
  editorFont?: 'serif' | 'sans' | 'mono';
  onUpdateFont?: (font: 'serif' | 'sans' | 'mono') => void;
  xRayModeState?: boolean;
  setXRayModeState?: (val: boolean | ((prev: boolean) => boolean)) => void;
  typewriterModeState?: boolean;
  setTypewriterModeState?: (val: boolean | ((prev: boolean) => boolean)) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

interface BrushMenuState { visible: boolean; x: number; y: number; selection: string; start: number; end: number; }

const XRayHighlight: React.FC<{ text: string }> = ({ text }) => {
    const highlight = (inputText: string): React.ReactNode => {
        const adverbRegex = /\b(\w+ly)\b/gi;
        const passiveRegex = /\b(is|are|was|were|be|been|being)\s+([a-zA-Z]+ed)\b/gi;

        let parts: React.ReactNode[] = [inputText];

        const applyRegex = (regex: RegExp, className: string, title: string) => {
            let newParts: React.ReactNode[] = [];
            parts.forEach((part, index) => {
                if (typeof part === 'string') {
                    const matches = [...part.matchAll(regex)];
                    if (matches.length === 0) {
                        newParts.push(part);
                        return;
                    }
                    let lastIndex = 0;
                    matches.forEach((match, matchIndex) => {
                        if (match.index! > lastIndex) {
                            newParts.push(part.substring(lastIndex, match.index));
                        }
                        newParts.push(
                            <span key={`${className}-${index}-${matchIndex}`} className={className} title={title}>
                                {match[0]}
                            </span>
                        );
                        lastIndex = match.index! + match[0].length;
                    });
                    if (lastIndex < part.length) {
                        newParts.push(part.substring(lastIndex));
                    }
                } else {
                    newParts.push(part);
                }
            });
            parts = newParts;
        };

        applyRegex(adverbRegex, "bg-amber-200 dark:bg-amber-800/50 rounded px-0.5", "Adverb");
        applyRegex(passiveRegex, "bg-red-200 dark:bg-red-800/50 rounded px-0.5", "Passive Voice");

        return <>{parts}</>;
    };

    return <div className="whitespace-pre-wrap">{highlight(text)}</div>;
};


export const Editor: React.FC<EditorProps> = ({ 
    content, onChange, title, onTitleChange, projectContext, isZenMode, onToggleZenMode, snapshots, onSaveSnapshot, onRestoreSnapshot, addToast, editorFont = 'serif', onUpdateFont,
    xRayModeState, setXRayModeState, typewriterModeState, setTypewriterModeState, scrollContainerRef
}) => {
  const [brushMenu, setBrushMenu] = useState<BrushMenuState>({ visible: false, x: 0, y: 0, selection: '', start: 0, end: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Track if we are editing the whole chapter or just a selection
  const [rewriteTarget, setRewriteTarget] = useState<'chapter' | 'selection'>('chapter');
  const [pendingRewrite, setPendingRewrite] = useState<{ original: string, modified: string } | null>(null);
  
  const [internalTypewriterMode, setInternalTypewriterMode] = useState(false);
  const [internalXRayMode, setInternalXRayMode] = useState(false);
  const typewriterMode = typewriterModeState !== undefined ? typewriterModeState : internalTypewriterMode;
  const setTypewriterMode = setTypewriterModeState || setInternalTypewriterMode;
  const xRayMode = xRayModeState !== undefined ? xRayModeState : internalXRayMode;
  const setXRayMode = setXRayModeState || setInternalXRayMode;
  
  const [rewriteInstructions, setRewriteInstructions] = useState("");
  const [showRewriteModal, setShowRewriteModal] = useState(false);
  const [currentWordCount, setCurrentWordCount] = useState(0);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fontClass = editorFont === 'serif' ? 'font-serif' : editorFont === 'sans' ? 'font-sans' : 'font-mono';

  useEffect(() => { setCurrentWordCount(content.split(/\s+/).filter(w => w).length); }, [content]);
  
  useEffect(() => {
      if (typewriterMode && editorRef.current) {
          const handleTypewriterScroll = () => {
              if (!editorRef.current || document.activeElement !== editorRef.current) return;
              const cursorPosition = editorRef.current.selectionStart;
              const textBeforeCursor = editorRef.current.value.substring(0, cursorPosition);
              const lines = textBeforeCursor.split('\n').length;
              const computedStyle = window.getComputedStyle(editorRef.current);
              const lineHeight = parseFloat(computedStyle.lineHeight) || 28;
              const container = scrollContainerRef?.current;
              if (container) {
                  const scrollTarget = (editorRef.current.offsetTop + (lines * lineHeight)) - (container.clientHeight / 2);
                  container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
              }
          };
          const textarea = editorRef.current;
          textarea.addEventListener('input', handleTypewriterScroll);
          textarea.addEventListener('click', handleTypewriterScroll);
          textarea.addEventListener('keyup', handleTypewriterScroll);
          return () => {
              textarea.removeEventListener('input', handleTypewriterScroll);
              textarea.removeEventListener('click', handleTypewriterScroll);
              textarea.removeEventListener('keyup', handleTypewriterScroll);
          }
      }
  }, [typewriterMode, scrollContainerRef, editorFont]);

  useEffect(() => {
    if (editorRef.current && !xRayMode) {
      editorRef.current.style.height = 'auto';
      editorRef.current.style.height = editorRef.current.scrollHeight + 'px';
    }
  }, [content, editorFont, xRayMode]);

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const text = target.value.substring(start, end);
    if (text.length > 0) {
        setBrushMenu({ visible: true, x: 0, y: 0, selection: text, start, end });
    } else {
        setBrushMenu({ ...brushMenu, visible: false, selection: '', start: 0, end: 0 });
    }
  };

  const updateEditorContent = (newText: string, start?: number, end?: number) => {
      if (!editorRef.current) return;
      const s = start !== undefined ? start : editorRef.current.selectionStart;
      const e = end !== undefined ? end : editorRef.current.selectionEnd;
      const fullText = editorRef.current.value;
      onChange(fullText.substring(0, s) + newText + fullText.substring(e));
  }

  const handleBrushAction = async (action: string) => {
      if (!editorRef.current) return;
      setIsProcessing(true);
      if (action === 'bold') { updateEditorContent(`**${brushMenu.selection}**`); }
      else if (action === 'italic') { updateEditorContent(`*${brushMenu.selection}*`); }
      else if (['sight', 'sound', 'smell', 'touch'].includes(action)) {
          const newText = await injectSensoryDetail(brushMenu.selection, action);
          updateEditorContent(newText);
      } else if (action === 'edit') {
          // Open Deep Edit for Selection
          setRewriteTarget('selection');
          setShowRewriteModal(true);
      } else {
          const newText = await applyBrush(brushMenu.selection, action === 'improve' ? "Improve flow." : "Fix grammar.");
          updateEditorContent(newText);
      }
      setIsProcessing(false);
      setBrushMenu({ ...brushMenu, visible: false });
  };

  const handleDeepEdit = async () => {
    if (!rewriteInstructions.trim() || !projectContext?.fullProject) return;
    if (onSaveSnapshot) onSaveSnapshot("Pre-Edit Auto-Save");
    setIsRewriting(true);
    
    // Determine text to edit (Selection vs Whole Chapter)
    const textToEdit = rewriteTarget === 'selection' ? brushMenu.selection : content;
    
    try {
        const newContent = await performDeepLineEdit(textToEdit, projectContext.fullProject, rewriteInstructions);
        setPendingRewrite({ original: textToEdit, modified: newContent });
    } catch (e) {
        if (addToast) addToast('error', 'Edit failed. Try a shorter section or check connection.');
    }
    
    setIsRewriting(false);
    setShowRewriteModal(false);
    setRewriteInstructions("");
  };

  const acceptRewrite = () => {
      if (!pendingRewrite) return;
      
      if (rewriteTarget === 'selection') {
          updateEditorContent(pendingRewrite.modified, brushMenu.start, brushMenu.end);
      } else {
          onChange(pendingRewrite.modified);
      }
      
      setPendingRewrite(null);
      setBrushMenu({ ...brushMenu, visible: false, selection: '' });
      if (addToast) addToast('success', 'Edits applied successfully.');
  };

  const handleGenerateChapter = async () => {
    if (!projectContext) return;
    setIsGenerating(true);
    const newContent = await generateChapterContent(title, "", projectContext.styleGuide, projectContext.genre, projectContext.storyBible);
    onChange(newContent);
    setIsGenerating(false);
  };

  return (
    <div className={`mx-auto py-12 px-8 min-h-screen relative transition-all duration-500 flex flex-col ${isZenMode ? 'max-w-4xl' : 'max-w-3xl'}`} ref={containerRef}>
      <div className="flex-1 pb-16">
        <div className="mb-6 flex justify-between items-center group sticky top-0 z-10 bg-gray-100 dark:bg-slate-950 py-2 transition-opacity duration-300">
            <div className="flex-1 flex space-x-2">
                <Button variant="ghost" onClick={onToggleZenMode} icon={isZenMode ? <Minimize size={16}/> : <Expand size={16}/>} className="text-slate-400">{isZenMode ? 'Exit Zen' : 'Zen'}</Button>
                {onUpdateFont && !isZenMode && (
                    <div className="flex bg-slate-200 dark:bg-slate-800 rounded-md p-0.5">
                        {['serif', 'sans', 'mono'].map(f => (
                            <button key={f} onClick={() => onUpdateFont(f as any)} className={`px-2 py-1 rounded text-xs capitalize ${editorFont === f ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>{f}</button>
                        ))}
                    </div>
                )}
                <Button variant="ghost" onClick={() => setTypewriterMode(p => !p)} icon={typewriterMode ? <ArrowUp size={16}/> : <ArrowDown size={16}/>} className={`text-slate-400 ${typewriterMode ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>Typewriter</Button>
                <Button variant="ghost" onClick={() => setXRayMode(p => !p)} icon={xRayMode ? <Edit3 size={16}/> : <Glasses size={16}/>} className={`text-slate-400 ${xRayMode ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>X-Ray</Button>
            </div>
            
            {!isZenMode && (
                <div className="text-xs text-slate-400 flex items-center gap-4">
                    <span>Chapter: <strong>{currentWordCount.toLocaleString()}</strong></span>
                    <span className="font-medium">Total: <strong>{(projectContext?.fullProject?.currentWordCount || 0).toLocaleString()}</strong></span>
                </div>
            )}

            <div className={`flex space-x-2 justify-end flex-1 ${isZenMode ? 'opacity-0 group-hover:opacity-100' : ''}`}>
                {!content.trim() && !isGenerating && <Button onClick={handleGenerateChapter} icon={<Sparkles size={16}/>} className="animate-pulse shadow-lg">Generate</Button>}
                {content.trim().length > 0 && <Button variant="secondary" onClick={() => { setRewriteTarget('chapter'); setShowRewriteModal(true); }} icon={<Wand2 size={16}/>} className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">Deep Edit</Button>}
            </div>
        </div>

        <input type="text" value={title} onChange={(e) => onTitleChange(e.target.value)} className={`text-4xl font-bold text-slate-900 dark:text-slate-100 w-full border-none focus:ring-0 bg-transparent mb-8 ${fontClass} ${isZenMode ? 'text-center' : ''}`} placeholder="Chapter Title"/>

        {isGenerating ? <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 size={48} className="animate-spin text-indigo-500 mb-4"/><p>Drafting chapter...</p></div> : xRayMode ? (
            <div className={`w-full text-lg leading-relaxed text-slate-800 dark:text-slate-300 ${fontClass} ${isZenMode ? 'text-xl leading-loose' : ''}`}>
                 <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 mb-4">
                    <strong>X-Ray Mode is active (Read-only).</strong> Words highlighted in <span className="bg-amber-200 dark:bg-amber-800/50 rounded px-1">amber</span> are adverbs. Words in <span className="bg-red-200 dark:bg-red-800/50 rounded px-1">red</span> may be passive voice.
                </div>
                <XRayHighlight text={content} />
            </div>
        ) : (
            <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onSelect={handleSelect}
                className={`w-full resize-none border-none focus:ring-0 bg-transparent text-lg leading-relaxed text-slate-800 dark:text-slate-300 ${fontClass} min-h-[60vh] outline-none placeholder:text-slate-300 ${isZenMode ? 'text-xl leading-loose' : ''}`}
                placeholder="Start writing..."
                spellCheck={false}
            />
        )}
      </div>

      {brushMenu.visible && !isRewriting && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white rounded-xl shadow-2xl p-2 z-50 flex items-center space-x-1 border border-slate-700">
            <button onClick={() => handleBrushAction('bold')} className="hover:bg-slate-700 p-2 rounded"><Bold size={14}/></button>
            <button onClick={() => handleBrushAction('italic')} className="hover:bg-slate-700 p-2 rounded"><Italic size={14}/></button>
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            <button onClick={() => handleBrushAction('improve')} className="hover:bg-slate-700 px-3 py-1 rounded text-sm">Improve</button>
            <button onClick={() => handleBrushAction('edit')} className="hover:bg-slate-700 px-3 py-1 rounded text-sm flex items-center text-indigo-300 font-bold"><Wand2 size={12} className="mr-1"/> Deep Edit</button>
            <button onClick={() => handleBrushAction('sight')} className="hover:bg-slate-700 p-2 rounded"><Eye size={14}/></button>
        </div>
      )}

      {showRewriteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-fade-in">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center"><Wand2 size={18} className="mr-2 text-indigo-500"/> Deep Line Edit {rewriteTarget === 'selection' && <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full uppercase">Selection</span>}</h3>
                    <button onClick={() => setShowRewriteModal(false)}><X size={18} className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-500 mb-4">The AI will read your <strong>entire manuscript</strong> to understand context, then edit {rewriteTarget === 'selection' ? 'this selection' : 'this chapter'} to improve prose, pacing, and voice without changing the plot.</p>
                    <textarea value={rewriteInstructions} onChange={(e) => setRewriteInstructions(e.target.value)} className="w-full h-32 p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm mb-4 resize-none focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="E.g., 'Make the dialogue snappier', 'Increase tension', 'Fix passive voice'..."/>
                    <div className="flex justify-end space-x-3">
                        <Button variant="ghost" onClick={() => setShowRewriteModal(false)}>Cancel</Button>
                        <Button onClick={handleDeepEdit} disabled={isRewriting || !rewriteInstructions.trim()} icon={isRewriting ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}>{isRewriting ? 'Reading & Editing...' : 'Run Deep Edit'}</Button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {pendingRewrite && (
          <DiffViewer 
              original={pendingRewrite.original} 
              modified={pendingRewrite.modified} 
              onAccept={acceptRewrite}
              onReject={() => setPendingRewrite(null)}
          />
      )}
    </div>
  );
};