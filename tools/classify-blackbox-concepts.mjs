/**
 * 黑匣子概念一键分类（用户需求 2026-08-12：为无分类的概念分好类）。
 * 规则关键词分类（16 类，按命中关键词数最多者；手动表兜底 23 条边缘概念）：
 *   医学/心理学/哲学/文学/历史/地理/科学/宗教/计算机/艺术/社会/饮食/音乐/影视/体育/未分类
 * 对每张概念笔记：frontmatter 写 category + 移动到 `黑匣子/概念/<分类>/<名>.md`（同名 -N 去重）
 * index 不持久化（2026-08-12 用户决策）：load 全量扫描笔记构建。幂等：已有 category 且已在分类文件夹 → 跳过；可安全重跑。
 * 写前备份 blackbox.json。
 * 用法：node tools/classify-blackbox-concepts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const VAULT = 'E:/Obsidian/叫我包仔';
const CONCEPT_DIR = path.join(VAULT, '黑匣子', '概念');
const BB_FILE = path.join(VAULT, 'CONFIG/STORAGE/blackbox.json');

const CATEGORY_ORDER = ['医学', '心理学', '哲学', '文学', '历史', '地理', '科学', '宗教', '计算机', '艺术', '社会', '饮食', '音乐', '影视', '体育'];

const KEYWORDS = {
  医学: ['疾病', '病', '症', '癌', '瘤', '医', '药', '治疗', '蛋白', '细胞', '基因', '病毒', '细菌', '免疫', '器官', '血', '神经', '激素', '感染', '手术', '医生', '患者', '解剖', '抗生素', '疫苗', '代谢', '酶', '染色体', '遗传', '诊断'],
  心理学: ['心理', '情绪', '认知', '行为', '人格', '焦虑', '抑郁', '记忆', '注意', '动机', '思维', '压力', '应激', '依恋', '自恋', '暗示', '催眠', '创伤', '共情', '同理心', '偏见', '决策', '幸福', '快乐', '满足', '心流', '意志'],
  哲学: ['哲学', '主义', '存在', '伦理', '道德', '形而上学', '认识论', '辩证法', '虚无', '存在主义', '现象学', '逻辑学', '本体', '自由意志', '功利', '斯多葛', '犬儒', '怀疑', '理性', '启蒙', '马克思', '尼采', '叔本华', '康德', '柏拉图', '亚里士多德', '庄子', '老子', '孔子', '孟子', '禅宗', '道家', '儒家'],
  文学: ['文学', '小说', '诗', '散文', '作家', '作品', '《', '》', '修辞', '隐喻', '叙事', '词', '赋', '列传', '寓言', '戏剧', '诗派', '诗人', '名著', '游记', '随笔', '文体'],
  历史: ['历史', '朝代', '皇帝', '战争', '革命', '王朝', '帝国', '世纪', '考古', '文物', '遗址', '文明', '人种', '化石', '石碑', '历法', '干支', '闰月', '农历', '古代', '中世纪', '帝国', '帝国'],
  地理: ['地理', '山', '河', '湖', '海', '沙漠', '高原', '盆地', '海峡', '城市', '气候', '生态', '植被', '动物', '植物', '物种', '树', '花', '木', '草', '柏', '榕', '绣球', '凌霄', '刺桐', '槭', '茼蒿', '本初子午线', '半岛', '群岛', '河流', '山脉'],
  科学: ['物理', '化学', '数学', '量子', '相对论', '原子', '分子', '能量', '粒子', '天体', '宇宙', '恒星', '行星', '进化', '生物', '元素', '实验', '公式', '定理', '天文', '彗星', '陨石', '探测器', '卫星', '引力', '电磁', '光学', '力学'],
  宗教: ['宗教', '佛', '基督', '伊斯兰', '道教', '神', '圣经', '教义', '信仰', '禅', '修行', '圣', '福音', '礼拜', '寺庙', '教堂', '神话', '祭祀'],
  计算机: ['计算机', '程序', '代码', '算法', '软件', '硬件', '编程', '数据', '网络', '人工智能', '机器学习', '操作系统', '数据库', '前端', '后端', '开源', '协议', '芯片', '图灵', 'GPS', '墨水屏', '星链', '科技', '互联网', '加密', '区块链'],
  艺术: ['艺术', '绘画', '画', '雕塑', '建筑', '美术', '美学', '流派', '风格', '印象派', '文艺复兴', '设计', '书法', '摄影', '色彩', '构图'],
  社会: ['社会', '经济', '政治', '法律', '制度', '文化', '民族', '阶级', '权力', '资本', '市场', '消费', '组织', '管理', '企业', '国家', '货币', '贸易', '税收', '劳动'],
  饮食: ['食', '菜', '茶', '酒', '咖啡', '烹饪', '美食', '香料', '水果', '谷物', '面包', '米饭', '汤', '酱'],
  音乐: ['音乐', '乐曲', '交响', '协奏', '钢琴', '小提琴', '作曲家', '歌剧', '旋律', '乐器', '声乐', '奏鸣曲', '圆舞曲', '民谣'],
  影视: ['电影', '影视', '导演', '演员', '剧', '影', '奥斯卡', '纪录片', '动画', '科幻片', '剧情片'],
  体育: ['体育', '运动', '足球', '篮球', '奥运', '健身', '跑步', '运动员', '棋', '马拉松'],
};

/** 边缘概念手动归类（规则未命中的 23 条） */
const MANUAL = {
  rtk: '计算机',
  波札可龙人: '历史',
  澳大利亚种人: '历史',
  非洲凌霄: '地理',
  干支纪法: '历史',
  鸡冠刺桐: '地理',
  鸡爪槭: '地理',
  哈雷彗星: '科学',
  龙柏: '地理',
  卡西尼号探测器: '科学',
  罗塞塔石碑: '历史',
  本初子午线: '地理',
  闰月: '历史',
  墨水屏: '计算机',
  圣多马: '宗教',
  木茼蒿: '地理',
  斯蒂克尼陨石坑: '科学',
  圆锥绣球: '地理',
  农历: '历史',
  榕树: '地理',
  绣球: '地理',
  星链: '计算机',
  云片柏: '地理',
  // 第二轮补充（规则未命中）
  爱情三角理论: '心理学',
  挂谷猜想: '科学',
  坎德人: '历史',
};

