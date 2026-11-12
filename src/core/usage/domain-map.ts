export const USAGE_DOMAINS = [
  'core',
  'home',
  'memo',
  'belongings',
  'clipbook',
  'auto-summary',
  'diary',
  'favorites',
  'people',
  'reading-report',
  'cinema',
  'gameshelf',
  'bookshelf',
  'review',
  'secondbrain',
  'pomodoro',
  'knowledge',
  'attach',
  'encrypt',
  'password-vault',
  'smartcat',
  'settings-panel',
  'checkup',
  'dock',
  'other',
] as const;

export type UsageDomain = (typeof USAGE_DOMAINS)[number];

const PREFIX_OVERRIDES: ReadonlyArray<readonly [string, UsageDomain]> = [
  ['bz-password-vault-', 'password-vault'],
  ['bz-auto-summary-', 'auto-summary'],
  ['bz-settings-panel-', 'settings-panel'],
  ['bz-data-checkup-', 'checkup'],
  ['bz-reading-report-', 'bookshelf'],
  ['bz-dock-run-', 'dock'],
  ['bz-core-', 'core'],
];

const COMMAND_RE = /^bz-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCommandId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 3 && id.length <= 96 && COMMAND_RE.test(id);
}

export function domainOfCommand(id: string): UsageDomain {
  if (!isCommandId(id)) return 'other';
  for (const [prefix, domain] of PREFIX_OVERRIDES) {
    if (id.startsWith(prefix)) return domain;
  }
  const rest = id.slice(3);
  const dash = rest.indexOf('-');
  const head = dash === -1 ? rest : rest.slice(0, dash);
  return (USAGE_DOMAINS as readonly string[]).includes(head) ? (head as UsageDomain) : 'other';
}

export function isUsageDomain(v: unknown): v is UsageDomain {
  return typeof v === 'string' && (USAGE_DOMAINS as readonly string[]).includes(v);
}
