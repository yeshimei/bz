/**
 * 脸谱域（people）入口（issue 435/447 / ADR-0191）：命令回调与生命周期清理。
 * 命令 bz-people-open / bz-people-import 在 main.ts COMMANDS 表注册（ADR-0004 裸注册通道），
 * 域内不重复 addCommand。
 */
import type { App } from 'obsidian';
import { closePeoplePanel, isPeopleOpen, openDataSource, openPeoplePanel } from './ui';

/** 打开脸谱（toggle：开着再点关闭） */
export function openPeople(_app: App): void {
  if (isPeopleOpen()) closePeoplePanel();
  else openPeoplePanel(_app);
}

/** 直开数据源弹窗（bz-people-import；447：文件向导退役，导入统一走数据源） */
export function importWechat(_app: App): void {
  openPeoplePanel(_app);
  openDataSource();
}

/** 卸载清理（main.ts onunload 调用；未开面板为幂等空清理） */
export function unloadPeople(): void {
  closePeoplePanel();
}
