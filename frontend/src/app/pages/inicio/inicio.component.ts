import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TopbarComponent } from '../../shared/topbar/topbar.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { HeroComponent } from './hero/hero.component';
import { EmpresasComponent } from './empresas/empresas.component';
import { SistemasComponent } from './sistemas/sistemas.component';
import { ServicosComponent } from './servicos/servicos.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [
    TopbarComponent,
    HeaderComponent,
    HeroComponent,
    EmpresasComponent,
    SistemasComponent,
    ServicosComponent,
    FooterComponent,
  ],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.scss',
})
export class InicioComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  ngOnInit(): void {
    this.document.body.classList.add('pagina-inicio');
    this.auth.carregarPerfil().subscribe();
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('pagina-inicio');
  }
}
