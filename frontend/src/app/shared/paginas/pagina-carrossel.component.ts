import { Component, OnDestroy, computed, effect, input, signal } from '@angular/core';
import { BlocoCarrosselConfig } from '../../models/pagina.model';

@Component({
  selector: 'app-pagina-carrossel',
  standalone: true,
  templateUrl: './pagina-carrossel.component.html',
  styleUrl: './pagina-carrossel.component.scss',
})
export class PaginaCarrosselComponent implements OnDestroy {
  readonly config = input.required<BlocoCarrosselConfig>();

  readonly indice = signal(0);

  private autoplayTimer: ReturnType<typeof setInterval> | null = null;

  readonly slideAtual = computed(() => {
    const slides = this.config().slides || [];
    const i = this.indice();
    return slides[i] ?? slides[0];
  });

  readonly total = computed(() => this.config().slides?.length || 0);

  constructor() {
    effect(() => {
      this.config();
      this.reiniciarAutoplay();
    });
  }

  ngOnDestroy(): void {
    this.pararAutoplay();
  }

  private reiniciarAutoplay(): void {
    this.pararAutoplay();
    const cfg = this.config();
    if (cfg.autoplay && cfg.slides?.length > 1) {
      const ms = cfg.intervaloMs ?? 5000;
      this.autoplayTimer = setInterval(() => this.proximo(), ms);
    }
  }

  private pararAutoplay(): void {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  irPara(i: number): void {
    const total = this.total();
    if (total === 0) return;
    this.indice.set(((i % total) + total) % total);
  }

  anterior(): void {
    this.irPara(this.indice() - 1);
  }

  proximo(): void {
    this.irPara(this.indice() + 1);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.anterior();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.proximo();
    }
  }
}
