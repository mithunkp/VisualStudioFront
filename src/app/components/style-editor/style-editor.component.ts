import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

type CropPosition = 'left' | 'center' | 'right';
type CaptionPosition = 'top' | 'middle' | 'bottom';
type TextAnimation = 'none' | 'fade' | 'pop' | 'slide';

@Component({
  selector: 'app-style-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './style-editor.component.html'
})
export class StyleEditorComponent {
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

  @Input() cropPosition: CropPosition = 'center';
  @Input() captionText: string = 'YOUR BIG IDEA';
  @Input() captionFont: string = 'Impact, sans-serif';
  @Input() captionColor: string = '#ffffff';
  @Input() accentColor: string = '#a855f7';
  @Input() captionPosition: CaptionPosition = 'bottom';
  @Input() textAnimation: TextAnimation = 'pop';
  @Input() useAi: boolean = true;
  @Input() selectedFile: File | null = null;

  @Output() cropPositionChange = new EventEmitter<CropPosition>();
  @Output() captionTextChange = new EventEmitter<string>();
  @Output() captionFontChange = new EventEmitter<string>();
  @Output() captionColorChange = new EventEmitter<string>();
  @Output() accentColorChange = new EventEmitter<string>();
  @Output() captionPositionChange = new EventEmitter<CaptionPosition>();
  @Output() textAnimationChange = new EventEmitter<TextAnimation>();
  @Output() useAiChange = new EventEmitter<boolean>();
  @Output() render = new EventEmitter<void>();

  onCropPositionChange(val: CropPosition) {
    this.cropPositionChange.emit(val);
  }

  onCaptionTextChange(val: string) {
    this.captionTextChange.emit(val);
  }

  onCaptionFontChange(val: string) {
    this.captionFontChange.emit(val);
  }

  onCaptionColorChange(val: string) {
    this.captionColorChange.emit(val);
  }

  onAccentColorChange(val: string) {
    this.accentColorChange.emit(val);
  }

  onCaptionPositionChange(val: CaptionPosition) {
    this.captionPositionChange.emit(val);
  }

  onTextAnimationChange(val: TextAnimation) {
    this.textAnimationChange.emit(val);
  }

  onUseAiChange(val: boolean) {
    this.useAiChange.emit(val);
  }

  onRender() {
    this.render.emit();
  }
}
