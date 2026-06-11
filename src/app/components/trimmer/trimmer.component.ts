import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-trimmer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trimmer.component.html'
})
export class TrimmerComponent {
  @Input() selectedFile: File | null = null;
  @Input() localVideoUrl: string = '';
  @Input() videoDuration: number = 0;
  @Input() trimStart: number = 0;
  @Input() trimEnd: number = 0;
  @Input() cropPosition: string = 'center';

  @Output() trimStartChange = new EventEmitter<number>();
  @Output() trimEndChange = new EventEmitter<number>();
  @Output() metadataLoaded = new EventEmitter<HTMLVideoElement>();

  onMetadataLoaded(video: HTMLVideoElement) {
    this.metadataLoaded.emit(video);
  }

  seekPreview(video: HTMLVideoElement, value: number) {
    video.currentTime = value;
  }

  onTrimStartChange(value: number, video: HTMLVideoElement) {
    const calculatedStart = Math.min(value, Math.max(0, this.trimEnd - 1));
    this.seekPreview(video, calculatedStart);
    this.trimStartChange.emit(calculatedStart);
  }

  onTrimEndChange(value: number, video: HTMLVideoElement) {
    const calculatedEnd = Math.max(value, this.trimStart + 1);
    this.seekPreview(video, Math.max(this.trimStart, calculatedEnd - 0.2));
    this.trimEndChange.emit(calculatedEnd);
  }
}
