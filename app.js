const API = ''; // same origin
let token = localStorage.getItem('bsr_token') || '';
let currentUser = null;
let workersCache = [];
let jobsCache = [];
let appsCache = [];
let settingsCache = {};

const DEFAULT_SKILLS = [
  'Carpentry','Masonry','Electrical','Plumbing','Welding','Painting','Roofing',
  'Tile Setting','Steel Works','Aircon Repair','Appliance Repair','Automotive / Mechanic',
  'Motorcycle Repair','Driving','Caregiving','Housekeeping','Cooking / Catering',
  'Sewing / Tailoring','Hairdressing / Barber','Massage Therapy','Landscaping / Gardening',
  'Farming','Computer / IT Support','Teaching / Tutoring','Security Guard',
  'Construction Labor','Delivery / Logistics','Beauty Services','Child Care','Elderly Care'
];

// ---------- Auth helpers ----------
function authHeaders() {
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    logout();
    throw new Error(data.error || 'Session expired');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------- Login / Logout ----------
function showAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabReg = document.getElementById('tabRegister');
  if (tab === 'register') {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
  } else {
    regForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    tabReg.classList.remove('active');
    tabLogin.classList.add('active');
  }
  document.getElementById('loginError').textContent = '';
  document.getElementById('registerError').textContent = '';
  document.getElementById('registerSuccess').textContent = '';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const res = await fetch(API + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('loginUser').value.trim(),
        password: document.getElementById('loginPass').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('bsr_token', token);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('registerError');
  const okEl = document.getElementById('registerSuccess');
  errEl.textContent = '';
  okEl.textContent = '';
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  const full_name = document.getElementById('regName').value.trim();
  const contact = document.getElementById('regContact').value.trim();
  const address = document.getElementById('regAddress').value.trim();
  const skills = (document.getElementById('regSkills').value || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!document.getElementById('regConsent').checked) {
    errEl.textContent = 'Please agree to the consent checkbox.';
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    return;
  }
  try {
    const res = await fetch(API + '/api/register-public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, full_name, contact, address, skills, consent_given: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    okEl.textContent = 'Account created! You can now login with username: ' + (data.username || username);
    document.getElementById('regPass').value = '';
    setTimeout(() => {
      showAuthTab('login');
      // Use exact username saved by server (lowercase)
      document.getElementById('loginUser').value = data.username || username.toLowerCase();
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
    }, 800);
  } catch (err) {
    errEl.textContent = err.message;
  }
});

function logout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('bsr_token');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  showAuthTab('login');
}

async function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  try {
    currentUser = await api('/api/me');
  } catch (e) {
    logout();
    return;
  }
  document.getElementById('userInfo').textContent =
    `${currentUser.full_name} • ${currentUser.role === 'admin' ? 'Administrator' : 'Worker'}`;
  buildNav();
  await loadSettings();
  document.getElementById('brgyTitle').textContent = settingsCache.brgy_name || 'Barangay Skills Registry';
  showPanel('dashboard');
  await refreshDashboard();
}

function buildNav() {
  const nav = document.getElementById('nav');
  const isAdmin = currentUser.role === 'admin';
  const items = [
    { id: 'dashboard', label: 'Dashboard' },
    ...(isAdmin ? [{ id: 'workers', label: 'Workers' }] : []),
    { id: 'jobs', label: 'Jobs' },
    { id: 'applications', label: 'Applications' },
    { id: 'profile', label: 'My Profile' },
    ...(isAdmin ? [{ id: 'settings', label: 'Settings' }] : [])
  ];
  nav.innerHTML = items.map(i =>
    `<button data-panel="${i.id}" onclick="showPanel('${i.id}')">${i.label}</button>`
  ).join('');
}

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-' + id).classList.remove('hidden');
  document.querySelectorAll('.nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === id);
  });
  if (id === 'workers') loadWorkers();
  if (id === 'jobs') loadJobs();
  if (id === 'applications') loadApplications();
  if (id === 'profile') loadProfile();
  if (id === 'dashboard') refreshDashboard();
  if (id === 'settings') fillSettingsForm();
}

