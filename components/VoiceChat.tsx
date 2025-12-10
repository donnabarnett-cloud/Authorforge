import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, X, Loader2, Volume2, User, Sparkles } from 'lucide-react';
import { LiveClient, SoundManager, decode, decodeAudioData } from '../services/geminiService';
import { LiveServerMessage } from '@google/generative-ai';

interface VoiceChatProps {
    onClose: () => void;
}

type Transcription = {
    id: string;
    text: string;
    author: 'user' | 'model';
    isFinal: boolean;
};

export const VoiceChat: React.FC<VoiceChatProps> = ({ onClose }) => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const clientRef = useRef<LiveClient | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const nextStartTime = useRef(0);
    const sources = useRef<Set<AudioBufferSourceNode>>(new Set());

    useEffect(() => {
        clientRef.current = new LiveClient();
        return () => {
            clientRef.current?.disconnect();
        };
    }, []);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcriptions]);

    const handleMessage = async (message: LiveServerMessage) => {
        let author: 'user' | 'model' | null = null;
        let text = '';
        if (message.serverContent?.outputTranscription) {
            author = 'model';
            text = message.serverContent.outputTranscription.text;
        } else if (message.serverContent?.inputTranscription) {
            author = 'user';
            text = message.serverContent.inputTranscription.text;
        }
        
        if (author && text) {
            setTranscriptions(prev => {
                const last = prev[prev.length - 1];
                if (last && last.author === author && !last.isFinal) {
                    const updated = [...prev];
                    updated[prev.length - 1] = { ...last, text: last.text + text };
                    return updated;
                } else {
                    return [...prev, { id: Date.now().toString(), text, author, isFinal: false }];
                }
            });
        }
        
        if (message.serverContent?.turnComplete) {
            setTranscriptions(prev => prev.map(t => ({ ...t, isFinal: true })));
        }

        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;

        if (base64EncodedAudioString) {
            const soundManager = SoundManager.getInstance();
            const outputAudioContext = soundManager.getOutputContext();
            await soundManager.resumeOutput();
            
            nextStartTime.current = Math.max(
                nextStartTime.current,
                outputAudioContext.currentTime,
            );
            
            const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                outputAudioContext,
                24000,
                1,
            );
            
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            
            source.addEventListener('ended', () => {
                sources.current.delete(source);
            });

            source.start(nextStartTime.current);
            nextStartTime.current = nextStartTime.current + audioBuffer.duration;
            sources.current.add(source);
        }

        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
            for (const source of sources.current.values()) {
                source.stop();
                sources.current.delete(source);
            }
            nextStartTime.current = 0;
        }
    };

    const toggleConnection = async () => {
        if (isConnected) {
            clientRef.current?.disconnect();
        } else {
            setIsConnecting(true);
            await clientRef.current?.connect(
                handleMessage,
                (e) => {
                    console.error("Voice Chat Error:", e);
                    setTranscriptions(p => [...p, { id: Date.now().toString(), text: `Error: ${(e as Error).message}`, author: 'model', isFinal: true }]);
                    setIsConnected(false);
                    setIsConnecting(false);
                },
                (e) => {
                    setTranscriptions(p => [...p, { id: Date.now().toString(), text: "Connection closed.", author: 'model', isFinal: true }]);
                    setIsConnected(false);
                    setIsConnecting(false);
                }
            );
            setIsConnecting(false);
            setIsConnected(true);
            setTranscriptions(p => [...p, { id: Date.now().toString(), text: "Connected. Speak now.", author: 'model', isFinal: true }]);
        }
    };

    return (
        <div className="fixed bottom-20 right-8 z-50 w-80 bg-slate-900 rounded-2xl shadow-2xl border border-indigo-500/50 overflow-hidden animate-fade-in flex flex-col">
            <div className="p-4 bg-indigo-600 flex justify-between items-center text-white">
                <div className="flex items-center font-bold"><Volume2 size={20} className="mr-2"/> Voice Mode</div>
                <button onClick={onClose}><X size={18}/></button>
            </div>
            <div ref={logsEndRef} className="h-64 bg-slate-950 p-4 overflow-y-auto text-sm text-indigo-300 space-y-4">
                {transcriptions.map(t => (
                    <div key={t.id} className={`flex gap-2 items-start ${t.author === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {t.author === 'model' && <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0"><Sparkles size={12}/></div>}
                        <div className={`p-2 rounded-lg max-w-[85%] ${t.author === 'user' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300'} ${!t.isFinal ? 'opacity-70' : ''}`}>
                            {t.text}
                        </div>
                         {t.author === 'user' && <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center shrink-0"><User size={12}/></div>}
                    </div>
                ))}
            </div>
            <div className="p-6 flex justify-center bg-slate-900 border-t border-slate-800">
                <button 
                    onClick={toggleConnection}
                    disabled={isConnecting}
                    className={`p-4 rounded-full transition-all duration-500 shadow-lg disabled:opacity-50 ${isConnected ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                >
                    {isConnecting ? <Loader2 size={32} className="text-white animate-spin"/> : isConnected ? <MicOff size={32} className="text-white"/> : <Mic size={32} className="text-white"/>}
                </button>
            </div>
        </div>
    );
};
