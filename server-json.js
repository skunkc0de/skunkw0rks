/**
 * Portable backend using JSON file storage (no native modules).
 * Use this if better-sqlite3 fails to install/build.
 * Run: node server-json.js
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'barangay-skills-registry-secret-change-me-in-production';
const DATA_FILE = path.join(__dirname, 'data.json');
const uploadDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ---------- Simple JSON DB ----------
function load() {
  if (!fs.existsSync(DATA_FILE)) {
    const now = new Date().toISOString();
    const adminHash = bcrypt.hashSync('admin123', 10);
    const workerHash = bcrypt.hashSync('worker123', 10);

    const sampleWorkers = [
      {
        id: 'w-001', username: 'juan.delacruz', password_hash: workerHash, role: 'worker',
        full_name: 'Juan Dela Cruz', contact: '09171234567', email: 'juan.dc@email.com',
        address: 'Purok 3, Sample Barangay', sex: 'Male', age: 42, profile_picture: null,
        created_at: now, updated_at: now
      },
      {
        id: 'w-002', username: 'maria.santos', password_hash: workerHash, role: 'worker',
        full_name: 'Maria Santos', contact: '09189876543', email: '',
        address: 'Sitio Maligaya', sex: 'Female', age: 35, profile_picture: null,
        created_at: now, updated_at: now
      },
      {
        id: 'w-003', username: 'pedro.reyes', password_hash: workerHash, role: 'worker',
        full_name: 'Pedro Reyes', contact: '09201234567', email: '',
        address: 'Purok 1', sex: 'Male', age: 28, profile_picture: null,
        created_at: now, updated_at: now
      },
      {
        id: 'w-004', username: 'ana.lopez', password_hash: workerHash, role: 'worker',
        full_name: 'Ana Lopez', contact: '09155551234', email: '',
        address: 'Purok 5', sex: 'Female', age: 31, profile_picture: null,
        created_at: now, updated_at: now
      },
      {
        id: 'w-005', username: 'roberto.garcia', password_hash: workerHash, role: 'worker',
        full_name: 'Roberto Garcia', contact: '09301234567', email: '',
        address: 'Sitio Riverside', sex: 'Male', age: 45, profile_picture: null,
        created_at: now, updated_at: now
      },
      {
        id: 'w-006', username: 'liza.mendoza', password_hash: workerHash, role: 'worker',
        full_name: 'Liza Mendoza', contact: '09182223333', email: '',
        address: 'Purok 2', sex: 'Female', age: 26, profile_picture: null,
        created_at: now, updated_at: now
      }
    ];

    const sampleProfiles = {
      'w-001': {
        skills: ['Carpentry', 'Masonry', 'Roofing'], experience_years: 15,
        certifications: 'TESDA NC II Carpentry', status: 'Available',
        work_position: 'Lead Carpenter', work_schedule: 'Mon–Sat 7am–5pm',
        notes: 'Can handle house renovations and extensions', consent_given: true, consent_date: now, updated_at: now
      },
      'w-002': {
        skills: ['Caregiving', 'Housekeeping', 'Elderly Care'], experience_years: 8,
        certifications: 'TESDA NC II Caregiving', status: 'Available',
        work_position: 'Caregiver', work_schedule: 'Flexible / Live-out preferred',
        notes: '', consent_given: true, consent_date: now, updated_at: now
      },
      'w-003': {
        skills: ['Electrical', 'Aircon Repair', 'Appliance Repair'], experience_years: 6,
        certifications: 'TESDA NC II Electrical Installation', status: 'Busy',
        work_position: 'Electrician', work_schedule: 'Weekends available',
        notes: 'Currently on a project until next week', consent_given: true, consent_date: now, updated_at: now
      },
      'w-004': {
        skills: ['Sewing / Tailoring', 'Beauty Services'], experience_years: 10,
        certifications: '', status: 'Available',
        work_position: 'Home-based Tailor', work_schedule: 'Mon–Fri 9am–6pm',
        notes: 'Accepts rush orders', consent_given: true, consent_date: now, updated_at: now
      },
      'w-005': {
        skills: ['Plumbing', 'Welding', 'Steel Works'], experience_years: 20,
        certifications: 'TESDA NC II Plumbing, NC II SMAW', status: 'Available',
        work_position: 'Plumber / Welder', work_schedule: 'Mon–Sat 8am–5pm',
        notes: '', consent_given: true, consent_date: now, updated_at: now
      },
      'w-006': {
        skills: ['Cooking / Catering', 'Housekeeping'], experience_years: 4,
        certifications: '', status: 'Available',
        work_position: 'Cook / Caterer', work_schedule: 'Flexible, events ok',
        notes: 'Can handle small events and daily meals', consent_given: true, consent_date: now, updated_at: now
      }
    };

    const sampleJobs = [
      {
        id: 'j-001', title: 'House Extension – Carpentry & Masonry',
        description: 'Need skilled workers for a 2-room house extension.',
        skills_needed: ['Carpentry', 'Masonry'], requester_name: 'Mr. Villanueva',
        requester_contact: '09170001111', location: 'Purok 4', urgency: 'Normal',
        status: 'Open', schedule_date: null, schedule_time: null,
        created_by: 'admin-001', created_at: now, updated_at: now
      },
      {
        id: 'j-002', title: 'Caregiver for Elderly Parent',
        description: 'Live-out caregiver, preferably 5 days a week.',
        skills_needed: ['Caregiving', 'Elderly Care'], requester_name: 'Mrs. Lim',
        requester_contact: '09182224444', location: 'Sitio Maligaya', urgency: 'Urgent',
        status: 'Open', schedule_date: null, schedule_time: '8:00 AM',
        created_by: 'admin-001', created_at: now, updated_at: now
      },
      {
        id: 'j-003', title: 'Electrical Rewiring – Old House',
        description: 'Full rewiring needed for safety compliance.',
        skills_needed: ['Electrical'], requester_name: 'Barangay Hall',
        requester_contact: '09173335555', location: 'Barangay Hall area', urgency: 'Normal',
        status: 'Open', schedule_date: null, schedule_time: null,
        created_by: 'admin-001', created_at: now, updated_at: now
      }
    ];

    const seed = {
      users: [
        {
          id: 'admin-001', username: 'admin', password_hash: adminHash, role: 'admin',
          full_name: 'Barangay Administrator', contact: '09170000000', email: '',
          address: '', sex: '', age: null, profile_picture: null,
          created_at: now, updated_at: now
        },
        ...sampleWorkers
      ],
      profiles: sampleProfiles,
      jobs: sampleJobs,
      applications: [],
      settings: {
        brgy_name: 'Sample Barangay',
        municipality: 'Sample City',
        province: 'Sample Province',
        contact_person: 'Barangay Registry Officer'
      },
      audit: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    console.log('Created data.json with default admin + 6 sample workers');
    console.log('  Admin : admin / admin123');
    console.log('  Workers: any of the sample usernames / worker123');
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function logAction(db, userId, action, details = '') {
  db.audit.push({ user_id: userId, action, details, created_at: new Date().toISOString() });
  if (db.audit.length > 500) db.audit = db.audit.slice(-500);
}

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = /jpeg|jpg|png|webp|gif|csv|txt/;
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only image or CSV files are allowed'));
  }
});

function auth(requiredRole = null) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
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

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = req.body.password;
  if (!username || password == null || password === '') {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const db = load();
  // Case-insensitive match — public registration stores usernames in lowercase
  const user = db.users.find(u => String(u.username || '').toLowerCase() === username.toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET, { expiresIn: '12h' }
  );
  logAction(db, user.id, 'login');
  save(db);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, contact: user.contact, profile_picture: user.profile_picture }
  });
});

app.post('/api/register-worker', auth('admin'), (req, res) => {
  const { password, full_name, contact, email, address, sex, age, skills, experience_years, certifications } = req.body;
  const username = String(req.body.username || '').trim().toLowerCase();
  if (!username || !password || !full_name) return res.status(400).json({ error: 'Username, password and full name required' });
  const db = load();
  if (db.users.find(u => String(u.username || '').toLowerCase() === username)) return res.status(409).json({ error: 'Username already taken' });
  const id = uuidv4();
  db.users.push({
    id, username, password_hash: bcrypt.hashSync(password, 10), role: 'worker',
    full_name, contact: contact || '', email: email || '', address: address || '',
    sex: sex || '', age: age || null, profile_picture: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
  db.profiles[id] = {
    skills: skills || [], experience_years: experience_years || 0, certifications: certifications || '',
    status: 'Available', work_position: '', work_schedule: '', notes: '',
    consent_given: false, consent_date: null, updated_at: new Date().toISOString()
  };
  logAction(db, req.user.id, 'create_worker', id);
  save(db);
  res.status(201).json({ id, username, full_name, message: 'Worker account created' });
});

// Public self-registration for workers (Create Account on login page)
app.post('/api/register-public', (req, res) => {
  const { username, password, full_name, contact, address, skills, consent_given } = req.body;
  if (!username || !password || !full_name || !contact) {
    return res.status(400).json({ error: 'Full name, username, password and contact are required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!consent_given) {
    return res.status(400).json({ error: 'Consent is required to create an account' });
  }
  const cleanUser = String(username).trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(cleanUser)) {
    return res.status(400).json({ error: 'Username must be 3–30 characters (letters, numbers, . _ -)' });
  }
  const db = load();
  if (db.users.find(u => u.username.toLowerCase() === cleanUser)) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.users.push({
    id,
    username: cleanUser,
    password_hash: bcrypt.hashSync(password, 10),
    role: 'worker',
    full_name: String(full_name).trim(),
    contact: String(contact).trim(),
    email: '',
    address: address ? String(address).trim() : '',
    sex: '',
    age: null,
    profile_picture: null,
    created_at: now,
    updated_at: now
  });
  db.profiles[id] = {
    skills: Array.isArray(skills) ? skills : [],
    experience_years: 0,
    certifications: '',
    status: 'Available',
    work_position: '',
    work_schedule: '',
    notes: '',
    consent_given: true,
    consent_date: now,
    updated_at: now
  };
  logAction(db, id, 'self_register', cleanUser);
  save(db);
  res.status(201).json({ id, username: cleanUser, message: 'Account created. You can now login.' });
});

// ---------- Me ----------
app.get('/api/me', auth(), (req, res) => {
  const db = load();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password_hash, ...safe } = user;
  const profile = user.role === 'worker' ? (db.profiles[user.id] || null) : null;
  res.json({ ...safe, profile });
});

app.put('/api/me', auth(), (req, res) => {
  const db = load();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const fields = ['full_name', 'contact', 'email', 'address', 'sex', 'age'];
  fields.forEach(f => { if (req.body[f] !== undefined) user[f] = req.body[f]; });
  user.updated_at = new Date().toISOString();
  logAction(db, req.user.id, 'update_profile');
  save(db);
  res.json({ message: 'Profile updated' });
});

app.put('/api/me/password', auth(), (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Current and new password (min 6) required' });
  }
  const db = load();
  const user = db.users.find(u => u.id === req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  user.password_hash = bcrypt.hashSync(new_password, 10);
  user.updated_at = new Date().toISOString();
  logAction(db, req.user.id, 'change_password');
  save(db);
  res.json({ message: 'Password changed' });
});

app.post('/api/me/photo', auth(), upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  const db = load();
  const user = db.users.find(u => u.id === req.user.id);
  const relative = `/uploads/${req.file.filename}`;
  if (user.profile_picture && user.profile_picture.startsWith('/uploads/')) {
    const old = path.join(uploadDir, path.basename(user.profile_picture));
    if (fs.existsSync(old)) try { fs.unlinkSync(old); } catch (e) {}
  }
  user.profile_picture = relative;
  user.updated_at = new Date().toISOString();
  logAction(db, req.user.id, 'upload_photo');
  save(db);
  res.json({ profile_picture: relative });
});

app.put('/api/me/worker-profile', auth(), (req, res) => {
  const db = load();
  const targetId = (req.user.role === 'admin' && req.body.user_id) ? req.body.user_id : req.user.id;
  const p = db.profiles[targetId];
  if (!p) return res.status(404).json({ error: 'Worker profile not found' });
  const fields = ['skills', 'experience_years', 'certifications', 'status', 'work_position', 'work_schedule', 'notes'];
  fields.forEach(f => { if (req.body[f] !== undefined) p[f] = req.body[f]; });
  if (req.body.consent_given !== undefined) {
    p.consent_given = !!req.body.consent_given;
    if (p.consent_given) p.consent_date = new Date().toISOString();
  }
  p.updated_at = new Date().toISOString();
  logAction(db, req.user.id, 'update_worker_profile', targetId);
  save(db);
  res.json({ message: 'Worker profile updated' });
});

// ---------- Workers ----------
app.get('/api/workers', auth(), (req, res) => {
  const db = load();
  const list = db.users.filter(u => u.role === 'worker').map(u => {
    const p = db.profiles[u.id] || {};
    const { password_hash, ...safe } = u;
    return { ...safe, ...p };
  });
  res.json(list);
});

app.get('/api/workers/:id', auth(), (req, res) => {
  const db = load();
  const u = db.users.find(x => x.id === req.params.id && x.role === 'worker');
  if (!u) return res.status(404).json({ error: 'Worker not found' });
  const { password_hash, ...safe } = u;
  res.json({ ...safe, ...(db.profiles[u.id] || {}) });
});

app.delete('/api/workers/:id', auth('admin'), (req, res) => {
  const db = load();
  const idx = db.users.findIndex(u => u.id === req.params.id && u.role === 'worker');
  if (idx === -1) return res.status(404).json({ error: 'Worker not found' });
  db.users.splice(idx, 1);
  delete db.profiles[req.params.id];
  db.applications = db.applications.filter(a => a.worker_id !== req.params.id);
  logAction(db, req.user.id, 'delete_worker', req.params.id);
  save(db);
  res.json({ message: 'Worker deleted' });
});

// ---------- Jobs ----------
app.get('/api/jobs', auth(), (req, res) => {
  const db = load();
  let list = db.jobs;
  if (req.query.status) list = list.filter(j => j.status === req.query.status);
  res.json(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.post('/api/jobs', auth('admin'), (req, res) => {
  const { title, description, skills_needed, requester_name, requester_contact, location, urgency, schedule_date, schedule_time } = req.body;
  if (!title || !requester_name || !requester_contact) return res.status(400).json({ error: 'Title, requester name and contact required' });
  const db = load();
  const id = uuidv4();
  db.jobs.push({
    id, title, description: description || '', skills_needed: skills_needed || [],
    requester_name, requester_contact, location: location || '', urgency: urgency || 'Normal',
    status: 'Open', schedule_date: schedule_date || null, schedule_time: schedule_time || null,
    created_by: req.user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
  logAction(db, req.user.id, 'create_job', id);
  save(db);
  res.status(201).json({ id, message: 'Job created' });
});

app.put('/api/jobs/:id', auth('admin'), (req, res) => {
  const db = load();
  const job = db.jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const fields = ['title', 'description', 'skills_needed', 'requester_name', 'requester_contact', 'location', 'urgency', 'status', 'schedule_date', 'schedule_time'];
  fields.forEach(f => { if (req.body[f] !== undefined) job[f] = req.body[f]; });
  job.updated_at = new Date().toISOString();
  logAction(db, req.user.id, 'update_job', req.params.id);
  save(db);
  res.json({ message: 'Job updated' });
});

app.delete('/api/jobs/:id', auth('admin'), (req, res) => {
  const db = load();
  const idx = db.jobs.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Job not found' });
  db.jobs.splice(idx, 1);
  db.applications = db.applications.filter(a => a.job_id !== req.params.id);
  logAction(db, req.user.id, 'delete_job', req.params.id);
  save(db);
  res.json({ message: 'Job deleted' });
});

// ---------- Applications ----------
app.get('/api/applications', auth(), (req, res) => {
  const db = load();
  let list;
  if (req.user.role === 'admin') {
    list = db.applications.map(a => {
      const job = db.jobs.find(j => j.id === a.job_id) || {};
      const worker = db.users.find(u => u.id === a.worker_id) || {};
      return { ...a, job_title: job.title, job_status: job.status, worker_name: worker.full_name, worker_contact: worker.contact };
    });
  } else {
    list = db.applications.filter(a => a.worker_id === req.user.id).map(a => {
      const job = db.jobs.find(j => j.id === a.job_id) || {};
      return {
        ...a, job_title: job.title, job_status: job.status,
        requester_name: job.requester_name, requester_contact: job.requester_contact,
        location: job.location, schedule_date: job.schedule_date, schedule_time: job.schedule_time
      };
    });
  }
  res.json(list.sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at)));
});

app.post('/api/applications', auth(), (req, res) => {
  const { job_id, message, worker_id, auto_accept } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  const db = load();
  const job = db.jobs.find(j => j.id === job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'Open') return res.status(400).json({ error: 'Job is not open for applications' });

  let targetWorkerId;
  let status = 'Pending';

  if (req.user.role === 'admin') {
    // Admin can assign any worker to a job
    targetWorkerId = worker_id;
    if (!targetWorkerId) return res.status(400).json({ error: 'worker_id required when admin assigns' });
    const worker = db.users.find(u => u.id === targetWorkerId && u.role === 'worker');
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    if (auto_accept) status = 'Accepted';
  } else if (req.user.role === 'worker') {
    targetWorkerId = req.user.id;
  } else {
    return res.status(403).json({ error: 'Not allowed' });
  }

  if (db.applications.find(a => a.job_id === job_id && a.worker_id === targetWorkerId && a.status !== 'Withdrawn' && a.status !== 'Rejected')) {
    return res.status(409).json({ error: 'This worker already has an active application for this job' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  db.applications.push({
    id,
    job_id,
    worker_id: targetWorkerId,
    message: message || (req.user.role === 'admin' ? 'Assigned by admin' : ''),
    status,
    applied_at: now,
    updated_at: now
  });

  if (status === 'Accepted') {
    job.status = 'Filled';
    job.updated_at = now;
    // Mark worker busy when assigned
    if (db.profiles[targetWorkerId]) {
      db.profiles[targetWorkerId].status = 'Busy';
      db.profiles[targetWorkerId].updated_at = now;
    }
  }

  logAction(db, req.user.id, req.user.role === 'admin' ? 'assign_worker' : 'apply_job', `${job_id} -> ${targetWorkerId}`);
  save(db);
  res.status(201).json({ id, status, message: status === 'Accepted' ? 'Worker assigned to job' : 'Application submitted' });
});

app.put('/api/applications/:id', auth(), (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Accepted', 'Rejected', 'Withdrawn'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const db = load();
  const appRow = db.applications.find(a => a.id === req.params.id);
  if (!appRow) return res.status(404).json({ error: 'Application not found' });
  if (req.user.role === 'worker') {
    if (appRow.worker_id !== req.user.id) return res.status(403).json({ error: 'Not your application' });
    if (status !== 'Withdrawn') return res.status(403).json({ error: 'Workers can only withdraw' });
  }
  appRow.status = status;
  appRow.updated_at = new Date().toISOString();
  if (status === 'Accepted' && req.user.role === 'admin') {
    const job = db.jobs.find(j => j.id === appRow.job_id);
    if (job) {
      job.status = 'Filled';
      job.updated_at = new Date().toISOString();
    }
    if (db.profiles[appRow.worker_id]) {
      db.profiles[appRow.worker_id].status = 'Busy';
      db.profiles[appRow.worker_id].updated_at = new Date().toISOString();
    }
  }
  if (status === 'Rejected' || status === 'Withdrawn') {
    // leave job open; optionally free worker if no other accepted apps
  }
  logAction(db, req.user.id, 'update_application', `${req.params.id} -> ${status}`);
  save(db);
  res.json({ message: 'Application updated' });
});

// ---------- Matching ----------
app.get('/api/jobs/:id/matches', auth('admin'), (req, res) => {
  const db = load();
  const job = db.jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const needed = new Set(job.skills_needed || []);
  const workers = db.users.filter(u => u.role === 'worker').map(u => {
    const p = db.profiles[u.id] || {};
    return { ...u, ...p };
  }).filter(w => w.status === 'Available');

  const scored = workers.map(w => {
    const skills = w.skills || [];
    let overlap = 0;
    skills.forEach(s => { if (needed.has(s)) overlap++; });
    const score = needed.size ? Math.round((overlap / needed.size) * 100) : 0;
    return {
      id: w.id, full_name: w.full_name, contact: w.contact, profile_picture: w.profile_picture,
      skills, experience_years: w.experience_years, certifications: w.certifications,
      status: w.status, work_schedule: w.work_schedule, score, overlap
    };
  }).filter(w => w.score > 0).sort((a, b) => b.score - a.score || (b.experience_years || 0) - (a.experience_years || 0));

  res.json({ job, matches: scored });
});

// ---------- Settings & Stats ----------
app.get('/api/settings', auth(), (req, res) => {
  res.json(load().settings);
});

app.put('/api/settings', auth('admin'), (req, res) => {
  const db = load();
  ['brgy_name', 'municipality', 'province', 'contact_person'].forEach(k => {
    if (req.body[k] !== undefined) db.settings[k] = String(req.body[k]);
  });
  logAction(db, req.user.id, 'update_settings');
  save(db);
  res.json({ message: 'Settings updated' });
});

app.get('/api/stats', auth(), (req, res) => {
  const db = load();
  const workers = db.users.filter(u => u.role === 'worker');
  const available = workers.filter(u => (db.profiles[u.id] || {}).status === 'Available').length;
  const openJobs = db.jobs.filter(j => j.status === 'Open').length;
  const pendingApps = db.applications.filter(a => a.status === 'Pending').length;
  const withCerts = workers.filter(u => {
    const c = (db.profiles[u.id] || {}).certifications;
    return c && c.trim();
  }).length;
  res.json({ totalWorkers: workers.length, available, openJobs, pendingApps, withCerts });
});

// ---------- CSV Export (Admin) ----------
function toCsv(rows, headers) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  rows.forEach(row => {
    lines.push(headers.map(h => escape(row[h])).join(','));
  });
  return lines.join('\n');
}

app.get('/api/export/workers', auth('admin'), (req, res) => {
  const db = load();
  const rows = db.users.filter(u => u.role === 'worker').map(u => {
    const p = db.profiles[u.id] || {};
    return {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      contact: u.contact || '',
      email: u.email || '',
      address: u.address || '',
      sex: u.sex || '',
      age: u.age || '',
      skills: (p.skills || []).join('; '),
      experience_years: p.experience_years || 0,
      certifications: p.certifications || '',
      status: p.status || '',
      work_position: p.work_position || '',
      work_schedule: p.work_schedule || '',
      notes: p.notes || '',
      consent_given: p.consent_given ? 'Yes' : 'No',
      consent_date: p.consent_date || '',
      created_at: u.created_at || ''
    };
  });
  const headers = [
    'id', 'username', 'full_name', 'contact', 'email', 'address', 'sex', 'age',
    'skills', 'experience_years', 'certifications', 'status', 'work_position',
    'work_schedule', 'notes', 'consent_given', 'consent_date', 'created_at'
  ];
  const csv = toCsv(rows, headers);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="barangay_workers_registry.csv"');
  res.send('\uFEFF' + csv); // BOM for Excel
});

app.get('/api/export/jobs', auth('admin'), (req, res) => {
  const db = load();
  const rows = db.jobs.map(j => ({
    id: j.id,
    title: j.title,
    description: j.description || '',
    skills_needed: (j.skills_needed || []).join('; '),
    requester_name: j.requester_name,
    requester_contact: j.requester_contact,
    location: j.location || '',
    urgency: j.urgency || '',
    status: j.status,
    schedule_date: j.schedule_date || '',
    schedule_time: j.schedule_time || '',
    created_at: j.created_at || ''
  }));
  const headers = [
    'id', 'title', 'description', 'skills_needed', 'requester_name', 'requester_contact',
    'location', 'urgency', 'status', 'schedule_date', 'schedule_time', 'created_at'
  ];
  const csv = toCsv(rows, headers);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="barangay_job_requests.csv"');
  res.send('\uFEFF' + csv);
});

app.get('/api/export/applications', auth('admin'), (req, res) => {
  const db = load();
  const rows = db.applications.map(a => {
    const job = db.jobs.find(j => j.id === a.job_id) || {};
    const worker = db.users.find(u => u.id === a.worker_id) || {};
    return {
      id: a.id,
      job_title: job.title || '',
      worker_name: worker.full_name || '',
      worker_contact: worker.contact || '',
      message: a.message || '',
      status: a.status,
      applied_at: a.applied_at || '',
      updated_at: a.updated_at || ''
    };
  });
  const headers = [
    'id', 'job_title', 'worker_name', 'worker_contact', 'message', 'status', 'applied_at', 'updated_at'
  ];
  const csv = toCsv(rows, headers);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="barangay_applications.csv"');
  res.send('\uFEFF' + csv);
});

// Import workers from CSV (Excel-friendly). Admin only.
// Expected columns: full_name, contact, username, password, address, skills, status, work_position, work_schedule, certifications, experience_years
app.post('/api/import/workers', auth('admin'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  const text = fs.readFileSync(req.file.path, 'utf8').replace(/^\uFEFF/, '');
  try { fs.unlinkSync(req.file.path); } catch (e) {}

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return res.status(400).json({ error: 'CSV has no data rows' });

  function parseLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { result.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const idx = (name) => headers.indexOf(name);
  const need = ['full_name', 'contact'];
  for (const n of need) {
    if (idx(n) === -1) return res.status(400).json({ error: `Missing required column: ${n}` });
  }

  const db = load();
  let created = 0, skipped = 0;
  const errors = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = parseLine(lines[r]);
    const get = (name) => {
      const i = idx(name);
      return i >= 0 ? (cols[i] || '').trim() : '';
    };
    const full_name = get('full_name');
    const contact = get('contact');
    if (!full_name || !contact) { skipped++; continue; }

    let username = get('username') || full_name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 20);
    if (db.users.find(u => u.username === username)) {
      username = username + '.' + String(r);
    }
    if (db.users.find(u => u.username === username)) {
      skipped++;
      errors.push(`Row ${r + 1}: username conflict for ${full_name}`);
      continue;
    }

    const password = get('password') || 'worker123';
    const skills = get('skills').split(/[;|]/).map(s => s.trim()).filter(Boolean);
    const id = uuidv4();
    const now = new Date().toISOString();
    db.users.push({
      id, username, password_hash: bcrypt.hashSync(password, 10), role: 'worker',
      full_name, contact, email: get('email'), address: get('address'),
      sex: get('sex'), age: get('age') ? parseInt(get('age'), 10) : null,
      profile_picture: null, created_at: now, updated_at: now
    });
    db.profiles[id] = {
      skills,
      experience_years: get('experience_years') ? parseInt(get('experience_years'), 10) : 0,
      certifications: get('certifications'),
      status: ['Available', 'Busy', 'Unavailable'].includes(get('status')) ? get('status') : 'Available',
      work_position: get('work_position'),
      work_schedule: get('work_schedule'),
      notes: get('notes'),
      consent_given: true,
      consent_date: now,
      updated_at: now
    };
    created++;
  }

  logAction(db, req.user.id, 'import_workers', `created=${created} skipped=${skipped}`);
  save(db);
  res.json({ message: `Import finished`, created, skipped, errors: errors.slice(0, 10) });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Barangay Skills Registry (JSON backend) running at http://localhost:${PORT}`);
  console.log('Default admin: username=admin  password=admin123');
  console.log('Sample workers: e.g. juan.delacruz / worker123');
});
