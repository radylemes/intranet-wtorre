import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  switchMap,
  takeUntil,
  catchError,
  of,
} from 'rxjs';
import { AlertasService } from '../../services/alertas.service';
import { AuthService } from '../../services/auth.service';
import { SalasService } from '../../services/salas.service';
import {
  AvailabilityItem,
  AvailabilityPreview,
  DirectoryUser,
  Sala,
  TimeSlot,
} from '../../models/salas.model';
import { blocksBooking } from './salas-schedule-overlap';
import { buildAvailableEndTimeOptions, formatTimeBr } from './salas.utils';

@Component({
  selector: 'app-salas-booking-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './salas-booking-modal.component.html',
  styleUrl: './salas.component.scss',
})
export class SalasBookingModalComponent implements OnDestroy {
  private readonly salasService = inject(SalasService);
  private readonly alertas = inject(AlertasService);
  private readonly auth = inject(AuthService);
  private readonly destroy$ = new Subject<void>();
  private readonly previewQuery$ = new Subject<void>();
  private readonly participanteQuery$ = new Subject<string>();

  readonly open = input(false);
  readonly sala = input<Sala | null>(null);
  readonly localidade = input('');
  readonly slotStart = input<Date | null>(null);
  readonly roomSlots = input<TimeSlot[]>([]);

  readonly closed = output<void>();
  readonly booked = output<void>();
  readonly roomConflict = output<void>();

  readonly titulo = signal('');
  readonly participantes = signal<string[]>([]);
  readonly participanteBusca = signal('');
  readonly sugestoes = signal<DirectoryUser[]>([]);
  readonly fimIdx = signal(0);
  readonly salvando = signal(false);
  readonly availabilityPreview = signal<AvailabilityPreview | null>(null);
  readonly previewCarregando = signal(false);
  readonly previewErro = signal('');
  readonly showConflictConfirm = signal(false);

  readonly opcoesFimLista = computed(() => {
    const start = this.slotStart();
    if (!start) return [];
    return buildAvailableEndTimeOptions(start, this.roomSlots());
  });

  readonly slotEnd = computed(() => {
    const opcoes = this.opcoesFimLista();
    return opcoes[this.fimIdx()]?.end ?? null;
  });

  readonly horarioLabel = computed(() => {
    const start = this.slotStart();
    const end = this.slotEnd();
    if (!start || !end) return '';
    return `${formatTimeBr(start)} - ${formatTimeBr(end)}`;
  });

  readonly normalizedRequesterEmail = computed(() =>
    (this.auth.usuario()?.email ?? '').trim().toLowerCase()
  );

  readonly organizerLabel = computed(() => {
    const u = this.auth.usuario();
    if (!u?.email) return '';
    const nome = u.nome_completo || u.nome || u.email;
    return `${nome} — ${u.email}`;
  });

  readonly hasRoomConflict = computed(() => this.hasRoomConflictsForSelectedRange());

  readonly requesterHasConflict = computed(() => {
    const preview = this.availabilityPreview();
    const start = this.slotStart();
    const end = this.slotEnd();
    const requester = this.requesterPreview();
    if (!preview || !start || !end || !requester) return false;
    return blocksBooking(start.toISOString(), end.toISOString(), requester);
  });

  readonly otherParticipantsHaveConflicts = computed(() => {
    const start = this.slotStart();
    const end = this.slotEnd();
    if (!start || !end) return false;
    return this.optionalParticipantPreview().some((p) =>
      blocksBooking(start.toISOString(), end.toISOString(), p)
    );
  });

  readonly hasPeopleConflicts = computed(
    () => this.requesterHasConflict() || this.otherParticipantsHaveConflicts()
  );

  readonly availableCount = computed(
    () => this.optionalParticipantPreview().filter((p) => this.isEntityAvailable(p)).length
  );

  readonly conflictCount = computed(
    () => this.optionalParticipantPreview().filter((p) => !this.isEntityAvailable(p)).length
  );

  readonly submitButtonLabel = computed(() => {
    if (this.salvando()) return 'Reservando…';
    if (this.hasRoomConflict()) return 'Sala indisponível';
    if (this.hasPeopleConflicts()) return 'Conflito na agenda';
    return 'Reservar';
  });

  readonly submitDisabled = computed(() => this.salvando() || this.hasRoomConflict());

  readonly conflictConfirmText = computed(() => this.buildConflictConfirmMessage());

  readonly formatTimeBr = formatTimeBr;