// ---------- Dashboard ----------
async function refreshDashboard() {
  try {
    const stats = await api('/api/stats');
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="num">${stats.totalWorkers}</div><div class="label">Workers</div></div>
      <div class="stat-card"><div class="num">${stats.available}</div><div class="label">Available</div></div>
      <div class="stat-card"><div class="num">${stats.openJobs}</div><div class="label">Open Jobs</div></div>
      <div class="stat-card"><div class="num">${stats.pendingApps}</div><div class="label">Pending Apps</div></div>
      <div class="stat-card"><div class="num">${stats.withCerts}</div><div class="label">With Certs</div></div>
    `;
    const qa = document.getElementById('quickActions');
    if (currentUser.role === 'admin') {
      qa.innerHTML = `
        <button class="btn btn-primary" onclick="showPanel('workers'); openCreateWorker()">Add Worker</button>
        <button class="btn btn-primary" onclick="showPanel('jobs'); openJobModal()">Create Job</button>
        <button class="btn btn-secondary" onclick="showPanel('applications')">Review Applications</button>
        <a class="btn btn-secondary" href="consent-form.html" target="_blank">Consent Form</a>
        <button class="btn btn-secondary" onclick="exportCsv('workers')">📥 Export Workers CSV</button>
        <button class="btn btn-secondary" onclick="exportCsv('jobs')">📥 Export Jobs CSV</button>
        <button class="btn btn-secondary" onclick="exportCsv('applications')">📥 Export Applications CSV</button>
      `;
    } else {
      qa.innerHTML = `
        <button class="btn btn-primary" onclick="showPanel('jobs')">Browse Open Jobs</button>
        <button class="btn btn-secondary" onclick="showPanel('applications')">My Applications</button>
        <button class="btn btn-secondary" onclick="showPanel('profile')">Update Status</button>
      `;
    }
    // My status box
    const box = document.getElementById('myStatusBox');
    if (currentUser.role === 'worker' && currentUser.profile) {
      const p = currentUser.profile;
      box.innerHTML = `
        <p><strong>Status:</strong> <span class="badge badge-${(p.status||'').toLowerCase()}">${p.status || '—'}</span></p>
        <p style="margin-top:0.4rem;"><strong>Position:</strong> ${esc(p.work_position || '—')}</p>
        <p><strong>Schedule:</strong> ${esc(p.work_schedule || '—')}</p>
        <button class="btn btn-sm btn-secondary" style="margin-top:0.6rem;" onclick="showPanel('profile')">Edit Profile</button>
      `;
    } else {
      box.innerHTML = `<p style="color:var(--muted);">Administrator account</p>`;
    }
  } catch (e) {
    console.error(e);
  }
}

// ---------- Workers (Admin) ----------
async function loadWorkers() {
  workersCache = await api('/api/workers');
  renderWorkers();
}

function renderWorkers() {
  const q = (document.getElementById('workerSearch').value || '').toLowerCase();
  const st = document.getElementById('workerStatusFilter').value;
  let list = workersCache.filter(w => {
    const matchQ = !q || w.full_name.toLowerCase().includes(q) ||
      (w.contact || '').includes(q) ||
      (w.skills || []).some(s => s.toLowerCase().includes(q));
    const matchS = !st || w.status === st;
    return matchQ && matchS;
  });
  const body = document.getElementById('workersBody');
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">No workers found</td></tr>`;
    return;
  }
  body.innerHTML = list.map(w => `
    <tr>
      <td>${w.profile_picture
        ? `<img class="avatar" src="${esc(w.profile_picture)}" alt="" />`
        : `<div class="avatar">${(w.full_name||'?')[0]}</div>`}</td>
      <td><strong>${esc(w.full_name)}</strong><br><small>${esc(w.username)}</small></td>
      <td>${(w.skills || []).map(s => `<span class="tag">${esc(s)}</span>`).join('') || '—'}</td>
      <td><span class="badge badge-${(w.status||'').toLowerCase()}">${esc(w.status)}</span></td>
      <td><small>${esc(w.work_position || '—')}<br>${esc(w.work_schedule || '')}</small></td>
      <td>${esc(w.contact || '—')}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewWorker('${w.id}')">View</button>
        <button class="btn btn-sm btn-danger" onclick="deleteWorker('${w.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openCreateWorker() {
  document.getElementById('modalContent').innerHTML = `
    <h3>Create Worker Account</h3>
    <div class="form-row two">
      <div><label>Username *</label><input id="cwUser" /></div>
      <div><label>Password *</label><input type="password" id="cwPass" /></div>
    </div>
    <div class="form-row"><label>Full Name *</label><input id="cwName" /></div>
    <div class="form-row two">
      <div><label>Contact</label><input id="cwContact" /></div>
      <div><label>Email</label><input id="cwEmail" /></div>
    </div>
    <div class="form-row"><label>Address</label><input id="cwAddress" /></div>
    <div class="form-row"><label>Initial Skills (comma-separated)</label><input id="cwSkills" placeholder="Carpentry, Plumbing" /></div>
    <div class="btn-group">
      <button class="btn btn-primary" onclick="submitCreateWorker()">Create Account</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;
  openModal();
}

async function submitCreateWorker() {
  try {
    const skills = (document.getElementById('cwSkills').value || '').split(',').map(s => s.trim()).filter(Boolean);
    await api('/api/register-worker', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('cwUser').value.trim(),
        password: document.getElementById('cwPass').value,
        full_name: document.getElementById('cwName').value.trim(),
        contact: document.getElementById('cwContact').value.trim(),
        email: document.getElementById('cwEmail').value.trim(),
        address: document.getElementById('cwAddress').value.trim(),
        skills
      })
    });
    closeModal();
    loadWorkers();
    alert('Worker account created. Share the username and password with the worker.');
  } catch (e) {
    alert(e.message);
  }
}

