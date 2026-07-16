# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du projet

Scaffold Angular CLI fraîchement généré (Angular 21.2), quasiment vide de logique métier :
un seul composant racine (`App`), aucune route déclarée, aucun service, aucun state
management. Le dossier s'appelle `app-mobile/studentapp` mais aucune techno mobile
(Capacitor, Ionic, React Native) n'est présente — c'est une app web Angular standard pour
l'instant.

Contexte produit (voir `docs/feature_to_propose_.txt`) : application de mise en relation
étudiants/recruteurs — écrans, parcours étudiant, parcours recruteur, notifications,
recherche, matching offres/profils, avec des champs profil sensibles (situation de
logement, aptitudes/handicap, allergies). `docs/` contient aussi un `.docx` de spec
("Projet emploi-étudiants") non encore exploité par le code.

## Commandes

- Installation : `npm install` (⚠️ `package.json` déclare `"packageManager": "pnpm@10.33.3"`
  — modif encore non commitée d'après `git status` — mais seul `package-lock.json` est
  versionné, pas de `pnpm-lock.yaml`, et `angular.json` pointe toujours `"packageManager":
  "npm"`. Vérifier avec l'utilisateur avant de changer de gestionnaire de paquets).
- Serveur de dev : `npm start` (= `ng serve`) → http://localhost:4200, rechargement à chaud.
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
  mesure des écrans (parcours étudiant / parcours recruteur mentionnés dans les specs).
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
