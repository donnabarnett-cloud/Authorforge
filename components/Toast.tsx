import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
    toasts: ToastMessage[];
    removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col space-y-3 pointer-events-none">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
            ))}
        </div>
    );
};

const Toast: React.FC<{ toast: ToastMessage, onDismiss: () => void }> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const icons = {
        success: <CheckCircle2 size={20} className="text-green-500" />,
        error: <AlertOctagon size={20} className="text-red-500" />,
        warning: <AlertTriangle size={20} className="text-amber-500" />,
        info: <Info size={20} className="text-blue-500" />
    };

    const borders = {
        success: "border-l-green-500",
        error: "border-l-red-500",
        warning: "border-l-amber-500",
        info: "border-l-blue-500"
    };

    return (
        <div className={`pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg p-4 w-80 flex items-start gap-3 border-l-4 ${borders[toast.type]} animate-fade-in transform transition-all hover:scale-105`}>
            <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1">
                {toast.title && <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">{toast.title}</h4>}
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-tight">{toast.message}</p>
            </div>
            <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={16}/></button>
        </div>
    );
};
