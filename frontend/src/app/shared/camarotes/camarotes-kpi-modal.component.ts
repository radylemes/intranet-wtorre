import { DatePipe } from '@angular/common';
import { Component, HostListener, Input, output } from '@angular/core';
import { CamaroteUnidade } from '../../models/camarote.model';
import { formatarAndar } from '../../utils/camarote-andar.util';

export type KpiModalModo = 'vago' | 'contrato' | 'pack30' | 'vvip';

@Component({
  selector: 'app-camarotes-kpi-modal',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './camarotes-kpi-modal.component.html',
  styleUrl: './camarotes-kpi-modal.component.scss',
})
export class CamarotesKpiModalComponent {
  @Input({ required: true }) aberto = false;
  @Input({ required: true }) titulo = '';
  @Input() subtitulo = '';
  @Input() carregando = false;
  @Input() erro = '';
  @Input() unidades: CamaroteUnidade[] = [];
  @Input() modo: KpiModalModo = 'contrato';

  readonly fechar = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.aberto) this.fechar.emit();
  }

  moeda(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  texto(valor: string | null | undefined): string {
    return valor?.trim() || '—';
  }

  formatarAndar = formatarAndar;

  onBackdropClick(): void {
    this.fechar.emit();
  }

  onCloseClick(): void {
    this.fechar.emit();
  }
}
