/**
 * 归物本 · 数据 emoji → lucide 图标映射（issue 231，用户拍板「全部转换」）
 *
 * 键 = 分类首字符的 emoji（catEmoji 输出，不带变体选择符 U+FE0F）；
 * 值 = lucide 图标名。双重来源约束：
 *   - 插件端 setIcon 走 Obsidian 内置 lucide 表（asar 实测 1881 键，逐名验证在表）；
 *   - 原型端 prototype-icons.js 由 lucide-static 生成，同名字路径一致。
 * lucide 无对应的 emoji 用文档化近义兜底（衣物→shirt / 鞋→footprints /
 * 动物→paw-print / 球类→volleyball / 雪上→snowflake / 水上→waves 等），
 * 分类名文字始终并列展示，兜底不产生歧义。未入表的 emoji 由调用方原样兜底。
 */
export const EMOJI_ICON: Record<string, string> = {
  /* ---- 数码影音 ---- */
  '📱': 'smartphone', '💻': 'laptop', '🖥': 'monitor', '⌚': 'watch', '🎧': 'headphones',
  '🔊': 'speaker', '🖨': 'printer', '📷': 'camera', '🔍': 'aperture', '📹': 'video',
  '🪞': 'focus', '📽': 'projector', '🎮': 'gamepad-2', '⌨': 'keyboard', '💾': 'hard-drive',
  '📀': 'disc', '🔌': 'plug', '🔋': 'battery-charging', '💡': 'lightbulb', '📺': 'tv',
  '📡': 'router', '📶': 'signal', '📞': 'phone',
  /* ---- 衣服饰品 ---- */
  '👕': 'shirt', '👔': 'shirt', '🧥': 'shirt', '👖': 'shirt', '👗': 'shirt', '👘': 'shirt',
  '🩳': 'shirt', '🧦': 'footprints', '👙': 'shirt', '👠': 'footprints', '👞': 'footprints',
  '👟': 'footprints', '👜': 'handbag', '🎒': 'backpack', '🧣': 'shirt', '🧤': 'hand',
  '👒': 'hard-hat', '🕶': 'glasses', '👓': 'glasses', '💍': 'gem', '📿': 'gem', '💎': 'gem',
  '🧢': 'hard-hat', '🎩': 'hard-hat', '💄': 'sparkles', '💋': 'heart', '👁': 'eye',
  '📏': 'ruler', '👀': 'eye', '💅': 'hand', '🧴': 'droplets', '🧼': 'droplets',
  '💧': 'glass-water', '🛡': 'shield', '🎭': 'smile', '💆': 'hand', '✂': 'scissors',
  '🧽': 'droplets', '🪒': 'zap', '🚿': 'shower-head', '💇': 'scissors',
  /* ---- 家居 ---- */
  '🛏': 'bed', '🛋': 'sofa', '🪑': 'armchair', '🗄': 'archive', '📚': 'library',
  '🪟': 'align-justify', '🧹': 'brush-cleaning', '🚽': 'droplets', '🪥': 'sparkles',
  '🧻': 'scroll', '🪣': 'droplets', '🗑': 'trash-2', '🔑': 'key-round',
  /* ---- 厨房餐茶 ---- */
  '🍳': 'cooking-pot', '🔪': 'slice', '🍽': 'utensils', '☕': 'coffee', '🍶': 'coffee',
  '🍵': 'coffee', '🥄': 'utensils', '🍴': 'utensils', '🥢': 'utensils', '🧂': 'soup',
  '🍯': 'droplets', '🍚': 'wheat', '🧊': 'refrigerator', '🔥': 'flame', '🍞': 'croissant',
  '🥛': 'milk', '🍹': 'cup-soda', '❄': 'snowflake', '🥘': 'cooking-pot', '🛀': 'bath',
  '💨': 'fan', '🌫': 'cloud-fog', '📖': 'book-open',
  /* ---- 文具乐玩 ---- */
  '✏': 'pencil', '🖊': 'pen', '📒': 'notebook', '🎨': 'palette', '🎸': 'guitar',
  '🎹': 'piano', '🥁': 'drum', '🎤': 'mic', '🧩': 'puzzle', '🎲': 'dices',
  /* ---- 运动户外 ---- */
  '🏸': 'volleyball', '⚽': 'volleyball', '🏃': 'footprints', '🧘': 'person-standing',
  '🏊': 'waves', '🎣': 'fish', '🔧': 'wrench', '🔨': 'hammer', '🪛': 'wrench',
  '🔩': 'cog', '🛠': 'hammer', '🪚': 'axe', '🧰': 'briefcase', '🪓': 'axe', '⛏': 'shovel',
  '🖼': 'image', '🏺': 'amphora', '🧸': 'baby', '🔮': 'sparkles', '🎞': 'film',
  '🪙': 'coins', '🏆': 'trophy', '🎖': 'medal', '📜': 'scroll', '📸': 'camera',
  /* ---- 医药健康 ---- */
  '💊': 'pill', '🌡': 'thermometer', '🩹': 'bandage', '🩺': 'stethoscope', '💉': 'syringe',
  '🦷': 'sparkles', '🩸': 'droplet', '⚖': 'scale',
  /* ---- 礼节节庆 ---- */
  '🧳': 'luggage', '🎁': 'gift', '🕯': 'flame', '🧨': 'bomb', '🌂': 'umbrella',
  '☂': 'umbrella', '⛱': 'umbrella', '🧭': 'compass', '🔭': 'telescope', '💐': 'flower',
  '🌿': 'leaf', '🐠': 'fish', '🐶': 'dog', '🚗': 'car', '🚲': 'bike', '🛴': 'bike',
  '⛺': 'tent', '📦': 'package',
  /* ---- 办公纸媒 ---- */
  '📎': 'paperclip', '📌': 'pin', '🖇': 'paperclip', '📋': 'clipboard-list', '📁': 'folder',
  '🗂': 'folder', '📊': 'chart-bar', '📐': 'ruler', '🧮': 'calculator', '📇': 'contact',
  '🖍': 'highlighter', '🖌': 'paintbrush', '📫': 'mail', '📮': 'mail', '✉': 'mail',
  '🏷': 'tag', '📑': 'bookmark', '🔖': 'bookmark', '📰': 'newspaper', '🗞': 'newspaper',
  '📓': 'notebook', '📔': 'notebook-pen', '📕': 'book', '📗': 'book', '📘': 'book',
  '📙': 'book', '🧷': 'paperclip', '🔒': 'lock', '💼': 'briefcase', '🗳': 'vote',
  '🖋': 'pen-tool', '✒': 'pen-tool', '📝': 'pen-line', '💵': 'banknote', '💳': 'credit-card',
  '🧾': 'receipt', '📄': 'file-text', '📃': 'file-text', '🗒': 'notebook-pen',
  '📅': 'calendar', '🕐': 'alarm-clock', '🗓': 'calendar-days', '📆': 'calendar',
  '📈': 'trending-up', '📉': 'trending-down', '🖱': 'mouse', '🗃': 'archive', '🔗': 'link',
  /* ---- 球类冰雪水上 ---- */
  '🏀': 'volleyball', '🏈': 'volleyball', '⚾': 'volleyball', '🎾': 'volleyball',
  '🏐': 'volleyball', '🏉': 'volleyball', '🎱': 'volleyball', '🏓': 'volleyball',
  '🥅': 'target', '🏑': 'volleyball', '🏒': 'volleyball', '🥍': 'volleyball',
  '🏏': 'volleyball', '🎿': 'snowflake', '⛷': 'snowflake', '🏂': 'snowflake',
  '🪂': 'umbrella', '🏄': 'waves', '🛹': 'bike', '🛼': 'footprints', '🚴': 'bike',
  '🛶': 'sailboat', '🤿': 'waves', '⛸': 'snowflake', '🎯': 'target', '🪀': 'circle-dot',
  '🏹': 'crosshair', '🪁': 'wind', '🥊': 'hand', '🥋': 'shirt', '⚔': 'swords',
  '🤺': 'swords', '🥌': 'circle-dot', '🎳': 'volleyball', '🏌': 'flag', '⛳': 'flag',
  '🤸': 'person-standing', '🤽': 'waves', '🤾': 'person-standing', '🧗': 'mountain',
  '🏇': 'paw-print', '🤹': 'orbit', '🎪': 'tent', '🤼': 'users', '🥏': 'disc',
  /* ---- 奖章票庆 ---- */
  '🥇': 'medal', '🥈': 'medal', '🥉': 'medal', '🏅': 'medal', '🎗': 'ribbon',
  '🏵': 'flower', '🤡': 'smile', '🎟': 'ticket', '🎫': 'ticket', '🎀': 'ribbon',
  '🎈': 'party-popper', '🎉': 'party-popper', '🎊': 'sparkles', '🎋': 'sprout',
  '🎍': 'sprout', '🎎': 'baby', '🎏': 'flag', '🎐': 'bell', '🎑': 'moon', '🧧': 'wallet',
  /* ---- 服饰鞋靴二批 ---- */
  '🥽': 'glasses', '🥼': 'shirt', '🦺': 'shield', '🥾': 'footprints', '🥿': 'footprints',
  '🩰': 'footprints', '👢': 'footprints', '👡': 'footprints', '🩴': 'footprints',
  /* ---- 车船航空 ---- */
  '🚙': 'car', '🚐': 'bus', '🚚': 'truck', '🚛': 'truck', '🚜': 'tractor', '🏎': 'car',
  '🚓': 'car', '🚑': 'ambulance', '🚒': 'truck', '🚨': 'siren', '🚔': 'car', '🚍': 'bus',
  '🚋': 'tram-front', '🚃': 'train-front', '🚝': 'train-front', '🚄': 'train-front',
  '🚅': 'train-front', '🚈': 'tram-front', '🚊': 'tram-front', '🚞': 'train-front',
  '🚟': 'cable-car', '🚠': 'cable-car', '🚡': 'cable-car', '🚢': 'ship', '🛳': 'ship',
  '⛴': 'ship', '🚤': 'ship', '🛥': 'ship', '⛵': 'sailboat', '🚣': 'ship', '🛷': 'snowflake',
  '🚁': 'helicopter', '✈': 'plane', '🛩': 'plane', '🛫': 'plane-takeoff',
  '🛬': 'plane-landing', '💺': 'armchair', '🚀': 'rocket', '🛸': 'disc', '🛰': 'satellite',
  '🚏': 'bus', '⛽': 'fuel', '🛞': 'circle-dot', '🛢': 'database', '🧪': 'flask-conical',
  '🧯': 'flame', '🔦': 'flashlight', '🎵': 'music',
  /* ---- 动物（lucide 无种别图的落 paw-print / 鸟禽落 bird / 海洋落 fish） ---- */
  '🐱': 'cat', '🐭': 'rat', '🐹': 'rat', '🐰': 'rabbit', '🦊': 'paw-print', '🐻': 'paw-print',
  '🐼': 'paw-print', '🐨': 'paw-print', '🐯': 'paw-print', '🦁': 'paw-print', '🐮': 'paw-print',
  '🐷': 'piggy-bank', '🐸': 'paw-print', '🐙': 'fish', '🐵': 'paw-print', '🐔': 'egg',
  '🐧': 'bird', '🐦': 'bird', '🐤': 'bird', '🦆': 'bird', '🦅': 'bird', '🦉': 'bird',
  '🦇': 'bird', '🐺': 'paw-print', '🐗': 'paw-print', '🐴': 'paw-print', '🦄': 'sparkles',
  '🐝': 'bug', '🐛': 'bug', '🦋': 'flower', '🐌': 'snail', '🐞': 'bug', '🐜': 'bug',
  '🦗': 'bug', '🕷': 'bug', '🦂': 'bug', '🦀': 'shell', '🐟': 'fish', '🐡': 'fish',
  '🐬': 'fish', '🐳': 'fish', '🐋': 'fish', '🦈': 'fish', '🐊': 'paw-print', '🐅': 'paw-print',
  '🐆': 'paw-print', '🦓': 'paw-print', '🦍': 'paw-print', '🦧': 'paw-print', '🐘': 'paw-print',
  '🦛': 'paw-print', '🦏': 'paw-print', '🐫': 'paw-print', '🦒': 'paw-print', '🐃': 'paw-print',
  '🐂': 'paw-print', '🐄': 'paw-print', '🐪': 'paw-print',
  /* ---- 草木 ---- */
  '🌱': 'sprout', '🌲': 'tree-pine', '🌳': 'tree-deciduous', '🌴': 'tree-palm',
  '🌵': 'sprout', '🌷': 'flower', '🌸': 'flower', '🌹': 'flower', '🌺': 'flower-2',
  '🌻': 'flower-2', '🌼': 'flower', '🌾': 'wheat', '🍀': 'leaf', '🍁': 'leaf',
  '🍂': 'leaf', '🍃': 'leaf', '🌰': 'nut', '🎄': 'tree-pine',
  /* ---- 虚构/宠物玩偶 ---- */
  '🤖': 'bot', '👾': 'ghost', '🐲': 'baby', '🦖': 'baby', '🦕': 'baby', '🐉': 'baby',
  '🦐': 'shrimp', '🦞': 'shrimp', '🐢': 'turtle', '🐍': 'worm', '🦎': 'paw-print',
  '🐖': 'piggy-bank', '🐑': 'paw-print', '🐐': 'paw-print', '🐎': 'paw-print',
  /* ---- 乐器声响 ---- */
  '🎺': 'megaphone', '🎷': 'megaphone', '🪕': 'guitar', '🎻': 'guitar', '🎼': 'music',
  '🎶': 'music', '📻': 'radio', '🎚': 'audio-lines', '🎛': 'sliders-horizontal',
  '📢': 'megaphone', '📯': 'megaphone', '🔔': 'bell', '🪗': 'audio-lines', '🪘': 'drum',
  '🪈': 'wind', '🎥': 'film', '💿': 'disc', '📼': 'videotape', '🗺': 'map', '🦟': 'bug',
  '🪢': 'cable', '🪜': 'waves-ladder', '👑': 'crown',
};

/** 分类串拆分（迁移与渲染兜底共用）：取首字符 emoji（含变体选择符），剥前缀得纯文字分类名，查表得图标名 */
export function splitEmojiCategory(cat: string): { emoji: string | null; name: string; icon: string | null } {
  const s = String(cat || '');
  const m = s.match(/^(\p{Extended_Pictographic})\uFE0F?/u);
  if (!m) return { emoji: null, name: s, icon: null };
  return { emoji: m[1], name: s.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, ''), icon: EMOJI_ICON[m[1]] ?? null };
}
