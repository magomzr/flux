/**
 * k6 performance test — SDK delivery endpoints
 *
 * Cómo correr:
 *   k6 run sdk-flags.js
 *
 * Con más carga:
 *   k6 run --vus 100 --duration 30s sdk-flags.js
 *
 * Requiere: config.local.js en la misma carpeta (ver config.local.example.js)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Importar config local (no commiteada)
import config from './config.local.js';

// ─── Métricas custom ──────────────────────────────────────────────────────────

const flagsLatency    = new Trend('sdk_flags_all_duration', true);
const flagKeyLatency  = new Trend('sdk_flags_key_duration', true);
const cacheHitRate    = new Rate('sdk_cache_hit_304');
const errorRate       = new Rate('sdk_error_rate');
const totalEvals      = new Counter('sdk_total_evaluations');

// ─── Escenarios ───────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Escenario 1: carga sostenida — simula polling de SDKs en producción
    sustained_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      tags: { scenario: 'sustained' },
    },
    // Escenario 2: spike — simula un deploy que invalida cache y todos recargan
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s',  target: 200 },
        { duration: '10s', target: 200 },
        { duration: '5s',  target: 0   },
      ],
      startTime: '35s', // empieza después del escenario sostenido
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    // El p95 debe estar bajo 10ms con cache caliente
    'sdk_flags_all_duration{scenario:sustained}':  ['p(95)<10'],
    'sdk_flags_key_duration{scenario:sustained}':  ['p(95)<10'],
    // Durante el spike permitimos más latencia
    'sdk_flags_all_duration{scenario:spike}':      ['p(95)<50'],
    // Error rate debe ser 0
    'sdk_error_rate':                              ['rate<0.01'],
    // http_req_failed global
    'http_req_failed':                             ['rate<0.01'],
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

const BASE_URL  = config.baseUrl;
const API_KEY   = config.sdkApiKey;
const FLAG_KEYS = config.flagKeys; // array de keys a evaluar

const headers = {
  'X-Api-Key': API_KEY,
};

// ETag del último GET /sdk/flags — para probar conditional GET
let lastEtag = '';

// ─── Test principal ───────────────────────────────────────────────────────────

export default function () {
  const scenario = __ENV.K6_SCENARIO ?? 'default';

  // 60% del tráfico: GET /sdk/flags (todos los flags)
  if (Math.random() < 0.6) {
    testGetAllFlags();
  }
  // 30%: GET /sdk/flags/:key (flag específico)
  else if (Math.random() < 0.9) {
    testGetFlagByKey();
  }
  // 10%: conditional GET con ETag (simula SDK con cache local)
  else {
    testConditionalGet();
  }

  totalEvals.add(1);

  // Sin sleep — queremos medir throughput máximo
  // Descomenta si quieres simular polling real cada N segundos:
  // sleep(config.pollIntervalSeconds ?? 10);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function testGetAllFlags() {
  const res = http.get(`${BASE_URL}/sdk/flags`, { headers, tags: { endpoint: 'all_flags' } });

  flagsLatency.add(res.timings.duration);

  const ok = check(res, {
    'GET /sdk/flags → 200':          (r) => r.status === 200,
    'response is array':             (r) => Array.isArray(r.json()),
    'has ETag header':               (r) => r.headers['Etag'] !== undefined,
    'response time < 50ms':          (r) => r.timings.duration < 50,
  });

  if (!ok) errorRate.add(1);
  else errorRate.add(0);

  // Guardar ETag para conditional GET
  if (res.headers['Etag']) {
    lastEtag = res.headers['Etag'];
  }
}

function testGetFlagByKey() {
  const key = FLAG_KEYS[Math.floor(Math.random() * FLAG_KEYS.length)];
  const res = http.get(`${BASE_URL}/sdk/flags/${key}`, { headers, tags: { endpoint: 'flag_key' } });

  flagKeyLatency.add(res.timings.duration);

  const ok = check(res, {
    'GET /sdk/flags/:key → 200':     (r) => r.status === 200,
    'has key field':                 (r) => r.json('key') === key,
    'has enabled field':             (r) => r.json('enabled') !== undefined,
    'response time < 20ms':          (r) => r.timings.duration < 20,
  });

  if (!ok) errorRate.add(1);
  else errorRate.add(0);
}

function testConditionalGet() {
  if (!lastEtag) {
    testGetAllFlags();
    return;
  }

  const conditionalHeaders = { ...headers, 'If-None-Match': lastEtag };
  const res = http.get(`${BASE_URL}/sdk/flags`, {
    headers: conditionalHeaders,
    tags: { endpoint: 'conditional' },
  });

  // 304 = cache hit, 200 = flags cambiaron
  const is304 = res.status === 304;
  const is200 = res.status === 200;

  cacheHitRate.add(is304 ? 1 : 0);

  check(res, {
    'conditional GET → 304 or 200':  (r) => r.status === 304 || r.status === 200,
  });

  if (is200 && res.headers['Etag']) {
    lastEtag = res.headers['Etag'];
  }
}