async function deleteWorker(id) {
  if (!confirm('Permanently delete this worker account?')) return;
  try {
    await api('/api/workers/' + id, { method: 'DELETE' });
    loadWorkers();
  } catch (e) { alert(e.message); }
}

async function viewWorker(id) {
  try {
    const w = await api('/api/workers/' + id);
    document.getElementById('modalContent').innerHTML = `
      <h3>${esc(w.full_name)}</h3>
      <div style="text-align:center;margin-bottom:1rem;">
        ${w.profile_picture ? `<img src="${esc(w.profile_picture)}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;" />` : ''}
      </div>
      <p><strong>Username:</strong> ${esc(w.username)}</p>
      <p><strong>Contact:</strong> ${esc(w.contact || '—')}</p>
      <p><strong>Address:</strong> ${esc(w.address || '—')}</p>
      <p><strong>Status:</strong> <span class="badge badge-${(w.status||'').toLowerCase()}">${esc(w.status)}</span></p>
      <p><strong>Position:</strong> ${esc(w.work_position || '—')}</p>
      <p><strong>Schedule:</strong> ${esc(w.work_schedule || '—')}</p>
      <p><strong>Skills:</strong> ${(w.skills||[]).map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</p>
      <p><strong>Experience:</strong> ${w.experience_years || 0} years</p>
      <p><strong>Certifications:</strong> ${esc(w.certifications || '—')}</p>
      <p><strong>Consent:</strong> ${w.consent_given ? 'Yes' : 'No'}</p>
      <div class="btn-group" style="margin-top:1rem;">
        ${currentUser.role === 'admin' ? `<button class="btn btn-primary" onclick="openAssignModal(null,'${w.id}')">Assign to Open Job</button>` : ''}
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    `;
    openModal();
  } catch (e) { alert(e.message); }
}

// ---------- Jobs ----------
async function loadJobs() {
  jobsCache = await api('/api/jobs');
  if (currentUser.role === 'worker') {
    try { appsCache = await api('/api/applications'); } catch (e) { /* ignore */ }
  }
  const isAdmin = currentUser.role === 'admin';
  document.getElementById('btnAddJob').style.display = isAdmin ? 'inline-flex' : 'none';
  const exp = document.getElementById('btnExportJobs');
  if (exp) exp.style.display = isAdmin ? 'inline-flex' : 'none';
  renderJobs();
}

