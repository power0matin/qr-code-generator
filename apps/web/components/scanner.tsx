'use client';

import { detectPayloadType } from '@moduqr/core';
import { Copy, ExternalLink, RefreshCw, ScanLine, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeImageFile, normalizeSafeExternalUrl } from '@/lib/qr-image';

export function Scanner() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const scanSequence = useRef(0);
  const [drag, setDrag] = useState(false);
  const [decoded, setDecoded] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const scan = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const sequence = ++scanSequence.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await decodeImageFile(file);
      if (scanSequence.current !== sequence) return;
      setDecoded(result);
    } catch (reason) {
      if (scanSequence.current !== sequence) return;
      setDecoded('');
      setError(reason instanceof Error ? reason.message : 'Could not decode this image.');
    } finally {
      if (scanSequence.current === sequence) setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((candidate) => candidate.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) void scan(file);
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [scan]);

  const copyDecoded = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API is unavailable.');
      await navigator.clipboard.writeText(decoded);
      setNotice('Copied to clipboard.');
    } catch {
      setNotice('Clipboard access is unavailable.');
    }
  };

  const redesignDecoded = () => {
    try {
      window.sessionStorage.setItem('moduqr-redesign-payload', decoded);
      router.push('/generator');
    } catch {
      setNotice('Session storage is unavailable, so this QR cannot be transferred to the editor automatically.');
    }
  };

  const type = decoded ? detectPayloadType(decoded).type : null;
  const safeUrl = decoded ? normalizeSafeExternalUrl(decoded) : null;

  return <div>
    <div
      className={`scanner-drop${drag ? ' dragging' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setDrag(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return; setDrag(false); }}
      onDrop={(event) => { event.preventDefault(); setDrag(false); void scan(event.dataTransfer.files[0]); }}
    >
      <div>
        <ScanLine size={34}/>
        <h2>Drop a QR image here</h2>
        <p>or choose PNG, JPEG, WebP, GIF, AVIF, or paste an image from your clipboard.</p>
        <button type="button" className="button primary" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload size={16}/>{busy ? 'Scanning…' : 'Choose image'}
        </button>
        <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => void scan(event.target.files?.[0])}/>
      </div>
    </div>
    {error ? <div className="scanner-result" role="alert" aria-label="Scan error"><strong>Could not scan</strong><p>{error}</p></div> : null}
    {decoded ? <section className="scanner-result" aria-live="polite">
      <span className="eyebrow">{type} detected</span>
      <h2>Decoded content</h2>
      <p>{decoded}</p>
      <div className="project-actions">
        <button className="button" type="button" onClick={() => void copyDecoded()}><Copy size={15}/> Copy</button>
        {safeUrl ? <a className="button" href={safeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Open safely</a> : null}
        <button className="button accent" type="button" onClick={redesignDecoded}><RefreshCw size={15}/> Redesign</button>
      </div>
      {safeUrl ? <p className="help">URLs are previewed before opening and never opened automatically.</p> : null}
      {notice ? <p className="help" role="status">{notice}</p> : null}
    </section> : null}
  </div>;
}
