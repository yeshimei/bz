/** 迁移脚本验证夹具生成（一次性） */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, 'fixture');
const dir = join(root, '归档', '网页剪藏');
mkdirSync(dir, { recursive: true });

// 1. LF + 带引号
writeFileSync(join(dir, 'a.md'), '---\nlink: "https://x.com/a"\ncreated: "2025-01-01"\n---\n\n正文A\n');
// 2. CRLF + 无引号（含 == & # 特殊字符）
writeFileSync(join(dir, 'b.md'), '---\r\nlink: https://mp.weixin.qq.com/s?__biz=M==&sn=x#rd\r\ncreated: 1750000000000\r\n---\r\n\r\n正文B\r\n');
// 3. 正文里也有顶格 link: 行（不得被改）
writeFileSync(join(dir, 'c.md'), '---\nlink: "https://x.com/c"\n---\n正文C\nlink: 不是frontmatter\n');
// 4. BOM 文件
writeFileSync(join(dir, 'd.md'), '\uFEFF---\nlink: "https://x.com/d"\n---\n正文D\n');
// 5. 已有 url 键 → 跳过
writeFileSync(join(dir, 'e.md'), '---\nurl: "https://x.com/e"\nlink: "https://x.com/old"\n---\n正文E\n');
// 6. 无 frontmatter → 跳过
writeFileSync(join(dir, 'f.md'), '纯正文没有元数据\n');
console.log('fixtures ready at', root);
