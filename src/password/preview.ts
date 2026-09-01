/**
 * 密码本 UI 原型预览（移动端全屏版）
 * 纯展示稿：mock 数据 + 无任何功能/持久化/加密。
 * 入口：命令 "密码本·原型预览（A）"（bz-pw-preview）。
 * 本轮按用户拍板改版：
 *  - 移动端全屏界面（桌面 Obsidian 打开也是移动端布局，供审阅）
 *  - 去掉搜索按钮（搜索框常驻）
 *  - 去掉密码强度条 / 去掉 👁，点击密码文字显示/隐藏
 *  - 关闭按钮 ❌ emoji，仅全屏显示（原型恒全屏）
 * 全部 id/类名用 pwv- 前缀，独立于既有 pw-* 契约，随时可整文件删除。
 */
import { topifyZ } from '../core/dom';

/** mock 条目（模拟 PasswordEntry 7 字段，数据仅作展示） */
const MOCK: {
  id: string;
  platform: string;
  url: string;
  account: string;
  password: string;
  note: string;
  createdAt: string;
}[] = [
  { id: 'p1', platform: 'GitHub', url: 'https://github.com', account: 'baozai.dev', password: 'Gh#9xK2!mQ7vP4', note: '主账号，启用了两步验证', createdAt: '2026-08-02T08:30:00' },
  { id: 'p2', platform: '微信', url: '', account: '138****5678', password: 'Wx#bZ8!qR3tY5', note: '', createdAt: '2026-07-21T14:20:00' },
  { id: 'p3', platform: '支付宝', url: 'https://alipay.com', account: 'baozai@163.com', password: 'Ali@2026#Kd9', note: '绑定手机 138****5678', createdAt: '2026-07-15T09:00:00' },
  { id: 'p4', platform: 'Notion', url: 'https://notion.so', account: 'bz@outlook.com', password: 'Nt!p7Lm2#xW4kQ', note: '', createdAt: '2026-06-30T18:45:00' },
  { id: 'p5', platform: '哔哩哔哩', url: 'https://bilibili.com', account: '包仔Official', password: 'Bz!2026#Lp8', note: '大会员', createdAt: '2026-06-12T11:10:00' },
  { id: 'p6', platform: '招商银行', url: 'https://cmbchina.com', account: '6222****1234', password: 'Cmb#9xR2!qW5', note: '工资卡', createdAt: '2026-05-28T20:00:00' },
  { id: 'p7', platform: '豆瓣', url: 'https://douban.com', account: 'baozai', password: 'Db!2zQ7', note: '弱密码待更换', createdAt: '2026-05-03T08:00:00' },
];

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 86400000;
  if (diff < 1) return '今天';
  if (diff < 2) return '昨天';
  if (diff < 30) return Math.round(diff) + ' 天前';
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function dots(pwd: string): string {
  return '•'.repeat(Math.min(pwd.length, 16));
}

let mask: HTMLDivElement | null = null;
let popup: HTMLDivElement | null = null;

export function showPasswordPreview(): void {
  if (!mask || !popup) {
    build();
  }
  topifyZ(mask!, popup!);
  mask!.style.display = 'block';
  popup!.style.display = 'flex';
  renderList('');
}

function build(): void {
  mask = document.createElement('div');
  mask.id = 'pwv-mask';
  mask.style.display = 'none';
  mask.onclick = () => hide();

  popup = document.createElement('div');
  popup.id = 'pwv-popup';
  popup.className = 'pwv-fullscreen'; // 原型恒全屏（移动端界面）
  popup.style.display = 'none';

  // 头行：标题 + ❌（emoji，全屏显示）
  const head = document.createElement('div');
  head.className = 'pwv-head';
  const title = document.createElement('h3');
  title.textContent = '密码本';
  const btns = document.createElement('div');
  btns.className = 'pwv-head-btns';
  btns.appendChild(iconBtn('❌', '关闭', hide));
  head.appendChild(title);
  head.appendChild(btns);

  // 搜索框（常驻，无开关按钮）
  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = '搜索平台、账号、备注…';
  search.className = 'pwv-search';
  search.addEventListener('input', () => {
    renderList(search.value.trim().toLowerCase());
  });

  // 列表
  const list = document.createElement('div');
  list.id = 'pwv-list';

  popup.appendChild(head);
  popup.appendChild(search);
  popup.appendChild(list);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
}

function iconBtn(text: string, title: string, onClick?: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'pwv-icon-btn';
  b.textContent = text;
  b.title = title;
  if (onClick) b.onclick = onClick;
  return b;
}

function renderList(filter: string): void {
  const list = document.getElementById('pwv-list');
  if (!list) return;
  list.innerHTML = '';
  const data = filter
    ? MOCK.filter((e) => (e.platform + e.account + e.note).toLowerCase().includes(filter))
    : MOCK;

  if (data.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pwv-empty';
    const icon = document.createElement('div');
    icon.className = 'pwv-empty-icon';
    icon.textContent = '🔍';
    const t = document.createElement('div');
    t.className = 'pwv-empty-title';
    t.textContent = '没有匹配的条目';
    const d = document.createElement('div');
    d.className = 'pwv-empty-desc';
    d.textContent = '换个关键词试试，或清空搜索';
    empty.appendChild(icon);
    empty.appendChild(t);
    empty.appendChild(d);
    list.appendChild(empty);
    return;
  }

  for (const item of data) {
    list.appendChild(createRow(item));
  }
}

function createRow(item: (typeof MOCK)[number]): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'pwv-row';

  // 左列：平台（粗体）+ 账号（mono 小字）
  const col = document.createElement('div');
  col.className = 'pwv-col-platform';
  const platform = document.createElement('span');
  platform.className = 'pwv-platform';
  if (item.url) {
    const a = document.createElement('a');
    a.href = item.url;
    (a as any).target = '_blank';
    a.textContent = item.platform;
    platform.appendChild(a);
  } else {
    platform.textContent = item.platform;
  }
  const account = document.createElement('span');
  account.className = 'pwv-account';
  account.textContent = item.account;
  col.appendChild(platform);
  col.appendChild(account);

  // 密码区：掩码文字，点击显示/隐藏（无 👁、无强度条）
  const pwd = document.createElement('div');
  pwd.className = 'pwv-pwd';
  const maskEl = document.createElement('span');
  maskEl.className = 'pwv-mask';
  maskEl.textContent = dots(item.password);
  maskEl.title = '点击显示/隐藏密码';
  let shown = false;
  pwd.onclick = () => {
    shown = !shown;
    maskEl.textContent = shown ? item.password : dots(item.password);
  };
  pwd.appendChild(maskEl);

  // 时间（弱化）
  const date = document.createElement('span');
  date.className = 'pwv-date';
  date.textContent = relTime(item.createdAt);

  row.appendChild(col);
  row.appendChild(pwd);
  row.appendChild(date);
  return row;
}

function hide(): void {
  if (mask) mask.style.display = 'none';
  if (popup) popup.style.display = 'none';
}

/** 卸载清理（main.ts onunload 调用；原型入口，移除注入 DOM） */
export function unloadPasswordPreview(): void {
  const ids = ['pwv-mask', 'pwv-popup'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
  mask = null;
  popup = null;
}
