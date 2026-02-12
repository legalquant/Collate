import { FileUpload } from './FileUpload';
import { PrivacyBadge } from './PrivacyBadge';
import {
  Shield,
  Upload,
  Eye,
  CheckSquare,
  AlertTriangle,
  Github,
  ArrowRight,
  User,
  Sparkles,
  FileEdit,
  Scale,
  Brain,
} from 'lucide-react';
import { useCollateStore } from '../hooks/useCollateStore';
import { useRef } from 'react';

export function ExplainerPage() {
  const { documents } = useCollateStore();
  const uploadRef = useRef<HTMLDivElement>(null);

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <PrivacyBadge />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
        >
          <Shield className="w-3.5 h-3.5" />
          100% client-side · Nothing leaves your browser
        </div>

        <h1
          className="text-4xl font-bold mb-4"
          style={{ color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}
        >
          See every comment<br />in one place.
        </h1>

        <p
          className="text-base max-w-xl mx-auto leading-relaxed mb-8"
          style={{ color: 'var(--text-muted)' }}
        >
          Drop in your marked-up drafts. See all feedback — track changes, comments, phone notes —
          collated by paragraph with a resolution checklist. You decide what to accept.
          You make the edits yourself.
        </p>

        <button onClick={scrollToUpload} className="btn btn-primary" style={{ padding: '0.625rem 1.5rem' }}>
          <Upload className="w-4 h-4" />
          Start Collating
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* The Problem */}
      <section className="max-w-2xl mx-auto px-6 py-8">
        <div className="card p-6" style={{ background: 'var(--bg-card)' }}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            You&rsquo;ve sent a draft to four reviewers. Counsel rewrites paragraph 12 with track
            changes. The partner leaves a comment bubble disagreeing. The client calls to say you
            can&rsquo;t mention the audit. Your junior emails three typo fixes.
          </p>
          <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--text-secondary)' }}>
            You now have four documents, two emails, a phone note, and no single view of what needs
            doing. Word&rsquo;s Combine function mangles the formatting. You start a spreadsheet to
            track what you&rsquo;ve addressed. It&rsquo;s 7pm.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="text-center mb-8" style={{ color: 'var(--text)' }}>How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <StepCard
            icon={<Upload className="w-5 h-5" style={{ color: 'var(--accent)' }} />}
            title="Upload drafts"
            description="Drag and drop .docx files from different reviewers. Add phone notes and email comments manually. Multiple files supported."
          />
          <StepCard
            icon={<Eye className="w-5 h-5" style={{ color: 'var(--accent)' }} />}
            title="See everything"
            description="Track changes, comments, and manual notes — all in one view, organised by paragraph. Conflicts flagged automatically."
          />
          <StepCard
            icon={<CheckSquare className="w-5 h-5" style={{ color: 'var(--accent)' }} />}
            title="Check off items"
            description="Accept, reject, or defer each item. Add notes. Export when done. Nothing is missed."
          />
        </div>
      </section>

      {/* Upload Area */}
      <section ref={uploadRef} className="max-w-3xl mx-auto px-6 py-12">
        <FileUpload />
      </section>

      {/* ─── Why a checklist, not automation ─────────────────────── */}
      <section className="max-w-2xl mx-auto px-6 py-8">
        <div className="card p-6" style={{ background: 'var(--bg-card)' }}>
          <h2 className="flex items-center gap-2 mb-4" style={{ color: 'var(--text)' }}>
            <User className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            A checklist, not an autopilot
          </h2>

          <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <p>
              Collate is deliberately not a redlining tool. It does not produce a merged document.
              It does not auto-accept changes. It does not generate a new .docx with everyone&rsquo;s
              edits baked in.
            </p>
            <p>
              This is a design choice, not a limitation.
            </p>
            <p>
              Automated document merging is fragile. Word&rsquo;s own Combine function routinely
              corrupts formatting, misaligns changes, and produces documents that look nothing like
              the original. Any tool that tries to programmatically reconstruct a .docx from parsed
              XML will face the same problems — and introduce new ones. In litigation, where a
              misplaced paragraph number or a broken cross-reference can undermine a filing,
              that risk is unacceptable.
            </p>
            <p>
              Collate takes a different approach. It gives you a
              {' '}<strong style={{ color: 'var(--text)' }}>complete, structured view</strong>{' '}
              of every piece of feedback from every reviewer, organised by paragraph, with a
              resolution checklist. You then open your master draft in Word and make the edits
              yourself — accepting changes, incorporating comments, resolving conflicts —
              with the confidence that you have seen every item and recorded your decision on each.
            </p>
            <p>
              The human stays in the loop because the human is the one who understands the case,
              knows which reviewer&rsquo;s judgment to trust on a point of law, and takes
              responsibility for the final product. Collate ensures you don&rsquo;t miss anything.
              It doesn&rsquo;t pretend to make decisions for you.
            </p>
          </div>

          {/* Key trust points */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* ─── Roadmap: AI analysis ──────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-6 py-8">
        <div className="card p-6" style={{ borderColor: 'var(--accent)', borderWidth: 1, background: 'var(--bg-card)' }}>
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'var(--accent-bg)' }}
            >
              <Brain className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ color: 'var(--text)' }}>
                Coming next: structured AI analysis
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-light)' }}>
                Planned feature — not yet implemented
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <p>
              A future update will add optional AI analysis of the collated output. Once you have
              uploaded your reviewer documents and Collate has built the unified view, you will be
              able to run a structured analysis that:
            </p>

            <ul className="space-y-2 ml-1">
              <RoadmapItem text="Flags conflicts between reviewers — where two people have made incompatible changes to the same paragraph, or where a comment contradicts a track change" />
              <RoadmapItem text="Identifies inconsistencies across the document — if you accept a change in paragraph 12, does it create a contradiction with paragraph 38?" />
              <RoadmapItem text="Highlights substantive issues — missing cross-references, undefined terms, factual claims that appear unsupported" />
              <RoadmapItem text="Suggests drafting improvements — based on the type of document and the reviewer feedback, not generic text generation" />
            </ul>

            <p>
              Critically, AI analysis will be{' '}
              <strong style={{ color: 'var(--text)' }}>advisory, not executive</strong>.
              The output will appear as suggestions alongside the existing checklist — flagged items
              for you to consider, not changes applied to your document. You review each suggestion,
              accept or dismiss it, and make the edit yourself.
            </p>

            <p>
              This matters. Court-facing documents are filed under a statement of truth or a
              solicitor&rsquo;s certificate. They go in front of judges who expect precision. They
              have deadlines measured in hours. In this context, a tool that silently introduces AI
              edits is not a productivity gain — it is a liability. A wrong citation, an overstated
              factual claim, a submission that contradicts your own disclosure: these are
              career-defining errors in litigation, and they are exactly the kind of error that
              current AI models can produce with total confidence.
            </p>

            <p>
              Collate&rsquo;s approach keeps you in control. The tool handles the mechanical problem
              — collating feedback from multiple sources into one view so nothing is missed. AI
              analysis, when it arrives, will handle the analytical problem — spotting patterns and
              issues across a complex document that a tired associate at 9pm might miss. But the
              final document is always yours. Every word in it is one you chose to write.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="max-w-2xl mx-auto px-6 py-8">
        <div className="info-block" style={{ background: 'var(--accent-bg)', border: '1px solid #99f6e4' }}>
          <h3 className="flex items-center gap-2 mb-3 text-base" style={{ color: 'var(--accent-hover)' }}>
            <Shield className="w-4 h-4" />
            Privacy
          </h3>
          <div className="space-y-2 text-sm" style={{ color: '#115e59' }}>
            <p>
              Collate processes your documents entirely in your browser. No file is uploaded to any
              server. No data is transmitted anywhere. The parsing engine is compiled to WebAssembly
              and runs locally.
            </p>
            <p>
              You can verify this: disconnect from the internet and the tool still works. A Content
              Security Policy header structurally prevents outbound requests. This is not a
              promise — it is an architectural constraint enforced by the browser itself.
            </p>
            <p>
              When AI analysis is added in a future update, any use of external AI services will
              require explicit opt-in, with clear disclosure of what data is sent and to whom.
              The local-first, no-network default will remain.
            </p>
          </div>
        </div>
      </section>

      {/* Built With */}
      <section className="max-w-2xl mx-auto px-6 py-8 text-center">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          A working proof of concept built by a practising UK litigator.
          Rust + WebAssembly parsing engine. React interface.
          Built using AI-assisted development with Cursor and Claude.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <a
            href="https://github.com/legalquant/Collate"
            target="_blank"
            rel="noopener"
            className="btn btn-ghost btn-sm"
          >
            <Github className="w-3.5 h-3.5" />
            Source Code
          </a>
          <a
            href="https://collate.law"
            target="_blank"
            rel="noopener"
            className="text-sm font-medium"
            style={{ color: 'var(--accent)' }}
          >
            collate.law
          </a>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-light)' }}>
          Built by{' '}
          <a href="https://twitter.com/anonlq" className="underline" target="_blank" rel="noopener">
            @anonlq
          </a>
        </p>
      </section>

      {/* Limitations */}
      <section className="max-w-2xl mx-auto px-6 py-8">
        <div className="info-block info-block-amber">
          <h3 className="flex items-center gap-2 mb-2 text-sm font-semibold" style={{ color: '#92400e' }}>
            <AlertTriangle className="w-4 h-4" />
            Limitations
          </h3>
          <ul className="space-y-1 text-xs" style={{ color: '#92400e' }}>
            <li>→ Large documents (500+ pages) may be slow to parse</li>
            <li>→ Complex nested track changes may not render perfectly</li>
            <li>→ Only .docx format (not .doc or PDF)</li>
            <li>→ Approximate paragraph matching across reviewer versions</li>
            <li>→ Single-user tool — no real-time collaboration</li>
            <li>→ Does not produce a merged output document — you edit the master in Word</li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="max-w-2xl mx-auto px-6 py-6 text-center text-xs"
        style={{ color: 'var(--text-light)', borderTop: '1px solid var(--border)' }}
      >
        Collate — all processing performed locally in your browser. No data leaves this device.
      </footer>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function StepCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card text-center p-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--accent-bg)' }}>
        {icon}
      </div>
      <h4 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{title}</h4>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{description}</p>
    </div>
  );
}

function TrustPoint({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'var(--bg-main)' }}>
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text)' }}>{title}</p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{text}</p>
      </div>
    </div>
  );
}

function RoadmapItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span style={{ color: 'var(--accent)' }} className="shrink-0 mt-0.5">→</span>
      <span>{text}</span>
    </li>
  );
}
