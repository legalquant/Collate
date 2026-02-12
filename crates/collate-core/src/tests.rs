use std::collections::HashMap;
use std::io::{Cursor, Write};

use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::comments;
use crate::docx;
use crate::matcher;
use crate::paragraphs;
use crate::track_changes::{self, Segment};
use crate::types::*;

// ═══════════════════════════════════════════════════════════════════════
// Helper: create an in-memory .docx ZIP with arbitrary entries
// ═══════════════════════════════════════════════════════════════════════

fn create_docx_bytes(files: &[(&str, &str)]) -> Vec<u8> {
    let buf: Vec<u8> = Vec::new();
    let cursor = Cursor::new(buf);
    let mut zip = ZipWriter::new(cursor);
    let options: SimpleFileOptions = SimpleFileOptions::default();

    for (name, content) in files {
        zip.start_file(name.to_string(), options.clone()).unwrap();
        zip.write_all(content.as_bytes()).unwrap();
    }

    zip.finish().unwrap().into_inner()
}

/// Minimal document.xml wrapping body content
fn minimal_document_xml(body_content: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body_content}
  </w:body>
</w:document>"#
    )
}

/// Minimal comments.xml wrapping comment elements
fn minimal_comments_xml(comments_content: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  {comments_content}
</w:comments>"#
    )
}

// ═══════════════════════════════════════════════════════════════════════
//  1. comments.rs tests
// ═══════════════════════════════════════════════════════════════════════

#[test]
fn comments_parse_single_comment() {
    let xml = minimal_comments_xml(
        r#"<w:comment w:id="1" w:author="Alice" w:date="2024-06-15T10:30:00Z" w:initials="A">
            <w:p><w:r><w:t>Good point here.</w:t></w:r></w:p>
        </w:comment>"#,
    );
    let map = comments::parse_comments(&xml);
    assert_eq!(map.len(), 1);

    let c = map.get("1").expect("comment id 1 should exist");
    assert_eq!(c.author, "Alice");
    assert_eq!(c.date.as_deref(), Some("2024-06-15T10:30:00Z"));
    assert_eq!(c.initials.as_deref(), Some("A"));
    assert_eq!(c.text, "Good point here.");
}

#[test]
fn comments_parse_multiple_comments() {
    let xml = minimal_comments_xml(
        r#"<w:comment w:id="0" w:author="Alice" w:date="2024-01-01T00:00:00Z" w:initials="A">
            <w:p><w:r><w:t>First comment</w:t></w:r></w:p>
        </w:comment>
        <w:comment w:id="1" w:author="Bob" w:date="2024-02-01T00:00:00Z" w:initials="B">
            <w:p><w:r><w:t>Second comment</w:t></w:r></w:p>
        </w:comment>
        <w:comment w:id="2" w:author="Carol" w:date="2024-03-01T00:00:00Z" w:initials="C">
            <w:p><w:r><w:t>Third comment</w:t></w:r></w:p>
        </w:comment>"#,
    );
    let map = comments::parse_comments(&xml);
    assert_eq!(map.len(), 3);

    assert_eq!(map.get("0").unwrap().author, "Alice");
    assert_eq!(map.get("0").unwrap().text, "First comment");
    assert_eq!(map.get("1").unwrap().author, "Bob");
    assert_eq!(map.get("1").unwrap().text, "Second comment");
    assert_eq!(map.get("2").unwrap().author, "Carol");
    assert_eq!(map.get("2").unwrap().text, "Third comment");
}

#[test]
fn comments_parse_empty_comments_xml() {
    let xml = minimal_comments_xml("");
    let map = comments::parse_comments(&xml);
    assert!(map.is_empty());
}

#[test]
fn comments_all_fields_extracted() {
    let xml = minimal_comments_xml(
        r#"<w:comment w:id="42" w:author="Dr. Smith" w:date="2025-12-31T23:59:59Z" w:initials="DS">
            <w:p><w:r><w:t>Please revise this section.</w:t></w:r></w:p>
        </w:comment>"#,
    );
    let map = comments::parse_comments(&xml);
    let c = map.get("42").unwrap();

    assert_eq!(c.id, "42");
    assert_eq!(c.author, "Dr. Smith");
    assert_eq!(c.date.as_deref(), Some("2025-12-31T23:59:59Z"));
    assert_eq!(c.initials.as_deref(), Some("DS"));
    assert_eq!(c.text, "Please revise this section.");
}

#[test]
fn comments_missing_optional_fields() {
    // No date and no initials attributes
    let xml = minimal_comments_xml(
        r#"<w:comment w:id="7" w:author="Anonymous">
            <w:p><w:r><w:t>Minimal comment</w:t></w:r></w:p>
        </w:comment>"#,
    );
    let map = comments::parse_comments(&xml);
    let c = map.get("7").unwrap();

    assert_eq!(c.id, "7");
    assert_eq!(c.author, "Anonymous");
    assert!(c.date.is_none(), "date should be None when attribute missing");
    assert!(
        c.initials.is_none(),
        "initials should be None when attribute missing"
    );
    assert_eq!(c.text, "Minimal comment");
}

