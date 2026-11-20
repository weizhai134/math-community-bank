import { Modal } from './Modal';

export function ShareCardModal({
  open,
  image,
  loading,
  error,
  onClose,
  onRetry,
}: {
  open: boolean;
  image: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}): JSX.Element | null {
  return (
    <Modal open={open} title="我的战报" onClose={onClose}>
      {loading ? (
        <div className="share-preview-loading">
          <span className="paper-spinner" aria-hidden="true" />
          <p>正在把这一局写成战报…</p>
        </div>
      ) : error ? (
        <div className="share-preview-loading">
          <p className="paper-action-error">{error}</p>
          <button className="button ghost" onClick={onRetry}>
            再试一次
          </button>
        </div>
      ) : image ? (
        <div className="share-preview">
          <img className="share-preview-image" src={image} alt="高数闯关战报" />
          <p className="share-preview-hint">长按保存图片，分享给室友 / 朋友圈。</p>
          <div className="modal-actions">
            <a
              className="button ghost"
              href={image}
              download="高数闯关-战报.png"
            >
              保存图片
            </a>
            <button className="button primary" onClick={onClose}>
              收起
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
