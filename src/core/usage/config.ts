declare const __BZ_USAGE_URL__: string;
declare const __BZ_USAGE_KEY__: string;

export const USAGE_BASE_URL = typeof __BZ_USAGE_URL__ === 'string' ? __BZ_USAGE_URL__ : '';

export const USAGE_API_KEY = typeof __BZ_USAGE_KEY__ === 'string' ? __BZ_USAGE_KEY__ : '';

export function usageConfigured(): boolean {
  return /^https:\/\/[a-z0-9.-]+$/i.test(USAGE_BASE_URL.trim()) && USAGE_API_KEY.trim().length >= 20;
}
