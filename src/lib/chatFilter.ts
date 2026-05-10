const BANNED = [
  // intentionally mild list — extend in production
  'idiot', 'stupid', 'hate you', 'kys',
  'shit', 'fuck', 'bitch', 'asshole', 'damn',
  'noob', 'loser',
];

const SLUR_HINTS = [/n[\W_]*[i1!|][\W_]*g[\W_]*g/i, /f[\W_]*a[\W_]*g/i];

export interface FilterResult {
  clean: string;
  flagged: boolean;
  reasons: string[];
}

export function filterChat(input: string): FilterResult {
  let clean = input ?? '';
  const reasons: string[] = [];
  let flagged = false;

  for (const word of BANNED) {
    const re = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'ig');
    if (re.test(clean)) {
      flagged = true;
      reasons.push(`profanity:${word}`);
      clean = clean.replace(re, '*'.repeat(Math.max(2, word.length)));
    }
  }
  for (const re of SLUR_HINTS) {
    if (re.test(clean)) {
      flagged = true;
      reasons.push('slur');
      clean = clean.replace(re, '****');
    }
  }
  // light personal-info heuristics
  if (/\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/.test(clean)) {
    flagged = true; reasons.push('phone');
    clean = clean.replace(/\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/g, '[redacted]');
  }
  if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/i.test(clean)) {
    flagged = true; reasons.push('email');
    clean = clean.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, '[redacted]');
  }

  return { clean: clean.slice(0, 240), flagged, reasons };
}

export function safeUsername(name: string): string {
  const trimmed = (name || '').trim().slice(0, 24);
  const filtered = filterChat(trimmed);
  if (filtered.flagged || trimmed.length < 2) return '';
  return filtered.clean.replace(/[^A-Za-z0-9 _'-]/g, '');
}
