import { useEffect, useRef, useState } from 'react';
import { Barcode, Camera, CameraOff, Check, Keyboard, RefreshCw, X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import './barcode-scanner.css';

export type ScanResult = { message: string; kind: 'success' | 'warning'; unknownCode?: string };
type Props = {
  mode: 'product' | 'sale';
  onDetected: (value: string) => ScanResult;
  onRegisterUnknown?: (barcode: string) => void;
  onClose: () => void;
};
type NativeDetector = {
  detect: (video: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};
type DetectorClass = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats: () => Promise<string[]>;
};

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'];
const explainError = (error: unknown) => {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'A permissão da câmera foi negada. Autorize a câmera nas configurações do navegador.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Nenhuma câmera foi encontrada neste dispositivo.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'A câmera está ocupada ou indisponível. Feche outros aplicativos que a estejam usando.';
  return error instanceof Error ? error.message : 'Não foi possível iniciar a câmera.';
};

export default function BarcodeScanner({ mode, onDetected, onRegisterUnknown, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lockedCode = useRef<string | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [cameraId, setCameraId] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [status, setStatus] = useState('Preparando câmera…');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  onDetectedRef.current = onDetected;

  const accept = (raw: string) => {
    const code = raw.trim();
    if (!code || lockedCode.current === code) return;
    lockedCode.current = code;
    const response = onDetectedRef.current(code);
    setResult(response);
    setStatus('Câmera pronta');
    if (response.kind === 'success' && typeof navigator.vibrate === 'function') navigator.vibrate(65);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    let animationFrame = 0;
    let lastPoll = 0;
    let busy = false;
    const stop = () => {
      window.cancelAnimationFrame(animationFrame);
      controlsRef.current?.stop();
      controlsRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const start = async () => {
      stop();
      setError('');
      setStatus('Solicitando acesso à câmera…');
      if (!window.isSecureContext) {
        setError('A câmera exige HTTPS ou localhost. Abra o EIXO pelo endereço HTTPS configurado para o celular.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador não oferece acesso à câmera. Use a digitação manual.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: cameraId ? { deviceId: { exact: cameraId } } : { facingMode: { ideal: 'environment' } },
        });
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) { stop(); return; }
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        if (!active) { stop(); return; }
        const available = await navigator.mediaDevices.enumerateDevices();
        if (active) setCameras(available.filter(device => device.kind === 'videoinput'));
        setStatus('Aponte a câmera para o código de barras');

        const Detector = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
        let nativeDetector: NativeDetector | undefined;
        if (Detector && typeof Detector.getSupportedFormats === 'function') {
          try {
            const supported = await Detector.getSupportedFormats();
            if (BARCODE_FORMATS.every(format => supported.includes(format))) {
              nativeDetector = new Detector({ formats: BARCODE_FORMATS });
            }
          } catch { /* Use ZXing when the native detector is incompatible. */ }
        }
        if (!active) { stop(); return; }
        if (nativeDetector) {
          const detector = nativeDetector;
          const scan = async (now: number) => {
            if (!active) return;
            if (!busy && now - lastPoll > 140 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              busy = true;
              lastPoll = now;
              try {
                const values = await detector.detect(video);
                if (active && values[0]?.rawValue) accept(values[0].rawValue);
              } catch (e) {
                if (active) setError('Falha na leitura nativa. Tente alternar a câmera ou utilize a digitação manual.');
              } finally { busy = false; }
            }
            if (active) animationFrame = window.requestAnimationFrame(scan);
          };
          animationFrame = window.requestAnimationFrame(scan);
        } else {
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(stream, video, decoded => {
            if (active && decoded) accept(decoded.getText());
          });
          if (active) controlsRef.current = controls;
          else controls.stop();
        }
      } catch (e) {
        if (active) { setError(explainError(e)); setStatus('Câmera indisponível'); }
        stop();
      }
    };
    void start();
    return () => { active = false; stop(); };
  }, [cameraId]);

  const repeat = () => {
    lockedCode.current = null;
    setResult(null);
    setStatus('Aponte para o próximo código');
  };
  return (
    <div className="eixo-scan-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="eixo-scan-dialog" role="dialog" aria-modal="true" aria-label={mode === 'product' ? 'Escanear código do produto' : 'Escanear produto no PDV'}>
        <header className="eixo-scan-header">
          <div><span className="eixo-scan-eyebrow"><Barcode size={15} /> EIXO / LEITOR</span><h2>{mode === 'product' ? 'Código de barras' : 'Escanear produto'}</h2></div>
          <button type="button" className="eixo-scan-close" aria-label="Fechar leitor" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="eixo-scan-viewport">
          <video ref={videoRef} muted autoPlay playsInline aria-label="Prévia da câmera" />
          <div className="eixo-scan-target" aria-hidden="true"><span /><span /><span /><span /></div>
          {error && <div className="eixo-scan-error"><CameraOff size={24} /><p>{error}</p></div>}
        </div>
        <p className="eixo-scan-status" role="status"><Camera size={16} /> {status}</p>
        {result && <div className={'eixo-scan-result ' + result.kind} role="status">
          {result.kind === 'success' ? <Check size={18} /> : <Barcode size={18} />}
          <div><strong>{result.message}</strong>{result.unknownCode && <small>Código: {result.unknownCode}</small>}</div>
        </div>}
        {result?.unknownCode && onRegisterUnknown && <button type="button" className="eixo-scan-primary" onClick={() => onRegisterUnknown(result.unknownCode!)}>Cadastrar este produto</button>}
        <div className="eixo-scan-actions">
          {result && <button type="button" onClick={repeat}><RefreshCw size={16} /> Ler novamente</button>}
          {cameras.length > 1 && <label className="eixo-scan-camera">Câmera <select value={cameraId} onChange={e => { setCameraId(e.target.value); repeat(); }}><option value="">Traseira (automática)</option>{cameras.map((camera, i) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || 'Câmera ' + (i + 1)}</option>)}</select></label>}
          <button type="button" onClick={() => setShowManual(x => !x)}><Keyboard size={16} /> Digitar código</button>
        </div>
        {showManual && <form className="eixo-scan-manual" onSubmit={e => { e.preventDefault(); if (manual.trim()) { lockedCode.current = null; accept(manual); setManual(''); } }}>
          <label htmlFor="eixo-barcode-manual">Código de barras</label><div><input id="eixo-barcode-manual" autoFocus value={manual} onChange={e => setManual(e.target.value)} placeholder="Digite ou use um leitor USB" inputMode="numeric" /><button type="submit">Usar código</button></div>
        </form>}
        <p className="eixo-scan-hint">{mode === 'sale' ? 'Cada código adiciona uma unidade ao carrinho. Para repetir o mesmo item, toque em “Ler novamente”.' : 'Centralize o código dentro da moldura. A leitura preenche o cadastro automaticamente.'}</p>
      </section>
    </div>
  );
}
