import { create } from 'zustand';
import {
  CollateResult,
  CommentStatus,
  ManualComment,
  MergedParagraph,
  Reviewer,
  REVIEWER_COLOURS,
  parseDocx,
} from '../wasm';

// ─── Document metadata ─────────────────────────────────────────────

interface DocumentMeta {
  filename: string;
  addedAt: number; // timestamp (ms)
}


// ─── Paragraph matching (Jaccard similarity) ───────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Store types ───────────────────────────────────────────────────

interface CollateStore {
  // Document data
  documents: Map<string, CollateResult>;
  documentMeta: Map<string, DocumentMeta>;
  baseDocument: string | null;

  // Merged view
  mergedParagraphs: MergedParagraph[];

  // Manual comments
  manualComments: ManualComment[];

  // Resolution statuses
  statuses: Map<string, CommentStatus>;

  // Reviewers
  reviewers: Reviewer[];

  // Loading state
  isLoading: boolean;
  loadingFile: string | null;
  error: string | null;

  // Filter
  activeFilter: 'all' | 'unresolved' | 'conflicts' | 'track_changes' | 'comments' | 'new' | 'wholesale';

  // Search
  searchQuery: string;

  // Current view
  currentView: 'landing' | 'collate';

  // Incremental review tracking
  /** Set of item IDs that were added after the first document was loaded */
  newItemIds: Set<string>;
  /** Notification about newly added items — dismissed by user */
  newItemNotification: { count: number; filename: string } | null;

  // Project management
  currentProjectName: string | null;

  // Actions
  addDocument: (file: File) => Promise<void>;
  removeDocument: (filename: string) => void;
  addManualComment: (comment: ManualComment) => void;
  removeManualComment: (id: string) => void;
  setStatus: (commentId: string, status: CommentStatus['status'], note?: string) => void;
  setFilter: (filter: CollateStore['activeFilter']) => void;
  setSearchQuery: (query: string) => void;
  setView: (view: CollateStore['currentView']) => void;
  bulkSetStatus: (ids: string[], status: CommentStatus['status']) => void;
  dismissNotification: () => void;
  exportAsJson: () => string;
  importFromJson: (json: string) => void;
  clearAll: () => void;
  loadFromStorage: () => void;
  saveProject: (name: string) => void;
  loadProject: (name: string) => void;
  deleteProject: (name: string) => void;
  newProject: () => void;
}

// ─── LocalStorage helpers ──────────────────────────────────────────

const STORAGE_KEY = 'collate-state';
const AUTOSAVE_KEY = 'collate-autosave';
const PROJECTS_INDEX_KEY = 'collate-projects-index';
const PROJECT_PREFIX = 'collate-project-';
const AUTOSAVE_INTERVAL = 30_000; // Auto-save every 30 seconds

// ─── Project management helpers ────────────────────────────────────

export interface SavedProjectInfo {
  name: string;
  savedAt: string;
  documentCount: number;
  paragraphCount: number;
  resolvedCount: number;
  totalCount: number;
}

export function listSavedProjects(): SavedProjectInfo[] {
  try {
    const raw = localStorage.getItem(PROJECTS_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedProjectInfo[];
  } catch {
    return [];
  }
}

function saveProjectIndex(projects: SavedProjectInfo[]) {
  try {
    localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(projects));
  } catch { /* full */ }
}

interface PersistedState {
  manualComments: ManualComment[];
  statuses: [string, CommentStatus][];
  reviewerColours: [string, string][];
}

/**
 * Full session snapshot — saved on every significant action and periodically.
 * This allows the user to resume a session even after a crash or browser close,
 * without re-uploading documents. The merged paragraphs and reviewers are
 * included so the checklist view is immediately usable.
 */
interface SessionSnapshot {
  version: 2;
  savedAt: string;
  manualComments: ManualComment[];
  statuses: [string, CommentStatus][];
  reviewers: Reviewer[];
  mergedParagraphs: MergedParagraph[];
  /** Filenames of documents that were loaded (for display, not re-parsing) */
  documentFilenames: string[];
}

