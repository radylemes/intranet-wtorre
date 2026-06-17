import { Component, inject, Input, OnInit, output, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { Treinamento } from '../../../models/treinamento.model';
import { TreinamentosService } from '../../../services/treinamentos.service';
import {
  categoriaGrad,
  categoriaLabel,
  formatarDuracao,
} from '../../../utils/treinamento-categoria.util';

@Component({
  selector: 'app-treinamento-card',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './treinamento-card.component.html',
  styleUrl: './treinamento-card.component.scss',
})
export class TreinamentoCardComponent implements OnInit {
  private readonly treinamentosService = inject(TreinamentosService);

  @Input({ required: true }) video!: Treinamento;
  @Input() modo: 'card' | 'featured' = 'card';

  readonly play = output<void>();

  readonly thumbUrl = signal<string | null>(null);

  ngOnInit(): void {
    if (this.video.temThumb) {
      this.treinamentosService.thumbUrl(this.video.id).subscribe({
        next: (r) => this.thumbUrl.set(r.url),
        error: () => this.thumbUrl.set(null),
      });
    }
  }

  onClick(): void {
    if (this.modo === 'card') {
      this.play.emit();
    }
  }

  thumbStyle(): Record<string, string> {
    const url = this.thumbUrl();
    if (url) {
      return {
        backgroundImage: `url(${url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return { background: categoriaGrad(this.video.categoria) };
  }

  catLabel(): string {
    return categoriaLabel(this.video.categoria);
  }

  duracao(): string {
    return formatarDuracao(this.video.duracaoSeg);
  }
}
