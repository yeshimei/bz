/**
 * 待办（todo）域类型
 * 数据格式与 memo.json 零迁移（spec「数据格式总表」14 字段），与旧 memo 域共用同一数据文件。
 */
export interface TodoPosition {
  line: number;
  ch: number;
}

export interface TodoItem {
  id: string;
  title: string;
  scene: string;
  priority: string; // important | minor
  created: string;
  completed: string | null;
  due: string | null;
  notePath: string | null;
  notePosition: TodoPosition | null;
  scriptName: string | null;
  courseName: string | null;
  coursePath: string | null;
  linkedNote: string | null;
  url: string | null;
}
