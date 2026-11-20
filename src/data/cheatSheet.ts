import sheet from './cheatSheet.json';

export interface FormulaEntry {
  id: string;
  name: string;
  latex: string;
  note?: string;
}

export interface FormulaCategory {
  id: string;
  title: string;
  entries: FormulaEntry[];
}

/** 静态公式速查，只含通用公式，不包含任何题目答案。 */
export const CHEAT_SHEET = sheet as FormulaCategory[];
