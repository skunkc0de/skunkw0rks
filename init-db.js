const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'registry.db');
const db = new Database(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'worker')),
    full_name TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    address TEXT,
    sex TEXT,
    age INTEGER,
    profile_picture TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS worker_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    skills TEXT NOT NULL DEFAULT '[]',
    experience_years INTEGER DEFAULT 0,
    certifications TEXT DEFAULT '',
    status TEXT DEFAULT 'Available' CHECK(status IN ('Available', 'Busy', 'Unavailable')),
    work_position TEXT DEFAULT '',
    work_schedule TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    consent_given INTEGER DEFAULT 0,
    consent_date TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    skills_needed TEXT NOT NULL DEFAULT '[]',
    requester_name TEXT NOT NULL,
    requester_contact TEXT NOT NULL,
    location TEXT,
    urgency TEXT DEFAULT 'Normal',
    status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'Filled', 'Closed')),
    schedule_date TEXT,
    schedule_time TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Accepted', 'Rejected', 'Withdrawn')),
    applied_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(job_id, worker_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default admin + sample workers
const adminId = 'admin-001';
const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

if (!existingAdmin) {
  const adminHash = bcrypt.hashSync('admin123', 10);
  const workerHash = bcrypt.hashSync('worker123', 10);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, full_name, contact)
    VALUES (?, ?, ?, 'admin', ?, ?)
  `).run(adminId, 'admin', adminHash, 'Barangay Administrator', '09170000000');

  const samples = [
    ['w-001', 'juan.delacruz', 'Juan Dela Cruz', '09171234567', 'Purok 3', 'Male', 42,
      JSON.stringify(['Carpentry', 'Masonry', 'Roofing']), 15, 'TESDA NC II Carpentry', 'Available', 'Lead Carpenter', 'Mon–Sat 7am–5pm'],
    ['w-002', 'maria.santos', 'Maria Santos', '09189876543', 'Sitio Maligaya', 'Female', 35,
      JSON.stringify(['Caregiving', 'Housekeeping', 'Elderly Care']), 8, 'TESDA NC II Caregiving', 'Available', 'Caregiver', 'Flexible / Live-out'],
    ['w-003', 'pedro.reyes', 'Pedro Reyes', '09201234567', 'Purok 1', 'Male', 28,
      JSON.stringify(['Electrical', 'Aircon Repair', 'Appliance Repair']), 6, 'TESDA NC II Electrical Installation', 'Busy', 'Electrician', 'Weekends available'],
    ['w-004', 'ana.lopez', 'Ana Lopez', '09155551234', 'Purok 5', 'Female', 31,
      JSON.stringify(['Sewing / Tailoring', 'Beauty Services']), 10, '', 'Available', 'Home-based Tailor', 'Mon–Fri 9am–6pm'],
    ['w-005', 'roberto.garcia', 'Roberto Garcia', '09301234567', 'Sitio Riverside', 'Male', 45,
      JSON.stringify(['Plumbing', 'Welding', 'Steel Works']), 20, 'TESDA NC II Plumbing, NC II SMAW', 'Available', 'Plumber / Welder', 'Mon–Sat 8am–5pm'],
    ['w-006', 'liza.mendoza', 'Liza Mendoza', '09182223333', 'Purok 2', 'Female', 26,
      JSON.stringify(['Cooking / Catering', 'Housekeeping']), 4, '', 'Available', 'Cook / Caterer', 'Flexible, events ok']
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, role, full_name, contact, address, sex, age)
    VALUES (?, ?, ?, 'worker', ?, ?, ?, ?, ?)
  `);
  const insertProfile = db.prepare(`
    INSERT INTO worker_profiles (user_id, skills, experience_years, certifications, status, work_position, work_schedule, consent_given, consent_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `);

  for (const s of samples) {
    insertUser.run(s[0], s[1], workerHash, s[2], s[3], s[4], s[5], s[6]);
    insertProfile.run(s[0], s[7], s[8], s[9], s[10], s[11], s[12]);
  }

  // Sample jobs
  const insertJob = db.prepare(`
    INSERT INTO jobs (id, title, description, skills_needed, requester_name, requester_contact, location, urgency, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)
  `);
  insertJob.run('j-001', 'House Extension – Carpentry & Masonry', 'Need skilled workers for a 2-room house extension.',
    JSON.stringify(['Carpentry', 'Masonry']), 'Mr. Villanueva', '09170001111', 'Purok 4', 'Normal', adminId);
  insertJob.run('j-002', 'Caregiver for Elderly Parent', 'Live-out caregiver, preferably 5 days a week.',
    JSON.stringify(['Caregiving', 'Elderly Care']), 'Mrs. Lim', '09182224444', 'Sitio Maligaya', 'Urgent', adminId);
  insertJob.run('j-003', 'Electrical Rewiring – Old House', 'Full rewiring needed for safety compliance.',
    JSON.stringify(['Electrical']), 'Barangay Hall', '09173335555', 'Barangay Hall area', 'Normal', adminId);

  console.log('Default admin created: username = admin  |  password = admin123');
  console.log('Sample workers created (password for all: worker123)');
  console.log('  juan.delacruz, maria.santos, pedro.reyes, ana.lopez, roberto.garcia, liza.mendoza');
  console.log('IMPORTANT: Change the admin password after first login!');
} else {
  console.log('Admin already exists — skipping seed.');
}

// Default settings
const defaults = [
  ['brgy_name', 'Sample Barangay'],
  ['municipality', 'Sample City'],
  ['province', 'Sample Province'],
  ['contact_person', 'Barangay Registry Officer']
];

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
defaults.forEach(([k, v]) => insertSetting.run(k, v));

db.close();
console.log('Database initialized at:', dbPath);
