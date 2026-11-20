import { useEffect, useRef, useState } from 'react';
import type { ShareCardData } from '../domain/shareCard';
import { renderShareCard } from '../services/shareCardService';
import { ShareCard } from './ShareCard';
import { ShareCardModal } from './ShareCardModal';

export function ShareReportButton({
  createData,
  label = '生成战报',
}: {
  createData: () => ShareCardData;
  label?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [cardData, setCardData] = useState<ShareCardData | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !cardData) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // 等一帧，确保隐藏的卡片已经完成布局。
    const timer = window.setTimeout(() => {
      const element = cardRef.current;
      if (!element) {
        setLoading(false);
        setError('战报卡片没有准备好，请重试');
        return;
      }
      renderShareCard(element)
        .then((dataUrl) => {
          if (!cancelled) setImage(dataUrl);
        })
        .catch((renderError) => {
          if (!cancelled) {
            setError(renderError instanceof Error ? renderError.message : '战报生成失败');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 30);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, cardData, generation]);

  const handleOpen = () => {
    setCardData(createData());
    setImage(null);
    setError(null);
    setOpen(true);
    setGeneration((value) => value + 1);
  };

  const handleClose = () => {
    setOpen(false);
    setLoading(false);
  };

  const handleRetry = () => {
    setImage(null);
    setError(null);
    setGeneration((value) => value + 1);
  };

  return (
    <>
      <button className="button ghost share-report-button" onClick={handleOpen}>
        {label}
      </button>

      {open && cardData ? (
        <div className="share-card-host" aria-hidden="true">
          <div ref={cardRef} className="share-card-capture">
            <ShareCard data={cardData} />
          </div>
        </div>
      ) : null}

      <ShareCardModal
        open={open}
        image={image}
        loading={loading}
        error={error}
        onClose={handleClose}
        onRetry={handleRetry}
      />
    </>
  );
}
