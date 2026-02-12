use crate::types::{ChangeType, TrackChange};

/// Represents a segment of a paragraph: either stable text, an insertion, or a deletion
#[derive(Debug, Clone)]
pub enum Segment {
    Stable(String),
    Insertion {
        id: String,
        author: String,
        date: Option<String>,
        text: String,
    },
    Deletion {
        id: String,
        author: String,
        date: Option<String>,
        text: String,
    },
}

/// Reconstruct the base text (before changes) from segments
pub fn base_text(segments: &[Segment]) -> String {
    let mut result = String::new();
    for seg in segments {
        match seg {
            Segment::Stable(t) => result.push_str(t),
            Segment::Deletion { text, .. } => result.push_str(text), // deleted text was in original
            Segment::Insertion { .. } => {} // inserted text was not in original
        }
    }
    result
}

/// Reconstruct the revised text (after changes) from segments
pub fn revised_text(segments: &[Segment]) -> String {
    let mut result = String::new();
    for seg in segments {
        match seg {
            Segment::Stable(t) => result.push_str(t),
            Segment::Insertion { text, .. } => result.push_str(text), // inserted text appears in revised
            Segment::Deletion { .. } => {} // deleted text removed in revised
        }
    }
    result
}

/// Extract TrackChange structs from segments with context
pub fn extract_changes(segments: &[Segment]) -> Vec<TrackChange> {
    let mut changes = Vec::new();

    // Build full text for context extraction
    let full_base = base_text(segments);

    let mut position_in_base: usize = 0;

    for seg in segments {
        match seg {
            Segment::Stable(t) => {
                position_in_base += t.len();
            }
            Segment::Deletion { id, author, date, text } => {
                let context_before = extract_context_before(&full_base, position_in_base, 30);
                let context_after = extract_context_after(&full_base, position_in_base + text.len(), 30);

                changes.push(TrackChange {
                    id: id.clone(),
                    change_type: ChangeType::Deletion,
                    author: author.clone(),
                    date: date.clone(),
                    original_text: text.clone(),
                    new_text: String::new(),
                    context_before,
                    context_after,
                });

                position_in_base += text.len();
            }
            Segment::Insertion { id, author, date, text } => {
                let context_before = extract_context_before(&full_base, position_in_base, 30);
                let context_after = extract_context_after(&full_base, position_in_base, 30);

                changes.push(TrackChange {
                    id: id.clone(),
                    change_type: ChangeType::Insertion,
                    author: author.clone(),
                    date: date.clone(),
                    original_text: String::new(),
                    new_text: text.clone(),
                    context_before,
                    context_after,
                });
                // Insertions don't advance position in base text
            }
        }
    }

    changes
}

fn extract_context_before(text: &str, pos: usize, max_chars: usize) -> String {
    let start = if pos > max_chars { pos - max_chars } else { 0 };
    text.get(start..pos).unwrap_or("").to_string()
}

fn extract_context_after(text: &str, pos: usize, max_chars: usize) -> String {
    let end = (pos + max_chars).min(text.len());
    text.get(pos..end).unwrap_or("").to_string()
}
