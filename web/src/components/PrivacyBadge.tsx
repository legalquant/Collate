import { useState } from 'react';
import { Shield, X } from 'lucide-react';

export function PrivacyBadge() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-50 badge badge-accent flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-all no-print"
        style={{ fontSize: '0.6875rem', boxShadow: 'var(--shadow)' }}
      >
        <Shield className="w-3 h-3" />
        Offline · Private
      </button>

      {expanded && (
        <div className="overlay no-print" onClick={() => setExpanded(false)}>
          <div className="modal max-w-lg mx-4 p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                <Shield className="w-5 h-5" />
                <span className="font-semibold">Privacy Guarantee</span>
              </h3>
              <button onClick={() => setExpanded(false)} className="btn btn-ghost btn-sm p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <p>
                Collate processes your documents entirely in your browser. No file is uploaded to any
                server. No data is transmitted anywhere.
              </p>
              <p>
                The parsing engine is compiled to WebAssembly and runs locally. You can verify this:
                disconnect from the internet and the tool still works.
              </p>
              <p>
                A Content Security Policy header structurally prevents the browser from making any
                outbound data requests, even if the code tried to.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
