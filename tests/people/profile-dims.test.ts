// @vitest-environment node
/**
 * 人物档案扩维度测试（issue 487，digest 侧）：
 * buildProfileNote 覆盖十维、档案提炼 prompt 契约（全部维度 JSON / 无证据留空 / 手填不覆盖声明）、
 * parseProfileReply 容错归一（围栏 / 脏字段 / 顿号串 / 残缺结构行）、
 * fillProfile 只填空白语义（undefined / 空串 / 空数组才收 AI 值，手填绝不覆盖）。
 * （纯数据层，无 DOM）
 */
import { describe, it, expect } from 'vitest';
import {
  buildProfileExtractPrompt,
  buildProfileNote,
  fillProfile,
  knownProfileText,
  parseProfileReply,
  profileExtractMaterial,
} from '../../src/people/digest';
import type { PersonProfile } from '../../src/people/types';

describe('buildProfileNote 十维（issue 487）', () => {
  it('新维度逐项成句：性格 / 兴趣爱好 / 作息 / 近况 / 称呼 / 口头禅 / 喜欢 / 反感 / 身边人 / 重要日子', () => {
    const profile: PersonProfile = {
      nickname: '老猫',
      personality: '外冷内热，嘴硬心软',
      interests: ['爬山', '摇滚', '推理小说'],
      habits: '早睡早起，周末晨跑',
      recentLife: '最近在准备考试',
      quote: '问题不大',
      likes: ['手冲咖啡', '悬疑片'],
      dislikes: ['香菜', '被催'],
      relationships: [{ who: '阿珍', relation: '女朋友' }],
      importantDates: [{ date: '05-20', what: '领养猫的日子' }],
    };
    const note = buildProfileNote(profile);
    expect(note).toContain('称呼：老猫');
    expect(note).toContain('性格：外冷内热，嘴硬心软');
    expect(note).toContain('兴趣爱好：爬山、摇滚、推理小说');
    expect(note).toContain('作息 / 习惯：早睡早起，周末晨跑');
    expect(note).toContain('近况：最近在准备考试');
    expect(note).toContain('口头禅：问题不大');
    expect(note).toContain('喜欢：手冲咖啡、悬疑片');
    expect(note).toContain('反感 / 雷点：香菜、被催');
    expect(note).toContain('身边人：阿珍（女朋友）');
    expect(note).toContain('重要日子：05-20 领养猫的日子');
  });

  it('旧维度不回退；只写有的项；空档案 / 缺省返回空串', () => {
    const note = buildProfileNote({ birthday: '1994-02-14', tags: ['同学'], note: '聊天必带表情包' });
    expect(note).toContain('生日：1994-02-14');
    expect(note).toContain('关系标签：同学');
    expect(note).toContain('备注：聊天必带表情包');
    expect(note).not.toContain('性格');
    expect(buildProfileNote({})).toBe('');
    expect(buildProfileNote(undefined)).toBe('');
  });
});

describe('profileExtractMaterial / knownProfileText（issue 487 共用组装口径）', () => {
  it('素材分段：大事前置的事件 / 原话 / 场景 / 特质 / 兴趣 / 未竟；空素材返回空串', () => {
    const mat = profileExtractMaterial({
      events: [
        { ts: '2024-05-02', summary: '小事' },
        { ts: '2024-05-01', summary: '大事', kind: 'major' },
      ],
      quotes: [{ ts: '2024-05-01', who: '对方', text: '你猜怎么着' }],
      moments: [{ ts: '2024-05-01', summary: '常去的那家店' }],
      traits: ['话痨'],
      interests: [{ ts: '2024-05-01', topic: '五月天' }],
      threads: [{ ts: '2024-05-01', text: '下次一起爬山' }],
    });
    expect(mat).toContain('【交往事件】');
    expect(mat.indexOf('2024-05-01 大事')).toBeLessThan(mat.indexOf('2024-05-02 小事')); // 大事前置
    expect(mat).toContain('【代表性原话】\n对方：你猜怎么着');
    expect(mat).toContain('【场景细节】\n2024-05-01 常去的那家店');
    expect(mat).toContain('【特质线索】\n话痨');
    expect(mat).toContain('【兴趣信号】\n2024-05-01 五月天');
    expect(mat).toContain('【未竟之事】\n2024-05-01 下次一起爬山');
    expect(profileExtractMaterial({})).toBe('');
  });

  it('known 覆盖全部可填字段；空档案返回空串', () => {
    const known = knownProfileText({
      birthday: '1994-02-14',
      job: '设计师',
      tags: ['同学'],
      interests: ['爬山'],
      quote: '问题不大',
      relationships: [{ who: '阿珍', relation: '女朋友' }],
      importantDates: [{ date: '05-20', what: '领养猫的日子' }],
    });
    expect(known).toContain('生日 1994-02-14');
    expect(known).toContain('职业 设计师');
    expect(known).toContain('标签 同学');
    expect(known).toContain('兴趣爱好 爬山');
    expect(known).toContain('口头禅 问题不大');
    expect(known).toContain('身边人 阿珍（女朋友）');
    expect(known).toContain('重要日子 05-20 领养猫的日子');
    expect(knownProfileText({})).toBe('');
    expect(knownProfileText(undefined)).toBe('');
  });
});

