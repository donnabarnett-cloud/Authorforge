import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  // FIX: Initialize state using a class property to fix issues with 'this.state' not being recognized.
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full text-center">
            <div className="bg-red-100 dark:bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Failed to load the app.</h1>
            <p className="text-slate-500 mb-6 text-sm">
              There was an unexpected error. Please try reloading. Your data is safely stored in your browser.
            </p>
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded text-xs font-mono text-slate-600 dark:text-slate-400 mb-6 text-left overflow-auto max-h-32 border border-slate-200 dark:border-slate-700">
              {this.state.error?.message}
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => window.location.reload()} icon={<RefreshCcw size={16}/>}>
                Try reloading it.
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (this.props as any).children ?? null;
  }
}