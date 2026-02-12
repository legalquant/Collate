import type { MergedParagraph, Reviewer, CommentStatus } from '../wasm';

interface StoreSnapshot {
  mergedParagraphs: MergedParagraph[];
  reviewers: Reviewer[];
  statuses: Map<string, CommentStatus>;
  manualComments: { id: string; reviewer_name: string; paragraph_index: number; text: string; source: string; date: string }[];
}

export function generateHtmlReport(store: StoreSnapshot): string {
  const now = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let totalItems = 0;
  let resolvedItems = 0;
  const statusCounts = { unresolved: 0, accepted: 0, rejected: 0, deferred: 0 };

  for (const para of store.mergedParagraphs) {
    for (const tc of para.track_changes) {
      totalItems++;
      const s = store.statuses.get(tc.id)?.status || 'unresolved';
      statusCounts[s]++;
      if (s !== 'unresolved') resolvedItems++;
    }
    for (const c of para.comments) {
      totalItems++;
      const s = store.statuses.get(c.id)?.status || 'unresolved';
      statusCounts[s]++;
      if (s !== 'unresolved') resolvedItems++;
    }
    for (const mc of para.manual_comments) {
      totalItems++;
      const s = store.statuses.get(mc.id)?.status || 'unresolved';
      statusCounts[s]++;
      if (s !== 'unresolved') resolvedItems++;
    }
  }

  const paragraphsHtml = store.mergedParagraphs
    .filter(
      (p) =>
        p.track_changes.length > 0 || p.comments.length > 0 || p.manual_comments.length > 0 ||
        p.paragraph_status === 'WhollyInserted' || p.paragraph_status === 'WhollyDeleted'
    )
    .map((para) => {
      // Wholesale paragraph badge
      const wholesaleBadge =
        para.paragraph_status === 'WhollyInserted'
          ? `<span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#d1fae5;color:#065f46">NEW PARAGRAPH</span>`
          : para.paragraph_status === 'WhollyDeleted'
          ? `<span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b">DELETED PARAGRAPH</span>`
          : '';

      // For wholesale paragraphs, show the text with appropriate styling
      const wholesaleHtml =
        para.paragraph_status === 'WhollyInserted'
          ? `<div style="margin:8px 0;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px">
              <ins style="color:#065f46;text-decoration:none">${esc(para.revised_text)}</ins>
              ${para.paragraph_change_author ? `<div style="margin-top:4px;font-size:12px;color:#6b7280">Added by ${esc(para.paragraph_change_author)}</div>` : ''}
            </div>`
          : para.paragraph_status === 'WhollyDeleted'
          ? `<div style="margin:8px 0;padding:8px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px">
              <del style="color:#991b1b">${esc(para.base_text)}</del>
              ${para.paragraph_change_author ? `<div style="margin-top:4px;font-size:12px;color:#6b7280">Deleted by ${esc(para.paragraph_change_author)}</div>` : ''}
            </div>`
          : '';

      const trackChangesHtml = para.track_changes
        .map((tc) => {
          const status = store.statuses.get(tc.id);
          const badge = statusBadge(status?.status || 'unresolved');
          const diffHtml =
            tc.change_type === 'Deletion'
              ? `<del style="color:#991B1B;text-decoration:line-through;background:#FEE2E2">${esc(tc.original_text)}</del>`
              : `<ins style="color:#065F46;text-decoration:underline;background:#D1FAE5">${esc(tc.new_text)}</ins>`;

          return `<div style="margin:8px 0;padding:8px;border:1px solid #e5e7eb;border-radius:6px">
            <strong>${esc(tc.author)}</strong> — ${tc.change_type} ${badge}
            <div style="margin-top:4px">${diffHtml}</div>
            ${status?.note ? `<div style="margin-top:4px;font-size:12px;color:#6b7280">Note: ${esc(status.note)}</div>` : ''}
          </div>`;
        })
        .join('');

      const commentsHtml = para.comments
        .map((c) => {
          const status = store.statuses.get(c.id);
          const badge = statusBadge(status?.status || 'unresolved');
          return `<div style="margin:8px 0;padding:8px;border:1px solid #e5e7eb;border-radius:6px">
            <strong>${esc(c.author)}</strong> ${badge}
            ${c.anchor_text ? `<div style="font-size:12px;color:#6b7280;margin:4px 0">On: &ldquo;${esc(c.anchor_text)}&rdquo;</div>` : ''}
            <div>${esc(c.text)}</div>
            ${status?.note ? `<div style="margin-top:4px;font-size:12px;color:#6b7280">Note: ${esc(status.note)}</div>` : ''}
          </div>`;
        })
        .join('');

      const manualHtml = para.manual_comments
        .map((mc) => {
          const status = store.statuses.get(mc.id);
          const badge = statusBadge(status?.status || 'unresolved');
          return `<div style="margin:8px 0;padding:8px;border:1px solid #e5e7eb;border-radius:6px">
            <strong>${esc(mc.reviewer_name)}</strong> (${esc(mc.source)}) ${badge}
            <div>${esc(mc.text)}</div>
            ${status?.note ? `<div style="margin-top:4px;font-size:12px;color:#6b7280">Note: ${esc(status.note)}</div>` : ''}
          </div>`;
        })
        .join('');

      const borderColor = para.paragraph_status === 'WhollyInserted' ? '#10b981'
        : para.paragraph_status === 'WhollyDeleted' ? '#ef4444' : '#d1d5db';

      // Display text: for wholesale, show appropriate version; for normal, show base
      const displayText = para.paragraph_status === 'WhollyInserted' ? para.revised_text
        : para.paragraph_status === 'WhollyDeleted' ? para.base_text
        : para.base_text;

      return `<div style="margin:24px 0;padding:16px;border:1px solid ${borderColor};border-left:3px solid ${borderColor};border-radius:8px">
        <h3 style="margin:0 0 8px 0;font-size:14px;color:#6b7280">¶ ${para.index + 1} ${wholesaleBadge}</h3>
        ${wholesaleHtml || `<p style="margin:0 0 12px 0;line-height:1.6">${esc(displayText)}</p>`}
        ${trackChangesHtml ? `<h4 style="font-size:12px;text-transform:uppercase;color:#9ca3af;margin:12px 0 4px">Track Changes</h4>${trackChangesHtml}` : ''}
        ${commentsHtml ? `<h4 style="font-size:12px;text-transform:uppercase;color:#9ca3af;margin:12px 0 4px">Comments</h4>${commentsHtml}` : ''}
        ${manualHtml ? `<h4 style="font-size:12px;text-transform:uppercase;color:#9ca3af;margin:12px 0 4px">Manual Comments</h4>${manualHtml}` : ''}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Collate Report — ${now}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.5; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 14px; }
    th { background: #f9fafb; font-weight: 600; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Collate Report</h1>
  <div class="subtitle">Generated ${now}</div>

  <h2 style="font-size:16px">Summary</h2>
  <table>
    <tr><th>Total Items</th><td>${totalItems}</td></tr>
    <tr><th>Resolved</th><td>${resolvedItems}</td></tr>
    <tr><th>Unresolved</th><td>${statusCounts.unresolved}</td></tr>
    <tr><th>Accepted</th><td>${statusCounts.accepted}</td></tr>
    <tr><th>Rejected</th><td>${statusCounts.rejected}</td></tr>
    <tr><th>Deferred</th><td>${statusCounts.deferred}</td></tr>
  </table>

  ${store.reviewers.length > 0 ? `
  <h2 style="font-size:16px">Reviewers</h2>
  <table>
    <tr><th>Reviewer</th><th>Comments</th><th>Changes</th></tr>
    ${store.reviewers.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.comment_count}</td><td>${r.change_count}</td></tr>`).join('')}
  </table>` : ''}

  <h2 style="font-size:16px">Paragraphs</h2>
  ${paragraphsHtml}

  <div class="footer">
    Generated by Collate (collate.law) — all processing performed locally in the browser
  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(status: string): string {
  const colours: Record<string, string> = {
    unresolved: 'background:#f3f4f6;color:#4b5563',
    accepted: 'background:#d1fae5;color:#065f46',
    rejected: 'background:#fee2e2;color:#991b1b',
    deferred: 'background:#fef3c7;color:#92400e',
  };
  const style = colours[status] || colours.unresolved;
  return `<span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;${style}">${status}</span>`;
}
