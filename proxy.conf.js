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

/**
 * `/moderation` est À LA FOIS un préfixe d'API et une route de navigation du front
 * (`/moderation/urgences`, `/moderation/etudiants/:userId`). Sans discriminant, un
 * rechargement ou un lien direct vers ces écrans partait au backend, qui répondait 404 :
 * l'application ne se chargeait pas du tout.
 *
 * Le discriminant retenu est l'en-tête `Accept` : une navigation de navigateur demande
 * `text/html`, un appel `HttpClient` demande `application/json`. Les navigations sont donc
 * exclues du proxy et retombent sur le fallback SPA du dev-server.
 */
/**
 * `bypass` : rend la main au dev-server au lieu de proxifier. Retourner un chemin sert ce
 * chemin ; retourner `null`/`undefined` laisse la requête partir au backend.
 *
 * Nécessaire parce que `/moderation` est à la fois un préfixe d'API et une route de
 * navigation du front (`/moderation/urgences`, `/moderation/etudiants/:userId`). Sans ce
 * discriminant, un rechargement ou un lien direct vers ces écrans partait au backend, qui
 * répondait 404 : l'application ne se chargeait pas. Une navigation de navigateur demande
 * `text/html`, un appel `HttpClient` demande `application/json` — d'où ce test.
 *
 * Le filtrage par chemin reste porté par les clés ci-dessous : Angular impose des chaînes
 * (`load-proxy-config.js` rejette un `context` non-tableau-de-chaînes), une fonction de
 * filtre n'est donc pas une option ici.
 */
function bypassBrowserNavigation(req) {
  return req.headers.accept?.includes('text/html') ? '/index.html' : null;
}

const proxyOptions = {
  target: API_TARGET,
  changeOrigin: true,
  secure: false,
  bypass: bypassBrowserNavigation,
};

module.exports = {
  '/auth': proxyOptions,
  '/students': proxyOptions,
  '/moderation': proxyOptions,
  '/verification': proxyOptions,
};
