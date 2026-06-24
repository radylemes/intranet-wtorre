import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  BrandIndexEntry,
  IconChip,
  ICONE_PADRAO,
  LucideIndexEntry,
} from '../../models/documento.model';
import {
  normalizarIconeParaLeitura,
  normalizarIconeParaSalvar,
  resolveIconeRaw,
} from './icon-search.util';

const CATALOG_BASE = '/assets/icon-catalog';

@Injectable({ providedIn: 'root' })
export class DocCatIconeService {
  private readonly http = inject(HttpClient);

  private lucideSpriteReady: Promise<void> | null = null;
  private brandSpriteReady: Promise<void> | null = null;
  private lucideIndex: LucideIndexEntry[] | null = null;
  private brandIndex: BrandIndexEntry[] | null = null;
  private synonyms: Record<string, string> | null = null;
  private chips: IconChip[] | null = null;
  private brandHex = new Map<string, string>();

  readonly lucideSpriteUrl = `${CATALOG_BASE}/lucide-sprite.svg`;
  readonly brandSpriteUrl = `${CATALOG_BASE}/brand-sprite.svg`;

  normalizarParaLeitura(icone: string | null | undefined): string {
    return normalizarIconeParaLeitura(icone);
  }

  normalizarParaSalvar(icone: string | null | undefined): string | null {
    return normalizarIconeParaSalvar(icone);
  }

  resolve(icone: string | null | undefined) {
    return resolveIconeRaw(icone);
  }

  spriteUrlFor(icone: string | null | undefined): string {
    const resolved = resolveIconeRaw(icone);
    return resolved.segmento === 'brand' ? this.brandSpriteUrl : this.lucideSpriteUrl;
  }

  symbolId(icone: string | null | undefined): string {
    return resolveIconeRaw(icone).id;
  }

  brandColor(icone: string | null | undefined): string | null {
    const resolved = resolveIconeRaw(icone);
    if (resolved.segmento !== 'brand') return null;
    return this.brandHex.get(resolved.id) ?? null;
  }

  async ensureLucideSprite(): Promise<void> {
    if (!this.lucideSpriteReady) {
      this.lucideSpriteReady = this.prefetchSprite(this.lucideSpriteUrl);
    }
    return this.lucideSpriteReady;
  }

  async ensureBrandSprite(): Promise<void> {
    if (!this.brandSpriteReady) {
      this.brandSpriteReady = this.prefetchSprite(this.brandSpriteUrl);
    }
    return this.brandSpriteReady;
  }

  async ensureSpriteFor(icone: string | null | undefined): Promise<void> {
    const resolved = resolveIconeRaw(icone);
    if (resolved.segmento === 'brand') {
      await Promise.all([this.ensureLucideSprite(), this.ensureBrandSprite()]);
      await this.loadBrandIndex();
    } else {
      await this.ensureLucideSprite();
    }
  }

  async loadLucideIndex(): Promise<LucideIndexEntry[]> {
    if (!this.lucideIndex) {
      this.lucideIndex = await firstValueFrom(
        this.http.get<LucideIndexEntry[]>(`${CATALOG_BASE}/lucide-index.json`)
      );
    }
    return this.lucideIndex;
  }

  async loadBrandIndex(): Promise<BrandIndexEntry[]> {
    if (!this.brandIndex) {
      this.brandIndex = await firstValueFrom(
        this.http.get<BrandIndexEntry[]>(`${CATALOG_BASE}/brand-index.json`)
      );
      for (const entry of this.brandIndex) {
        this.brandHex.set(entry.slug, entry.hex);
      }
    }
    return this.brandIndex;
  }

  async loadSynonyms(): Promise<Record<string, string>> {
    if (!this.synonyms) {
      this.synonyms = await firstValueFrom(
        this.http.get<Record<string, string>>(`${CATALOG_BASE}/synonyms-pt.json`)
      );
    }
    return this.synonyms;
  }

  async loadChips(): Promise<IconChip[]> {
    if (!this.chips) {
      this.chips = await firstValueFrom(this.http.get<IconChip[]>(`${CATALOG_BASE}/chips.json`));
    }
    return this.chips;
  }

  async preloadPickerCatalog(): Promise<void> {
    await Promise.all([
      this.ensureLucideSprite(),
      this.loadLucideIndex(),
      this.loadSynonyms(),
      this.loadChips(),
    ]);
  }

  defaultIcone(): string {
    return ICONE_PADRAO;
  }

  private async prefetchSprite(url: string): Promise<void> {
    try {
      await firstValueFrom(this.http.get(url, { responseType: 'text' }));
    } catch {
      // sprite pode ainda carregar via use no browser
    }
  }
}
