export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://nottepe.com/api';

export const API_BASE = API_URL.replace(/\/api\/?$/, '');

export function getFileUrl(filePath?: string | null): string {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  const normalized = filePath.startsWith('/uploads') ? filePath : `/uploads/${filePath.replace(/^\//, '')}`;
  return `${API_BASE}${normalized}`;
}
