import type { Level } from '../domain/types';
import seedLevels from './seed/levels.json';

/** 关卡配置与题库解耦，存放于独立 JSON 种子。 */
export const LEVEL_SEEDS = seedLevels as unknown as Level[];
