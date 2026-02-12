import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the wasm module before importing the store
vi.mock('../wasm');

import { useCollateStore } from '../hooks/useCollateStore';
import type { ManualComment, CommentStatus } from '../wasm';

// ─── Helpers ────────────────────────────────────────────────────────

/** Reset the store to its initial state before each test */
function resetStore() {
  useCollateStore.getState().clearAll();
}

/**
 * Tokenize + Jaccard helpers — duplicated from the store's private functions
 * so we can unit-test the algorithm directly.
 */
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

// ─── Test helpers ───────────────────────────────────────────────────

function makeManualComment(overrides: Partial<ManualComment> = {}): ManualComment {
  return {
    id: 'mc-1',
    reviewer_name: 'Alice',
    paragraph_index: 0,
    text: 'Please review this paragraph.',
    source: 'email',
    date: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('useCollateStore', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  // ── Initial state ──────────────────────────────────────────────

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useCollateStore.getState();

      expect(state.documents).toBeInstanceOf(Map);
      expect(state.documents.size).toBe(0);
      expect(state.baseDocument).toBeNull();
      expect(state.mergedParagraphs).toEqual([]);
      expect(state.manualComments).toEqual([]);
      expect(state.statuses).toBeInstanceOf(Map);
      expect(state.statuses.size).toBe(0);
      expect(state.reviewers).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.loadingFile).toBeNull();
      expect(state.error).toBeNull();
      expect(state.activeFilter).toBe('all');
      expect(state.searchQuery).toBe('');
      expect(state.currentView).toBe('landing');
    });
  });

  // ── setSearchQuery ──────────────────────────────────────────────

  describe('setSearchQuery', () => {
    it('sets the search query', () => {
      useCollateStore.getState().setSearchQuery('breach of duty');
      expect(useCollateStore.getState().searchQuery).toBe('breach of duty');
    });

    it('clears the search query', () => {
      useCollateStore.getState().setSearchQuery('test');
      useCollateStore.getState().setSearchQuery('');
      expect(useCollateStore.getState().searchQuery).toBe('');
    });
  });

  // ── bulkSetStatus ───────────────────────────────────────────────

  describe('bulkSetStatus', () => {
    it('sets status for multiple IDs at once', () => {
      const ids = ['id-1', 'id-2', 'id-3'];
      useCollateStore.getState().bulkSetStatus(ids, 'accepted');

      const state = useCollateStore.getState();
      expect(state.statuses.get('id-1')?.status).toBe('accepted');
      expect(state.statuses.get('id-2')?.status).toBe('accepted');
      expect(state.statuses.get('id-3')?.status).toBe('accepted');
    });

    it('preserves existing notes', () => {
      useCollateStore.getState().setStatus('id-1', 'unresolved', 'important note');
      useCollateStore.getState().bulkSetStatus(['id-1'], 'accepted');

      expect(useCollateStore.getState().statuses.get('id-1')?.note).toBe('important note');
    });
  });

  // ── setFilter ──────────────────────────────────────────────────

  describe('setFilter', () => {
    it('changes activeFilter', () => {
      useCollateStore.getState().setFilter('unresolved');
      expect(useCollateStore.getState().activeFilter).toBe('unresolved');

      useCollateStore.getState().setFilter('conflicts');
      expect(useCollateStore.getState().activeFilter).toBe('conflicts');

      useCollateStore.getState().setFilter('track_changes');
      expect(useCollateStore.getState().activeFilter).toBe('track_changes');

      useCollateStore.getState().setFilter('comments');
      expect(useCollateStore.getState().activeFilter).toBe('comments');

      useCollateStore.getState().setFilter('all');
      expect(useCollateStore.getState().activeFilter).toBe('all');
    });

    it('supports new and wholesale filter values', () => {
      useCollateStore.getState().setFilter('new');
      expect(useCollateStore.getState().activeFilter).toBe('new');

      useCollateStore.getState().setFilter('wholesale');
      expect(useCollateStore.getState().activeFilter).toBe('wholesale');
    });
  });

  // ── setView ────────────────────────────────────────────────────

  describe('setView', () => {
    it('changes currentView', () => {
      useCollateStore.getState().setView('collate');
      expect(useCollateStore.getState().currentView).toBe('collate');

      useCollateStore.getState().setView('landing');
      expect(useCollateStore.getState().currentView).toBe('landing');
    });
  });

  // ── addManualComment ───────────────────────────────────────────

  describe('addManualComment', () => {
    it('adds a comment to manualComments array', () => {
      const comment = makeManualComment();
      useCollateStore.getState().addManualComment(comment);

      const state = useCollateStore.getState();
      expect(state.manualComments).toHaveLength(1);
      expect(state.manualComments[0]).toEqual(comment);
    });

    it('appends multiple comments', () => {
      const c1 = makeManualComment({ id: 'mc-1' });
      const c2 = makeManualComment({ id: 'mc-2', text: 'Second comment' });

      useCollateStore.getState().addManualComment(c1);
      useCollateStore.getState().addManualComment(c2);

      expect(useCollateStore.getState().manualComments).toHaveLength(2);
    });
  });

  // ── removeManualComment ────────────────────────────────────────

  describe('removeManualComment', () => {
    it('removes a comment by ID', () => {
      const c1 = makeManualComment({ id: 'mc-1' });
      const c2 = makeManualComment({ id: 'mc-2', text: 'Second comment' });

      useCollateStore.getState().addManualComment(c1);
      useCollateStore.getState().addManualComment(c2);

      useCollateStore.getState().removeManualComment('mc-1');

      const state = useCollateStore.getState();
      expect(state.manualComments).toHaveLength(1);
      expect(state.manualComments[0].id).toBe('mc-2');
    });

    it('does nothing when ID does not exist', () => {
      const comment = makeManualComment({ id: 'mc-1' });
      useCollateStore.getState().addManualComment(comment);

      useCollateStore.getState().removeManualComment('nonexistent');
      expect(useCollateStore.getState().manualComments).toHaveLength(1);
    });
  });

  // ── setStatus ──────────────────────────────────────────────────

  describe('setStatus', () => {
    it('updates statuses Map', () => {
      useCollateStore.getState().setStatus('comment-1', 'accepted');

      const statuses = useCollateStore.getState().statuses;
      expect(statuses.has('comment-1')).toBe(true);

      const status = statuses.get('comment-1')!;
      expect(status.comment_id).toBe('comment-1');
      expect(status.status).toBe('accepted');
      expect(status.note).toBe('');
    });

    it('updates statuses with a note', () => {
      useCollateStore.getState().setStatus('comment-2', 'rejected', 'Not applicable');

      const status = useCollateStore.getState().statuses.get('comment-2')!;
      expect(status.status).toBe('rejected');
      expect(status.note).toBe('Not applicable');
    });

    it('overwrites existing status but preserves note if not provided', () => {
      useCollateStore.getState().setStatus('comment-3', 'deferred', 'Revisit later');
      useCollateStore.getState().setStatus('comment-3', 'accepted');

      const status = useCollateStore.getState().statuses.get('comment-3')!;
      expect(status.status).toBe('accepted');
      expect(status.note).toBe('Revisit later');
    });
  });

  // ── exportAsJson ───────────────────────────────────────────────

  describe('exportAsJson', () => {
    it('returns valid JSON with version', () => {
      const jsonStr = useCollateStore.getState().exportAsJson();
      const data = JSON.parse(jsonStr);

      expect(data.version).toBe(1);
      expect(data.exportedAt).toBeDefined();
      expect(typeof data.exportedAt).toBe('string');
      expect(Array.isArray(data.manualComments)).toBe(true);
      expect(Array.isArray(data.statuses)).toBe(true);
      expect(Array.isArray(data.reviewers)).toBe(true);
      expect(Array.isArray(data.mergedParagraphs)).toBe(true);
    });

    it('includes manual comments and statuses', () => {
      useCollateStore.getState().addManualComment(makeManualComment({ id: 'mc-export' }));
      useCollateStore.getState().setStatus('tc-1', 'accepted', 'Looks good');

      const data = JSON.parse(useCollateStore.getState().exportAsJson());

      expect(data.manualComments).toHaveLength(1);
      expect(data.manualComments[0].id).toBe('mc-export');
      expect(data.statuses).toHaveLength(1);
      expect(data.statuses[0][0]).toBe('tc-1');
      expect(data.statuses[0][1].status).toBe('accepted');
    });
  });

  // ── importFromJson ─────────────────────────────────────────────

  describe('importFromJson', () => {
    it('restores state from exported JSON', () => {
      // Set up some state
      useCollateStore.getState().addManualComment(makeManualComment({ id: 'mc-import' }));
      useCollateStore.getState().setStatus('tc-import', 'deferred', 'Later');

      const exported = useCollateStore.getState().exportAsJson();

      // Clear and re-import
      resetStore();
      useCollateStore.getState().importFromJson(exported);

      const state = useCollateStore.getState();
      expect(state.manualComments).toHaveLength(1);
      expect(state.manualComments[0].id).toBe('mc-import');
      expect(state.statuses.get('tc-import')?.status).toBe('deferred');
      expect(state.currentView).toBe('collate');
    });

    it('sets error for invalid JSON', () => {
      useCollateStore.getState().importFromJson('not valid json {{{');

      expect(useCollateStore.getState().error).toBe(
        'Failed to import JSON — invalid format'
      );
    });
  });

  // ── clearAll ───────────────────────────────────────────────────

  describe('clearAll', () => {
    it('resets everything to defaults', () => {
      // Put the store in a non-default state
      useCollateStore.getState().addManualComment(makeManualComment());
      useCollateStore.getState().setStatus('tc-1', 'accepted');
      useCollateStore.getState().setFilter('conflicts');
      useCollateStore.getState().setView('collate');

      useCollateStore.getState().clearAll();

      const state = useCollateStore.getState();
      expect(state.documents.size).toBe(0);
      expect(state.baseDocument).toBeNull();
      expect(state.mergedParagraphs).toEqual([]);
      expect(state.manualComments).toEqual([]);
      expect(state.statuses.size).toBe(0);
      expect(state.reviewers).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.loadingFile).toBeNull();
      expect(state.error).toBeNull();
      expect(state.activeFilter).toBe('all');
      expect(state.currentView).toBe('landing');
    });

    it('resets incremental review state', () => {
      useCollateStore.getState().clearAll();

      const state = useCollateStore.getState();
      expect(state.newItemIds).toBeInstanceOf(Set);
      expect(state.newItemIds.size).toBe(0);
      expect(state.newItemNotification).toBeNull();
      expect(state.documentMeta).toBeInstanceOf(Map);
      expect(state.documentMeta.size).toBe(0);
    });
  });

  // ── dismissNotification ─────────────────────────────────────────

  describe('dismissNotification', () => {
    it('clears the new item notification', () => {
      // Manually set a notification via internal state for testing
      useCollateStore.setState({
        newItemNotification: { count: 5, filename: 'doc2.docx' },
      });
      expect(useCollateStore.getState().newItemNotification).not.toBeNull();

      useCollateStore.getState().dismissNotification();
      expect(useCollateStore.getState().newItemNotification).toBeNull();
    });
  });
});

