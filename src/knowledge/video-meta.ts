/**
 * 视频录入元信息抓取（issue 278 / ADR-0122 拍板要点 5）：
 * 输入框防抖解析的三级降级——B 站 view API（title/owner.name）→ 页面 <title> 清洗 → 静默 null。
 * 净化单源 = normalizeSourceUrl（source.ts），本模块只抓不落库；全程零 notice（调用方拿不到就什么都不回填）。
 * 已知限制：b23.tv 短链拿不到重定向目标（requestUrl 响应无 url 字段），只抓标题、UP主 留空——
 * 下载阶段 CLI 的 [bz-info] 会按「只补空」补齐（processor.ts 同口径）。
 */
import { requestUrl } from 'obsidian';
import { fetchPageTitle } from '../core/utils';
import { cleanSourceTitle, isUrlLikeSourceText } from './source';

/** view API 的 bvid 判据：统一 10 位（仓内另有 {8,12} 展示用与 CLI {10} 写法，本模块为唯一解析口径） */
const BVID_RE = /BV[0-9A-Za-z]{10}/;

/** 从完整链接或裸 BV 号提取 bvid；无匹配返回 null */
export function parseBvid(input: string): string | null {
  const m = String(input ?? '').match(BVID_RE);
  return m ? m[0] : null;
}

/** 抓到的视频元信息（缺项缺省——调用方只补空字段） */
export interface VideoMeta {
  title?: string;
  uploader?: string;
}

const VIEW_TIMEOUT_MS = 10000;

/** B 站 view API：10s 超时（Promise.race，范式随 clipbook fetchRssFeedTitle）；非 2xx/code!==0/异常 → null */
async function fetchFromViewApi(bvid: string): Promise<VideoMeta | null> {
  try {
    const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), VIEW_TIMEOUT_MS));
    const req = requestUrl({ url: `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, method: 'GET' }).then(
      (resp: any): VideoMeta | null => {
        if (!resp || resp.status < 200 || resp.status >= 300) return null;
        let json: any = null;
        try { json = JSON.parse(resp.text as string); } catch { return null; }
        if (!json || json.code !== 0 || !json.data) return null;
        const title = typeof json.data.title === 'string' ? json.data.title.trim() : '';
        const ownerName = json.data.owner && typeof json.data.owner.name === 'string' ? json.data.owner.name.trim() : '';
        const meta: VideoMeta = {};
        if (title) meta.title = title;
        if (ownerName) meta.uploader = ownerName;
        return title || ownerName ? meta : null;
      },
    );
    return await Promise.race([req, timer]);
  } catch {
    return null;
  }
}

/** 页面标题兜底（其他 http(s) 链接与 view API 失败共用）：fetchPageTitle + 剥站点尾巴；拿不到 → null */
async function fetchFromPageTitle(url: string): Promise<VideoMeta | null> {
  try {
    const raw = await fetchPageTitle(url);
    const title = raw ? cleanSourceTitle(raw) : '';
    return title ? { title } : null;
  } catch {
    return null;
  }
}

/**
 * 输入 → 元信息（静默三级降级）：
 * - B 站 video 链接 / 裸 BV 号 → view API，失败（含超时/风控）→ 页面标题兜底（仅输入本身是 http(s) 链接时有页面可抓，裸 BV 号到顶）；
 * - 其他 http(s) URL（含 b23.tv 短链）→ 只走标题兜底，uploader 留空；
 * - 非 URL 文本 → null，零网络请求。
 */
export async function fetchVideoMeta(input: string): Promise<VideoMeta | null> {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const bvid = parseBvid(text);
  if (bvid) {
    const viaApi = await fetchFromViewApi(bvid);
    if (viaApi) return viaApi;
    return /^https?:\/\//i.test(text) ? await fetchFromPageTitle(text) : null;
  }
  if (!isUrlLikeSourceText(text)) return null; // 非 URL 文本：不联网
  return await fetchFromPageTitle(/^https?:\/\//i.test(text) ? text : `https://${text}`);
}
