const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'barangay-skills-registry-secret-change-me-in-production';
const dbPath = path.join(__dirname, 'registry.db');

// Ensure DB exists
if (!fs.existsSync(dbPath)) {
  console.log('Database not found. Run: node init-db.js');
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---------- Auth Middleware ----------
function auth(requiredRole = null) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const token = header.slice(7);
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (requiredRole && payload.role !== requiredRole && payload.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

function logAction(userId, action, details = '') {
  try {
    db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(userId, action, details);
  } catch (e) { /* ignore */ }
}

// ---------- Auth Routes ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  logAction(user.id, 'login');

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      contact: user.contact,
      profile_picture: user.profile_picture
    }
  });
});

app.post('/api/register-worker', auth('admin'), (req, res) => {
  const { username, password, full_name, contact, email, address, sex, age, skills, experience_years, certifications } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Username, password and full name are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, role, full_name, contact, email, address, sex, age)
    VALUES (?, ?, ?, 'worker', ?, ?, ?, ?, ?, ?)
  `);
  const insertProfile = db.prepare(`
    INSERT INTO worker_profiles (user_id, skills, experience_years, certifications, consent_given)
    VALUES (?, ?, ?, ?, 0)
  `);

  const tx = db.transaction(() => {
    insertUser.run(id, username, hash, full_name, contact || null, email || null, address || null, sex || null, age || null);
    insertProfile.run(id, JSON.stringify(skills || []), experience_years || 0, certifications || '');
  });
  tx();

  logAction(req.user.id, 'create_worker', `Created worker ${username} (${id})`);
  res.status(201).json({ id, username, full_name, message: 'Worker account created' });
});

// ---------- Current User ----------
app.get('/api/me', auth(), (req, res) => {
  const user = db.prepare('SELECT id, username, role, full_name, contact, email, address, sex, age, profile_picture, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let profile = null;
  if (user.role === 'worker') {
    profile = db.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(user.id);
    if (profile) profile.skills = JSON.parse(profile.skills || '[]');
  }
  res.json({ ...user, profile });
});

app.put('/api/me', auth(), (req, res) => {
  const { full_name, contact, email, address, sex, age } = req.body;
  db.prepare(`
    UPDATE users SET full_name = COALESCE(?, full_name), contact = COALESCE(?, contact),
    email = COALESCE(?, email), address = COALESCE(?, address), sex = COALESCE(?, sex),
    age = COALESCE(?, age), updated_at = datetime('now') WHERE id = ?
  `).run(full_name, contact, email, address, sex, age, req.user.id);

  logAction(req.user.id, 'update_profile');
  res.json({ message: 'Profile updated' });
});

app.put('/api/me/password', auth(), (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Current password and new password (min 6 chars) required' });
  }
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, req.user.id);
  logAction(req.user.id, 'change_password');
  res.json({ message: 'Password changed successfully' });
});

app.post('/api/me/photo', auth(), upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  const relative = `/uploads/${req.file.filename}`;
  // Remove old photo if exists
  const old = db.prepare('SELECT profile_picture FROM users WHERE id = ?').get(req.user.id);
  if (old && old.profile_picture && old.profile_picture.startsWith('/uploads/')) {
    const oldPath = path.join(uploadDir, path.basename(old.profile_picture));
    if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (e) {}
  }
  db.prepare('UPDATE users SET profile_picture = ?, updated_at = datetime(\'now\') WHERE id = ?').run(relative, req.user.id);
  logAction(req.user.id, 'upload_photo');
  res.json({ profile_picture: relative });
});

// ---------- Worker Profile (self) ----------
app.put('/api/me/worker-profile', auth(), (req, res) => {
  if (req.user.role !== 'worker' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Workers only' });
  }
  const targetId = req.user.role === 'admin' && req.body.user_id ? req.body.user_id : req.user.id;

  const { skills, experience_years, certifications, status, work_position, work_schedule, notes, consent_given } = req.body;

  const existing = db.prepare('SELECT user_id FROM worker_profiles WHERE user_id = ?').get(targetId);
  if (!existing) return res.status(404).json({ error: 'Worker profile not found' });

  db.prepare(`
    UPDATE worker_profiles SET
      skills = COALESCE(?, skills),
      experience_years = COALESCE(?, experience_years),
      certifications = COALESCE(?, certifications),
      status = COALESCE(?, status),
      work_position = COALESCE(?, work_position),
      work_schedule = COALESCE(?, work_schedule),
      notes = COALESCE(?, notes),
      consent_given = COALESCE(?, consent_given),
      consent_date = CASE WHEN ? = 1 THEN datetime('now') ELSE consent_date END,
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(
    skills ? JSON.stringify(skills) : null,
    experience_years,
    certifications,
    status,
    work_position,
    work_schedule,
    notes,
    consent_given !== undefined ? (consent_given ? 1 : 0) : null,
    consent_given ? 1 : 0,
    targetId
  );

  logAction(req.user.id, 'update_worker_profile', targetId);
  res.json({ message: 'Worker profile updated' });
});

