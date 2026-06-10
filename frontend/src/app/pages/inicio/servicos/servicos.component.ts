import { Component } from '@angular/core';
import { RevealOnScrollDirective } from '../../../shared/directives/reveal-on-scroll.directive';
import { SERVICOS } from '../../../data/servicos.data';
import { ServicoIconComponent } from './servico-icon.component';

@Component({
  selector: 'app-servicos',
  standalone: true,
  imports: [RevealOnScrollDirective, ServicoIconComponent],
  templateUrl: './servicos.component.html',
  styleUrl: './servicos.component.scss',
})
export class ServicosComponent {
  readonly servicos = SERVICOS;
}
