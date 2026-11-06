import { useEffect, useRef, useState } from 'react';
import type { DailyBoxRecord, DailyReward } from '../domain/dailyBox';
import { useAppStore } from '../store/useAppStore';
import { claimDailyBox, getTodayBox } from '../services/dailyBoxService';
import { Modal } from './Modal';

export function DailyBlindBox(): JSX.Element | null {
  const showToast = useAppStore((state) => state.showToast);
  const [box, setBox] = useState<DailyBoxRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [reward, setReward] = useState<DailyReward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    getTodayBox()
      .then((record) => {
        if (active) setBox(record);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!box) return null;

  const claimed = Boolean(box.claimedAt);

  const openBox = () => {
    if (claimed) {
      showToast('今天已经领过了，明天再来');
      return;
    }
    if (opening) return;
    setOpen(true);
    setOpening(true);
    setReward(null);
    setError(null);
    timerRef.current = window.setTimeout(async () => {
      try {
        const result = await claimDailyBox();
        setReward(result);
        setBox(await getTodayBox());
        await useAppStore.getState().refresh();
      } catch (claimError) {
        setError(claimError instanceof Error ? claimError.message : '盲盒打开失败');
      } finally {
        setOpening(false);
      }
    }, 850);
  };

  return (
    <>
      <button
        type="button"
        className={`blind-box-fab ${claimed ? 'claimed' : ''} ${opening ? 'opening' : ''}`}
        onClick={openBox}
        aria-label={claimed ? '今日盲盒已领取，明天再来' : '打开每日盲盒'}
      >
        <span className="blind-box-fab-icon" aria-hidden="true">
          <span className="blind-box-fab-lid" />
          <span className="blind-box-fab-body">?</span>
        </span>
        <span className="blind-box-fab-copy">
          <strong>{claimed ? '明天再来' : '每日盲盒'}</strong>
          <small>{claimed ? '今日已领取' : '点击开启'}</small>
        </span>
      </button>

      <Modal
        open={open}
        title="每日盲盒"
        onClose={() => {
          if (!opening) setOpen(false);
        }}
      >
        <div className="blind-box-stage">
          <div
            className={`blind-box-big ${opening ? 'is-opening' : ''} ${
              reward ? 'is-open' : ''
            }`}
            aria-hidden="true"
          >
            <span className="blind-box-big-lid" />
            <span className="blind-box-big-body">?</span>
          </div>

          {reward ? (
            <div className="blind-reward">
              <span className="card-eyebrow">
                {reward.type === 'xp'
                  ? 'XP 奖励'
                  : reward.type === 'title'
                    ? '限定称号'
                    : '今日寄语'}
              </span>
              <strong>{reward.text}</strong>
              <p>
                {reward.type === 'title'
                  ? '称号已展示在首页段位旁。'
                  : reward.type === 'xp'
                    ? 'XP 已加入你的学习档案。'
                    : '收下这句话，继续今天的进度。'}
              </p>
              <button className="button primary" onClick={() => setOpen(false)}>
                收下
              </button>
            </div>
          ) : (
            <div className="blind-opening-copy">
              <strong>{opening ? '正在打开…' : '点击盲盒开启'}</strong>
              <p>每天首次完成关卡后可领取一次。</p>
            </div>
          )}

          {error ? <div className="community-notice">{error}</div> : null}
        </div>
      </Modal>
    </>
  );
}
