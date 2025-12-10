import React, { useState, useEffect } from 'react';
import { NovelProject, BookFormatSettings } from '../types';
import { generateFormattedBookHTML } from '../services/geminiService';
import { Button } from './Button';
import { Printer, FileText, X, BookOpen, Download, Droplet, Type, Layout, Wand2, BookCopy } from 'lucide-react';

interface BookFormatterProps {
    project: NovelProject;
    onUpdateProject: (project: NovelProject) => void;
    onClose: () => void;
}

const DEFAULT_SETTINGS: BookFormatSettings = {
    trimSize: '6x9',
    fontSize: 11,
    lineHeight: 1.4,
    fontFamily: 'Merriweather',
    includeTitlePage: true,
    includeCopyright: true,
    theme: 'classic',
    chapterHeadingStyle: 'default',
    sceneBreakStyle: 'asterisks',
};

export const BookFormatter: React.FC<BookFormatterProps> = ({ project, onUpdateProject, onClose }) => {
    const [settings, setSettings] = useState<BookFormatSettings>(project.formatSettings || DEFAULT_SETTINGS);
    const [previewHtml, setPreviewHtml] = useState('');
    const [activeBook, setActiveBook] = useState<number | 'all'>('all');

    const isTrilogy = project.chapters.some(c => /^Book \d+:\s*/.test(c.title));

    useEffect(() => {
        const bookNumber = activeBook === 'all' ? undefined : (activeBook as 1 | 2 | 3);
        const html = generateFormattedBookHTML(project, settings, bookNumber);
        setPreviewHtml(html);
        onUpdateProject({ ...project, formatSettings: settings });
    }, [project.chapters, settings, activeBook]);

    const handleDownload = (format: 'html' | 'doc', bookNumber?: 1 | 2 | 3 | 'all') => {
        const bookNum = bookNumber === 'all' ? undefined : (bookNumber as 1 | 2 | 3);
        const html = generateFormattedBookHTML(project, settings, bookNum);

        let mimeType = format === 'doc' ? 'application/msword;charset=utf-8' : 'text/html;charset=utf-8';
        let extension = format === 'doc' ? 'doc' : 'html';
        
        const blob = new Blob([html], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileNameSuffix = bookNum ? `_Book_${bookNum}` : '_Combined';
        a.download = `${project.title.replace(/\s+/g, '_')}${fileNameSuffix}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handlePrintPreview = (bookNumber?: 1 | 2 | 3 | 'all') => {
        const bookNum = bookNumber === 'all' ? undefined : (bookNumber as 1 | 2 | 3);
        const html = generateFormattedBookHTML(project, settings, bookNum);
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    };

    const ControlButton = ({ value, current, onClick, children }: any) => (
        <button onClick={onClick} className={`w-full p-2 rounded-lg border text-left flex justify-between items-center transition text-sm ${current === value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}>
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-fade-in flex flex-col h-[90vh]">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center"><Printer className="mr-3 text-indigo-500" /> Book Formatting Studio</h2>
                        <p className="text-sm text-slate-500 mt-1">Professional typesetting for print and digital distribution.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={24}/></button>
                </div>
                <div className="flex-1 flex overflow-hidden">
                    {/* Controls Panel */}
                    <div className="w-96 bg-slate-50 dark:bg-slate-900/50 p-6 border-r border-slate-200 dark:border-slate-800 flex flex-col gap-6 overflow-y-auto">
                        
                        {isTrilogy && (
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-3">Export View</label>
                                <div className="space-y-2">
                                    <ControlButton value={1} current={activeBook} onClick={() => setActiveBook(1)}>Book 1</ControlButton>
                                    <ControlButton value={2} current={activeBook} onClick={() => setActiveBook(2)}>Book 2</ControlButton>
                                    <ControlButton value={3} current={activeBook} onClick={() => setActiveBook(3)}>Book 3</ControlButton>
                                    <ControlButton value={'all'} current={activeBook} onClick={() => setActiveBook('all')}>Combined Trilogy</ControlButton>
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-3">Theme</label>
                            <div className="space-y-2">
                                <ControlButton value="classic" current={settings.theme} onClick={() => setSettings({...settings, theme: 'classic'})}>Classic Serif</ControlButton>
                                <ControlButton value="modern" current={settings.theme} onClick={() => setSettings({...settings, theme: 'modern'})}>Modern Sans</ControlButton>
                                <ControlButton value="ornate" current={settings.theme} onClick={() => setSettings({...settings, theme: 'ornate'})}>Ornate Italic</ControlButton>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-3">Chapter Headings</label>
                            <div className="space-y-2">
                                <ControlButton value="default" current={settings.chapterHeadingStyle} onClick={() => setSettings({...settings, chapterHeadingStyle: 'default'})}>Standard w/ Drop Cap</ControlButton>
                                <ControlButton value="centered" current={settings.chapterHeadingStyle} onClick={() => setSettings({...settings, chapterHeadingStyle: 'centered'})}>Centered</ControlButton>
                                <ControlButton value="fancy-line" current={settings.chapterHeadingStyle} onClick={() => setSettings({...settings, chapterHeadingStyle: 'fancy-line'})}>Centered with Line</ControlButton>
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-3">Scene Breaks</label>
                            <div className="space-y-2">
                                <ControlButton value="asterisks" current={settings.sceneBreakStyle} onClick={() => setSettings({...settings, sceneBreakStyle: 'asterisks'})}>* * *</ControlButton>
                                <ControlButton value="line" current={settings.sceneBreakStyle} onClick={() => setSettings({...settings, sceneBreakStyle: 'line'})}>Horizontal Line</ControlButton>
                                <ControlButton value="flourish" current={settings.sceneBreakStyle} onClick={() => setSettings({...settings, sceneBreakStyle: 'flourish'})}>❦ Flourish</ControlButton>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Typography</label>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Font Size</label>
                                        <input type="number" value={settings.fontSize} onChange={e => setSettings({...settings, fontSize: parseFloat(e.target.value)})} className="w-full p-2 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-700" step="0.5"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Line Height</label>
                                        <input type="number" value={settings.lineHeight} onChange={e => setSettings({...settings, lineHeight: parseFloat(e.target.value)})} className="w-full p-2 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-700" step="0.05"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-auto space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                           {isTrilogy ? (
                                <div className="space-y-4">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                        <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-3 flex items-center"><BookCopy size={16} className="mr-2"/> Trilogy Export</h4>
                                        <div className="space-y-2">
                                            {[1, 2, 3, 'all'].map(bookNum => (
                                                <div key={bookNum} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-md">
                                                    <span className="text-sm font-medium dark:text-white">
                                                        {bookNum === 'all' ? 'Combined Trilogy' : `Book ${bookNum}`}
                                                    </span>
                                                    <div className="flex gap-2">
                                                         <Button onClick={() => handlePrintPreview(bookNum as any)} size="sm" variant="ghost" icon={<Printer size={14}/>}/>
                                                         <Button onClick={() => handleDownload('doc', bookNum as any)} size="sm" variant="ghost" icon={<Download size={14}/>}/>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                           ) : (
                                <>
                                    <Button onClick={() => handlePrintPreview()} className="w-full" icon={<BookOpen size={16}/>}>Preview for Print (PDF)</Button>
                                    <Button onClick={() => handleDownload('html')} variant="secondary" className="w-full" icon={<FileText size={16}/>}>Export EPUB-ready HTML</Button>
                                    <Button onClick={() => handleDownload('doc')} variant="secondary" className="w-full" icon={<Download size={16}/>}>Export Word (.doc)</Button>
                                </>
                           )}
                        </div>
                    </div>
                    {/* Preview Panel */}
                    <div className="flex-1 bg-slate-200 dark:bg-black p-10 overflow-y-auto flex justify-center items-start">
                        <iframe
                            srcDoc={previewHtml}
                            title="Book Preview"
                            className="bg-white text-black shadow-2xl transition-all duration-300 origin-top"
                            style={{
                                width: settings.trimSize === '5x8' ? '5in' : settings.trimSize === '5.5x8.5' ? '5.5in' : '6in',
                                height: settings.trimSize === '5x8' ? '8in' : settings.trimSize === '5.5x8.5' ? '8.5in' : '9in',
                                transform: 'scale(0.85)'
                            }}
                            sandbox="allow-scripts"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};