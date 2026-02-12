use std::collections::HashMap;

use quick_xml::events::Event;
use quick_xml::Reader;

use crate::track_changes::Segment;

/// Represents a parsed paragraph with its segments and comment anchors
pub struct ParsedParagraph {
    pub index: usize,
    pub segments: Vec<Segment>,
    pub comment_ids: Vec<String>,
    pub comment_anchor_texts: HashMap<String, String>,
}

/// Parse document.xml and extract all paragraphs with their track changes and comment anchors
pub fn parse_document(xml: &str) -> Vec<ParsedParagraph> {
    let mut paragraphs = Vec::new();
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut para_index: usize = 0;

    // Current paragraph state
    let mut in_paragraph = false;
    let mut segments: Vec<Segment> = Vec::new();
    let mut comment_ids: Vec<String> = Vec::new();
    let mut comment_anchor_texts: HashMap<String, String> = HashMap::new();

    // Track change state
    let mut in_ins = false;
    let mut in_del = false;
    let mut ins_id = String::new();
    let mut ins_author = String::new();
    let mut ins_date: Option<String> = None;
    let mut ins_text = String::new();
    let mut del_id = String::new();
    let mut del_author = String::new();
    let mut del_date: Option<String> = None;
    let mut del_text = String::new();

    // Comment anchor tracking
    let mut active_comment_ids: Vec<String> = Vec::new(); // Currently open comment ranges
    let mut comment_text_accum: HashMap<String, String> = HashMap::new(); // Accumulate text for each comment range

    // Nesting depth for paragraph
    let mut para_depth: usize = 0;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                match local {
                    b"p" if !in_paragraph => {
                        in_paragraph = true;
                        para_depth = 1;
                        segments.clear();
                        comment_ids.clear();
                        comment_anchor_texts.clear();
                    }
                    b"p" if in_paragraph => {
                        // Nested paragraph (e.g., inside a table cell's paragraph)
                        para_depth += 1;
                    }
                    b"ins" if in_paragraph => {
                        in_ins = true;
                        ins_text.clear();
                        ins_id = String::new();
                        ins_author = String::new();
                        ins_date = None;
                        for attr in e.attributes().flatten() {
                            let key = local_name(attr.key.as_ref());
                            let val = String::from_utf8_lossy(&attr.value).to_string();
                            match key {
                                b"id" => ins_id = val,
                                b"author" => ins_author = val,
                                b"date" => ins_date = Some(val),
                                _ => {}
                            }
                        }
                    }
                    b"del" if in_paragraph => {
                        in_del = true;
                        del_text.clear();
                        del_id = String::new();
                        del_author = String::new();
                        del_date = None;
                        for attr in e.attributes().flatten() {
                            let key = local_name(attr.key.as_ref());
                            let val = String::from_utf8_lossy(&attr.value).to_string();
                            match key {
                                b"id" => del_id = val,
                                b"author" => del_author = val,
                                b"date" => del_date = Some(val),
                                _ => {}
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                match local {
                    b"commentRangeStart" if in_paragraph => {
                        for attr in e.attributes().flatten() {
                            let key = local_name(attr.key.as_ref());
                            if key == b"id" {
                                let id = String::from_utf8_lossy(&attr.value).to_string();
                                comment_ids.push(id.clone());
                                active_comment_ids.push(id.clone());
                                comment_text_accum.insert(id, String::new());
                            }
                        }
                    }
                    b"commentRangeEnd" if in_paragraph => {
                        for attr in e.attributes().flatten() {
                            let key = local_name(attr.key.as_ref());
                            if key == b"id" {
                                let id = String::from_utf8_lossy(&attr.value).to_string();
                                active_comment_ids.retain(|cid| cid != &id);
                                if let Some(text) = comment_text_accum.remove(&id) {
                                    comment_anchor_texts.insert(id, text);
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_paragraph {
                    if let Ok(txt) = e.unescape() {
                        let text = txt.to_string();

                        // Accumulate text for any active comment ranges
                        for cid in &active_comment_ids {
                            if let Some(accum) = comment_text_accum.get_mut(cid) {
                                accum.push_str(&text);
                            }
                        }

                        if in_ins {
                            ins_text.push_str(&text);
                        } else if in_del {
                            del_text.push_str(&text);
                        } else {
                            // Stable text - merge consecutive stable segments
                            if let Some(Segment::Stable(ref mut s)) = segments.last_mut() {
                                s.push_str(&text);
                            } else {
                                segments.push(Segment::Stable(text));
                            }
                        }
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);

                match local {
                    b"p" if in_paragraph => {
                        para_depth -= 1;
                        if para_depth == 0 {
                            // End of paragraph — only add if it has content
                            let has_content = segments.iter().any(|s| match s {
                                Segment::Stable(t) => !t.trim().is_empty(),
                                Segment::Insertion { text, .. } => !text.trim().is_empty(),
                                Segment::Deletion { text, .. } => !text.trim().is_empty(),
                            });

                            if has_content {
                                paragraphs.push(ParsedParagraph {
                                    index: para_index,
                                    segments: segments.clone(),
                                    comment_ids: comment_ids.clone(),
                                    comment_anchor_texts: comment_anchor_texts.clone(),
                                });
                                para_index += 1;
                            }

                            in_paragraph = false;
                            segments.clear();
                            comment_ids.clear();
                            comment_anchor_texts.clear();
                        }
                    }
                    b"ins" if in_ins => {
                        if !ins_text.is_empty() {
                            segments.push(Segment::Insertion {
                                id: ins_id.clone(),
                                author: ins_author.clone(),
                                date: ins_date.clone(),
                                text: ins_text.clone(),
                            });
                        }
                        in_ins = false;
                    }
                    b"del" if in_del => {
                        if !del_text.is_empty() {
                            segments.push(Segment::Deletion {
                                id: del_id.clone(),
                                author: del_author.clone(),
                                date: del_date.clone(),
                                text: del_text.clone(),
                            });
                        }
                        in_del = false;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    paragraphs
}

/// Extract local name from a potentially namespace-prefixed element name
fn local_name(name: &[u8]) -> &[u8] {
    if let Some(pos) = name.iter().position(|&b| b == b':') {
        &name[pos + 1..]
    } else {
        name
    }
}
