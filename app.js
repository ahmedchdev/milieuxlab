/* ============================================================
   MilieuXlab — app.js
   State · Calculations · Rendering · localStorage
   ============================================================ */

const STORAGE = {
  BATCHES: 'milieuxlab.batches.v1',
  MEDIA:   'milieuxlab.media.v1',
  SETTINGS:'milieuxlab.settings.v1',
  ALERTS_HIDDEN: 'milieuxlab.alertsHidden.v1',
  DELETED_DEFAULTS: 'milieuxlab.deletedDefaults.v1',
};

const BUFFER_DAYS = 2;
const SHELF_LIFE = { solid: 30, broth: 15 };
const THEME_KEY = 'milieuxlab.theme.v1';
const NOTIF_POLL_MS = 5 * 60 * 1000;  // re-check every 5 minutes

const DEFAULT_MEDIA = [
  { id: 'm_tsa',       name: 'TSA',                          type: 'solid', strains: ['S. aureus ATCC 6538'],    shelfLifeDays: 30, fertilityDelayDays: 5, sterilityFormat: 'days',  sterilityValue: 5, codeInterneRef: 'TSA', isDefault: true },
  { id: 'm_macconkey', name: 'MacConkey Agar',               type: 'solid', strains: ['E. coli ATCC 8739'],      shelfLifeDays: 30, fertilityDelayDays: 2, sterilityFormat: 'range', sterilityMinHours: 18, sterilityMaxHours: 72, codeInterneRef: 'MAC', isDefault: true },
  { id: 'm_sabouraud', name: 'Sabouraud',                    type: 'solid', strains: ['C. albicans ATCC 10231'], shelfLifeDays: 30, fertilityDelayDays: 5, sterilityFormat: 'days',  sterilityValue: 5, codeInterneRef: 'SAB', isDefault: true },
  { id: 'm_mh',        name: 'Mueller-Hinton',               type: 'solid', strains: ['S. aureus ATCC 25923'],   shelfLifeDays: 30, fertilityDelayDays: 3, sterilityFormat: 'days',  sterilityValue: 5, codeInterneRef: 'MH', isDefault: true },
  { id: 'm_tsb',       name: 'TSB (Tryptic Soy Broth)',      type: 'broth', strains: ['S. aureus ATCC 6538'],    shelfLifeDays: 15, fertilityDelayDays: 5, sterilityFormat: 'days',  sterilityValue: 14, codeInterneRef: 'TSB', isDefault: true },
  { id: 'm_bhi',       name: 'BHI (Brain Heart Infusion)',   type: 'broth', strains: ['S. aureus ATCC 6538'],    shelfLifeDays: 15, fertilityDelayDays: 5, sterilityFormat: 'days',  sterilityValue: 14, codeInterneRef: 'BHI', isDefault: true },
  { id: 'm_xld',       name: 'XLD Agar',                     type: 'solid', strains: ['Salmonella typhimurium'], shelfLifeDays: 30, fertilityDelayDays: 2, sterilityFormat: 'range', sterilityMinHours: 18, sterilityMaxHours: 24, codeInterneRef: 'XLD', isDefault: true },
  { id: 'm_pbs',       name: 'Phosphate Buffer Solution',   type: 'broth', strains: ['E. coli ATCC 8739'],      shelfLifeDays: 15, fertilityDelayDays: 2, sterilityFormat: 'range', sterilityMinHours: 18, sterilityMaxHours: 24, codeInterneRef: 'PBS', isDefault: true },
];

const DEFAULT_SETTINGS = { browserNotifications: false, showExpired: false, labName: '' };

/* ============================================================
   STATE
   ============================================================ */

const state = {
  batches: [],
  media: [],
  settings: { ...DEFAULT_SETTINGS },
  deletedDefaults: [],   // ids of default media the user deleted (not re-added on load)
  currentView: 'dashboard',
};

function loadState() {
  try {
    const del = localStorage.getItem(STORAGE.DELETED_DEFAULTS);
    state.deletedDefaults = del ? JSON.parse(del) : [];

    const m = localStorage.getItem(STORAGE.MEDIA);
    state.media = m ? JSON.parse(m) : [...DEFAULT_MEDIA];
    // Ensure defaults are present (for older storage), EXCEPT ones the user deleted
    DEFAULT_MEDIA.forEach(dm => {
      if (state.deletedDefaults.includes(dm.id)) return;
      if (!state.media.find(x => x.id === dm.id)) state.media.unshift(dm);
    });
    // Backfill fields added after first release, on default media saved before they existed
    DEFAULT_MEDIA.forEach(dm => {
      const existing = state.media.find(x => x.id === dm.id);
      if (!existing) return;
      if (existing.codeInterneRef == null && dm.codeInterneRef) existing.codeInterneRef = dm.codeInterneRef;
      if (existing.shelfLifeDays == null && dm.shelfLifeDays) existing.shelfLifeDays = dm.shelfLifeDays;
      if (!Array.isArray(existing.strains)) existing.strains = existing.strain ? [existing.strain] : (dm.strains ? dm.strains.slice() : []);
    });

    const b = localStorage.getItem(STORAGE.BATCHES);
    state.batches = b ? JSON.parse(b) : [];

    const s = localStorage.getItem(STORAGE.SETTINGS);
    state.settings = s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : { ...DEFAULT_SETTINGS };
  } catch (e) {
    console.error('Failed to load state', e);
    state.media = [...DEFAULT_MEDIA];
    state.batches = [];
    state.settings = { ...DEFAULT_SETTINGS };
    state.deletedDefaults = [];
  }
}

function persist() {
  localStorage.setItem(STORAGE.MEDIA, JSON.stringify(state.media));
  localStorage.setItem(STORAGE.DELETED_DEFAULTS, JSON.stringify(state.deletedDefaults || []));
  localStorage.setItem(STORAGE.BATCHES, JSON.stringify(state.batches));
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(state.settings));
}

/* ============================================================
   CALCULATIONS
   ============================================================ */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function addHours(d, hours) {
  const x = new Date(d);
  x.setHours(x.getHours() + hours);
  return x;
}

function getSterilityDurationMs(medium) {
  if (medium.sterilityFormat === 'days')  return medium.sterilityValue * 24 * 60 * 60 * 1000;
  if (medium.sterilityFormat === 'hours') return medium.sterilityValue * 60 * 60 * 1000;
  if (medium.sterilityFormat === 'range') return medium.sterilityMaxHours * 60 * 60 * 1000;
  return 0;
}

function computeBatchDates(medium, prepDateTime) {
  const prep = new Date(prepDateTime);
  const fertilityResult = addDays(prep, medium.fertilityDelayDays);
  const sterilityResult = addHours(prep, getSterilityDurationHours(medium));
  const expiry = addDays(startOfDay(prep), mediumShelfDays(medium));
  const renewalAlert = addDays(startOfDay(expiry), -(medium.fertilityDelayDays + BUFFER_DAYS));
  return { fertilityResult, sterilityResult, expiry, renewalAlert };
}

// Shelf life in days. Uses the per-medium "Délai de conservation" when set,
// else falls back to the legacy Type-based value (solid 30 / broth 15).
function mediumShelfDays(medium) {
  return (typeof medium.shelfLifeDays === 'number' && medium.shelfLifeDays > 0)
    ? medium.shelfLifeDays
    : SHELF_LIFE[medium.type];
}

// Strains: stored as an array (medium.strains); legacy media used medium.strain (string).
function mediumStrains(medium) {
  if (Array.isArray(medium.strains) && medium.strains.length) return medium.strains.filter(Boolean);
  if (medium.strain) return [medium.strain];
  return [];
}
function mediumStrainText(medium) {
  const s = mediumStrains(medium);
  return s.length ? s.join(' / ') : '—';
}

function getSterilityDurationHours(medium) {
  if (medium.sterilityFormat === 'days')  return medium.sterilityValue * 24;
  if (medium.sterilityFormat === 'hours') return medium.sterilityValue;
  if (medium.sterilityFormat === 'range') return medium.sterilityMaxHours;
  return 0;
}

function getSterilityDisplay(medium) {
  if (medium.sterilityFormat === 'days')  return `${medium.sterilityValue} j`;
  if (medium.sterilityFormat === 'hours') return `${medium.sterilityValue} h`;
  if (medium.sterilityFormat === 'range') return `${medium.sterilityMinHours}h – ${medium.sterilityMaxHours}h`;
  return '—';
}

/* ============================================================
   FORMATTERS
   ============================================================ */

