import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useCollateStore } from '../hooks/useCollateStore';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSearchQuery } = useCollateStore();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchQuery(query);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, setSearchQuery]);

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-light)' }} />
      <input
        ref={inputRef}
        id="search-input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search paragraphs… (Ctrl+K)"
        className="input input-sm pl-8 pr-8"
        style={{ width: 260 }}
      />
      {query && (
        <button
          onClick={() => { setQuery(''); inputRef.current?.focus(); }}
          className="absolute right-2 p-0.5 rounded"
          style={{ color: 'var(--text-light)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
