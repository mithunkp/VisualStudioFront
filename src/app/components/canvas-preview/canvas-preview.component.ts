import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-canvas-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './canvas-preview.component.html'
})
export class CanvasPreviewComponent {
  @Input() processingState: string = 'IDLE';
  @Input() result: any = null;
  @Input() localVideoUrl: string = '';
  @Input() cropPosition: string = 'center';
  @Input() captionText: string = 'YOUR BIG IDEA';
  @Input() captionFont: string = 'Impact, sans-serif';
  @Input() captionColor: string = '#ffffff';
  @Input() accentColor: string = '#a855f7';
  @Input() captionPosition: string = 'bottom';
  @Input() textAnimation: string = 'pop';
  @Input() selectedFile: File | null = null;
  @Input() selectedHook: any = null;
  @Input() backendUrl: string = 'http://localhost:5101';

  @Output() selectHook = new EventEmitter<any>();
  @Output() download = new EventEmitter<void>();

  onSelectHook(hook: any) {
    this.selectHook.emit(hook);
  }

  onDownload() {
    this.download.emit();
  }
}
