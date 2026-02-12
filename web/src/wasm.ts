import init, { parse_docx } from './wasm-pkg/collate_core';

let initialized = false;

export async function initWasm() {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

export async function parseDocx(file: File): Promise<CollateResult> {
  await initWasm();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const jsonStr = parse_docx(bytes, file.name);
  return JSON.parse(jsonStr);
}

// ─── Types mirroring Rust structs ──────────────────────────────────

export interface CollateResult {
  paragraphs: ParagraphBlock[];
  reviewers: Reviewer[];
  document_title: string | null;
  error: string | null;
}

export type ParagraphStatusType = 'Normal' | 'WhollyInserted' | 'WhollyDeleted';

export interface ParagraphBlock {
  index: number;
  base_text: string;
  revised_text: string;
  paragraph_status: ParagraphStatusType;
  paragraph_change_author: string | null;
  reviewer_versions: ReviewerVersion[];
  comments: DocxComment[];
  track_changes: TrackChange[];
  has_conflicts: boolean;
}

export interface ReviewerVersion {
  reviewer_name: string;
  resulting_text: string;
}

export interface TrackChange {
  id: string;
  change_type: 'Insertion' | 'Deletion';
  author: string;
  date: string | null;
  original_text: string;
  new_text: string;
  context_before: string;
  context_after: string;
}

export interface DocxComment {
  id: string;
  author: string;
  date: string | null;
  text: string;
  anchor_text: string;
  initials: string | null;
}

export interface Reviewer {
  name: string;
  file_name: string;
  comment_count: number;
  change_count: number;
  colour: string;
}

// ─── Frontend-only types ───────────────────────────────────────────

export interface ManualComment {
  id: string;
  reviewer_name: string;
  paragraph_index: number;
  text: string;
  source: 'phone' | 'email' | 'teams' | 'whatsapp' | 'conference' | 'slack' | 'other';
  date: string;
}

export interface CommentStatus {
  comment_id: string;
  status: 'unresolved' | 'accepted' | 'rejected' | 'deferred';
  note: string;
}

export type SourceType = ManualComment['source'];

export const SOURCE_ICONS: Record<SourceType, string> = {
  phone: '\u{1F4DE}',
  email: '\u{1F4E7}',
  teams: '\u{1F4AC}',
  whatsapp: '\u{1F4F1}',
  slack: '\u{1F4AC}',
  conference: '\u{1F3E2}',
  other: '\u{1F4DD}',
};

export const REVIEWER_COLOURS = [
  { bg: '#FEE2E2', text: '#991B1B', accent: '#EF4444' },
  { bg: '#DBEAFE', text: '#1E3A8A', accent: '#3B82F6' },
  { bg: '#D1FAE5', text: '#065F46', accent: '#10B981' },
  { bg: '#FEF3C7', text: '#92400E', accent: '#F59E0B' },
  { bg: '#EDE9FE', text: '#5B21B6', accent: '#8B5CF6' },
  { bg: '#FFEDD5', text: '#9A3412', accent: '#F97316' },
  { bg: '#CCFBF1', text: '#115E59', accent: '#14B8A6' },
  { bg: '#FCE7F3', text: '#9D174D', accent: '#EC4899' },
];

// ─── Merged paragraph type for multi-document view ─────────────────

export interface MergedParagraph {
  index: number;
  base_text: string;
  revised_text: string;
  paragraph_status: ParagraphStatusType;
  paragraph_change_author: string | null;
  reviewer_versions: ReviewerVersion[];
  comments: DocxComment[];
  track_changes: TrackChange[];
  manual_comments: ManualComment[];
  has_conflicts: boolean;
  /** Source document filename — set when the item was added to the review */
  source_file: string | null;
  /** Whether this paragraph contains items added after the initial review began */
  has_new_items: boolean;
}
