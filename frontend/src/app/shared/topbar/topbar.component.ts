import { Component, OnInit, inject, signal } from '@angular/core';
import { MenuService } from '../../services/menu.service';
import { GRUPO_LOGOS } from '../../data/grupo-logos.data';
import { TopbarLogo } from '../../models/topbar.model';

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent implements OnInit {
  private readonly menuService = inject(MenuService);

  readonly logos = signal<TopbarLogo[]>(this.fallbackLogos());
  readonly suporteTexto = signal('CCO: Ramal 6673 TEL.: (11) 4800 - 6673');

  ngOnInit(): void {
    this.menuService.getTopbar().subscribe({
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
    return GRUPO_LOGOS.map((logo, index) => ({
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