#[test]
fn comments_multiline_text() {
    let xml = minimal_comments_xml(
        r#"<w:comment w:id="5" w:author="Eve" w:date="2024-07-01T00:00:00Z" w:initials="E">
            <w:p><w:r><w:t>First line</w:t></w:r></w:p>
            <w:p><w:r><w:t> and second line</w:t></w:r></w:p>
        </w:comment>"#,
    );
    let map = comments::parse_comments(&xml);
    let c = map.get("5").unwrap();
    // All text within the comment element is accumulated
    assert!(c.text.contains("First line"));
    assert!(c.text.contains("second line"));
}

// ═══════════════════════════════════════════════════════════════════════
//  2. track_changes.rs tests
// ═══════════════════════════════════════════════════════════════════════

#[test]
fn track_base_text_only_stable() {
    let segments = vec![
        Segment::Stable("Hello ".to_string()),
        Segment::Stable("world".to_string()),
    ];
    assert_eq!(track_changes::base_text(&segments), "Hello world");
}

#[test]
fn track_base_text_with_deletions() {
    // Deleted text was in the original, so base_text includes it
    let segments = vec![
        Segment::Stable("The ".to_string()),
        Segment::Deletion {
            id: "1".into(),
            author: "Bob".into(),
            date: None,
            text: "quick ".to_string(),
        },
        Segment::Stable("fox".to_string()),
    ];
    assert_eq!(track_changes::base_text(&segments), "The quick fox");
}

#[test]
fn track_base_text_with_insertions() {
    // Inserted text was NOT in the original, so base_text excludes it
    let segments = vec![
        Segment::Stable("The ".to_string()),
        Segment::Insertion {
            id: "1".into(),
            author: "Alice".into(),
            date: None,
            text: "brown ".to_string(),
        },
        Segment::Stable("fox".to_string()),
    ];
    assert_eq!(track_changes::base_text(&segments), "The fox");
}

#[test]
fn track_revised_text_with_deletions() {
    // Deleted text is removed in revised
    let segments = vec![
        Segment::Stable("The ".to_string()),
        Segment::Deletion {
            id: "1".into(),
            author: "Bob".into(),
            date: None,
            text: "old ".to_string(),
        },
        Segment::Stable("fox".to_string()),
    ];
    assert_eq!(track_changes::revised_text(&segments), "The fox");
}

#[test]
fn track_revised_text_with_insertions() {
    // Inserted text appears in revised
    let segments = vec![
        Segment::Stable("The ".to_string()),
        Segment::Insertion {
            id: "1".into(),
            author: "Alice".into(),
            date: None,
            text: "quick ".to_string(),
        },
        Segment::Stable("fox".to_string()),
    ];
    assert_eq!(track_changes::revised_text(&segments), "The quick fox");
}

#[test]
fn track_base_and_revised_with_mixed_changes() {
    let segments = vec![
        Segment::Stable("Hello ".to_string()),
        Segment::Deletion {
            id: "1".into(),
            author: "Bob".into(),
            date: Some("2024-01-01T00:00:00Z".into()),
            text: "cruel ".to_string(),
        },
        Segment::Insertion {
            id: "2".into(),
            author: "Alice".into(),
            date: Some("2024-01-02T00:00:00Z".into()),
            text: "beautiful ".to_string(),
        },
        Segment::Stable("world".to_string()),
    ];
    assert_eq!(track_changes::base_text(&segments), "Hello cruel world");
    assert_eq!(
        track_changes::revised_text(&segments),
        "Hello beautiful world"
    );
}

#[test]
fn track_extract_changes_produces_correct_structs() {
    let segments = vec![
        Segment::Stable("AAA ".to_string()),
        Segment::Deletion {
            id: "10".into(),
            author: "Bob".into(),
            date: Some("2024-06-01T00:00:00Z".into()),
            text: "BBB".to_string(),
        },
        Segment::Stable(" CCC ".to_string()),
        Segment::Insertion {
            id: "20".into(),
            author: "Alice".into(),
            date: Some("2024-06-02T00:00:00Z".into()),
            text: "DDD".to_string(),
        },
        Segment::Stable(" EEE".to_string()),
    ];

    let changes = track_changes::extract_changes(&segments);
    assert_eq!(changes.len(), 2);

    // First change: deletion
    let del = &changes[0];
    assert_eq!(del.id, "10");
    assert!(matches!(del.change_type, ChangeType::Deletion));
    assert_eq!(del.author, "Bob");
    assert_eq!(del.date.as_deref(), Some("2024-06-01T00:00:00Z"));
    assert_eq!(del.original_text, "BBB");
    assert_eq!(del.new_text, "");

    // Second change: insertion
    let ins = &changes[1];
    assert_eq!(ins.id, "20");
    assert!(matches!(ins.change_type, ChangeType::Insertion));
    assert_eq!(ins.author, "Alice");
    assert_eq!(ins.date.as_deref(), Some("2024-06-02T00:00:00Z"));
    assert_eq!(ins.original_text, "");
    assert_eq!(ins.new_text, "DDD");
}

