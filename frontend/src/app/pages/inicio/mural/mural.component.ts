import { Component } from '@angular/core';
import { NOTICIAS } from '../../../data/noticias.data';
import { EVENTOS } from '../../../data/eventos.data';

@Component({
  selector: 'app-mural',
  standalone: true,
  templateUrl: './mural.component.html',
  styleUrl: './mural.component.scss',
})
export class MuralComponent {
  readonly noticias = NOTICIAS;
  readonly eventos = EVENTOS;
}