const fmtDate = d => {
  const x = new Date(d);
  const dd = String(x.getDate()).padStart(2, '0');
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const yy = x.getFullYear();
  return `${dd}/${mm}/${yy}`;
};
const fmtDateTime = d => {
  const x = new Date(d);
  const hh = String(x.getHours()).padStart(2, '0');
  const mn = String(x.getMinutes()).padStart(2, '0');
  return `${fmtDate(x)} ${hh}:${mn}`;
};
const fmtTime = d => {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`;
};
const fmtRelativeDays = days => {
  if (days === 0) return "aujourd'hui";
  if (days > 0)   return `dans ${days} jour${days > 1 ? 's' : ''}`;
  return `il y a ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`;
};

const isSameDay = (a, b) => {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

const daysBetween = (a, b) => {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.round(ms / 86400000);
};

/* ============================================================
   BATCH STATUS LOGIC
   ============================================================ */

function batchStatus(batch) {
  const now = new Date();
  const expiry = new Date(batch.expiryDate);
  const renewal = new Date(batch.renewalAlertDate);
  const fert = new Date(batch.fertilityResultDate);
  const ster = new Date(batch.sterilityResultDate);

  if (now > expiry) return { code: 'expired', label: 'Expiré', cls: 's-grey' };
  if (now >= renewal) return { code: 'urgent', label: 'Renouvellement requis', cls: 's-red' };
  if (daysBetween(now, expiry) <= 7) return { code: 'soon', label: 'Expiration proche', cls: 's-orange' };
  if (isSameDay(now, fert)) return { code: 'fert-today', label: 'Résultat fertilité aujourd\'hui', cls: 's-orange' };
  if (isSameDay(now, ster)) return { code: 'ster-today', label: 'Résultat stérilité aujourd\'hui', cls: 's-orange' };
  return { code: 'ok', label: 'En cours', cls: 's-green' };
}

function getBatchMedium(batch) {
  return state.media.find(m => m.id === batch.mediumId);
}

function batchProgress(batch) {
  const prep = startOfDay(new Date(batch.prepDateTime)).getTime();
  const exp  = startOfDay(new Date(batch.expiryDate)).getTime();
  const now  = Date.now();
  if (exp <= prep) return 0;
  const pct = ((now - prep) / (exp - prep)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/* ============================================================
   RENDERING — DASHBOARD
   ============================================================ */

// "Alertes du jour" dismissal — hidden for the rest of the day once the user
// taps ×. Reappears automatically the next day, or immediately if the alert
// set changes (a NEW alert must never stay hidden — safety first).
function localDateKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function isAlertsBannerDismissed(sig) {
  try {
    const raw = localStorage.getItem(STORAGE.ALERTS_HIDDEN);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return !!saved && saved.date === localDateKey(new Date()) && saved.sig === sig;
  } catch (e) { return false; }
}

function dismissAlertsBanner(sig) {
  try {
    localStorage.setItem(STORAGE.ALERTS_HIDDEN, JSON.stringify({ date: localDateKey(new Date()), sig }));
  } catch (e) {}
  const banner = document.getElementById('alerts-banner');
  if (banner) { banner.innerHTML = ''; banner.className = ''; }
}

function renderDashboard() {
  const now = new Date();
  const visible = state.batches.filter(b => state.settings.showExpired || batchStatus(b).code !== 'expired');

  // Stats
  const active  = state.batches.filter(b => batchStatus(b).code === 'ok' || batchStatus(b).code === 'fert-today' || batchStatus(b).code === 'ster-today').length;
  const watch   = state.batches.filter(b => batchStatus(b).code === 'soon').length;
  const urgent  = state.batches.filter(b => batchStatus(b).code === 'urgent').length;
  const expired = state.batches.filter(b => batchStatus(b).code === 'expired').length;
  document.getElementById('stat-active').textContent  = active;
  document.getElementById('stat-watch').textContent   = watch;
  document.getElementById('stat-urgent').textContent  = urgent;
  document.getElementById('stat-expired').textContent = expired;
  // Total batch count is no longer shown in the header (replaced by the
  // calendar button), but we still keep state.batches.length available
  // via the dashboard subtitle.

  document.getElementById('today-label').textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('batches-count').textContent = state.batches.length + ' au total';

  // Alerts
  const alerts = [];
  state.batches.forEach(b => {
    const s = batchStatus(b);
    const medium = getBatchMedium(b);
    if (!medium) return;
    // "EXPIRE AUJOURD'HUI" only on the actual expiry day — it disappears
    // automatically the next day (old expired lots no longer flood the banner)
    if (s.code === 'expired') {
      if (isSameDay(now, b.expiryDate)) alerts.push({ cls: 'd-red', msg: 'EXPIRE AUJOURD\'HUI', medium: medium.name, batch: b });
    }
    else if (s.code === 'urgent')  alerts.push({ cls: 'd-red',    msg: 'Renouvellement requis', medium: medium.name, batch: b });
    else if (s.code === 'soon')    alerts.push({ cls: 'd-orange', msg: `Expire ${fmtRelativeDays(daysBetween(now, b.expiryDate))}`, medium: medium.name, batch: b });
    else if (s.code === 'fert-today') alerts.push({ cls: 'd-yellow', msg: 'Résultat fertilité attendu', medium: medium.name, batch: b });
    else if (s.code === 'ster-today') alerts.push({ cls: 'd-yellow', msg: 'Résultat stérilité attendu', medium: medium.name, batch: b });
  });

  const banner = document.getElementById('alerts-banner');
  const alertsSig = alerts.map(a => `${a.batch.id}:${a.msg}`).sort().join('|');
  if (alerts.length === 0 || isAlertsBannerDismissed(alertsSig)) {
    banner.innerHTML = '';
    banner.className = '';
  } else {
    banner.className = 'alerts-banner';
    banner.innerHTML = `
      <div class="alerts-banner-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        Alertes du jour (${alerts.length})
        <button type="button" class="alerts-banner-close" aria-label="Masquer les alertes du jour">×</button>
      </div>
      ${alerts.map(a => `
        <div class="alert-item ${a.cls}">
          <span class="alert-dot"></span>
          <span class="alert-medium"><b>${escapeHtml(a.medium)}</b>${a.batch.codeInterne ? ' · ' + escapeHtml(a.batch.codeInterne) : ''}${a.batch.lotNumber ? ' · ' + escapeHtml(a.batch.lotNumber) : ''}</span>
          <span class="alert-msg">${a.msg}</span>
        </div>
      `).join('')}
    `;
    const closeBtn = banner.querySelector('.alerts-banner-close');
    if (closeBtn) closeBtn.addEventListener('click', () => dismissAlertsBanner(alertsSig));
  }

  // Batches list
  const list = document.getElementById('batches-list');
  const empty = document.getElementById('empty-state');
  if (visible.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    // Sort: urgent first, then soon, then by expiry
    const order = { urgent: 0, soon: 1, 'fert-today': 2, 'ster-today': 3, ok: 4, expired: 5 };
    const sorted = [...visible].sort((a, b) => {
      const sa = order[batchStatus(a).code], sb = order[batchStatus(b).code];
      if (sa !== sb) return sa - sb;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });
    list.innerHTML = sorted.map(renderBatchCard).join('');
  }

  // Calendar badge: count of urgent batches
  const badge = document.getElementById('calendar-badge');
  if (badge) {
    if (urgent > 0) {
      badge.hidden = false;
      badge.textContent = String(urgent);
    } else {
      badge.hidden = true;
    }
  }

  // Refresh the calendar view if it's open, so the dots/coloring stay current
  const calModal = document.getElementById('calendar-modal');
  if (calModal && !calModal.classList.contains('hidden')) {
    renderCalendar();
  }
}

/* ============================================================
   STAT TILE DETAILS — popup listing all lots of a category
   ============================================================ */

const STAT_CATEGORIES = {
  active:  { title: 'Lots actifs',   codes: ['ok', 'fert-today', 'ster-today'] },
  watch:   { title: 'À surveiller',  codes: ['soon'] },
  urgent:  { title: 'Urgents',       codes: ['urgent'] },
  expired: { title: 'Lots expirés',  codes: ['expired'] },
};

function openStatDetails(category) {
  const cfg = STAT_CATEGORIES[category];
  if (!cfg) return;
  const modal   = document.getElementById('stat-details-modal');
  const titleEl = document.getElementById('stat-details-title');
  const subEl   = document.getElementById('stat-details-sub');
  const list    = document.getElementById('stat-details-list');
  if (!modal || !list) return;

  const rows = state.batches
    .map(b => ({ batch: b, medium: getBatchMedium(b), status: batchStatus(b) }))
    .filter(({ medium, status }) => medium && cfg.codes.includes(status.code))
    .sort((a, b) => new Date(a.batch.expiryDate) - new Date(b.batch.expiryDate));

  titleEl.textContent = cfg.title;
  subEl.textContent = rows.length === 0 ? 'Aucun lot' : `${rows.length} lot${rows.length > 1 ? 's' : ''}`;

  if (rows.length === 0) {
    list.innerHTML = `<div class="day-detail-empty">Aucun lot dans cette catégorie.</div>`;
  } else {
    list.innerHTML = rows.map(({ batch, medium, status }) => {
      const isBroth = medium.type === 'broth';
      const daysLeft = daysBetween(new Date(), batch.expiryDate);
      return `
      <div class="day-detail-item ${status.cls}">
        <div class="day-detail-head">
          <div>
            <div class="day-detail-name">${escapeHtml(medium.name)}</div>
            <div class="day-detail-meta">${escapeHtml(mediumStrainText(medium))}${batch.codeInterne ? ' · ' + escapeHtml(batch.codeInterne) : ''}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
          </div>
          <span class="day-detail-tag ${isBroth ? 'broth' : ''}">${isBroth ? 'BOUILLON' : 'SOLIDE'}</span>
        </div>
        <div class="day-detail-grid">
          <div>
            <span class="lbl">Préparation</span>
            <span class="val">${fmtDateTime(batch.prepDateTime)}</span>
          </div>
          <div>
            <span class="lbl">Expiration</span>
            <span class="val ${status.code === 'expired' ? 'alert-red' : daysLeft <= 7 ? 'alert' : ''}">${fmtDate(batch.expiryDate)}</span>
          </div>
          <div>
            <span class="lbl">Renouvellement</span>
            <span class="val">${fmtDate(batch.renewalAlertDate)}</span>
          </div>
          <div>
            <span class="lbl">Jours restants</span>
            <span class="val">${daysLeft < 0 ? 'Expiré' : daysLeft + ' j'}</span>
          </div>
        </div>
        <div class="day-detail-status">
          <span class="status-dot ${status.code === 'urgent' ? 'danger' : status.code === 'soon' ? 'warn' : status.code === 'expired' ? 'grey' : ''}"></span>
          <span>${escapeHtml(status.label)}</span>
        </div>
      </div>`;
    }).join('');
  }
  modal.classList.remove('hidden');
}

function closeStatDetails() {
  const modal = document.getElementById('stat-details-modal');
  if (modal) modal.classList.add('hidden');
}

function renderBatchCard(batch) {
  const medium = getBatchMedium(batch);
  if (!medium) return '';
  const s = batchStatus(batch);
  const pct = batchProgress(batch);
  const now = new Date();
  const daysLeft = daysBetween(now, batch.expiryDate);
  const progressCls = s.code === 'urgent' ? 'danger' : (s.code === 'soon' || daysLeft <= 7) ? 'warn' : '';
  const expiryCls = s.code === 'urgent' ? 'alert-red' : daysLeft <= 7 ? 'alert' : '';
  const remaining = s.code === 'expired' ? 'Expiré' : `${daysLeft} jour${Math.abs(daysLeft) > 1 ? 's' : ''} restant${Math.abs(daysLeft) > 1 ? 's' : ''}`;
  const dotCls = s.code === 'urgent' ? 'danger' : s.code === 'soon' ? 'warn' : s.code === 'expired' ? 'grey' : '';
  const isBroth = medium.type === 'broth';
  const tag = `<span class="tag ${isBroth ? 'broth' : ''}">${isBroth ? 'BOUILLON' : 'SOLIDE'}</span>`;

  return `
    <div class="batch-card ${s.cls}">
      <div class="batch-head">
        <div>
          <div class="batch-name">${escapeHtml(medium.name)}</div>
          <div class="batch-meta">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3"></circle></svg>
            <span>${escapeHtml(mediumStrainText(medium))}</span>${batch.codeInterne ? '<span style="opacity:0.5">·</span><span>' + escapeHtml(batch.codeInterne) + '</span>' : ''}${batch.lotNumber ? '<span style="opacity:0.5">·</span><span>' + escapeHtml(batch.lotNumber) + '</span>' : ''}
          </div>
        </div>
        ${tag}
      </div>

      <div class="batch-dates">
        <div>
          <span class="lbl">Préparation</span>
          <span class="val">${fmtDateTime(batch.prepDateTime)}</span>
        </div>
        <div>
          <span class="lbl">Expiration</span>
          <span class="val ${expiryCls}">${fmtDate(batch.expiryDate)}</span>
        </div>
        <div>
          <span class="lbl">Fertilité</span>
          <span class="val">${fmtDate(batch.fertilityResultDate)}</span>
        </div>
        <div>
          <span class="lbl">Stérilité</span>
          <span class="val">${fmtDateTime(batch.sterilityResultDate)}</span>
        </div>
      </div>

      <div class="renewal-row">
        <span class="lbl">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Renouvellement
        </span>
        <span class="val">${fmtDate(batch.renewalAlertDate)}</span>
      </div>

      <div class="progress ${progressCls}"><span style="width:${pct.toFixed(1)}%"></span></div>

      <div class="batch-foot">
        <span><span class="status-dot ${dotCls}"></span>${s.label} — ${remaining}</span>
        <div class="card-actions">
          <button class="icon-btn" data-edit="${batch.id}">Modifier</button>
          <button class="icon-btn danger" data-del="${batch.id}">Suppr.</button>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   RENDERING — REGISTER
   ============================================================ */

function renderRegister() {
  const sel = document.getElementById('f-medium');
  sel.innerHTML = state.media.map(m =>
    `<option value="${m.id}">${escapeHtml(m.name)} (${m.type === 'solid' ? 'Solide' : 'Bouillon'})</option>`
  ).join('');

  // Default to today
  const date = document.getElementById('f-date');
  const time = document.getElementById('f-time');
  if (!date.value) date.value = new Date().toISOString().slice(0, 10);
  if (!time.value) time.value = new Date().toTimeString().slice(0, 5);

  autofillCodeInterne();
  updatePreview();
}

// Prefill the "Code interne" field with the selected medium's reference.
// The user can then complete it (e.g. append numbers).
function autofillCodeInterne() {
  const codeField = document.getElementById('f-code');
  if (!codeField) return;
  const mId = document.getElementById('f-medium').value;
  const medium = state.media.find(m => m.id === mId);
  codeField.value = (medium && medium.codeInterneRef) ? medium.codeInterneRef : '';
}

function updatePreview() {
  const mId = document.getElementById('f-medium').value;
  const date = document.getElementById('f-date').value;
  const time = document.getElementById('f-time').value;
  const medium = state.media.find(m => m.id === mId);
  const preview = document.getElementById('preview');
  const sub = document.getElementById('preview-medium');

  if (!medium || !date || !time) {
    document.getElementById('p-fert').textContent  = '—';
    document.getElementById('p-ster').textContent  = '—';
    document.getElementById('p-exp').textContent   = '—';
    document.getElementById('p-renew').textContent = '—';
    sub.textContent = '—';
    return;
  }
  const prep = new Date(`${date}T${time}`);
  const { fertilityResult, sterilityResult, expiry, renewalAlert } = computeBatchDates(medium, prep);
  document.getElementById('p-fert').textContent  = fmtDate(fertilityResult);
  document.getElementById('p-ster').textContent  = fmtDateTime(sterilityResult);
  document.getElementById('p-exp').textContent   = fmtDate(expiry);
  document.getElementById('p-renew').textContent = fmtDate(renewalAlert);
  sub.textContent = `${escapeHtml(medium.name)} · ${mediumShelfDays(medium)} jours`;
  preview.dataset.ready = '1';
}

/* ============================================================
   RENDERING — MEDIA
   ============================================================ */

function renderMedia() {
  const list = document.getElementById('media-list');
  document.getElementById('media-count').textContent = `${state.media.length} milieux`;
  list.innerHTML = state.media.map(m => {
    const isBroth = m.type === 'broth';
    const shelf = mediumShelfDays(m);
    const strainsTxt = mediumStrainText(m);
    const strainCount = mediumStrains(m).length;
    const inhib = mediumInhibStrains(m);
    // Optional extra fields, only rendered when filled
    const extras = [
      ['pH', m.ph], ['Couleur', m.couleur], ['Additif', m.additif],
      ['Aspect', m.aspect], ['Fournisseur', m.fournisseur],
    ].filter(([, v]) => v && String(v).trim());
    return `
      <div class="media-card ${isBroth ? 'broth' : ''}">
        <div class="media-head">
          <div class="media-name">${escapeHtml(m.name)}</div>
        </div>
        <div class="media-grid">
          <div>
            <span class="lbl">Type</span>
            <span class="val">${m.type === 'solid' ? 'Solide' : 'Bouillon'}</span>
          </div>
          <div>
            <span class="lbl">Conservation</span>
            <span class="val">${shelf} jour${shelf > 1 ? 's' : ''}</span>
          </div>
          <div>
            <span class="lbl">Fertilité après</span>
            <span class="val">${m.fertilityDelayDays} jour${m.fertilityDelayDays > 1 ? 's' : ''}</span>
          </div>
          <div>
            <span class="lbl">Stérilité</span>
            <span class="val">${getSterilityDisplay(m)}</span>
          </div>
          <div style="grid-column: 1/-1">
            <span class="lbl">Souche${strainCount > 1 ? 's' : ''} fertilité</span>
            <span class="val">${escapeHtml(strainsTxt)}</span>
          </div>
          ${inhib.length ? `
          <div style="grid-column: 1/-1">
            <span class="lbl">Souche${inhib.length > 1 ? 's' : ''} inhibition</span>
            <span class="val">${escapeHtml(inhib.join(' / '))}</span>
          </div>` : ''}
          ${extras.map(([lbl, v]) => `
          <div style="grid-column: 1/-1">
            <span class="lbl">${lbl}</span>
            <span class="val">${escapeHtml(String(v))}</span>
          </div>`).join('')}
          ${m.coa ? `
          <div style="grid-column: 1/-1">
            <span class="lbl">Certificat d'analyse</span>
            <span class="val"><button class="coa-link" data-mcoa="${m.id}">📄 ${escapeHtml(m.coa.name || 'Voir le CoA')}</button></span>
          </div>` : ''}
        </div>
        <div class="media-foot">
          <button class="icon-btn" data-medit="${m.id}">Modifier</button>
          <button class="icon-btn danger" data-mdel="${m.id}">Supprimer</button>
        </div>
      </div>
    `;
  }).join('');
}

function showMediaForm(medium) {
  const wrap = document.getElementById('media-form-wrap');
  const form = document.getElementById('media-form');
  const title = document.getElementById('media-form-title');
  wrap.classList.remove('hidden');
  if (medium) {
    title.textContent = 'Modifier le milieu';
    document.getElementById('m-id').value = medium.id;
    document.getElementById('m-name').value = medium.name;
    document.getElementById('m-code-ref').value = medium.codeInterneRef || '';
    document.getElementById('m-type').value = medium.type;
    document.getElementById('m-shelf').value = String(mediumShelfDays(medium));
    renderStrainRows('m-strains-list', mediumStrains(medium));
    renderStrainRows('m-inhib-list', medium.inhibitionStrains || []);
    document.getElementById('m-fert').value = medium.fertilityDelayDays;
    const fmt = medium.sterilityFormat;
    document.querySelector(`input[name="m-fmt"][value="${fmt}"]`).checked = true;
    if (fmt === 'range') {
      document.getElementById('m-min').value = medium.sterilityMinHours || '';
      document.getElementById('m-max').value = medium.sterilityMaxHours || '';
    } else {
      document.getElementById('m-single').value = medium.sterilityValue || '';
    }
    document.getElementById('m-ph').value = medium.ph || '';
    document.getElementById('m-couleur').value = medium.couleur || '';
    document.getElementById('m-additif').value = medium.additif || '';
    document.getElementById('m-aspect').value = medium.aspect || '';
    document.getElementById('m-fournisseur').value = medium.fournisseur || '';
    coaFormReset(medium.coa || null);
    updateMediaFormFields();
  } else {
    title.textContent = 'Nouveau milieu';
    form.reset();
    document.getElementById('m-id').value = '';
    document.getElementById('m-shelf').value = '30';
    renderStrainRows('m-strains-list', []);
    renderStrainRows('m-inhib-list', []);
    document.querySelector('input[name="m-fmt"][value="days"]').checked = true;
    coaFormReset(null);
    updateMediaFormFields();
  }
  wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateMediaFormFields() {
  const fmt = document.querySelector('input[name="m-fmt"]:checked').value;
  const singleWrap = document.getElementById('m-single-wrap');
  const rangeWrap  = document.getElementById('m-range-wrap');
  const singleLbl  = document.getElementById('m-single-lbl');
  if (fmt === 'range') {
    singleWrap.classList.add('hidden');
    rangeWrap.classList.remove('hidden');
  } else {
    rangeWrap.classList.add('hidden');
    singleWrap.classList.remove('hidden');
    singleLbl.textContent = fmt === 'days' ? 'Durée (jours)' : 'Durée (heures)';
  }
}

/* ============================================================
   RENDERING — SETTINGS
   ============================================================ */

function renderSettings() {
  document.getElementById('s-notif').checked   = state.settings.browserNotifications;
  document.getElementById('s-expired').checked = state.settings.showExpired;
  const labInput = document.getElementById('s-labname');
  if (labInput) labInput.value = state.settings.labName || '';
  requestAppVersion();
}

/* ============================================================
   VIEW ROUTING
   ============================================================ */

function go(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.go === view));
  if (view === 'dashboard') renderDashboard();
  if (view === 'register')  renderRegister();
  if (view === 'media')     renderMedia();
  if (view === 'settings')  renderSettings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   ACTIONS
   ============================================================ */

function saveBatch(e) {
  e.preventDefault();
  const mId = document.getElementById('f-medium').value;
  const lot = document.getElementById('f-lot').value.trim();
  const code = document.getElementById('f-code').value.trim();
  const supplierExp = document.getElementById('f-supplier-exp').value;
  const actPhmetre = document.getElementById('f-act-phmetre').value.trim();
  const actEtuve3 = document.getElementById('f-act-etuve3').value.trim();
  const actEtuve4 = document.getElementById('f-act-etuve4').value.trim();
  const cycleSteril = document.getElementById('f-cycle-steril').value.trim();
  const date = document.getElementById('f-date').value;
  const time = document.getElementById('f-time').value;
  const medium = state.media.find(m => m.id === mId);
  if (!medium) return toast('Veuillez sélectionner un milieu.', 'error');
  if (!date || !time) return toast('Veuillez saisir date et heure.', 'error');

  const prep = new Date(`${date}T${time}`);
  const { fertilityResult, sterilityResult, expiry, renewalAlert } = computeBatchDates(medium, prep);
  const batch = {
    id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    mediumId: medium.id,
    lotNumber: lot || null,
    codeInterne: code || null,
    supplierExpiryDate: supplierExp || null,
    actionPhmetre: actPhmetre || null,
    actionEtuve3: actEtuve3 || null,
    actionEtuve4: actEtuve4 || null,
    cycleSterilisation: cycleSteril || null,
    prepDateTime: prep.toISOString(),
    fertilityResultDate: fertilityResult.toISOString(),
    sterilityResultDate: sterilityResult.toISOString(),
    expiryDate: expiry.toISOString(),
    renewalAlertDate: renewalAlert.toISOString(),
    createdAt: new Date().toISOString(),
  };
  state.batches.push(batch);
  persist();
  toast('Lot enregistré avec succès.', 'success');
  document.getElementById('batch-form').reset();
  go('dashboard');
}

function editBatch(id) {
  const b = state.batches.find(x => x.id === id);
  if (!b) return;
  go('register');
  document.getElementById('f-medium').value = b.mediumId;
  document.getElementById('f-lot').value = b.lotNumber || '';
  document.getElementById('f-code').value = b.codeInterne || '';
  document.getElementById('f-supplier-exp').value = b.supplierExpiryDate || '';
  document.getElementById('f-act-phmetre').value = b.actionPhmetre || '';
  document.getElementById('f-act-etuve3').value = b.actionEtuve3 || '';
  document.getElementById('f-act-etuve4').value = b.actionEtuve4 || '';
  document.getElementById('f-cycle-steril').value = b.cycleSterilisation || '';
  const d = new Date(b.prepDateTime);
  document.getElementById('f-date').value = d.toISOString().slice(0, 10);
  document.getElementById('f-time').value = fmtTime(d);
  updatePreview();
}

function deleteBatch(id) {
  confirmAction('Supprimer ce lot ?', 'Cette action est irréversible.', () => {
    state.batches = state.batches.filter(b => b.id !== id);
    persist();
    renderDashboard();
    toast('Lot supprimé.', 'success');
  });
}

function saveMedia(e) {
  e.preventDefault();
  const id = document.getElementById('m-id').value;
  const name = document.getElementById('m-name').value.trim();
  const type = document.getElementById('m-type').value;
  const shelfLifeDays = parseInt(document.getElementById('m-shelf').value, 10);
  const strains = collectStrains('m-strains-list');
  const inhibitionStrains = collectStrains('m-inhib-list');
  const codeRef = document.getElementById('m-code-ref').value.replace(/[^A-Za-z]/g, '').toUpperCase();
  const fert = parseInt(document.getElementById('m-fert').value, 10);
  const fmt = document.querySelector('input[name="m-fmt"]:checked').value;
  if (!name || strains.length === 0 || isNaN(fert) || fert < 0) {
    return toast('Veuillez remplir le nom, au moins une souche et le délai de fertilité.', 'error');
  }
  if (isNaN(shelfLifeDays) || shelfLifeDays <= 0) return toast('Veuillez choisir un délai de conservation.', 'error');

  const data = {
    name, type, shelfLifeDays, strains, inhibitionStrains,
    codeInterneRef: codeRef || null,
    fertilityDelayDays: fert,
    sterilityFormat: fmt,
    ph: document.getElementById('m-ph').value.trim() || null,
    couleur: document.getElementById('m-couleur').value.trim() || null,
    additif: document.getElementById('m-additif').value.trim() || null,
    aspect: document.getElementById('m-aspect').value.trim() || null,
    fournisseur: document.getElementById('m-fournisseur').value.trim() || null,
    isDefault: false,
  };
  if (fmt === 'range') {
    const min = parseInt(document.getElementById('m-min').value, 10);
    const max = parseInt(document.getElementById('m-max').value, 10);
    if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0 || min > max) return toast('Plage heures invalide.', 'error');
    data.sterilityMinHours = min;
    data.sterilityMaxHours = max;
  } else {
    const v = parseInt(document.getElementById('m-single').value, 10);
    if (isNaN(v) || v <= 0) return toast('Durée invalide.', 'error');
    data.sterilityValue = v;
  }

  let target;
  if (id) {
    const existing = state.media.find(m => m.id === id);
    if (existing) {
      const wasDefault = existing.isDefault;        // editing a default keeps it default/protected
      const prevStrain = existing.strain;
      Object.assign(existing, data);
      existing.isDefault = wasDefault;
      if ('strain' in existing) delete existing.strain;  // migrate legacy single-strain field
      target = existing;
    }
  } else {
    data.id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    state.media.push(data);
    target = data;
  }
  if (target) applyCoaChange(target);   // persists + re-renders when the IDB write settles
  persist();
  document.getElementById('media-form-wrap').classList.add('hidden');
  renderMedia();
  toast('Milieu enregistré.', 'success');
}