#[test]
fn track_context_before_and_after() {
    // Use text long enough to verify context window (30 chars)
    let segments = vec![
        Segment::Stable("Prefix text before the change ".to_string()), // 30 chars
        Segment::Deletion {
            id: "1".into(),
            author: "X".into(),
            date: None,
            text: "DELETED".to_string(),
        },
        Segment::Stable(" suffix text after the change.".to_string()), // 30 chars
    ];

    let changes = track_changes::extract_changes(&segments);
    assert_eq!(changes.len(), 1);

    let c = &changes[0];
    // context_before should be up to 30 chars before the deletion position
    assert_eq!(c.context_before, "Prefix text before the change ");
    // context_after should be up to 30 chars after the deletion end
    assert_eq!(c.context_after, " suffix text after the change.");
}

#[test]
fn track_context_short_text() {
    // When text is shorter than 30 chars, context should be the whole available text
    let segments = vec![
        Segment::Stable("Hi ".to_string()),
        Segment::Insertion {
            id: "1".into(),
            author: "X".into(),
            date: None,
            text: "NEW".to_string(),
        },
        Segment::Stable(" bye".to_string()),
    ];

    let changes = track_changes::extract_changes(&segments);
    let c = &changes[0];
    assert_eq!(c.context_before, "Hi ");
    assert_eq!(c.context_after, " bye");
}

#[test]
fn track_empty_segments() {
    let segments: Vec<Segment> = vec![];
    assert_eq!(track_changes::base_text(&segments), "");
    assert_eq!(track_changes::revised_text(&segments), "");
    assert!(track_changes::extract_changes(&segments).is_empty());
}

// ═══════════════════════════════════════════════════════════════════════
//  3. paragraphs.rs tests
// ═══════════════════════════════════════════════════════════════════════

#[test]
fn paragraphs_parse_plain_paragraphs() {
    let xml = minimal_document_xml(
        r#"<w:p><w:r><w:t>First paragraph.</w:t></w:r></w:p>
        <w:p><w:r><w:t>Second paragraph.</w:t></w:r></w:p>"#,
    );
    let paras = paragraphs::parse_document(&xml);
    assert_eq!(paras.len(), 2);

    // First paragraph
    assert_eq!(paras[0].index, 0);
    assert_eq!(paras[0].segments.len(), 1);
    match &paras[0].segments[0] {
        Segment::Stable(t) => assert_eq!(t, "First paragraph."),
        _ => panic!("Expected Stable segment"),
    }

    // Second paragraph
    assert_eq!(paras[1].index, 1);
    match &paras[1].segments[0] {
        Segment::Stable(t) => assert_eq!(t, "Second paragraph."),
        _ => panic!("Expected Stable segment"),
    }
}

#[test]
fn paragraphs_parse_with_insertion() {
    // Note: trim_text(true) in the XML reader trims leading/trailing whitespace
    // from text events, so "Before " becomes "Before" etc.
    let xml = minimal_document_xml(
        r#"<w:p>
            <w:r><w:t>Before </w:t></w:r>
            <w:ins w:id="1" w:author="Alice" w:date="2024-01-01T00:00:00Z">
                <w:r><w:t>inserted </w:t></w:r>
            </w:ins>
            <w:r><w:t>after</w:t></w:r>
        </w:p>"#,
    );
    let paras = paragraphs::parse_document(&xml);
    assert_eq!(paras.len(), 1);

    let segs = &paras[0].segments;
    assert_eq!(segs.len(), 3); // Stable, Insertion, Stable

    match &segs[0] {
        Segment::Stable(t) => assert_eq!(t, "Before"),
        other => panic!("Expected Stable, got {:?}", other),
    }
    match &segs[1] {
        Segment::Insertion {
            id,
            author,
            date,
            text,
        } => {
            assert_eq!(id, "1");
            assert_eq!(author, "Alice");
            assert_eq!(date.as_deref(), Some("2024-01-01T00:00:00Z"));
            assert_eq!(text, "inserted");
        }
        other => panic!("Expected Insertion, got {:?}", other),
    }
    match &segs[2] {
        Segment::Stable(t) => assert_eq!(t, "after"),
        other => panic!("Expected Stable, got {:?}", other),
    }
}

#[test]
fn paragraphs_parse_with_deletion() {
    let xml = minimal_document_xml(
        r#"<w:p>
            <w:r><w:t>Start </w:t></w:r>
            <w:del w:id="5" w:author="Bob" w:date="2024-02-15T12:00:00Z">
                <w:r><w:delText>removed </w:delText></w:r>
            </w:del>
            <w:r><w:t>end</w:t></w:r>
        </w:p>"#,
    );
    let paras = paragraphs::parse_document(&xml);
    assert_eq!(paras.len(), 1);

    let segs = &paras[0].segments;
    // Should have Stable, Deletion, Stable
    assert!(segs.len() >= 2); // At least stable + deletion

    // Check that we have a Deletion segment
    let has_deletion = segs.iter().any(|s| matches!(s, Segment::Deletion { .. }));
    assert!(has_deletion, "Should contain a Deletion segment");
}

