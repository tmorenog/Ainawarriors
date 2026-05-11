'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/useGameStore';

// Compact rotating-task tracker. Players see what to do at a glance and the
// list refreshes itself as tasks complete. Tap the button to expand /
// collapse details, or to manually re-roll if you want different goals.
export function TasksPanel() {
  const tasks = useGameStore((s) => s.tasks);
  const reseed = useGameStore((s) => s.reseedTasks);
  const [open, setOpen] = useState(false);

  const totalProgress = tasks.reduce((acc, t) => acc + t.progress / t.goal, 0);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute right-3 top-[36%] z-30 rounded-l-xl bg-black/55 hover:bg-black/75 backdrop-blur px-3 py-2 text-xs text-bone shadow pointer-events-auto"
        title="Tasks — three rotating ambient goals"
      >
        ⛰ Tasks {tasks.filter((t) => t.progress >= t.goal).length > 0 ? '✓' : ''}
      </button>
      {open && (
        <div className="absolute right-3 top-[calc(36%+44px)] z-40 w-[280px] max-w-[90vw] bg-black/85 backdrop-blur rounded-xl p-3 text-bone text-xs shadow-xl pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display text-sm">Tasks</div>
            <button
              onClick={reseed}
              className="text-[10px] opacity-60 hover:opacity-100 underline"
              title="Re-roll all tasks"
            >re-roll</button>
          </div>
          <ul className="space-y-2">
            {tasks.map((t) => {
              const pct = Math.min(100, Math.round((t.progress / t.goal) * 100));
              const reward = [
                t.reward.hp ? `+${t.reward.hp}hp` : '',
                t.reward.hunger ? `+${t.reward.hunger}food` : '',
                t.reward.rep ? `+${t.reward.rep}rep` : '',
              ].filter(Boolean).join(' · ');
              return (
                <li key={t.id} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="leading-tight">{t.description}</span>
                    <span className="opacity-60 tabular-nums whitespace-nowrap">{t.progress}/{t.goal}</span>
                  </div>
                  <div className="h-1 rounded bg-white/10 overflow-hidden">
                    <div className="h-full bg-thunder" style={{ width: `${pct}%` }} />
                  </div>
                  {reward && <div className="text-[10px] opacity-60">reward: {reward}</div>}
                </li>
              );
            })}
          </ul>
          <div className="text-[10px] opacity-50 mt-2">
            New tasks roll in automatically as you finish them.
          </div>
        </div>
      )}
    </>
  );
}