function editMedia(id) {
  const m = state.media.find(x => x.id === id);
  if (m) showMediaForm(m);
}

function deleteMedia(id) {
  const m = state.media.find(x => x.id === id);
  if (!m) return;
  confirmAction(`Supprimer "${m.name}" ?`, 'Ce milieu sera supprimé définitivement.', () => {
    state.media = state.media.filter(x => x.id !== id);
    // Remember deleted defaults so loadState doesn't re-add them
    if (m.isDefault && !state.deletedDefaults.includes(id)) state.deletedDefaults.push(id);
    persist();
    idbDeleteCoa(id).catch(() => {});   // clean up any stored CoA
    renderMedia();
    toast('Milieu supprimé.', 'success');
  });
}

/* ============================================================
   MEDIA FORM — souches multiples
   ============================================================ */

const STRAIN_PLACEHOLDER = {
  'm-strains-list': 'Ex. H. influenzae ATCC 10211',
  'm-inhib-list': 'Ex. E. coli ATCC 25922',
};

function renderStrainRows(listId, strains) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.innerHTML = '';
  const arr = (strains && strains.length) ? strains : [''];
  arr.forEach(v => addStrainRow(listId, v));
}

function addStrainRow(listId, value) {
  const list = document.getElementById(listId);
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'strain-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'field-input strain-input';
  input.placeholder = STRAIN_PLACEHOLDER[listId] || '';
  input.value = value || '';
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'strain-remove';
  rm.setAttribute('aria-label', 'Retirer cette souche');
  rm.textContent = '×';
  rm.addEventListener('click', () => {
    const rows = list.querySelectorAll('.strain-row');
    if (rows.length > 1) row.remove();
    else input.value = '';   // always keep at least one row
  });
  row.appendChild(input);
  row.appendChild(rm);
  list.appendChild(row);
}

