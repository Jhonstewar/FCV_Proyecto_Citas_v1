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
//
// S4 (F9) amplia el recorrido: cancelar, reprogramar (aprobar y rechazar), cierre de atencion,
// CRUD de EPS/planes y recuperacion de contraseña. Pasos condicionados (se OMITEN con aviso, no fallan):
//   - Recuperacion de contraseña: requiere PASSWORD_RESET_EXPOSE_TOKEN=true en la API (devToken).
//   - Cierre real (complete / no-show): una cita solo se cierra desde su hora de inicio; se activa con
//     E2E_WAIT_CLOSE=true, reserva la proxima franja de hoy y espera (hasta ~33 min). Sin ella solo
//     se verifican los rechazos (409 APPOINTMENT_NOT_STARTED, 404 ajeno, 403 de rol).

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

const skipped = [];
function skip(name, reason) {
  skipped.push(`${name}: ${reason}`);
  console.log(`  ⚠ OMITIDO ${name} — ${reason}`);
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

  // Cierre real (opt-in, E2E_WAIT_CLOSE=true): reserva dos citas en la próxima franja de HOY con dos
  // profesionales distintos, espera a que empiece y cierra una como realizada y otra como inasistencia.
  async function closeToday({ admin, user, hic, general }) {
    console.log('\n8b. Cierre real de la atención (espera a que empiece la franja)');
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    let mins = Number(parts.hour) * 60 + Number(parts.minute);
    let start = (Math.floor(mins / 30) + 1) * 30;
    if (start - mins < 2) start += 30; // margen para reservar antes de que empiece
    if (start + 30 > 24 * 60) {
      skip('cierre real (complete / no-show)', 'la próxima franja de hoy cruza la medianoche; vuelve a ejecutar antes de las 23:00 (hora de Bogotá)');
      return;
    }
    const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const pro2 = await mkPro('Bartolome', [general.id], general.id);
    check('crear segundo profesional general', pro2.status === 201);
    const tok2 = await login(`bartolome.${tag}@citas.test`, PASSWORD);
    const tok1 = await login(`andres.${tag}@citas.test`, PASSWORD);
    const blk = { siteId: hic.id, date: today, startTime: hhmm(start), endTime: hhmm(start + 30) };
    check(`bloques de hoy ${blk.startTime}–${blk.endTime}`,
      (await call('POST', '/api/professional/blocks', { token: tok1, body: blk })).status === 201
      && (await call('POST', '/api/professional/blocks', { token: tok2, body: blk })).status === 201);
    const book = (proId) => call('POST', '/api/patient/appointments/general', {
      token: user, body: { professionalId: proId, siteId: hic.id, specialtyId: general.id, date: today, startTime: blk.startTime },
    });
    const a1 = await book(gp.json.id);
    const a2 = await book(pro2.json.id);
    check('dos citas de hoy → 201 APPROVED', a1.status === 201 && a2.status === 201);
    console.log(`  … esperando a que sean las ${blk.startTime} (Bogotá)`);
    let res = null;
    const deadline = Date.now() + 33 * 60000;
    while (Date.now() < deadline) {
      res = await call('POST', `/api/professional/appointments/${a1.json.id}/complete`, { token: tok1 });
      if (res.status !== 409 || res.json?.code !== 'APPOINTMENT_NOT_STARTED') break;
      await new Promise((r) => setTimeout(r, 10000));
    }
    check('complete al empezar → 200 COMPLETED', res?.status === 200 && res.json.status === 'COMPLETED' && res.json.closable === false);
    const nos = await call('POST', `/api/professional/appointments/${a2.json.id}/no-show`, { token: tok2 });
    check('no-show al empezar → 200 NO_SHOW', nos.status === 200 && nos.json.status === 'NO_SHOW');
    const twice = await call('POST', `/api/professional/appointments/${a1.json.id}/no-show`, { token: tok1 });
    check('cerrar una cita ya cerrada → 409 INVALID_TRANSITION', twice.status === 409 && twice.json?.code === 'INVALID_TRANSITION');
    const cancelDone = await call('POST', `/api/patient/appointments/${a1.json.id}/cancel`, { token: user });
    check('cancelar una cita ya atendida → 409 INVALID_TRANSITION', cancelDone.status === 409 && cancelDone.json?.code === 'INVALID_TRANSITION');
    const det = (await call('GET', `/api/patient/appointments/${a2.json.id}`, { token: user })).json;
    check('el paciente ve NO_SHOW en el detalle e historial PROFESSIONAL', det?.status === 'NO_SHOW' && det.history?.length >= 2);
  }

  console.log('\n6. USER cancela una cita (HU-026)');
  const c1 = await call('POST', '/api/patient/appointments/general', {
    token: user, body: { professionalId: gp.json.id, siteId: hic.id, specialtyId: general.id, date: day, startTime: '10:00' },
  });
  check('cita general 10:00 → 201 APPROVED', c1.status === 201 && c1.json.status === 'APPROVED');
  const cancelled = await call('POST', `/api/patient/appointments/${c1.json.id}/cancel`, { token: user, body: { reason: `Cambio de planes ${tag}` } });
  check('cancelar con motivo → 200 CANCELLED', cancelled.status === 200 && cancelled.json.status === 'CANCELLED');
  check('detalle cancelado: no cancelable ni reprogramable', cancelled.json?.cancellable === false && cancelled.json?.reschedulable === false);
  const cancelAgain = await call('POST', `/api/patient/appointments/${c1.json.id}/cancel`, { token: user });
  check('cancelar otra vez → 409 INVALID_TRANSITION', cancelAgain.status === 409 && cancelAgain.json?.code === 'INVALID_TRANSITION');
  const longReason = await call('POST', `/api/patient/appointments/${g.json.id}/cancel`, { token: user, body: { reason: 'x'.repeat(501) } });
  check('motivo de 501 caracteres → 400 fieldErrors.reason', longReason.status === 400 && Boolean(longReason.json?.fieldErrors?.reason));
  const freed = (await call('GET', `/api/patient/availability?specialtyId=${general.id}&date=${day}`, { token: user })).json;
  check('la franja cancelada vuelve a ofrecerse (10:00)', freed?.some((o) => o.startTime === '10:00'));

  console.log('\n7. USER pide reprogramar; ADMIN aprueba y rechaza (HU-027, HU-031)');
  const r1 = await call('POST', `/api/patient/appointments/${g.json.id}/reschedule`, {
    token: user, body: { siteId: hic.id, date: day, startTime: '10:00', reason: `Reunión de trabajo ${tag}` },
  });
  check('pedir mover 09:00 → 10:00 → 201 PENDING', r1.status === 201 && r1.json.status === 'PENDING');
  const r1again = await call('POST', `/api/patient/appointments/${g.json.id}/reschedule`, {
    token: user, body: { siteId: hic.id, date: day, startTime: '11:00' },
  });
  check('segunda solicitud con una pendiente → 409 RESCHEDULE_PENDING', r1again.status === 409 && r1again.json?.code === 'RESCHEDULE_PENDING');
  const inboxR = (await call('GET', `/api/admin/inbox?professionalId=${gp.json.id}&type=RESCHEDULE_REQUEST`, { token: admin })).json;
  check('bandeja: RESCHEDULE_REQUEST con la solicitud pendiente',
    inboxR?.some((i) => i.type === 'RESCHEDULE_REQUEST' && i.reschedule?.id === r1.json?.id));
  const r1ok = await call('POST', `/api/admin/reschedules/${r1.json.id}/approve`, { token: admin });
  check('aprobar reprogramación → cita movida a 10:00 APPROVED',
    r1ok.status === 200 && r1ok.json.status === 'APPROVED' && r1ok.json.startTime === '10:00');
  const moved = (await call('GET', `/api/patient/appointments/${g.json.id}`, { token: user })).json;
  check('detalle: 10:00, misma cita y última solicitud APPROVED',
    moved?.id === g.json.id && moved.startTime === '10:00' && moved.lastReschedule?.status === 'APPROVED');
  const offersAfterMove = (await call('GET', `/api/patient/availability?specialtyId=${general.id}&date=${day}`, { token: user })).json;
  check('la franja antigua (09:00) se libera y la nueva (10:00) queda ocupada',
    offersAfterMove?.some((o) => o.startTime === '09:00') && !offersAfterMove.some((o) => o.startTime === '10:00'));
  const r2 = await call('POST', `/api/patient/appointments/${g.json.id}/reschedule`, {
    token: user, body: { siteId: hic.id, date: day, startTime: '11:00', reason: 'Prefiero más tarde' },
  });
  check('segunda petición 10:00 → 11:00 → 201 PENDING', r2.status === 201 && r2.json.status === 'PENDING');
  const r2NoReason = await call('POST', `/api/admin/reschedules/${r2.json.id}/reject`, { token: admin, body: { reason: '' } });
  check('rechazar reprogramación sin motivo → 400', r2NoReason.status === 400);
  const r2rej = await call('POST', `/api/admin/reschedules/${r2.json.id}/reject`, { token: admin, body: { reason: 'Ese horario ya está comprometido' } });
  check('rechazar con motivo → 200, la cita conserva 10:00', r2rej.status === 200 && r2rej.json.startTime === '10:00' && r2rej.json.status === 'APPROVED');
  const rejDetail = (await call('GET', `/api/patient/appointments/${g.json.id}`, { token: user })).json;
  check('detalle: última solicitud REJECTED con motivo y cita sin pendiente',
    rejDetail?.lastReschedule?.status === 'REJECTED' && rejDetail.lastReschedule.decisionReason?.startsWith('Ese horario')
      && rejDetail.pendingReschedule === false);

  console.log('\n8. PROFESSIONAL cierra la atención (HU-021)');
  const agendaPro = (await call('GET', `/api/professional/appointments?from=${day}&to=${day}`, { token: gpToken })).json;
  const inAgenda = agendaPro?.find((a) => a.id === g.json.id);
  check('agenda del profesional incluye la cita aprobada, aún no cerrable', Boolean(inAgenda) && inAgenda.closable === false);
  const early = await call('POST', `/api/professional/appointments/${g.json.id}/complete`, { token: gpToken });
  check('cerrar una cita futura → 409 APPOINTMENT_NOT_STARTED', early.status === 409 && early.json?.code === 'APPOINTMENT_NOT_STARTED');
  const foreign = await call('POST', `/api/professional/appointments/${g.json.id}/no-show`, { token: cardToken });
  check('cerrar la cita de otro profesional → 404', foreign.status === 404);
  const byPatient = await call('POST', `/api/professional/appointments/${g.json.id}/complete`, { token: user });
  check('USER en ruta de PROFESSIONAL → 403', byPatient.status === 403);

  if (env.E2E_WAIT_CLOSE === 'true') {
    await closeToday({ admin, user, hic, general });
  } else {
    skip('cierre real (complete / no-show)',
      'una cita solo se cierra desde su hora de inicio y la API no admite crear citas en el pasado; '
      + 'ejecuta con E2E_WAIT_CLOSE=true para reservar la próxima franja y esperar (hasta ~32 min)');
  }

  console.log('\n9. ADMIN: CRUD de EPS y planes (HU-011, HU-012)');
  const epsCode = `E2E${tag}`;
  const epsCreate = await call('POST', '/api/admin/eps', { token: admin, body: { code: epsCode, name: `EPS Demo ${tag}` } });
  check('crear EPS → 201 activa', epsCreate.status === 201 && epsCreate.json.active === true && epsCreate.json.planCount === 0);
  const epsDup = await call('POST', '/api/admin/eps', { token: admin, body: { code: epsCode, name: `Otra ${tag}` } });
  check('código de EPS repetido → 409 DUPLICATE', epsDup.status === 409 && epsDup.json?.code === 'DUPLICATE');
  const epsBlank = await call('POST', '/api/admin/eps', { token: admin, body: { code: `B${tag}`, name: '' } });
  check('EPS sin nombre → 400 fieldErrors.name', epsBlank.status === 400 && Boolean(epsBlank.json?.fieldErrors?.name));
  const epsId = epsCreate.json?.id;
  const epsGet = (await call('GET', `/api/admin/eps/${epsId}`, { token: admin })).json;
  check('obtener EPS por id (el código se guarda en mayúsculas)', epsGet?.id === epsId && epsGet.code?.toUpperCase() === epsCode.toUpperCase());
  const epsRename = await call('PUT', `/api/admin/eps/${epsId}`, { token: admin, body: { name: `EPS Demo ${tag} renombrada` } });
  check('renombrar EPS', epsRename.status === 200 && epsRename.json.name.endsWith('renombrada'));
  check('la EPS aparece en el listado', (await call('GET', '/api/admin/eps', { token: admin })).json?.some((e) => e.id === epsId));
  const epsOff = await call('PATCH', `/api/admin/eps/${epsId}/status`, { token: admin, body: { active: false } });
  check('desactivar EPS', epsOff.status === 200 && epsOff.json.active === false);
  const epsOn = await call('PATCH', `/api/admin/eps/${epsId}/status`, { token: admin, body: { active: true } });
  check('reactivar EPS', epsOn.status === 200 && epsOn.json.active === true);
  const planCreate = await call('POST', `/api/admin/eps/${epsId}/plans`, {
    token: admin, body: { code: `PL${tag}`, name: `Plan Demo ${tag}`, regimeCode: 'CONTRIBUTIVO' },
  });
  check('crear plan contributivo → 201', planCreate.status === 201 && planCreate.json.regime?.code === 'CONTRIBUTIVO' && planCreate.json.epsId === epsId);
  const planNoRegime = await call('POST', `/api/admin/eps/${epsId}/plans`, { token: admin, body: { code: `PX${tag}`, name: 'Sin régimen', regimeCode: '' } });
  check('plan sin régimen → 400', planNoRegime.status === 400);
  const planId = planCreate.json?.id;
  const planUpd = await call('PUT', `/api/admin/eps-plans/${planId}`, { token: admin, body: { name: `Plan Demo ${tag} B`, regimeCode: 'SUBSIDIADO' } });
  check('editar plan: nombre y régimen subsidiado', planUpd.status === 200 && planUpd.json.regime?.code === 'SUBSIDIADO' && planUpd.json.name.endsWith(' B'));
  const planOff = await call('PATCH', `/api/admin/eps-plans/${planId}/status`, { token: admin, body: { active: false } });
  check('desactivar plan', planOff.status === 200 && planOff.json.active === false);
  check('planes de la EPS: 1', (await call('GET', `/api/admin/eps/${epsId}/plans`, { token: admin })).json?.length === 1);
  const epsDelBlocked = await call('DELETE', `/api/admin/eps/${epsId}`, { token: admin });
  check('borrar EPS con planes → 409 EPS_REFERENCED', epsDelBlocked.status === 409 && epsDelBlocked.json?.code === 'EPS_REFERENCED');
  check('borrar plan sin afiliaciones → 204', (await call('DELETE', `/api/admin/eps-plans/${planId}`, { token: admin })).status === 204);
  check('borrar EPS sin planes → 204', (await call('DELETE', `/api/admin/eps/${epsId}`, { token: admin })).status === 204);
  check('EPS borrada → 404', (await call('GET', `/api/admin/eps/${epsId}`, { token: admin })).status === 404);
  check('USER en /api/admin/eps → 403', (await call('GET', '/api/admin/eps', { token: user })).status === 403);
  skip('PLAN_REFERENCED (borrar plan con afiliaciones)', 'requiere afiliar a un paciente a un plan; fuera del alcance de este recorrido');

  console.log('\n10. Recuperación de contraseña (HU-006, HU-007)');
  const rec = await call('POST', '/api/auth/password-recovery', { body: { email } });
  check('solicitar recuperación → 202 con mensaje genérico', rec.status === 202 && typeof rec.json?.message === 'string');
  const recUnknown = await call('POST', '/api/auth/password-recovery', { body: { email: `nadie.${tag}@citas.test` } });
  check('correo inexistente → mismo 202 y mismo mensaje (sin enumeración)',
    recUnknown.status === 202 && recUnknown.json?.message === rec.json?.message && !recUnknown.json?.devToken);
  if (!rec.json?.devToken) {
    skip('restablecer contraseña con el token',
      'la API no expuso devToken: levanta citas-api con PASSWORD_RESET_EXPOSE_TOKEN=true (solo desarrollo)');
  } else {
    const newPassword = `Nueva-${randomBytes(6).toString('base64url')}7`;
    const weak = await call('POST', '/api/auth/password-reset', { body: { token: rec.json.devToken, newPassword: 'abc' } });
    check('contraseña débil → 400 y el token sigue vivo', weak.status === 400);
    const reset = await call('POST', '/api/auth/password-reset', { body: { token: rec.json.devToken, newPassword } });
    check('restablecer con el token → 204', reset.status === 204);
    const reuse = await call('POST', '/api/auth/password-reset', { body: { token: rec.json.devToken, newPassword } });
    check('reusar el token → 400 RESET_TOKEN_INVALID', reuse.status === 400 && reuse.json?.code === 'RESET_TOKEN_INVALID');
    const oldLogin = await call('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
    check('la contraseña anterior ya no entra → 401', oldLogin.status === 401);
    const newLogin = await call('POST', '/api/auth/login', { body: { email, password: newPassword } });
    check('la contraseña nueva entra → 200', newLogin.status === 200 && Boolean(newLogin.json?.accessToken));
  }

  console.log(`\nResultado: ${passed} OK, ${failures.length} con fallo, ${skipped.length} omitidos.`);
  for (const s of skipped) console.log(`  ⚠ OMITIDO ${s}`);
  console.log(`Datos de demostración creados con la etiqueta ${tag} (correos *.${tag}@citas.test).`);
  console.log('La contraseña de los usuarios de demostración no se imprime; vuelve a crearlos si la necesitas.');
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
});
