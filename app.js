/* ============================================================
   MilieuXlab — app.js
   State · Calculations · Rendering · localStorage
   ============================================================ */

const STORAGE = {
  BATCHES: 'milieuxlab.batches.v1',
  MEDIA:   'milieuxlab.media.v1',
  SETTINGS:'milieuxlab.settings.v1',
};

const BUFFER_DAYS = 2;
const SHELF_LIFE = { solid: 30, broth: 15 };
const THEME_KEY = 'milieuxlab.theme.v1';
const NOTIF_POLL_MS = 5 * 60 * 1000;  // re-check every 5 minutes

const DEFAULT_MEDIA = [
  { id: 'm_tsa',       name: 'TSA',                          type: 'solid', strain: 'S. aureus ATCC 6538',         fertilityDelayDays: 5, sterilityFormat: 'days',  sterilityValue: 5, isDefault: true },
  { id: 'm_macconkey', name: 'MacConkey Agar',               type: 'solid', strain: 'E. coli ATCC 8739',           fertilityDelayDays: 2, sterilityFormat: 'range', sterilityMinHours: 18, sterilityMaxHours: 72, isDefault: true },
  { id: 'm_sabouraud', name: 'Sabouraud',                    type: 'solid', strain: 'C. albicans ATCC 10231',      fertilityDelayDays: 5, sterilityFormat: 'days',  sterilityValue: 5, isDefault: true },
  { id: 'm_mh',        name: 'Mueller-Hinton',               type: 'solid', strain: 'S. aureus ATCC 25923',        fertilityDelayDays: 3, sterilityFormat: 'days',  sterilityValue: 5, isDefault: true },
  { id: 'm_tsb',       name: 'TSB (Tryptic Soy Broth)',      type: 'broth', strain: 'S. aureus ATCC 6538',         fertilityDelayDays: 5, sterilityFormat: 'days',  sterilityValue: 14, isDefault: true },
  { id: 'm_bhi',       name: 'BHI (Brain Heart Infusion)',   type: 'broth', strain: 'S. aureus ATCC 6538',         fertilityDelayDays: 5, sterilityFormat: 'days',  sterilityValue: 14, isDefault: true },
  { id: 'm_xld',       name: 'XLD Agar',                     type: 'solid', strain: 'Salmonella typhimurium',      fertilityDelayDays: 2, sterilityFormat: 'range', sterilityMinHours: 18, sterilityMaxHours: 24, isDefault: true },
  { id: 'm_pbs',       name: 'Phosphate Buffer Solution',   type: 'broth', strain: 'E. coli ATCC 8739',           fertilityDelayDays: 2, sterilityFormat: 'range', sterilityMinHours: 18, sterilityMaxHours: 24, isDefault: true },
];

const DEFAULT_SETTINGS = { browserNotifications: false, showExpired: false, labName: '' };

/* ============================================================
   STATE
   ============================================================ */

const state = {
  batches: [],
  media: [],
  settings: { ...DEFAULT_SETTINGS },
  currentView: 'dashboard',
};

