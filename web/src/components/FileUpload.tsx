import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useCollateStore } from '../hooks/useCollateStore';

interface FileUploadProps {
  compact?: boolean;
}

export function FileUpload({ compact = false }: FileUploadProps) {
  const { addDocument, isLoading, loadingFile, error } = useCollateStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.docx')) {
          await addDocument(file);
        }
      }
    },
    [addDocument]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="btn btn-primary btn-sm"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {isLoading ? 'Parsing...' : 'Upload'}
        </button>
      </>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <input
        ref={inputRef}
        type="file"
        accept=".docx"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        className="card card-interactive p-10 text-center transition-all"
        style={{
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isDragOver ? 'var(--accent)' : 'var(--border)',
          background: isDragOver ? 'var(--accent-bg)' : 'var(--bg-card)',
          transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
          opacity: isLoading ? 0.6 : 1,
          cursor: isLoading ? 'default' : 'pointer',
        }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="font-medium" style={{ color: 'var(--text)' }}>Parsing {loadingFile}...</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Processing locally in your browser</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--accent-bg)' }}
            >
              <FileText className="w-7 h-7" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--text)' }}>
                Drop your marked-up .docx files here
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                or click to browse — multiple files supported
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="info-block info-block-red mt-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
