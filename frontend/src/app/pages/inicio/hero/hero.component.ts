import { Component, inject } from '@angular/core';
import { QUICKTAGS } from '../../../data/quicktags.data';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {
  readonly auth = inject(AuthService);
  readonly quicktags = QUICKTAGS;
}
