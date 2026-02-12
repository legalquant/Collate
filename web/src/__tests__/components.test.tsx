import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the wasm module
vi.mock('../wasm');

// Mock the store with a controllable implementation
const mockStoreState: Record<string, unknown> = {
  documents: new Map(),
  documentMeta: new Map(),
  baseDocument: null,
  mergedParagraphs: [] as unknown[],
  manualComments: [],
  statuses: new Map(),
  reviewers: [],
  isLoading: false,
  loadingFile: null as string | null,
  error: null as string | null,
  activeFilter: 'all' as const,
  searchQuery: '',
  currentView: 'landing' as const,
  newItemIds: new Set(),
  newItemNotification: null,
  addDocument: vi.fn(),
  removeDocument: vi.fn(),
  addManualComment: vi.fn(),
  removeManualComment: vi.fn(),
  setStatus: vi.fn(),
  setFilter: vi.fn(),
  setSearchQuery: vi.fn(),
  setView: vi.fn(),
  bulkSetStatus: vi.fn(),
  dismissNotification: vi.fn(),
  exportAsJson: vi.fn(() => '{}'),
  importFromJson: vi.fn(),
  clearAll: vi.fn(),
  loadFromStorage: vi.fn(),
};

vi.mock('../hooks/useCollateStore', () => ({
  useCollateStore: Object.assign(
    (selector?: (state: typeof mockStoreState) => unknown) => {
      if (selector) return selector(mockStoreState);
      return mockStoreState;
    },
    {
      getState: () => mockStoreState,
      setState: vi.fn(),
      subscribe: vi.fn(),
      destroy: vi.fn(),
    }
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) =>
    <span data-testid={`${name}-icon`} {...props} />;
  return {
    Shield: icon('shield'),
    X: icon('x'),
    Upload: icon('upload'),
    FileText: icon('filetext'),
    Loader2: icon('loader'),
    AlertCircle: icon('alert-circle'),
    AlertTriangle: icon('alert-triangle'),
    MessageSquare: icon('message-square'),
    ChevronDown: icon('chevron-down'),
    ChevronRight: icon('chevron-right'),
    CheckCircle2: icon('check-circle'),
    GitCompare: icon('git-compare'),
    Plus: icon('plus'),
    Minus: icon('minus'),
    Sparkles: icon('sparkles'),
  };
});

import { PrivacyBadge } from '../components/PrivacyBadge';
import { FileUpload } from '../components/FileUpload';
import { ParagraphBlock } from '../components/ParagraphBlock';
import type { MergedParagraph } from '../wasm';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeMergedParagraph(overrides: Partial<MergedParagraph> = {}): MergedParagraph {
  return {
    index: 0,
    base_text: 'The Claimant submits that the loss was caused by the breach.',
    revised_text: 'The Claimant submits that the loss was caused by the breach.',
    paragraph_status: 'Normal',
    paragraph_change_author: null,
    reviewer_versions: [],
    comments: [],
    track_changes: [],
    manual_comments: [],
    has_conflicts: false,
    source_file: null,
    has_new_items: false,
    ...overrides,
  };
}

// ─── PrivacyBadge ─────────────────────────────────────────────────────

describe('PrivacyBadge', () => {
  it('renders badge text', () => {
    render(<PrivacyBadge />);
    expect(screen.getByText(/Private/)).toBeInTheDocument();
  });

  it('opens modal on click', async () => {
    const user = userEvent.setup();
    render(<PrivacyBadge />);

    const badge = screen.getByRole('button');
    await user.click(badge);

    expect(screen.getByText('Privacy Guarantee')).toBeInTheDocument();
    expect(
      screen.getByText(/processes your documents entirely in your browser/)
    ).toBeInTheDocument();
  });

  it('closes modal when clicking X button', async () => {
    const user = userEvent.setup();
    render(<PrivacyBadge />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Privacy Guarantee')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find((btn) =>
      btn.querySelector('[data-testid="x-icon"]')
    );
    expect(closeButton).toBeDefined();
    await user.click(closeButton!);

    expect(screen.queryByText('Privacy Guarantee')).not.toBeInTheDocument();
  });
});

// ─── FileUpload ───────────────────────────────────────────────────────

describe('FileUpload', () => {
  beforeEach(() => {
    mockStoreState.isLoading = false;
    mockStoreState.loadingFile = null;
    mockStoreState.error = null;
  });

  it('shows drag-drop zone in default mode', () => {
    render(<FileUpload />);
    expect(screen.getByText(/Drop your marked-up .docx files here/)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/)).toBeInTheDocument();
  });

  it('shows Upload button in compact mode', () => {
    render(<FileUpload compact />);
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.queryByText(/Drop your marked-up/)).not.toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    mockStoreState.isLoading = true;
    mockStoreState.loadingFile = 'test.docx';
    render(<FileUpload />);
    expect(screen.getByText(/Parsing test.docx/)).toBeInTheDocument();
  });

  it('shows compact loading state', () => {
    mockStoreState.isLoading = true;
    mockStoreState.loadingFile = 'test.docx';
    render(<FileUpload compact />);
    expect(screen.getByText('Parsing...')).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    mockStoreState.error = 'Failed to parse document';
    render(<FileUpload />);
    expect(screen.getByText('Failed to parse document')).toBeInTheDocument();
  });

  it('has a hidden file input accepting .docx', () => {
    render(<FileUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toBe('.docx');
    expect(input.multiple).toBe(true);
  });
});