function renderJobs() {
  const q = (document.getElementById('jobSearch').value || '').toLowerCase();
  const st = document.getElementById('jobStatusFilter').value;
  let list = jobsCache.filter(j => {
    const matchQ = !q || j.title.toLowerCase().includes(q) ||
      (j.skills_needed || []).some(s => s.toLowerCase().includes(q));
    const matchS = !st || j.status === st;
    return matchQ && matchS;
  });
  const body = document.getElementById('jobsBody');
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty">No jobs found</td></tr>`;
    return;
  }
  const myApps = (appsCache || []).filter(a => a.status === 'Pending' || a.status === 'Accepted');
  body.innerHTML = list.map(j => {
    const myApp = myApps.find(a => a.job_id === j.id || a.job_title === j.title);
    let action = '—';
    if (currentUser.role === 'admin') {
      action = `
          <button class="btn btn-sm btn-secondary" onclick="openJobModal('${j.id}')">Edit</button>
          <button class="btn btn-sm btn-primary" onclick="showMatches('${j.id}')">Matches / Assign</button>
          <button class="btn btn-sm btn-secondary" onclick="openAssignModal('${j.id}')">Assign</button>
          <button class="btn btn-sm btn-danger" onclick="deleteJob('${j.id}')">Delete</button>`;
    } else if (j.status === 'Open') {
      if (myApp) {
        action = `<span class="badge badge-${myApp.status.toLowerCase()}">${esc(myApp.status)}</span>`;
      } else {
        action = `<button class="btn btn-sm btn-primary" onclick="applyToJob('${j.id}')">Apply / Book</button>`;
      }
    }
    return `
    <tr>
      <td><strong>${esc(j.title)}</strong><br><small>${esc(j.location || '')}</small></td>
      <td>${(j.skills_needed || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</td>
      <td>${esc(j.requester_name)}<br><small>${esc(j.requester_contact)}</small></td>
      <td><small>${esc(j.schedule_date || '—')} ${esc(j.schedule_time || '')}</small></td>
      <td><span class="badge badge-${(j.status||'').toLowerCase()}">${esc(j.status)}</span></td>
      <td>${action}</td>
    </tr>`;
  }).join('');
}

