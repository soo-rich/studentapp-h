/**
 * Rôles utilisateur de la plateforme.
 *
 * IMPORTANT — contrat d'API : ces valeurs doivent rester STRICTEMENT synchronisées avec
 * le schéma `Role` du backend `studentapi` (`docs/openapi.yaml`,
 * `components.schemas.Role`, enum `[etudiant, recruteur, moderateur]`). Ce fichier
 * CONSOMME le contrat, il ne le définit pas : toute évolution de ces valeurs (ajout,
 * renommage, casse, accentuation) doit d'abord être décidée côté contrat par
 * l'orchestrateur, jamais improvisée ici.
 *
 * Note : `moderateur` n'est jamais attribuable via `/auth/register` (création manuelle
 * interne uniquement, voir Épic 4) mais reste une valeur valide de rôle côté front pour
 * le guard de l'espace back-office modération.
 */
export type Role = 'etudiant' | 'recruteur' | 'moderateur';
