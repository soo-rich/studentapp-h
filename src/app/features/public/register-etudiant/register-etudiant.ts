import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { injectRegisterMutation } from '../../../core/auth/auth.queries';
import { RegisterRequest } from '../../../core/auth/auth.types';
import { SessionService } from '../../../core/auth/session.service';
import { extractErrorMessage } from '../../../core/http/api-error';

/**
 * Écran d'inscription étudiant — `POST /auth/register` avec `role` fixé à `'etudiant'`
 * (jamais un champ de saisie, voir `RegisterRequest` du contrat `studentapi`).
 *
 * Soumission via `injectRegisterMutation` (FE2, TanStack Query) — aucun `HttpClient`/`fetch`
 * direct ici. Succès -> `SessionService.setSession(authResponse)` puis redirection
 * `/etudiant`. Le token Bearer est géré par `authInterceptor` (FE3), qui exclut de toute
 * façon `/auth/register` — rien à faire ici de ce côté.
 */
@Component({
  selector: 'app-register-etudiant',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register-etudiant.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterEtudiant {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);

  /** Mutation TanStack `POST /auth/register` (FE2) — expose `mutate`, `isPending`, `error`. */
  protected readonly registerMutation = injectRegisterMutation();

  /**
   * `email` (requis, format email) + `password` (requis, min 8 — cohérent avec
   * `RegisterRequest.password.minLength: 8`). `role` n'est volontairement PAS un contrôle
   * du formulaire : il est fixé à `'etudiant'` au moment de construire le payload, voir
   * `onSubmit()`.
   */
  protected readonly form = this.formBuilder.group({
    email: this.formBuilder.control('', [Validators.required, Validators.email]),
    password: this.formBuilder.control('', [Validators.required, Validators.minLength(8)]),
  });

  /** Message d'erreur traduit à afficher, `null` tant qu'aucune tentative n'a échoué. */
  protected readonly errorMessage = computed<string | null>(() => {
    const error = this.registerMutation.error();
    return error === null ? null : extractErrorMessage(error);
  });

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    const payload: RegisterRequest = { email, password, role: 'etudiant' };

    this.registerMutation.mutate(payload, {
      onSuccess: (authResponse) => {
        this.sessionService.setSession(authResponse);
        void this.router.navigate(['/etudiant']);
      },
    });
  }
}
