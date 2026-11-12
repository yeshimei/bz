declare const __BZ_USAGE_URL__: string;
declare const __BZ_USAGE_PROJECT__: string;

/** 服务端根地址（Appwrite 的区域端点，例如 https://sgp.cloud.appwrite.io/v1） */
export const USAGE_BASE_URL = typeof __BZ_USAGE_URL__ === 'string' ? __BZ_USAGE_URL__ : '';

/** Appwrite 的 Project ID（写进请求头，不是密钥） */
export const USAGE_PROJECT = typeof __BZ_USAGE_PROJECT__ === 'string' ? __BZ_USAGE_PROJECT__ : '';

/** 数据库与集合 id（与服务器上建好的一致） */
export const USAGE_DB = 'bz_usage';

export function usageConfigured(): boolean {
  // 允许带路径（Appwrite 的区域端点是 /v1 结尾），只挡明显不像 URL 的值
  return (
    /^https?:\/\/[a-z0-9.\-:[/\]]+$/i.test(USAGE_BASE_URL.trim()) &&
    /^[a-z0-9]{6,40}$/i.test(USAGE_PROJECT.trim())
  );
}
