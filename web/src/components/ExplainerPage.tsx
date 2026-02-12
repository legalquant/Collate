import { FileUpload } from './FileUpload';
import {
  Shield,
  Upload,
  Eye,
  CheckSquare,
  AlertTriangle,
  Github,
  ArrowRight,
  User,
  FileEdit,
  Scale,
  Brain,
  Info,
} from 'lucide-react';
import { useRef } from 'react';

export function ExplainerPage() {
  const uploadRef = useRef<HTMLDivElement>(null);

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ background: 'var(--bg-main)' }}>

      {/* ─── Hero ────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div
            className="badge badge-accent"
            style={{ marginBottom: 24, padding: '5px 16px', fontSize: '0.75rem' }}
          >
            <Shield className="w-3.5 h-3.5" />
            100% client-side · Nothing leaves your browser
          </div>

          <h1
            style={{
              fontSize: '2.75rem',
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            See every comment<br />in one place.
          </h1>

          <p
            style={{
              fontSize: '1.125rem',
              lineHeight: 1.7,
              color: 'var(--text-muted)',
              maxWidth: 520,
              margin: '0 auto 32px',
            }}
          >
            Drop in your marked-up drafts. See all feedback — track changes, comments, phone notes —
            collated by paragraph with a resolution checklist. You decide what to accept.
            You make the edits yourself.
          </p>

          <button onClick={scrollToUpload} className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '1rem' }}>
            <Upload className="w-5 h-5" />
            Start Collating
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ─── Status banner ───────────────────────────────────────── */}
      <section style={{ padding: '0 24px 32px' }}>
        <div className="info-block info-block-blue" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0" style={{ marginTop: 2, color: '#1e40af' }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>Proof of concept — functional but untested</p>
              <p style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
                Built by a solo litigation lawyer using AI-assisted development, not by a software team.
                Includes 113 automated tests but has not been tested by users in practice.
                Use it to explore the concept — do not rely on it for live matters without testing it yourself first.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── The Problem ─────────────────────────────────────────── */}
      <section style={{ padding: '24px 24px 48px' }}>
        <div className="card" style={{ maxWidth: 720, margin: '0 auto', padding: '28px 32px' }}>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            You&rsquo;ve sent a draft to four reviewers. Counsel rewrites paragraph 12 with track
            changes. The partner leaves a comment bubble disagreeing. The client calls to say you
            can&rsquo;t mention the audit. Your junior emails three typo fixes.
          </p>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--text-secondary)', marginTop: 16 }}>
            You now have four documents, two emails, a phone note, and no single view of what needs
            doing. Word&rsquo;s Combine function mangles the formatting. You start a spreadsheet to
            track what you&rsquo;ve addressed. It&rsquo;s 7pm.
          </p>
        </div>
      </section>

      {/* ─── How It Works ────────────────────────────────────────── */}
      <section style={{ padding: '48px 24px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 36, fontSize: '1.5rem' }}>How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <StepCard
              icon={<Upload className="w-6 h-6" style={{ color: 'var(--accent)' }} />}
              title="Upload drafts"
              description="Drag and drop .docx files from different reviewers. Add phone notes and email comments manually. Multiple files supported."
            />
            <StepCard
              icon={<Eye className="w-6 h-6" style={{ color: 'var(--accent)' }} />}
              title="See everything"
              description="Track changes, comments, and manual notes — all in one view, organised by paragraph. Conflicts flagged automatically."
            />
            <StepCard
              icon={<CheckSquare className="w-6 h-6" style={{ color: 'var(--accent)' }} />}
              title="Check off items"
              description="Accept, reject, or defer each item. Add notes. Export when done. Nothing is missed."
            />
          </div>
        </div>
      </section>

      {/* ─── Upload Area ─────────────────────────────────────────── */}
      <section ref={uploadRef} style={{ padding: '48px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <FileUpload />
        </div>
      </section>

      {/* ─── Checklist philosophy ────────────────────────────────── */}
      <section style={{ padding: '48px 24px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 className="flex items-center gap-2.5" style={{ marginBottom: 20, fontSize: '1.375rem' }}>
            <User className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            A checklist, not an autopilot
          </h2>

          <div style={{ fontSize: '0.9375rem', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
            <p>
              Collate is deliberately not a redlining tool. It does not produce a merged document.
              It does not auto-accept changes. It does not generate a new .docx with everyone&rsquo;s
              edits baked in.
            </p>
            <p style={{ marginTop: 16 }}>
              This is a design choice, not a limitation.
            </p>
            <p style={{ marginTop: 16 }}>
              Automated document merging is fragile. Word&rsquo;s own Combine function routinely
              corrupts formatting, misaligns changes, and produces documents that look nothing like
              the original. Any tool that tries to programmatically reconstruct a .docx from parsed
              XML will face the same problems — and introduce new ones. In litigation, where a
              misplaced paragraph number or a broken cross-reference can undermine a filing,
              that risk is unacceptable.
            </p>
            <p style={{ marginTop: 16 }}>
              Collate gives you a
              {' '}<strong style={{ color: 'var(--text)' }}>complete, structured view</strong>{' '}
              of every piece of feedback from every reviewer, organised by paragraph, with a
              resolution checklist. You then open your master draft in Word and make the edits
              yourself — with the confidence that you have seen every item and recorded your decision on each.
            </p>
            <p style={{ marginTop: 16 }}>
              The human stays in the loop because the human is the one who understands the case,
              knows which reviewer&rsquo;s judgment to trust on a point of law, and takes
              responsibility for the final product.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginTop: 28 }}>
            <TrustPoint
              icon={<FileEdit className="w-4 h-4" />}
              title="You control the master"
              text="Every edit in the final document is one you chose to make, in Word, with full formatting control."
            />
            <TrustPoint
              icon={<CheckSquare className="w-4 h-4" />}
              title="Nothing is missed"
              text="The checklist ensures every comment, every change, every phone note is explicitly addressed."
            />
            <TrustPoint
              icon={<Scale className="w-4 h-4" />}
              title="Defensible process"
              text="Export a complete record of what you accepted, rejected, and why. An audit trail for the file."
            />
            <TrustPoint
              icon={<User className="w-4 h-4" />}
              title="Human judgment"
              text="You decide which reviewer to follow when they disagree. No algorithm makes that call."
            />
          </div>
        </div>
      </section>

      {/* ─── AI roadmap ──────────────────────────────────────────── */}
      <section style={{ padding: '48px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', border: '1px solid var(--accent)', borderRadius: 'var(--radius-xl)', padding: '28px 32px', background: 'var(--bg-card)' }}>
          <div className="flex items-start gap-3" style={{ marginBottom: 20 }}>
            <div
              style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Brain className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 2 }}>Coming next: structured AI analysis</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Planned feature — not yet implemented</p>
            </div>
          </div>

          <div style={{ fontSize: '0.9375rem', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
            <p>A future update will add optional AI analysis of the collated output:</p>
            <ul style={{ paddingLeft: 20, marginTop: 12, marginBottom: 16 }}>
              {[
                'Flag conflicts between reviewers — incompatible changes, contradictory comments',
                'Identify cross-document inconsistencies — does accepting a change here contradict something elsewhere?',
                'Highlight substantive issues — missing cross-references, undefined terms, unsupported claims',
                'Suggest drafting improvements — document-type-aware, not generic text generation',
              ].map((item, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <span style={{ color: 'var(--accent)', marginRight: 4 }}>&rarr;</span> {item}
                </li>
              ))}
            </ul>
            <p>
              AI analysis will be <strong style={{ color: 'var(--text)' }}>advisory, not executive</strong>.
              Suggestions appear alongside the checklist for you to consider. The final document is always yours.
              Every word in it is one you chose to write.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Privacy ─────────────────────────────────────────────── */}
      <section style={{ padding: '24px 24px 48px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--accent-bg)', border: '1px solid #99f6e4', borderRadius: 'var(--radius-xl)', padding: '24px 28px' }}>
          <h3 className="flex items-center gap-2" style={{ marginBottom: 12, fontSize: '1rem', color: 'var(--accent-hover)' }}>
            <Shield className="w-4 h-4" />
            Privacy
          </h3>
          <div style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: '#115e59' }}>
            <p>
              Collate processes your documents entirely in your browser. No file is uploaded to any
              server. No data is transmitted anywhere. The parsing engine is compiled to WebAssembly
              and runs locally.
            </p>
            <p style={{ marginTop: 12 }}>
              A Content Security Policy header structurally prevents outbound requests.
              This is not a promise — it is an architectural constraint enforced by the browser itself.
            </p>
          </div>
        </div>
      </section>

      {/* ─── How this was built ──────────────────────────────────── */}
      <section style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 12 }}>How this was built</h2>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--text-muted)' }}>
            Built in approximately 90 minutes by a practising UK litigator using AI-assisted
            development with Cursor and Claude. Rust + WebAssembly parsing engine. React interface.
            113 automated tests. The person who understands the problem is the person who builds the solution.
          </p>
          <div className="flex items-center justify-center gap-4" style={{ marginTop: 20 }}>
            <a href="https://github.com/legalquant/Collate" target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
              <Github className="w-3.5 h-3.5" />
              Source Code
            </a>
            <a href="https://collate.law" target="_blank" rel="noopener" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--accent)' }}>
              collate.law
            </a>
          </div>
          <p style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-light)' }}>
            Built by <a href="https://twitter.com/anonlq" style={{ textDecoration: 'underline', color: 'var(--text-light)' }} target="_blank" rel="noopener">@anonlq</a>
          </p>
        </div>
      </section>

      {/* ─── Limitations ─────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 48px' }}>
        <div className="info-block info-block-amber" style={{ maxWidth: 720, margin: '0 auto' }}>
          <h3 className="flex items-center gap-2" style={{ marginBottom: 8, fontSize: '0.875rem', color: '#92400e' }}>
            <AlertTriangle className="w-4 h-4" />
            Limitations
          </h3>
          <ul style={{ paddingLeft: 18, fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.8 }}>
            <li>Large documents (500+ pages) may be slow to parse</li>
            <li>Complex nested track changes may not render perfectly</li>
            <li>Only .docx format (not .doc or PDF)</li>
            <li>Approximate paragraph matching across reviewer versions</li>
            <li>Single-user tool — no real-time collaboration</li>
            <li>Does not produce a merged output document — you edit the master in Word</li>
          </ul>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer style={{ padding: '24px 24px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-light)', borderTop: '1px solid var(--border)' }}>
        Collate — all processing performed locally in your browser. No data leaves this device.
      </footer>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function StepCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        {icon}
      </div>
      <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</h4>
      <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>{description}</p>
    </div>
  );
}

function TrustPoint({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3" style={{ padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-main)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>{text}</p>
      </div>
    </div>
  );
}
