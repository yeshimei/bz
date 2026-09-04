/**
 * D3 直写守门扫描引擎（纯函数，node 可测；与 settings-copy-lint-engine 同款「引擎 + 测试」拆分）。
 *
 * 目标（设计稿 D3 / 可靠写契约收官）：扫描 src 下全部 .ts 中绕过 core/storage 契约直写 vault 的调用——
 *   vault.modify / modifyBinary / create / createBinary / process / writeBinary 与
 *   adapter.write / writeBinary / append（写类 API；rename/delete 属文件管理操作不入扫描面）。
 * 契约合规豁免（非违规，不需白名单）：
 *   1. 注释/字符串里的 API 名（先剥注释与字符串字面量，含模板串 ${} 插值内代码照常扫描）；
 *   2. 词法上位于 enqueueFileTask / updateFileSections / mergeWriteSections 调用区域内的直写
 *      （契约原语任务体内的 IO 实现——D3 收编后 diary/store.ts、bookshelf/epub-notes.ts 即属此类）。
 * 其余命中 = 违规：改走契约（入队/段写/jsonFileStore），确属例外（用户文档写、加密自有格式等）
 * 才进测试侧白名单清单，逐条注明理由；白名单条目失去对应命中时测试报过期，逼清单短而准。
 */

export interface ScanInput {
  path: string;
  content: string;
}

export interface GateHit {
  path: string;
  /** 1-based 行号 */
  line: number;
  /** 命中的写 API 形态（如 vault.modify / adapter.write） */
  api: string;
  /** 该行去注释后的代码片段（定位用） */
  snippet: string;
}

/**
 * 剥注释与字符串字面量：非代码字符一律替换为空格，保留换行（行号不变）。
 * 处理：行注释 // 、块注释 /* *\/、单双引号串（含转义）、模板串 ` `（${} 插值内代码保留扫描）、
 * 正则字面量 /…/（前导上下文启发式区分除号；字符类 [...] 内的 / 不终结）。
 * 正则内容整体置空——其中的引号/括号不应影响后续词法。
 */
export function stripCommentsAndStrings(code: string): string {
  const out = code.split('');
  type Kind = 'line' | 'block' | 'sq' | 'dq' | 'tpl' | 'brace' | 'regex' | 'rexclass';
  const stack: { kind: Kind; depth: number }[] = [];
  const blank = (i: number): void => {
    if (code[i] !== '\n') out[i] = ' ';
  };
  let lastMeaningful = '';
  /** 正则字面量启发式：前导上下文为运算符/开括号/关键字收尾 → `/` 是正则；否则是除号 */
  const isRegexStart = (i: number): boolean => {
    if (lastMeaningful === '') return true; // 文件/模式开头
    if (/[([,:=!&|?;{}+\-*%~^<>]/.test(lastMeaningful)) return true;
    if (/[A-Za-z0-9_$]/.test(lastMeaningful)) {
      // 标识符后：仅 return/case/typeof/void/delete/instanceof/in/of/new/do/else/yield 等关键字后是正则
      //（先截掉尾随空白再取尾词，防「return /re/」的空格让尾词提取落空、误判为除号）
      const before = code.slice(0, i).replace(/\s+$/, '');
      const word = (before.match(/[A-Za-z0-9_$]+$/) || [''])[0];
      return ['return', 'case', 'typeof', 'void', 'delete', 'instanceof', 'in', 'of', 'new', 'do', 'else', 'yield'].includes(word);
    }
    return false; // 变量/右括号/字符串收尾后 → 除号
  };
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const nxt = i + 1 < code.length ? code[i + 1] : '';
    const top = stack.length ? stack[stack.length - 1] : null;
    if (!top) {
      if (ch === '/' && nxt === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
        stack.push({ kind: 'line', depth: 0 });
        continue;
      }
      if (ch === '/' && nxt === '*') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
        stack.push({ kind: 'block', depth: 0 });
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        blank(i);
        stack.push({ kind: ch === "'" ? 'sq' : ch === '"' ? 'dq' : 'tpl', depth: 0 });
        continue;
      }
      // 正则字面量识别（内容整体置空，防其中的引号/括号干扰后续词法）
      if (ch === '/' && isRegexStart(i)) {
        blank(i);
        stack.push({ kind: 'regex', depth: 0 });
        continue;
      }
      if (!/\s/.test(ch)) lastMeaningful = ch;
      continue; // 普通代码字符原样保留
    }
    switch (top.kind) {
      case 'line':
        if (ch === '\n') stack.pop();
        else blank(i);
        break;
      case 'block':
        if (ch === '*' && nxt === '/') {
          blank(i);
          blank(i + 1);
          i++;
          stack.pop();
        } else blank(i);
        break;
      case 'sq':
      case 'dq':
        if (ch === '\\') {
          blank(i);
          if (nxt) blank(i + 1);
          i++;
        } else if ((top.kind === 'sq' && ch === "'") || (top.kind === 'dq' && ch === '"')) {
          blank(i);
          stack.pop();
        } else blank(i);
        break;
      case 'tpl':
        if (ch === '\\') {
          blank(i);
          if (nxt) blank(i + 1);
          i++;
        } else if (ch === '`') {
          blank(i);
          stack.pop();
        } else if (ch === '$' && nxt === '{') {
          blank(i);
          blank(i + 1);
          i++;
          stack.push({ kind: 'brace', depth: 0 });
        } else blank(i);
        break;
      case 'brace':
        // ${} 插值内是活代码：照常保留扫描（只剥其中的字符串/注释、跟踪嵌套花括号）
        if (ch === '{') top.depth++;
        else if (ch === '}') {
          if (top.depth === 0) stack.pop(); // 回到模板串
          else top.depth--;
        } else if (ch === "'" || ch === '"' || ch === '`') {
          blank(i);
          stack.push({ kind: ch === "'" ? 'sq' : ch === '"' ? 'dq' : 'tpl', depth: 0 });
        } else if (ch === '/' && nxt === '/') {
          blank(i);
          blank(i + 1);
          i++;
          stack.push({ kind: 'line', depth: 0 });
        } else if (ch === '/' && nxt === '*') {
          blank(i);
          blank(i + 1);
          i++;
          stack.push({ kind: 'block', depth: 0 });
        }
        break;
      case 'regex':
        if (ch === '\\') {
          blank(i);
          if (nxt) blank(i + 1);
          i++;
        } else if (ch === '[') {
          blank(i);
          stack.push({ kind: 'rexclass', depth: 0 });
        } else if (ch === '/') {
          blank(i);
          stack.pop();
          lastMeaningful = 'r'; // 正则结束后视作操作数上下文
        } else blank(i);
        break;
      case 'rexclass':
        if (ch === '\\') {
          blank(i);
          if (nxt) blank(i + 1);
          i++;
        } else if (ch === ']') {
          blank(i);
          stack.pop();
        } else blank(i);
        break;
    }
  }
  return out.join('');
}