// ---------- Admin: Workers ----------
app.get('/api/workers', auth(), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.contact, u.email, u.address, u.sex, u.age, u.profile_picture,
           p.skills, p.experience_years, p.certifications, p.status, p.work_position, p.work_schedule, p.notes, p.consent_given, p.consent_date
    FROM users u
    JOIN worker_profiles p ON u.id = p.user_id
    WHERE u.role = 'worker'
    ORDER BY u.full_name
  `).all();

  const workers = rows.map(r => ({
    ...r,
    skills: JSON.parse(r.skills || '[]'),
    consent_given: !!r.consent_given
  }));
  res.json(workers);
});

app.get('/api/workers/:id', auth(), (req, res) => {
  const r = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.contact, u.email, u.address, u.sex, u.age, u.profile_picture,
           p.skills, p.experience_years, p.certifications, p.status, p.work_position, p.work_schedule, p.notes, p.consent_given, p.consent_date
    FROM users u
    JOIN worker_profiles p ON u.id = p.user_id
    WHERE u.id = ? AND u.role = 'worker'
  `).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Worker not found' });
  r.skills = JSON.parse(r.skills || '[]');
  r.consent_given = !!r.consent_given;
  res.json(r);
});

app.delete('/api/workers/:id', auth('admin'), (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(req.params.id, 'worker');
  if (result.changes === 0) return res.status(404).json({ error: 'Worker not found' });
  logAction(req.user.id, 'delete_worker', req.params.id);
  res.json({ message: 'Worker deleted' });
});

// ---------- Jobs ----------
app.get('/api/jobs', auth(), (req, res) => {
  const status = req.query.status;
  let rows;
  if (status) {
    rows = db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  }
  res.json(rows.map(j => ({ ...j, skills_needed: JSON.parse(j.skills_needed || '[]') })));
});

