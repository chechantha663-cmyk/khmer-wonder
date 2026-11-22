import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'មានបញ្ហាបច្ចេកទេសបណ្ដោះអាសន្ន។',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-canvas)] p-6 text-[var(--ink-primary)]">
        <div className="max-w-md rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-elevated)] p-6 text-center shadow-sm">
          <h1 className="font-display text-xl font-bold">មានបញ្ហាបន្តិចបន្តួច</h1>
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">
            សូមសាកល្បងផ្ទុកទំព័រឡើងវិញ ដើម្បីបន្តប្រើប្រាស់សួនកម្សាន្តខ្មែរ។
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-main)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)]"
          >
            <RefreshCw className="h-4 w-4" />
            ព្យាយាមម្ដងទៀត
          </button>
        </div>
      </div>
    );
  }
}