#[test]
fn paragraphs_parse_with_comment_ranges() {
    let xml = minimal_document_xml(
        r#"<w:p>
            <w:commentRangeStart w:id="1"/>
            <w:r><w:t>Commented text</w:t></w:r>
            <w:commentRangeEnd w:id="1"/>
        </w:p>"#,
    );
    let paras = paragraphs::parse_document(&xml);
    assert_eq!(paras.len(), 1);

    let para = &paras[0];
    assert!(para.comment_ids.contains(&"1".to_string()));
    assert_eq!(
        para.comment_anchor_texts.get("1").map(|s| s.as_str()),
        Some("Commented text")
    );
}

#[test]
fn paragraphs_parse_multiple_comment_ranges() {
    let xml = minimal_document_xml(
        r#"<w:p>
            <w:commentRangeStart w:id="10"/>
            <w:r><w:t>First anchor</w:t></w:r>
            <w:commentRangeEnd w:id="10"/>
            <w:r><w:t> middle </w:t></w:r>
            <w:commentRangeStart w:id="20"/>
            <w:r><w:t>Second anchor</w:t></w:r>
            <w:commentRangeEnd w:id="20"/>
        </w:p>"#,
    );
    let paras = paragraphs::parse_document(&xml);
    assert_eq!(paras.len(), 1);

    let para = &paras[0];
    assert_eq!(para.comment_ids.len(), 2);
    assert_eq!(
        para.comment_anchor_texts.get("10").map(|s| s.as_str()),
        Some("First anchor")
    );
    assert_eq!(
        para.comment_anchor_texts.get("20").map(|s| s.as_str()),
        Some("Second anchor")
    );
}

#[test]
fn paragraphs_skip_empty_paragraphs() {
    let xml = minimal_document_xml(
        r#"<w:p><w:r><w:t>Real content</w:t></w:r></w:p>
        <w:p></w:p>
        <w:p><w:pPr></w:pPr></w:p>
        <w:p><w:r><w:t>More content</w:t></w:r></w:p>"#,
    );
    let paras = paragraphs::parse_document(&xml);
    // Empty paragraphs should be skipped
    assert_eq!(paras.len(), 2);
    assert_eq!(paras[0].index, 0);
    assert_eq!(paras[1].index, 1);
}

#[test]
fn paragraphs_handle_nested_elements() {
    // Paragraphs inside table cells etc. — the parser increments depth.
    // trim_text(true) strips trailing/leading whitespace from each text node,
    // so consecutive runs are merged without intervening spaces.
    let xml = minimal_document_xml(
        r#"<w:p>
            <w:r><w:t>Outer text </w:t></w:r>
            <w:r><w:t>with runs</w:t></w:r>
        </w:p>"#,
    );
    let paras = paragraphs::parse_document(&xml);
    assert_eq!(paras.len(), 1);

    // Consecutive stable text should be merged (trimmed: "Outer text" + "with runs")
    match &paras[0].segments[0] {
        Segment::Stable(t) => assert_eq!(t, "Outer textwith runs"),
        other => panic!("Expected merged Stable segment, got {:?}", other),
    }
}

#[test]
fn paragraphs_whitespace_only_paragraph_skipped() {
    let xml = minimal_document_xml(
        r#"<w:p><w:r><w:t>   </w:t></w:r></w:p>
        <w:p><w:r><w:t>Actual content</w:t></w:r></w:p>"#,
    );
    let paras = paragraphs::parse_document(&xml);
    // Whitespace-only paragraph is considered empty (trim check)
    assert_eq!(paras.len(), 1);
    assert_eq!(paras[0].index, 0);
}

// ═══════════════════════════════════════════════════════════════════════
//  4. docx.rs integration tests
// ═══════════════════════════════════════════════════════════════════════

#[test]
fn docx_parse_minimal_valid() {
    let doc_xml = minimal_document_xml(
        r#"<w:p><w:r><w:t>Hello from the docx!</w:t></w:r></w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "test.docx").expect("Should parse successfully");

    assert!(result.error.is_none());
    assert_eq!(result.paragraphs.len(), 1);
    assert_eq!(result.paragraphs[0].base_text, "Hello from the docx!");
}

#[test]
fn docx_parse_with_comments_xml() {
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:commentRangeStart w:id="1"/>
            <w:r><w:t>Anchor text here</w:t></w:r>
            <w:commentRangeEnd w:id="1"/>
        </w:p>"#,
    );
    let comments_xml = minimal_comments_xml(
        r#"<w:comment w:id="1" w:author="Reviewer" w:date="2024-08-01T00:00:00Z" w:initials="R">
            <w:p><w:r><w:t>Fix this.</w:t></w:r></w:p>
        </w:comment>"#,
    );
    let bytes = create_docx_bytes(&[
        ("word/document.xml", &doc_xml),
        ("word/comments.xml", &comments_xml),
    ]);

    let result = docx::parse(&bytes, "review.docx").expect("Should parse");

    assert_eq!(result.paragraphs.len(), 1);
    assert_eq!(result.paragraphs[0].comments.len(), 1);
    assert_eq!(result.paragraphs[0].comments[0].author, "Reviewer");
    assert_eq!(result.paragraphs[0].comments[0].text, "Fix this.");
    assert_eq!(
        result.paragraphs[0].comments[0].anchor_text,
        "Anchor text here"
    );
}