app.post('/api/jobs', auth('admin'), (req, res) => {
  const { title, description, skills_needed, requester_name, requester_contact, location, urgency, schedule_date, schedule_time } = req.body;
  if (!title || !requester_name || !requester_contact) {
    return res.status(400).json({ error: 'Title, requester name and contact are required' });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO jobs (id, title, description, skills_needed, requester_name, requester_contact, location, urgency, schedule_date, schedule_time, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, title, description || '', JSON.stringify(skills_needed || []),
    requester_name, requester_contact, location || '', urgency || 'Normal',
    schedule_date || null, schedule_time || null, req.user.id
  );
  logAction(req.user.id, 'create_job', id);
  res.status(201).json({ id, message: 'Job created' });
});

app.put('/api/jobs/:id', auth('admin'), (req, res) => {
  const { title, description, skills_needed, requester_name, requester_contact, location, urgency, status, schedule_date, schedule_time } = req.body;
  const result = db.prepare(`
    UPDATE jobs SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      skills_needed = COALESCE(?, skills_needed),
      requester_name = COALESCE(?, requester_name),
      requester_contact = COALESCE(?, requester_contact),
      location = COALESCE(?, location),
      urgency = COALESCE(?, urgency),
      status = COALESCE(?, status),
      schedule_date = COALESCE(?, schedule_date),
      schedule_time = COALESCE(?, schedule_time),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title, description, skills_needed ? JSON.stringify(skills_needed) : null,
    requester_name, requester_contact, location, urgency, status,
    schedule_date, schedule_time, req.params.id
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Job not found' });
  logAction(req.user.id, 'update_job', req.params.id);
  res.json({ message: 'Job updated' });
});

app.delete('/api/jobs/:id', auth('admin'), (req, res) => {
  const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Job not found' });
  logAction(req.user.id, 'delete_job', req.params.id);
  res.json({ message: 'Job deleted' });
});

// ---------- Applications / Bookings ----------
app.get('/api/applications', auth(), (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(`
      SELECT a.*, j.title as job_title, j.status as job_status, u.full_name as worker_name, u.contact as worker_contact
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN users u ON a.worker_id = u.id
      ORDER BY a.applied_at DESC
    `).all();
  } else {
    rows = db.prepare(`
      SELECT a.*, j.title as job_title, j.status as job_status, j.requester_name, j.requester_contact, j.location, j.schedule_date, j.schedule_time
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.worker_id = ?
      ORDER BY a.applied_at DESC
    `).all(req.user.id);
  }
  res.json(rows);
});

app.post('/api/applications', auth(), (req, res) => {
  if (req.user.role !== 'worker') return res.status(403).json({ error: 'Only workers can apply' });
  const { job_id, message } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  const job = db.prepare('SELECT id, status FROM jobs WHERE id = ?').get(job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'Open') return res.status(400).json({ error: 'Job is not open for applications' });

  const existing = db.prepare('SELECT id FROM applications WHERE job_id = ? AND worker_id = ?').get(job_id, req.user.id);
  if (existing) return res.status(409).json({ error: 'You already applied to this job' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO applications (id, job_id, worker_id, message) VALUES (?, ?, ?, ?)
  `).run(id, job_id, req.user.id, message || '');
  logAction(req.user.id, 'apply_job', job_id);
  res.status(201).json({ id, message: 'Application submitted' });
});

app.put('/api/applications/:id', auth(), (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Accepted', 'Rejected', 'Withdrawn'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const appRow = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!appRow) return res.status(404).json({ error: 'Application not found' });

  // Worker can only withdraw their own
  if (req.user.role === 'worker') {
    if (appRow.worker_id !== req.user.id) return res.status(403).json({ error: 'Not your application' });
    if (status !== 'Withdrawn') return res.status(403).json({ error: 'Workers can only withdraw applications' });
  }

  db.prepare('UPDATE applications SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, req.params.id);

  // If accepted, optionally mark job as Filled
  if (status === 'Accepted' && req.user.role === 'admin') {
    db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('Filled', appRow.job_id);
  }

  logAction(req.user.id, 'update_application', `${req.params.id} -> ${status}`);
  res.json({ message: 'Application updated' });
});

// ---------- Matching helper ----------
app.get('/api/jobs/:id/matches', auth('admin'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const needed = new Set(JSON.parse(job.skills_needed || '[]'));

  const workers = db.prepare(`
    SELECT u.id, u.full_name, u.contact, u.profile_picture, p.skills, p.experience_years, p.certifications, p.status, p.work_schedule
    FROM users u JOIN worker_profiles p ON u.id = p.user_id
    WHERE u.role = 'worker' AND p.status = 'Available'
  `).all();

  const scored = workers.map(w => {
    const skills = JSON.parse(w.skills || '[]');
    let overlap = 0;
    skills.forEach(s => { if (needed.has(s)) overlap++; });
    const score = needed.size ? Math.round((overlap / needed.size) * 100) : 0;
    return { ...w, skills, score, overlap };
  }).filter(w => w.score > 0).sort((a, b) => b.score - a.score || (b.experience_years || 0) - (a.experience_years || 0));

  res.json({ job: { ...job, skills_needed: JSON.parse(job.skills_needed || '[]') }, matches: scored });
});

// ---------- Settings (admin) ----------
app.get('/api/settings', auth(), (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

app.put('/api/settings', auth('admin'), (req, res) => {
  const allowed = ['brgy_name', 'municipality', 'province', 'contact_person'];
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) upsert.run(k, String(v));
  }
  logAction(req.user.id, 'update_settings');
  res.json({ message: 'Settings updated' });
});

// ---------- Dashboard stats ----------
app.get('/api/stats', auth(), (req, res) => {
  const totalWorkers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'worker'").get().c;
  const available = db.prepare("SELECT COUNT(*) as c FROM worker_profiles WHERE status = 'Available'").get().c;
  const openJobs = db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status = 'Open'").get().c;
  const pendingApps = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'Pending'").get().c;
  const withCerts = db.prepare("SELECT COUNT(*) as c FROM worker_profiles WHERE certifications IS NOT NULL AND certifications != ''").get().c;

  res.json({ totalWorkers, available, openJobs, pendingApps, withCerts });
});

// ---------- CSV Export (Admin) ----------
function toCsv(rows, headers) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  rows.forEach(row => lines.push(headers.map(h => escape(row[h])).join(',')));
  return lines.join('\n');
}

app.get('/api/export/workers', auth('admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.contact, u.email, u.address, u.sex, u.age,
           p.skills, p.experience_years, p.certifications, p.status, p.work_position,
           p.work_schedule, p.notes, p.consent_given, p.consent_date, u.created_at
    FROM users u JOIN worker_profiles p ON u.id = p.user_id
    WHERE u.role = 'worker' ORDER BY u.full_name
  `).all().map(r => ({
    ...r,
    skills: JSON.parse(r.skills || '[]').join('; '),
    consent_given: r.consent_given ? 'Yes' : 'No'
  }));
  const headers = ['id','username','full_name','contact','email','address','sex','age','skills','experience_years','certifications','status','work_position','work_schedule','notes','consent_given','consent_date','created_at'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="barangay_workers_registry.csv"');
  res.send('\uFEFF' + toCsv(rows, headers));
});

app.get('/api/export/jobs', auth('admin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all().map(j => ({
    id: j.id, title: j.title, description: j.description || '',
    skills_needed: JSON.parse(j.skills_needed || '[]').join('; '),
    requester_name: j.requester_name, requester_contact: j.requester_contact,
    location: j.location || '', urgency: j.urgency || '', status: j.status,
    schedule_date: j.schedule_date || '', schedule_time: j.schedule_time || '',
    created_at: j.created_at || ''
  }));
  const headers = ['id','title','description','skills_needed','requester_name','requester_contact','location','urgency','status','schedule_date','schedule_time','created_at'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="barangay_job_requests.csv"');
  res.send('\uFEFF' + toCsv(rows, headers));
});

app.get('/api/export/applications', auth('admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, j.title as job_title, u.full_name as worker_name, u.contact as worker_contact,
           a.message, a.status, a.applied_at, a.updated_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    JOIN users u ON a.worker_id = u.id
    ORDER BY a.applied_at DESC
  `).all();
  const headers = ['id','job_title','worker_name','worker_contact','message','status','applied_at','updated_at'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="barangay_applications.csv"');
  res.send('\uFEFF' + toCsv(rows, headers));
});

// ---------- Fallback to frontend ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Barangay Skills Registry server running at http://localhost:${PORT}`);
  console.log('Default admin: username=admin  password=admin123');
  console.log('Sample workers: e.g. juan.delacruz / worker123');
});
