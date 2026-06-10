import { Component } from '@angular/core';
import { LogoWComponent } from '../../shared/logo-w/logo-w.component';

@Component({
  selector: 'app-login-brand-panel',
  standalone: true,
  imports: [LogoWComponent],
  templateUrl: './login-brand-panel.component.html',
  styleUrl: './login-brand-panel.component.scss',
})
export class LoginBrandPanelComponent {}
