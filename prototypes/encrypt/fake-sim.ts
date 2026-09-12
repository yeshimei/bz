/**
 * 保险库行为单源 · sim 启动入口（encrypt 域，2026-09-12）
 *
 * 评审壳侧启动器：把真行为层（encrypt ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（与密码本壳同一套 localStorage 文件系统：保险库本就是
 *     一个 SafeManager + 一份 .safe.enc，两壳可共享同一演示库语义）；
 *   - 种子：**用真加密链现场建库**（不引离线密文）——unlock 首设 → lockNote 逐篇入库
 *     → lock 回锁屏。这样种子永远与当前 data.ts 的清单格式同行，密文格式改版不会
 *     让壳停在旧数据结构上；代价是首启一次 PBKDF2（PC 上 ~百毫秒级，只在首启发生）。
 *     种子标记存在即跳过（评审期在壳里的增删改保留）。
 *   - 设置注入：加密根 / 预览 / 安全模式等真键（securityMode=false——演示期关窗不上锁，
 *     评审可反复进出；与真插件默认值同）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_encrypt，iframe 壳只调 boot + openPanel。
 * 插件的 ui.ts / data.ts / index.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, seedVaultFile } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { ensureEncrypt, getSafeManager, openEncrypt, unloadEncrypt } from '../../src/encrypt/index';

/** 种子标记：存在 = 已种子过（评审壳里的增删改保留，不被覆盖） */
const SEED_MARK = 'bz-sim:__vlt-seed-v1';
/** 种子权锁：双 iframe 并行 boot 时只允许一个实例建库（见 seedDatabase 注释） */
const SEED_LOCK = 'bz-sim:__vlt-seeding';

/** 演示主密码（壳徽牌展示提示） */
export const DEMO_MASTER_PASSWORD = 'demo';

/** 密码本/保险库共用设置 store（真 settings-provider 注入） */
const settingsStore: Record<string, unknown> = {
  storagePath: 'CONFIG/STORAGE',
  encryptRoot: 'CONFIG/.ENCRYPT',
  encryptPreviewEnabled: true,
  encryptPreviewSize: '384',
  encryptPreviewQuality: '0.5',
  encryptAutoLoadOriginal: false,
  encryptSecurityMode: false,
  // 安全模式演示期关闭：关窗不上锁，评审可反复进出（真插件默认值同为 false）
  securityMode: false,
  passwordCharset: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+',
  passwordLength: '16',
};

/** 演示笔记/日记（全合成内容，不含任何真实凭据） */
interface SeedNote {
  path: string;
  title: string;
  /** 缺省 = 普通加密笔记；'diary-entry' = 加密日记条目（ADR-0017） */
  kind?: 'diary-entry';
  content: string;
}

const SEED_NOTES: SeedNote[] = [
  {
    path: '我的/私密/深夜盘点.md',
    title: '深夜盘点',
    content: [
      '# 深夜盘点',
      '',
      '这个月把三件拖了很久的事收掉了，仍然有两件在原地打转。',
      '',
      '## 收掉的',
      '',
      '- 迁移脚本终于跑通，回滚路径也验过了',
      '- 把「想做的事」清单砍到只剩 5 条',
      '- 体检报告看完了，问题不大，但要开始规律作息',
      '',
      '## 没动的',
      '',
      '> 那些迟迟不动的事，多半不是难，是我不愿意承认它的代价。',
      '',
      '1. 学钢琴，每周至少两次',
      '2. 把书架第二层清掉一半',
      '',
      '下周只留一件事：把上面第 1 条排进日历。',
    ].join('\n'),
  },
  {
    path: '我的/私密/服务器迁移备忘.md',
    title: '服务器迁移备忘',
    content: [
      '# 服务器迁移备忘',
      '',
      '老机器 10 月底到期，迁移分三步，别一次全量切换。',
      '',
      '| 步骤 | 内容 | 回滚 |',
      '| --- | --- | --- |',
      '| 1 | 静态资源先切 CDN | 改回源站域名 |',
      '| 2 | 数据库主从 + 只读切换 | 提权旧主库 |',
      '| 3 | 应用灰度 10% → 50% → 全量 | 摘掉灰度实例 |',
      '',
      '关键命令记一下：',
      '',
      '```bash',
      'ssh deploy@old-host "systemctl stop app"',
      'rsync -avz --delete /srv/data/ new-host:/srv/data/',
      '```',
      '',
      '> 迁移窗口选周二凌晨，别选周五。',
      '',
      '迁移完成后立刻做的事：更新 DNS TTL、把旧机器留一周再关机。',
    ].join('\n'),
  },
  {
    path: '我的/私密/一些不愿公开的片段.md',
    title: '一些不愿公开的片段',
    content: [
      '# 一些不愿公开的片段',
      '',
      '写下来只是为了让它们从脑子里出去。',
      '',
      '- 那次会议我的判断错了，而且我当场就知道错了，但没改口。',
      '- 有些关系不是变淡了，是我先松的手。',
      '- 存了一笔「以后再说」的钱，其实是为了买一点退路。',
      '',
      '这些没有结论，也不需要结论。',
    ].join('\n'),
  },
  {
    path: '我的/日记/2026-09-10.md',
    title: '2026-09-10 阴',
    kind: 'diary-entry',
    content: [
      '## 2026-09-10 阴',
      '',
      '一整天断断续续的雨。上午把预发布环境重装了一遍，终于干净了。',
      '',
      '晚上没写代码，把纪录片看完了。片子讲的是修钟表的人，节奏很慢，看完反而踏实。',
    ].join('\n'),
  },
  {
    path: '我的/日记/2026-09-11.md',
    title: '2026-09-11 晴',
    kind: 'diary-entry',
    content: [
      '## 2026-09-11 晴',
      '',
      '晴，但风起来了。',
      '',
      '早上六点半自然醒，出门走了一圈，路上只遇到一个遛狗的人。回来把积压的邮件清空了——清邮件这件事本身没有价值，但它让我觉得这一天是我在安排。',
      '',
      '> 今天唯一想记住的一句：先把该做的做完，再去想值不值得。',
    ].join('\n'),
  },
];

