# Roadmap — Plateforme étudiants ↔ recruteurs

Backlog dérivé de `docs/cahier_charger_app_context.md` (cahier des charges) et
`docs/feature_to_propose_.txt` (liste de features). Couvre les deux repos :
front `studentapp` (Angular) et backend `studentapi` (NestJS,
`D:\projet\helene\app-mobile\studentapi`).

Ordre : les épics sont numérotés dans un ordre de dépendance logique. Au sein d'un épic,
back et front peuvent souvent avancer en parallèle une fois le contrat d'API de l'épic figé.

## Épic 0 — Fondations techniques

- [x] Définir le contrat d'API initial (OpenAPI) partagé entre `studentapp` et `studentapi` :
      auth, rôles (étudiant / recruteur / modérateur), erreurs standard
      → `studentapi/docs/openapi.yaml` v0.1.0
- [ ] Backend : setup auth (stratégie JWT ou session), modules de base NestJS (users, auth)
- [ ] Front : setup thème Angular Material + Tailwind, structure des routes par rôle
      (public / étudiant / recruteur / back-office modération), guards de rôle
- [ ] Décider le stockage des documents de vérification (upload carte étudiant, pièce
      d'identité, justificatif entreprise) — service de fichiers/S3 compatible

## Épic 1 — Authentification & vérification des profils

- [ ] Inscription / connexion étudiant
- [ ] Inscription / connexion recruteur
- [ ] Upload documents de vérification (étudiant : carte étudiant ou certificat de
      scolarité ; recruteur : pièce d'identité + justificatif d'existence de la structure
      si applicable)
- [ ] File d'attente de modération : l'équipe interne valide/rejette chaque profil
- [ ] Badge "profil vérifié" affiché une fois validé

## Épic 2 — Profil étudiant

- [ ] Formulaire de profil : identité, université + n° de carte, filière et niveau
      d'étude, expériences/compétences, langues parlées, horaires de cours + heures
      libres, lieu de résidence, type d'opportunité recherchée (job/mission/course...)
- [ ] Champs sensibles avec consentement explicite et visibilité restreinte à l'équipe de
      modération uniquement (jamais exposés au recruteur) : situation de logement (seul
      ou avec parents/tuteurs), aptitudes/handicap, allergies
- [ ] Option "urgence" : message privé de détresse → traité par l'équipe de modération,
      qui peut prioriser la demande ou orienter directement vers un recruteur pertinent

## Épic 3 — Profil recruteur & offres

- [ ] Formulaire de profil structure (entreprise, commerce, agence, hôtel, restaurant,
      ONG, particulier)
- [ ] Publication d'un besoin/offre : type de mission, horaires, durée, rémunération ou
      indemnité de stage, compétences souhaitées, lieu de travail

## Épic 4 — Modération & back-office

- [ ] Interface interne (équipe + délégués/responsables universitaires associés) pour
      valider les profils étudiants/recruteurs et arbitrer les demandes d'urgence
- [ ] Constitution de la "liste validée" envoyée au recruteur — le recruteur ne doit
      jamais avoir d'accès direct aux profils étudiants bruts

## Épic 5 — Matching & recherche

- [ ] Moteur de matching automatique offres ↔ profils : compétences, disponibilités
      (horaires de cours vs horaires de mission), localisation, type de mission recherché
- [ ] Recherche d'offres côté étudiant, filtrée par compatibilité avec l'emploi du temps
      universitaire
- [ ] Recherche/filtrage côté recruteur limité à la liste de candidats déjà validée

## Épic 6 — Sélection & suivi de mission

- [ ] Le recruteur sélectionne un candidat parmi la liste validée
- [ ] Suivi de statut de candidature (en attente / validée / sélectionnée / en mission /
      terminée)

## Épic 7 — Évaluation & réputation

- [ ] Évaluation recruteur → étudiant en fin de mission/stage
- [ ] Évaluation étudiant → recruteur en fin de mission/stage
- [ ] Score de réputation visible sur les profils (contribue à la confiance de la
      plateforme)

## Épic 8 — Signalement & sécurité

- [ ] Signalement : fausse offre, comportement inapproprié, arnaque, impayé, abus
- [ ] Suspension de compte par l'équipe de modération en cas de non-respect des règles

## Épic 9 — Notifications

- [ ] Notifications de matching (nouvelle offre/candidat compatible)
- [ ] Notifications de changement de statut de candidature
- [ ] Notifications de messages / urgences

## Épic 10 — Écrans & navigation (front)

- [ ] Arborescence de routes complète (`app.routes.ts`) : public, espace étudiant, espace
      recruteur, back-office modération
- [ ] Layouts distincts par rôle + guards de navigation

---

Notes d'orchestration : tout contrat d'API/DTO/schéma est décidé par l'orchestrateur avant
délégation (jamais par un agent d'implémentation). Un épic peut être découpé en tâches
atomiques via `planner` au moment de l'attaquer.
