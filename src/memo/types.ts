/**
 * 备忘录（memo）域类型
 * 数据格式与 memo.json 零迁移（spec「数据格式总表」14 字段，issue 353 起叠加可选字段
 * recur——旧数据无此字段照常载入，normalizeItem 补 null），与旧 memo 域共用同一数据文件。
 */
export interface MemoPosition {
  line: number;
  ch: number;
}

/**
 * 周期重复配置（issue 353，可选字段）：weekly/monthly/yearly 三种基础周期起步，
 * kind='days' + interval 预留自定义 N 天间隔（数据先有位，UI 一期不暴露）。
 */
export interface MemoRecur {
  kind: 'weekly' | 'monthly' | 'yearly' | 'days';
  /** 自定义间隔天数（kind='days' 时生效；≥1 整数，非法按 1 处理） */
  interval?: number;
}

export interface MemoItem {
  id: string;
  title: string;
  scene: string;
  priority: string; // important | minor
  created: string;
  completed: string | null;
  due: string | null;
  notePath: string | null;
  notePosition: MemoPosition | null;
  scriptName: string | null;
  courseName: string | null;
  coursePath: string | null;
  linkedNote: string | null;
  url: string | null;
  /** 周期重复（issue 353）：null = 不重复；完成后由数据层自动生成下一期 */
  recur: MemoRecur | null;
}
