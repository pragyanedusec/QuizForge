import { useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

/**
 * QR Code Modal — displays a large QR code for a quiz, with the quiz title
 * overlaid and options to download or print.
 *
 * Props:
 *   quizTitle  — displayed on the QR card
 *   quizCode   — the 6-char code (e.g. "A3B7K9")
 *   onClose    — callback to dismiss
 */
export default function QRCodeModal({ quizTitle, quizCode, onClose }) {
  const canvasWrapRef = useRef(null);

  // Build the student-facing URL
  const quizUrl =
    (import.meta.env.VITE_APP_URL || window.location.origin) +
    `/quiz?code=${quizCode}`;

  // ── Download as PNG ─────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Create a higher-quality composite with title + QR
    const pad = 40;
    const titleHeight = 80;
    const footerHeight = 50;
    const w = canvas.width + pad * 2;
    const h = canvas.height + pad * 2 + titleHeight + footerHeight;

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');

    // Background
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(quizTitle, w / 2, pad + 30);

    // Subtitle
    ctx.fillStyle = '#a78bfa';
    ctx.font = '16px Inter, system-ui, sans-serif';
    ctx.fillText('Scan to take the quiz', w / 2, pad + 58);

    // QR code
    ctx.drawImage(canvas, pad, pad + titleHeight);

    // Code at bottom
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`Code: ${quizCode}`, w / 2, h - pad + 5);

    // Trigger download
    const link = document.createElement('a');
    link.download = `quiz-${quizCode}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
  }, [quizTitle, quizCode]);

  // ── Print ───────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) return;

    const printWin = window.open('', '_blank', 'width=600,height=700');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quiz QR — ${quizCode}</title>
        <style>
          body {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; min-height: 100vh; margin: 0;
            font-family: Inter, system-ui, sans-serif; text-align: center;
          }
          h1 { font-size: 28px; margin-bottom: 4px; }
          p  { color: #666; margin-bottom: 24px; font-size: 16px; }
          img { width: 280px; height: 280px; }
          .code { font-family: monospace; font-size: 24px; letter-spacing: .15em;
                   margin-top: 20px; color: #7c3aed; font-weight: 700; }
          .url { font-size: 12px; color: #999; margin-top: 12px; word-break: break-all; }
        </style>
      </head>
      <body>
        <h1>${quizTitle}</h1>
        <p>Scan to take the quiz</p>
        <img src="${canvas.toDataURL('image/png')}" alt="QR Code" />
        <div class="code">${quizCode}</div>
        <div class="url">${quizUrl}</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  }, [quizTitle, quizCode, quizUrl]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>

        {/* Header */}
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>📱 QR Code</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Quiz title */}
        <h3 style={{ fontWeight: 800, fontSize: '1.2rem', margin: '.75rem 0 .25rem' }}>
          {quizTitle}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginBottom: '1.25rem' }}>
          Students scan this to join the quiz instantly
        </p>

        {/* QR Code */}
        <div
          ref={canvasWrapRef}
          style={{
            display: 'inline-block',
            padding: '1.25rem',
            background: '#ffffff',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
          }}
        >
          <QRCodeCanvas
            value={quizUrl}
            size={240}
            level="H"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#1a1a2e"
          />
        </div>

        {/* Quiz code */}
        <div style={{
          fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 800,
          letterSpacing: '.15em', color: 'var(--accent)', marginBottom: '.5rem',
        }}>
          {quizCode}
        </div>

        {/* URL preview */}
        <div style={{
          fontSize: '.7rem', color: 'var(--text-muted)',
          wordBreak: 'break-all', marginBottom: '1.25rem', padding: '0 1rem',
        }}>
          {quizUrl}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={handleDownload}>
            ⬇ Download PNG
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
            🖨 Print
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            navigator.clipboard.writeText(quizUrl);
          }}>
            🔗 Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
