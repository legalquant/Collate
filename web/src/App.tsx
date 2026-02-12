import { useEffect, useState } from 'react';
import { useCollateStore } from './hooks/useCollateStore';
import { getRecoverableSession, recoverSession, dismissRecovery } from './hooks/useCollateStore';
import { ExplainerPage } from './components/ExplainerPage';
import { Sidebar } from './components/Sidebar';
import { CollatedView } from './components/CollatedView';
import { FileUpload } from './components/FileUpload';
import { PrivacyBadge } from './components/PrivacyBadge';
import { ExportPanel } from './components/ExportPanel';
import { ManualCommentForm } from './components/ManualCommentForm';
import { SearchBar } from './components/SearchBar';
import { Upload, Plus, Download, ChevronLeft, X, Sparkles, RotateCcw } from 'lucide-react';

export default function App() {
  const { currentView, loadFromStorage, mergedParagraphs, setView, documents, newItemNotification, dismissNotification, setFilter } = useCollateStore();
  const [showManualForm, setShowManualForm] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [recoveryInfo, setRecoveryInfo] = useState<{ savedAt: string; docCount: number; paraCount: number } | null>(null);

  useEffect(() => {
    loadFromStorage();

    const snapshot = getRecoverableSession();
    if (snapshot && mergedParagraphs.length === 0) {
      setRecoveryAvailable(true);
      setRecoveryInfo({
        savedAt: snapshot.savedAt,
        docCount: snapshot.documentFilenames?.length ?? 0,
        paraCount: snapshot.mergedParagraphs?.length ?? 0,
      });
    }
  }, [loadFromStorage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        setShowManualForm(true);
      }
      if (e.key === 'Escape') {
        setShowManualForm(false);
        setShowExport(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isLanding = currentView === 'landing' && mergedParagraphs.length === 0;
  const hasDocuments = documents.size > 0 || mergedParagraphs.length > 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-main)' }}>
      {/* Sidebar — always visible */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header — show when we have content or are in collate view */}
        {!isLanding && (
          <header
            className="shrink-0 flex items-center justify-between px-6 py-3 border-b no-print"
            style={{ background: 'var(--bg-header)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-4">
              <SearchBar />
            </div>
            <div className="flex items-center gap-2">
              <FileUpload compact />
              <button onClick={() => setShowManualForm(true)} className="btn btn-secondary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                Add Comment
              </button>
              <button onClick={() => setShowExport(true)} className="btn btn-secondary btn-sm">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </header>
        )}

        {/* New items notification banner */}
        {newItemNotification && (
          <div
            className="shrink-0 flex items-center justify-between px-6 py-2 text-sm no-print animate-slide-up"
            style={{ background: 'var(--accent-bg)', borderBottom: '1px solid #99f6e4' }}
          >
            <div className="flex items-center gap-2" style={{ color: 'var(--accent-hover)' }}>
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span className="font-medium">
                {newItemNotification.count} new item{newItemNotification.count !== 1 ? 's' : ''} from {newItemNotification.filename}
              </span>
              <button
                onClick={() => { setFilter('new'); dismissNotification(); }}
                className="btn btn-xs"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                Show new items
              </button>
            </div>
            <button onClick={dismissNotification} className="btn btn-ghost btn-xs p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Session recovery banner */}
        {recoveryAvailable && recoveryInfo && isLanding && (
          <div
            className="shrink-0 flex items-center justify-between px-6 py-3 no-print animate-slide-up"
            style={{ background: 'var(--accent-bg)', borderBottom: '1px solid #99f6e4' }}
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Resume previous session?</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {recoveryInfo.docCount} document{recoveryInfo.docCount !== 1 ? 's' : ''}, {recoveryInfo.paraCount} paragraphs — saved {formatTimeAgo(recoveryInfo.savedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { recoverSession(); setRecoveryAvailable(false); }} className="btn btn-primary btn-sm">
                Resume
              </button>
              <button onClick={() => { dismissRecovery(); setRecoveryAvailable(false); }} className="btn btn-ghost btn-sm">
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
          {isLanding ? (
            <ExplainerPage />
          ) : (
            <div className="max-w-[960px] mx-auto px-8 py-6">
              <CollatedView />
            </div>
          )}
        </main>
      </div>

      {/* Privacy badge */}
      <PrivacyBadge />

      {/* Modals */}
      {showManualForm && <ManualCommentForm onClose={() => setShowManualForm(false)} />}
      {showExport && <ExportPanel onClose={() => setShowExport(false)} />}
    </div>
  );
}

function formatTimeAgo(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'recently';
  }
}