describe('buildProfileExtractPrompt 契约（issue 487）', () => {
  it('JSON 契约含全部维度；无证据给空 / 不编造与手填不覆盖声明在场', () => {
    const prompt = buildProfileExtractPrompt('老王', '【交往事件】\n2024-05-01 约饭', '生日 1994-02-14；职业 设计师');
    expect(prompt).toContain('「老王」');
    // 契约行 = 全部 17 个可填字段
    expect(prompt).toContain(
      '{"birthday":"","nickname":"","metVia":"","metAt":"","hometown":"","job":"","tags":[],"note":"","personality":"","interests":[],"habits":"","recentLife":"","quote":"","likes":[],"dislikes":[],"relationships":[{"who":"","relation":""}],"importantDates":[{"date":"","what":""}]}'
    );
    expect(prompt).toContain('没有证据的字段给空串 / 空数组，绝不编造');
    expect(prompt).toContain('已知档案（用户手填，不要覆盖也不要重复推断）：生日 1994-02-14；职业 设计师');
    expect(prompt).toContain('【交往事件】'); // 素材原文进 prompt
  });

  it('无 known 不出声明段；素材为空仍出契约与规则', () => {
    const prompt = buildProfileExtractPrompt('老王', '', undefined);
    expect(prompt).not.toContain('已知档案');
    expect(prompt).toContain('请推断档案缺失字段');
    expect(prompt).toContain('绝不编造');
  });
});

describe('parseProfileReply 容错（issue 487）', () => {
  it('裸 JSON / json 围栏 / 前后杂文本都能解析出全部维度', () => {
    const raw = '```json\n' + JSON.stringify({
      birthday: '1994-02-14',
      nickname: '老猫',
      personality: '外冷内热',
      interests: ['爬山', '摇滚'],
      habits: '早睡早起',
      recentLife: '在备考',
      quote: '问题不大',
      likes: ['咖啡'],
      dislikes: ['香菜'],
      relationships: [{ who: '阿珍', relation: '女朋友' }],
      importantDates: [{ date: '05-20', what: '领养猫' }],
    }) + '\n```';
    const out = parseProfileReply(raw);
    expect(out.birthday).toBe('1994-02-14');
    expect(out.nickname).toBe('老猫');
    expect(out.personality).toBe('外冷内热');
    expect(out.interests).toEqual(['爬山', '摇滚']);
    expect(out.habits).toBe('早睡早起');
    expect(out.recentLife).toBe('在备考');
    expect(out.quote).toBe('问题不大');
    expect(out.likes).toEqual(['咖啡']);
    expect(out.dislikes).toEqual(['香菜']);
    expect(out.relationships).toEqual([{ who: '阿珍', relation: '女朋友' }]);
    expect(out.importantDates).toEqual([{ date: '05-20', what: '领养猫' }]);
  });

  it('防御归一：空串 / 空数组不落字段；数组元素去空去重；数字串化；顿号串宽容切分', () => {
    const out = parseProfileReply(JSON.stringify({
      birthday: '  ',
      interests: ['爬山', '爬山', '', 42],
      likes: '咖啡、电影，悬疑', // AI 给成整串：按顿号 / 逗号切
      tags: [],
    }));
    expect(out.birthday).toBeUndefined();
    expect(out.interests).toEqual(['爬山', '42']);
    expect(out.likes).toEqual(['咖啡', '电影', '悬疑']);
    expect(out.tags).toBeUndefined();
  });

  it('结构行残缺剔除：缺 who / 缺 relation / 缺 date 的条目不收；契约外字段不收', () => {
    const out = parseProfileReply(JSON.stringify({
      relationships: [
        { who: '阿珍', relation: '女朋友' },
        { who: '老张', relation: '' },
        { who: '', relation: '同事' },
        '脏数据',
      ],
      importantDates: [
        { date: '05-20', what: '领养猫' },
        { date: '', what: '没日子' },
      ],
      socials: [{ platform: '微信', handle: 'hack' }], // 契约外：一律不收
    }));
    expect(out.relationships).toEqual([{ who: '阿珍', relation: '女朋友' }]);
    expect(out.importantDates).toEqual([{ date: '05-20', what: '领养猫' }]);
    expect(out.socials).toBeUndefined();
  });

  it('空回执 / 全空字段 → 空对象（画谱侧据此留空）', () => {
    expect(parseProfileReply('{}')).toEqual({});
    expect(parseProfileReply('{"birthday":"","interests":[]}')).toEqual({});
  });
});

