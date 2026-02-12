use wasm_bindgen::prelude::*;

mod comments;
mod docx;
mod matcher;
mod paragraphs;
mod track_changes;
pub mod types;

#[cfg(test)]
mod tests;

/// Parse a .docx file and return a JSON string containing the CollateResult.
/// This is the single public API — takes raw file bytes and filename, returns everything.
#[wasm_bindgen]
pub fn parse_docx(data: &[u8], file_name: &str) -> String {
    match docx::parse(data, file_name) {
        Ok(result) => serde_json::to_string(&result).unwrap_or_else(|e| {
            format!(r#"{{"error":"Serialization failed: {}"}}"#, e)
        }),
        Err(e) => {
            let escaped = e.replace('\\', "\\\\").replace('"', "\\\"");
            format!(r#"{{"error":"{}"}}"#, escaped)
        }
    }
}
