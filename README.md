# Collate

**See every comment in one place.**

A browser-based tool for litigation lawyers that collates comments, track changes, and external feedback from multiple reviewers of a legal document draft into a single actionable view with a resolution checklist.

Collate is a checklist compilation tool, not an automated redlining tool. It does not produce a merged document. It does not auto-accept changes. The lawyer reviews every item, makes every decision, and edits the master document themselves. This is a design choice — automated document merging is fragile and unacceptable for court-facing work where formatting errors and missed changes have real consequences.

Everything runs client-side. No file ever leaves your browser. The parsing engine is Rust compiled to WebAssembly. The UI is React. A Content Security Policy header structurally prevents outbound network requests.

**Live:** [collate.law](https://collate.law)

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
- [Node.js](https://nodejs.org/) (v18+)

### Build & Run

```bash
# 1. Build the WASM module
cd crates/collate-core
wasm-pack build --target web --out-dir ../../web/src/wasm-pkg

# 2. Install dependencies and start dev server
cd ../../web
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Production Build

```bash
cd web
npm run build
```

### Desktop Launch

On Windows, double-click `collate.bat` to build (if needed), kill any previous instances, start the server, and open the browser.

### Tests

```bash
# Rust tests (47 tests)
cd crates/collate-core
cargo test

# Frontend tests (66 tests)
cd web
npm test
```

## Architecture

```
collate/
├── crates/collate-core/     # Rust — DOCX parsing engine (WASM)
│   └── src/
│       ├── lib.rs           # WASM entry point
│       ├── docx.rs          # ZIP extraction
│       ├── comments.rs      # Parse comments.xml
│       ├── track_changes.rs # Parse track changes
│       ├── paragraphs.rs    # Walk document structure
│       ├── matcher.rs       # Connect comments to paragraphs
│       ├── types.rs         # Shared types
│       └── tests.rs         # 47 integration tests
├── web/                     # React frontend
│   └── src/
│       ├── wasm.ts          # WASM bridge + types
│       ├── hooks/           # Zustand store with session recovery
│       ├── components/      # UI components
│       ├── lib/             # Export utilities
│       └── __tests__/       # 66 Vitest tests
├── tests/
│   ├── generate-fixtures.mjs # Generates 8 test .docx files
│   └── fixtures/            # Generated test documents
├── collate.bat              # Windows launch script
└── README.md
```

## Features

- **Track changes** — inline diff view with deletions (red strikethrough) and insertions (green underline), grouped by reviewer
- **Comments** — comment text with anchor text highlighting, author attribution, date
- **Wholesale changes** — entire paragraphs inserted or deleted by a reviewer are flagged with dedicated badges and accept/reject controls
- **Manual comments** — add feedback from phone calls, emails, Teams, WhatsApp, conferences
- **Multi-document merging** — upload multiple reviewer versions, matched by paragraph similarity
- **Resolution checklist** — accept, reject, or defer every item with notes
- **Incremental review** — new items from later documents are flagged so existing progress is preserved
- **Bulk actions** — accept/reject all items in a paragraph or across the document
- **Search** — filter paragraphs by text, author, or content (Ctrl+K)
- **Export** — HTML report (printable) and JSON (re-importable)
- **Session recovery** — auto-saves every 30 seconds; resume after crash or browser close
- **Privacy** — CSP-enforced, no network calls, works offline

## Privacy

Collate processes documents entirely in the browser. A Content Security Policy header structurally prevents outbound network requests. Disconnect from the internet — it still works. This is not a promise. It is an architectural constraint enforced by the browser itself.

## Session Continuity

Your work is preserved across sessions:

- **Resolution statuses**, manual comments, and reviewer colours are saved to localStorage on every action
- **Full session snapshots** (including the merged paragraph view) are auto-saved every 30 seconds and on browser close
- If you close the browser or it crashes, a **"Resume previous session?"** prompt appears on next launch with the timestamp and document count
- You can resume immediately — the full checklist view is restored without re-uploading documents
- Export to JSON at any time for a permanent backup that can be re-imported

## Limitations

- Large documents (500+ pages) may be slow to parse
- Complex nested track changes may not render perfectly
- Only .docx format (not .doc or PDF)
- Approximate paragraph matching across reviewer versions
- Single-user tool — no real-time collaboration
- Does not produce a merged output document — you edit the master in Word

## Author

[@anonlq](https://twitter.com/anonlq)

[collate.law](https://collate.law) · [Source](https://github.com/legalquant/Collate)

## License

MIT
