use std::collections::HashMap;

use crate::paragraphs::ParsedParagraph;
use crate::track_changes::{self, Segment};
use crate::types::{Comment, ParagraphBlock, ParagraphStatus, Reviewer, ReviewerVersion, TrackChange};

/// Build the final CollateResult paragraphs by combining parsed paragraphs with comments
pub fn build_paragraph_blocks(
    parsed_paragraphs: &[ParsedParagraph],
    comments_map: &HashMap<String, Comment>,
    file_name: &str,
) -> (Vec<ParagraphBlock>, Vec<Reviewer>) {
    let mut blocks = Vec::new();
    let mut reviewer_changes: HashMap<String, (usize, usize)> = HashMap::new();

    for para in parsed_paragraphs {
        let base = track_changes::base_text(&para.segments);
        let revised = track_changes::revised_text(&para.segments);
        let changes = track_changes::extract_changes(&para.segments);

        // ─── Determine paragraph status ────────────────────────────
        let (paragraph_status, paragraph_change_author) = classify_paragraph(&para.segments);

        // Build comments for this paragraph
        let mut para_comments = Vec::new();
        for cid in &para.comment_ids {
            if let Some(comment) = comments_map.get(cid) {
                let mut c = comment.clone();
                if let Some(anchor) = para.comment_anchor_texts.get(cid) {
                    c.anchor_text = anchor.clone();
                }
                para_comments.push(c.clone());

                let entry = reviewer_changes.entry(c.author.clone()).or_insert((0, 0));
                entry.0 += 1;
            }
        }

        // Track change authors
        let mut change_authors = std::collections::HashSet::new();
        for change in &changes {
            change_authors.insert(change.author.clone());
            let entry = reviewer_changes.entry(change.author.clone()).or_insert((0, 0));
            entry.1 += 1;
        }

        // Build reviewer versions
        let mut reviewer_versions = Vec::new();
        if base != revised {
            let mut author_changes: HashMap<String, Vec<&TrackChange>> = HashMap::new();
            for change in &changes {
                author_changes
                    .entry(change.author.clone())
                    .or_default()
                    .push(change);
            }

            for author in &change_authors {
                reviewer_versions.push(ReviewerVersion {
                    reviewer_name: author.clone(),
                    resulting_text: revised.clone(),
                });
            }
        }

        let has_conflicts = change_authors.len() > 1;

        blocks.push(ParagraphBlock {
            index: para.index,
            base_text: base,
            revised_text: revised,
            paragraph_status,
            paragraph_change_author,
            reviewer_versions,
            comments: para_comments,
            track_changes: changes,
            has_conflicts,
        });
    }

    // Build reviewer list
    let colours = vec![
        "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#F97316", "#14B8A6", "#EC4899",
    ];
    let reviewers: Vec<Reviewer> = reviewer_changes
        .into_iter()
        .enumerate()
        .map(|(i, (name, (comment_count, change_count)))| Reviewer {
            name,
            file_name: file_name.to_string(),
            comment_count,
            change_count,
            colour: colours[i % colours.len()].to_string(),
        })
        .collect();

    (blocks, reviewers)
}

/// Classify a paragraph based on its segments:
/// - WhollyInserted: ALL text segments are Insertion (no Stable, no Deletion)
/// - WhollyDeleted: ALL text segments are Deletion (no Stable, no Insertion)
/// - Normal: any mix
///
/// Also returns the author responsible for the wholesale change (if any).
fn classify_paragraph(segments: &[Segment]) -> (ParagraphStatus, Option<String>) {
    let mut has_stable = false;
    let mut has_insertion = false;
    let mut has_deletion = false;
    let mut ins_author: Option<String> = None;
    let mut del_author: Option<String> = None;

    for seg in segments {
        match seg {
            Segment::Stable(t) => {
                if !t.trim().is_empty() {
                    has_stable = true;
                }
            }
            Segment::Insertion { author, .. } => {
                has_insertion = true;
                ins_author = Some(author.clone());
            }
            Segment::Deletion { author, .. } => {
                has_deletion = true;
                del_author = Some(author.clone());
            }
        }
    }

    if !has_stable && has_insertion && !has_deletion {
        (ParagraphStatus::WhollyInserted, ins_author)
    } else if !has_stable && has_deletion && !has_insertion {
        (ParagraphStatus::WhollyDeleted, del_author)
    } else {
        (ParagraphStatus::Normal, None)
    }
}