let simApp: FakeApp | null = null;
let bootPromise: Promise<void> | null = null;

/** 等对方种完（storage 事件不可靠地跨 iframe 触发，用轮询兜底） */
function waitSeeded(timeoutMs = 20000): Promise<void> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      if (localStorage.getItem(SEED_MARK) || Date.now() - t0 > timeoutMs) return resolve();
      setTimeout(tick, 120);
    };
    tick();
  });
}

/**
 * 种子：真加密链现场建库（首设 → 逐篇 lockNote → 回锁屏），幂等。
 *
 * **必须串行**：桌面/移动两个 iframe 并行 boot，若都去种子，就是两个实例同时
 * 「解密/首设同一个 .safe.enc → 各自 lockNote → 各自 saveManifest」，轻则条目重复、
 * 重则一方读到另一方半写的清单（三段式 rename 的中间态）→ 解出损坏内容 → 之后
 * 密码正确也解锁不了（2026-09-12 首版壳实测：两端都停在「设置主密码」态就是这个）。
 * 故先用 SEED_LOCK 抢种子权；抢不到就等 SEED_MARK 出现；对方超时未成则自己接手。
 */
async function seedDatabase(app: FakeApp): Promise<void> {
  // 控制器初始化与种子无关（面板打开依赖它），任何分支都要先做
  await ensureEncrypt(app as never);
  if (localStorage.getItem(SEED_MARK)) return;

  if (localStorage.getItem(SEED_LOCK)) {
    await waitSeeded();
    if (localStorage.getItem(SEED_MARK)) return;
    localStorage.setItem(SEED_LOCK, String(Date.now())); // 对方没种成 → 自己接手
  } else {
    localStorage.setItem(SEED_LOCK, String(Date.now()));
  }

  try {
    const sm = getSafeManager();
    if (!sm.unlocked) {
      // 首设：无清单文件 → 建空清单并设主密码（与 UI 首次设密码同一条数据路径）
      const ok = await sm.unlock(DEMO_MASTER_PASSWORD);
      if (!ok) return;
    }
    for (const n of SEED_NOTES) {
      // 原文件先落盘：加锁 = 正文搬进库、原路径移出（还原时回到该路径），取证重读需要它真实存在
      seedVaultFile(n.path, n.content, Date.parse('2026-09-11T21:00:00+08:00') || undefined);
      await sm.lockNote({
        path: n.path,
        title: n.title,
        kind: n.kind,
        content: n.content,
        attachments: [],
      });
    }
    sm.lock(); // 回锁屏态：评审从「输入主密码」开始，而不是直接看已解锁面板
    localStorage.setItem(SEED_MARK, new Date().toISOString());
  } finally {
    localStorage.removeItem(SEED_LOCK);
  }
}

/** 壳入口：一次性启动（注入 + 种子；幂等，返回 promise 供 view 页 await） */
export function bootEncryptSim(): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      const app = new FakeApp();
      simApp = app;
      // core/app 的 setApp 形参是 obsidian App 类型；评审壳 FakeApp 只实现依赖链消费面，
      // 运行期以 (app.vault as any).adapter 等访问——类型断言收敛此处差异。
      setApp(app as never);
      setSettingsProvider(() => settingsStore as never);
      await seedDatabase(app);
    })();
  }
  return bootPromise;
}

/**
 * 锁屏演示提示（壳侧注入：真锁屏 markup 单源不掺演示文案，演示外景注记归 fake-sim）。
 * 必须轮询：锁屏是 showPasswordDialog 里 `await exists()` 之后才建的，openPanel 返回时
 * 它往往还不存在（首启还要先现场建库），固定 setTimeout 会赶在锁屏之前、注记静默丢失。
 */
function injectLockHint(retries = 20): void {
  const boxes = document.querySelectorAll<HTMLElement>('.bz-lockscreen-box');
  if (!boxes.length) {
    if (retries > 0) setTimeout(() => injectLockHint(retries - 1), 200);
    return;
  }
  boxes.forEach((lock) => {
    if (lock.querySelector('.bz-vlt-sim-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'bz-vlt-sim-hint';
    hint.style.cssText = 'margin-top:12px;font-size:12px;opacity:.7;letter-spacing:.5px;text-align:center;';
    hint.textContent = '演示库主密码：demo（小写；两端各自解锁）';
    lock.appendChild(hint);
  });
}

/** 打开保险库（插件 index.openEncrypt 同名语义：首开建面板 + 锁屏 → 之后 show） */
export async function openPanel(): Promise<void> {
  await bootEncryptSim();
  openEncrypt(simApp as never);
  injectLockHint(); // 自带轮询：锁屏建出来之前它会一直等
}

/** 卸载（自检/重置演示数据前清态用） */
export function unload(): void {
  unloadEncrypt();
}
