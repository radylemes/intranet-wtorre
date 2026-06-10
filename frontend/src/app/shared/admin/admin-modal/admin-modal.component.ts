import { Component, input, output, ViewEncapsulation } from '@angular/core';

export type AdminModalIcon = 'folder' | 'tenant';

@Component({
  selector: 'app-admin-modal',
  standalone: true,
  templateUrl: './admin-modal.component.html',
  styleUrl: './admin-modal.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AdminModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly icon = input<AdminModalIcon>('folder');
  readonly salvando = input(false);
  readonly saveLabel = input('Salvar');

  readonly save = output<void>();
  readonly cancel = output<void>();

  onBackdropClick(): void {
    this.cancel.emit();
  }

  onSave(): void {
    this.save.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