function collectStrains(listId) {
  const list = document.getElementById(listId);
  if (!list) return [];
  return Array.from(list.querySelectorAll('.strain-input')).map(i => i.value.trim()).filter(Boolean);
}

function mediumInhibStrains(medium) {
  return Array.isArray(medium.inhibitionStrains) ? medium.inhibitionStrains.filter(Boolean) : [];
}

/* ============================================================
   MEDIA FORM — CoA (Certificat d'analyse) : import PDF + lecture inline
   Fichier stocké dans IndexedDB (clé = id du milieu). Métadonnées dans le milieu.
   ============================================================ */

let _formCoaAction = null;   // null | 'set' | 'remove'  (for the current form session)
let _formCoaBlob   = null;   // Blob when action === 'set'
let _formCoaMeta   = null;   // { name, size } — pending OR existing saved meta

function fmtBytes(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' o';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' Ko';
  return (n / 1024 / 1024).toFixed(1) + ' Mo';
}

function coaFormReset(existingMeta) {
  _formCoaAction = null;
  _formCoaBlob = null;
  _formCoaMeta = existingMeta || null;
  const fileInput = document.getElementById('m-coa-file');
  if (fileInput) fileInput.value = '';
  renderCoaFormUI();
}

function currentFormCoaMeta() {
  if (_formCoaAction === 'remove') return null;
  return _formCoaMeta;
}

function renderCoaFormUI() {
  const status = document.getElementById('m-coa-status');
  const actions = document.getElementById('m-coa-actions');
  if (!status || !actions) return;
  const meta = currentFormCoaMeta();
  if (meta) {
    status.textContent = meta.name + (meta.size ? ` (${fmtBytes(meta.size)})` : '');
    actions.classList.remove('hidden');
  } else {
    status.textContent = 'Aucun fichier';
    actions.classList.add('hidden');
  }
}

function onCoaFileChosen(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) { toast('Le CoA doit être un fichier PDF.', 'error'); return; }
  if (file.size > 20 * 1024 * 1024) { toast('Fichier trop volumineux (max 20 Mo).', 'error'); return; }
  _formCoaAction = 'set';
  _formCoaBlob = file;
  _formCoaMeta = { name: file.name, size: file.size };
  renderCoaFormUI();
  toast('CoA prêt — enregistrez le milieu pour le sauvegarder.', 'success');
}

function coaFormMarkRemove() {
  _formCoaAction = 'remove';
  _formCoaBlob = null;
  const fileInput = document.getElementById('m-coa-file');
  if (fileInput) fileInput.value = '';
  renderCoaFormUI();
}

function viewFormCoa() {
  const meta = currentFormCoaMeta();
  if (!meta) return;
  if (_formCoaAction === 'set' && _formCoaBlob) {
    openCoaViewerFromBlob(_formCoaBlob, meta.name);
  } else {
    const id = document.getElementById('m-id').value;
    if (id) openCoaViewer(id, meta.name);
  }
}

// Called from saveMedia: persist the pending CoA change for this medium.
function applyCoaChange(medium) {
  if (_formCoaAction === 'set' && _formCoaBlob) {
    const blob = _formCoaBlob, meta = _formCoaMeta;
    idbPutCoa(medium.id, blob).then(() => {
      medium.coa = { name: meta.name, size: meta.size, importedAt: new Date().toISOString() };
      persist();
      renderMedia();
    }).catch(err => { console.warn('CoA save failed', err); toast('Échec de l\'enregistrement du CoA.', 'error'); });
  } else if (_formCoaAction === 'remove') {
    idbDeleteCoa(medium.id).catch(() => {});
    medium.coa = null;
  }
}

/* --- IndexedDB (fichiers CoA) --- */
const COA_DB = 'milieuxlab-files';
const COA_STORE = 'coa';

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(COA_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(COA_STORE)) db.createObjectStore(COA_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPutCoa(key, blob) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(COA_STORE, 'readwrite');
    tx.objectStore(COA_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}
function idbGetCoa(key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(COA_STORE, 'readonly');
    const r = tx.objectStore(COA_STORE).get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  }));
}
function idbDeleteCoa(key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(COA_STORE, 'readwrite');
    tx.objectStore(COA_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

/* --- Lecteur PDF inline (pdf.js) --- */
async function openCoaViewer(mediumId, name) {
  try {
    const blob = await idbGetCoa(mediumId);
    if (!blob) { toast('CoA introuvable.', 'error'); return; }
    openCoaViewerFromBlob(blob, name);
  } catch (e) { console.warn(e); toast('Impossible d\'ouvrir le CoA.', 'error'); }
}

async function openCoaViewerFromBlob(blob, name) {
  const modal = document.getElementById('coa-viewer-modal');
  const pagesEl = document.getElementById('coa-viewer-pages');
  const sub = document.getElementById('coa-viewer-sub');
  if (!modal || !pagesEl) return;
  pagesEl.innerHTML = '<div class="coa-loading">Chargement…</div>';
  if (sub) sub.textContent = name || '';
  modal.classList.remove('hidden');
  try {
    if (!window.pdfjsLib) { pagesEl.innerHTML = '<div class="coa-loading">Lecteur PDF indisponible.</div>'; return; }
    const buf = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    if (sub) sub.textContent = (name ? name + ' · ' : '') + pdf.numPages + ' page' + (pdf.numPages > 1 ? 's' : '');
    pagesEl.innerHTML = '';
    const targetW = Math.min(pagesEl.clientWidth || 700, 1100);
    const dpr = window.devicePixelRatio || 1;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (targetW / base.width) * dpr });
      const canvas = document.createElement('canvas');
      canvas.className = 'coa-page';
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = '100%';
      pagesEl.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    }
  } catch (e) {
    console.warn('CoA render failed', e);
    pagesEl.innerHTML = '<div class="coa-loading">Impossible d\'afficher ce PDF.</div>';
  }
}

