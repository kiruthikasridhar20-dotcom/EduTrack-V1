/**
 * EduTrack Mentor Portal — Express Backend Server
 * ================================================
 * Run:  node server.js
 * Open: http://localhost:3000
 *
 * Data is stored as JSON files inside ./data/
 *   data/mentors.json   — all mentor accounts (passwords hashed)
 *   data/students.json  — all student records (keyed by mentorId)
 */
const supabaseUrl = "https://lsswqecyrgkqgfowzrwv.supabase.co";
const supabaseKey = "sb_publishable_vZ9lno9gJ_xFUw75Si_gjg_MgXO4a6m";

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const app       = express();
const PORT      = process.env.PORT || 3000;
const SECRET    = 'edutrack_jwt_secret_2025_change_in_prod';
const DATA_DIR  = path.join(__dirname, 'data');
const MENTORS_F = path.join(DATA_DIR, 'mentors.json');
const STUDENTS_F= path.join(DATA_DIR, 'students.json');

/* ─── Ensure data directory and files exist ─── */
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MENTORS_F))  fs.writeFileSync(MENTORS_F,  '{}', 'utf8');
if (!fs.existsSync(STUDENTS_F)) fs.writeFileSync(STUDENTS_F, '[]', 'utf8');

/* ─── JSON file helpers ─── */
function readMentors()   { try { return JSON.parse(fs.readFileSync(MENTORS_F,  'utf8')); } catch { return {}; } }
function readStudents()  { try { return JSON.parse(fs.readFileSync(STUDENTS_F, 'utf8')); } catch { return []; } }
function writeMentors(d)  { fs.writeFileSync(MENTORS_F,  JSON.stringify(d, null, 2), 'utf8'); }
function writeStudents(d) { fs.writeFileSync(STUDENTS_F, JSON.stringify(d, null, 2), 'utf8'); }

/* ─── Middleware ─── */
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ─── Auth middleware ─── */
function requireAuth(req, res, next) {
  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

/* ══════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════ */

/**
 * POST /api/register
 * body: { name, email, password, department, designation }
 */
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, department, designation } = req.body;

    /* ── Validation ── */
    if (!name || !name.trim())
      return res.status(400).json({ error: 'Please enter your full name.' });
    if (!email || !email.includes('@'))
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!password || password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const key = email.trim().toLowerCase();
    const db  = readMentors();

    /* ── Duplicate check ── */
    if (db[key])
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });

    /* ── Hash password & save ── */
    const hashed = await bcrypt.hash(password, 10);
    const id     = 'M_' + Date.now();
    const mentor = {
      id,
      name:        name.trim(),
      email:       key,
      password:    hashed,
      department:  department  || 'CSE',
      designation: (designation && designation.trim()) ? designation.trim() : 'Mentor',
      createdAt:   new Date().toISOString()
    };
    db[key] = mentor;
    writeMentors(db);

    /* ── Issue JWT ── */
    const token = jwt.sign({ id: mentor.id, email: mentor.email }, SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      success: true,
      token,
      mentor: { id: mentor.id, name: mentor.name, email: mentor.email, department: mentor.department, designation: mentor.designation }
    });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/**
 * POST /api/login
 * body: { email, password }
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Please enter your email and password.' });

    const key    = email.trim().toLowerCase();
    const db     = readMentors();
    const mentor = db[key];

    if (!mentor)
      return res.status(404).json({ error: 'No account found with this email. Please register first.' });

    const match = await bcrypt.compare(password, mentor.password);
    if (!match)
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });

    const token = jwt.sign({ id: mentor.id, email: mentor.email }, SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      token,
      mentor: { id: mentor.id, name: mentor.name, email: mentor.email, department: mentor.department, designation: mentor.designation }
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/**
 * GET /api/me  — validate token, return mentor profile
 */
app.get('/api/me', requireAuth, (req, res) => {
  try {
    const db     = readMentors();
    const mentor = Object.values(db).find(m => m.id === req.user.id);
    if (!mentor) return res.status(404).json({ error: 'Account not found.' });
    res.json({ id: mentor.id, name: mentor.name, email: mentor.email, department: mentor.department, designation: mentor.designation });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

/* ══════════════════════════════════════════════
   STUDENT ROUTES  (all protected)
══════════════════════════════════════════════ */

/** GET /api/students — fetch all students belonging to logged-in mentor */
app.get('/api/students', requireAuth, (req, res) => {
  try {
    const all  = readStudents();
    const mine = all.filter(s => s.mentorId === req.user.id);
    res.json(mine);
  } catch (err) {
    res.status(500).json({ error: 'Could not load students.' });
  }
});

/** POST /api/students — add a new student */
app.post('/api/students', requireAuth, (req, res) => {
  try {
    const all     = readStudents();
    const student = { ...req.body, id: 'S' + Date.now(), mentorId: req.user.id };
    all.push(student);
    writeStudents(all);
    res.status(201).json({ success: true, student });
  } catch (err) {
    res.status(500).json({ error: 'Could not save student.' });
  }
});

/** PUT /api/students/:id — update a student */
app.put('/api/students/:id', requireAuth, (req, res) => {
  try {
    const all = readStudents();
    const idx = all.findIndex(s => s.id === req.params.id && s.mentorId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Student not found.' });
    all[idx] = { ...req.body, id: req.params.id, mentorId: req.user.id };
    writeStudents(all);
    res.json({ success: true, student: all[idx] });
  } catch (err) {
    res.status(500).json({ error: 'Could not update student.' });
  }
});

/** DELETE /api/students/:id — remove a student */
app.delete('/api/students/:id', requireAuth, (req, res) => {
  try {
    const all      = readStudents();
    const filtered = all.filter(s => !(s.id === req.params.id && s.mentorId === req.user.id));
    if (filtered.length === all.length) return res.status(404).json({ error: 'Student not found.' });
    writeStudents(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete student.' });
  }
});

/* ─── Catch-all: serve the frontend ─── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ─── Start server ─── */
app.listen(PORT, () => {
  console.log('\n╔═════════════════════════════════════════╗');
  console.log('║   🎓  EduTrack Mentor Portal             ║');
  console.log('╠═════════════════════════════════════════╣');
  console.log(`║   Running at: http://localhost:${PORT}      ║`);
  console.log(`║   Data dir:   ./data/                   ║`);
  console.log('║   Press Ctrl+C to stop                  ║');
  console.log('╚═════════════════════════════════════════╝\n');
});
async function registerMentor() {

const name = document.getElementById("name").value;
const email = document.getElementById("email").value;
const department = document.getElementById("department").value;
const designation = document.getElementById("designation").value;
const password = document.getElementById("password").value;

const { data, error } = await supabase
.from("mentors")
.insert([
{
name,
email,
department,
designation,
password
}
]);

if(error){
alert("Registration failed");
console.log(error);
}
else{
alert("Account created successfully");
}

}
