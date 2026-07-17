import { inject } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { VerificationApiService } from './verification-api.service';
import { verificationKeys } from './verification.keys';
import { DocumentType, VerificationDocument } from './verification.types';

/**
 * Composables TanStack Query pour le domaine `/verification/documents*` (documents de
 * vérification de l'utilisateur courant). Chaque fonction `inject*` doit être appelée dans un
 * contexte d'injection (constructeur/champ de composant standalone, ou un autre composable
 * appelé depuis un tel contexte) — même contrainte que `injectQuery`/`injectMutation`
 * eux-mêmes. Elles encapsulent `VerificationApiService` (accès HTTP brut) derrière le pattern
 * query/mutation attendu par le projet (voir CLAUDE.md — "tout appel API passe par TanStack
 * Query"). Le Bearer est ajouté automatiquement par `authInterceptor` (FE3) : aucun token géré
 * manuellement ici.
 */

/** `GET /verification/documents` — liste des documents de l'utilisateur courant. */
export function injectVerificationDocumentsQuery() {
  const verificationApi = inject(VerificationApiService);

  return injectQuery(() => ({
    queryKey: verificationKeys.documents(),
    queryFn: (): Promise<VerificationDocument[]> => firstValueFrom(verificationApi.list()),
  }));
}

/** Variables de `injectUploadVerificationDocumentMutation` : type de document + fichier. */
export interface UploadVerificationDocumentVariables {
  type: DocumentType;
  file: File;
}

/**
 * `POST /verification/documents` — téléverse un document (type + fichier). Invalide
 * `verificationKeys.documents()` après succès pour refléter immédiatement le nouveau document
 * (et le profil remis en `pending`, voir `docs/openapi.yaml`).
 */
export function injectUploadVerificationDocumentMutation() {
  const verificationApi = inject(VerificationApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: ({
      type,
      file,
    }: UploadVerificationDocumentVariables): Promise<VerificationDocument> =>
      firstValueFrom(verificationApi.upload(type, file)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: verificationKeys.documents() });
    },
  }));
}

/**
 * `DELETE /verification/documents/{documentId}` — supprime un document de l'utilisateur
 * courant. Invalide `verificationKeys.documents()` après succès.
 */
export function injectDeleteVerificationDocumentMutation() {
  const verificationApi = inject(VerificationApiService);
  const queryClient = inject(QueryClient);

  return injectMutation(() => ({
    mutationFn: (documentId: string): Promise<void> =>
      firstValueFrom(verificationApi.delete(documentId)),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: verificationKeys.documents() });
    },
  }));
}
