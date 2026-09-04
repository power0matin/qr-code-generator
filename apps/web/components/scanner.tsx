'use client';

import { detectPayloadType } from '@moduqr/core';
import { Camera, CameraOff, Copy, ExternalLink, RefreshCw, ScanLine, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeCanvas, decodeImageFile, normalizeSafeExternalUrl } from '@/lib/qr-image';

type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error';

export function Scanner() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraTimer = useRef<number | null>(null);
  const scanSequence = useRef(0);
  const [drag, setDrag] = useState(false);
  const [decoded, setDecoded] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>('idle');

  const stopCamera = useCallback(() => {
    if (cameraTimer.current !== null) {
      window.clearInterval(cameraTimer.current);
      cameraTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState((state) => state === 'active' || state === 'requesting' ? 'idle' : state);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const scan = useCallback(async (file: File | undefined) => {
    if (!file) return;
    stopCamera();
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
  }, [stopCamera]);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((candidate) => candidate.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) void scan(file);
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [scan]);

  const scanCameraFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth < 1 || video.videoHeight < 1) return;
    const max = 1200;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const result = decodeCanvas(canvas);
    if (!result) return;
    setDecoded(result);
    setError('');
    setNotice('QR detected by camera. Camera stopped.');
    stopCamera();
  }, [stopCamera]);

  const startCamera = async () => {
    setDecoded('');
    setError('');
    setNotice('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      setError('Camera scanning is unavailable in this browser or context. Use image upload instead.');
      return;
    }
    stopCamera();
    setCameraState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview is unavailable.');
      video.srcObject = stream;
      await video.play();
      setCameraState('active');
      cameraTimer.current = window.setInterval(scanCameraFrame, 420);
    } catch (reason) {
      stopCamera();
      const name = reason instanceof DOMException ? reason.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCameraState('denied');
        setError('Camera permission was denied. Allow camera access for this site or use image upload.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setCameraState('unavailable');
        setError('No compatible camera was found. Use image upload instead.');
      } else {
        setCameraState('error');
        setError(reason instanceof Error ? reason.message : 'Camera could not be started.');
      }
    }
  };

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

  return <div className="scanner-shell">
    <div className="scanner-mode-actions">
      <button type="button" className="button accent" onClick={() => void startCamera()} disabled={cameraState === 'requesting' || cameraState === 'active'}><Camera size={16}/>{cameraState === 'requesting' ? 'Requesting camera…' : 'Scan with camera'}</button>
      {cameraState === 'active' ? <button type="button" className="button" onClick={stopCamera}><CameraOff size={16}/> Stop camera</button> : null}
      <span className="help">Camera frames are decoded locally and are not uploaded.</span>
    </div>

    <div className={`camera-panel${cameraState === 'active' ? ' active' : ''}`} hidden={cameraState !== 'active' && cameraState !== 'requesting'}>
      <video ref={videoRef} className="camera-preview" muted playsInline aria-label="Live camera QR scanner"/>
      <div className="camera-reticle" aria-hidden="true"/>
      <p>{cameraState === 'requesting' ? 'Waiting for camera permission…' : 'Hold the QR inside the guide.'}</p>
    </div>

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
    {error ? <div className="scanner-result" role="alert" aria-label="Scan error"><strong>Could not scan</strong><p>{error}</p>{cameraState === 'denied' ? <p className="help">Permission state is handled explicitly; upload scanning remains available.</p> : null}</div> : null}
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