// ─── ParagraphBlock — wholesale insertion/deletion ─────────────────────

describe('ParagraphBlock', () => {
  beforeEach(() => {
    mockStoreState.activeFilter = 'all';
    mockStoreState.statuses = new Map();
    mockStoreState.reviewers = [];
  });

  it('renders a normal paragraph with track changes', () => {
    const para = makeMergedParagraph({
      track_changes: [
        { id: 'tc-1', change_type: 'Insertion', author: 'Alice', date: null, original_text: '', new_text: 'new text', context_before: '', context_after: '' },
      ],
    });

    render(<ParagraphBlock paragraph={para} />);

    expect(screen.getByText('¶ 1')).toBeInTheDocument();
    // Paragraph text appears in the base text display
    expect(screen.getAllByText(/The Claimant submits/).length).toBeGreaterThan(0);
    // Should NOT show wholesale badges
    expect(screen.queryByText('New Paragraph')).not.toBeInTheDocument();
    expect(screen.queryByText('Deleted Paragraph')).not.toBeInTheDocument();
  });

  it('renders a wholly inserted paragraph with New Paragraph badge', () => {
    const para = makeMergedParagraph({
      index: 4,
      base_text: '',
      revised_text: 'This is a brand new paragraph added by counsel to address the limitation issue.',
      paragraph_status: 'WhollyInserted',
      paragraph_change_author: 'Senior Counsel',
      track_changes: [
        { id: 'tc-ins-1', change_type: 'Insertion', author: 'Senior Counsel', date: '2025-02-15T10:00:00Z', original_text: '', new_text: 'This is a brand new paragraph added by counsel to address the limitation issue.', context_before: '', context_after: '' },
      ],
    });

    render(<ParagraphBlock paragraph={para} />);

    expect(screen.getByText('¶ 5')).toBeInTheDocument();
    expect(screen.getByText('New Paragraph')).toBeInTheDocument();
    // Text appears in both the paragraph display and track change view
    expect(screen.getAllByText(/brand new paragraph added by counsel/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Senior Counsel/).length).toBeGreaterThan(0);
  });

  it('renders a wholly deleted paragraph with Deleted Paragraph badge', () => {
    const para = makeMergedParagraph({
      index: 7,
      base_text: 'The Claimant also advances an alternative claim in the tort of negligence.',
      revised_text: '',
      paragraph_status: 'WhollyDeleted',
      paragraph_change_author: 'Partner',
      track_changes: [
        { id: 'tc-del-1', change_type: 'Deletion', author: 'Partner', date: '2025-02-15T14:00:00Z', original_text: 'The Claimant also advances an alternative claim in the tort of negligence.', new_text: '', context_before: '', context_after: '' },
      ],
    });

    render(<ParagraphBlock paragraph={para} />);

    expect(screen.getByText('¶ 8')).toBeInTheDocument();
    expect(screen.getByText('Deleted Paragraph')).toBeInTheDocument();
    // Text appears in both the paragraph display and the track change view
    expect(screen.getAllByText(/alternative claim in the tort of negligence/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Partner/).length).toBeGreaterThan(0);
  });

  it('shows wholesale paragraph even with no inline track changes', () => {
    // A wholly inserted paragraph with NO track_changes array entries
    // (the paragraph itself is the change — should still render)
    const para = makeMergedParagraph({
      index: 2,
      base_text: '',
      revised_text: 'Entirely new section on preliminary issues.',
      paragraph_status: 'WhollyInserted',
      paragraph_change_author: 'Counsel',
      track_changes: [], // No inline changes
      comments: [],
    });

    render(<ParagraphBlock paragraph={para} />);

    expect(screen.getByText('¶ 3')).toBeInTheDocument();
    expect(screen.getByText('New Paragraph')).toBeInTheDocument();
    expect(screen.getByText(/Entirely new section/)).toBeInTheDocument();
  });

  it('does not render normal paragraph with no items', () => {
    const para = makeMergedParagraph({
      paragraph_status: 'Normal',
      track_changes: [],
      comments: [],
      manual_comments: [],
    });

    const { container } = render(<ParagraphBlock paragraph={para} />);
    expect(container.innerHTML).toBe('');
  });

  it('filters wholesale paragraphs with the wholesale filter', () => {
    mockStoreState.activeFilter = 'wholesale';

    // Normal paragraph should be hidden
    const normalPara = makeMergedParagraph({
      index: 0,
      paragraph_status: 'Normal',
      track_changes: [
        { id: 'tc-1', change_type: 'Insertion', author: 'A', date: null, original_text: '', new_text: 'x', context_before: '', context_after: '' },
      ],
    });

    const { container: c1 } = render(<ParagraphBlock paragraph={normalPara} />);
    expect(c1.innerHTML).toBe('');

    // Wholesale paragraph should be visible
    const wholesalePara = makeMergedParagraph({
      index: 1,
      base_text: '',
      revised_text: 'New paragraph.',
      paragraph_status: 'WhollyInserted',
      paragraph_change_author: 'X',
    });

    render(<ParagraphBlock paragraph={wholesalePara} />);
    expect(screen.getByText('New Paragraph')).toBeInTheDocument();
  });

  it('shows "New" badge for paragraphs with new items', () => {
    const para = makeMergedParagraph({
      has_new_items: true,
      track_changes: [
        { id: 'tc-new', change_type: 'Insertion', author: 'Junior', date: null, original_text: '', new_text: 'late addition', context_before: '', context_after: '' },
      ],
    });

    render(<ParagraphBlock paragraph={para} />);

    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('does not show "New" badge on wholesale paragraphs (they have their own badge)', () => {
    const para = makeMergedParagraph({
      has_new_items: true,
      base_text: '',
      revised_text: 'New wholesale paragraph.',
      paragraph_status: 'WhollyInserted',
      paragraph_change_author: 'X',
    });

    render(<ParagraphBlock paragraph={para} />);

    // Should show "New Paragraph" but NOT the generic "New" badge
    expect(screen.getByText('New Paragraph')).toBeInTheDocument();
    expect(screen.queryByText(/^New$/)).not.toBeInTheDocument();
  });

  it('shows conflict badge alongside wholesale status', () => {
    const para = makeMergedParagraph({
      has_conflicts: true,
      track_changes: [
        { id: 'tc-a', change_type: 'Insertion', author: 'Alice', date: null, original_text: '', new_text: 'a', context_before: '', context_after: '' },
        { id: 'tc-b', change_type: 'Deletion', author: 'Bob', date: null, original_text: 'b', new_text: '', context_before: '', context_after: '' },
      ],
    });

    render(<ParagraphBlock paragraph={para} />);

    expect(screen.getByText('Conflict')).toBeInTheDocument();
  });
});
