// @vitest-environment node
/**
 * 第二大脑 Ollama HTTP 覆盖率补测（ticket 103：设置键随 secondBrain* 换代）：
 * 非 2xx 响应抛错、空向量/缺字段兜底、批量 embeddings 缺省、对话消息缺省回退、
 * 远程探活 ok/false/异常三分支、自定义 baseUrl/model 传参。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEmbedding, getEmbeddingsBatch, ollamaChat, checkRemoteOllama } from '../../src/secondbrain/ollama';
import { setSettingsProvider } from '../../src/core/settings-provider';

const BASE = 'http://127.0.0.1:11434';

function flashSettings() {
  return {
    secondBrainOllamaUrl: BASE,
    secondBrainEmbeddingModel: 'bge-m3',
    secondBrainChatModel: 'qwen-test',
    secondBrainRemoteOllamaUrl: 'http://192.168.1.8:11434',
    storagePath: 'CONFIG/STORAGE',
  };
}

/** json 响应 stub */
function stubJson(payload: any, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }));
}

describe('Ollama HTTP 覆盖补测', () => {
  beforeEach(() => {
    setSettingsProvider(() => flashSettings() as any);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getEmbedding：检索查询加前缀、默认地址/模型；向量正常返回', async () => {
    const seen: { url: string; body: any }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opts: any) => {
        seen.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, status: 200, json: async () => ({ embedding: [0.1, 0.2] }) };
      })
    );
    await expect(getEmbedding('机器学习', true)).resolves.toEqual([0.1, 0.2]);
    expect(seen[0].url).toBe(`${BASE}/api/embeddings`);
    expect(seen[0].body.model).toBe('bge-m3');
    expect(seen[0].body.prompt).toContain('Represent this sentence for searching relevant passages');
    expect(seen[0].body.prompt).toContain('机器学习');
    // 非查询不加前缀
    await getEmbedding('普通文本', false);
    expect(seen[1].body.prompt).toBe('普通文本');
  });

  it('getEmbedding：非 2xx → 抛「Ollama 错误: 状态码」', async () => {
    vi.stubGlobal('fetch', stubJson({}, 500));
    await expect(getEmbedding('x', false)).rejects.toThrow('Ollama 错误: 500');
  });

  it('getEmbedding：embedding 缺失或为空数组 → 抛「向量为空」', async () => {
    vi.stubGlobal('fetch', stubJson({}));
    await expect(getEmbedding('x', false)).rejects.toThrow('向量为空');
    vi.stubGlobal('fetch', stubJson({ embedding: [] }));
    await expect(getEmbedding('x', false)).rejects.toThrow('向量为空');
  });

  it('getEmbeddingsBatch：请求体含模型与 input；embeddings 正常返回', async () => {
    const seen: { url: string; body: any }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opts: any) => {
        seen.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, status: 200, json: async () => ({ embeddings: [[1], [2]] }) };
      })
    );
    await expect(getEmbeddingsBatch(['a', 'b'])).resolves.toEqual([[1], [2]]);
    expect(seen[0].url).toBe(`${BASE}/api/embed`);
    expect(seen[0].body).toEqual({ model: 'bge-m3', input: ['a', 'b'] });
  });

  it('getEmbeddingsBatch：非 2xx 抛错；embeddings 缺省/空数组抛「向量为空」（QA L125 同语义，ticket 107 补回）', async () => {
    vi.stubGlobal('fetch', stubJson({}, 503));
    await expect(getEmbeddingsBatch(['a'])).rejects.toThrow('Ollama 错误: 503');
    vi.stubGlobal('fetch', stubJson({}));
    await expect(getEmbeddingsBatch(['a'])).rejects.toThrow('向量为空');
    vi.stubGlobal('fetch', stubJson({ embeddings: [] }));
    await expect(getEmbeddingsBatch(['a'])).rejects.toThrow('向量为空');
  });

  it('getEmbeddingsBatch：baseUrl 参数生效（移动端远程嵌入端点，ticket 107）', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return { ok: true, status: 200, json: async () => ({ embeddings: [[1]] }) };
      })
    );
    await expect(getEmbeddingsBatch(['a'], 'http://10.0.0.8:11434')).resolves.toEqual([[1]]);
    expect(seen[0]).toBe('http://10.0.0.8:11434/api/embed');
  });

  it('ollamaChat：自定义 baseUrl/model 生效，请求体带流关闭与温度', async () => {
    const seen: { url: string; body: any }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opts: any) => {
        seen.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, status: 200, json: async () => ({ message: { content: '你好呀' } }) };
      })
    );
    await expect(ollamaChat('问题', 'custom-model', 'http://10.0.0.9:11434')).resolves.toBe('你好呀');
    expect(seen[0].url).toBe('http://10.0.0.9:11434/api/chat');
    expect(seen[0].body.model).toBe('custom-model');
    expect(seen[0].body.messages).toEqual([{ role: 'user', content: '问题' }]);
    expect(seen[0].body.stream).toBe(false);
    expect(seen[0].body.options.temperature).toBe(0.7);
  });

  it('ollamaChat：message.content 缺失 → 回退「（无响应）」；非 2xx 抛错', async () => {
    vi.stubGlobal('fetch', stubJson({ message: null }));
    await expect(ollamaChat('q')).resolves.toBe('（无响应）');
    vi.stubGlobal('fetch', stubJson({}, 404));
    await expect(ollamaChat('q')).rejects.toThrow('Ollama 错误: 404');
  });

  it('checkRemoteOllama：ok=true → true；ok=false → false；网络异常 → false 不抛出', async () => {
    vi.stubGlobal('fetch', stubJson({}, 200));
    await expect(checkRemoteOllama('http://r:11434')).resolves.toBe(true);
    vi.stubGlobal('fetch', stubJson({}, 500));
    await expect(checkRemoteOllama('http://r:11434')).resolves.toBe(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      })
    );
    await expect(checkRemoteOllama('http://r:11434')).resolves.toBe(false);
  });
});
