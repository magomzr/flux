/**
 * Copia este archivo como config.local.js y rellena los valores.
 * config.local.js está en .gitignore — nunca lo commitees.
 */

export default {
  // URL base del servidor
  baseUrl: 'http://localhost:3000',

  // SDK API key del ambiente que quieres testear
  // Genérala con POST /projects/:projectId/environments/:environmentId/keys
  sdkApiKey: 'flux_production_REEMPLAZA_CON_TU_KEY',

  // Keys de flags que existen en el ambiente — para testGetFlagByKey
  flagKeys: [
    'new_checkout_flow',
    'banner_text',
    'theme_config',
  ],

  // Intervalo de polling en segundos (solo si usas sleep en el test)
  pollIntervalSeconds: 10,
};