#[test]
fn docx_missing_comments_xml_graceful() {
    // Only document.xml, no comments.xml — should work fine with empty comments
    let doc_xml = minimal_document_xml(
        r#"<w:p><w:r><w:t>No comments here.</w:t></w:r></w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "nocomments.docx").expect("Should parse");
    assert!(result.error.is_none());
    assert_eq!(result.paragraphs.len(), 1);
    assert!(result.paragraphs[0].comments.is_empty());
}

#[test]
fn docx_error_on_invalid_zip_data() {
    let garbage = b"this is not a zip file at all";
    let result = docx::parse(garbage, "bad.docx");
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(
        err.contains("ZIP"),
        "Error should mention ZIP: got '{}'",
        err
    );
}

#[test]
fn docx_error_on_missing_document_xml() {
    // Valid ZIP but without word/document.xml
    let bytes = create_docx_bytes(&[("word/styles.xml", "<styles/>")]);
    let result = docx::parse(&bytes, "nodoc.docx");
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(
        err.contains("document.xml"),
        "Error should mention document.xml: got '{}'",
        err
    );
}

#[test]
fn docx_parse_with_core_xml_title() {
    let doc_xml = minimal_document_xml(
        r#"<w:p><w:r><w:t>Content</w:t></w:r></w:p>"#,
    );
    let core_xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>My Document Title</dc:title>
</cp:coreProperties>"#;
    let bytes = create_docx_bytes(&[
        ("word/document.xml", &doc_xml),
        ("docProps/core.xml", core_xml),
    ]);

    let result = docx::parse(&bytes, "titled.docx").expect("Should parse");
    assert_eq!(
        result.document_title.as_deref(),
        Some("My Document Title")
    );
}

#[test]
fn docx_parse_track_changes_end_to_end() {
    // trim_text(true) strips whitespace from each text event, so
    // "Hello " becomes "Hello", "cruel " becomes "cruel", etc.
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:r><w:t>Hello </w:t></w:r>
            <w:del w:id="1" w:author="Bob" w:date="2024-05-01T00:00:00Z">
                <w:r><w:delText>cruel </w:delText></w:r>
            </w:del>
            <w:ins w:id="2" w:author="Alice" w:date="2024-05-02T00:00:00Z">
                <w:r><w:t>beautiful </w:t></w:r>
            </w:ins>
            <w:r><w:t>world</w:t></w:r>
        </w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "changes.docx").expect("Should parse");
    assert_eq!(result.paragraphs.len(), 1);

    let para = &result.paragraphs[0];
    // base_text = Stable("Hello") + Deletion("cruel") + Stable("world") = "Hellocruelworld"
    assert_eq!(para.base_text, "Hellocruelworld");

    // Should have track changes
    assert!(!para.track_changes.is_empty());

    // Verify the track changes exist for both authors
    let authors: Vec<&str> = para.track_changes.iter().map(|tc| tc.author.as_str()).collect();
    assert!(authors.contains(&"Bob"), "Bob's deletion should be tracked");
    assert!(authors.contains(&"Alice"), "Alice's insertion should be tracked");
}

// ═══════════════════════════════════════════════════════════════════════
//  5. matcher.rs tests
// ═══════════════════════════════════════════════════════════════════════

/// Helper: build a ParsedParagraph for matcher tests
fn make_parsed_paragraph(
    index: usize,
    segments: Vec<Segment>,
    comment_ids: Vec<String>,
    comment_anchor_texts: HashMap<String, String>,
) -> paragraphs::ParsedParagraph {
    paragraphs::ParsedParagraph {
        index,
        segments,
        comment_ids,
        comment_anchor_texts,
    }
}

#[test]
fn matcher_comments_matched_to_correct_paragraphs() {
    let paras = vec![
        make_parsed_paragraph(
            0,
            vec![Segment::Stable("First paragraph.".into())],
            vec!["1".into()],
            {
                let mut m = HashMap::new();
                m.insert("1".into(), "First paragraph.".into());
                m
            },
        ),
        make_parsed_paragraph(
            1,
            vec![Segment::Stable("Second paragraph.".into())],
            vec!["2".into()],
            {
                let mut m = HashMap::new();
                m.insert("2".into(), "Second paragraph.".into());
                m
            },
        ),
    ];

    let mut comments_map = HashMap::new();
    comments_map.insert(
        "1".into(),
        Comment {
            id: "1".into(),
            author: "Alice".into(),
            date: Some("2024-01-01T00:00:00Z".into()),
            text: "Comment on first".into(),
            anchor_text: String::new(),
            initials: Some("A".into()),
        },
    );
    comments_map.insert(
        "2".into(),
        Comment {
            id: "2".into(),
            author: "Bob".into(),
            date: Some("2024-01-02T00:00:00Z".into()),
            text: "Comment on second".into(),
            anchor_text: String::new(),
            initials: Some("B".into()),
        },
    );

    let (blocks, _reviewers) = matcher::build_paragraph_blocks(&paras, &comments_map, "test.docx");

    assert_eq!(blocks.len(), 2);
    assert_eq!(blocks[0].comments.len(), 1);
    assert_eq!(blocks[0].comments[0].author, "Alice");
    assert_eq!(blocks[0].comments[0].anchor_text, "First paragraph.");

    assert_eq!(blocks[1].comments.len(), 1);
    assert_eq!(blocks[1].comments[0].author, "Bob");
    assert_eq!(blocks[1].comments[0].anchor_text, "Second paragraph.");
}

