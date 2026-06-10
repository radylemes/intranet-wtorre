import { Component, inject } from '@angular/core';
import { AdminToastService } from './admin-toast.service';

@Component({
  selector: 'app-admin-toast',
  standalone: true,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class.success]="toast.type === 'success'" [class.error]="toast.type === 'error'">
          {{ toast.text }}
          <button type="button" class="toast-close" (click)="toastService.dismiss(toast.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 500;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: min(380px, calc(100vw - 32px));
    }
    .toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(28, 42, 82, 0.15);
      animation: toastIn 0.25s ease;
    }
    .toast.success {
      background: #e8f8ef;
      color: #1c9e62;
      border: 1px solid #b8e6cc;
    }
    .toast.error {
      background: #fdeceb;
      color: #c2362f;
      border: 1px solid #f6c9c5;
    }
    .toast-close {
      border: none;
      background: none;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      opacity: 0.6;
      flex-shrink: 0;
    }
    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class AdminToastComponent {
  readonly toastService = inject(AdminToastService);
}
