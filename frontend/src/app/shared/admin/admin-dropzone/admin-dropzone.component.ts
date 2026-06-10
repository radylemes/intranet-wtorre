import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-admin-dropzone',
  standalone: true,
  templateUrl: './admin-dropzone.component.html',
  styleUrl: './admin-dropzone.component.scss',
})
export class AdminDropzoneComponent {
  readonly disabled = input(false);
  readonly hint = input('Arraste arquivos aqui ou');
  readonly hintLink = input('clique para selecionar');
  readonly subhint = input('');

  readonly fileSelected = output<File>();

  readonly dragOver = output<boolean>();

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  isDragover = false;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled()) return;
    this.isDragover = true;
    this.dragOver.emit(true);
  }

  onDragLeave(): void {
    this.isDragover = false;
    this.dragOver.emit(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragover = false;
    this.dragOver.emit(false);
    if (this.disabled()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.fileSelected.emit(file);
  }

  onClick(): void {
    if (this.disabled()) return;
    this.fileInput()?.nativeElement.click();
  }

  onInputChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.fileSelected.emit(file);
  }
}
