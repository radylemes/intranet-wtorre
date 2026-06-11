import { Component } from '@angular/core';
import { GRUPO_LOGOS } from '../../data/grupo-logos.data';

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  readonly logos = GRUPO_LOGOS;
}
