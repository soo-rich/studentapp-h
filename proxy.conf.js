// Proxy de développement pour la cible `serve` (`ng serve` / `npm start`, voir `angular.json`).
//
// En développement, `environment.development.ts` déclare `apiBaseUrl: ''` : le front émet des
// requêtes RELATIVES (`/auth/...`, `/students/...`, etc.), comme il le fera en production
// derrière le même domaine. Ce proxy redirige ces requêtes vers le backend `studentapi`
// (NestJS, repo séparé) sans que le front n'ait à connaître son adresse réelle.
//
// Préfixes repris du contrat `studentapi/docs/openapi.yaml` (v0.3.0) — tags `auth`, `students`,
// `moderation`, `verification`. Doivent rester synchronisés avec `API_PATH_PREFIXES` dans
// `src/app/core/auth/auth.interceptor.ts`.
//
// Cible configurable sans toucher au code : `API_TARGET=http://localhost:3001 npm start`.
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:3000';

const proxyOptions = {
  target: API_TARGET,
  changeOrigin: true,
  secure: false,
};

module.exports = {
  '/auth': proxyOptions,
  '/students': proxyOptions,
  '/moderation': proxyOptions,
  '/verification': proxyOptions,
};
