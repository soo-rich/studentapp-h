import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { CandidateVisibleStatus } from '../../data/candidates.types';

/**
 * Badge de statut de candidature côté recruteur (`CandidateCard.status`), purement
 * présentationnel : aucun appel API, aucune injection de service, aucun state — uniquement
 * des `input()`. Calque `shared/verification-badge/verification-badge.ts` (voir CLAUDE.md —
 * "Badges de statut = petits composants présentationnels maison").
 */
@Component({
  selector: 'app-candidate-status-badge',
  imports: [MatIconModule],
  templateUrl: './candidate-status-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateStatusBadge {
  readonly status = input.required<CandidateVisibleStatus>();

  /** Icône Material associée à l'état — l'état n'est jamais porté par la seule couleur. */
  protected readonly icon = computed<string>(() => {
    switch (this.status()) {
      case 'forwarded':
        return 'inbox';
      case 'selected':
        return 'schedule';
      case 'accepted':
        return 'check_circle';
      case 'declined':
        return 'cancel';
      case 'rejected_by_recruiter':
        return 'block';
    }
  });

  /** Libellé textuel associé à l'état — toujours affiché à côté de l'icône. */
  protected readonly label = computed<string>(() => {
    switch (this.status()) {
      case 'forwarded':
        return 'Transmis';
      case 'selected':
        return 'Sélectionné, en attente de réponse';
      case 'accepted':
        return 'Accepté';
      case 'declined':
        return 'Refusé par le candidat';
      case 'rejected_by_recruiter':
        return 'Écarté';
    }
  });

  /** Classes Tailwind du badge — distinctes par état, en complément du texte/icône. */
  protected readonly toneClasses = computed<string>(() => {
    switch (this.status()) {
      case 'forwarded':
        return 'bg-gray-100 text-gray-700';
      case 'selected':
        return 'bg-blue-100 text-blue-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'declined':
      case 'rejected_by_recruiter':
        return 'bg-red-100 text-red-800';
    }
  });
}
