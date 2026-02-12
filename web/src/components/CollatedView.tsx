import { useMemo } from 'react';
import { useCollateStore } from '../hooks/useCollateStore';
import { ParagraphBlock } from './ParagraphBlock';
import { FileText, ChevronDown, CheckCircle2 } from 'lucide-react';

export function CollatedView() {
  const { mergedParagraphs, documents, searchQuery, activeFilter, statuses, bulkSetStatus } = useCollateStore();

  // Filter paragraphs that have actionable items
  const actionableParagraphs = useMemo(() => {
    return mergedParagraphs.filter((p) => {
      const isWholesale = p.paragraph_status === 'WhollyInserted' || p.paragraph_status === 'WhollyDeleted';
      const hasItems = p.track_changes.length > 0 || p.comments.length > 0 || p.manual_comments.length > 0;
      if (!hasItems && !isWholesale) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          p.base_text.toLowerCase().includes(q) ||
          p.revised_text.toLowerCase().includes(q) ||
          p.comments.some((c) => c.text.toLowerCase().includes(q) || c.author.toLowerCase().includes(q)) ||
          p.track_changes.some((tc) => tc.author.toLowerCase().includes(q) || tc.original_text.toLowerCase().includes(q) || tc.new_text.toLowerCase().includes(q)) ||
          p.manual_comments.some((mc) => mc.text.toLowerCase().includes(q) || mc.reviewer_name.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [mergedParagraphs, searchQuery]);

  // Collect all unresolved IDs for bulk action
  const unresolvedIds = useMemo(() => {
    const ids: string[] = [];
    for (const para of actionableParagraphs) {
      for (const tc of para.track_changes) {
        if (!statuses.get(tc.id) || statuses.get(tc.id)?.status === 'unresolved') ids.push(tc.id);
      }
      for (const c of para.comments) {
        if (!statuses.get(c.id) || statuses.get(c.id)?.status === 'unresolved') ids.push(c.id);
      }
      for (const mc of para.manual_comments) {
        if (!statuses.get(mc.id) || statuses.get(mc.id)?.status === 'unresolved') ids.push(mc.id);
      }
    }
    return ids;
  }, [actionableParagraphs, statuses]);

  if (mergedParagraphs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24" style={{ color: 'var(--text-light)' }}>
        <FileText className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium">No documents loaded</p>
        <p className="text-sm">Upload a .docx file to get started</p>
      </div>
    );
  }

  const firstDoc = documents.values().next().value;
  const title = firstDoc?.document_title;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        {title && <h1 className="mb-1">{title}</h1>}
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {actionableParagraphs.length} paragraphs with feedback · {documents.size} document{documents.size !== 1 ? 's' : ''}
          {searchQuery && (
            <span style={{ color: 'var(--accent)' }}> · searching "{searchQuery}"</span>
          )}
        </p>

        {/* Bulk actions */}
        {unresolvedIds.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {unresolvedIds.length} unresolved items:
            </span>
            <button
              onClick={() => bulkSetStatus(unresolvedIds, 'accepted')}
              className="btn btn-xs"
              style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }}
            >
              <CheckCircle2 className="w-3 h-3" /> Accept All
            </button>
            <button
              onClick={() => bulkSetStatus(unresolvedIds, 'deferred')}
              className="btn btn-xs"
              style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber-border)' }}
            >
              Defer All
            </button>
          </div>
        )}
      </div>

      {/* Paragraphs */}
      <div className="space-y-4">
        {actionableParagraphs.length === 0 ? (
          <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">No paragraphs match the current filter.</p>
          </div>
        ) : (
          actionableParagraphs.map((para) => (
            <ParagraphBlock key={para.index} paragraph={para} />
          ))
        )}
      </div>

      {/* Jump to next unresolved */}
      {unresolvedIds.length > 0 && (
        <JumpToUnresolved />
      )}
    </div>
  );
}

function JumpToUnresolved() {
  const { mergedParagraphs, statuses } = useCollateStore();

  const jumpToNext = () => {
    for (const para of mergedParagraphs) {
      const allIds = [
        ...para.track_changes.map((tc) => tc.id),
        ...para.comments.map((c) => c.id),
        ...para.manual_comments.map((mc) => mc.id),
      ];
      const hasUnresolved = allIds.some((id) => {
        const s = statuses.get(id)?.status;
        return !s || s === 'unresolved';
      });
      if (hasUnresolved) {
        const el = document.getElementById(`para-${para.index}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2');
          el.style.setProperty('--tw-ring-color', 'var(--accent)');
          setTimeout(() => {
            el.classList.remove('ring-2');
          }, 2000);
        }
        break;
      }
    }
  };

  return (
    <button
      onClick={jumpToNext}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 btn btn-primary shadow-lg no-print animate-slide-up z-40"
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <ChevronDown className="w-4 h-4" />
      Jump to next unresolved
    </button>
  );
}
