import { create } from 'zustand';
import type {
  CommunityDraft,
  CommunityFilters,
  CommunityQuestion,
  CommunitySessionInfo,
} from '../domain/communityTypes';
import {
  deleteCommunityQuestion,
  fetchCommunityPage,
  finishCommunityRun,
  listMyCommunityQuestions,
  loadCommunityRun,
  reportCommunityQuestion,
  signInWithPassword,
  signOutCommunity,
  startCommunityRun,
  todayCommunityXp,
  upgradeToEmail,
  uploadCommunityQuestion,
  type UploadResult,
} from '../services/communityService';
import {
  communityConfigured,
  describeCommunityError,
  ensureCommunitySession,
} from '../services/supabaseClient';

interface CommunityStore {
  configured: boolean;
  booting: boolean;
  session: CommunitySessionInfo | null;
  sessionError: string | null;
  items: CommunityQuestion[];
  total: number;
  page: number;
  loading: boolean;
  loadingMore: boolean;
  offline: boolean;
  error: string | null;
  cachedAt: number | null;
  filters: CommunityFilters;
  xpToday: number;
  myItems: CommunityQuestion[];
  myLoading: boolean;
  myError: string | null;
  bootstrap: () => Promise<void>;
  setFilters: (patch: Partial<CommunityFilters>) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  report: (questionId: number) => Promise<string>;
  remove: (questionId: number) => Promise<void>;
  upload: (draft: CommunityDraft) => Promise<UploadResult>;
  loadMine: () => Promise<void>;
  upgrade: (email: string, password: string) => Promise<string>;
  login: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
}

const PAGE_SIZE = 8;
let requestSeq = 0;

export const useCommunityStore = create<CommunityStore>((set, get) => {
  const loadPage = async (page: number, append: boolean): Promise<void> => {
    const seq = (requestSeq += 1);
    const { filters } = get();
    set(append ? { loadingMore: true } : { loading: true, error: null });
    const result = await fetchCommunityPage(filters, page, PAGE_SIZE);
    if (seq !== requestSeq) return;
    const deduped = append
      ? [...get().items, ...result.items.filter((item) => !get().items.some((old) => old.id === item.id))]
      : result.items;
    set({
      items: deduped,
      total: result.total,
      page,
      loading: false,
      loadingMore: false,
      offline: result.offline,
      error: result.offline ? result.errorMessage ?? null : null,
      cachedAt: result.cachedAt ?? null,
    });
  };

  return {
    configured: communityConfigured,
    booting: true,
    session: null,
    sessionError: null,
    items: [],
    total: 0,
    page: 0,
    loading: false,
    loadingMore: false,
    offline: false,
    error: null,
    cachedAt: null,
    filters: { chapter: null, difficulty: null, type: null },
    xpToday: 0,
    myItems: [],
    myLoading: false,
    myError: null,

    bootstrap: async () => {
      set({ booting: true, sessionError: null });
      // 列表与登录并行：即使匿名登录不可达或很慢，已缓存题目也能先显示。
      const sessionTask = communityConfigured
        ? ensureCommunitySession()
            .then((session) => set({ session }))
            .catch((error) => set({ session: null, sessionError: describeCommunityError(error) }))
        : Promise.resolve();
      await loadPage(0, false);
      const xp = await todayCommunityXp().catch(() => 0);
      set({ booting: false, xpToday: xp });
      await sessionTask;
    },

    setFilters: async (patch) => {
      set({ filters: { ...get().filters, ...patch } });
      await loadPage(0, false);
    },

    refresh: async () => {
      await loadPage(0, false);
      set({ xpToday: await todayCommunityXp().catch(() => get().xpToday) });
    },

    loadMore: async () => {
      if (get().loadingMore || get().loading) return;
      if (get().items.length >= get().total) return;
      await loadPage(get().page + 1, true);
    },

    report: async (questionId) => {
      try {
        const session = get().session ?? (await ensureCommunitySession());
        set({ session });
        await reportCommunityQuestion(questionId, session);
        return '已举报，达到 3 次后该题会自动隐藏。';
      } catch (error) {
        throw new Error(describeCommunityError(error));
      }
    },

    remove: async (questionId) => {
      try {
        const session = get().session ?? (await ensureCommunitySession());
        set({ session });
        await deleteCommunityQuestion(questionId, session);
        set({
          items: get().items.filter((item) => item.id !== questionId),
          myItems: get().myItems.filter((item) => item.id !== questionId),
          total: Math.max(0, get().total - 1),
        });
      } catch (error) {
        throw new Error(describeCommunityError(error));
      }
    },

    upload: async (draft) => {
      const session = get().session ?? (await ensureCommunitySession());
      set({ session });
      const result = await uploadCommunityQuestion(draft, session);
      await get().refresh();
      return result;
    },

    loadMine: async () => {
      set({ myLoading: true, myError: null });
      try {
        const session = get().session ?? (await ensureCommunitySession());
        set({ session });
        const items = await listMyCommunityQuestions(session);
        set({ myItems: items, myLoading: false });
      } catch (error) {
        set({ myLoading: false, myError: describeCommunityError(error) });
      }
    },

    upgrade: async (email, password) => {
      const message = await upgradeToEmail(email, password);
      try {
        const session = await ensureCommunitySession();
        set({ session });
      } catch {
        // 升级后可能需要邮箱确认，会话刷新失败不阻塞提示
      }
      return message;
    },

    login: async (email, password) => {
      const message = await signInWithPassword(email, password);
      const session = await ensureCommunitySession();
      set({ session });
      await get().refresh();
      await get().loadMine();
      return message;
    },

    signOut: async () => {
      await signOutCommunity();
      set({ session: null, myItems: [] });
      try {
        const session = await ensureCommunitySession();
        set({ session });
      } catch (error) {
        set({ sessionError: describeCommunityError(error) });
      }
    },
  };
});

// 供页面在进入练习前复用：取已缓存/在线的 5 题并开始
export { loadCommunityRun, startCommunityRun, finishCommunityRun };
