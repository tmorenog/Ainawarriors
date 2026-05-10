'use client';

import { Component, type ReactNode } from 'react';

/**
 * Error boundary that's safe to use INSIDE a React Three Fiber <Canvas>.
 * On render-error in its subtree it renders nothing (so a failing piece
 * of the scene doesn't take down the rest), and logs to console.
 */
export class SilentErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { errored: boolean }
> {
  state = { errored: false };

  static getDerivedStateFromError() {
    return { errored: true };
  }

  componentDidCatch(error: Error, info: any) {
    if (typeof console !== 'undefined') {
      console.warn(`[wotc:scene:${this.props.label ?? 'piece'}] failed`, error, info);
    }
  }

  render() {
    if (this.state.errored) return null;
    return this.props.children as any;
  }
}
