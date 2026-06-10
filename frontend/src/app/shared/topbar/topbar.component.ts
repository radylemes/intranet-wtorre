import { Component, OnDestroy, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent implements OnInit, OnDestroy {
  readonly dataHora = signal('');
  private intervalo?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.atualizarRelogio();
    this.intervalo = setInterval(() => this.atualizarRelogio(), 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  private atualizarRelogio(): void {
    const d = new Date();
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    this.dataHora.set(
      `${dias[d.getDay()]} · ${String(d.getDate()).padStart(2, '0')} ${meses[d.getMonth()]} ${d.getFullYear()} · ${hora}:${min}`
    );
  }
}