function closeCoaViewer() {
  const modal = document.getElementById('coa-viewer-modal');
  if (modal) modal.classList.add('hidden');
  const pagesEl = document.getElementById('coa-viewer-pages');
  if (pagesEl) pagesEl.innerHTML = '';
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  state.settings.browserNotifications = Notification.permission === 'granted';
  persist();
  renderSettings();
}

function fireBrowserNotification(alerts) {
  if (!state.settings.browserNotifications) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (alerts.length === 0) return;
  const text = alerts.slice(0, 3).map(a => `• ${a.medium}: ${a.msg}`).join('\n');
  try {
    new Notification(`MilieuXlab — ${alerts.length} alerte${alerts.length > 1 ? 's' : ''}`, {
      body: text,
      icon: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0A0E14"/><text x="50%" y="58%" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#00C896">MX</text></svg>'),
    });
  } catch (e) { /* silent */ }
}

/* ============================================================
   TOAST + CONFIRM
   ============================================================ */

let toastTimer;
function toast(msg, type = '', durationMs = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast ' + type; }, durationMs);
}

function confirmAction(title, text, onOk) {
  const modal = document.getElementById('confirm');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  modal.classList.remove('hidden');
  const ok = document.getElementById('confirm-ok');
  const cancel = document.getElementById('confirm-cancel');
  const close = () => modal.classList.add('hidden');
  const okHandler = () => { close(); ok.removeEventListener('click', okHandler); cancel.removeEventListener('click', cancelHandler); onOk(); };
  const cancelHandler = () => { close(); ok.removeEventListener('click', okHandler); cancel.removeEventListener('click', cancelHandler); };
  ok.addEventListener('click', okHandler);
  cancel.addEventListener('click', cancelHandler);
}

/* ============================================================
   HELPERS
   ============================================================ */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ============================================================
   THEME — dark / light toggle (persisted in localStorage)
   ============================================================ */

function getSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch (e) {}
  return null;
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.setAttribute('data-theme', 'dark');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
}

/* ============================================================
   PDF EXPORT — Planning de renouvellement
   ============================================================ */

let _pdfFilters = { period: 'all', onlyUrgent: false };

function openPdfFilters() {
  document.getElementById('pdf-period').value       = _pdfFilters.period;
  document.getElementById('pdf-only-urgent').checked = _pdfFilters.onlyUrgent;
  document.getElementById('pdf-filters').classList.remove('hidden');
}

function closePdfFilters() {
  document.getElementById('pdf-filters').classList.add('hidden');
}

function startPdfExport() {
  _pdfFilters = {
    period:     document.getElementById('pdf-period').value,
    onlyUrgent: document.getElementById('pdf-only-urgent').checked,
  };
  closePdfFilters();
  try {
    const doc = buildPdfDoc();
    const today = new Date();
    const fname = `planning-renouvellement-${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}.pdf`;
    doc.download(fname);
  } catch (e) {
    console.error('PDF generation failed:', e);
    toast('Erreur lors de la génération du PDF : ' + (e.message || e), 'error');
  }
}

const pad2 = n => String(n).padStart(2, '0');
const getRenewalDate = b => new Date(b.renewalAlertDate);
const daysUntil      = d => daysBetween(new Date(), d);

function formatDays(days) {
  if (days === 0) return "aujourd'hui";
  return days > 0 ? `+${days} j` : `${days} j`;
}

function getPeriodRange(period) {
  const now = startOfDay(new Date());
  if (period === 'all') return null;
  if (period === 'week') {
    const day = now.getDay() || 7;                  // Sun(0) → 7
    const start = addDays(now, -(day - 1));          // lundi
    return { start, end: addDays(start, 6), label: 'Cette semaine' };
  }
  if (period === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end:   new Date(now.getFullYear(), now.getMonth() + 1, 0),
      label: 'Ce mois',
    };
  }
  if (period === 'quarter') {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      start: new Date(now.getFullYear(), qStartMonth, 1),
      end:   new Date(now.getFullYear(), qStartMonth + 3, 0),
      label: 'Ce trimestre',
    };
  }
  return null;
}

function pdfStatusOf(batch) {
  const code = batchStatus(batch).code;
  if (code === 'expired') return { bucket: 'expired', label: 'Expiré' };
  if (code === 'urgent' || code === 'soon') return { bucket: 'urgent', label: 'À renouveler' };
  return { bucket: 'ok', label: 'Conforme' };
}

function preparePdfRows() {
  const range    = getPeriodRange(_pdfFilters.period);
  const labName  = (state.settings.labName || '').trim() || 'MilieuXlab';
  const now      = new Date();
  const genDate  = fmtDateTime(now);
  const periodText = range
    ? `${range.label} (${fmtDate(range.start)} – ${fmtDate(range.end)})`
    : 'Toutes les dates';

  let rows = state.batches
    .map(b => ({ batch: b, medium: getBatchMedium(b) }))
    .filter(({ medium }) => !!medium);

  if (range) {
    const lo = startOfDay(range.start);
    const hi = startOfDay(addDays(range.end, 1));
    rows = rows.filter(({ batch }) => {
      const r = getRenewalDate(batch);
      return r >= lo && r <= hi;
    });
  }

  if (_pdfFilters.onlyUrgent) {
    rows = rows.filter(({ batch }) => {
      const c = batchStatus(batch).code;
      return c === 'expired' || c === 'urgent' || c === 'soon';
    });
  }

  rows.sort((a, b) => getRenewalDate(a.batch) - getRenewalDate(b.batch));

  const summary = { total: rows.length, expired: 0, urgent: 0, ok: 0 };
  rows.forEach(r => {
    const b = pdfStatusOf(r.batch).bucket;
    if (b === 'expired') summary.expired++;
    else if (b === 'urgent') summary.urgent++;
    else summary.ok++;
  });

  return { rows, summary, labName, genDate, periodText };
}

function drawStatTile(pdf, x, y, w, h, n, label, numColor, bg) {
  if (bg) pdf.rect(x, y, w, h, { fill: bg });
  pdf.rect(x, y, w, h, { stroke: '#C7D2DD', strokeWidth: 0.5 });
  // Number: large, near the top-left with padding (size 20, baseline at y+25)
  pdf.text(String(n), x + 10, y + 25, { size: 20, bold: true, color: numColor });
  // Label: small uppercase, below the number
  pdf.text(label.toUpperCase(), x + 10, y + 48, { size: 7.5, color: '#5A7A99' });
}

