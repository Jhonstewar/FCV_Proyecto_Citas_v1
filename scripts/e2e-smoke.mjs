#!/usr/bin/env node
// Prueba de humo de extremo a extremo contra citas-api REAL (S3, validacion del contrato REST entre
// repos: RESTRICCIONES_TECNICAS.md "Cross-repo"). Recorre el flujo de S3 con los tres roles y deja
// datos de demostracion para la prueba manual en el navegador.
//
// Uso (con el backend levantado en :8080 y el ADMIN inicial configurado en .env, decision D5):
//   node scripts/e2e-smoke.mjs
//
// Lee API_URL (por defecto http://localhost:8080) y las credenciales del ADMIN de ADMIN_BOOTSTRAP_EMAIL
// y ADMIN_BOOTSTRAP_PASSWORD (entorno o .env de la raiz). No imprime contraseñas ni tokens.

import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const env = { ...process.env };
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}
const API = (env.API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const ORIGIN = env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
const tag = randomBytes(3).toString('hex');
const PASSWORD = `Demo-${randomBytes(6).toString('base64url')}9`;

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✘ ${name} ${detail}`);
  }
}

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
  return { status: res.status, json, headers: res.headers };
}

async function login(email, password) {
  const r = await call('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${r.json?.detail ?? ''}`);
  return r.json.accessToken;
}

function nextWeekday(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
}