function openJobModal(id = null) {
  const j = id ? jobsCache.find(x => x.id === id) : null;
  document.getElementById('modalContent').innerHTML = `
    <h3>${j ? 'Edit Job' : 'Create Job / Service Request'}</h3>
    <input type="hidden" id="jobEditId" value="${j ? j.id : ''}" />
    <div class="form-row"><label>Title *</label><input id="jTitle" value="${esc(j?.title || '')}" /></div>
    <div class="form-row"><label>Description</label><textarea id="jDesc" rows="2">${esc(j?.description || '')}</textarea></div>
    <div class="form-row"><label>Skills Needed (comma-separated) *</label>
      <input id="jSkills" value="${esc((j?.skills_needed || []).join(', '))}" placeholder="Carpentry, Masonry" /></div>
    <div class="form-row two">
      <div><label>Requester Name *</label><input id="jRequester" value="${esc(j?.requester_name || '')}" /></div>
      <div><label>Contact *</label><input id="jContact" value="${esc(j?.requester_contact || '')}" /></div>
    </div>
    <div class="form-row"><label>Location</label><input id="jLocation" value="${esc(j?.location || '')}" /></div>
    <div class="form-row two">
      <div><label>Urgency</label>
        <select id="jUrgency">
          <option ${j?.urgency==='Normal'?'selected':''}>Normal</option>
          <option ${j?.urgency==='Urgent'?'selected':''}>Urgent</option>
          <option ${j?.urgency==='Flexible'?'selected':''}>Flexible</option>
        </select>
      </div>
      <div><label>Status</label>
        <select id="jStatus">
          <option ${j?.status==='Open'?'selected':''}>Open</option>
          <option ${j?.status==='Filled'?'selected':''}>Filled</option>
          <option ${j?.status==='Closed'?'selected':''}>Closed</option>
        </select>
      </div>
    </div>
    <div class="form-row two">
      <div><label>Schedule Date</label><input type="date" id="jDate" value="${esc(j?.schedule_date || '')}" /></div>
      <div><label>Schedule Time</label><input type="text" id="jTime" value="${esc(j?.schedule_time || '')}" placeholder="e.g. 8:00 AM" /></div>
    </div>
    <div class="btn-group">
      <button class="btn btn-primary" onclick="saveJob()">${j ? 'Update' : 'Create'} Job</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;
  openModal();
}

async function saveJob() {
  const id = document.getElementById('jobEditId').value;
  const payload = {
    title: document.getElementById('jTitle').value.trim(),
    description: document.getElementById('jDesc').value.trim(),
    skills_needed: document.getElementById('jSkills').value.split(',').map(s => s.trim()).filter(Boolean),
    requester_name: document.getElementById('jRequester').value.trim(),
    requester_contact: document.getElementById('jContact').value.trim(),
    location: document.getElementById('jLocation').value.trim(),
    urgency: document.getElementById('jUrgency').value,
    status: document.getElementById('jStatus').value,
    schedule_date: document.getElementById('jDate').value || null,
    schedule_time: document.getElementById('jTime').value.trim() || null
  };
  try {
    if (id) {
      await api('/api/jobs/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/jobs', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    loadJobs();
  } catch (e) { alert(e.message); }
}

async function deleteJob(id) {
  if (!confirm('Delete this job?')) return;
  try {
    await api('/api/jobs/' + id, { method: 'DELETE' });
    loadJobs();
  } catch (e) { alert(e.message); }
}

async function showMatches(jobId) {
  try {
    const data = await api('/api/jobs/' + jobId + '/matches');
    const matches = data.matches || [];
    window._matchJobId = jobId;
    document.getElementById('modalContent').innerHTML = `
      <h3>Matching Workers — ${esc(data.job.title)}</h3>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem;">
        Ranked by skill match. Click <strong>Assign</strong> to place a worker on this job (marks job Filled and worker Busy).
      </p>
      ${matches.length === 0 ? '<p class="empty">No available workers match these skills.<br>Workers must be status <strong>Available</strong> and share at least one required skill.</p>' : `
        <table>
          <thead><tr><th>Match</th><th>Worker</th><th>Skills</th><th>Exp</th><th>Contact</th><th>Action</th></tr></thead>
          <tbody>
            ${matches.map(m => `
              <tr>
                <td><strong style="color:var(--success)">${m.score}%</strong></td>
                <td>${esc(m.full_name)}</td>
                <td>${(m.skills||[]).map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</td>
                <td>${m.experience_years || 0}y</td>
                <td>${esc(m.contact || '—')}</td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="assignWorkerToJob('${jobId}','${m.id}','${esc(m.full_name).replace(/'/g, "\\'")}')">Assign</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
      <div class="btn-group" style="margin-top:1rem;">
        <button class="btn btn-secondary" onclick="openAssignModal('${jobId}')">Assign any worker…</button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    `;
    openModal();
  } catch (e) { alert(e.message); }
}

async function assignWorkerToJob(jobId, workerId, workerName) {
  const label = workerName || 'this worker';
  if (!confirm(`Assign ${label} to this job?\n\nThis will:\n• Accept the booking\n• Mark the job as Filled\n• Set worker status to Busy`)) return;
  try {
    await api('/api/applications', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, worker_id: workerId, auto_accept: true, message: 'Assigned by admin' })
    });
    alert('Worker assigned successfully.');
    closeModal();
    loadJobs();
    loadApplications();
    if (typeof loadWorkers === 'function') loadWorkers();
    refreshDashboard();
  } catch (e) { alert(e.message); }
}

async function openAssignModal(presetJobId = null, presetWorkerId = null) {
  try {
    const [jobs, workers] = await Promise.all([
      api('/api/jobs?status=Open'),
      api('/api/workers')
    ]);
    const openJobs = (jobs || []).filter(j => j.status === 'Open');
    const available = (workers || []).filter(w => w.status === 'Available' || true);
    if (!openJobs.length) {
      alert('No open jobs available. Create a job first.');
      return;
    }
    if (!available.length) {
      alert('No workers in the registry.');
      return;
    }
    document.getElementById('modalContent').innerHTML = `
      <h3>Assign Worker to Job</h3>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem;">
        Choose an open job and a worker. Assignment accepts the booking immediately.
      </p>
      <div class="form-row">
        <label>Open Job *</label>
        <select id="assignJobId">
          ${openJobs.map(j => `<option value="${j.id}" ${presetJobId===j.id?'selected':''}>${esc(j.title)} (${(j.skills_needed||[]).join(', ')})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Worker *</label>
        <select id="assignWorkerId">
          ${available.map(w => `<option value="${w.id}" ${presetWorkerId===w.id?'selected':''}>${esc(w.full_name)} — ${esc(w.status)} — ${(w.skills||[]).slice(0,3).join(', ')}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Note (optional)</label>
        <input type="text" id="assignNote" placeholder="Assigned by barangay admin" />
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="submitAssign()">Assign Worker</button>
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      </div>
    `;
    openModal();
  } catch (e) { alert(e.message); }
}

async function submitAssign() {
  const jobId = document.getElementById('assignJobId').value;
  const workerId = document.getElementById('assignWorkerId').value;
  const message = document.getElementById('assignNote').value.trim() || 'Assigned by admin';
  if (!jobId || !workerId) {
    alert('Select both job and worker');
    return;
  }
  try {
    await api('/api/applications', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, worker_id: workerId, auto_accept: true, message })
    });
    alert('Worker assigned to job.');
    closeModal();
    loadApplications();
    loadJobs();
    loadWorkers();
    refreshDashboard();
  } catch (e) { alert(e.message); }
}

async function applyToJob(jobId) {
  const job = jobsCache.find(j => j.id === jobId);
  document.getElementById('modalContent').innerHTML = `
    <h3>Apply for Job</h3>
    <p><strong>${esc(job?.title || 'Job')}</strong></p>
    <p style="font-size:0.9rem;color:var(--muted);margin:0.5rem 0;">
      Skills needed: ${(job?.skills_needed || []).map(s => `<span class="tag">${esc(s)}</span>`).join(' ') || '—'}
    </p>
    <p style="font-size:0.85rem;">Location: ${esc(job?.location || '—')} · Schedule: ${esc(job?.schedule_date || '—')} ${esc(job?.schedule_time || '')}</p>
    <div class="form-row" style="margin-top:1rem;">
      <label>Message to admin / requester (optional)</label>
      <textarea id="applyMessage" rows="3" placeholder="I am available for this work..."></textarea>
    </div>
    <div class="btn-group">
      <button class="btn btn-primary" onclick="submitApply('${jobId}')">Submit Application</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;
  openModal();
}

async function submitApply(jobId) {
  const message = document.getElementById('applyMessage')?.value?.trim() || '';
  try {
    await api('/api/applications', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, message })
    });
    closeModal();
    alert('Application submitted! Track it under Applications / Bookings.');
    loadApplications();
    showPanel('applications');
  } catch (e) { alert(e.message); }
}

