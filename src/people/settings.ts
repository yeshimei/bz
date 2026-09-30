/**
 * 脸谱域（people）设置 schema（issue 446/447；聊天仓口径 issue 466 / ADR-0197；
 * 467 / ADR-0194 入保库）：数据源 / 聊天仓 / 隐私 三组，声明式（ADR-0064 渲染器）。
 * 数据根目录在 vault 外（预处理线产出），故用文本行粘贴路径而非 vault 内选择器；
 * 「清空聊天数据」经 loader 回调接线（core 不反向依赖域，knowledge 同款）。
 * 447 拍板：「打开时自动扫描」与「生成」组（GenTrigger/GenThreshold）随自动链路一并退役——
 * 扫描在打开数据源弹窗时进行，生成由弹窗内「画脸谱」手动触发。
 * 467 退役：「媒体」组（peopleMediaDir 媒体文件夹 + 头像入库说明）随明文媒体目录一并退役——
 * 头像作为密文附件随保库记录走，库内不再有明文头像目录。
 * 529：「我的头像」从文本路径行改成上传行（预览 + 上传图片 / 恢复默认），默认值 = 微信数据里
 * 扒出来的本人头像（工具 sync 轮导出到 <数据根>/.bz-face/me/avatar.<ext>，判定单源 me-avatar.ts）。
 */
import { openFlowDialog } from '../core/flow-dialog';
import { notifyActionError, notice } from '../core/notice';
import { pickSystemFiles } from '../core/path-picker';
import { saveSettings, tryGetSettings } from '../core/settings-provider';
import { mountIcons } from '../core/ui/icons';
import { myAvatarRow } from './render';
import { clearMyAvatarCache, importMyAvatarFromFile, myAvatarSource, resolveMyAvatar } from './me-avatar';
import type { SettingsSchema } from '../core/settings-schema';

export function peopleSettingsSchema(opts?: { onClearStore?: () => void | Promise<void> }): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open',
        name: '数据源',
        rows: [
          {
            type: 'text',
            name: '数据根目录',
            desc: '预处理导出的联系人数据目录，粘贴完整路径；空 = 数据源页提示先配置',
            binding: { key: 'peopleDataDir' },
            placeholder: '例如 D:\\微信备份\\export_full',
          },
          // 微信账号目录（issue 462）：多账号数据目录下指定用哪个账号；空 = 自动探测
          // （探测与覆盖逻辑由后续票接入，本票只加键位与文案）
          {
            type: 'text',
            name: '微信账号目录',
            desc: '数据目录下的微信账号文件夹，留空自动探测',
            binding: { key: 'peopleWxAccountDir' },
            placeholder: '空 = 自动探测',
          },
          {
            type: 'toggle',
            name: '群聊纳入列表',
            desc: '多位发送者的会话也进勾选列表',
            binding: { key: 'peopleIncludeGroups' },
          },
        ],
      },
      {
        icon: 'eye',
        name: '聊天仓',
        rows: [
          {
            type: 'toggle',
            name: '语音转写',
            desc: '语音消息以转写文本进时间线；转写引擎在设置面板「AI → 语音转写」里选择',
            binding: { key: 'peoplePreviewVoice' },
          },
          {
            type: 'select',
            name: '图片描述',
            desc: '有描述的图片以描述文本进时间线（chat.json 已回填，读文件为兼容兜底）；无描述只计数',
            binding: { key: 'peopleImageDescMode' },
            options: [
              { value: 'file', label: '文件描述' },
              { value: 'off', label: '仅标签' },
            ],
          },
          {
            type: 'number',
            name: '每批图片数',
            desc: '画脸谱时图片描述每批的张数，一次 AI 调用一批（默认 20）',
            binding: { key: 'peopleDescBatchSize' },
            min: 1,
            max: 100,
            step: 5,
          },
          {
            type: 'toggle',
            name: '视频标签',
            desc: '视频消息以时长标签进时间线',
            binding: { key: 'peoplePreviewVideo' },
          },
          {
            type: 'toggle',
            name: '系统消息',
            desc: '撤回与打招呼等锚点消息保留',
            binding: { key: 'peopleKeepSystem' },
          },
          {
            // issue 529：原来是「文本路径行」（要用户自己填一个库外绝对路径）——改成上传行：
            // 预览 + 上传图片 / 恢复默认。默认值 = 微信数据里扒出来的本人头像
            //（工具 sync 轮导出到 <数据根>/.bz-face/me/avatar.<ext>）
            type: 'custom',
            name: '我的头像',
            desc: '聊天里「我」那一侧的头像；默认用微信数据里导出的本人头像',
            render: (body) => renderMyAvatarRow(body),
          },
        ],
      },
      {
        icon: 'shield',
        name: '隐私',
        rows: [
          {
            type: 'info',
            name: '数据在保险库里',
            desc: '人物卡、聊天数据、任务与头像按联系人各存一条保险库加密记录，与保险库共用主密码；上锁即不可读',
          },
          {
            type: 'info',
            name: '媒体本体不入库',
            desc: '图片语音视频文件留在外部数据目录，加密记录只存消息与路径；头像以密文附件随记录走',
          },
          {
            type: 'button',
            name: '清空聊天数据',
            buttonText: '清空',
            cta: true,
            desc: '清掉各加密记录里的消息数据（需先解锁），不动已生成的脸谱',
            // issue 486：清空是不可恢复的批量数据删除，先弹确认——过去一键直通，误点即全清
            onClick: () => {
              void openFlowDialog({
                title: '清空聊天数据',
                message: '将清空所有联系人的聊天消息，不可恢复；人物卡与已生成的脸谱保留。',
                actions: [
                  { label: '取消', value: 'cancel' },
                  { label: '清空', value: 'ok', cta: true, danger: true },
                ],
              }).then((v) => {
                if (v === 'ok') void opts?.onClearStore?.();
              });
            },
          },
        ],
      },
    ],
  };
}

