# skunkw0rks
Academic project purposes only

# Barangay Labor & Skills Registry System v2

**Full-featured Local Job Matching System** with:

- Login (Admin + Worker accounts)
- Role-based access control
- Profile pictures
- Skills / professions management
- Work status, position & schedule
- Job applications / bookings
- Full admin control (create/edit/delete jobs & workers)
- Printable consent form
- Clean backend that is easy to run

Designed for Philippine barangays. Aligns with the proposed Barangay Skilled Workers Registry Act and DOLE systems (PESO, PhilJobNet, NSRP).

---

## Features at a Glance

### Admin
- Create worker accounts
- Create / edit / delete job & service requests (with schedule date/time)
- View skill-based matches for any job
- Accept or reject applications
- Delete workers
- Manage barangay settings
- Full visibility of everything

### Worker (Limited Access)
- Login with own account
- Edit personal info & contact details
- Upload profile picture
- Manage skills / professions
- Change **work status** (Available / Busy / Unavailable)
- Set **work position** and **work schedule**
- Browse open jobs and **apply / book**
- Withdraw own applications
- Give digital consent for registry listing

### Shared
- Printable A4 Consent Form
- Dashboard with live statistics
- JWT-based login (12-hour sessions)

---

## Quick Start

### Requirements
- Node.js 18 or newer
- npm

### Install & Run

```bash
cd backend
npm install
npm start
```

Then open: **http://localhost:3000**

**Default Admin Login**
| Field    | Value     |
|----------|-----------|
| Username | `admin`   |
| Password | `admin123`|

**Sample Worker Accounts** (password for all: `worker123`)
| Username | Name | Skills |
|----------|------|--------|
| `juan.delacruz` | Juan Dela Cruz | Carpentry, Masonry, Roofing |
| `maria.santos` | Maria Santos | Caregiving, Housekeeping, Elderly Care |
| `pedro.reyes` | Pedro Reyes | Electrical, Aircon/Appliance Repair |
| `ana.lopez` | Ana Lopez | Sewing/Tailoring, Beauty Services |
| `roberto.garcia` | Roberto Garcia | Plumbing, Welding, Steel Works |
| `liza.mendoza` | Liza Mendoza | Cooking/Catering, Housekeeping |

Three sample open job requests are also pre-loaded.

**Important:** Change the admin password immediately after first login  
(My Profile → Change Password).

The default backend uses a simple **JSON file** for storage.  
No native compilation is required — it works on almost any computer.

### Export (Admin)
From the Dashboard or Workers/Jobs panels, click **Export CSV** to download:
- Workers registry
- Job requests
- Applications

Files open cleanly in Excel / Google Sheets (UTF-8 with BOM).

---

## Project Structure

```
barangay-skills-registry-v2/
├── backend/
│   ├── package.json
│   ├── server-json.js      ← Default (portable JSON storage)
│   ├── server.js           ← Optional SQLite version
│   ├── init-db.js          ← For SQLite only
│   └── data.json           ← Created automatically on first run
├── frontend/
│   ├── index.html          ← Login + main application
│   ├── styles.css
│   ├── app.js
│   └── consent-form.html   ← Printable consent form
├── uploads/                ← Profile pictures (auto-created)
└── README.md
```

---

## How to Use (Typical Flow)

1. **Admin logs in** → creates worker accounts (username + temporary password).
2. **Worker signs the printed Consent Form** (or checks the digital consent box).
3. **Worker logs in** → updates profile, skills, status, schedule, uploads photo.
4. **Admin (or staff) posts job requests** with required skills and optional schedule.
5. **Workers apply** to open jobs they can do.
6. **Admin reviews applications**, accepts the best match (job can be marked Filled).
7. Matching tool helps admin see ranked workers by skill overlap.

---

## Deployment Options

### A. Local Barangay PC (Easiest)
1. Install Node.js.
2. Copy the project folder.
3. Run `npm install` then `npm start` inside `backend/`.
4. Access from the same PC or other devices on the same Wi-Fi using the PC’s IP address  
   (example: `http://192.168.1.25:3000`).

### B. Always-on VPS / Cloud
1. Deploy to any small VPS.
2. Install Node.js.
3. Use PM2:
   ```bash
   npm install -g pm2
   pm2 start server-json.js --name barangay-registry
   pm2 save && pm2 startup
   ```
4. Optional: put Nginx in front + free SSL (Let’s Encrypt).

### C. Production Tips
- Set a strong secret: `JWT_SECRET=your-long-random-string`
- Change the default admin password.
- Regularly back up `backend/data.json` and the `uploads/` folder.

---

## Optional SQLite Backend

If you prefer a real database and your machine can compile native modules:

```bash
npm install better-sqlite3
node init-db.js
npm run start:sqlite
```

---

## Data Privacy Notes

- Registration is **voluntary**.
- Use the printed Consent Form for physical signatures.
- Only authorized barangay staff should have the admin account.
- Comply with the **Data Privacy Act of 2012 (RA 10173)**.
- Inclusion in the registry does **not** certify skills.

---

## Backup

Simply copy these two items regularly:
- `backend/data.json`
- `uploads/` folder

---

Ready for barangay use. Free to modify and deploy.
