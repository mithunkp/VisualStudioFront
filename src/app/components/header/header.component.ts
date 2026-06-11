import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.component.html'
})
export class HeaderComponent {
  @Input() selectedFile: File | null = null;
  @Input() processingState: string = 'IDLE';
  @Input() inputMode: 'FILE' | 'URL' = 'FILE';
  @Input() videoUrlInput: string = '';

  @Output() inputModeChange = new EventEmitter<'FILE' | 'URL'>();
  @Output() videoUrlInputChange = new EventEmitter<string>();
  @Output() fileSelected = new EventEmitter<File>();
  @Output() processUrl = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();

  onInputModeChange(mode: 'FILE' | 'URL') {
    this.inputModeChange.emit(mode);
  }

  onVideoUrlInputChange(url: string) {
    this.videoUrlInputChange.emit(url);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
  }

  onProcessUrl() {
    this.processUrl.emit();
  }

  onReset() {
    this.reset.emit();
  }
}
