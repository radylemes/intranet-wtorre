import { Component, input } from '@angular/core';
import { Servico } from '../../../data/servicos.data';

@Component({
  selector: 'app-servico-icon',
  standalone: true,
  template: `
    @switch (icon()) {
      @case ('alert') {
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      }
      @case ('search') {
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
          <path d="M21 21l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      }
      @case ('calendar') {
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" stroke-width="2"/>
          <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      }
      @case ('report') {
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6l3 14h12l3-14M8 6V4a4 4 0 018 0v2M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      }
    }
  `,
  styles: `:host { display: contents; } svg { width: 22px; height: 22px; }`,
})
export class ServicoIconComponent {
  readonly icon = input.required<Servico['icon']>();
}
