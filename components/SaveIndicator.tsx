import React, { useEffect, useState } from 'react';
import { Check, Cloud, CloudOff, Loader2 } from 'lucide-react';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date;
  className?: string;
}

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({ 
  status, 
  lastSaved,
  className = ''
}) => {
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    if (status === 'saved') {
      setShowCheckmark(true);
      const timer = setTimeout(() => setShowCheckmark(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const getIcon = () => {
    switch (status) {
      case 'saving':
        return <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />;
      case 'saved':
        return showCheckmark ? 
          <Check size={16} className="text-green-600 dark:text-green-400" /> : 
          <Cloud size={16} className="text-slate-400" />;
      case 'error':
        return <CloudOff size={16} className="text-red-600 dark:text-red-400" />;
      default:
        return <Cloud size={16} className="text-slate-400" />;
    }
  };

  const getText = () => {
    switch (status) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return showCheckmark ? 'Saved!' : formatLastSaved();
      case 'error':
        return 'Save failed';
      default:
        return 'Unsaved changes';
    }
  };

  const formatLastSaved = () => {
    if (!lastSaved) return 'All changes saved';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
    
    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Saved ${Math.floor(diff / 3600)}h ago`;
    return 'Saved ' + lastSaved.toLocaleDateString();
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {getIcon()}
      <span className="text-slate-600 dark:text-slate-400">
        {getText()}
      </span>
    </div>
  );
};
