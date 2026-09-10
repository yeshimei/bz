// 备忘录评审壳 · 演示数据（issue 260）。日期相对当下生成：到期梯度（逾期/今日/未来）
// 与相对时间在任何天打开都成立；条目结构与插件 memo.json 同构（TodoItem→MemoItem 14 字段）。
// 加载顺序：本文件先于 prototype-behavior.js（fake-sim 首启读 window.MEMO.ITEMS 写 fake vault）。
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  const daysAgo = (n, h, m) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m || 0, 0, 0); return fmt(d); };
  const inDays = (n, h, m) => daysAgo(-n, h, m);
  let seq = 0;
  const it = (title, scene, extra) => Object.assign({
    id: 'demo-' + (++seq), title, scene, priority: 'minor',
    created: daysAgo(2, 9, 30), completed: null, due: null,
    notePath: null, notePosition: null, scriptName: null, courseName: null, coursePath: null,
    linkedNote: null, url: null,
  }, extra || {});

  window.MEMO = {
    ITEMS: [
      // ===== 到期优先（逾期/今日梯度；重要红底）=====
      it('把季度 OKR 拆成周计划', '工作', { priority: 'important', due: daysAgo(1, 9, 0), notePath: '笔记/项目规划.md', notePosition: { line: 4, ch: 0 }, created: daysAgo(3, 10, 0) }),
      it('回复合作方的排期确认', '工作', { due: daysAgo(0, 9, 30), created: daysAgo(1, 18, 5) }),
      it('整理《算法导论》第 4 章笔记', '学习', { due: inDays(0, 20, 0), notePath: '笔记/项目规划.md', notePosition: { line: 12, ch: 0 }, created: daysAgo(2, 14, 20) }),
      it('睡前拉伸 15 分钟', '生活', { due: inDays(0, 22, 30), created: daysAgo(0, 7, 10) }),
      // ===== 其他（场景特例：代码 scriptName / 公开课 courseName / 剪藏 url）=====
      it('周报自动汇总脚本跑不通', '代码', { scriptName: 'weekly-report.py', due: inDays(1, 12, 0), created: daysAgo(1, 11, 0) }),
      it('剪藏：Obsidian 1.9 发布说明', '剪藏', { url: 'https://obsidian.md/blog/obsidian-1-9', created: daysAgo(0, 8, 45) }),
      it('看完dataly 第 6 讲并做习题', '公开课', { courseName: '《数据分析实战》', coursePath: '课程/数据分析实战.md', linkedNote: '课程/数据分析实战.md', notePath: '课程/数据分析实战.md', created: daysAgo(4, 20, 0) }),
      it('给冰箱补货清单拍照存档', '生活', { created: daysAgo(1, 19, 40) }),
      it('备份 tip 仓库 SSH 配置', '代码', { scriptName: 'backup-ssh.sh', completed: daysAgo(1, 17, 10), created: daysAgo(2, 16, 0) }),
      it('读罢《置身事内》第三章', '学习', { completed: daysAgo(0, 12, 30), created: daysAgo(5, 9, 0) }),
      it('预约周末羽毛球场地', '生活', { priority: 'important', created: daysAgo(0, 10, 15) }),
      it('剪藏：终端效率工具盘点（存了再看）', '剪藏', { url: 'https://example.com/terminal-tools', notePath: '笔记/项目规划.md', notePosition: { line: 22, ch: 0 }, created: daysAgo(6, 15, 0) }),
      it('公开课：补第 5 讲课堂笔记', '公开课', { courseName: '《数据分析实战》', coursePath: '课程/数据分析实战.md', created: daysAgo(7, 21, 0) }),
      // ===== 已完成折叠条（更早 N 条演示：两条 40+ 天前）=====
      it('旧房租赁合同归档', '生活', { completed: daysAgo(45, 11, 0), created: daysAgo(46, 11, 0) }),
      it('第一版简历定稿', '工作', { completed: daysAgo(52, 16, 30), created: daysAgo(53, 16, 0) }),
      it('订阅续费：向量库托管', '工作', { completed: daysAgo(38, 9, 55), created: daysAgo(39, 9, 50) }),
    ],
  };
})();