describe('fillProfile 只填空白（issue 487 语义铁则）', () => {
  const ai: PersonProfile = {
    birthday: '1994-02-14',
    job: '设计师',
    note: 'AI 备注',
    personality: '外冷内热',
    nickname: '老猫',
    interests: ['爬山', '摇滚'],
    likes: ['咖啡'],
    dislikes: ['香菜'],
    tags: ['同学'],
    relationships: [{ who: '阿珍', relation: '女朋友' }],
    importantDates: [{ date: '05-20', what: '领养猫' }],
  };

  it('全空档案：所有 AI 值全部收下（数组为拷贝，不共享引用）', () => {
    const out = fillProfile(undefined, ai);
    expect(out.birthday).toBe('1994-02-14');
    expect(out.personality).toBe('外冷内热');
    expect(out.interests).toEqual(['爬山', '摇滚']);
    expect(out.likes).toEqual(['咖啡']);
    expect(out.relationships).toEqual([{ who: '阿珍', relation: '女朋友' }]);
    expect(out.importantDates).toEqual([{ date: '05-20', what: '领养猫' }]);
    // 拷贝语义：改副本不影响 AI 结果
    out.interests!.push('电影');
    expect(ai.interests).toEqual(['爬山', '摇滚']);
  });

  it('手填字段绝不覆盖：有值 / 空白混排时只补空白（重新画谱不冲掉用户改过的值）', () => {
    const existing: PersonProfile = {
      birthday: '1990-01-01', // 手填：AI 的不同值不进
      job: '', // 空串 = 空白：收 AI 值
      interests: ['钓鱼'], // 手填数组：AI 的整组不进
      likes: [], // 空数组 = 空白：收 AI 值
      personality: '用户写过',
      note: undefined,
    };
    const out = fillProfile(existing, ai);
    expect(out.birthday).toBe('1990-01-01');
    expect(out.job).toBe('设计师');
    expect(out.interests).toEqual(['钓鱼']);
    expect(out.likes).toEqual(['咖啡']);
    expect(out.personality).toBe('用户写过');
    expect(out.note).toBe('AI 备注');
    expect(out.nickname).toBe('老猫');
    expect(existing.birthday).toBe('1990-01-01'); // 原对象不被改动
  });

  it('AI 值为空的字段保持缺省；结构维度只补空白（已有行不覆盖）', () => {
    const existing: PersonProfile = {
      relationships: [{ who: '老张', relation: '同事' }],
      quote: '问题不大',
    };
    const out = fillProfile(existing, {
      quote: 'AI 口头禅',
      relationships: [{ who: '阿珍', relation: '女朋友' }],
      importantDates: [{ date: '05-20', what: '领养猫' }],
    });
    expect(out.quote).toBe('问题不大');
    expect(out.relationships).toEqual([{ who: '老张', relation: '同事' }]);
    expect(out.importantDates).toEqual([{ date: '05-20', what: '领养猫' }]);
  });
});
