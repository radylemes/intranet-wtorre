import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  PublicClientApplication,
  type Configuration,
} from '@azure/msal-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MsalConfigResposta } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class MsalConfigService {
  private readonly http = inject(HttpClient);

  private instance: PublicClientApplication | null = null;
  private loadError: string | null = null;
  private clientId = '';

  async initialize(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.http.get<MsalConfigResposta>(`${environment.apiBaseUrl}/tenants/msal-config`)
      );
      this.clientId = config.clientId || '';
      const msalConfig: Configuration = {
        auth: {
          clientId: this.clientId || '00000000-0000-0000-0000-000000000000',
          authority: config.authority || environment.msalAuthority,
          redirectUri: typeof window !== 'undefined' ? window.location.origin : config.redirectUri,
        },
        cache: {
          cacheLocation: 'localStorage',
        },
      };
      this.instance = new PublicClientApplication(msalConfig);
      await this.instance.initialize();
      if (!this.clientId) {
        this.loadError = 'MSAL não configurado: cadastre um tenant principal no painel admin.';
      }
    } catch (err) {
      this.loadError =
        err instanceof Error ? err.message : 'Não foi possível carregar a configuração Microsoft.';
      const msalConfig: Configuration = {
        auth: {
          clientId: '00000000-0000-0000-0000-000000000000',
          authority: environment.msalAuthority,
          redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
        },
        cache: { cacheLocation: 'localStorage' },
      };
      this.instance = new PublicClientApplication(msalConfig);
      await this.instance.initialize();
    }
  }

  getInstance(): PublicClientApplication | null {
    return this.instance;
  }

  hasClientId(): boolean {
    return !!this.clientId;
  }

  getLoadError(): string | null {
    return this.loadError;
  }
}

export function msalConfigInitializer(msalConfig: MsalConfigService) {
  return () => msalConfig.initialize();
}
