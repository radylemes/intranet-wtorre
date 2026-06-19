import { Component, OnInit, inject, signal } from '@angular/core';
import { MenuService } from '../../services/menu.service';
import { GRUPO_LOGOS_LOGIN } from '../../data/grupo-logos.data';
import { TopbarLogo } from '../../models/topbar.model';

@Component({
  selector: 'app-login-brand-panel',
  standalone: true,
  templateUrl: './login-brand-panel.component.html',
  styleUrl: './login-brand-panel.component.scss',
})
export class LoginBrandPanelComponent implements OnInit {
  private readonly menuService = inject(MenuService);

  readonly logos = signal<TopbarLogo[]>(this.fallbackLogos());
  readonly suporteTexto = signal('CCO: Ramal 6673 TEL.: (11) 4800 - 6673');

  ngOnInit(): void {
    this.menuService.getTopbarPublic().subscribe({
      next: (config) => {
        if (config.logos?.length) {
          this.logos.set(config.logos.sort((a, b) => a.ordem - b.ordem));
        }
        if (config.suporte?.texto) {
          this.suporteTexto.set(config.suporte.texto);
        }
      },
    });
  }

  private fallbackLogos(): TopbarLogo[] {
    return GRUPO_LOGOS_LOGIN.map((logo, index) => ({
      id: logo.id,
      nome: logo.nome,
      alt: logo.alt,
      imagem_url: logo.logoSrc,
      link_url: null,
      nova_aba: true,
      ordem: index,
    }));
  }
}
