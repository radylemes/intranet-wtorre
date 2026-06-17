import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicChromeComponent } from '../../shared/public-chrome/public-chrome.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { TreinamentosService } from '../../services/treinamentos.service';
import { Treinamento } from '../../models/treinamento.model';
import {
  CAT,
  CATEGORIAS_LISTA,
  categoriaCor,
  categoriaGrad,
  categoriaLabel,
  formatarDuracao,
} from '../../utils/treinamento-categoria.util';
import { TreinamentoCardComponent } from './treinamento-card/treinamento-card.component';

@Component({
  selector: 'app-treinamentos',
  standalone: true,
  imports: [FormsModule, PublicChromeComponent, FooterComponent, TreinamentoCardComponent],
  templateUrl: './treinamentos.component.html',
  styleUrl: './treinamentos.component.scss',
})
export class TreinamentosComponent implements OnInit {
  private readonly treinamentosService = inject(TreinamentosService);

  readonly videos = signal<Treinamento[]>([]);
  readonly q = signal('');
  readonly catFiltro = signal('');
  readonly carregando = signal(true);
  readonly erro = signal('');

  readonly playerAberto = signal(false);
  readonly videoAtivo = signal<Treinamento | null>(null);
  readonly sasUrl = signal<string | null>(null);
  readonly playerCarregando = signal(false);

  readonly categorias = CATEGORIAS_LISTA;

  readonly filtrados = computed(() => {
    const f = this.q().trim().toLowerCase();
    const cat = this.catFiltro();
    return this.videos().filter((v) => {
      if (cat && v.categoria !== cat) return false;
      if (!f) return true;
      const hay = `${v.titulo} ${v.area ?? ''} ${categoriaLabel(v.categoria)} ${v.descricao ?? ''}`.toLowerCase();
      return hay.includes(f);
    });
  });

  readonly destaque = computed(() => {
    const lista = this.filtrados();
    return lista.find((v) => v.destaque) ?? lista[0] ?? null;
  });

  readonly gridLista = computed(() => {
    const dest = this.destaque();
    if (!dest) return this.filtrados();
    return this.filtrados().filter((v) => v.id !== dest.id);
  });

  constructor() {
    effect(() => {
      if (!this.playerAberto()) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.fecharPlayer();
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');
    this.treinamentosService.listar().subscribe({
      next: (list) => {
        this.videos.set(list);
        this.carregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar treinamentos.');
        this.carregando.set(false);
      },
    });
  }

  selecionarCat(slug: string): void {
    this.catFiltro.set(slug);
  }

  abrir(video: Treinamento): void {
    this.videoAtivo.set(video);
    this.playerAberto.set(true);
    this.sasUrl.set(null);
    this.playerCarregando.set(true);

    this.treinamentosService.playback(video.id).subscribe({
      next: (resp) => {
        this.sasUrl.set(resp.url);
        this.playerCarregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.erro.set(err.error?.mensagem || 'Erro ao carregar vídeo.');
        this.playerCarregando.set(false);
        this.fecharPlayer();
      },
    });
  }

  fecharPlayer(): void {
    this.playerAberto.set(false);
    this.sasUrl.set(null);
    this.videoAtivo.set(null);
    this.playerCarregando.set(false);
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.fecharPlayer();
    }
  }

  catLabel(slug: string): string {
    return categoriaLabel(slug);
  }

  catCor(slug: string): string {
    return categoriaCor(slug);
  }

  catGrad(slug: string): string {
    return categoriaGrad(slug);
  }

  duracao(v: Treinamento): string {
    return formatarDuracao(v.duracaoSeg);
  }

  readonly CAT = CAT;
}
