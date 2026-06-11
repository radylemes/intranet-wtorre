import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MenuService } from '../../services/menu.service';
import { MenuItem } from '../../models/menu.model';
import { MenuNodeComponent } from './menu-node/menu-node.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, MenuNodeComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly menuService = inject(MenuService);
  readonly auth = inject(AuthService);
  readonly menuItems = signal<MenuItem[]>([]);
  readonly menuAberto = signal(false);
  readonly expandedIds = signal<Set<number>>(new Set());
  readonly mobile = signal(false);
  readonly avatarMenuAberto = signal(false);
  readonly fotoUrl = signal<string | null>(null);

  private mediaQuery?: MediaQueryList;
  private readonly onMediaChange = (e: MediaQueryListEvent) => this.mobile.set(e.matches);

  ngOnInit(): void {
    this.menuService.menu$.subscribe((items) => {
      if (items.length) this.menuItems.set(items);
    });
    this.menuService.carregarMenu().subscribe();

    if (typeof window !== 'undefined') {
      this.mediaQuery = window.matchMedia('(max-width: 760px)');
      this.mobile.set(this.mediaQuery.matches);
      this.mediaQuery.addEventListener('change', this.onMediaChange);
    }

    if (this.auth.usuario()?.is_ad_user) {
      this.http
        .get(this.auth.getProfilePhotoUrl(), { responseType: 'blob' })
        .subscribe({
          next: (blob) => {
            this.fotoUrl.set(URL.createObjectURL(blob));
          },
          error: () => {
            /* mantém iniciais */
          },
        });
    }
  }

  ngOnDestroy(): void {
    this.mediaQuery?.removeEventListener('change', this.onMediaChange);
  }

  toggleExpanded = (id: number): void => {
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  toggleMenu(): void {
    this.menuAberto.update((v) => !v);
  }

  fecharMenu = (): void => {
    this.menuAberto.set(false);
    this.expandedIds.set(new Set());
  };

  toggleAvatarMenu(): void {
    this.avatarMenuAberto.update((v) => !v);
  }

  fecharAvatarMenu(): void {
    this.avatarMenuAberto.set(false);
  }

  sair(): void {
    this.fecharAvatarMenu();
    this.auth.logout();
  }
}