#[test]
fn matcher_reviewer_list_with_correct_counts() {
    let paras = vec![
        make_parsed_paragraph(
            0,
            vec![
                Segment::Stable("Text ".into()),
                Segment::Insertion {
                    id: "1".into(),
                    author: "Alice".into(),
                    date: None,
                    text: "added".into(),
                },
            ],
            vec!["100".into()],
            {
                let mut m = HashMap::new();
                m.insert("100".into(), "Text".into());
                m
            },
        ),
        make_parsed_paragraph(
            1,
            vec![
                Segment::Stable("More ".into()),
                Segment::Deletion {
                    id: "2".into(),
                    author: "Alice".into(),
                    date: None,
                    text: "removed".into(),
                },
            ],
            vec![],
            HashMap::new(),
        ),
    ];

    let mut comments_map = HashMap::new();
    comments_map.insert(
        "100".into(),
        Comment {
            id: "100".into(),
            author: "Alice".into(),
            date: None,
            text: "A comment".into(),
            anchor_text: String::new(),
            initials: None,
        },
    );

    let (_blocks, reviewers) =
        matcher::build_paragraph_blocks(&paras, &comments_map, "test.docx");

    // Alice should be the only reviewer
    assert_eq!(reviewers.len(), 1);
    let alice = &reviewers[0];
    assert_eq!(alice.name, "Alice");
    assert_eq!(alice.comment_count, 1); // 1 comment
    assert_eq!(alice.change_count, 2); // 1 insertion + 1 deletion
    assert_eq!(alice.file_name, "test.docx");
    assert!(!alice.colour.is_empty());
}

#[test]
fn matcher_detect_conflicts_multiple_authors() {
    // Two different authors editing the same paragraph → has_conflicts = true
    let paras = vec![make_parsed_paragraph(
        0,
        vec![
            Segment::Stable("Shared paragraph ".into()),
            Segment::Insertion {
                id: "1".into(),
                author: "Alice".into(),
                date: None,
                text: "Alice's addition ".into(),
            },
            Segment::Deletion {
                id: "2".into(),
                author: "Bob".into(),
                date: None,
                text: "Bob's removal".into(),
            },
        ],
        vec![],
        HashMap::new(),
    )];

    let (blocks, reviewers) =
        matcher::build_paragraph_blocks(&paras, &HashMap::new(), "conflict.docx");

    assert_eq!(blocks.len(), 1);
    assert!(
        blocks[0].has_conflicts,
        "Should detect conflict when multiple authors edit same paragraph"
    );

    // Both authors should appear in reviewers
    assert_eq!(reviewers.len(), 2);
    let names: Vec<&str> = reviewers.iter().map(|r| r.name.as_str()).collect();
    assert!(names.contains(&"Alice"));
    assert!(names.contains(&"Bob"));
}

#[test]
fn matcher_no_conflicts_single_author() {
    let paras = vec![make_parsed_paragraph(
        0,
        vec![
            Segment::Stable("Text ".into()),
            Segment::Insertion {
                id: "1".into(),
                author: "Alice".into(),
                date: None,
                text: "added ".into(),
            },
            Segment::Deletion {
                id: "2".into(),
                author: "Alice".into(),
                date: None,
                text: "removed".into(),
            },
        ],
        vec![],
        HashMap::new(),
    )];

    let (blocks, _) = matcher::build_paragraph_blocks(&paras, &HashMap::new(), "single.docx");
    assert!(!blocks[0].has_conflicts, "Single author should not conflict");
}

#[test]
fn matcher_reviewer_versions_populated_when_text_differs() {
    let paras = vec![make_parsed_paragraph(
        0,
        vec![
            Segment::Stable("Original ".into()),
            Segment::Insertion {
                id: "1".into(),
                author: "Alice".into(),
                date: None,
                text: "new part".into(),
            },
        ],
        vec![],
        HashMap::new(),
    )];

    let (blocks, _) = matcher::build_paragraph_blocks(&paras, &HashMap::new(), "test.docx");
    let para = &blocks[0];

    // base = "Original ", revised = "Original new part" → different, so reviewer_versions populated
    assert_eq!(para.base_text, "Original ");
    assert!(!para.reviewer_versions.is_empty());
    assert_eq!(para.reviewer_versions[0].reviewer_name, "Alice");
    assert_eq!(
        para.reviewer_versions[0].resulting_text,
        "Original new part"
    );
}

