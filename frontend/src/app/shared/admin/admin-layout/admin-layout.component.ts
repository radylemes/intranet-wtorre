import { Component, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { LogoWComponent } from '../../logo-w/logo-w.component';
import { AuthService } from '../../../services/auth.service';
import { AdminToastComponent } from '../admin-toast/admin-toast.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoWComponent, AdminToastComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly sidebarOpen = signal(false);

  readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.getTitleFromRoute())
    ),
    { initialValue: 'Administração' }
  );

  private getTitleFromRoute(): string {
    let route: ActivatedRoute = this.route;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return (route.snapshot.data['adminTitle'] as string | undefined) ?? 'Administração';
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  sair(): void {
    this.auth.logout();
  }
}
