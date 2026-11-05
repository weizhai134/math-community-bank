import type { Question } from '../domain/types';
import seedQuestions from './seed/questions.json';

/**
 * 题库源数据为 JSON 种子，便于直接替换或通过界面导入。
 * JSON 中的 answer 是 string | boolean，导入后由校验器保证题型与答案一致。
 */
export const questions = seedQuestions as unknown as Question[];