#[test]
fn matcher_no_reviewer_versions_when_no_changes() {
    let paras = vec![make_parsed_paragraph(
        0,
        vec![Segment::Stable("Plain text with no changes.".into())],
        vec![],
        HashMap::new(),
    )];

    let (blocks, _) = matcher::build_paragraph_blocks(&paras, &HashMap::new(), "test.docx");
    assert!(
        blocks[0].reviewer_versions.is_empty(),
        "No changes means no reviewer versions"
    );
    assert!(blocks[0].track_changes.is_empty());
    assert!(!blocks[0].has_conflicts);
}

#[test]
fn matcher_multiple_reviewers_get_colours() {
    let paras = vec![
        make_parsed_paragraph(
            0,
            vec![
                Segment::Stable("P1 ".into()),
                Segment::Insertion {
                    id: "1".into(),
                    author: "Alice".into(),
                    date: None,
                    text: "a".into(),
                },
            ],
            vec![],
            HashMap::new(),
        ),
        make_parsed_paragraph(
            1,
            vec![
                Segment::Stable("P2 ".into()),
                Segment::Insertion {
                    id: "2".into(),
                    author: "Bob".into(),
                    date: None,
                    text: "b".into(),
                },
            ],
            vec![],
            HashMap::new(),
        ),
        make_parsed_paragraph(
            2,
            vec![
                Segment::Stable("P3 ".into()),
                Segment::Insertion {
                    id: "3".into(),
                    author: "Carol".into(),
                    date: None,
                    text: "c".into(),
                },
            ],
            vec![],
            HashMap::new(),
        ),
    ];

    let (_, reviewers) = matcher::build_paragraph_blocks(&paras, &HashMap::new(), "multi.docx");

    assert_eq!(reviewers.len(), 3);
    // Each reviewer should have a colour assigned
    for r in &reviewers {
        assert!(
            r.colour.starts_with('#'),
            "Colour should be a hex colour: {}",
            r.colour
        );
    }
    // Colours should be from the predefined palette
    let valid_colours = [
        "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#F97316", "#14B8A6", "#EC4899",
    ];
    for r in &reviewers {
        assert!(
            valid_colours.contains(&r.colour.as_str()),
            "Colour {} should be from palette",
            r.colour
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  End-to-end: parse_docx (the public WASM API, returns JSON)
// ═══════════════════════════════════════════════════════════════════════

#[test]
fn e2e_parse_docx_returns_valid_json() {
    let doc_xml = minimal_document_xml(
        r#"<w:p><w:r><w:t>End to end test.</w:t></w:r></w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let json_str = crate::parse_docx(&bytes, "e2e.docx");
    let parsed: serde_json::Value =
        serde_json::from_str(&json_str).expect("Should return valid JSON");

    assert!(
        parsed.get("error").is_none() || parsed["error"].is_null(),
        "Should not have error field"
    );
    assert!(parsed["paragraphs"].is_array());
    assert_eq!(parsed["paragraphs"].as_array().unwrap().len(), 1);
}

#[test]
fn e2e_parse_docx_invalid_data_returns_error_json() {
    let json_str = crate::parse_docx(b"not a docx", "bad.docx");
    let parsed: serde_json::Value =
        serde_json::from_str(&json_str).expect("Should return valid JSON even on error");

    assert!(
        parsed.get("error").is_some(),
        "Should have error field: {}",
        json_str
    );
}

// ═══════════════════════════════════════════════════════════════════════
//  6. ParagraphStatus feature tests
// ═══════════════════════════════════════════════════════════════════════

#[test]
fn test_wholly_inserted_paragraph() {
    // A paragraph where ALL text is inside <w:ins> — should be WhollyInserted
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:ins w:id="1" w:author="Alice" w:date="2024-06-01T00:00:00Z">
                <w:r><w:t>Brand new paragraph added by Alice</w:t></w:r>
            </w:ins>
        </w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "inserted.docx").expect("Should parse");
    assert_eq!(result.paragraphs.len(), 1);

    let para = &result.paragraphs[0];
    assert_eq!(
        para.paragraph_status,
        ParagraphStatus::WhollyInserted,
        "Paragraph with only inserted text should be WhollyInserted"
    );
    assert_eq!(
        para.paragraph_change_author.as_deref(),
        Some("Alice"),
        "Author of the wholesale insertion should be Alice"
    );
}

#[test]
fn test_wholly_deleted_paragraph() {
    // A paragraph where ALL text is inside <w:del> — should be WhollyDeleted
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:del w:id="1" w:author="Bob" w:date="2024-07-15T09:00:00Z">
                <w:r><w:delText>This entire paragraph was removed by Bob</w:delText></w:r>
            </w:del>
        </w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "deleted.docx").expect("Should parse");
    assert_eq!(result.paragraphs.len(), 1);

    let para = &result.paragraphs[0];
    assert_eq!(
        para.paragraph_status,
        ParagraphStatus::WhollyDeleted,
        "Paragraph with only deleted text should be WhollyDeleted"
    );
    assert_eq!(
        para.paragraph_change_author.as_deref(),
        Some("Bob"),
        "Author of the wholesale deletion should be Bob"
    );
}

#[test]
fn test_normal_paragraph_with_mixed_changes() {
    // Paragraph has stable text plus an insertion — should be Normal
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:r><w:t>Existing stable text</w:t></w:r>
            <w:ins w:id="1" w:author="Carol" w:date="2024-08-01T00:00:00Z">
                <w:r><w:t> with additions</w:t></w:r>
            </w:ins>
        </w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "mixed.docx").expect("Should parse");
    assert_eq!(result.paragraphs.len(), 1);

    let para = &result.paragraphs[0];
    assert_eq!(
        para.paragraph_status,
        ParagraphStatus::Normal,
        "Paragraph with stable text plus insertions should be Normal"
    );
    assert!(
        para.paragraph_change_author.is_none(),
        "Normal paragraphs should not have a paragraph_change_author"
    );
}

#[test]
fn test_normal_paragraph_no_changes() {
    // Plain paragraph with no track changes at all — should be Normal
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:r><w:t>A plain paragraph with no track changes whatsoever.</w:t></w:r>
        </w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "plain.docx").expect("Should parse");
    assert_eq!(result.paragraphs.len(), 1);

    let para = &result.paragraphs[0];
    assert_eq!(
        para.paragraph_status,
        ParagraphStatus::Normal,
        "Plain paragraph should be Normal"
    );
    assert!(
        para.paragraph_change_author.is_none(),
        "Plain paragraph should not have a paragraph_change_author"
    );
    assert!(
        para.track_changes.is_empty(),
        "No track changes expected in a plain paragraph"
    );
}

