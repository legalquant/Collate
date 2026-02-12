import { useState } from 'react';
import { useCollateStore, listSavedProjects, type SavedProjectInfo } from '../hooks/useCollateStore';
import {
  FileText,
  Users,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  GitCompare,
  ChevronDown,
  ChevronRight,
  X,
  Trash2,
  Shield,
  Sparkles,
  ArrowUpDown,
  FolderOpen,
  Save,
  Plus,
  Upload,
} from 'lucide-react';

const FILTER_OPTIONS = [
  { key: 'all' as const, label: 'All Items', icon: FileText },
  { key: 'unresolved' as const, label: 'Unresolved', icon: AlertTriangle },
  { key: 'new' as const, label: 'New Items', icon: Sparkles },
  { key: 'wholesale' as const, label: 'New/Deleted ¶', icon: ArrowUpDown },
  { key: 'conflicts' as const, label: 'Conflicts', icon: GitCompare },
  { key: 'track_changes' as const, label: 'Track Changes', icon: GitCompare },
  { key: 'comments' as const, label: 'Comments', icon: MessageSquare },
];

export function Sidebar() {
  const {
    mergedParagraphs,
    statuses,
    activeFilter,
    setFilter,
    reviewers,
    documents,
    removeDocument,
    clearAll,
    currentProjectName,
    saveProject,
    loadProject,
    deleteProject,
    newProject,
    setView,
  } = useCollateStore();

  const [docsExpanded, setDocsExpanded] = useState(true);
  const [reviewersExpanded, setReviewersExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveProjectName, setSaveProjectName] = useState('');

  const savedProjects = listSavedProjects();
  const hasContent = mergedParagraphs.length > 0;

  // ─── Stats ───────────────────────────────────────────────────────

  let totalItems = 0;
  let resolvedItems = 0;
  const counts = { unresolved: 0, accepted: 0, rejected: 0, deferred: 0 };
  const reviewerStats = new Map<string, { total: number; resolved: number }>();

  for (const para of mergedParagraphs) {
    const items = [
      ...para.track_changes.map((tc) => ({ id: tc.id, author: tc.author })),
      ...para.comments.map((c) => ({ id: c.id, author: c.author })),
      ...para.manual_comments.map((mc) => ({ id: mc.id, author: mc.reviewer_name })),
    ];
    for (const item of items) {
      totalItems++;
      const s = statuses.get(item.id)?.status || 'unresolved';
      counts[s]++;
      if (s !== 'unresolved') resolvedItems++;

      const entry = reviewerStats.get(item.author) || { total: 0, resolved: 0 };
      entry.total++;
      if (s !== 'unresolved') entry.resolved++;
      reviewerStats.set(item.author, entry);
    }
  }

  const percent = totalItems > 0 ? Math.round((resolvedItems / totalItems) * 100) : 0;

  // ─── Save prompt handler ─────────────────────────────────────────

  const handleSave = () => {
    if (currentProjectName) {
      saveProject(currentProjectName);
    } else {
      setShowSavePrompt(true);
      setSaveProjectName('');
    }
  };

  const handleSaveConfirm = () => {
    const name = saveProjectName.trim();
    if (!name) return;
    saveProject(name);
    setShowSavePrompt(false);
  };

  return (
    <aside
      className="shrink-0 flex flex-col h-full overflow-hidden no-print"
      style={{ width: 'var(--sidebar-width)', background: 'var(--bg-sidebar)' }}
    >
      {/* Brand */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-sidebar)' }}>
        <img src="/logo.svg" alt="Collate" style={{ width: 32, height: 32 }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-sidebar-active)' }}>Collate</div>
          <div className="text-[10px]" style={{ color: 'var(--text-sidebar-muted)' }}>
            {currentProjectName || 'Document Review'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto sidebar-scroll">

        {/* ─── Projects ──────────────────────────────────────────── */}
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-sidebar)' }}>
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="w-full flex items-center justify-between px-2 mb-1"
          >
            <span className="section-label" style={{ color: 'var(--text-sidebar-muted)' }}>
              Projects
            </span>
            {projectsExpanded
              ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-sidebar-muted)' }} />
              : <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-sidebar-muted)' }} />
            }
          </button>
          {projectsExpanded && (
            <div className="animate-fade-in">
              {/* Action buttons */}
              <div className="flex gap-1 px-2 mb-2">
                <button
                  onClick={() => { newProject(); setView('collate'); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors"
                  style={{ color: 'var(--text-sidebar)', background: 'rgba(255,255,255,0.06)' }}
                  title="New project"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
                {hasContent && (
                  <button
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors"
                    style={{ color: 'var(--accent-light)', background: 'rgba(13,148,136,0.12)' }}
                    title={currentProjectName ? `Save "${currentProjectName}"` : 'Save project'}
                  >
                    <Save className="w-3 h-3" /> Save
                  </button>
                )}
              </div>

              {/* Save name prompt */}
              {showSavePrompt && (
                <div className="px-2 mb-2 animate-fade-in">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={saveProjectName}
                      onChange={(e) => setSaveProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveConfirm()}
                      placeholder="Project name..."
                      autoFocus
                      className="flex-1 rounded px-2 py-1 text-xs"
                      style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-sidebar-active)', border: '1px solid rgba(255,255,255,0.15)', outline: 'none' }}
                    />
                    <button
                      onClick={handleSaveConfirm}
                      className="px-2 py-1 rounded text-[10px] font-medium"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowSavePrompt(false)}
                      className="px-1 py-1 rounded"
                      style={{ color: 'var(--text-sidebar-muted)' }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Saved project list */}
              {savedProjects.length > 0 ? (
                <div className="space-y-0.5">
                  {savedProjects.map((proj) => (
                    <div
                      key={proj.name}
                      className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
                      style={{
                        color: proj.name === currentProjectName ? 'var(--text-sidebar-active)' : 'var(--text-sidebar)',
                        background: proj.name === currentProjectName ? 'var(--bg-sidebar-active)' : 'transparent',
                      }}
                      onClick={() => loadProject(proj.name)}
                    >
                      <FolderOpen className="w-3 h-3 shrink-0" style={{ opacity: 0.6 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{proj.name}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-sidebar-muted)' }}>
                          {proj.documentCount} doc{proj.documentCount !== 1 ? 's' : ''} · {proj.resolvedCount}/{proj.totalCount} resolved
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteProject(proj.name); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                        style={{ color: 'var(--red)' }}
                        title="Delete project"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-2 py-1 text-xs" style={{ color: 'var(--text-sidebar-muted)' }}>
                  No saved projects
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Progress ──────────────────────────────────────────── */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-sidebar)' }}>
          <div className="section-label mb-3" style={{ color: 'var(--text-sidebar-muted)' }}>Progress</div>

          {totalItems === 0 ? (
            <div className="text-xs" style={{ color: 'var(--text-sidebar-muted)' }}>
              {hasContent ? 'No actionable items' : 'Upload documents to start'}
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-sidebar-active)' }}>
                  {percent}%
                </span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-sidebar)' }}>
                  {resolvedItems} / {totalItems}
                </span>
              </div>
              <div className="progress-bar" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
              </div>

              <div className="mt-4 space-y-1.5">
                <StatRow label="Unresolved" count={counts.unresolved} color="var(--grey)" />
                <StatRow label="Accepted" count={counts.accepted} color="var(--green)" />
                <StatRow label="Rejected" count={counts.rejected} color="var(--red)" />
                <StatRow label="Deferred" count={counts.deferred} color="var(--amber)" />
              </div>
            </>
          )}
        </div>

        {/* ─── Filters ───────────────────────────────────────────── */}
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-sidebar)' }}>
          <div className="section-label px-2 mb-2" style={{ color: 'var(--text-sidebar-muted)' }}>Filter</div>
          {FILTER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = activeFilter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  color: isActive ? 'var(--text-sidebar-active)' : 'var(--text-sidebar)',
                  background: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
                  borderRight: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ opacity: isActive ? 1 : 0.6 }} />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* ─── Documents ─────────────────────────────────────────── */}
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-sidebar)' }}>
          <button
            onClick={() => setDocsExpanded(!docsExpanded)}
            className="w-full flex items-center justify-between px-2 mb-1"
          >
            <span className="section-label" style={{ color: 'var(--text-sidebar-muted)' }}>
              Documents ({documents.size})
            </span>
            {docsExpanded
              ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-sidebar-muted)' }} />
              : <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-sidebar-muted)' }} />
            }
          </button>
          {docsExpanded && (
            <div className="space-y-0.5 animate-fade-in">
              {documents.size === 0 ? (
                <div className="px-2 py-1 text-xs" style={{ color: 'var(--text-sidebar-muted)' }}>
                  No documents loaded
                </div>
              ) : (
                Array.from(documents.keys()).map((filename) => (
                  <div
                    key={filename}
                    className="group flex items-center gap-2 px-2 py-1 rounded text-xs"
                    style={{ color: 'var(--text-sidebar)' }}
                  >
                    <FileText className="w-3 h-3 shrink-0" style={{ opacity: 0.5 }} />
                    <span className="truncate flex-1">{filename}</span>
                    <button
                      onClick={() => removeDocument(filename)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--red)' }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ─── Reviewers ─────────────────────────────────────────── */}
        <div className="px-3 py-3">
          <button
            onClick={() => setReviewersExpanded(!reviewersExpanded)}
            className="w-full flex items-center justify-between px-2 mb-1"
          >
            <span className="section-label" style={{ color: 'var(--text-sidebar-muted)' }}>
              Reviewers ({reviewers.length})
            </span>
            {reviewersExpanded
              ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-sidebar-muted)' }} />
              : <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-sidebar-muted)' }} />
            }
          </button>
          {reviewersExpanded && (
            <div className="space-y-1 animate-fade-in">
              {reviewers.length === 0 ? (
                <div className="px-2 py-1 text-xs" style={{ color: 'var(--text-sidebar-muted)' }}>
                  No reviewers yet
                </div>
              ) : (
                reviewers.map((r) => {
                  const stats = reviewerStats.get(r.name) || { total: 0, resolved: 0 };
                  return (
                    <div key={r.name} className="flex items-center gap-2 px-2 py-1.5 rounded">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.colour }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-sidebar)' }}>
                          {r.name}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-sidebar-muted)' }}>
                          {stats.total} items · {stats.resolved} done
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-sidebar)' }}>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-sidebar-muted)' }}>
          <Shield className="w-3 h-3" style={{ color: 'var(--accent)' }} />
          Offline · Private
        </div>
        {hasContent && (
          <button
            onClick={clearAll}
            className="text-[10px] flex items-center gap-1 transition-colors"
            style={{ color: 'var(--text-sidebar-muted)' }}
            title="Clear all data"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </aside>
  );
}

function StatRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex-1" style={{ color: 'var(--text-sidebar)' }}>{label}</span>
      <span className="tabular-nums font-medium" style={{ color: 'var(--text-sidebar-active)' }}>{count}</span>
    </div>
  );
}