function buildPdfDoc() {
  const { rows, summary, labName, genDate, periodText } = preparePdfRows();
  const pdf = new PDF({
    size: 'A4', orientation: 'landscape',
    margin: { top: 42, right: 42, bottom: 51, left: 42 },
  });
  const PW = pdf.w;
  const M = pdf.margin.left;
  const contentW = PW - 2 * M;

  // ----- HEADER -----
  pdf.text(labName, M, 60, { size: 14, bold: true });
  pdf.text('Planning de renouvellement', PW - M, 60, { size: 9, color: '#5A7A99', align: 'right' });
  pdf.text('Généré le ' + genDate, PW - M, 75, { size: 9, color: '#0A0E14', align: 'right' });
  // Divider sits a bit below the "Généré le ..." text, with breathing room
  pdf.line(M, 100, PW - M, 100, { color: '#0A0E14', width: 1.5 });

  // ----- TITLE + SUBTITLE -----
  pdf.text('Planning de renouvellement des milieux de culture', M, 120, { size: 16, bold: true });
  const sub = `${periodText} · ${summary.total} lot${summary.total > 1 ? 's' : ''}`;
  pdf.text(sub.toUpperCase(), M, 138, { size: 8.5, color: '#5A7A99' });

  // ----- SUMMARY TILES (4) -----
  const tileY = 150, tileH = 60;
  const tileGap = 8;
  const tileW = (contentW - 3 * tileGap) / 4;
  drawStatTile(pdf, M + 0 * (tileW + tileGap), tileY, tileW, tileH, summary.total,   'Total',                    '#0A0E14', '#F8FAFC');
  drawStatTile(pdf, M + 1 * (tileW + tileGap), tileY, tileW, tileH, summary.expired, 'Expirés',                  '#D6334B', '#FEE2E2');
  drawStatTile(pdf, M + 2 * (tileW + tileGap), tileY, tileW, tileH, summary.urgent,  'À renouveler (<= 7 j)',   '#B45309', '#FEF3C7');
  drawStatTile(pdf, M + 3 * (tileW + tileGap), tileY, tileW, tileH, summary.ok,      'Conformes',                '#007A5E', '#F8FAFC');

  // ----- TABLE -----
  // Landscape A4 gives us 842 - 84 (margins) = 758pt of horizontal space.
  // Distribution: Milieu and N° de lot are wide enough to hold full text
  // (e.g. "BHI Chocolat Agar" without truncation); the other columns get
  // a comfortable minimum. Sums to 758.
  const tableY = 230;
  const widths = [168, 92, 92, 84, 84, 96, 56, 86];  // 8 cols, sums to 758
  const t = pdf.table({ x: M, y: tableY, widths, rowHeight: 18, headerHeight: 24, headerRepeat: true });
  t.header(
    ['Milieu', 'N° de lot', 'Code interne', 'Préparation', 'Péremption', 'Renouvellement', 'Jours', 'Statut'],
    { bg: '#E2E8F0', textColor: '#0A0E14', bold: true, size: 8 }
  );

  if (rows.length === 0) {
    // Empty state: positioned BELOW the table header (tableY + 18), with a white
    // fill so the table header doesn't bleed through. Stroke only (no dashed effect).
    const emptyY = tableY + 18;
    pdf.rect(M, emptyY, contentW, 60, { fill: '#FFFFFF', stroke: '#C7D2DD', strokeWidth: 0.5 });
    pdf.text('Aucun lot ne correspond aux critères sélectionnés.',
             M, emptyY + 35, { size: 10, color: '#5A7A99', align: 'center', width: contentW });
  } else {
    rows.forEach((r, i) => {
      const ps = pdfStatusOf(r.batch);
      const days = daysUntil(new Date(r.batch.expiryDate));
      const baseBg = ps.bucket === 'expired' ? '#FEE2E2'
                   : ps.bucket === 'urgent'  ? '#FEF3C7'
                   : (i % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
      // Soft red for the Renouvellement column (index 5), regardless of row status
      const rowBgs = [baseBg, baseBg, baseBg, baseBg, baseBg, '#FCE4E4', baseBg, baseBg];
      const renewalFg = '#7F1D1D';
      const fg = ps.bucket === 'expired' ? '#7F1D1D'
              : ps.bucket === 'urgent'  ? '#78350F'
              : '#0A0E14';
      // Per-cell text color: keep the renewal date in red even if the row is normal
      const cellFgs = [fg, fg, fg, fg, fg, renewalFg, fg, fg];
      t.row([
        r.medium.name,
        r.batch.lotNumber || '—',
        r.batch.codeInterne || '—',
        fmtDate(r.batch.prepDateTime),
        fmtDate(r.batch.expiryDate),
        fmtDate(r.batch.renewalAlertDate),
        formatDays(days),
        ps.label,
      ], { cellBgs: rowBgs, cellTextColors: cellFgs });
    });
  }
  t.end();

  // ----- FOOTER (post-stamped on every page in pdf.download) -----
  pdf.footer((pageIdx, total) =>
    `Page ${pageIdx + 1} / ${total} · ${labName} · Généré le ${genDate}`);

  return pdf;
}

/* ============================================================
   INIT
   ============================================================ */

function init() {
  // Apply theme as early as possible (before first paint) to avoid flash
  applyTheme(getSavedTheme() || 'dark');

  loadState();
  showUpdateToastIfJustUpdated();

  // Navigation
  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => go(btn.dataset.go));
  });

  // Theme toggle
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Stat tiles → category details popup
  document.querySelectorAll('.stat-tile[data-stat]').forEach(tile => {
    tile.addEventListener('click', () => openStatDetails(tile.dataset.stat));
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStatDetails(tile.dataset.stat); }
    });
  });
  const statClose = document.getElementById('stat-details-close');
  if (statClose) statClose.addEventListener('click', closeStatDetails);
  const statModal = document.getElementById('stat-details-modal');
  if (statModal) statModal.addEventListener('click', (e) => { if (e.target === statModal) closeStatDetails(); });

  // Register form
  document.getElementById('batch-form').addEventListener('submit', saveBatch);
  ['f-medium','f-date','f-time'].forEach(id => {
    document.getElementById(id).addEventListener('change', updatePreview);
    document.getElementById(id).addEventListener('input', updatePreview);
  });
  // When the medium changes, prefill the internal code with its reference
  document.getElementById('f-medium').addEventListener('change', autofillCodeInterne);
  // Keep the internal code uppercase as the user types
  document.getElementById('f-code').addEventListener('input', (e) => {
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase();
    e.target.setSelectionRange(pos, pos);
  });

  // Media form
  // Reference code interne: letters only, auto-uppercased
  document.getElementById('m-code-ref').addEventListener('input', (e) => {
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase();
    e.target.setSelectionRange(pos, pos);
  });
  document.getElementById('btn-add-media').addEventListener('click', () => showMediaForm(null));
  document.getElementById('media-form-close').addEventListener('click', () => document.getElementById('media-form-wrap').classList.add('hidden'));
  document.querySelectorAll('input[name="m-fmt"]').forEach(r => r.addEventListener('change', updateMediaFormFields));
  document.getElementById('media-form').addEventListener('submit', saveMedia);

  // Souches multiples (fertilité + inhibition)
  document.getElementById('m-strain-add').addEventListener('click', () => addStrainRow('m-strains-list', ''));
  document.getElementById('m-inhib-add').addEventListener('click', () => addStrainRow('m-inhib-list', ''));

  // CoA import + lecteur inline
  if (window.pdfjsLib) { try { pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.js'; } catch (e) {} }
  document.getElementById('m-coa-import').addEventListener('click', () => document.getElementById('m-coa-file').click());
  document.getElementById('m-coa-file').addEventListener('change', (e) => onCoaFileChosen(e.target.files && e.target.files[0]));
  document.getElementById('m-coa-view').addEventListener('click', viewFormCoa);
  document.getElementById('m-coa-remove').addEventListener('click', coaFormMarkRemove);
  const coaClose = document.getElementById('coa-viewer-close');
  if (coaClose) coaClose.addEventListener('click', closeCoaViewer);
  const coaModal = document.getElementById('coa-viewer-modal');
  if (coaModal) coaModal.addEventListener('click', (e) => { if (e.target === coaModal) closeCoaViewer(); });

  // List event delegation
  document.getElementById('batches-list').addEventListener('click', e => {
    const editId = e.target.dataset.edit;
    const delId  = e.target.dataset.del;
    if (editId) editBatch(editId);
    if (delId)  deleteBatch(delId);
  });
  document.getElementById('media-list').addEventListener('click', e => {
    const editId = e.target.dataset.medit;
    const delId  = e.target.dataset.mdel;
    const coaEl  = e.target.closest ? e.target.closest('[data-mcoa]') : null;
    if (editId) editMedia(editId);
    if (delId)  deleteMedia(delId);
    if (coaEl) {
      const cid = coaEl.dataset.mcoa;
      const m = state.media.find(x => x.id === cid);
      openCoaViewer(cid, m && m.coa ? m.coa.name : '');
    }
  });

  // Settings
  document.getElementById('s-notif').addEventListener('change', async (e) => {
    if (e.target.checked) {
      await requestNotificationPermission();
    } else {
      state.settings.browserNotifications = false;
      persist();
    }
  });
  document.getElementById('s-expired').addEventListener('change', e => {
    state.settings.showExpired = e.target.checked;
    persist();
    if (state.currentView === 'dashboard') renderDashboard();
  });
  const labInput = document.getElementById('s-labname');
  if (labInput) {
    labInput.addEventListener('change', e => {
      state.settings.labName = e.target.value.trim();
      persist();
    });
  }
  document.getElementById('btn-reset-batches').addEventListener('click', () => {
    confirmAction('Supprimer tous les lots ?', 'Tous les lots enregistrés seront effacés.', () => {
      state.batches = [];
      persist();
      renderDashboard();
      toast('Tous les lots ont été supprimés.', 'success');
    });
  });
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    confirmAction('Réinitialiser l\'application ?', 'Lots, milieux personnalisés et préférences seront effacés. Les milieux par défaut seront restaurés.', () => {
      localStorage.removeItem(STORAGE.BATCHES);
      localStorage.removeItem(STORAGE.MEDIA);
      localStorage.removeItem(STORAGE.SETTINGS);
      localStorage.removeItem(STORAGE.DELETED_DEFAULTS);
      loadState();
      renderDashboard();
      renderMedia();
      renderSettings();
      toast('Application réinitialisée.', 'success');
    });
  });

  // PDF export
  document.getElementById('btn-pdf').addEventListener('click', openPdfFilters);
  document.getElementById('pdf-cancel').addEventListener('click', closePdfFilters);
  document.getElementById('pdf-generate').addEventListener('click', startPdfExport);

  // Calendar
  const calBtn = document.getElementById('btn-calendar');
  if (calBtn) calBtn.addEventListener('click', openCalendar);
  const calClose = document.getElementById('calendar-close');
  if (calClose) calClose.addEventListener('click', closeCalendar);
  const calPrev = document.getElementById('calendar-prev');
  if (calPrev) calPrev.addEventListener('click', () => shiftCalendarMonth(-1));
  const calNext = document.getElementById('calendar-next');
  if (calNext) calNext.addEventListener('click', () => shiftCalendarMonth(1));
  const calModal = document.getElementById('calendar-modal');
  if (calModal) calModal.addEventListener('click', (e) => { if (e.target === calModal) closeCalendar(); });
  const dayClose = document.getElementById('day-details-close');
  if (dayClose) dayClose.addEventListener('click', closeDayDetails);
  const dayModal = document.getElementById('day-details-modal');
  if (dayModal) dayModal.addEventListener('click', (e) => { if (e.target === dayModal) closeDayDetails(); });

  // Initial render — only when the app is reachable (i.e. NOT in browser tab).
  // The install gate hides the .app via CSS, but we also skip the render so
  // nothing happens behind the gate (e.g. no alerts poller, no batch reads).
  if (!document.body.classList.contains('has-install-gate')) {
    renderDashboard();
  }

  // Browser notifications on load (also gated)
  if (!document.body.classList.contains('has-install-gate')) {
    const alerts = computeTodaysAlerts();
    if (alerts.length > 0 && document.hidden) fireBrowserNotification(alerts);
    startNotificationPoller();
  }

  // PWA install gate (blocks the app in regular browser tabs)
  setupInstallGate();
  if (isInstalledPWA()) {
    // App is installed — register the SW and try to subscribe for push
    registerServiceWorker();
  }
}

function computeTodaysAlerts() {
  const out = [];
  const now = new Date();
  state.batches.forEach(b => {
    const s = batchStatus(b);
    const medium = getBatchMedium(b);
    if (!medium) return;
    if (s.code === 'urgent')  out.push({ medium: medium.name, msg: 'Renouvellement requis', batchId: b.id });
    else if (s.code === 'expired') out.push({ medium: medium.name, msg: 'EXPIRÉ', batchId: b.id });
    else if (s.code === 'fert-today') out.push({ medium: medium.name, msg: 'Résultat fertilité', batchId: b.id });
    else if (s.code === 'ster-today') out.push({ medium: medium.name, msg: 'Résultat stérilité', batchId: b.id });
  });
  return out;
}

/* ============================================================
   NOTIFICATION POLLER
   Re-checks alerts every 5 min and fires a Notification only when:
     • the alert set has actually changed since the last check, AND
     • the tab is hidden (so we don't spam while user is looking at it),
     • and OS/browser permission is still 'granted'.
   ============================================================ */

let _lastAlertSig = '';
let _pollTimer = null;

function alertSignature(alerts) {
  return alerts
    .slice()
    .sort((a, b) => (a.batchId || '').localeCompare(b.batchId || ''))
    .map(a => `${a.batchId}:${a.msg}`)
    .join('|');
}

function startNotificationPoller() {
  if (_pollTimer) clearInterval(_pollTimer);
  const alerts = computeTodaysAlerts();
  _lastAlertSig = alertSignature(alerts);
  _pollTimer = setInterval(checkAlertsForNotification, NOTIF_POLL_MS);
  // Also re-check when the tab regains focus, so that the next time the user
  // switches away, we have a fresh baseline (no surprise notification on first blur).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const fresh = computeTodaysAlerts();
      _lastAlertSig = alertSignature(fresh);
    }
  });
}

function checkAlertsForNotification() {
  if (!state.settings.browserNotifications) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // Don't fire while the user is actively looking at the tab — the in-app
  // banner already shows the alert there.
  if (!document.hidden) return;
  const fresh = computeTodaysAlerts();
  const sig = alertSignature(fresh);
  if (sig === _lastAlertSig) return;
  _lastAlertSig = sig;
  if (fresh.length === 0) return;
  fireBrowserNotification(fresh);
}

/* ============================================================
   PWA — install gate, service worker, Web Push subscription
   ============================================================ */

const PWA_KEY = 'milieuxlab.pwa.v1';
let _deferredInstallPrompt = null;

