import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { CandidatesApiService } from './candidates-api.service';
import { candidatesKeys } from './candidates.keys';
import {
  CandidateCard,
  CandidateCardPage,
  CandidateContact,
  CandidateQueueParams,
} from './candidates.types';
import { offersKeys } from './offers.keys';

/**
 * Composables TanStack Query pour le domaine `/recruiters/me/offers/{offerId}/candidates*`
 * (fiches candidats anonymes d'une offre du recruteur courant). Chaque fonction `inject*` doit
 * être appelée dans un contexte d'injection (constructeur/champ de composant standalone, ou
 * un autre composable appelé depuis un tel contexte) — même contrainte que
 * `injectQuery`/`injectMutation` eux-mêmes. Elles encapsulent `CandidatesApiService` (accès
 * HTTP brut) derrière le pattern query/mutation attendu par le projet (voir CLAUDE.md — "tout
 * appel API passe par TanStack Query"). Le Bearer est ajouté automatiquement par
 * `authInterceptor` (FE3) : aucun token géré manuellement ici.
 */

/**
 * `GET /recruiters/me/offers/{offerId}/candidates` — liste paginée des fiches candidats
 * ANONYMES d'une offre. Désactivée tant que `offerId()` est `null`. `params` est une fonction
 * (pas une valeur) pour que la query key et le refetch réagissent aux changements de
 * filtre/pagination (signal-based, cohérent avec `injectModerationQueueQuery`).
 */
export function injectCandidatesQuery(
  offerId: () => string | null,
  params: () => CandidateQueueParams,
) {
  const candidatesApi = inject(CandidatesApiService);

  return injectQuery(() => ({
    queryKey: candidatesKeys.list(offerId() ?? '', params()),
    queryFn: (): Promise<CandidateCardPage> =>
      firstValueFrom(candidatesApi.listCandidates(offerId()!, params())),
    enabled: offerId() !== null,
  }));
}

/**
 * `GET /recruiters/me/offers/{offerId}/candidates/{applicationId}/contact` — coordonnées d'un
 * candidat ayant accepté le dévoilement. Désactivée tant que `applicationId()` est `null`
 * (déclenchée explicitement par l'action « voir les coordonnées », pas automatiquement au
 * chargement de la liste — voir `CandidateContact` : seul point du contrat exposant
 * l'identité d'un étudiant à un recruteur).
 */
export function injectCandidateContactQuery(
  offerId: () => string | null,
  applicationId: () => string | null,
) {
  const candidatesApi = inject(CandidatesApiService);

  return injectQuery(() => ({
    queryKey: candidatesKeys.contact(offerId() ?? '', applicationId() ?? ''),
    queryFn: (): Promise<CandidateContact> =>
      firstValueFrom(candidatesApi.getCandidateContact(offerId()!, applicationId()!)),
    enabled: offerId() !== null && applicationId() !== null,
  }));
}

/** Variables de `injectSelectCandidateMutation` : offre + candidature ciblées. */
export interface SelectCandidateVariables {
  offerId: string;
  applicationId: string;
}

/**
 * `POST /recruiters/me/offers/{offerId}/candidates/{applicationId}/select` — sélectionne un
 * candidat transmis (`forwarded` → `selected`). Invalide `candidatesKeys.all` (liste des
 * candidats) ET `offersKeys.all` (le décompte affiché sur l'offre peut dépendre de l'état des
 * candidatures) après succès.
 */
export function injectSelectCandidateMutation() {
  const candidatesApi = inject(CandidatesApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: ({ offerId, applicationId }: SelectCandidateVariables): Promise<CandidateCard> =>
      firstValueFrom(candidatesApi.selectCandidate(offerId, applicationId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: candidatesKeys.all });
      void queryClient.invalidateQueries({ queryKey: offersKeys.all });
    },
  }));
}
