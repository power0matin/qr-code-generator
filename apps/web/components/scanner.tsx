'use client';

import { detectPayloadType } from '@moduqr/core';
import { Copy, ExternalLink, RefreshCw, ScanLine, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { decodeImageFile, isSafeExternalUrl } from '@/lib/qr-image';

export function Scanner() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [decoded, setDecoded] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const scan = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setDecoded(await decodeImageFile(file));
    } catch (reason) {
      setDecoded('');
      setError(reason instanceof Error ? reason.message : 'Could not decode this image.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((candidate) => candidate.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) void scan(file);
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, []);


  const copyDecoded = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API is unavailable.');
      await navigator.clipboard.writeText(decoded);
      setNotice('Copied to clipboard.');
    } catch {
      setNotice('Clipboard access is unavailable.');
    }
  };

  const type = decoded ? detectPayloadType(decoded).type : null;
  const safeUrl = decoded ? isSafeExternalUrl(decoded) : false;

  return <div>
    <div className={`scanner-drop${drag ? ' dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDrag(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); void scan(event.dataTransfer.files[0]); }}>
      <div><ScanLine size={34}/><h2>Drop a QR image here</h2><p>or choose PNG, JPEG, WebP, GIF, AVIF, or paste an image from your clipboard.</p><button type="button" className="button primary" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={16}/>{busy ? 'Scanning…' : 'Choose image'}</button><input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => void scan(event.target.files?.[0])}/></div>
    </div>
    {error ? <div className="scanner-result" role="alert"><strong>Could not scan</strong><p>{error}</p></div> : null}
    {decoded ? <section className="scanner-result" aria-live="polite"><span className="eyebrow">{type} detected</span><h2>Decoded content</h2><p>{decoded}</p><div className="project-actions"><button className="button" type="button" onClick={() => void copyDecoded()}><Copy size={15}/> Copy</button>{safeUrl ? <a className="button" href={decoded} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Open safely</a> : null}<button className="button accent" type="button" onClick={() => { sessionStorage.setItem('moduqr-redesign-payload', decoded); router.push('/generator'); }}><RefreshCw size={15}/> Redesign</button></div>{safeUrl ? <p className="help">URLs are previewed before opening and never opened automatically.</p> : null}{notice ? <p className="help" role="status">{notice}</p> : null}</section> : null}
  </div>;
}