function isInstalledPWA() {
  // 1. Android/Chrome: matchMedia('(display-mode: standalone)') === true
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // 2. iOS Safari: window.navigator.standalone === true
  if (window.navigator.standalone === true) return true;
  // 3. Some Android launchers
  if (document.referrer.includes('android-app://')) return true;
  return false;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}
function isAndroid() { return /android/i.test(window.navigator.userAgent); }

function setupInstallGate() {
  // RULE: the dashboard MUST only render in the installed PWA.
  // In a regular browser tab, we always show the install gate and hide
  // the dashboard, regardless of whether the user has installed the app
  // on this device before. They should use the home screen icon, not
  // the browser tab.
  const gate = document.getElementById('install-gate');
  if (!gate) return;

  if (isInstalledPWA()) {
    // We are running inside the installed PWA (standalone display mode).
    // Show a one-time welcome toast on first install. The dashboard is
    // allowed to render normally.
    const WELCOME_KEY = 'milieuxlab.welcomed.v1';
    if (!localStorage.getItem(WELCOME_KEY)) {
      localStorage.setItem(WELCOME_KEY, '1');
      setTimeout(() => {
        if (typeof toast === 'function') {
          toast('Application installée — retrouvez MilieuXlab sur votre écran d\'accueil.', 'success', 4500);
        }
      }, 600);
    }
    return;
  }

  // We are in a regular browser tab. Block the dashboard. The user must
  // open the installed PWA from their home screen.
  gate.hidden = false;
  document.body.classList.add('has-install-gate');

  // Two buttons in the gate. Both are visible on every device so the user
  // can pick whichever applies. The Android button triggers the native
  // install dialog when available (does nothing on iOS where no such API
  // exists); the iOS button opens the instruction modal.
  const androidBtn = document.getElementById('install-trigger');
  const iosBtn     = document.getElementById('install-ios-open');

  // iOS modal handlers
  const iosModal   = document.getElementById('ios-modal');
  const iosClose   = document.getElementById('ios-modal-close');
  const iosDismiss = document.getElementById('ios-modal-dismiss');
  const openIosModal  = () => iosModal && iosModal.classList.remove('hidden');
  const closeIosModal = () => iosModal && iosModal.classList.add('hidden');
  if (iosBtn)     iosBtn.addEventListener('click', openIosModal);
  if (iosClose)   iosClose.addEventListener('click', closeIosModal);
  if (iosDismiss) iosDismiss.addEventListener('click', closeIosModal);
  if (iosModal) {
    iosModal.addEventListener('click', (e) => {
      if (e.target === iosModal) closeIosModal();
    });
  }

  // Android: bind the real install button to the deferred native prompt.
  // The button is always visible to Android users; if the prompt isn't
  // available yet (manifest not yet satisfied, etc.) it does nothing.
  if (androidBtn) {
    androidBtn.addEventListener('click', async () => {
      if (_deferredInstallPrompt) {
        _deferredInstallPrompt.prompt();
        try {
          const choice = await _deferredInstallPrompt.userChoice;
          // Note: we do NOT hide the gate or remove `has-install-gate` here.
          // The browser tab is still open and the user is still in Chrome —
          // if we removed the gate, the dashboard would appear in the browser
          // tab, which violates the rule "dashboard only in the installed app".
          // The success modal handles the "you installed it" feedback; the
          // gate stays visible so the user closes the browser and opens the
          // app from the home screen.
          if (choice && choice.outcome !== 'accepted') {
            // User dismissed the install dialog — show a fallback toast
            if (typeof toast === 'function') {
              toast('Installation annulée.', '');
            }
          }
        } catch (e) { /* user dismissed */ }
        _deferredInstallPrompt = null;
      } else {
        // Prompt not yet available (e.g. manifest not yet valid, or
        // browser already dismissed). Show a transient toast.
        if (typeof toast === 'function') {
          toast('Ouvrez le menu ⋮ de Chrome puis « Installer l\'application ».', '');
        }
      }
    });
  }

  // Capture the native install prompt as soon as the browser fires it.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
  });

  // After install, show the success modal + register the SW.
  // The `appinstalled` event fires only when the user actually accepts
  // the native install dialog — so this is a reliable signal that the
  // app is now on the home screen.
  const successModal   = document.getElementById('install-success-modal');
  const successClose   = document.getElementById('install-success-close');
  const successOk      = document.getElementById('install-success-ok');
  const dismissSuccess = () => { if (successModal) successModal.classList.add('hidden'); };
  if (successClose) successClose.addEventListener('click', dismissSuccess);
  if (successOk)    successOk.addEventListener('click', dismissSuccess);
  if (successModal) {
    successModal.addEventListener('click', (e) => {
      if (e.target === successModal) dismissSuccess();
    });
  }

  window.addEventListener('appinstalled', () => {
    // Keep the gate visible (don't hide it) — the modal explains what happened.
    // Hiding the gate here would show the dashboard before the user closes
    // the success modal, which is jarring.
    if (successModal) {
      successModal.classList.remove('hidden');
    }
    // Register the service worker in the background
    registerServiceWorker();
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    // Force the browser to re-check the SW script on every app launch.
    const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    // Explicitly ask the browser to look for a new SW right now
    try { await reg.update(); } catch (e) { /* offline — fine */ }

    // AUTO-UPDATE: sw.js calls skipWaiting() on install and clients.claim()
    // on activate, so a freshly installed SW takes control immediately. The
    // controllerchange listener below then reloads the page once so the new
    // version runs — no user tap required.
    // If an older SW is stuck in "waiting" (client updated from pre-v13),
    // unstick it now.
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Ask the running SW its version (displayed in Réglages)
    requestAppVersion();

    // Fetch the VAPID public key from the server (avoids bundling a key in the client)
    let vapidKey = '';
    try {
      const r = await fetch('/api/vapid-public');
      if (r.ok) {
        const j = await r.json();
        vapidKey = j.vapidPublicKey;
      }
    } catch (e) { /* offline, ignore */ }
    // Try to subscribe for Web Push (only works in installed PWA context)
    await maybeSubscribePush(reg, vapidKey);
  } catch (e) {
    console.warn('Service worker registration failed:', e);
  }
}

// Ask the controlling SW for its version (it replies with a VERSION message,
// handled below, which fills the #app-version label in Réglages).
function requestAppVersion() {
  try {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' });
  } catch (e) {}
}

// Shown once right after an automatic update reload.
function showUpdateToastIfJustUpdated() {
  try {
    if (sessionStorage.getItem('milieuxlab.updated') === '1') {
      sessionStorage.removeItem('milieuxlab.updated');
      setTimeout(() => toast('Application mise à jour ✓', 'success'), 600);
    }
  } catch (e) {}
}

// AUTO-UPDATE: when a new SW takes control (skipWaiting + clients.claim),
// reload once so the page runs the fresh assets. Skipped on the very first
// install — the page just came from the network, nothing is stale.
let _reloadingOnSWChange = false;
const _hadControllerAtLoad = !!(typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller);
navigator.serviceWorker && navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (_reloadingOnSWChange) return;
  _reloadingOnSWChange = true;
  if (!_hadControllerAtLoad) return;
  try { sessionStorage.setItem('milieuxlab.updated', '1'); } catch (e) {}
  setTimeout(() => window.location.reload(), 150);
});

// SW → page messages (currently: version replies for the Réglages label)
navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'VERSION') {
    const el = document.getElementById('app-version');
    if (el) el.textContent = String(e.data.version).replace('milieuxlab-', '');
  }
});

