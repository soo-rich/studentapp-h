# CLAUDE.md

Ce fichier guide Claude Code sur ce dépôt.

## État du projet

Scaffold Angular CLI fraîchement généré (Angular 21.2), quasiment vide de logique métier :
un seul composant racine (`App`), aucune route déclarée (`src/app/app.routes.ts` → `routes: Routes = []`),
aucun service, aucun state management. Le dossier s'appelle `app-mobile/studentapp` mais aucune
techno mobile (Capacitor, Ionic, React Native) n'est présente — c'est une app web Angular
standard pour l'instant, à considérer comme mobile-first (Tailwind) plutôt que native.

`@angular/material` et `@angular/cdk` sont déjà en dépendances mais non initialisés (pas de
thème configuré, aucun composant Material importé) — à mettre en place avant tout premier écran.

## Contexte produit

Plateforme togolaise de mise en relation **étudiants ↔ recruteurs** pour jobs à temps partiel,
missions ponctuelles, jobs de vacances et stages académiques/professionnels, compatibles avec
l'emploi du temps universitaire. Spécifications complètes : `docs/cahier_charger_app_context.md`
(cahier des charges narratif) et `docs/feature_to_propose_.txt` (liste brute de features). Un
`.docx` de spec ("Projet emploi-étudiants") est aussi présent dans `docs/` mais pas encore
dépouillé — à consulter si les deux fichiers texte laissent une zone d'ombre.

### Principe clé : le recruteur ne voit jamais les profils étudiants bruts

Différence structurante par rapport à un simple market place d'offres : les candidatures
étudiantes sont **filtrées par une équipe de modération** (+ délégués/responsables universitaires
associés) avant transmission au recruteur, qui ne reçoit qu'une liste validée. Toute
fonctionnalité "recherche de candidats" côté recruteur doit passer par cette étape de
validation — ne jamais concevoir un accès direct recruteur → profil étudiant complet.

### Deux parcours utilisateurs distincts

**Étudiant** — profil : identité, université + numéro de carte, filière/niveau, expériences/
compétences, langues, horaires de cours + heures libres, lieu de résidence, type d'opportunité
recherchée, **situation de logement** (vie seule ou avec parents/tuteurs), **aptitudes/handicap**,
**allergies**. Profil validé seulement après vérification du statut étudiant (carte ou certificat
de scolarité). Option "urgence" : message privé pour signaler une situation de détresse,
examiné par l'équipe pour prioriser la demande ou orienter vers un recruteur pertinent.

**Recruteur** (entreprise, commerce, agence, hôtel, ONG, particulier) — profil vérifié via
documents d'identité/existence de la structure. Publie des besoins : type de mission, horaires,
durée, rémunération/indemnité de stage, compétences souhaitées, lieu de travail.

### Fonctionnalités attendues (source : `docs/feature_to_propose_.txt`)

- Écrans et navigation complète de l'app (à construire — `app.routes.ts` est vide)
- Parcours étudiant et parcours recruteur (deux espaces/rôles distincts, probablement guards +
  layouts séparés)
- Notifications (matching, statut de candidature, messages, urgences)
- Système de recherche (offres pour l'étudiant ; côté recruteur, recherche indirecte via la
  liste validée, jamais un accès direct aux profils)
- Système de matching offres/profils basé sur compétences, disponibilités, localisation, type
  de mission recherché
- Vérification des profils (badge de vérification étudiant/recruteur)
- Évaluation bidirectionnelle en fin de mission/stage (recruteur → étudiant, étudiant → recruteur)
- Signalement (fausses offres, comportements inapropriés, arnaques, impayés, abus) + suspension
  de compte

### Champs sensibles — traiter avec précaution

`situation de logement`, `aptitudes/handicap`, `allergie` sont des données personnelles
sensibles. Prévoir dès la conception : accès restreint (jamais exposées au recruteur, seulement
à l'équipe de modération), consentement explicite de collecte, et ne jamais les inclure dans un
payload ou une réponse API destinés au front recruteur.

## Commandes

- Installation : `npm install` ou `pnpm install` — `package.json` déclare
  `"packageManager": "pnpm@10.33.3"` et `pnpm-lock.yaml` est versionné, mais `package-lock.json`
  l'est aussi et `angular.json` déclare encore `"packageManager": "npm"` (ligne 5). Les deux
  lockfiles coexistent : vérifier avec l'utilisateur avant de choisir un gestionnaire de paquets
  pour ne pas faire diverger les lockfiles.
- Serveur de dev : `npm start` (= `ng serve`) → <http://localhost:4200>, rechargement à chaud.
- Build : `npm run build` (= `ng build`) → sortie dans `dist/`. Config `development` :
  `npm run watch` (= `ng build --watch --configuration development`).
- Tests : `npm test` (= `ng test`), utilise le builder natif `@angular/build:unit-test`
  (Vitest sous le capot, pas de `karma.conf.js`/Jasmine). Un seul fichier de test existe :
  `src/app/app.spec.ts`. La syntaxe exacte pour scoper `ng test` à un fichier/nom de test
  précis n'est pas vérifiée dans ce repo (pas d'exemple, pas de script dédié) — tester
  `ng test -- <args>` (passthrough vers Vitest) avant de s'y fier.
- Pas de script `lint` : aucun ESLint configuré dans le repo.

## Architecture

- `src/main.ts` : bootstrap standalone via `bootstrapApplication(App, appConfig)`.
- `src/app/app.config.ts` : `ApplicationConfig` — providers globaux
  (`provideBrowserGlobalErrorListeners`, `provideRouter(routes)`). C'est ici qu'ajouter tout
  futur provider global (HttpClient, animations, i18n, etc.).
- `src/app/app.routes.ts` : tableau `routes: Routes = []` — vide, à peupler au fur et à
  mesure des écrans (parcours étudiant / parcours recruteur, voir Contexte produit ci-dessus).
- `src/app/app.ts` (+ `.html`/`.css`) : composant racine standalone, seul composant
  existant, importe `RouterOutlet`.
- Style : Tailwind CSS v4 via `@tailwindcss/postcss` (config dans `.postcssrc.json`),
  feuille globale `src/styles.css`.
- TypeScript strict activé (`strict`, `strictTemplates`, `strictInjectionParameters`,
  `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`) — tout nouveau code doit rester compatible avec ce mode.
- Formatage : Prettier (`.prettierrc`, `printWidth: 100`, `singleQuote: true`, parser
  `angular` pour les `*.html`). `.editorconfig` impose indent 2 espaces, quotes simples en
  `.ts`.

## Section projet (à compléter au fil du développement)

- Backend : `D:\projet\helene\app-mobile\studentapi` (NestJS, repo Git séparé). C'est là que
  vivent l'API, les DTO, le schéma de données et les contrats consommés par ce front — ce
  fichier évoluera au fil du développement à mesure que le backend se précise.
- Contrat d'API : à définir conjointement avec `studentapi` (pas encore d'OpenAPI/schéma figé
  dans ce repo front) — toute modification de contrat reste du ressort de l'orchestrateur, pas
  d'un agent d'implémentation.
- Génération services front : n/a pour l'instant (pas de client HTTP généré) — une fois le
  contrat `studentapi` stabilisé, évaluer `api-forge` si une spec OpenAPI/Postman est exportée.
- Conventions spécifiques : n/a
- Pièges connus : voir note packageManager npm/pnpm ci-dessus ; routes et modèle de données
  encore à concevoir — toute décision de contrat (DTO, schéma, rôles/guards étudiant vs
  recruteur) reste du ressort de l'orchestrateur avant délégation.