/** 写类 API（vault 与 adapter 两族；create( 精确匹配不误吞 createFolder，process( 不误吞 processFrontMatter） */
const WRITE_API_RE = [
  /\bvault\s*\??\.\s*(modify|modifyBinary|create|createBinary|process|writeBinary)\s*\(/g,
  /\badapter\s*\??\.\s*(write|writeBinary|append)\s*\(/g,
];

/**
 * 契约原语调用区域（词法括号配对）：区域内的直写 = 队列内 IO 实现，非违规。
 * 输入须先经 stripCommentsAndStrings（字符串/注释内的 API 名不构成区域起点）。
 */
export function findQueueRegions(stripped: string): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  const re = /\b(?:enqueueFileTask|updateFileSections|mergeWriteSections)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < stripped.length; i++) {
      if (stripped[i] === '(') depth++;
      else if (stripped[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) end = stripped.length - 1; // 括号不配对（异常输入）：保守吞到文件尾
    regions.push([m.index, end]);
    re.lastIndex = end + 1; // 从区域尾继续找（嵌套区域由外层覆盖）
  }
  return regions;
}

const inRegions = (idx: number, regions: Array<[number, number]>): boolean =>
  regions.some(([s, e]) => idx >= s && idx <= e);

/** 行首空白截断的代码片段（定位用，去注释后） */
function snippetAt(stripped: string, idx: number): string {
  const lineStart = stripped.lastIndexOf('\n', idx) + 1;
  const lineEnd = stripped.indexOf('\n', idx) === -1 ? stripped.length : stripped.indexOf('\n', idx);
  return stripped.slice(lineStart, lineEnd).trim();
}

/** 扫描一组文件，返回白名单之外的全部裸直写命中（队列区域与注释/字符串已豁免） */
export function scanRawVaultWrites(files: ScanInput[]): GateHit[] {
  const hits: GateHit[] = [];
  for (const file of files) {
    const stripped = stripCommentsAndStrings(file.content);
    const regions = findQueueRegions(stripped);
    for (const re of WRITE_API_RE) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(stripped)) !== null) {
        if (inRegions(m.index, regions)) continue; // 契约队列内 IO：合规
        const line = stripped.slice(0, m.index).split('\n').length;
        hits.push({ path: file.path, line, api: m[0].replace(/\s+/g, ''), snippet: snippetAt(stripped, m.index) });
      }
    }
  }
  return hits;
}
