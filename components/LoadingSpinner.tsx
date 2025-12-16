import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 24, 
  className = '', 
  message 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 
        size={size} 
        className="animate-spin text-indigo-600 dark:text-indigo-400" 
      />
      {message && (
        <p className="text-sm text-slate-600 dark:text-slate-400 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};
