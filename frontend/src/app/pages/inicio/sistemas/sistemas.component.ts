import { Component } from '@angular/core';
import { RevealOnScrollDirective } from '../../../shared/directives/reveal-on-scroll.directive';
import { SISTEMAS } from '../../../data/sistemas.data';
import { SistemaIconComponent } from './sistema-icon.component';
import { MuralComponent } from '../mural/mural.component';

@Component({
  selector: 'app-sistemas',
  standalone: true,
  imports: [RevealOnScrollDirective, SistemaIconComponent, MuralComponent],
  templateUrl: './sistemas.component.html',
  styleUrl: './sistemas.component.scss',
})
export class SistemasComponent {
  readonly sistemas = SISTEMAS;
}
