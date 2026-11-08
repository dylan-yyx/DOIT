export const modules = [
  {
    id: 'tasks',
    name: '待办',
    icon: 'CheckCheck',
    subtitle: '让每一件事，都有着落',
    enabled: true,
  },
  { id: 'habits', name: '打卡', icon: 'Flame', subtitle: '把微小坚持，变成日常', enabled: true },
  {
    id: 'finance',
    name: '记账',
    icon: 'Wallet',
    subtitle: '记录每笔收支，读懂生活',
    enabled: true,
  },
  { id: 'assets', name: '资产', icon: 'Landmark', subtitle: '看见积累，记录变化', enabled: true },
] as const
export type ModuleId = (typeof modules)[number]['id']
