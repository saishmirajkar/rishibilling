import { useEffect } from 'react';

interface Props {
  url: string;
  fileName: string;
  onClose: () => void;
  onDownload: () => void;
}

/** Shows the generated PDF exactly as it will be downloaded. */
export function PdfPreviewModal({ url, fileName, onClose, onDownload }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="PDF preview" onClick={(e) => e.stopPropagation()}>
        <div className="modal-bar">
          <strong>{fileName}</strong>
          <div className="modal-actions">
            <a className="button secondary" href={url} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
            <button type="button" className="primary" onClick={onDownload}>
              Download PDF
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <iframe title="Invoice PDF" src={url} />
      </div>
    </div>
  );
}
