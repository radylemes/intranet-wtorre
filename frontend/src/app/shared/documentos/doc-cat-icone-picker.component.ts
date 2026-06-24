import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  BrandIndexEntry,
  IconChip,
  ICONE_PADRAO,
  IconeSegmento,
  LucideIndexEntry,
} from '../../models/documento.model';
import { DocCatIconeComponent } from './doc-cat-icone.component';
import { DocCatIconeService } from './doc-cat-icone.service';
import {
  ICON_INITIAL_MAX,
  ICON_SEARCH_MAX,
  IconSearchResult,
  getInitialBrandIcons,
  getInitialLucideIcons,
  isChipForSegment,
  searchBrandIcons,
  searchLucideIcons,
} from './icon-search.util';

@Component({
  selector: 'app-doc-cat-icone-picker',
  standalone: true,
  imports: [FormsModule, ScrollingModule, DocCatIconeComponent],
  templateUrl: './doc-cat-icone-picker.component.html',
  styleUrl: './doc-cat-icone-picker.component.scss',
})
export class DocCatIconePickerComponent implements OnInit {
  private readonly iconeService = inject(DocCatIconeService);

  readonly value = input<string | null>(ICONE_PADRAO);
  readonly valueChange = output<string>();

  readonly segmento = signal<IconeSegmento>('lucide');
  readonly busca = signal('');
  readonly carregando = signal(true);
  readonly chips = signal<IconChip[]>([]);
  readonly totalLucide = signal(0);
  readonly totalBrand = signal(0);
  readonly lucideEntries = signal<LucideIndexEntry[]>([]);
  readonly brandEntries = signal<BrandIndexEntry[]>([]);
  readonly synonymsMap = signal<Record<string, string>>({});

  readonly resultados = computed((): IconSearchResult[] => {
    const q = this.busca().trim();

    if (this.segmento() === 'brand') {
      if (!q) return getInitialBrandIcons(this.brandEntries(), ICON_INITIAL_MAX);
      return searchBrandIcons(this.brandEntries(), q);
    }

    if (!q) return getInitialLucideIcons(this.lucideEntries(), ICON_INITIAL_MAX);
    return searchLucideIcons(this.lucideEntries(), q, this.synonymsMap());
  });

  readonly totalSegmento = computed(() =>
    this.segmento() === 'brand' ? this.totalBrand() : this.totalLucide()
  );

  readonly contador = computed(() => {
    const total = this.totalSegmento();
    const shown = this.resultados().length;
    const buscando = !!this.busca().trim();

    if (!buscando) {
      return `Mostrando ${shown} sugeridos de ${total.toLocaleString('pt-BR')} ícones`;
    }
    if (shown >= ICON_SEARCH_MAX) {
      return `Mostrando ${shown} de ${total.toLocaleString('pt-BR')} · refine a busca`;
    }
    if (!shown) {
      return 'Nenhum resultado';
    }
    return `${shown} resultado${shown === 1 ? '' : 's'}`;
  });

  readonly colunas = 8;
  readonly linhas = computed(() => {
    const items = this.resultados();
    const rows: IconSearchResult[][] = [];
    for (let i = 0; i < items.length; i += this.colunas) {
      rows.push(items.slice(i, i + this.colunas));
    }
    return rows;
  });

  readonly itemSize = 44;

  ngOnInit(): void {
    void this.initCatalog();
  }

  async initCatalog(): Promise<void> {
    this.carregando.set(true);
    try {
      await this.iconeService.preloadPickerCatalog();
      const [lucide, brands, synonyms, chips] = await Promise.all([
        this.iconeService.loadLucideIndex(),
        this.iconeService.loadBrandIndex(),
        this.iconeService.loadSynonyms(),
        this.iconeService.loadChips(),
      ]);
      this.totalLucide.set(lucide.length);
      this.totalBrand.set(brands.length);
      this.lucideEntries.set(lucide);
      this.brandEntries.set(brands);
      this.synonymsMap.set(synonyms);
      this.chips.set(chips);
      await this.iconeService.ensureBrandSprite();
    } finally {
      this.carregando.set(false);
    }
  }

  selecionar(namespaced: string): void {
    this.valueChange.emit(namespaced);
  }

  selecionado(namespaced: string): boolean {
    const atual = this.iconeService.normalizarParaLeitura(this.value());
    return atual === namespaced;
  }

  setSegmento(seg: IconeSegmento): void {
    this.segmento.set(seg);
    this.busca.set('');
  }

  aplicarBusca(termo: string): void {
    this.busca.set(termo);
  }

  aplicarChip(chip: IconChip): void {
    if (chip.segment) {
      this.segmento.set(chip.segment);
    }
    this.aplicarBusca(chip.query);
  }

  chipVisivel(chip: IconChip): boolean {
    return isChipForSegment(chip, this.segmento());
  }

  trackRow(_: number, row: IconSearchResult[]): string {
    return row.map((r) => r.namespaced).join('|');
  }
}
