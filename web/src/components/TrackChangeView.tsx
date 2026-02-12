import React from 'react';
import { TrackChange, REVIEWER_COLOURS } from '../wasm';
import { useCollateStore } from '../hooks/useCollateStore';

interface TrackChangeViewProps {
  trackChanges: TrackChange[];
  baseText: string;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  unresolved: { bg: 'var(--grey-bg)', border: 'var(--grey-border)', text: 'var(--grey)' },
  accepted: { bg: 'var(--green-bg)', border: 'var(--green-border)', text: 'var(--green)' },
  rejected: { bg: 'var(--red-bg)', border: 'var(--red-border)', text: 'var(--red)' },
  deferred: { bg: 'var(--amber-bg)', border: 'var(--amber-border)', text: 'var(--amber)' },
};

export function TrackChangeView({ trackChanges, baseText }: TrackChangeViewProps) {
  const { statuses, setStatus, reviewers } = useCollateStore();

  if (trackChanges.length === 0) return null;

  // Group by author
  const byAuthor = new Map<string, TrackChange[]>();
  for (const tc of trackChanges) {
    const existing = byAuthor.get(tc.author) || [];
    existing.push(tc);
    byAuthor.set(tc.author, existing);
  }

  return (
    <div className="space-y-2">
      {Array.from(byAuthor.entries()).map(([author, changes], groupIdx) => {
        const reviewer = reviewers.find((r) => r.name === author);
        const colour = reviewer?.colour || REVIEWER_COLOURS[groupIdx % REVIEWER_COLOURS.length].accent;

        return (
          <div key={author} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${colour}25` }}>
            {/* Author header */}
            <div className="px-3 py-2 flex items-center gap-2" style={{ background: `${colour}08` }}>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colour }} />
              <span className="text-xs font-semibold" style={{ color: colour }}>{author}</span>
              {changes[0].date && (
                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-light)' }}>
                  {new Date(changes[0].date).toLocaleDateString('en-GB')}
                </span>
              )}
            </div>

            {/* Inline diff */}
            <div className="px-3 py-2 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              <InlineDiff baseText={baseText} changes={changes} />
            </div>

            {/* Per-change status controls */}
            <div className="px-3 pb-2 space-y-1.5">
              {changes.map((tc) => {
                const currentStatus = statuses.get(tc.id)?.status || 'unresolved';
                const currentNote = statuses.get(tc.id)?.note || '';
                const style = STATUS_STYLES[currentStatus];

                return (
                  <div key={tc.id} className="flex items-center gap-2">
                    <select
                      value={currentStatus}
                      onChange={(e) => setStatus(tc.id, e.target.value as any)}
                      className="select"
                      style={{
                        width: 'auto',
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: style.bg,
                        color: style.text,
                        borderColor: style.border,
                      }}
                    >
                      <option value="unresolved">Unresolved</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                      <option value="deferred">Deferred</option>
                    </select>
                    <input
                      type="text"
                      value={currentNote}
                      onChange={(e) => setStatus(tc.id, currentStatus, e.target.value)}
                      placeholder="Note..."
                      className="input input-sm flex-1"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InlineDiff({ baseText, changes }: { baseText: string; changes: TrackChange[] }) {
  const parts: React.ReactElement[] = [];

  const sorted = [...changes].sort((a, b) => {
    const posA = baseText.indexOf(a.context_before + a.original_text);
    const posB = baseText.indexOf(b.context_before + b.original_text);
    return posA - posB;
  });

  let lastEnd = 0;

  for (let i = 0; i < sorted.length; i++) {
    const tc = sorted[i];

    if (tc.change_type === 'Deletion') {
      const pos = baseText.indexOf(tc.original_text, lastEnd);
      if (pos >= 0) {
        if (pos > lastEnd) {
          parts.push(<span key={`pre-${i}`}>{baseText.slice(lastEnd, pos)}</span>);
        }
        parts.push(
          <del key={`del-${i}`} className="tc-deletion">{tc.original_text}</del>
        );
        lastEnd = pos + tc.original_text.length;
      }
    } else if (tc.change_type === 'Insertion') {
      const contextPos = baseText.indexOf(tc.context_before, lastEnd > 0 ? lastEnd - tc.context_before.length : 0);
      const insertPos = contextPos >= 0 ? contextPos + tc.context_before.length : lastEnd;

      if (insertPos > lastEnd) {
        parts.push(<span key={`pre-${i}`}>{baseText.slice(lastEnd, insertPos)}</span>);
      }
      parts.push(
        <ins key={`ins-${i}`} className="tc-insertion">{tc.new_text}</ins>
      );
      lastEnd = insertPos;
    }
  }

  if (lastEnd < baseText.length) {
    parts.push(<span key="tail">{baseText.slice(lastEnd)}</span>);
  }

  if (parts.length === 0) {
    return (
      <span>
        {changes.map((tc, i) => (
          <span key={i}>
            {tc.change_type === 'Deletion' && <del className="tc-deletion">{tc.original_text}</del>}
            {tc.change_type === 'Insertion' && <ins className="tc-insertion">{tc.new_text}</ins>}
            {i < changes.length - 1 && ' '}
          </span>
        ))}
      </span>
    );
  }

  return <>{parts}</>;
}