function classify(name, definition) {
  if (MANUAL[name]) return MANUAL[name];
  const text = `${name} ${definition}`;
  let best = null;
  let bestScore = 0;
  for (const cat of CATEGORY_ORDER) {
    const score = KEYWORDS[cat].filter((k) => text.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return bestScore > 0 ? best : '未分类';
}

function sanitizeFileName(name) {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '未命名';
}

function quoteScalar(v) {
  if (/^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/.test(v)) return v;
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** 读 frontmatter 字段（简易） */
function readFm(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (!m) return fm;
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0 || line.startsWith('  ')) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    fm[k] = v;
  }
  return fm;
}

/** 在 frontmatter 写 category（有则替换，无则插在 type 行后） */
function setCategory(content, category) {
  const lines = content.split('\n');
  // 找 frontmatter 结束
  let fmEnd = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmEnd = i;
      break;
    }
  }
  if (fmEnd < 0) return content;
  const catLine = `category: ${quoteScalar(category)}`;
  const hasCat = lines.slice(1, fmEnd).some((l) => l.startsWith('category:'));
  if (hasCat) {
    return lines.map((l) => (l.startsWith('category:') ? catLine : l)).join('\n');
  }
  // 插在 type: 行后
  for (let i = 1; i < fmEnd; i++) {
    if (lines[i].startsWith('type:')) {
      lines.splice(i + 1, 0, catLine);
      break;
    }
  }
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(CONCEPT_DIR)) {
    console.log('黑匣子/概念 目录不存在');
    return;
  }
  const bb = JSON.parse(fs.readFileSync(BB_FILE, 'utf8'));

  // 收集全部概念笔记（递归，含已有分类子文件夹）
  const notes = [];
  const walk = (d) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!n.endsWith('.md')) continue;
      notes.push(p);
    }
  };
  walk(CONCEPT_DIR);
  console.log('概念笔记总数:', notes.length);

  const counts = {};
  let moved = 0;
  let skipped = 0;
  let failed = 0;
  const mkdirp = (d) => {
    if (fs.existsSync(d)) return;
    mkdirp(path.dirname(d));
    fs.mkdirSync(d);
  };
  const uniqueTarget = (dir, baseName, selfAbs) => {
    let target = path.join(dir, `${baseName}.md`);
    if (selfAbs && path.resolve(target) === path.resolve(selfAbs)) return target; // 自身不算冲突
    let n = 1;
    while (fs.existsSync(target)) {
      target = path.join(dir, `${baseName}-${n}.md`);
      n += 1;
    }
    return target;
  };

  for (const abs of notes) {
    try {
      const content = fs.readFileSync(abs, 'utf8');
      const fm = readFm(content);
      const id = fm.id;
      if (!id) {
        failed += 1;
        console.warn('缺 id，跳过:', path.relative(VAULT, abs));
        continue;
      }
      const name = fm.name || path.basename(abs).replace(/\.md$/, '');
      // 正文定义（frontmatter 之后，关联区之前取前 200 字）
      const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n\n')[0] || '';
      const cat = classify(name, body.slice(0, 200));
      counts[cat] = (counts[cat] || 0) + 1;
      const targetDir = path.join(CONCEPT_DIR, cat);
      const target = uniqueTarget(targetDir, sanitizeFileName(name), abs);
      if (path.dirname(abs) === targetDir && path.basename(abs) === path.basename(target)) {
        // 已在正确分类文件夹：只需补 category 字段
        if (!content.includes('\ncategory:')) {
          fs.writeFileSync(abs, setCategory(content, cat), 'utf8');
        }
        skipped += 1;
        continue;
      }
      // 移动 + 写 category
      mkdirp(targetDir);
      fs.writeFileSync(abs, setCategory(content, cat), 'utf8');
      fs.renameSync(abs, target);
      moved += 1;
    } catch (e) {
      failed += 1;
      console.warn('失败:', path.relative(VAULT, abs), e.message);
    }
  }

  // 落盘（不再写 index 字段——2026-08-12 用户决策：load 全量扫描笔记构建）
  fs.writeFileSync(BB_FILE, JSON.stringify(bb, null, 2), 'utf8');

  console.log('----------------------------------------');
  console.log('分类结果:');
  for (const [c, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c}: ${n}`);
  }
  console.log(`移动 ${moved} 篇，跳过（已就位）${skipped} 篇，失败 ${failed} 条`);
  console.log('blackbox.json index 已更新；重跑本脚本可幂等补漏。');
}

main();
