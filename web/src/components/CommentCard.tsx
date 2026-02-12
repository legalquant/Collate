import { DocxComment, ManualComment, SOURCE_ICONS, REVIEWER_COLOURS } from '../wasm';
import { useCollateStore } from '../hooks/useCollateStore';

interface CommentCardProps {
  comment: DocxComment | ManualComment;
  type: 'docx' | 'manual';
  reviewerIndex?: number;
}

function isManualComment(c: DocxComment | ManualComment): c is ManualComment {
  return 'source' in c;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  unresolved: { bg: 'var(--grey-bg)', border: 'var(--grey-border)', text: 'var(--grey)' },
  accepted: { bg: 'var(--green-bg)', border: 'var(--green-border)', text: 'var(--green)' },
  rejected: { bg: 'var(--red-bg)', border: 'var(--red-border)', text: 'var(--red)' },
  deferred: { bg: 'var(--amber-bg)', border: 'var(--amber-border)', text: 'var(--amber)' },
};

export function CommentCard({ comment, type, reviewerIndex = 0 }: CommentCardProps) {
  const { statuses, setStatus, reviewers } = useCollateStore();
  const currentStatus = statuses.get(comment.id)?.status || 'unresolved';
  const currentNote = statuses.get(comment.id)?.note || '';
  const style = STATUS_STYLES[currentStatus];

  const author = type === 'manual' ? (comment as ManualComment).reviewer_name : (comment as DocxComment).author;
  const reviewer = reviewers.find((r) => r.name === author);
  const colour = reviewer?.colour || REVIEWER_COLOURS[reviewerIndex % REVIEWER_COLOURS.length].accent;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${colour}25` }}
    >
      {/* Author line */}
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: `${colour}08` }}>
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colour }} />
        <span className="text-xs font-semibold" style={{ color: colour }}>{author}</span>
        {isManualComment(comment) && (
          <span className="badge badge-grey" style={{ fontSize: '0.625rem' }}>
            {SOURCE_ICONS[comment.source]} {comment.source}
          </span>
        )}
        {comment.date && (
          <span className="text-[10px] ml-auto" style={{ color: 'var(--text-light)' }}>
            {new Date(comment.date).toLocaleDateString('en-GB')}
          </span>
        )}
      </div>

      <div className="px-3 py-2">
        {/* Anchor text */}
        {!isManualComment(comment) && (comment as DocxComment).anchor_text && (
          <div className="citation-block mb-2 text-xs" style={{ borderLeftColor: colour }}>
            On: &ldquo;{(comment as DocxComment).anchor_text}&rdquo;
          </div>
        )}

        {/* Comment text */}
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
          {comment.text}
        </p>

        {/* Status controls */}
        <div className="mt-2 flex items-center gap-2">
          <select
            value={currentStatus}
            onChange={(e) => setStatus(comment.id, e.target.value as any)}
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
            onChange={(e) => setStatus(comment.id, currentStatus, e.target.value)}
            placeholder="Note..."
            className="input input-sm flex-1"
          />
        </div>
      </div>
    </div>
  );
}
