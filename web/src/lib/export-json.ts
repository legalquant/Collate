// JSON export/import is handled directly in the Zustand store
// This file exists as a placeholder for any future JSON export utilities

export function validateImportData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return 'version' in obj && typeof obj.version === 'number';
}