#[test]
fn test_revised_text_field_populated() {
    // Verify that revised_text is correctly populated for paragraphs with changes.
    // With trim_text(true), "Hello " → "Hello", "cruel " → "cruel", "beautiful " → "beautiful"
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:r><w:t>Hello </w:t></w:r>
            <w:del w:id="1" w:author="Bob" w:date="2024-05-01T00:00:00Z">
                <w:r><w:delText>cruel </w:delText></w:r>
            </w:del>
            <w:ins w:id="2" w:author="Alice" w:date="2024-05-02T00:00:00Z">
                <w:r><w:t>beautiful </w:t></w:r>
            </w:ins>
            <w:r><w:t>world</w:t></w:r>
        </w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "revised.docx").expect("Should parse");
    assert_eq!(result.paragraphs.len(), 1);

    let para = &result.paragraphs[0];
    // base_text = Stable + Deletion = "Hello" + "cruel" + "world" = "Hellocruelworld"
    assert_eq!(para.base_text, "Hellocruelworld");
    // revised_text = Stable + Insertion = "Hello" + "beautiful" + "world" = "Hellobeautifulworld"
    assert_eq!(para.revised_text, "Hellobeautifulworld");
    assert_eq!(para.paragraph_status, ParagraphStatus::Normal);
}

#[test]
fn test_wholly_inserted_base_text_empty() {
    // For a wholly inserted paragraph, base_text should be empty (insertions
    // are excluded from base) and revised_text should contain the content.
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:ins w:id="10" w:author="Diana" w:date="2024-09-01T00:00:00Z">
                <w:r><w:t>Completely new content from Diana</w:t></w:r>
            </w:ins>
        </w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "ins_base.docx").expect("Should parse");
    assert_eq!(result.paragraphs.len(), 1);

    let para = &result.paragraphs[0];
    assert_eq!(
        para.base_text, "",
        "Wholly inserted paragraph should have empty base_text"
    );
    assert_eq!(
        para.revised_text, "Completely new content from Diana",
        "Wholly inserted paragraph revised_text should contain the inserted text"
    );
    assert_eq!(para.paragraph_status, ParagraphStatus::WhollyInserted);
    assert_eq!(para.paragraph_change_author.as_deref(), Some("Diana"));
}

#[test]
fn test_wholly_deleted_revised_text_empty() {
    // For a wholly deleted paragraph, revised_text should be empty (deletions
    // are excluded from revised) and base_text should contain the content.
    let doc_xml = minimal_document_xml(
        r#"<w:p>
            <w:del w:id="20" w:author="Eve" w:date="2024-10-01T00:00:00Z">
                <w:r><w:delText>Old content that Eve removed entirely</w:delText></w:r>
            </w:del>
        </w:p>"#,
    );
    let bytes = create_docx_bytes(&[("word/document.xml", &doc_xml)]);

    let result = docx::parse(&bytes, "del_revised.docx").expect("Should parse");
    assert_eq!(result.paragraphs.len(), 1);

    let para = &result.paragraphs[0];
    assert_eq!(
        para.revised_text, "",
        "Wholly deleted paragraph should have empty revised_text"
    );
    assert_eq!(
        para.base_text, "Old content that Eve removed entirely",
        "Wholly deleted paragraph base_text should contain the deleted text"
    );
    assert_eq!(para.paragraph_status, ParagraphStatus::WhollyDeleted);
    assert_eq!(para.paragraph_change_author.as_deref(), Some("Eve"));
}
