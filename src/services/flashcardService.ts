import { FLASHCARDS, type Flashcard } from '../data/flashcards';
import { db } from '../db/db';
import {
  initialFlashcardState,
  isFlashcardDue,
  scheduleFlashcard,
  type FlashcardState,
} from '../domain/flashcards';

export interface FlashcardDeckItem {
  card: Flashcard;
  state: FlashcardState;
}

/** 内置卡 + 本地状态合并；没有状态的卡视为新卡（立即到期）。 */
export async function loadFlashcardDeck(now = Date.now()): Promise<FlashcardDeckItem[]> {
  const states = await db.flashcardStates.toArray();
  const byId = new Map(states.map((state) => [state.id, state]));
  return FLASHCARDS.map((card) => ({
    card,
    state: byId.get(card.id) ?? initialFlashcardState(card.id, now),
  }));
}

export async function loadDueFlashcards(now = Date.now()): Promise<FlashcardDeckItem[]> {
  const deck = await loadFlashcardDeck(now);
  return deck
    .filter((item) => isFlashcardDue(item.state, now))
    .sort((a, b) => a.state.nextReviewAt - b.state.nextReviewAt);
}

export async function reviewFlashcard(
  cardId: string,
  remembered: boolean,
  now = Date.now(),
): Promise<FlashcardState> {
  const existing = await db.flashcardStates.get(cardId);
  const base = existing ?? initialFlashcardState(cardId, now);
  const next = scheduleFlashcard(base, remembered, now);
  await db.flashcardStates.put(next);
  return next;
}
