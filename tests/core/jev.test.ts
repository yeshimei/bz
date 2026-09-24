// @vitest-environment node
/**
 * Jev 决策通道测试（issue 389；模型列表 issue 424/ADR-0184）：报文形态（choice.criteria 字典 / score.criteria 数组之别是
 * 实测踩过的坑，必须有断言守住）、三种题型解析、超时/HTTP/网络失败上抛、AbortSignal 取消、
 * 未配置拦截、空问题不发请求。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  askJev,
  buildJevBody,
  fetchJevModels,
  isJevConfigured,
  parseJevModels,
  resolveJevConfig,
  JEV_DEFAULT_ENDPOINT,
  JEV_DEFAULT_MODEL,
  JEV_DEFAULT_TIMEOUT_MS,
  type JevQuestion,
} from '../../src/core/jev';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { requestUrl } from '../mock-obsidian-entry';

const requestUrlMock = vi.mocked(requestUrl);

/** 就绪的 Jev 配置（不走设置注入，直接以 config 覆盖） */
const CFG = {
  endpoint: 'https://api.typesafe.ai/v1/systemone',
  apiKey: 'sk-jev-test',
  model: 'jev-1.13.0',
  timeoutMs: 500,
};

/** 实测原文的响应体（三种题型齐备） */
const RESPONSE = {
  model: 'jev-1.13.0',
  answers: {
    k_choice: {
      type: 'choice',
      choice: '历史',
      confidence: 1.0,
      probabilities: { 天文: 0.0, 历史: 1.0 },
    },
    k_score: {
      type: 'score',
      score: 3.99,
      confidence: 0.99,
      legend: { 0: '很低', 4: '很高' },
      probabilities: { 0: 0.0, 4: 0.99 },
    },
    k_noul: { type: 'noul', noul: 1.0 },
  },
  usage: { input_tokens: 493, output_tokens: 84 },
};

/** 三题型齐备的问题集 */
function allQuestions(): Record<string, JevQuestion> {
  return {
    k_noul: { type: 'noul', instructions: '材料是否提到了嘉靖皇帝？' },
    k_choice: {
      type: 'choice',
      instructions: '这段材料最贴近下列哪个领域？',
      criteria: { 历史: '朝代、人物、事件', 心理: '认知、情绪、行为' },
    },
    k_score: {
      type: 'score',
      instructions: '材料体现的刚直程度',
      criteria: ['很低', '较低', '一般', '较高', '很高'],
    },
  };
}

function okResponse(body: unknown, status = 200) {
  return { status, text: JSON.stringify(body) } as any;
}

