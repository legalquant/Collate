import { useRef } from 'react';
import { Download, Upload, X, FileText, Code } from 'lucide-react';
import { useCollateStore } from '../hooks/useCollateStore';
import { generateHtmlReport } from '../lib/export-html';

interface ExportPanelProps {
  onClose: () => void;
}

export function ExportPanel({ onClose }: ExportPanelProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const store = useCollateStore();

  const handleExportJson = () => {
    const json = store.exportAsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collate-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const handleExportHtml = () => {
    const html = generateHtmlReport(store);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
    onClose();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      store.importFromJson(reader.result as string);
      onClose();
    };
    reader.readAsText(file);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal max-w-sm mx-4 p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3>Export / Import</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleExportHtml}
            className="card card-interactive w-full flex items-center gap-3 p-4 text-left"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-bg)' }}>
              <FileText className="w-4.5 h-4.5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>HTML Report</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Printable report in a new tab</p>
            </div>
          </button>

          <button
            onClick={handleExportJson}
            className="card card-interactive w-full flex items-center gap-3 p-4 text-left"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--green-bg)' }}>
              <Code className="w-4.5 h-4.5" style={{ color: 'var(--green)' }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>JSON Export</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Full project state — re-importable</p>
            </div>
          </button>

          <div className="h-px my-2" style={{ background: 'var(--border)' }} />

          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportJson} />
          <button
            onClick={() => importRef.current?.click()}
            className="card card-interactive w-full flex items-center gap-3 p-4 text-left"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--amber-bg)' }}>
              <Upload className="w-4.5 h-4.5" style={{ color: 'var(--amber)' }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Import JSON</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Resume a previous session</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
