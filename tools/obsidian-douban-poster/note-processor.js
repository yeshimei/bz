import fs from 'node:fs';

/**
 * 从文件名提取影视名称
 * 支持《名称》.md 和 名称.md 两种格式
 */
export function extractMovieName(filename) {
  const basename = filename.replace(/\.md$/i, '');
  const match = basename.match(/《(.+)》/);
  return match ? match[1] : basename;
}

/**
 * 解析 Markdown 文件的 YAML frontmatter
 */
export function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const fm = {};
  const lines = match[1].split(/\r?\n/);
  let currentKey = null;
  let isArray = false;

  for (const line of lines) {
    // 数组项: "  - value"
    const arrayMatch = line.match(/^  - (.+)$/);
    if (arrayMatch && currentKey) {
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
      fm[currentKey].push(arrayMatch[1].trim());
      isArray = true;
      continue;
    }

    // 键值对: "key: value"
    const kvMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let value = kvMatch[2].trim();

      // 类型转换
      if (value === '' || value === 'null' || value === 'undefined') {
        value = null;
      } else if (!isNaN(value) && value !== '') {
        value = Number(value);
      }

      fm[key] = value;
      currentKey = key;
      isArray = false;
    }
  }

  return fm;
}

/**
 * 检查笔记的 frontmatter 中海报字段是否非空
 */
export function hasPoster(filePath) {
  const fm = readFrontmatter(filePath);
  return !!(fm['海报'] && String(fm['海报']).trim());
}

/**
 * 检查笔记是否已有豆瓣信息（豆瓣链接字段非空）
 */
export function hasDoubanInfo(filePath) {
  const fm = readFrontmatter(filePath);
  return !!(fm['豆瓣链接'] && String(fm['豆瓣链接']).trim());
}

/**
 * YAML 值序列化：含特殊字符/空格时双引号包裹并转义
 */
function formatYamlValue(val) {
  const s = String(val);
  if (/[:"\-#\[\]{}|>'?]/.test(s) || s.includes(' ')) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
}

/**
 * 批量更新 frontmatter 字段
 * @param {string} filePath 笔记绝对路径
 * @param {object} fields 要添加/更新的字段键值对
 */
export function updateFrontmatterFields(filePath, fields) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);

  if (!fmMatch) {
    // 无 frontmatter，新建
    const fmLines = ['---'];
    for (const [k, v] of Object.entries(fields)) {
      if (v) fmLines.push(`${k}: ${formatYamlValue(v)}`);
    }
    fmLines.push('---');
    content = fmLines.join('\n') + '\n' + content;
    fs.writeFileSync(filePath, content, 'utf-8');
    return;
  }

  const header = fmMatch[1];
  const footer = fmMatch[3];
  let fmContent = fmMatch[2];
  const lines = fmContent.split(/\r?\n/);

  // 找到 tags 列表后插入新字段
  let insertIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\s+- /)) insertIdx = i + 1;
  }

  // 现有字段名
  const existingKeys = new Set();
  for (const line of lines) {
    const m = line.match(/^([^:]+):/);
    if (m) existingKeys.add(m[1].trim());
  }

  const newLines = [];
  for (const [key, val] of Object.entries(fields)) {
    if (val && val !== '') {
      if (existingKeys.has(key)) {
        // 更新已有字段
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(new RegExp(`^${key}:`))) {
            lines[i] = `${key}: ${formatYamlValue(val)}`;
            break;
          }
        }
      } else {
        newLines.push(`${key}: ${formatYamlValue(val)}`);
      }
    }
  }

  if (newLines.length > 0) {
    lines.splice(insertIdx, 0, ...newLines);
  }

  content = header + lines.join('\n') + footer + content.slice(fmMatch[0].length);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 在 frontmatter 之后插入海报图片链接（如尚未存在）
 */
export function insertPosterEmbed(filePath, posterPath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const embedLink = `![[${posterPath}]]`;

  // 已存在则跳过
  if (content.includes(embedLink)) return;

  const fmMatch = content.match(/^(---\r?\n[\s\S]*?\r?\n---)\r?\n/);
  if (fmMatch) {
    const afterFm = content.slice(fmMatch[0].length);
    const newContent = fmMatch[0] + embedLink + '\n' + afterFm;
    fs.writeFileSync(filePath, newContent, 'utf-8');
  } else {
    const newContent = embedLink + '\n' + content;
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }
}

// 向后兼容 — 旧 updateFrontmatter(filePath, posterPath) 等价于 updateFrontmatterFields(filePath, { '海报': posterPath })
export function updateFrontmatter(filePath, posterPath) {
  updateFrontmatterFields(filePath, { '海报': posterPath });
}