describe('core/jev', () => {
  beforeEach(() => {
    requestUrlMock.mockReset();
    requestUrlMock.mockResolvedValue(okResponse(RESPONSE));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------- 报文形态 ----------

  it('报文形态：noul 仅 instructions、choice.criteria 是字典、score.criteria 是数组', () => {
    const body = buildJevBody('state-文本', allQuestions(), 'jev-1.13.0');
    expect(body.model).toBe('jev-1.13.0');
    expect(body.state).toBe('state-文本');
    const qs = body.questions as Record<string, any>;

    expect(qs.k_noul).toEqual({ type: 'noul', instructions: '材料是否提到了嘉靖皇帝？' });
    expect(Object.keys(qs.k_noul)).toEqual(['type', 'instructions']);

    // choice.criteria 必须是对象（写成数组会被 API 422 拒）
    expect(Array.isArray(qs.k_choice.criteria)).toBe(false);
    expect(qs.k_choice.criteria).toEqual({ 历史: '朝代、人物、事件', 心理: '认知、情绪、行为' });

    // score.criteria 必须是有序数组
    expect(Array.isArray(qs.k_score.criteria)).toBe(true);
    expect(qs.k_score.criteria).toEqual(['很低', '较低', '一般', '较高', '很高']);
  });

  it('请求：POST 到端点、Bearer 鉴权、body 为 JSON', async () => {
    await askJev('材料', allQuestions(), { config: CFG });
    expect(requestUrlMock).toHaveBeenCalledTimes(1);
    const arg = requestUrlMock.mock.calls[0][0] as any;
    expect(arg.url).toBe(CFG.endpoint);
    expect(arg.method).toBe('POST');
    expect(arg.headers.Authorization).toBe('Bearer sk-jev-test');
    expect(arg.headers['Content-Type']).toBe('application/json');
    const parsed = JSON.parse(arg.body);
    expect(parsed.model).toBe('jev-1.13.0');
    expect(Object.keys(parsed.questions)).toEqual(['k_noul', 'k_choice', 'k_score']);
  });

  // ---------- 响应解析 ----------

  it('解析：choice 取 choice/probabilities/confidence', async () => {
    const r = await askJev('材料', { k_choice: allQuestions().k_choice }, { config: CFG });
    const a = r.answers.k_choice as any;
    expect(a.type).toBe('choice');
    expect(a.choice).toBe('历史');
    expect(a.confidence).toBe(1.0);
    expect(a.probabilities).toEqual({ 天文: 0.0, 历史: 1.0 });
  });

  it('解析：score 取 score/legend（score 是档位索引、可为小数）', async () => {
    const r = await askJev('材料', { k_score: allQuestions().k_score }, { config: CFG });
    const a = r.answers.k_score as any;
    expect(a.type).toBe('score');
    expect(a.score).toBe(3.99);
    expect(a.confidence).toBe(0.99);
    expect(a.legend).toEqual({ 0: '很低', 4: '很高' });
  });

  it('解析：noul 取 0–1 概率；model 与 usage 透传', async () => {
    const r = await askJev('材料', { k_noul: allQuestions().k_noul }, { config: CFG });
    expect((r.answers.k_noul as any).noul).toBe(1.0);
    expect(r.model).toBe('jev-1.13.0');
    expect(r.usage).toEqual({ input_tokens: 493, output_tokens: 84 });
  });

  // ---------- 失败上抛 ----------

  it('HTTP 非 2xx → 抛错（含状态码与正文摘要，不静默返空）', async () => {
    requestUrlMock.mockResolvedValue({ status: 503, text: 'no healthy upstream' } as any);
    await expect(askJev('材料', { q: allQuestions().k_noul }, { config: CFG })).rejects.toThrow(
      /503.*no healthy upstream/s
    );
  });

  it('422（criteria 写反那类）→ 抛错并透出字段级说明', async () => {
    requestUrlMock.mockResolvedValue({
      status: 422,
      text: JSON.stringify({ detail: [{ msg: 'Input should be a valid dictionary' }] }),
    } as any);
    await expect(askJev('材料', { q: allQuestions().k_choice }, { config: CFG })).rejects.toThrow(
      /422/
    );
  });

  it('响应缺少 answers → 抛错（不伪装成「零命中」）', async () => {
    requestUrlMock.mockResolvedValue(okResponse({ model: 'jev-1.13.0' }));
    await expect(askJev('材料', { q: allQuestions().k_noul }, { config: CFG })).rejects.toThrow(
      /answers/
    );
  });

  it('响应不是合法 JSON → 抛错', async () => {
    requestUrlMock.mockResolvedValue({ status: 200, text: '<html>oops</html>' } as any);
    await expect(askJev('材料', { q: allQuestions().k_noul }, { config: CFG })).rejects.toThrow(
      /JSON/
    );
  });

  it('网络异常 → 上抛原始错误', async () => {
    requestUrlMock.mockRejectedValue(new Error('net::ERR_CONNECTION_RESET'));
    await expect(askJev('材料', { q: allQuestions().k_noul }, { config: CFG })).rejects.toThrow(
      /ERR_CONNECTION_RESET/
    );
  });

  it('超时 → TimeoutError 语义（可识别于网络失败）', async () => {
    requestUrlMock.mockImplementation(() => new Promise(() => {}) as any);
    await expect(
      askJev('材料', { q: allQuestions().k_noul }, { config: { ...CFG, timeoutMs: 30 } })
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  // ---------- 取消 ----------

  it('AbortSignal 取消 → AbortError 语义，且 signal.aborted 可区分于失败', async () => {
    requestUrlMock.mockImplementation(() => new Promise(() => {}) as any);
    const ctrl = new AbortController();
    const p = askJev('材料', { q: allQuestions().k_noul }, { config: CFG, signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(ctrl.signal.aborted).toBe(true);
    // 取消不走 HTTP 成功路径之外的任何兜底：没有第二次请求
    expect(requestUrlMock).toHaveBeenCalledTimes(1);
  });

  it('调用前 signal 已 aborted → 立即抛 AbortError，不发请求', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      askJev('材料', { q: allQuestions().k_noul }, { config: CFG, signal: ctrl.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestUrlMock).not.toHaveBeenCalled();
  });

  // ---------- 空问题 / 未配置 ----------

  it('questions 为空 → 不发请求，返回空 answers', async () => {
    const r = await askJev('材料', {}, { config: CFG });
    expect(r.answers).toEqual({});
    expect(requestUrlMock).not.toHaveBeenCalled();
  });

  it('无端点 / 无密钥 → 抛错，不发请求', async () => {
    await expect(
      askJev('材料', { q: allQuestions().k_noul }, { config: { ...CFG, apiKey: '' } })
    ).rejects.toThrow(/密钥/);
    expect(requestUrlMock).not.toHaveBeenCalled();
  });

  // ---------- 配置 ----------

  it('resolveJevConfig：缺省端点/模型/超时', () => {
    setSettingsProvider(() => ({}) as any);
    const cfg = resolveJevConfig();
    expect(cfg.endpoint).toBe(JEV_DEFAULT_ENDPOINT);
    expect(cfg.model).toBe(JEV_DEFAULT_MODEL);
    expect(cfg.timeoutMs).toBe(JEV_DEFAULT_TIMEOUT_MS);
    expect(cfg.apiKey).toBe('');
  });

  it('resolveJevConfig：端点由「Jev 服务商」解析（在册 id + 非法 id 回落缺省）', () => {
    setSettingsProvider(() => ({ jevProvider: 'typesafe' }) as any);
    expect(resolveJevConfig().endpoint).toBe(JEV_DEFAULT_ENDPOINT);
    setSettingsProvider(() => ({ jevProvider: 'nobody' }) as any);
    expect(resolveJevConfig().endpoint).toBe(JEV_DEFAULT_ENDPOINT);
  });

  it('resolveJevConfig：模型覆盖（空串回落缺省）', () => {
    setSettingsProvider(() => ({ jevModel: 'jev-preview', jevApiKey: 'sk-x' }) as any);
    expect(resolveJevConfig().model).toBe('jev-preview');
    setSettingsProvider(() => ({ jevModel: '' }) as any);
    expect(resolveJevConfig().model).toBe(JEV_DEFAULT_MODEL);
  });

  it('resolveJevConfig：超时固化十秒（旧超时设置键已退役，设置里写什么都不看）', () => {
    setSettingsProvider(() => ({ jevTimeoutMs: 3000 }) as any);
    expect(resolveJevConfig().timeoutMs).toBe(JEV_DEFAULT_TIMEOUT_MS);
    setSettingsProvider(() => ({}) as any);
    expect(resolveJevConfig().timeoutMs).toBe(JEV_DEFAULT_TIMEOUT_MS);
  });

  it('isJevConfigured：常开（issue 424 起总开关键退役）——只看密钥，无开关', () => {
    setSettingsProvider(() => ({ jevApiKey: 'sk-x' }) as any);
    expect(isJevConfigured()).toBe(true);
    setSettingsProvider(() => ({ jevApiKey: '' }) as any);
    expect(isJevConfigured()).toBe(false);
    // 存量数据里残留的旧开关值不再影响判定（键已退役）
    setSettingsProvider(() => ({ jevEnabled: false, jevApiKey: 'sk-x' }) as any);
    expect(isJevConfigured()).toBe(true);
  });
});

// ---------------- 模型列表（issue 424/ADR-0184「获取模型」） ----------------

describe('core/jev · 模型列表', () => {
  const MODELS_JSON = {
    models: [
      { name: 'jev-latest', description: '最新版', release_date: '2026-09-01' },
      { name: 'jev-preview' },
    ],
  };

  beforeEach(() => {
    requestUrlMock.mockReset();
  });

  it('parseJevModels：自家格式 {models:[{name,…}]} → 选项；说明取描述 + 发布日，缺省回落服务商名', () => {
    expect(parseJevModels(MODELS_JSON)).toEqual([
      { id: 'jev-latest', detail: '最新版，2026-09-01' },
      { id: 'jev-preview', detail: 'Typesafe' },
    ]);
    // 畸形项跳过；非数组/缺字段一律空表（调用方据此报错，不静默发空选择器）
    expect(parseJevModels({ models: [{ description: '无名' }, null, { name: 'ok' }] })).toEqual([
      { id: 'ok', detail: 'Typesafe' },
    ]);
    expect(parseJevModels({})).toEqual([]);
    expect(parseJevModels(null)).toEqual([]);
  });

  it('fetchJevModels：打到服务商 modelsUrl，带 Bearer 密钥；响应 → 选项列表', async () => {
    setSettingsProvider(() => ({ jevProvider: 'typesafe', jevApiKey: 'sk-jev' }) as any);
    requestUrlMock.mockResolvedValue({ status: 200, text: JSON.stringify(MODELS_JSON) } as any);
    const models = await fetchJevModels();
    expect(models.map((m) => m.id)).toEqual(['jev-latest', 'jev-preview']);
    const call = requestUrlMock.mock.calls[0][0] as any;
    expect(call.url).toBe('https://api.typesafe.ai/v1/models');
    expect(call.headers.Authorization).toBe('Bearer sk-jev');
  });

  it('fetchJevModels：缺密钥 → 抛错且不发请求（与判定请求同口径）', async () => {
    setSettingsProvider(() => ({ jevProvider: 'typesafe', jevApiKey: '' }) as any);
    await expect(fetchJevModels()).rejects.toThrow(/密钥/);
    expect(requestUrlMock).not.toHaveBeenCalled();
  });

  it('fetchJevModels：HTTP 非 2xx / 畸形 JSON / 空列表 → 抛错（不静默返回空选择器）', async () => {
    setSettingsProvider(() => ({ jevProvider: 'typesafe', jevApiKey: 'sk-jev' }) as any);
    requestUrlMock.mockResolvedValue({ status: 401, text: 'unauthorized' } as any);
    await expect(fetchJevModels()).rejects.toThrow(/401/);
    requestUrlMock.mockResolvedValue({ status: 200, text: '不是 JSON' } as any);
    await expect(fetchJevModels()).rejects.toThrow(/合法 JSON/);
    requestUrlMock.mockResolvedValue({ status: 200, text: JSON.stringify({ models: [] }) } as any);
    await expect(fetchJevModels()).rejects.toThrow(/未返回可用模型/);
  });

  it('fetchJevModels：测试注入通道可绕开 obsidian requestUrl（deps 口径）', async () => {
    setSettingsProvider(() => ({ jevApiKey: 'sk-x' }) as any);
    const requestUrlFn = vi.fn(async () => ({ status: 200, text: JSON.stringify(MODELS_JSON) }));
    const models = await fetchJevModels({ requestUrlFn });
    expect(models.map((m) => m.id)).toEqual(['jev-latest', 'jev-preview']);
    expect(requestUrlMock).not.toHaveBeenCalled();
  });
});