function saveToStorage(store: CollateStore) {
  // Quick save — lightweight, on every action
  const state: PersistedState = {
    manualComments: store.manualComments,
    statuses: Array.from(store.statuses.entries()),
    reviewerColours: store.reviewers.map((r) => [r.name, r.colour]),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or not available — silently fail
  }

  // Full session snapshot — includes merged paragraphs for crash recovery
  saveSessionSnapshot(store);
}

function saveSessionSnapshot(store: CollateStore) {
  if (store.mergedParagraphs.length === 0) return;

  const snapshot: SessionSnapshot = {
    version: 2,
    savedAt: new Date().toISOString(),
    manualComments: store.manualComments,
    statuses: Array.from(store.statuses.entries()),
    reviewers: store.reviewers,
    mergedParagraphs: store.mergedParagraphs,
    documentFilenames: Array.from(store.documents.keys()),
  };
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full — try to at least keep the lightweight save
  }
}

/**
 * Check if a recoverable session exists.
 * Returns the snapshot if found, null otherwise.
 */
export function getRecoverableSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version === 2 && data.mergedParagraphs?.length > 0) {
      return data as SessionSnapshot;
    }
    return null;
  } catch {
    return null;
  }
}

// Start auto-save interval
let autosaveTimer: ReturnType<typeof setInterval> | null = null;

function startAutosave() {
  if (autosaveTimer) return;
  autosaveTimer = setInterval(() => {
    const store = useCollateStore.getState();
    if (store.mergedParagraphs.length > 0) {
      saveSessionSnapshot(store);
    }
  }, AUTOSAVE_INTERVAL);
}

// Also save on beforeunload (browser close / refresh)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const store = useCollateStore.getState();
    if (store.mergedParagraphs.length > 0) {
      saveSessionSnapshot(store);
    }
  });
}

// ─── Merge logic ───────────────────────────────────────────────────

