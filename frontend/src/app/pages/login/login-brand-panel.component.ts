import { Component } from '@angular/core';
import { GRUPO_LOGOS_LOGIN } from '../../data/grupo-logos.data';

@Component({
  selector: 'app-login-brand-panel',
  standalone: true,
  templateUrl: './login-brand-panel.component.html',
  styleUrl: './login-brand-panel.component.scss',
})
export class LoginBrandPanelComponent {
  readonly logos = GRUPO_LOGOS_LOGIN;
}