// ─── Jaccard similarity tests ─────────────────────────────────────

describe('Jaccard similarity (paragraph matching)', () => {
  describe('tokenize', () => {
    it('lowercases and splits on whitespace', () => {
      const tokens = tokenize('Hello World');
      expect(tokens.has('hello')).toBe(true);
      expect(tokens.has('world')).toBe(true);
      expect(tokens.size).toBe(2);
    });

    it('removes punctuation', () => {
      const tokens = tokenize('Hello, world! How are you?');
      expect(tokens.has('hello')).toBe(true);
      expect(tokens.has('world')).toBe(true);
      expect(tokens.has(',')).toBe(false);
      expect(tokens.has('!')).toBe(false);
    });

    it('deduplicates words', () => {
      const tokens = tokenize('the the the cat');
      expect(tokens.size).toBe(2); // "the" and "cat"
    });

    it('returns empty set for empty/whitespace string', () => {
      expect(tokenize('').size).toBe(0);
      expect(tokenize('   ').size).toBe(0);
    });
  });

  describe('jaccardSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(jaccardSimilarity('hello world', 'hello world')).toBe(1);
    });

    it('returns 1 for two empty strings', () => {
      expect(jaccardSimilarity('', '')).toBe(1);
    });

    it('returns 0 when one string is empty and the other is not', () => {
      expect(jaccardSimilarity('', 'hello')).toBe(0);
      expect(jaccardSimilarity('hello', '')).toBe(0);
    });

    it('returns 0 for completely different strings', () => {
      expect(jaccardSimilarity('cat dog', 'red blue')).toBe(0);
    });

    it('returns correct similarity for partially overlapping strings', () => {
      // "the cat sat" → {the, cat, sat}
      // "the dog sat" → {the, dog, sat}
      // intersection = {the, sat} = 2
      // union = {the, cat, sat, dog} = 4
      // similarity = 2/4 = 0.5
      expect(jaccardSimilarity('the cat sat', 'the dog sat')).toBe(0.5);
    });

    it('is case-insensitive', () => {
      expect(jaccardSimilarity('Hello World', 'hello world')).toBe(1);
    });

    it('ignores punctuation differences', () => {
      expect(jaccardSimilarity('hello, world!', 'hello world')).toBe(1);
    });

    it('handles high similarity for minor edits', () => {
      const a = 'The plaintiff contends that the contract was breached on multiple occasions';
      const b = 'The plaintiff contends that the contract was breached on several occasions';
      // Only "multiple" vs "several" differ — high similarity expected
      const sim = jaccardSimilarity(a, b);
      expect(sim).toBeGreaterThan(0.7);
    });

    it('handles low similarity for unrelated paragraphs', () => {
      const a = 'The plaintiff contends that the contract was breached';
      const b = 'Weather forecasts predict rain tomorrow in London';
      const sim = jaccardSimilarity(a, b);
      expect(sim).toBeLessThan(0.1);
    });
  });
});