async function main() {
  console.log(`E2E S3 contra ${API} (etiqueta ${tag})\n`);

  console.log('0. Salud y CORS');
  check('actuator/health UP', (await call('GET', '/actuator/health')).json?.status === 'UP');
  const pre = await fetch(API + '/api/catalogs/sites', {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
  });
  check(`preflight CORS desde ${ORIGIN}`, pre.headers.get('access-control-allow-origin') === ORIGIN,
    `(allow-origin=${pre.headers.get('access-control-allow-origin')})`);

  console.log('\n1. ADMIN (primer ADMIN por variables de entorno, D5)');
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) {
    throw new Error('Faltan ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD en .env');
  }
  const admin = await login(env.ADMIN_BOOTSTRAP_EMAIL, env.ADMIN_BOOTSTRAP_PASSWORD);
  check('login ADMIN', Boolean(admin));
  const sites = (await call('GET', '/api/catalogs/sites', { token: admin })).json;
  check('catálogo de sedes: HIC e ICV', sites?.length === 2);
  const hic = sites.find((s) => s.code === 'HIC');
  const specs = (await call('GET', '/api/admin/specialties', { token: admin })).json;
  const general = specs.find((s) => s.code === 'MEDICINA_GENERAL');
  check('Medicina General precargada y protegida (D7)', general?.protected === true);
  const cardio = await call('POST', '/api/admin/specialties', {
    token: admin, body: { code: `CARDIO_${tag}`, name: `Cardiología ${tag}`, appointmentType: 'SPECIALIZED', durationMinutes: 60 },
  });
  check('crear especialidad especializada de 60 min', cardio.status === 201);
  const bad = await call('POST', '/api/admin/specialties', {
    token: admin, body: { code: `X_${tag}`, name: 'X', appointmentType: 'GENERAL', durationMinutes: 45 },
  });
  check('duración 45 → 400', bad.status === 400 && bad.json?.fieldErrors?.durationMinutes);

  const mkPro = (label, specialtyIds, primary) => call('POST', '/api/admin/professionals', {
    token: admin,
    body: {
      firstNames: label, lastNames: `Demo ${tag}`, documentType: 'CC', documentNumber: `E2E${tag}${label.length}`,
      email: `${label.toLowerCase()}.${tag}@citas.test`, phone: '3001234567', password: PASSWORD,
      professionalCode: `P-${label.slice(0, 3).toUpperCase()}-${tag}`, licenseNumber: `LIC-${label.slice(0, 3).toUpperCase()}-${tag}`,
      specialtyIds, primarySpecialtyId: primary, siteIds: [hic.id],
    },
  });
  const gp = await mkPro('Andres', [general.id], general.id);
  const cardiologist = await mkPro('Paula', [cardio.json.id], cardio.json.id);
  check('crear profesional general', gp.status === 201);
  check('crear profesional cardióloga', cardiologist.status === 201);

  console.log('\n2. PROFESSIONAL publica agenda');
  const day = nextWeekday(3);
  const gpToken = await login(`andres.${tag}@citas.test`, PASSWORD);
  const cardToken = await login(`paula.${tag}@citas.test`, PASSWORD);
  const b1 = await call('POST', '/api/professional/blocks', { token: gpToken, body: { siteId: hic.id, date: day, startTime: '08:00', endTime: '12:00' } });
  check('bloque 08:00–12:00 → 8 slots', b1.status === 201 && b1.json.slots.length === 8);
  const overlap = await call('POST', '/api/professional/blocks', { token: gpToken, body: { siteId: hic.id, date: day, startTime: '11:30', endTime: '13:00' } });
  check('bloque solapado → 409 BLOCK_OVERLAP', overlap.status === 409 && overlap.json?.code === 'BLOCK_OVERLAP');
  const b2 = await call('POST', '/api/professional/blocks', { token: cardToken, body: { siteId: hic.id, date: day, startTime: '14:00', endTime: '17:00' } });
  check('bloque de la cardióloga 14:00–17:00', b2.status === 201);

  console.log('\n3. USER se registra y reserva');
  const email = `laura.${tag}@citas.test`;
  const reg = await call('POST', '/api/auth/register', {
    body: { firstNames: 'Laura', lastNames: `Gómez ${tag}`, documentType: 'CC', documentNumber: `U${tag}77`, email, phone: '3109876543', password: PASSWORD },
  });
  check('registro de paciente', reg.status === 201);
  const user = await login(email, PASSWORD);
  const offersGp = (await call('GET', `/api/patient/availability?specialtyId=${general.id}&date=${day}`, { token: user })).json;
  check('disponibilidad Medicina General: 8 franjas de 30 min', offersGp?.length >= 8 && offersGp[0].durationMinutes === 30);
  const g = await call('POST', '/api/patient/appointments/general', {
    token: user, body: { professionalId: gp.json.id, siteId: hic.id, specialtyId: general.id, date: day, startTime: '09:00' },
  });
  check('cita general → 201 APPROVED', g.status === 201 && g.json.status === 'APPROVED');
  const dup = await call('POST', '/api/patient/appointments/general', {
    token: user, body: { professionalId: gp.json.id, siteId: hic.id, specialtyId: general.id, date: day, startTime: '09:00' },
  });
  check('misma franja otra vez → 409 SLOT_TAKEN', dup.status === 409 && dup.json?.code === 'SLOT_TAKEN');
  const offersCardio = (await call('GET', `/api/patient/availability?specialtyId=${cardio.json.id}&date=${day}`, { token: user })).json;
  check('disponibilidad 60 min: 14:00…16:00 (5 franjas, nunca 16:30)',
    offersCardio?.length === 5 && !offersCardio.some((o) => o.startTime === '16:30'));
  const wrong = await call('POST', '/api/patient/appointments/general', {
    token: user, body: { professionalId: cardiologist.json.id, siteId: hic.id, specialtyId: cardio.json.id, date: day, startTime: '14:00' },
  });
  check('especializada por flujo general → 422 WRONG_FLOW', wrong.status === 422 && wrong.json?.code === 'WRONG_FLOW');
  const s1 = await call('POST', '/api/patient/appointments/specialized', {
    token: user, body: { professionalId: cardiologist.json.id, siteId: hic.id, specialtyId: cardio.json.id, date: day, startTime: '14:00' },
  });
  check('solicitud especializada → 201 REQUESTED (GOAL_02)', s1.status === 201 && s1.json.status === 'REQUESTED');
  const s2 = await call('POST', '/api/patient/appointments/specialized', {
    token: user, body: { professionalId: cardiologist.json.id, siteId: hic.id, specialtyId: cardio.json.id, date: day, startTime: '15:00' },
  });
  check('segunda solicitud especializada 15:00', s2.status === 201);
  const forbidden = await call('GET', '/api/admin/inbox', { token: user });
  check('USER en ruta de ADMIN → 403', forbidden.status === 403);

  console.log('\n4. ADMIN decide');
  const inbox = (await call('GET', `/api/admin/inbox?professionalId=${cardiologist.json.id}`, { token: admin })).json;
  check('bandeja con las 2 solicitudes', inbox?.length === 2 && inbox[0].type === 'APPOINTMENT_REQUEST');
  const ok = await call('POST', `/api/admin/appointments/${s1.json.id}/approve`, { token: admin });
  check('aprobar → APPROVED', ok.status === 200 && ok.json.status === 'APPROVED');
  const noReason = await call('POST', `/api/admin/appointments/${s2.json.id}/reject`, { token: admin, body: { reason: '' } });
  check('rechazar sin motivo → 400', noReason.status === 400);
  const rej = await call('POST', `/api/admin/appointments/${s2.json.id}/reject`, { token: admin, body: { reason: 'Agenda del especialista completa esa tarde' } });
  check('rechazar con motivo → REJECTED', rej.status === 200 && rej.json.status === 'REJECTED');
  const again = (await call('GET', `/api/patient/availability?specialtyId=${cardio.json.id}&date=${day}`, { token: user })).json;
  check('la franja rechazada vuelve a ofrecerse (RN-09)', again.some((o) => o.startTime === '15:00'));

  console.log('\n5. USER consulta sus citas');
  const mine = (await call('GET', '/api/patient/appointments', { token: user })).json;
  check('mis citas: 3', mine?.length === 3);
  const detail = (await call('GET', `/api/patient/appointments/${s2.json.id}`, { token: user })).json;
  check('detalle con motivo de rechazo e historial', detail?.rejectionReason?.startsWith('Agenda') && detail.history.length === 2);
  const agenda = (await call('GET', `/api/professional/blocks?from=${day}&to=${day}`, { token: cardToken })).json;
  check('agenda de la cardióloga: 2 slots ocupados (14:00–15:00)', agenda?.[0]?.slots.filter((s) => !s.available).length === 2);

  console.log(`\nResultado: ${passed} OK, ${failures.length} con fallo.`);
  console.log(`Datos de demostración creados con la etiqueta ${tag} (correos *.${tag}@citas.test).`);
  console.log('La contraseña de los usuarios de demostración no se imprime; vuelve a crearlos si la necesitas.');
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
});
