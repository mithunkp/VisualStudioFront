import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { HeaderComponent } from './components/header/header.component';
import { TrimmerComponent } from './components/trimmer/trimmer.component';
import { StyleEditorComponent } from './components/style-editor/style-editor.component';
import { CanvasPreviewComponent } from './components/canvas-preview/canvas-preview.component';

interface HookCandidate {
  start_time: number;
  end_time: number;
  title: string;
  reason: string;
  video_url?: string;
}

interface VideoProcessingResult {
  hooks: HookCandidate[];
  selectedHook: HookCandidate;
  videoUrl: string;
}

type ProcessingState = 'IDLE' | 'UPLOADING' | 'TRANSCRIBING' | 'ANALYZING' | 'RENDERING' | 'COMPLETE' | 'ERROR';
type CropPosition = 'left' | 'center' | 'right';
type CaptionPosition = 'top' | 'middle' | 'bottom';
type TextAnimation = 'none' | 'fade' | 'pop' | 'slide';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    TrimmerComponent,
    StyleEditorComponent,
    CanvasPreviewComponent
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnDestroy {
  private http = inject(HttpClient);
  private simulationInterval: ReturnType<typeof setInterval> | null = null;

  readonly backendUrl = `http://${window.location.hostname}:5101`;
  readonly fonts = [
    { name: 'Impact', value: 'Impact, sans-serif' },
    { name: 'Clean Bold', value: 'Arial, sans-serif' },
    { name: 'Modern', value: 'Outfit, sans-serif' },
    { name: 'Editorial', value: 'Georgia, serif' },
    { name: 'Mono', value: 'monospace' }
  ];
  readonly captionPositions: CaptionPosition[] = ['top', 'middle', 'bottom'];
  readonly animations: TextAnimation[] = ['none', 'fade', 'pop', 'slide'];
  readonly cropPositions: CropPosition[] = ['left', 'center', 'right'];

  selectedFile: File | null = null;
  localVideoUrl = '';
  videoDuration = 0;
  trimStart = 0;
  trimEnd = 30;
  dragOver = false;
  processingState: ProcessingState = 'IDLE';
  uploadProgress = 0;
  errorMessage = '';
  errorDetail = '';
  result: VideoProcessingResult | null = null;
  selectedHook: HookCandidate | null = null;
  inputMode: 'FILE' | 'URL' = 'FILE';
  videoUrlInput = '';

  useAi = true;
  cropPosition: CropPosition = 'center';
  captionText = 'YOUR BIG IDEA';
  captionFont = this.fonts[0].value;
  captionColor = '#ffffff';
  accentColor = '#a855f7';
  captionPosition: CaptionPosition = 'bottom';
  textAnimation: TextAnimation = 'pop';

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
  }

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

  setFile(file: File) {
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

  onMetadataLoaded(video: HTMLVideoElement) {
    this.videoDuration = Number.isFinite(video.duration) ? video.duration : 0;
    this.trimStart = 0;
    this.trimEnd = Math.min(this.videoDuration || 30, 30);
  }

  seekPreview(video: HTMLVideoElement, value: number) {
    video.currentTime = value;
  }

  updateTrimStart(value: number, video: HTMLVideoElement) {
    this.trimStart = Math.min(value, Math.max(0, this.trimEnd - 1));
    this.seekPreview(video, this.trimStart);
  }

  updateTrimEnd(value: number, video: HTMLVideoElement) {
    this.trimEnd = Math.max(value, this.trimStart + 1);
    this.seekPreview(video, Math.max(this.trimStart, this.trimEnd - 0.2));
  }

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

  private appendRenderOptions(formData: FormData) {
    Object.entries(this.renderOptions()).forEach(([key, value]) => formData.append(key, String(value)));
  }

  private renderOptions() {
    return {
      useAi: this.useAi,
      startTime: this.trimStart,
      endTime: this.trimEnd,
      cropPosition: this.cropPosition,
      captionText: this.captionText,
      captionFont: this.fonts.find(font => font.value === this.captionFont)?.name || 'Impact',
      captionColor: this.captionColor,
      accentColor: this.accentColor,
      captionPosition: this.captionPosition,
      textAnimation: this.textAnimation
    };
  }

  private beginProcessing() {
    this.processingState = 'UPLOADING';
    this.uploadProgress = 0;
    this.errorMessage = '';
    this.errorDetail = '';
    this.result = null;
    this.selectedHook = null;
  }

  private finishProcessing(result: VideoProcessingResult | null) {
    this.clearSimulation();
    this.result = result;
    this.selectedHook = result?.selectedHook || result?.hooks?.[0] || null;
    this.processingState = 'COMPLETE';
  }

  private failProcessing(err: any) {
    this.clearSimulation();
    this.processingState = 'ERROR';
    this.errorMessage = err.status === 0
      ? `The backend connection was lost. Check that ${this.backendUrl}/health opens, then retry.`
      : err.error?.error || err.message || 'An error occurred during video processing.';
    this.errorDetail = err.status === 0
      ? `No HTTP response was received. Backend URL: ${this.backendUrl}. Check logs/backend.log on the server.`
      : [
          err.error?.runId ? `Run ID: ${err.error.runId}` : '',
          err.error?.stage ? `Failed stage: ${err.error.stage}` : '',
          err.error?.detail || ''
        ].filter(Boolean).join('\n\n');
  }

  private startBackendPipelineSimulation() {
    this.processingState = this.useAi ? 'TRANSCRIBING' : 'RENDERING';
    let elapsedSeconds = 0;
    this.clearSimulation();
    this.simulationInterval = setInterval(() => {
      elapsedSeconds++;
      if (this.useAi && this.processingState === 'TRANSCRIBING' && elapsedSeconds > 6) {
        this.processingState = 'ANALYZING';
      } else if (this.useAi && this.processingState === 'ANALYZING' && elapsedSeconds > 12) {
        this.processingState = 'RENDERING';
      }
    }, 1000);
  }

  private clearSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  selectHook(hook: HookCandidate) {
    this.selectedHook = hook;
  }

  downloadVideo() {
    const activeHook = this.selectedHook || this.result?.selectedHook;
    const activeUrl = activeHook?.video_url || this.result?.videoUrl;
    if (!activeUrl) return;
    const link = document.createElement('a');
    link.href = `${this.backendUrl}${activeUrl}`;
    link.download = `${(activeHook?.title || 'short_video').replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  setInputMode(mode: 'FILE' | 'URL') {
    this.inputMode = mode;
    this.errorMessage = '';
    this.errorDetail = '';
  }

  reset() {
    this.releaseLocalVideo();
    this.selectedFile = null;
    this.videoUrlInput = '';
    this.videoDuration = 0;
    this.processingState = 'IDLE';
    this.uploadProgress = 0;
    this.errorMessage = '';
    this.result = null;
    this.selectedHook = null;
    this.clearSimulation();
  }

  ngOnDestroy() {
    this.releaseLocalVideo();
    this.clearSimulation();
  }

  private releaseLocalVideo() {
    if (this.localVideoUrl) URL.revokeObjectURL(this.localVideoUrl);
    this.localVideoUrl = '';
  }
}
