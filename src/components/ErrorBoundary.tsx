'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    if (typeof console !== 'undefined') {
      console.error(`[wotc:${this.props.label ?? 'boundary'}]`, error, info);
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="absolute inset-0 grid place-items-center bg-forest-900 text-bone p-6">
          <div className="max-w-md text-center">
            <div className="text-xs uppercase tracking-[0.5em] opacity-70 mb-3">StarClan whispers...</div>
            <h1 className="font-display text-3xl mb-3">The warriors have discovered an issue.</h1>
            <p className="text-sm opacity-80 mb-6">
              Something tangled in the brambles. Try again, or reset your cat if it keeps happening.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={this.reset}
                className="rounded-xl bg-thunder hover:bg-thunder/90 px-6 py-3 font-display text-lg shadow"
              >Try Again</button>
              <button
                onClick={() => { try { window.location.reload(); } catch {} }}
                className="rounded-xl border border-white/20 hover:bg-white/5 px-6 py-2 text-sm"
              >Reload Forest</button>
              <button
                onClick={() => { try { localStorage.removeItem('wotc_save_v1'); window.location.reload(); } catch {} }}
                className="text-xs opacity-60 hover:opacity-90 mt-2"
              >Reset cat & settings (last resort)</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
