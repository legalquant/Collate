use std::io::Read;

use zip::ZipArchive;

use crate::comments;
use crate::matcher;
use crate::paragraphs;
use crate::types::CollateResult;

/// Parse a .docx file from raw bytes
pub fn parse(data: &[u8], file_name: &str) -> Result<CollateResult, String> {
    let cursor = std::io::Cursor::new(data);
    let mut archive =
        ZipArchive::new(cursor).map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

    // Read document.xml (required)
    let document_xml = read_zip_file(&mut archive, "word/document.xml")
        .ok_or_else(|| "word/document.xml not found — is this a valid .docx file?".to_string())?;

    // Read comments.xml (optional)
    let comments_xml = read_zip_file(&mut archive, "word/comments.xml");

    // Read core.xml for document title (optional)
    let core_xml = read_zip_file(&mut archive, "docProps/core.xml");

    // Parse comments
    let comments_map = match &comments_xml {
        Some(xml) => comments::parse_comments(xml),
        None => std::collections::HashMap::new(),
    };

    // Parse document paragraphs
    let parsed_paragraphs = paragraphs::parse_document(&document_xml);

    // Build paragraph blocks with matched comments
    let (paragraph_blocks, reviewers) =
        matcher::build_paragraph_blocks(&parsed_paragraphs, &comments_map, file_name);

    // Extract document title
    let document_title = core_xml.and_then(|xml| extract_title(&xml));

    Ok(CollateResult {
        paragraphs: paragraph_blocks,
        reviewers,
        document_title,
        error: None,
    })
}

fn read_zip_file(archive: &mut ZipArchive<std::io::Cursor<&[u8]>>, path: &str) -> Option<String> {
    let mut file = archive.by_name(path).ok()?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).ok()?;
    Some(contents)
}

fn extract_title(core_xml: &str) -> Option<String> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(core_xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut in_title = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);
                if local == b"title" {
                    in_title = true;
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_title {
                    if let Ok(txt) = e.unescape() {
                        let title = txt.trim().to_string();
                        if !title.is_empty() {
                            return Some(title);
                        }
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = e.name();
                let name_ref = name.as_ref();
                let local = local_name(name_ref);
                if local == b"title" {
                    in_title = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    None
}

fn local_name(name: &[u8]) -> &[u8] {
    if let Some(pos) = name.iter().position(|&b| b == b':') {
        &name[pos + 1..]
    } else {
        name
    }
}
