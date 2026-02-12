import { useState } from 'react';
import { X } from 'lucide-react';
import { useCollateStore } from '../hooks/useCollateStore';
import { ManualComment, SourceType } from '../wasm';

const SOURCES: { value: SourceType; label: string }[] = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'teams', label: 'Teams' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'slack', label: 'Slack' },
  { value: 'conference', label: 'Conference' },
  { value: 'other', label: 'Other' },
];

interface ManualCommentFormProps {
  onClose: () => void;
}

export function ManualCommentForm({ onClose }: ManualCommentFormProps) {
  const { addManualComment, mergedParagraphs, reviewers } = useCollateStore();

  const [reviewerName, setReviewerName] = useState('');
  const [paragraphIndex, setParagraphIndex] = useState(mergedParagraphs[0]?.index ?? 0);
  const [source, setSource] = useState<SourceType>('phone');
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewerName.trim() || !text.trim()) return;

    const comment: ManualComment = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      reviewer_name: reviewerName.trim(),
      paragraph_index: paragraphIndex,
      text: text.trim(),
      source,
      date,
    };

    addManualComment(comment);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3>Add External Comment</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Paragraph</label>
            <select
              value={paragraphIndex}
              onChange={(e) => setParagraphIndex(parseInt(e.target.value))}
              className="select"
            >
              {mergedParagraphs.map((p) => (
                <option key={p.index} value={p.index}>
                  ¶ {p.index + 1} — {p.base_text.slice(0, 60)}{p.base_text.length > 60 ? '...' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Reviewer</label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              list="reviewer-list"
              placeholder="e.g. Client, Partner"
              required
              className="input"
            />
            <datalist id="reviewer-list">
              {reviewers.map((r) => (
                <option key={r.name} value={r.name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as SourceType)}
                className="select"
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Comment</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              required
              placeholder="What did the reviewer say?"
              className="input resize-none"
              style={{ lineHeight: 1.5 }}
            />
          </div>

          <button type="submit" className="btn btn-primary w-full">
            Add Comment
          </button>
        </form>
      </div>
    </div>
  );
}