function buildMergedParagraphs(
  documents: Map<string, CollateResult>,
  baseDocument: string | null,
  manualComments: ManualComment[],
  newItemIds: Set<string>
): MergedParagraph[] {
  if (!baseDocument || !documents.has(baseDocument)) return [];

  const base = documents.get(baseDocument)!;
  const merged: MergedParagraph[] = base.paragraphs.map((p) => {
    const itemIds = [
      ...p.track_changes.map((tc) => tc.id),
      ...p.comments.map((c) => c.id),
    ];
    return {
      index: p.index,
      base_text: p.base_text,
      revised_text: p.revised_text,
      paragraph_status: p.paragraph_status,
      paragraph_change_author: p.paragraph_change_author,
      reviewer_versions: [...p.reviewer_versions],
      comments: [...p.comments],
      track_changes: [...p.track_changes],
      manual_comments: manualComments.filter((mc) => mc.paragraph_index === p.index),
      has_conflicts: p.has_conflicts,
      source_file: baseDocument,
      has_new_items: itemIds.some((id) => newItemIds.has(id)),
    };
  });

  // Merge additional documents
  for (const [filename, result] of documents) {
    if (filename === baseDocument) continue;

    for (const para of result.paragraphs) {
      // Wholly-inserted paragraphs from a reviewer doc won't match anything
      // in the base — they ARE new paragraphs that the reviewer added
      const paraIsWhollyNew = para.paragraph_status === 'WhollyInserted';

      // Find best matching base paragraph
      let bestIdx = -1;
      let bestSim = 0;

      // Build text to match: use revised text if available, else base text
      const paraText =
        para.reviewer_versions.length > 0
          ? para.reviewer_versions[0].resulting_text
          : para.base_text || para.revised_text;

      for (let i = 0; i < merged.length; i++) {
        const baseForMatch = merged[i].base_text || merged[i].revised_text;
        const sim = jaccardSimilarity(paraText, baseForMatch);
        if (sim > bestSim) {
          bestSim = sim;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0 && bestSim > 0.3) {
        // Matched — merge comments and track changes
        merged[bestIdx].comments.push(...para.comments);
        merged[bestIdx].track_changes.push(...para.track_changes);
        merged[bestIdx].reviewer_versions.push(...para.reviewer_versions);
        if (para.has_conflicts || merged[bestIdx].track_changes.length > 0) {
          const authors = new Set(merged[bestIdx].track_changes.map((tc) => tc.author));
          merged[bestIdx].has_conflicts = authors.size > 1;
        }
        // Check if any new items were added
        const newIds = [
          ...para.track_changes.map((tc) => tc.id),
          ...para.comments.map((c) => c.id),
        ];
        if (newIds.some((id) => newItemIds.has(id))) {
          merged[bestIdx].has_new_items = true;
        }
      } else {
        // Unmatched paragraph — add it to the merged list at a sensible position
        // (appended after the last paragraph, or inserted near its original index)
        const newIndex = merged.length > 0 ? merged[merged.length - 1].index + 1 : 0;
        const itemIds = [
          ...para.track_changes.map((tc) => tc.id),
          ...para.comments.map((c) => c.id),
        ];
        merged.push({
          index: newIndex,
          base_text: para.base_text,
          revised_text: para.revised_text,
          paragraph_status: para.paragraph_status,
          paragraph_change_author: para.paragraph_change_author,
          reviewer_versions: [...para.reviewer_versions],
          comments: [...para.comments],
          track_changes: [...para.track_changes],
          manual_comments: [],
          has_conflicts: para.has_conflicts,
          source_file: filename,
          has_new_items: itemIds.some((id) => newItemIds.has(id)),
        });
      }
    }
  }

  return merged;
}

function buildReviewerList(
  documents: Map<string, CollateResult>,
  existingColours: Map<string, string>
): Reviewer[] {
  const reviewerMap = new Map<string, Reviewer>();
  let colourIdx = 0;

  for (const [, result] of documents) {
    for (const r of result.reviewers) {
      if (reviewerMap.has(r.name)) {
        const existing = reviewerMap.get(r.name)!;
        existing.comment_count += r.comment_count;
        existing.change_count += r.change_count;
      } else {
        const colour =
          existingColours.get(r.name) || REVIEWER_COLOURS[colourIdx % REVIEWER_COLOURS.length].accent;
        reviewerMap.set(r.name, { ...r, colour });
        colourIdx++;
      }
    }
  }

  return Array.from(reviewerMap.values());
}

// ─── Store ─────────────────────────────────────────────────────────

export const useCollateStore = create<CollateStore>((set, get) => ({
  documents: new Map(),
  documentMeta: new Map(),
  baseDocument: null,
  mergedParagraphs: [],
  manualComments: [],
  statuses: new Map(),
  reviewers: [],
  isLoading: false,
  loadingFile: null,
  error: null,
  activeFilter: 'all',
  searchQuery: '',
  currentView: 'landing',
  newItemIds: new Set(),
  newItemNotification: null,
  currentProjectName: null,

  addDocument: async (file: File) => {
    set({ isLoading: true, loadingFile: file.name, error: null });

    try {
      const result = await parseDocx(file);

      if (result.error) {
        set({ isLoading: false, loadingFile: null, error: result.error });
        return;
      }

      const state = get();
      const isFirstDocument = state.documents.size === 0;
      const now = Date.now();

      const newDocs = new Map(state.documents);
      newDocs.set(file.name, result);

      const newMeta = new Map(state.documentMeta);
      newMeta.set(file.name, { filename: file.name, addedAt: now });

      const baseDoc = state.baseDocument || file.name;
      const existingColours = new Map(state.reviewers.map((r) => [r.name, r.colour]));
      const reviewers = buildReviewerList(newDocs, existingColours);

      // Track new item IDs if this is NOT the first document
      const newItemIds = new Set(state.newItemIds);
      let newItemCount = 0;
      if (!isFirstDocument) {
        for (const para of result.paragraphs) {
          for (const tc of para.track_changes) {
            newItemIds.add(tc.id);
            newItemCount++;
          }
          for (const c of para.comments) {
            newItemIds.add(c.id);
            newItemCount++;
          }
        }
      }

      const mergedParagraphs = buildMergedParagraphs(newDocs, baseDoc, state.manualComments, newItemIds);

      set({
        documents: newDocs,
        documentMeta: newMeta,
        baseDocument: baseDoc,
        reviewers,
        mergedParagraphs,
        newItemIds,
        newItemNotification: !isFirstDocument && newItemCount > 0
          ? { count: newItemCount, filename: file.name }
          : state.newItemNotification,
        isLoading: false,
        loadingFile: null,
        currentView: 'collate',
      });

      saveToStorage(get());
      startAutosave();
    } catch (e) {
      set({
        isLoading: false,
        loadingFile: null,
        error: e instanceof Error ? e.message : 'Failed to parse document',
      });
    }
  },

  removeDocument: (filename: string) => {
    const state = get();
    const newDocs = new Map(state.documents);
    newDocs.delete(filename);

    const newMeta = new Map(state.documentMeta);
    newMeta.delete(filename);

    const baseDoc = filename === state.baseDocument
      ? (newDocs.size > 0 ? newDocs.keys().next().value ?? null : null)
      : state.baseDocument;

    const existingColours = new Map(state.reviewers.map((r) => [r.name, r.colour]));
    const reviewers = buildReviewerList(newDocs, existingColours);
    const mergedParagraphs = buildMergedParagraphs(newDocs, baseDoc, state.manualComments, state.newItemIds);

    set({
      documents: newDocs,
      documentMeta: newMeta,
      baseDocument: baseDoc,
      reviewers,
      mergedParagraphs,
      currentView: newDocs.size === 0 ? 'landing' : 'collate',
    });

    saveToStorage(get());
  },

  addManualComment: (comment: ManualComment) => {
    const state = get();
    const manualComments = [...state.manualComments, comment];
    const mergedParagraphs = buildMergedParagraphs(state.documents, state.baseDocument, manualComments, state.newItemIds);

    set({ manualComments, mergedParagraphs });
    saveToStorage(get());
  },

  removeManualComment: (id: string) => {
    const state = get();
    const manualComments = state.manualComments.filter((mc) => mc.id !== id);
    const mergedParagraphs = buildMergedParagraphs(state.documents, state.baseDocument, manualComments, state.newItemIds);

    set({ manualComments, mergedParagraphs });
    saveToStorage(get());
  },

  setStatus: (commentId: string, status: CommentStatus['status'], note?: string) => {
    const state = get();
    const statuses = new Map(state.statuses);
    statuses.set(commentId, {
      comment_id: commentId,
      status,
      note: note ?? statuses.get(commentId)?.note ?? '',
    });

    set({ statuses });
    saveToStorage(get());
  },

  setFilter: (filter) => set({ activeFilter: filter }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setView: (view) => set({ currentView: view }),

  dismissNotification: () => set({ newItemNotification: null }),

  bulkSetStatus: (ids: string[], status: CommentStatus['status']) => {
    const state = get();
    const statuses = new Map(state.statuses);
    for (const id of ids) {
      statuses.set(id, {
        comment_id: id,
        status,
        note: statuses.get(id)?.note ?? '',
      });
    }
    set({ statuses });
    saveToStorage(get());
  },

  exportAsJson: () => {
    const state = get();
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      manualComments: state.manualComments,
      statuses: Array.from(state.statuses.entries()),
      reviewers: state.reviewers,
      mergedParagraphs: state.mergedParagraphs,
    };
    return JSON.stringify(exportData, null, 2);
  },

  importFromJson: (json: string) => {
    try {
      const data = JSON.parse(json);
      const statuses = new Map<string, CommentStatus>(data.statuses || []);
      const manualComments: ManualComment[] = data.manualComments || [];

      set({
        statuses,
        manualComments,
        mergedParagraphs: data.mergedParagraphs || [],
        reviewers: data.reviewers || [],
        currentView: 'collate',
      });

      saveToStorage(get());
    } catch {
      set({ error: 'Failed to import JSON — invalid format' });
    }
  },

  clearAll: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTOSAVE_KEY);
    set({
      documents: new Map(),
      documentMeta: new Map(),
      baseDocument: null,
      mergedParagraphs: [],
      manualComments: [],
      statuses: new Map(),
      reviewers: [],
      isLoading: false,
      loadingFile: null,
      error: null,
      activeFilter: 'all',
      searchQuery: '',
      currentView: 'landing',
      newItemIds: new Set(),
      newItemNotification: null,
      currentProjectName: null,
    });
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data: PersistedState = JSON.parse(raw);
      set({
        manualComments: data.manualComments || [],
        statuses: new Map(data.statuses || []),
      });

      // Start auto-save timer once we have state
      startAutosave();
    } catch {
      // Corrupted storage — ignore
    }
  },

  // ─── Project management ─────────────────────────────────────────

  saveProject: (name: string) => {
    const state = get();
    const snapshot: SessionSnapshot = {
      version: 2,
      savedAt: new Date().toISOString(),
      manualComments: state.manualComments,
      statuses: Array.from(state.statuses.entries()),
      reviewers: state.reviewers,
      mergedParagraphs: state.mergedParagraphs,
      documentFilenames: Array.from(state.documents.keys()),
    };

    try {
      localStorage.setItem(PROJECT_PREFIX + name, JSON.stringify(snapshot));
    } catch {
      return; // Storage full
    }

    // Compute stats for index
    let totalCount = 0;
    let resolvedCount = 0;
    for (const p of state.mergedParagraphs) {
      const ids = [...p.track_changes.map(t => t.id), ...p.comments.map(c => c.id), ...p.manual_comments.map(m => m.id)];
      totalCount += ids.length;
      resolvedCount += ids.filter(id => { const s = state.statuses.get(id)?.status; return s && s !== 'unresolved'; }).length;
    }

    const projects = listSavedProjects().filter(p => p.name !== name);
    projects.unshift({
      name,
      savedAt: snapshot.savedAt,
      documentCount: snapshot.documentFilenames.length,
      paragraphCount: snapshot.mergedParagraphs.length,
      resolvedCount,
      totalCount,
    });
    saveProjectIndex(projects);

    set({ currentProjectName: name });
  },

  loadProject: (name: string) => {
    try {
      const raw = localStorage.getItem(PROJECT_PREFIX + name);
      if (!raw) return;
      const snapshot: SessionSnapshot = JSON.parse(raw);

      set({
        documents: new Map(),
        documentMeta: new Map(),
        baseDocument: null,
        manualComments: snapshot.manualComments || [],
        statuses: new Map(snapshot.statuses || []),
        reviewers: snapshot.reviewers || [],
        mergedParagraphs: snapshot.mergedParagraphs || [],
        currentView: 'collate',
        currentProjectName: name,
        newItemIds: new Set(),
        newItemNotification: null,
        error: null,
      });

      startAutosave();
    } catch {
      set({ error: 'Failed to load project' });
    }
  },

  deleteProject: (name: string) => {
    localStorage.removeItem(PROJECT_PREFIX + name);
    const projects = listSavedProjects().filter(p => p.name !== name);
    saveProjectIndex(projects);
  },

  newProject: () => {
    // Save current project automatically if it has content and a name
    const state = get();
    if (state.currentProjectName && state.mergedParagraphs.length > 0) {
      state.saveProject(state.currentProjectName);
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTOSAVE_KEY);
    set({
      documents: new Map(),
      documentMeta: new Map(),
      baseDocument: null,
      mergedParagraphs: [],
      manualComments: [],
      statuses: new Map(),
      reviewers: [],
      isLoading: false,
      loadingFile: null,
      error: null,
      activeFilter: 'all',
      searchQuery: '',
      currentView: 'collate',
      newItemIds: new Set(),
      newItemNotification: null,
      currentProjectName: null,
    });
  },
}));

// ─── Recovery: restore a full session from autosave ────────────────

export function recoverSession() {
  const snapshot = getRecoverableSession();
  if (!snapshot) return false;

  useCollateStore.setState({
    manualComments: snapshot.manualComments || [],
    statuses: new Map(snapshot.statuses || []),
    reviewers: snapshot.reviewers || [],
    mergedParagraphs: snapshot.mergedParagraphs || [],
    currentView: 'collate',
  });

  startAutosave();
  return true;
}

export function dismissRecovery() {
  localStorage.removeItem(AUTOSAVE_KEY);
}
