import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { OfferStatus } from '../../data/offers.types';

/**
 * Badge de statut d'offre (`Offer.status`), purement présentationnel : aucun appel API,
 * aucune injection de service, aucun state — uniquement des `input()`. Calque
 * `shared/verification-badge/verification-badge.ts` (voir CLAUDE.md — "Badges de statut =
 * petits composants présentationnels maison").
 */
@Component({
  selector: 'app-offer-status-badge',
  imports: [MatIconModule],
  templateUrl: './offer-status-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferStatusBadge {
  readonly status = input.required<OfferStatus>();

  /** Icône Material associée à l'état — l'état n'est jamais porté par la seule couleur. */
  protected readonly icon = computed<string>(() => {
    switch (this.status()) {
      case 'draft':
        return 'edit_note';
      case 'published':
        return 'public';
      case 'closed':
        return 'lock';
    }
  });

  /** Libellé textuel associé à l'état — toujours affiché à côté de l'icône. */
  protected readonly label = computed<string>(() => {
    switch (this.status()) {
      case 'draft':
        return 'Brouillon';
      case 'published':
        return 'Publiée';
      case 'closed':
        return 'Fermée';
    }
  });

  /** Classes Tailwind du badge — distinctes par état, en complément du texte/icône. */
  protected readonly toneClasses = computed<string>(() => {
    switch (this.status()) {
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
    }
  });
}
