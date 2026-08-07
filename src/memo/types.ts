/**
 * 备忘录类型（数据格式与 memo.json 零迁移，spec「数据格式总表」14 字段）
 */
export interface MemoPosition {
  line: number;
  ch: number;
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
}
