import type { Role } from './role';

/**
 * Types miroir du domaine `auth` du contrat d'API partagé `studentapi`
 * (`docs/openapi.yaml`, v0.2.0, tag `auth`, `components.schemas`). Ce fichier CONSOMME le
 * contrat, il ne le définit pas : toute évolution (champ ajouté/retiré, renommage, valeur
 * d'enum) doit d'abord être décidée côté contrat par l'orchestrateur, jamais improvisée ici.
 *
 * `Role` reste défini dans `./role.ts` (source unique déjà en place, consommée par
 * `SessionService`/`roleGuard`) — réexporté ici pour que ce module reste le point d'entrée
 * complet du domaine `auth`.
 */
export type { Role };

/** `components.schemas.VerificationStatus`. */
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

/** `components.schemas.User` — réponse de `GET /auth/me` et champ `user` de `AuthResponse`. */
export interface User {
  id: string;
  email: string;
  role: Role;
  verificationStatus: VerificationStatus;
  /**
   * Motif renseigné uniquement lorsque `verificationStatus === 'rejected'`, pour que
   * l'utilisateur sache quoi corriger. `null`/absent sinon.
   */
  verificationRejectionReason?: string | null;
  createdAt: string;
}

/** `components.schemas.AuthTokens` — réponse de `POST /auth/refresh` et champ `tokens` de `AuthResponse`. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** `components.schemas.AuthResponse` — réponse 201 de `POST /auth/register` et 200 de `POST /auth/login`. */
export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

/**
 * `components.schemas.RegisterRequest` — corps de `POST /auth/register`. `moderateur`
 * volontairement exclu du rôle inscriptible (création manuelle interne uniquement, voir
 * `Role` dans `./role.ts`).
 */
export interface RegisterRequest {
  email: string;
  password: string;
  role: 'etudiant' | 'recruteur';
}

/** `components.schemas.LoginRequest` — corps de `POST /auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}
