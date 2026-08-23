/**
 * 域 JSON 感知（2026-08-23 用户拍板扩展）：CONFIG/STORAGE 下各域数据文件的新增条目 → 观察文本。
 * 独立模块供 index 调用 + 单测覆盖；extract 纯函数：prev 记录已见状态（首次快照不产出）。
 * ticket 075：memo 项移除——备忘录改走方法监听（notifyMemoAction），防 JSON 事件通道双记录。
 * ticket 079：belongings 项移除——归物本改走方法监听（notifyBelongingsAction），防双记录。
 * ticket 080：pomodoro 项移除——番茄钟改走方法监听（notifyPomodoroAction），防 JSON 事件通道双记录。
 * ticket 082：quiz/review 项移除——用户拍板去掉这两个盲通道计数观察（「你做了几道题」/「完成复习」不再产）。
 * 至此原 JSON 盲通道全清空；ticket 081（书库 weave-data.json 数据文件监听）合并后重新注入 library 条目。
 */

export interface DomainExtractor {
  file: string;
  extract: (raw: any, prev: Map<string, string>) => string | null;
}

export const DOMAIN_FILES: Record<string, DomainExtractor> = {
  // 全部盲通道已移除（见头部注释），等待 ticket 081 library 条目注入。
};

/** 遍历所有域：首次快照（记录当前状态，不产出观察）；返回已存在数据文件的域列表 */
export async function snapshotDomains(readJson: (path: string) => Promise<any>, prev: Map<string, string>): Promise<string[]> {
  const found: string[] = [];
  for (const key of Object.keys(DOMAIN_FILES)) {
    const raw = await readJson(DOMAIN_FILES[key].file).catch(() => null);
    if (raw == null) continue;
    found.push(key);
    DOMAIN_FILES[key].extract(raw, prev); // 首次不产出
  }
  return found;
}