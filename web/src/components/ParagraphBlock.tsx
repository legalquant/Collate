import { useState } from 'react';
import { MergedParagraph } from '../wasm';
import { useCollateStore } from '../hooks/useCollateStore';
import { TrackChangeView } from './TrackChangeView';
import { CommentCard } from './CommentCard';
import {
  AlertTriangle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  GitCompare,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';

interface ParagraphBlockProps {
  paragraph: MergedParagraph;
}

export function ParagraphBlock({ paragraph }: ParagraphBlockProps) {
  const { activeFilter, statuses, bulkSetStatus } = useCollateStore();
  const [collapsed, setCollapsed] = useState(false);

  const allIds = [
    ...paragraph.track_changes.map((tc) => tc.id),
    ...paragraph.comments.map((c) => c.id),
    ...paragraph.manual_comments.map((mc) => mc.id),
  ];

  const totalItems = allIds.length;
  const resolvedItems = allIds.filter((id) => {
    const s = statuses.get(id)?.status;
    return s && s !== 'unresolved';
  }).length;
  const unresolvedIds = allIds.filter((id) => {
    const s = statuses.get(id)?.status;
    return !s || s === 'unresolved';
  });

  const isFullyResolved = resolvedItems === totalItems && totalItems > 0;
  const isWhollyInserted = paragraph.paragraph_status === 'WhollyInserted';
  const isWhollyDeleted = paragraph.paragraph_status === 'WhollyDeleted';
  const isWholesale = isWhollyInserted || isWhollyDeleted;

  // Apply filters
  if (activeFilter === 'unresolved' && unresolvedIds.length === 0) return null;
  if (activeFilter === 'conflicts' && !paragraph.has_conflicts) return null;
  if (activeFilter === 'track_changes' && paragraph.track_changes.length === 0) return null;
  if (activeFilter === 'comments' && paragraph.comments.length === 0 && paragraph.manual_comments.length === 0) return null;
  if (activeFilter === 'new' && !paragraph.has_new_items) return null;
  if (activeFilter === 'wholesale' && !isWholesale) return null;

  // For normal paragraphs, skip those with no actionable items
  if (totalItems === 0 && !isWholesale) return null;

  // Determine display text for wholesale paragraphs
  const displayText = isWhollyInserted
    ? paragraph.revised_text
    : isWhollyDeleted
    ? paragraph.base_text
    : paragraph.base_text;

  // Left border colour
  const borderColor = isFullyResolved
    ? 'var(--green)'
    : isWhollyInserted
    ? '#10B981'
    : isWhollyDeleted
    ? '#EF4444'
    : paragraph.has_conflicts
    ? 'var(--amber)'
    : 'var(--border)';

  return (
    <div
      id={`para-${paragraph.index}`}
      className="card overflow-hidden transition-all animate-slide-up"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
        opacity: isFullyResolved ? 0.7 : 1,
      }}
    >
      {/* Header — clickable to collapse */}
      <div
        className="flex items-center justify-between cursor-pointer -m-5 mb-0 px-5 py-3"
        style={{
          background: isFullyResolved
            ? 'var(--green-bg)'
            : isWhollyInserted
            ? '#f0fdf4'
            : isWhollyDeleted
            ? '#fef2f2'
            : 'var(--bg-main)',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          {collapsed
            ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-light)' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-light)' }} />
          }
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>
            ¶ {paragraph.index + 1}
          </span>

          {/* Wholesale badges */}
          {isWhollyInserted && (
            <span className="badge badge-green">
              <Plus className="w-3 h-3" />
              New Paragraph
            </span>
          )}
          {isWhollyDeleted && (
            <span className="badge badge-red">
              <Minus className="w-3 h-3" />
              Deleted Paragraph
            </span>
          )}

          {/* Other badges */}
          {paragraph.has_conflicts && (
            <span className="badge badge-amber">
              <AlertTriangle className="w-3 h-3" />
              Conflict
            </span>
          )}
          {paragraph.has_new_items && !isWholesale && (
            <span className="badge badge-accent">
              <Sparkles className="w-3 h-3" />
              New
            </span>
          )}
          {isFullyResolved && (
            <span className="badge badge-green">
              <CheckCircle2 className="w-3 h-3" />
              Resolved
            </span>
          )}

          {/* Author attribution for wholesale changes */}
          {paragraph.paragraph_change_author && (
            <span className="text-[10px]" style={{ color: 'var(--text-light)' }}>
              by {paragraph.paragraph_change_author}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {paragraph.track_changes.length > 0 && (
            <span className="badge badge-grey">
              <GitCompare className="w-3 h-3" />
              {paragraph.track_changes.length}
            </span>
          )}
          {(paragraph.comments.length + paragraph.manual_comments.length) > 0 && (
            <span className="badge badge-grey">
              <MessageSquare className="w-3 h-3" />
              {paragraph.comments.length + paragraph.manual_comments.length}
            </span>
          )}
          {totalItems > 0 && (
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-light)' }}>
              {resolvedItems}/{totalItems}
            </span>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="mt-4 animate-fade-in">
          {/* Paragraph text */}
          {isWhollyInserted ? (
            <div className="text-sm leading-relaxed mb-4 p-3 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <ins className="tc-insertion no-underline" style={{ textDecoration: 'none', background: 'transparent', color: '#065f46' }}>
                {displayText}
              </ins>
            </div>
          ) : isWhollyDeleted ? (
            <div className="text-sm leading-relaxed mb-4 p-3 rounded-lg" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
              <del className="tc-deletion" style={{ background: 'transparent', color: '#991b1b' }}>
                {displayText}
              </del>
            </div>
          ) : (
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {displayText}
            </p>
          )}

          {/* Status controls for wholesale paragraph changes */}
          {isWholesale && totalItems === 0 && (
            <WholesaleStatusControl paragraph={paragraph} />
          )}

          {/* Bulk action for this paragraph */}
          {unresolvedIds.length > 1 && (
            <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <span className="text-xs" style={{ color: 'var(--text-light)' }}>
                {unresolvedIds.length} unresolved:
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); bulkSetStatus(unresolvedIds, 'accepted'); }}
                className="btn btn-xs badge-green"
                style={{ border: '1px solid var(--green-border)' }}
              >
                Accept all
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); bulkSetStatus(unresolvedIds, 'rejected'); }}
                className="btn btn-xs badge-red"
                style={{ border: '1px solid var(--red-border)' }}
              >
                Reject all
              </button>
            </div>
          )}

          {/* Track changes */}
          {paragraph.track_changes.length > 0 && (
            <div className="mb-3">
              <div className="section-label mb-2">Track Changes</div>
              <TrackChangeView
                trackChanges={paragraph.track_changes}
                baseText={paragraph.base_text}
              />
            </div>
          )}

          {/* Comments */}
          {(paragraph.comments.length > 0 || paragraph.manual_comments.length > 0) && (
            <div>
              <div className="section-label mb-2">Comments</div>
              <div className="space-y-2">
                {paragraph.comments.map((comment, idx) => (
                  <CommentCard key={comment.id} comment={comment} type="docx" reviewerIndex={idx} />
                ))}
                {paragraph.manual_comments.map((mc, idx) => (
                  <CommentCard key={mc.id} comment={mc} type="manual" reviewerIndex={paragraph.comments.length + idx} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * For wholly inserted/deleted paragraphs that have no inline track changes
 * (the paragraph itself IS the change), provide accept/reject controls.
 */
function WholesaleStatusControl({ paragraph }: { paragraph: MergedParagraph }) {
  const { statuses, setStatus } = useCollateStore();

  // Use a synthetic ID for the paragraph-level status
  const paraStatusId = `para-${paragraph.index}-wholesale`;
  const currentStatus = statuses.get(paraStatusId)?.status || 'unresolved';
  const currentNote = statuses.get(paraStatusId)?.note || '';

  const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
    unresolved: { bg: 'var(--grey-bg)', border: 'var(--grey-border)', text: 'var(--grey)' },
    accepted: { bg: 'var(--green-bg)', border: 'var(--green-border)', text: 'var(--green)' },
    rejected: { bg: 'var(--red-bg)', border: 'var(--red-border)', text: 'var(--red)' },
    deferred: { bg: 'var(--amber-bg)', border: 'var(--amber-border)', text: 'var(--amber)' },
  };

  const style = STATUS_STYLES[currentStatus];

  return (
    <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {paragraph.paragraph_status === 'WhollyInserted' ? 'Accept new paragraph?' : 'Accept deletion?'}
      </span>
      <select
        value={currentStatus}
        onChange={(e) => setStatus(paraStatusId, e.target.value as any)}
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
        onChange={(e) => setStatus(paraStatusId, currentStatus, e.target.value)}
        placeholder="Note..."
        className="input input-sm flex-1"
      />
    </div>
  );
}