// ---------- Applications ----------
async function loadApplications() {
  appsCache = await api('/api/applications');
  renderApplications();
}

function renderApplications() {
  const body = document.getElementById('appsBody');
  const isAdmin = currentUser.role === 'admin';
  const help = document.getElementById('appsHelp');
  const header = document.getElementById('appsHeaderActions');

  if (header) {
    header.innerHTML = isAdmin
      ? `<button class="btn btn-primary" onclick="openAssignModal()">+ Assign Worker to Job</button>
         <button class="btn btn-secondary" onclick="exportCsv('applications')">📥 Export CSV</button>`
      : `<button class="btn btn-primary" onclick="showPanel('jobs')">Browse Open Jobs & Apply</button>`;
  }
  if (help) {
    help.innerHTML = isAdmin
      ? `<strong>Admin guide:</strong> Workers apply from the Jobs tab, or you can <strong>Assign Worker to Job</strong> directly.
         Use <strong>Matches</strong> on an open job to see ranked available workers and assign them.
         <strong>Accept</strong> a pending application to fill the job and mark the worker Busy.`
      : `<strong>Worker guide:</strong> Go to <strong>Jobs</strong>, open an available job, click <strong>Apply</strong>.
         Your applications appear here. You can <strong>Withdraw</strong> while status is Pending.
         When Accepted, the admin has assigned you to that job.`;
  }

  if (!appsCache.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty">
      ${isAdmin
        ? 'No applications yet.<br>Create open jobs, then wait for workers to apply — or click <strong>Assign Worker to Job</strong>.'
        : 'You have not applied to any jobs yet.<br>Go to <strong>Jobs</strong> and click <strong>Apply</strong> on an open request.'}
    </td></tr>`;
    return;
  }
  body.innerHTML = appsCache.map(a => `
    <tr>
      <td>
        <strong>${esc(a.job_title)}</strong>
        ${!isAdmin && a.location ? `<br><small>${esc(a.location)}</small>` : ''}
        ${!isAdmin && (a.schedule_date || a.schedule_time) ? `<br><small>${esc(a.schedule_date || '')} ${esc(a.schedule_time || '')}</small>` : ''}
      </td>
      <td>${isAdmin ? esc(a.worker_name || '') + '<br><small>' + esc(a.worker_contact || '') + '</small>' : (a.requester_name ? esc(a.requester_name) + '<br><small>' + esc(a.requester_contact || '') + '</small>' : 'You')}</td>
      <td>${esc(a.message || '—')}</td>
      <td><span class="badge badge-${(a.status||'').toLowerCase()}">${esc(a.status)}</span></td>
      <td><small>${formatDate(a.applied_at)}</small></td>
      <td>
        ${isAdmin && a.status === 'Pending' ? `
          <button class="btn btn-sm btn-primary" onclick="updateApp('${a.id}','Accepted')">Accept</button>
          <button class="btn btn-sm btn-danger" onclick="updateApp('${a.id}','Rejected')">Reject</button>
        ` : ''}
        ${!isAdmin && a.status === 'Pending' ? `
          <button class="btn btn-sm btn-secondary" onclick="updateApp('${a.id}','Withdrawn')">Withdraw</button>
        ` : ''}
        ${a.status !== 'Pending' ? '<span style="color:var(--muted);font-size:0.8rem;">—</span>' : ''}
      </td>
    </tr>
  `).join('');
}

async function updateApp(id, status) {
  const labels = { Accepted: 'accept and fill this job', Rejected: 'reject this application', Withdrawn: 'withdraw your application' };
  if (!confirm(`Are you sure you want to ${labels[status] || status}?`)) return;
  try {
    await api('/api/applications/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
    loadApplications();
    if (status === 'Accepted') {
      loadJobs();
      if (typeof loadWorkers === 'function') loadWorkers();
    }
    refreshDashboard();
    alert(status === 'Accepted' ? 'Application accepted. Job marked Filled; worker set to Busy.' : 'Updated.');
  } catch (e) { alert(e.message); }
}

// ---------- Profile ----------
async function loadProfile() {
  currentUser = await api('/api/me');
  document.getElementById('pFullName').value = currentUser.full_name || '';
  document.getElementById('pContact').value = currentUser.contact || '';
  document.getElementById('pEmail').value = currentUser.email || '';
  document.getElementById('pAddress').value = currentUser.address || '';
  document.getElementById('pSex').value = currentUser.sex || '';
  document.getElementById('pAge').value = currentUser.age || '';

  const preview = document.getElementById('photoPreview');
  if (currentUser.profile_picture) {
    preview.innerHTML = `<img src="${esc(currentUser.profile_picture)}" alt="Photo" />`;
  } else {
    preview.innerHTML = `<span class="photo-placeholder">No Photo</span>`;
  }

  const card = document.getElementById('workerProfileCard');
  if (currentUser.role === 'worker' && currentUser.profile) {
    card.style.display = 'block';
    const p = currentUser.profile;
    document.getElementById('pExperience').value = p.experience_years || 0;
    document.getElementById('pStatus').value = p.status || 'Available';
    document.getElementById('pPosition').value = p.work_position || '';
    document.getElementById('pSchedule').value = p.work_schedule || '';
    document.getElementById('pCerts').value = p.certifications || '';
    document.getElementById('pNotes').value = p.notes || '';
    document.getElementById('pConsent').checked = !!p.consent_given;
    renderSkillsPicker(p.skills || []);
  } else {
    card.style.display = currentUser.role === 'worker' ? 'block' : 'none';
  }
}

function renderSkillsPicker(selected) {
  const box = document.getElementById('skillsPicker');
  const all = [...new Set([...DEFAULT_SKILLS, ...selected])];
  box.innerHTML = all.map(s =>
    `<span class="skill-chip ${selected.includes(s) ? 'selected' : ''}" data-skill="${esc(s)}" onclick="toggleSkill(this)">${esc(s)}</span>`
  ).join('');
}

function toggleSkill(el) {
  el.classList.toggle('selected');
}

document.getElementById('customSkill')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = this.value.trim();
    if (!val) return;
    const box = document.getElementById('skillsPicker');
    const exists = [...box.querySelectorAll('.skill-chip')].some(c => c.dataset.skill === val);
    if (!exists) {
      const span = document.createElement('span');
      span.className = 'skill-chip selected';
      span.dataset.skill = val;
      span.textContent = val;
      span.onclick = () => span.classList.toggle('selected');
      box.appendChild(span);
    }
    this.value = '';
  }
});

async function savePersonalInfo() {
  try {
    await api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({
        full_name: document.getElementById('pFullName').value.trim(),
        contact: document.getElementById('pContact').value.trim(),
        email: document.getElementById('pEmail').value.trim(),
        address: document.getElementById('pAddress').value.trim(),
        sex: document.getElementById('pSex').value,
        age: document.getElementById('pAge').value ? parseInt(document.getElementById('pAge').value) : null
      })
    });
    alert('Personal info saved');
    currentUser = await api('/api/me');
    document.getElementById('userInfo').textContent =
      `${currentUser.full_name} • ${currentUser.role === 'admin' ? 'Administrator' : 'Worker'}`;
  } catch (e) { alert(e.message); }
}

async function saveWorkerProfile() {
  const skills = [...document.querySelectorAll('#skillsPicker .skill-chip.selected')].map(c => c.dataset.skill);
  try {
    await api('/api/me/worker-profile', {
      method: 'PUT',
      body: JSON.stringify({
        skills,
        experience_years: parseInt(document.getElementById('pExperience').value) || 0,
        certifications: document.getElementById('pCerts').value.trim(),
        status: document.getElementById('pStatus').value,
        work_position: document.getElementById('pPosition').value.trim(),
        work_schedule: document.getElementById('pSchedule').value.trim(),
        notes: document.getElementById('pNotes').value.trim(),
        consent_given: document.getElementById('pConsent').checked
      })
    });
    alert('Work profile saved');
    currentUser = await api('/api/me');
  } catch (e) { alert(e.message); }
}

async function uploadPhoto() {
  const file = document.getElementById('photoInput').files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('photo', file);
  try {
    const res = await fetch(API + '/api/me/photo', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    document.getElementById('photoPreview').innerHTML = `<img src="${esc(data.profile_picture)}" alt="" />`;
    alert('Photo updated');
  } catch (e) { alert(e.message); }
}

async function changePassword() {
  try {
    await api('/api/me/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: document.getElementById('curPass').value,
        new_password: document.getElementById('newPass').value
      })
    });
    document.getElementById('curPass').value = '';
    document.getElementById('newPass').value = '';
    alert('Password changed successfully');
  } catch (e) { alert(e.message); }
}

// ---------- Settings ----------
async function loadSettings() {
  settingsCache = await api('/api/settings');
}

function fillSettingsForm() {
  document.getElementById('sBrgyName').value = settingsCache.brgy_name || '';
  document.getElementById('sMunicipality').value = settingsCache.municipality || '';
  document.getElementById('sProvince').value = settingsCache.province || '';
  document.getElementById('sContactPerson').value = settingsCache.contact_person || '';
}

async function saveSettings() {
  try {
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        brgy_name: document.getElementById('sBrgyName').value.trim(),
        municipality: document.getElementById('sMunicipality').value.trim(),
        province: document.getElementById('sProvince').value.trim(),
        contact_person: document.getElementById('sContactPerson').value.trim()
      })
    });
    await loadSettings();
    document.getElementById('brgyTitle').textContent = settingsCache.brgy_name || 'Barangay Skills Registry';
    alert('Settings saved');
  } catch (e) { alert(e.message); }
}

// ---------- Modal helpers ----------
function openModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ---------- Utils ----------
async function exportCsv(type) {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Admin only');
    return;
  }
  const endpoints = {
    workers: '/api/export/workers',
    jobs: '/api/export/jobs',
    applications: '/api/export/applications'
  };
  const path = endpoints[type];
  if (!path) return;
  try {
    const res = await fetch(API + path, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Export failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'workers' ? 'barangay_workers_registry.csv'
      : type === 'jobs' ? 'barangay_job_requests.csv'
      : 'barangay_applications.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message || 'Export failed');
  }
}

function downloadImportTemplate() {
  const headers = [
    'full_name', 'contact', 'username', 'password', 'address', 'sex', 'age',
    'skills', 'experience_years', 'certifications', 'status', 'work_position', 'work_schedule', 'notes'
  ];
  const sample = [
    'Carlos Rivera', '09171112222', 'jose.rizal', 'worker123', 'Purok 1', 'Male', '35',
    'Carpentry; Plumbing', '8', 'TESDA NC II', 'Available', 'Carpenter', 'Mon-Fri 8am-5pm', ''
  ];
  const csv = '\uFEFF' + headers.join(',') + '\n' + sample.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'workers_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function importWorkersCsv(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Admin only');
    return;
  }
  if (!confirm('Import workers from this CSV file?\n\nTip: Save your Excel file as CSV (Comma delimited) first.\nDefault password for blank password column: worker123')) return;

  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch(API + '/api/import/workers', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');
    let msg = `Import done.\nCreated: ${data.created}\nSkipped: ${data.skipped}`;
    if (data.errors && data.errors.length) msg += '\n\nNotes:\n' + data.errors.join('\n');
    alert(msg);
    loadWorkers();
    refreshDashboard();
  } catch (e) {
    alert(e.message || 'Import failed');
  }
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

// Auto-login if token exists
if (token) {
  showApp().catch(() => logout());
}
