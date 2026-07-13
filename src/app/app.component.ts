import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface HookCandidate {
  start_time: number;
  end_time: number;
  title: string;
  reason: string;
  video_url?: string;
  is_manual?: boolean;
}

interface VideoProcessingResult {
  hooks: HookCandidate[];
  selectedHook: HookCandidate;
  videoUrl: string;
}

type ProcessingState = 'IDLE' | 'UPLOADING' | 'TRANSCRIBING' | 'ANALYZING' | 'RENDERING' | 'COMPLETE' | 'ERROR';
type CropPosition = 'left' | 'center' | 'right';
type CropMode = 'static' | 'linear' | 'eased';
type CaptionPosition = 'top' | 'middle' | 'bottom';
type TextAnimation = 'none' | 'fade' | 'pop' | 'slide';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private simulationInterval: ReturnType<typeof setInterval> | null = null;

  @ViewChild('sourceVideo') sourceVideoRef?: ElementRef<HTMLVideoElement>;

  // If hosting frontend on Vercel and backend on MonsterASP.net, 
  // replace 'window.location.origin' with your MonsterASP.net URL (e.g., 'https://your-backend.monsterasp.net')
  readonly backendUrl = window.location.port === '4200' 
    ? `http://${window.location.hostname}:5101` 
    : window.location.origin;

  readonly fonts = [
    { name: 'Impact',     value: 'Impact, sans-serif' },
    { name: 'Clean Bold', value: 'Arial, sans-serif' },
    { name: 'Modern',     value: 'Outfit, sans-serif' },
    { name: 'Editorial',  value: 'Georgia, serif' },
    { name: 'Mono',       value: 'monospace' }
  ];
  readonly captionPositions: CaptionPosition[] = ['top', 'middle', 'bottom'];
  readonly animations: TextAnimation[] = ['none', 'fade', 'pop', 'slide'];
  readonly cropPositions: CropPosition[] = ['left', 'center', 'right'];
  readonly cropModes: CropMode[] = ['static', 'linear', 'eased'];

  // ── State ──────────────────────────────────────────────────────────────────
  selectedFile: File | null = null;
  localVideoUrl = '';
  videoDuration = 0;
  apiLimits: any = null;
  trimStart = 0;
  trimEnd = 30;
  dragOver = false;
  processingState: ProcessingState = 'IDLE';
  uploadProgress = 0;
  errorMessage = '';
  errorDetail = '';
  result: VideoProcessingResult | null = null;
  selectedHook: HookCandidate | null = null;
  manualHookResult: HookCandidate | null = null;
  aiHookResults: HookCandidate[] = [];
  inputMode: 'FILE' | 'URL' = 'FILE';
  videoUrlInput = '';
  manualTrimEnabled = false;

  // ── API Keys page ──────────────────────────────────────────────────────────
  showKeysPage = false;
  groqKeyInput = '';
  geminiKeyInput = '';
  showGroqKey = false;
  showGeminiKey = false;
  groqKeyStatus: 'idle' | 'validating' | 'valid' | 'invalid' = 'idle';
  geminiKeyStatus: 'idle' | 'validating' | 'valid' | 'invalid' = 'idle';
  groqKeyMessage = '';
  geminiKeyMessage = '';
  keysSaving = false;
  keysSaveMessage = '';
  keysSaveError = '';
  keyStoreStatus: { groq_configured: boolean; gemini_configured: boolean; groq_source: string; gemini_source: string } | null = null;

  // ── Style settings ─────────────────────────────────────────────────────────
  useAi = true;
  cropPosition: CropPosition = 'center';
  cropMode: CropMode = 'static';
  captionText = 'YOUR TEXT HERE';
  captionFont = this.fonts[0].value;
  captionColor = '#ffffff';
  accentColor = '#a855f7';
  captionPosition: CaptionPosition = 'bottom';
  textAnimation: TextAnimation = 'pop';

  // ── Accessors ──────────────────────────────────────────────────────────────
  private get _video(): HTMLVideoElement | null {
    return this.sourceVideoRef?.nativeElement ?? null;
  }

  get isYoutubeUrl(): boolean {
    return /^(https?:\/\/)?([a-zA-Z0-9\-]+\.)?(youtube\.com|youtu\.be)\//i.test(this.videoUrlInput);
  }

  get youtubeVideoId(): string {
    if (!this.isYoutubeUrl) return '';
    const m = this.videoUrlInput.match(/(?:v=|youtu\.be\/)([^&?\/\s]+)/);
    return m ? m[1] : '';
  }

  get hasVideoLoaded(): boolean {
    return !!(this.localVideoUrl || this.youtubeVideoId);
  }

  get trimStartPercent(): number {
    const dur = this.videoDuration || 100;
    return Math.max(0, Math.min(100, (this.trimStart / dur) * 100));
  }

  get trimEndPercent(): number {
    const dur = this.videoDuration || 100;
    return Math.max(0, Math.min(100, (this.trimEnd / dur) * 100));
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────
  onDragOver(event: DragEvent) { event.preventDefault(); this.dragOver = true; }
  onDragLeave(event: DragEvent) { event.preventDefault(); this.dragOver = false; }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File) {
    if (file.type !== 'video/mp4' && !file.name.toLowerCase().endsWith('.mp4')) {
      this.errorMessage = 'Please select an MP4 video file.';
      return;
    }
    this.releaseLocalVideo();
    this.localVideoUrl = URL.createObjectURL(file);
    this.selectedFile = file;
    this.errorMessage = '';
    this.errorDetail = '';
    this.result = null;
    this.selectedHook = null;
    this.processingState = 'IDLE';
  }

  // ── Video metadata ─────────────────────────────────────────────────────────
  onMetadataLoaded() {
    const v = this._video;
    if (!v) return;
    this.videoDuration = Number.isFinite(v.duration) ? v.duration : 0;
    this.trimStart = 0;
    this.trimEnd = Math.min(this.videoDuration || 30, 30);
  }

  // ── Dual-handle trim slider ────────────────────────────────────────────────
  onDualRangeStart(rawValue: number) {
    this.trimStart = Math.min(+rawValue, Math.max(0, this.trimEnd - 0.1));
    const v = this._video;
    if (v) v.currentTime = this.trimStart;
  }

  onDualRangeEnd(rawValue: number) {
    this.trimEnd = Math.max(+rawValue, this.trimStart + 0.1);
    const v = this._video;
    if (v) v.currentTime = this.trimEnd;
  }

  // ── URL handling ───────────────────────────────────────────────────────────
  onUrlChanged(value: string) {
    const isHttp = value && (value.startsWith('http://') || value.startsWith('https://'));
    if (!isHttp) {
      this.releaseLocalVideo();
      this.videoDuration = 0;
      return;
    }

    this.errorMessage = '';
    this.errorDetail = '';
    this.result = null;
    this.selectedHook = null;
    this.processingState = 'IDLE';

    if (this.isYoutubeUrl) {
      // Cannot embed YouTube directly; use thumbnail preview
      this.releaseLocalVideo();
      this.videoDuration = 180; // safe estimate for cost calc
      this.trimStart = 0;
      this.trimEnd = 30;
    } else {
      // Direct MP4 / Instagram — try to load in <video>
      this.releaseLocalVideo();
      this.localVideoUrl = value;
    }
  }

  onThumbError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.src.includes('maxresdefault')) {
      img.src = img.src.replace('maxresdefault', 'hqdefault');
    }
  }

  // ── Job submission ─────────────────────────────────────────────────────────
  processVideo() {
    if (!this.selectedFile) return;
    this.beginProcessing();

    const formData = new FormData();
    formData.append('file', this.selectedFile, this.selectedFile.name);
    this.appendRenderOptions(formData);

    this.http.post<VideoProcessingResult>(`${this.backendUrl}/api/video/process`, formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round((100 * event.loaded) / event.total);
          if (this.uploadProgress >= 100) this.startBackendPipelineSimulation();
        } else if (event.type === HttpEventType.Response) {
          this.finishProcessing(event.body);
        }
      },
      error: (err) => this.failProcessing(err)
    });
  }

  processVideoUrl() {
    if (!this.videoUrlInput) return;
    this.beginProcessing();
    this.uploadProgress = 100;
    this.startBackendPipelineSimulation();

    this.http.post<VideoProcessingResult>(`${this.backendUrl}/api/video/process-url`, {
      videoUrl: this.videoUrlInput,
      ...this.renderOptions()
    }).subscribe({
      next: (res) => this.finishProcessing(res),
      error: (err) => this.failProcessing(err)
    });
  }

  submitJob() {
    if (this.inputMode === 'FILE') this.processVideo();
    else this.processVideoUrl();
  }

  private appendRenderOptions(formData: FormData) {
    Object.entries(this.renderOptions()).forEach(([key, value]) => formData.append(key, String(value)));
  }

  private renderOptions() {
    return {
      useAi: this.useAi,
      manualTrimEnabled: this.manualTrimEnabled,
      startTime: this.trimStart,
      endTime: this.trimEnd,
      cropPosition: this.cropPosition,
      cropMode: this.cropMode,
      captionText: this.captionText,
      captionFont: this.fonts.find(f => f.value === this.captionFont)?.name || 'Impact',
      captionColor: this.captionColor,
      accentColor: this.accentColor,
      captionPosition: this.captionPosition,
      textAnimation: this.textAnimation
    };
  }

  // ── Processing lifecycle ───────────────────────────────────────────────────
  private beginProcessing() {
    this.processingState = 'UPLOADING';
    this.uploadProgress = 0;
    this.errorMessage = '';
    this.errorDetail = '';
    this.result = null;
    this.selectedHook = null;
    this.manualHookResult = null;
    this.aiHookResults = [];
  }

  private finishProcessing(result: VideoProcessingResult | null) {
    this.clearSimulation();
    this.result = result;
    this.selectedHook = result?.selectedHook || result?.hooks?.[0] || null;
    this.manualHookResult = result?.hooks?.find(h => h.is_manual) ?? null;
    this.aiHookResults   = result?.hooks?.filter(h => !h.is_manual) ?? [];
    this.processingState = 'COMPLETE';
    this.fetchApiLimits();
  }

  private failProcessing(err: any) {
    this.clearSimulation();
    this.processingState = 'ERROR';
    this.errorMessage = err.status === 0
      ? `Backend connection lost. Check that ${this.backendUrl}/health responds, then retry.`
      : err.error?.error || err.message || 'An error occurred during video processing.';
    this.errorDetail = err.status === 0
      ? `No HTTP response received. Backend: ${this.backendUrl}. Check logs/backend.log on the server.`
      : [
          err.error?.runId  ? `Run ID: ${err.error.runId}`       : '',
          err.error?.stage  ? `Stage:  ${err.error.stage}`       : '',
          err.error?.detail || ''
        ].filter(Boolean).join('\n\n');
  }

  private startBackendPipelineSimulation() {
    this.processingState = this.useAi ? 'TRANSCRIBING' : 'RENDERING';
    let elapsed = 0;
    this.clearSimulation();
    this.simulationInterval = setInterval(() => {
      elapsed++;
      if (this.useAi && this.processingState === 'TRANSCRIBING' && elapsed > 6)  this.processingState = 'ANALYZING';
      if (this.useAi && this.processingState === 'ANALYZING'    && elapsed > 12) this.processingState = 'RENDERING';
    }, 1000);
  }

  private clearSimulation() {
    if (this.simulationInterval) { clearInterval(this.simulationInterval); this.simulationInterval = null; }
  }

  // ── UI actions ─────────────────────────────────────────────────────────────
  selectHook(hook: HookCandidate) { this.selectedHook = hook; }

  downloadVideo() {
    const h = this.selectedHook || this.result?.selectedHook;
    const url = h?.video_url || this.result?.videoUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = `${this.backendUrl}${url}`;
    a.download = `${(h?.title || 'short_video').replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  setInputMode(mode: 'FILE' | 'URL') {
    this.inputMode = mode;
    this.errorMessage = '';
    this.errorDetail = '';
    this.reset();
  }

  reset() {
    this.releaseLocalVideo();
    this.selectedFile     = null;
    this.videoUrlInput    = '';
    this.videoDuration    = 0;
    this.processingState  = 'IDLE';
    this.uploadProgress   = 0;
    this.errorMessage     = '';
    this.result           = null;
    this.selectedHook     = null;
    this.manualHookResult = null;
    this.aiHookResults    = [];
    this.clearSimulation();
    this.fetchApiLimits();
  }

  // ── API limits & cost estimate ─────────────────────────────────────────────
  ngOnInit()  { this.fetchApiLimits(); this.fetchKeyStatus(); }
  ngOnDestroy() { this.releaseLocalVideo(); this.clearSimulation(); }

  // ── API Keys page ──────────────────────────────────────────────────────────
  openKeysPage()  { this.showKeysPage = true; this.keysSaveMessage = ''; this.keysSaveError = ''; }

  closeKeysPage() {
    // If no keys are configured at all, block closing and show a hint
    if (!this.keyStoreStatus?.groq_configured || !this.keyStoreStatus?.gemini_configured) {
      this.keysSaveError = 'Please save both API keys before continuing.';
      return;
    }
    this.showKeysPage = false;
  }

  fetchKeyStatus() {
    this.http.get<any>(`${this.backendUrl}/api/keys/status`).subscribe({
      next: (s) => {
        this.keyStoreStatus = s;
        // Auto-open keys page if either key is not configured
        if (!s.groq_configured || !s.gemini_configured) {
          this.showKeysPage = true;
          this.keysSaveError = '';
          this.keysSaveMessage = '';
        }
      },
      error: () => {}
    });
  }

  validateKey(provider: 'groq' | 'gemini') {
    const key = provider === 'groq' ? this.groqKeyInput : this.geminiKeyInput;
    if (!key.trim()) return;

    if (provider === 'groq') { this.groqKeyStatus = 'validating'; this.groqKeyMessage = ''; }
    else                     { this.geminiKeyStatus = 'validating'; this.geminiKeyMessage = ''; }

    this.http.post<any>(`${this.backendUrl}/api/keys/validate`, { provider, key }).subscribe({
      next: (res) => {
        if (provider === 'groq')   { this.groqKeyStatus   = res.valid ? 'valid' : 'invalid'; this.groqKeyMessage   = res.message; }
        else                       { this.geminiKeyStatus = res.valid ? 'valid' : 'invalid'; this.geminiKeyMessage = res.message; }
      },
      error: (err) => {
        const msg = err.error?.message || 'Validation failed. Check network.';
        if (provider === 'groq')   { this.groqKeyStatus   = 'invalid'; this.groqKeyMessage   = msg; }
        else                       { this.geminiKeyStatus = 'invalid'; this.geminiKeyMessage = msg; }
      }
    });
  }

  saveKeys() {
    this.keysSaving = true;
    this.keysSaveMessage = '';
    this.keysSaveError = '';

    const payload: any = {};
    if (this.groqKeyInput.trim())   payload.groqApiKey   = this.groqKeyInput.trim();
    if (this.geminiKeyInput.trim()) payload.geminiApiKey = this.geminiKeyInput.trim();

    if (!payload.groqApiKey && !payload.geminiApiKey) {
      this.keysSaveError = 'Enter at least one API key.';
      this.keysSaving = false;
      return;
    }

    this.http.post<any>(`${this.backendUrl}/api/keys/save`, payload).subscribe({
      next: (res) => {
        this.keysSaving = false;
        this.keysSaveMessage = '✓ Keys saved successfully!';
        this.groqKeyInput = '';
        this.geminiKeyInput = '';
        this.groqKeyStatus = 'idle';
        this.geminiKeyStatus = 'idle';

        // Refresh status then auto-close if BOTH keys are now configured
        this.http.get<any>(`${this.backendUrl}/api/keys/status`).subscribe({
          next: (s) => {
            this.keyStoreStatus = s;
            if (s.groq_configured && s.gemini_configured) {
              setTimeout(() => {
                this.showKeysPage = false;
                this.keysSaveMessage = '';
              }, 1200);
            }
          },
          error: () => {}
        });

        this.fetchApiLimits();
      },
      error: (err) => {
        this.keysSaving = false;
        this.keysSaveError = err.error?.error || 'Failed to save keys.';
      }
    });
  }

  fetchApiLimits() {
    this.http.get<any>(`${this.backendUrl}/api/video/limits`).subscribe({
      next: (res) => this.apiLimits = res,
      error: (err) => console.error('Failed to load API limits:', err)
    });
  }

  getEstimatedGroqCost(): number {
    if (!this.videoDuration) return 0;
    return (this.videoDuration / 60) * 0.000256; // ~$0.000256 per minute for llama-3.3-70b
  }

  getEstimatedGeminiCost(): number {
    return (this.videoDuration && this.useAi) ? 0.000178 : 0.0;
  }

  private releaseLocalVideo() {
    if (this.localVideoUrl?.startsWith('blob:')) {
      try { URL.revokeObjectURL(this.localVideoUrl); } catch {}
    }
    this.localVideoUrl = '';
  }
}
