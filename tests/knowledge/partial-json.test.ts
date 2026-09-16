// @vitest-environment node
/**
 * 半截 JSON 字段抽取测试（src/knowledge/partial-json.ts，ADR-0152 / issue 343）。
 *
 * 命题：SSE 的每个 delta 都是模型输出文本的一片，累积起来在任意时刻都是**最终 JSON 的前缀**。
 * 这里用「把完整 JSON 切成 1 字符的伪 delta」来复现最刁钻的切法（转义序列被劈成两半），
 * 断言两件事：
 *   1. 每一帧取到的值都是最终值的前缀——只可能少字，不可能多字、错字、回退；
 *   2. 末帧等于 `JSON.parse` 的终值（预览与落盘不得静默不一致，ADR-0152「后果」）。
 * 纯函数、无依赖，node 环境直跑。
 */
import { describe, it, expect } from 'vitest';
import { partialStringField } from '../../src/knowledge/partial-json';

/** 按 size 切段逐段喂给抽取器，返回「值已开始」之后的帧（值变化才记一帧；首帧必是空串） */
function framesOf(full: string, key: string, size = 1): string[] {
  const out: string[] = [];
  let acc = '';
  let last: string | null = null;
  for (let i = 0; i < full.length; i += size) {
    acc += full.slice(i, i + size);
    const v = partialStringField(acc, key);
    if (v !== null && v !== last) { out.push(v); last = v; }
  }
  return out;
}

/** 断言：每一帧都是终值的前缀（只可能少字，不可能多字/错字/回退），且末帧就是终值 */
function expectMonotonicTo(frames: string[], expected: string): void {
  expect(frames.length).toBeGreaterThan(0);
  expect(frames[frames.length - 1]).toBe(expected);
  for (const f of frames) expect(expected.startsWith(f)).toBe(true);
}