function loadState() {
  try {
    const m = localStorage.getItem(STORAGE.MEDIA);
    state.media = m ? JSON.parse(m) : [...DEFAULT_MEDIA];
    // Ensure all defaults are present (in case older storage)
    DEFAULT_MEDIA.forEach(dm => {
      if (!state.media.find(x => x.id === dm.id)) state.media.unshift(dm);
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
  }
}

function persist() {
  localStorage.setItem(STORAGE.MEDIA, JSON.stringify(state.media));
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
  const expiry = addDays(startOfDay(prep), SHELF_LIFE[medium.type]);
  const renewalAlert = addDays(startOfDay(expiry), -(medium.fertilityDelayDays + BUFFER_DAYS));
  return { fertilityResult, sterilityResult, expiry, renewalAlert };
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
    if (s.code === 'expired')  alerts.push({ cls: 'd-red',    msg: 'EXPIRE AUJOURD\'HUI', medium: medium.name, batch: b });
    else if (s.code === 'urgent')  alerts.push({ cls: 'd-red',    msg: 'Renouvellement requis', medium: medium.name, batch: b });
    else if (s.code === 'soon')    alerts.push({ cls: 'd-orange', msg: `Expire ${fmtRelativeDays(daysBetween(now, b.expiryDate))}`, medium: medium.name, batch: b });
    else if (s.code === 'fert-today') alerts.push({ cls: 'd-yellow', msg: 'Résultat fertilité attendu', medium: medium.name, batch: b });
    else if (s.code === 'ster-today') alerts.push({ cls: 'd-yellow', msg: 'Résultat stérilité attendu', medium: medium.name, batch: b });
  });

  const banner = document.getElementById('alerts-banner');
  if (alerts.length === 0) {
    banner.innerHTML = '';
    banner.className = '';
  } else {
    banner.className = 'alerts-banner';
    banner.innerHTML = `
      <div class="alerts-banner-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        Alertes du jour (${alerts.length})
      </div>
      ${alerts.map(a => `
        <div class="alert-item ${a.cls}">
          <span class="alert-dot"></span>
          <span class="alert-medium"><b>${escapeHtml(a.medium)}</b>${a.batch.lotNumber ? ' · ' + escapeHtml(a.batch.lotNumber) : ''}</span>
          <span class="alert-msg">${a.msg}</span>
        </div>
      `).join('')}
    `;
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
            <span>${escapeHtml(medium.strain)}</span>${batch.lotNumber ? '<span style="opacity:0.5">·</span><span>' + escapeHtml(batch.lotNumber) + '</span>' : ''}
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

  updatePreview();
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
  sub.textContent = `${escapeHtml(medium.name)} · ${medium.type === 'solid' ? '30 jours' : '15 jours'}`;
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
    return `
      <div class="media-card ${isBroth ? 'broth' : ''}">
        <div class="media-head">
          <div class="media-name">${escapeHtml(m.name)}</div>
          <span class="tag ${isBroth ? 'broth' : ''}">${m.isDefault ? 'DÉFAUT' : 'PERSO'}</span>
        </div>
        <div class="media-grid">
          <div>
            <span class="lbl">Type</span>
            <span class="val">${m.type === 'solid' ? 'Solide · 30 j' : 'Bouillon · 15 j'}</span>
          </div>
          <div>
            <span class="lbl">Fertilité</span>
            <span class="val">${m.fertilityDelayDays} jour${m.fertilityDelayDays > 1 ? 's' : ''}</span>
          </div>
          <div style="grid-column: 1/-1">
            <span class="lbl">Souche</span>
            <span class="val">${escapeHtml(m.strain)}</span>
          </div>
          <div style="grid-column: 1/-1">
            <span class="lbl">Stérilité</span>
            <span class="val blue">${getSterilityDisplay(m)}</span>
          </div>
        </div>
        <div class="media-foot">
          <button class="icon-btn" data-medit="${m.id}">Modifier</button>
          ${m.isDefault ? '' : `<button class="icon-btn danger" data-mdel="${m.id}">Supprimer</button>`}
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
    document.getElementById('m-type').value = medium.type;
    document.getElementById('m-strain').value = medium.strain;
    document.getElementById('m-fert').value = medium.fertilityDelayDays;
    const fmt = medium.sterilityFormat;
    document.querySelector(`input[name="m-fmt"][value="${fmt}"]`).checked = true;
    if (fmt === 'range') {
      document.getElementById('m-min').value = medium.sterilityMinHours || '';
      document.getElementById('m-max').value = medium.sterilityMaxHours || '';
    } else {
      document.getElementById('m-single').value = medium.sterilityValue || '';
    }
    updateMediaFormFields();
  } else {
    title.textContent = 'Nouveau milieu';
    form.reset();
    document.getElementById('m-id').value = '';
    document.querySelector('input[name="m-fmt"][value="days"]').checked = true;
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
  const strain = document.getElementById('m-strain').value.trim();
  const fert = parseInt(document.getElementById('m-fert').value, 10);
  const fmt = document.querySelector('input[name="m-fmt"]:checked').value;
  if (!name || !strain || isNaN(fert) || fert < 0) return toast('Veuillez remplir tous les champs.', 'error');

  const data = { name, type, strain, fertilityDelayDays: fert, sterilityFormat: fmt, isDefault: false };
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

  if (id) {
    const existing = state.media.find(m => m.id === id);
    if (existing) Object.assign(existing, data);
  } else {
    data.id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    state.media.push(data);
  }
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
  if (!m || m.isDefault) return;
  confirmAction(`Supprimer "${m.name}" ?`, 'Ce milieu personnalisé sera supprimé définitivement.', () => {
    state.media = state.media.filter(x => x.id !== id);
    persist();
    renderMedia();
    toast('Milieu supprimé.', 'success');
  });
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
    size: 'A4', orientation: 'portrait',
    margin: { top: 42, right: 42, bottom: 51, left: 42 },
  });
  const PW = pdf.w;
  const M = pdf.margin.left;
  const contentW = PW - 2 * M;

  // ----- HEADER -----
  pdf.text(labName, M, 60, { size: 14, bold: true });
  pdf.text('Planning de renouvellement', PW - M, 60, { size: 9, color: '#5A7A99', align: 'right' });
  pdf.text('Généré le ' + genDate, PW - M, 75, { size: 9, color: '#0A0E14', align: 'right' });
  pdf.line(M, 90, PW - M, 90, { color: '#0A0E14', width: 1.5 });

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
  // Column widths sized to fit BOTH headers (7pt bold) AND data (9pt regular).
  // No safety margin — the columns are wide enough that real Helvetica glyphs
  // fit comfortably with room to spare. (Real Helvetica may be ~10% wider than
  // AFM nominal, so we aim for text being ~70-80% of available width.)
  // Total content area is 510pt (page width 595 - margins 42*2).
  // Distribution: wider Milieu (for BHI Chocolat etc.) and wider Jours (for aujourd'hui)
  // (75, 75, 65, 65, 80, 65, 85) = 510
  const tableY = 230;
  const widths = [75, 75, 65, 65, 80, 65, 85];  // sums to 510
  const t = pdf.table({ x: M, y: tableY, widths, rowHeight: 18, headerHeight: 24, headerRepeat: true });
  t.header(
    ['Milieu', 'N° de lot', 'Préparation', 'Péremption', 'Renouvellement', 'Jours', 'Statut'],
    { bg: '#E2E8F0', textColor: '#0A0E14', bold: true, size: 7 }
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
      const bg = ps.bucket === 'expired' ? '#FEE2E2'
              : ps.bucket === 'urgent'  ? '#FEF3C7'
              : (i % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
      const fg = ps.bucket === 'expired' ? '#7F1D1D'
              : ps.bucket === 'urgent'  ? '#78350F'
              : '#0A0E14';
      t.row([
        r.medium.name,
        r.batch.lotNumber || '—',
        fmtDate(r.batch.prepDateTime),
        fmtDate(r.batch.expiryDate),
        fmtDate(r.batch.renewalAlertDate),
        formatDays(days),
        ps.label,
      ], { bg, textColor: fg });
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

  // Navigation
  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => go(btn.dataset.go));
  });

  // Theme toggle
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Register form
  document.getElementById('batch-form').addEventListener('submit', saveBatch);
  ['f-medium','f-date','f-time'].forEach(id => {
    document.getElementById(id).addEventListener('change', updatePreview);
    document.getElementById(id).addEventListener('input', updatePreview);
  });

  // Media form
  document.getElementById('btn-add-media').addEventListener('click', () => showMediaForm(null));
  document.getElementById('media-form-close').addEventListener('click', () => document.getElementById('media-form-wrap').classList.add('hidden'));
  document.querySelectorAll('input[name="m-fmt"]').forEach(r => r.addEventListener('change', updateMediaFormFields));
  document.getElementById('media-form').addEventListener('submit', saveMedia);

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
    if (editId) editMedia(editId);
    if (delId)  deleteMedia(delId);
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
    // Without this, the browser only checks for SW updates every ~24h or
    // on a hard reload — which means a fresh deploy isn't detected.
    const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    // Explicitly ask the browser to look for a new SW right now
    try { await reg.update(); } catch (e) { /* offline — fine */ }

    // If a new SW is already waiting, show the refresh toast immediately
    if (reg.waiting) {
      promptRefreshToUpdate(reg.waiting);
    }
    // Otherwise, watch for a new SW to install
    reg.addEventListener('updatefound', () => {
      const newSw = reg.installing;
      if (!newSw) return;
      newSw.addEventListener('statechange', () => {
        if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
          promptRefreshToUpdate(newSw);
        }
      });
    });

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

function promptRefreshToUpdate(sw) {
  // Show a 6-second toast. If the user clicks it OR the timeout fires,
  // tell the SW to skip waiting and reload.
  let activated = false;
  const activate = () => {
    if (activated) return;
    activated = true;
    if (sw) sw.postMessage({ type: 'SKIP_WAITING' });
  };
  // Use a long-duration toast for visibility
  if (typeof toast === 'function') {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = 'Nouvelle version disponible — appuyez pour actualiser.';
      t.className = 'toast show';
      t.style.cursor = 'pointer';
      t.style.pointerEvents = 'auto';
      t.onclick = () => { activate(); window.location.reload(); };
    }
  }
  // Auto-activate after 6s
  setTimeout(() => {
    if (!activated) {
      activate();
      window.location.reload();
    }
  }, 6000);
}

// When the new SW takes over, the page is no longer controlled by the old one.
// Reload automatically so the user sees the latest version (even if they
// ignored the toast).
let _reloadingOnSWChange = false;
navigator.serviceWorker && navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (_reloadingOnSWChange) return;
  _reloadingOnSWChange = true;
  window.location.reload();
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

    // Dots: renewal (urgent = red, soon = blue, ok = green), expiry (orange), fertility/sterility (small grey)
    const dots = document.createElement('div');
    dots.className = 'cal-dots';
    const renewing = batchesOnDate(date);
    const expiring = batchesExpiringOnDate(date);
    const fertile  = batchesFertileOnDate(date);
    const sterile  = batchesSterileOnDate(date);

    let worst = 'ok';
    for (const { batch } of renewing) {
      const s = batchStatus(batch);
      if (s.code === 'urgent' || s.code === 'soon') { worst = 'urgent'; break; }
    }
    // Only show expired dot if the day is in the past
    if (expiring.length > 0 && startOfDay(date).getTime() < today.getTime()) {
      worst = 'expired';
    }
    const dot = document.createElement('i');
    dot.className = 'cal-dot dot-' + worst;
    dots.appendChild(dot);

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
    const total = renewing.length + expiring.length + fertile.length + sterile.length;
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

  const renewing = batchesOnDate(date);
  const expiring = batchesExpiringOnDate(date);
  const fertile  = batchesFertileOnDate(date);
  const sterile  = batchesSterileOnDate(date);

  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  titleEl.textContent = date.toLocaleDateString('fr-FR', opts);
  const parts = [];
  if (renewing.length) parts.push(`${renewing.length} renouvellement${renewing.length > 1 ? 's' : ''}`);
  if (expiring.length) parts.push(`${expiring.length} expiration${expiring.length > 1 ? 's' : ''}`);
  if (fertile.length)  parts.push(`${fertile.length} résultat${fertile.length > 1 ? 's' : ''} fertilité`);
  if (sterile.length)  parts.push(`${sterile.length} résultat${sterile.length > 1 ? 's' : ''} stérilité`);
  subEl.textContent = parts.length ? parts.join(' · ') : 'Aucun événement';

  const items = [];

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
            <div class="day-detail-meta">${escapeHtml(medium.strain)}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
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
            <div class="day-detail-meta">${escapeHtml(medium.strain)}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
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
            <div class="day-detail-meta">${escapeHtml(medium.strain)}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
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
            <div class="day-detail-meta">${escapeHtml(medium.strain)}${batch.lotNumber ? ' · ' + escapeHtml(batch.lotNumber) : ''}</div>
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

