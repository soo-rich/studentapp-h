export const environment = {
  production: false,
  // Vide -> requêtes émises en RELATIF, interceptées par le proxy de dev (`proxy.conf.js`,
  // branché sur la cible `serve` dans `angular.json`), qui les redirige vers le backend réel
  // (`API_TARGET`, défaut `http://localhost:3000`). Voir `auth.interceptor.ts` : un
  // `apiBaseUrl` vide fait basculer le filtrage des requêtes API sur une liste de préfixes
  // connus plutôt que sur `startsWith(apiBaseUrl)`.
  apiBaseUrl: '',
};