describe('partialStringField（半截 JSON 的字符串字段抽取）', () => {
  it('朴素逐字：从空串起一位位长出，无回退无重复', () => {
    const full = '{"summary":"量子纠缠"}';
    const seq = framesOf(full, 'summary');
    expect(seq[0]).toBe(''); // 开引号刚到达：值已开始但为空
    expectMonotonicTo(seq, '量子纠缠');
  });

  it('转义被切成两半：当帧丢弃、下帧自愈（\\n \\" \\\\ 三种）', () => {
    const full = '{"summary":"第一行\\n第二行 \\"引号\\" 反斜杠 \\\\ 结束"}';
    const expected = JSON.parse(full).summary;
    expect(expected).toBe('第一行\n第二行 "引号" 反斜杠 \\ 结束'); // 先确认用例本身没写错
    expect(partialStringField(full, 'summary')).toBe(expected);
    expectMonotonicTo(framesOf(full, 'summary', 1), expected); // 逐字符切：半截转义不得吐出脏字
  });

  it('\\uXXXX 被切成 6 片：不足 4 位十六进制时不吐字，凑齐才解出', () => {
    const full = '{"summary":"\\u201c引号\\u201d与\\u4e2d文"}';
    const expected = JSON.parse(full).summary;
    expect(expected).toBe('“引号”与中文'); // 用例本身：全角引号 + 中文各占一个转义
    const seq = framesOf(full, 'summary', 1);
    expectMonotonicTo(seq, expected);
    // 半截 `\u2` 若被当成字面量吐出，帧里就会出现 u / 数字——正文里一个都没有
    for (const f of seq) expect(String(f)).not.toMatch(/[u0-9a-fA-F]/);
  });

  it('代理对（BMP 外字符）逐片到达仍拼成同一个字符', () => {
    const full = '{"summary":"\\ud83d\\ude00再见"}';
    expect(partialStringField(full, 'summary')).toBe('😀再见');
    expect(partialStringField(full, 'summary')).toBe(JSON.parse(full).summary);
  });

  it('字段顺序与位置都不影响（靠键名定位，不靠偏移）', () => {
    const a = '{"domain":"心理","summary":"正文"}';
    expect(partialStringField(a, 'domain')).toBe('心理');
    expect(partialStringField(a, 'summary')).toBe('正文');
    const b = '{"summary":"正文","domain":"心理"}';
    expect(partialStringField(b, 'summary')).toBe('正文');
    expect(partialStringField(b, 'domain')).toBe('心理');
    // title 在中间也不干扰
    const c = '{"domain":"心理","title":"标题","summary":"正文"}';
    expect(partialStringField(c, 'title')).toBe('标题');
    expect(partialStringField(c, 'summary')).toBe('正文');
  });

  it('前导前言 / markdown 围栏不影响抽取（剥离由收尾的 parseAiJson 负责）', () => {
    const full = '好的，结果如下：\n```json\n{"summary":"围栏里的正文"}\n```';
    expect(partialStringField(full, 'summary')).toBe('围栏里的正文');
  });

  it('键未出现 / 键只到一半 / 值未开始时一律 null', () => {
    expect(partialStringField('{"domain":"心理"', 'summary')).toBeNull(); // 键还没出现
    expect(partialStringField('{"summ', 'summary')).toBeNull(); // 键只到一半
    expect(partialStringField('{"summary"', 'summary')).toBeNull(); // 键到了，冒号没到
    expect(partialStringField('{"summary":', 'summary')).toBeNull(); // 冒号到了，值没开始
    expect(partialStringField('{"summary": ', 'summary')).toBeNull(); // 空白也算没开始
    expect(partialStringField('{"summary":"', 'summary')).toBe(''); // 值刚开始 = 空串
  });

  it('每个字段独立：一个没到不影响另一个已到', () => {
    const full = '{"domain":"心理","summary":"半截正文';
    expect(partialStringField(full, 'domain')).toBe('心理'); // 短字段先落地
    expect(partialStringField(full, 'summary')).toBe('半截正文'); // 长字段流出中
    expect(partialStringField(full, 'title')).toBeNull(); // 本态没有这个字段
  });

  it('截断：未闭合的前缀照样取得到（这正是「逐字显示」成立的前提）', () => {
    const truncated = '{"domain":"心理","summary":"这是一段被截断的正文';
    expect(partialStringField(truncated, 'summary')).toBe('这是一段被截断的正文');
    expect(() => JSON.parse(truncated)).toThrow(); // 收尾解析才报错，走既有报错路径
  });

  it('值一旦开始就不回退：开引号出现之后，不再有帧返回 null', () => {
    const full = '{"domain":"心理","summary":"正文"}';
    let acc = '';
    let seen = false;
    for (const ch of full) {
      acc += ch;
      const v = partialStringField(acc, 'summary');
      if (v !== null) seen = true;
      else expect(seen, `第 ${acc.length} 字符处回退成 null：${acc}`).toBe(false);
    }
    expect(seen).toBe(true);
  });

  it('值闭合后不再变化：后续字符不得污染已取到的值', () => {
    const full = '{"summary":"正文","domain":"心理"}';
    expect(partialStringField(full, 'summary')).toBe('正文');
    expect(partialStringField(full + ',"去重":"尾巴长出来了"', 'summary')).toBe('正文');
  });

  it('抽取终值 == JSON.parse 终值（预览与落盘不得静默不一致）', () => {
    const cases = [
      '{"summary":"普通正文"}',
      '{"domain":"心理","title":"标题","summary":"顺序打乱"}',
      '{"summary":"含 \\"引号\\" 与\\n换行\\r回车\\t制表"}',
      '{"summary":"\\u201c全角引号\\u201d与\\ud83d\\ude00 表情"}',
      '{"summary":"结尾反斜杠 \\\\"}',
      '{"summary":""}',
    ];
    for (const full of cases) {
      const parsed = JSON.parse(full);
      for (const key of ['summary', 'domain', 'title']) {
        const expected = typeof parsed[key] === 'string' ? parsed[key] : null;
        expect(partialStringField(full, key), `${key} @ ${full}`).toBe(expected);
      }
    }
  });
});
