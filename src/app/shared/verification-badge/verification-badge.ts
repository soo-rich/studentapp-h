import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { VerificationStatus } from '../../core/auth/auth.types';

/**
 * Badge de vérification de profil (étudiant ou recruteur), cf. cahier des charges.
 *
 * Purement présentationnel : aucun appel API, aucune injection de service, aucun state —
 * uniquement des `input()`. L'intégration dans les dashboards (affichage du badge d'un
 * utilisateur réel) est hors périmètre de ce composant (voir FE12/FE13).
 */
@Component({
  selector: 'app-verification-badge',
  imports: [MatIconModule],
  templateUrl: './verification-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationBadge {
  /** `User.verificationStatus` — état à représenter. */
  readonly status = input.required<VerificationStatus>();

  /**
   * `User.verificationRejectionReason` — affiché uniquement lorsque
   * `status() === 'rejected'` et qu'un motif non vide est fourni.
   */
  readonly rejectionReason = input<string | null>();

  /** Icône Material associée à l'état — l'état n'est jamais porté par la seule couleur. */
  protected readonly icon = computed<string>(() => {
    switch (this.status()) {
      case 'verified':
        return 'check_circle';
      case 'rejected':
        return 'cancel';
      case 'pending':
        return 'schedule';
    }
  });

  /** Libellé textuel associé à l'état — toujours affiché à côté de l'icône. */
  protected readonly label = computed<string>(() => {
    switch (this.status()) {
      case 'verified':
        return 'Profil vérifié';
      case 'rejected':
        return 'Vérification refusée';
      case 'pending':
        return 'En attente de vérification';
    }
  });

  /** Classes Tailwind du badge — distinctes par état, en complément du texte/icône. */
  protected readonly toneClasses = computed<string>(() => {
    switch (this.status()) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-gray-100 text-gray-700';
    }
  });

  /** Motif à afficher, uniquement pertinent pour l'état `rejected`. */
  protected readonly displayedRejectionReason = computed<string | null>(() => {
    if (this.status() !== 'rejected') {
      return null;
    }
    const reason = this.rejectionReason();
    return reason ? reason : null;
  });

  /** `aria-label` complet du badge : l'état ne doit jamais reposer sur la seule couleur. */
  protected readonly ariaLabel = computed<string>(() => {
    const reason = this.displayedRejectionReason();
    return reason ? `${this.label()} : ${reason}` : this.label();
  });
}
