import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CamarotesDashboard } from '../../models/camarote.model';

@Component({
  selector: 'app-camarotes-dashboard',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './camarotes-dashboard.component.html',
  styleUrl: './camarotes-dashboard.component.scss',
})
export class CamarotesDashboardComponent {
  @Input({ required: true }) dashboard!: CamarotesDashboard;

  readonly setores = ['Oeste', 'Norte', 'Leste', 'Sul'];

  moeda(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  numerosSetor(setor: string): string {
    const bloco = this.dashboard.camarotes.disponiveis_por_setor?.[setor];
    if (!bloco?.numeros?.length) return '—';
    return bloco.numeros.join(', ');
  }

  totalSetor(setor: string): number {
    return this.dashboard.camarotes.disponiveis_por_setor?.[setor]?.total ?? 0;
  }

  tiposCessionarioKeys(obj: Record<string, unknown> | undefined): string[] {
    return obj ? Object.keys(obj) : [];
  }

  andaresEntries(
    porAndar: Record<string, Record<string, number>> | undefined
  ): Array<{ andar: string; tipos: Array<{ nome: string; qtd: number }> }> {
    if (!porAndar) return [];
    return Object.entries(porAndar).map(([andar, tipos]) => ({
      andar,
      tipos: Object.entries(tipos).map(([nome, qtd]) => ({ nome, qtd })),
    }));
  }
}
