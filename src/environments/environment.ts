import type { AppEnvironment } from './environment.model';

/**
 * Development environment (the default file — no replacement applied).
 *
 * `apiBaseUrl` is origin-relative on purpose: `ng serve` forwards `/api/**`
 * to the hosted backend through `proxy.conf.json` (wired in `angular.json`
 * under `serve.configurations.development.proxyConfig`). No localhost port is
 * ever hard-coded in a feature service.
 */
export const environment: AppEnvironment = {
  name: 'development',
  apiBaseUrl: '/api',
};