  constructor() {
    this.previewQuery$
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const sala = this.sala();
          const start = this.slotStart();
          const end = this.slotEnd();
          const loc = this.localidade();
          if (!sala || !start || !end || !loc) {
            this.availabilityPreview.set(null);
            return EMPTY;
          }
          const participants = this.buildPreviewParticipants();
          if (!participants.length) {
            this.availabilityPreview.set(null);
            return EMPTY;
          }
          this.previewCarregando.set(true);
          this.previewErro.set('');
          return this.salasService
            .previewAvailability(loc, {
              roomEmail: sala.email,
              start: start.toISOString(),
              end: end.toISOString(),
              participants,
            })
            .pipe(catchError(() => of(null)));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (result) => {
          this.previewCarregando.set(false);
          if (result?.preview) {
            this.availabilityPreview.set(result.preview);
            this.previewErro.set('');
          } else if (result === null) {
            this.availabilityPreview.set(null);
            this.previewErro.set('Falha ao carregar prévia.');
          }
        },
      });

    this.participanteQuery$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          const normalized = query.trim();
          const loc = this.localidade();
          if (normalized.length < 2 || !loc) {
            this.sugestoes.set([]);
            return of([] as DirectoryUser[]);
          }
          return this.salasService.searchUsers(loc, normalized).pipe(
            catchError(() => of({ users: [] })),
            switchMap((res) =>
              of(
                (res.users ?? []).filter(
                  (u) =>
                    !this.participantes().includes(u.email.toLowerCase()) &&
                    u.email.toLowerCase() !== this.normalizedRequesterEmail()
                )
              )
            )
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((users) => {
        this.sugestoes.set(users);
      });

    effect(() => {
      if (!this.open()) return;
      this.titulo.set('');
      this.participantes.set([]);
      this.participanteBusca.set('');
      this.sugestoes.set([]);
      this.fimIdx.set(0);
      this.availabilityPreview.set(null);
      this.previewErro.set('');
      this.showConflictConfirm.set(false);
      this.agendarPreview();
    });

    effect(() => {
      if (!this.open()) return;
      this.slotStart();
      this.roomSlots();
      this.fimIdx.set(0);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fechar(): void {
    this.showConflictConfirm.set(false);
    this.closed.emit();
  }

  onTituloChange(value: string): void {
    this.titulo.set(value);
    this.agendarPreview();
  }

  onFimChange(idx: number): void {
    this.fimIdx.set(idx);
    this.agendarPreview();
  }

  onParticipanteInput(value: string): void {
    this.participanteBusca.set(value);
    this.participanteQuery$.next(value);
  }

  adicionarParticipante(email?: string): void {
    const valor = (email || this.participanteBusca()).trim().toLowerCase();
    if (!valor || !this.isValidEmail(valor)) return;
    if (valor === this.normalizedRequesterEmail()) return;
    if (!this.participantes().includes(valor)) {
      this.participantes.set([...this.participantes(), valor]);
    }
    this.participanteBusca.set('');
    this.sugestoes.set([]);
    this.agendarPreview();
  }

  removerParticipante(email: string): void {
    this.participantes.set(this.participantes().filter((p) => p !== email));
    this.agendarPreview();
  }

  agendarPreview(): void {
    this.previewQuery$.next();
  }

  isRequesterEmail(email: string): boolean {
    return email.trim().toLowerCase() === this.normalizedRequesterEmail();
  }

  isParticipantAvailable(email: string): boolean {
    if (this.isRequesterEmail(email)) return !this.requesterHasConflict();
    const p = this.availabilityPreview()?.participants?.find(
      (x) => x.email.toLowerCase() === email.toLowerCase()
    );
    if (!p) return true;
    return this.isEntityAvailable(p);
  }

  isRoomAvailable(): boolean {
    return !this.hasRoomConflict();
  }

  reservar(): void {
    if (this.submitDisabled() || this.salvando()) return;

    const sala = this.sala();
    const start = this.slotStart();
    const end = this.slotEnd();
    const loc = this.localidade();
    const titulo = this.titulo().trim();
    const requester = this.normalizedRequesterEmail();

    if (!sala || !start || !end || !loc) return;
    if (!titulo) {
      this.alertas.erro('Informe o título da reunião.');
      return;
    }
    if (!requester) {
      this.alertas.erro('Sua conta não possui e-mail válido para reservar.');
      return;
    }
    if (!this.isValidEmail(requester)) {
      this.alertas.erro('E-mail do organizador inválido.');
      return;
    }
    if (this.participantes().includes(requester)) {
      this.alertas.erro('Não repita o organizador na lista de participantes.');
      return;
    }

    if (this.hasPeopleConflicts()) {
      this.showConflictConfirm.set(true);
      return;
    }

    this.executarReserva(false, false);
  }

  confirmConflict(): void {
    this.showConflictConfirm.set(false);
    this.executarReserva(true, true);
  }

  cancelConflictConfirm(): void {
    this.showConflictConfirm.set(false);
  }

  private executarReserva(
    allowRequesterConflict: boolean,
    allowParticipantConflict: boolean
  ): void {
    const sala = this.sala();
    const start = this.slotStart();
    const end = this.slotEnd();
    const loc = this.localidade();
    const titulo = this.titulo().trim();
    const requester = this.normalizedRequesterEmail();

    if (!sala || !start || !end || !loc || !titulo || !requester) return;

    this.salvando.set(true);
    this.salasService
      .book(loc, {
        roomEmail: sala.email,
        title: titulo,
        start: start.toISOString(),
        end: end.toISOString(),
        requesterEmail: requester,
        participants: this.participantes().filter((p) => p !== requester),
        allowRequesterConflict,
        allowParticipantConflict,
      })
      .subscribe({
        next: () => {
          this.salvando.set(false);
          this.alertas.sucesso('Reserva criada com sucesso.');
          this.booked.emit();
        },
        error: (err: HttpErrorResponse) => {
          this.salvando.set(false);
          const code = err.error?.code as string | undefined;
          let mensagem = err.error?.mensagem || 'Falha ao reservar a sala.';

          if (code === 'PARTICIPANT_CONFLICT') {
            mensagem =
              err.error?.mensagem ||
              'A agenda de outro participante está ocupada neste horário. Escolha outro horário ou remova participantes em conflito.';
          } else if (code === 'REQUESTER_CONFLICT') {
            mensagem =
              err.error?.mensagem ||
              'Você já possui compromisso neste horário. Confirme novamente se deseja agendar.';
          } else if (code === 'REQUESTER_CALENDAR_UNAVAILABLE') {
            mensagem =
              err.error?.mensagem ||
              'Não foi possível criar a reserva no seu calendário. Tente novamente ou contate o suporte.';
          } else if (code === 'ROOM_CONFLICT') {
            mensagem =
              err.error?.mensagem ||
              'A sala selecionada não está disponível neste horário. Escolha outro horário na grade.';
            this.roomConflict.emit();
          }

          this.alertas.erro(mensagem);
        },
      });
  }

  private buildConflictConfirmMessage(): string {
    const timeRange = this.horarioLabel();
    const busyEmails = this.busyPeopleEmails();
    if (!busyEmails.length) {
      return `Há conflitos de agenda neste horário (${timeRange}). Deseja agendar mesmo assim?`;
    }
    if (busyEmails.length === 1) {
      return `${busyEmails[0]} já tem compromisso neste horário (${timeRange}). Deseja agendar mesmo assim?`;
    }
    return `As seguintes pessoas já têm compromisso neste horário (${timeRange}): ${busyEmails.join(', ')}. Deseja agendar mesmo assim?`;
  }

  private busyPeopleEmails(): string[] {
    const emails: string[] = [];
    if (this.requesterHasConflict() && this.normalizedRequesterEmail()) {
      emails.push(this.normalizedRequesterEmail());
    }
    for (const p of this.optionalParticipantPreview()) {
      const start = this.slotStart();
      const end = this.slotEnd();
      if (!start || !end) continue;
      if (blocksBooking(start.toISOString(), end.toISOString(), p)) {
        emails.push(p.email.trim().toLowerCase());
      }
    }
    return emails;
  }

  private hasRoomConflictsForSelectedRange(): boolean {
    const preview = this.availabilityPreview();
    const start = this.slotStart();
    const end = this.slotEnd();

    if (preview?.room && start && end) {
      if (blocksBooking(start.toISOString(), end.toISOString(), preview.room)) {
        return true;
      }
    }

    if (!start || !end || !this.roomSlots().length) {
      return false;
    }

    const rangeStart = start.getTime();
    const rangeEnd = end.getTime();
    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart >= rangeEnd) {
      return false;
    }

    const overlappingSlots = this.roomSlots().filter((slot) => {
      const slotStart = slot.start.getTime();
      const slotEnd = slot.end.getTime();
      if (!Number.isFinite(slotStart) || !Number.isFinite(slotEnd)) return false;
      return slotStart < rangeEnd && slotEnd > rangeStart;
    });

    return overlappingSlots.some((slot) => slot.status === 'occupied');
  }

  private requesterPreview(): AvailabilityItem | undefined {
    const preview = this.availabilityPreview();
    const requester = this.normalizedRequesterEmail();
    if (!preview?.participants?.length || !requester) return undefined;
    return preview.participants.find((p) => p.email.trim().toLowerCase() === requester);
  }

  private optionalParticipantPreview(): AvailabilityItem[] {
    const preview = this.availabilityPreview();
    if (!preview?.participants?.length) return [];
    return preview.participants.filter((p) => !this.isRequesterEmail(p.email));
  }

  private isEntityAvailable(entity: AvailabilityItem): boolean {
    const start = this.slotStart();
    const end = this.slotEnd();
    if (!start || !end) return true;
    return !blocksBooking(start.toISOString(), end.toISOString(), entity);
  }

  private buildPreviewParticipants(): string[] {
    const requester = this.normalizedRequesterEmail();
    const onlyParticipants = this.participantes().filter((e) => this.isValidEmail(e));
    if (!this.isValidEmail(requester)) return onlyParticipants;
    return [requester, ...onlyParticipants.filter((e) => e !== requester)];
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