async function maybeSubscribePush(reg, vapidPublicKey) {
  if (!('PushManager' in window)) return;
  if (!vapidPublicKey) { console.warn('No VAPID public key from server'); return; }
  if (!('showNotification' in reg)) return;
  if (Notification.permission === 'denied') return;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    // Send the subscription to our backend
    await fetch('/api/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        batches: state.batches,
        media: state.media,
      }),
    });
  } catch (e) {
    console.warn('Push subscription failed:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/* ============================================================
   CALENDAR — month view of renewal dates, click a day for details
   ============================================================ */

let _calCursor = null;  // first day of the month currently displayed

function openCalendar() {
  const modal = document.getElementById('calendar-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (!_calCursor) _calCursor = startOfDay(new Date());
  _calCursor.setDate(1);  // first of current month
  renderCalendar();
}

function closeCalendar() {
  const modal = document.getElementById('calendar-modal');
  if (modal) modal.classList.add('hidden');
}

function shiftCalendarMonth(delta) {
  if (!_calCursor) _calCursor = startOfDay(new Date());
  _calCursor = new Date(_calCursor.getFullYear(), _calCursor.getMonth() + delta, 1);
  renderCalendar();
}

function batchesOnDate(date) {
  // Returns batches whose RENEWAL date falls on `date`
  const target = startOfDay(date).getTime();
  return state.batches
    .map(b => ({ batch: b, medium: getBatchMedium(b) }))
    .filter(({ medium, batch }) => medium && startOfDay(new Date(batch.renewalAlertDate)).getTime() === target);
}

function batchesExpiringOnDate(date) {
  // Also include batches whose EXPIRY date is on this day
  const target = startOfDay(date).getTime();
  return state.batches
    .map(b => ({ batch: b, medium: getBatchMedium(b) }))
    .filter(({ medium, batch }) => medium && startOfDay(new Date(batch.expiryDate)).getTime() === target);
}

function batchesFertileOnDate(date) {
  const target = startOfDay(date).getTime();
  return state.batches
    .map(b => ({ batch: b, medium: getBatchMedium(b) }))
    .filter(({ medium, batch }) => medium && startOfDay(new Date(batch.fertilityResultDate)).getTime() === target);
}

function batchesSterileOnDate(date) {
  const target = startOfDay(date).getTime();
  return state.batches
    .map(b => ({ batch: b, medium: getBatchMedium(b) }))
    .filter(({ medium, batch }) => medium && startOfDay(new Date(batch.sterilityResultDate)).getTime() === target);
}

function batchesRegisteredOnDate(date) {
  // Returns batches that were REGISTERED (prepared) on `date`
  const target = startOfDay(date).getTime();
  return state.batches
    .map(b => ({ batch: b, medium: getBatchMedium(b) }))
    .filter(({ medium, batch }) => medium && startOfDay(new Date(batch.prepDateTime)).getTime() === target);
}

function worstStatusForDate(date) {
  // Determines the most critical status affecting a date
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(date).getTime();
  const isPast = target < today;

  const renewing = batchesOnDate(date);
  const expiring = batchesExpiringOnDate(date);
  // Expiration is only marked as "expired" once we've actually passed
  // that day. On the day-of, it's just a normal renewal reminder.
  if (expiring.length > 0 && isPast) return 'expired';
  // Any renewal on or before today (urgent) or upcoming (soon) → red
  for (const { batch } of renewing) {
    const s = batchStatus(batch);
    if (s.code === 'urgent' || s.code === 'soon') return 'urgent';
  }
  if (renewing.length > 0) return 'urgent';
  if (batchesFertileOnDate(date).length > 0) return 'fert';
  if (batchesSterileOnDate(date).length > 0) return 'ster';
  return null;
}

function renderCalendar() {
  const grid    = document.getElementById('calendar-grid');
  const title   = document.getElementById('calendar-title');
  if (!grid || !title) return;

  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const cursor = _calCursor;
  title.textContent = `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const today = startOfDay(new Date());
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  // Monday = 0 ... Sunday = 6
  let firstWeekday = firstOfMonth.getDay() - 1;
  if (firstWeekday < 0) firstWeekday = 6;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const daysInPrev = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();

  grid.innerHTML = '';

  // Leading days from previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - 1, daysInPrev - i);
    const el = document.createElement('div');
    el.className = 'cal-day cal-out';
    el.textContent = d.getDate();
    grid.appendChild(el);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = day;

    const isToday = startOfDay(date).getTime() === today.getTime();
    if (isToday) el.classList.add('cal-today');

    // Status coloring: based on the date itself
    const status = worstStatusForDate(date);
    if (status === 'expired') el.classList.add('cal-expired');
    else if (status === 'urgent') el.classList.add('cal-urgent');

    // Dots: green = a lot was registered that day; red = renewal urgent/soon;
    // yellow = expired (past); grey = fertility/sterility result days.
    const dots = document.createElement('div');
    dots.className = 'cal-dots';
    const registered = batchesRegisteredOnDate(date);
    const renewing = batchesOnDate(date);
    const expiring = batchesExpiringOnDate(date);
    const fertile  = batchesFertileOnDate(date);
    const sterile  = batchesSterileOnDate(date);

    // Renewal / expiry severity dot — only shown when such activity exists on this day
    let severity = null;
    for (const { batch } of renewing) {
      const s = batchStatus(batch);
      if (s.code === 'urgent' || s.code === 'soon') { severity = 'urgent'; break; }
    }
    // Only show the expired dot once the day is in the past
    if (expiring.length > 0 && startOfDay(date).getTime() < today.getTime()) {
      severity = 'expired';
    }
    if (severity) {
      const dot = document.createElement('i');
      dot.className = 'cal-dot dot-' + severity;
      dots.appendChild(dot);
    }

    // Green "Conforme" dot — ONLY on days a lot was actually registered
    if (registered.length > 0) {
      const dot = document.createElement('i');
      dot.className = 'cal-dot dot-ok';
      dots.appendChild(dot);
    }

    if (fertile.length > 0) {
      const fd = document.createElement('i');
      fd.className = 'cal-dot';
      fd.style.background = 'var(--muted)';
      dots.appendChild(fd);
    }
    if (sterile.length > 0 && fertile.length === 0) {
      const sd = document.createElement('i');
      sd.className = 'cal-dot';
      sd.style.background = 'var(--muted)';
      dots.appendChild(sd);
    }
    if (dots.children.length > 0) el.appendChild(dots);

    // Make clickable if anything is happening on this day
    const total = registered.length + renewing.length + expiring.length + fertile.length + sterile.length;
    if (total > 0) {
      el.classList.add('cal-clickable');
      el.addEventListener('click', () => openDayDetails(date));
    }

    grid.appendChild(el);
  }

  // Trailing days to complete the last week
  const totalCells = grid.children.length;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() + 1, i);
    const el = document.createElement('div');
    el.className = 'cal-day cal-out';
    el.textContent = d.getDate();
    grid.appendChild(el);
  }
}

function openDayDetails(date) {
  const modal = document.getElementById('day-details-modal');
  const titleEl = document.getElementById('day-details-title');
  const subEl   = document.getElementById('day-details-sub');
  const list    = document.getElementById('day-details-list');
  if (!modal || !list) return;

  const registered = batchesRegisteredOnDate(date);
  const renewing = batchesOnDate(date);
  const expiring = batchesExpiringOnDate(date);
  const fertile  = batchesFertileOnDate(date);
  const sterile  = batchesSterileOnDate(date);

  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  titleEl.textContent = date.toLocaleDateString('fr-FR', opts);
  const parts = [];
  if (registered.length) parts.push(`${registered.length} enregistrement${registered.length > 1 ? 's' : ''}`);
  if (renewing.length) parts.push(`${renewing.length} renouvellement${renewing.length > 1 ? 's' : ''}`);
  if (expiring.length) parts.push(`${expiring.length} expiration${expiring.length > 1 ? 's' : ''}`);
  if (fertile.length)  parts.push(`${fertile.length} résultat${fertile.length > 1 ? 's' : ''} fertilité`);
  if (sterile.length)  parts.push(`${sterile.length} résultat${sterile.length > 1 ? 's' : ''} stérilité`);
  subEl.textContent = parts.length ? parts.join(' · ') : 'Aucun événement';

  const items = [];

  // Registered (prepared) on this day
  registered.forEach(({ batch, medium }) => {
    if (!medium) return;
    const isBroth = medium.type === 'broth';
    items.push(`
      <div class="day-detail-item">
        <div class="day-detail-head">
          <div>
            <div class="day-detail-name">${escapeHtml(medium.name)}</div>
            <div class="day-detail-meta">${escapeHtml(mediumStrainText(medium))}${batch.codeInterne ? ' · ' + escapeHtml(batch.codeInterne) : ''}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
          </div>
          <span class="day-detail-tag ${isBroth ? 'broth' : ''}">ENREGISTRÉ</span>
        </div>
        <div class="day-detail-grid">
          <div>
            <span class="lbl">Préparation</span>
            <span class="val">${fmtDateTime(batch.prepDateTime)}</span>
          </div>
          <div>
            <span class="lbl">Expiration</span>
            <span class="val">${fmtDate(batch.expiryDate)}</span>
          </div>
        </div>
      </div>
    `);
  });

  // Renewal items
  renewing.forEach(({ batch, medium }) => {
    if (!medium) return;
    const s = batchStatus(batch);
    const daysLeft = daysBetween(new Date(), batch.expiryDate);
    const isBroth = medium.type === 'broth';
    items.push(`
      <div class="day-detail-item ${s.cls}">
        <div class="day-detail-head">
          <div>
            <div class="day-detail-name">${escapeHtml(medium.name)}</div>
            <div class="day-detail-meta">${escapeHtml(mediumStrainText(medium))}${batch.codeInterne ? ' · ' + escapeHtml(batch.codeInterne) : ''}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
          </div>
          <span class="day-detail-tag ${isBroth ? 'broth' : ''}">${isBroth ? 'BOUILLON' : 'SOLIDE'}</span>
        </div>
        <div class="day-detail-grid">
          <div>
            <span class="lbl">Préparation</span>
            <span class="val">${fmtDateTime(batch.prepDateTime)}</span>
          </div>
          <div>
            <span class="lbl">Expiration</span>
            <span class="val ${s.code === 'urgent' ? 'alert-red' : daysLeft <= 7 ? 'alert' : ''}">${fmtDate(batch.expiryDate)}</span>
          </div>
          <div>
            <span class="lbl">Renouvellement</span>
            <span class="val">${fmtDate(batch.renewalAlertDate)}</span>
          </div>
          <div>
            <span class="lbl">Jours restants</span>
            <span class="val">${daysLeft < 0 ? 'Expiré' : daysLeft + ' j'}</span>
          </div>
        </div>
        <div class="day-detail-status">
          <span class="status-dot ${s.code === 'urgent' ? 'danger' : s.code === 'soon' ? 'warn' : s.code === 'expired' ? 'grey' : ''}"></span>
          <span>${escapeHtml(s.label)}</span>
        </div>
      </div>
    `);
  });

  // Expiry items
  expiring.forEach(({ batch, medium }) => {
    if (!medium) return;
    if (renewing.find(r => r.batch.id === batch.id)) return; // already shown
    const isBroth = medium.type === 'broth';
    items.push(`
      <div class="day-detail-item s-red">
        <div class="day-detail-head">
          <div>
            <div class="day-detail-name">${escapeHtml(medium.name)}</div>
            <div class="day-detail-meta">${escapeHtml(mediumStrainText(medium))}${batch.codeInterne ? ' · ' + escapeHtml(batch.codeInterne) : ''}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
          </div>
          <span class="day-detail-tag ${isBroth ? 'broth' : ''}">EXPIRE</span>
        </div>
        <div class="day-detail-grid">
          <div>
            <span class="lbl">Préparation</span>
            <span class="val">${fmtDateTime(batch.prepDateTime)}</span>
          </div>
          <div>
            <span class="lbl">Expiration</span>
            <span class="val alert-red">${fmtDate(batch.expiryDate)}</span>
          </div>
        </div>
      </div>
    `);
  });

  // Fertility result
  fertile.forEach(({ batch, medium }) => {
    if (!medium) return;
    const isBroth = medium.type === 'broth';
    items.push(`
      <div class="day-detail-item">
        <div class="day-detail-head">
          <div>
            <div class="day-detail-name">${escapeHtml(medium.name)}</div>
            <div class="day-detail-meta">${escapeHtml(mediumStrainText(medium))}${batch.codeInterne ? ' · ' + escapeHtml(batch.codeInterne) : ''}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
          </div>
          <span class="day-detail-tag ${isBroth ? 'broth' : ''}">FERTILITÉ</span>
        </div>
        <div class="day-detail-grid">
          <div>
            <span class="lbl">Préparation</span>
            <span class="val">${fmtDateTime(batch.prepDateTime)}</span>
          </div>
          <div>
            <span class="lbl">Expiration</span>
            <span class="val">${fmtDate(batch.expiryDate)}</span>
          </div>
        </div>
      </div>
    `);
  });

  // Sterility result
  sterile.forEach(({ batch, medium }) => {
    if (!medium) return;
    const isBroth = medium.type === 'broth';
    items.push(`
      <div class="day-detail-item">
        <div class="day-detail-head">
          <div>
            <div class="day-detail-name">${escapeHtml(medium.name)}</div>
            <div class="day-detail-meta">${escapeHtml(mediumStrainText(medium))}${batch.codeInterne ? ' · ' + escapeHtml(batch.codeInterne) : ''}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
          </div>
          <span class="day-detail-tag ${isBroth ? 'broth' : ''}">STÉRILITÉ</span>
        </div>
        <div class="day-detail-grid">
          <div>
            <span class="lbl">Préparation</span>
            <span class="val">${fmtDateTime(batch.prepDateTime)}</span>
          </div>
          <div>
            <span class="lbl">Stérilité</span>
            <span class="val">${fmtDateTime(batch.sterilityResultDate)}</span>
          </div>
        </div>
      </div>
    `);
  });

  if (items.length === 0) {
    list.innerHTML = `<div class="day-detail-empty">Aucun lot enregistré pour cette date.</div>`;
  } else {
    list.innerHTML = items.join('');
  }

  modal.classList.remove('hidden');
}

function closeDayDetails() {
  const modal = document.getElementById('day-details-modal');
  if (modal) modal.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);

