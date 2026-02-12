use std::collections::HashMap;

use quick_xml::events::Event;
use quick_xml::Reader;

use crate::types::Comment;

/// Parse word/comments.xml and return a map of comment ID → Comment
pub fn parse_comments(xml: &str) -> HashMap<String, Comment> {
    let mut comments = HashMap::new();
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut current_comment: Option<Comment> = None;
    let mut in_comment = false;
    let mut text_buf = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);
                match local {
                    b"comment" => {
                        let mut id = String::new();
                        let mut author = String::new();
                        let mut date = None;
                        let mut initials = None;

                        for attr in e.attributes().flatten() {
                            let key = local_name(attr.key.as_ref());
                            let val = String::from_utf8_lossy(&attr.value).to_string();
                            match key {
                                b"id" => id = val,
                                b"author" => author = val,
                                b"date" => date = Some(val),
                                b"initials" => initials = Some(val),
                                _ => {}
                            }
                        }

                        current_comment = Some(Comment {
                            id,
                            author,
                            date,
                            text: String::new(),
                            anchor_text: String::new(),
                            initials,
                        });
                        in_comment = true;
                        text_buf.clear();
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_comment {
                    if let Ok(txt) = e.unescape() {
                        text_buf.push_str(&txt);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);
                if local == b"comment" {
                    if let Some(mut comment) = current_comment.take() {
                        comment.text = text_buf.trim().to_string();
                        comments.insert(comment.id.clone(), comment);
                    }
                    in_comment = false;
                    text_buf.clear();
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    comments
}

/// Extract local name from a potentially namespace-prefixed element name
/// e.g. b"w:comment" → b"comment", b"comment" → b"comment"
fn local_name(name: &[u8]) -> &[u8] {
    if let Some(pos) = name.iter().position(|&b| b == b':') {
        &name[pos + 1..]
    } else {
        name
    }
}