// ---------------- 「我的头像」上传行（issue 529） ----------------

/** 当前设置快照里与头像有关的两项（数据根用来找微信导出的本人头像） */
function avatarCtx(): { setting: string; root: string } {
  const s = tryGetSettings() as { peopleMyAvatar?: unknown; peopleDataDir?: unknown };
  return {
    setting: typeof s.peopleMyAvatar === 'string' ? s.peopleMyAvatar.trim() : '',
    root: typeof s.peopleDataDir === 'string' ? s.peopleDataDir.trim() : '',
  };
}

/** 头像行渲染（settings 的 custom 行入口）：画一次 + 事件委托（上传 / 恢复默认） */
function renderMyAvatarRow(body: HTMLElement): void {
  const draw = (): void => {
    const { setting, root } = avatarCtx();
    body.replaceChildren(myAvatarRow({
      url: resolveMyAvatar(setting, root),
      source: myAvatarSource(setting, root),
      noDataRoot: !root,
    }));
    mountIcons(body);
  };
  draw();
  body.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('[data-people-setava-pick]')) { void pickMyAvatar(draw); return; }
    if (t.closest('[data-people-setava-reset]')) { void resetMyAvatar(draw); return; }
  });
}

/** 上传：系统文件选择器选一张 → 复制进 vault 的 CONFIG/FACES/我，键值存库内相对路径 */
async function pickMyAvatar(draw: () => void): Promise<void> {
  const files = await pickSystemFiles('选择头像图片', [
    { name: '图片', ext: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
    { name: '全部文件', ext: ['*'] },
  ]);
  if (!files.length) return;
  try {
    const rel = await importMyAvatarFromFile(files[0]);
    if (!rel) {
      notice('这张图读不动或没写进 vault——换一张图片再试', 'warning');
      return;
    }
    (tryGetSettings() as { peopleMyAvatar?: string }).peopleMyAvatar = rel;
    await saveSettings();
    clearMyAvatarCache();
    draw();
    notice('头像已换成这张图', 'success');
  } catch (e) {
    notifyActionError(e, '设置头像');
  }
}

/** 恢复默认：清掉自定义键 → 回到微信数据里扒出来的本人头像（没有就回落首字印） */
async function resetMyAvatar(draw: () => void): Promise<void> {
  try {
    (tryGetSettings() as { peopleMyAvatar?: string }).peopleMyAvatar = '';
    await saveSettings();
    clearMyAvatarCache();
    draw();
    notice('头像已恢复默认', 'restore');
  } catch (e) {
    notifyActionError(e, '恢复默认头像');
  }
}
