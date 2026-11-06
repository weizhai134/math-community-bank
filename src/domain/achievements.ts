export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** 累积型成就的目标值；一次性成就为空。 */
  target?: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-basic',
    title: '初出茅庐',
    description: '首次通关任意基础关。',
    icon: '初',
  },
  {
    id: 'hundred-correct',
    title: '百题斩',
    description: '累计做对 100 道题。',
    icon: '百',
    target: 100,
  },
  {
    id: 'night-owl',
    title: '夜猫子',
    description: '在凌晨 0:00 - 4:00 之间完成一次刷题。',
    icon: '夜',
  },
  {
    id: 'combo-master',
    title: '连击大师',
    description: '单次关卡内达成 5 连击。',
    icon: '连',
  },
];

export interface AchievementState {
  id: string;
  /** 累积型成就的当前进度；一次性成就为 0/1。 */
  progress: number;
  unlockedAt?: number;
}

export interface AchievementEvent {
  correct: number;
  maxCombo: number;
  finishedAt: number;
  basicCleared: boolean;
}
