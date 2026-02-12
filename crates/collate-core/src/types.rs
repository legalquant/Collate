use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollateResult {
    pub paragraphs: Vec<ParagraphBlock>,
    pub reviewers: Vec<Reviewer>,
    pub document_title: Option<String>,
    pub error: Option<String>,
}

/// Indicates whether a paragraph is wholly new, wholly deleted, or a normal
/// paragraph that may contain inline changes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ParagraphStatus {
    /// Paragraph existed in the original and may contain inline changes
    Normal,
    /// Entire paragraph was inserted by a reviewer (no base text exists)
    WhollyInserted,
    /// Entire paragraph was deleted by a reviewer (no revised text exists)
    WhollyDeleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParagraphBlock {
    pub index: usize,
    pub base_text: String,
    /// The full revised text after all changes (for display when the paragraph is wholly new)
    pub revised_text: String,
    pub paragraph_status: ParagraphStatus,
    /// Author who inserted/deleted this paragraph (only set for WhollyInserted/WhollyDeleted)
    pub paragraph_change_author: Option<String>,
    pub reviewer_versions: Vec<ReviewerVersion>,
    pub comments: Vec<Comment>,
    pub track_changes: Vec<TrackChange>,
    pub has_conflicts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewerVersion {
    pub reviewer_name: String,
    pub resulting_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackChange {
    pub id: String,
    pub change_type: ChangeType,
    pub author: String,
    pub date: Option<String>,
    pub original_text: String,
    pub new_text: String,
    pub context_before: String,
    pub context_after: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeType {
    Insertion,
    Deletion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub id: String,
    pub author: String,
    pub date: Option<String>,
    pub text: String,
    pub anchor_text: String,
    pub initials: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reviewer {
    pub name: String,
    pub file_name: String,
    pub comment_count: usize,
    pub change_count: usize,
    pub colour: String,
}
