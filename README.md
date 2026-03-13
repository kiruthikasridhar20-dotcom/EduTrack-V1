# 🎓 EduTrack Mentor Portal

A complete mentor-student management portal with a **Node.js + Express backend** for persistent login across browser sessions.

---

## ✅ What was fixed

| Problem | Fix |
|---|---|
| "No account found" after reopening browser | Accounts are now stored **server-side** in `data/mentors.json` — never lost on browser close |
| Passwords stored in plain text | Passwords are now **bcrypt-hashed** before saving |
| Session lost on refresh | A **JWT token** (30-day expiry) is stored in localStorage — auto-login on return |
| Students lost on browser clear | Students saved to **`data/students.json`** on the server |

---

## 🚀 How to run (VS Code)

### Step 1 — Install dependencies
Open a terminal in this folder and run:
```
npm install
```

### Step 2 — Start the server
```
npm start
```

### Step 3 — Open in browser
```
http://localhost:3000
```

That's it! Register a mentor account, close the browser, reopen — your login will persist.

---

## 📁 Project structure

```
edutrack/
├── server.js          ← Express backend (Auth + Student API)
├── package.json       ← Dependencies
├── data/
│   ├── mentors.json   ← All mentor accounts (auto-created)
│   └── students.json  ← All student records (auto-created)
└── public/
    └── index.html     ← Full frontend (unchanged visually)
```

---

## 🔌 API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/register` | Create a new mentor account |
| POST | `/api/login` | Login and receive JWT |
| GET | `/api/me` | Verify token, get mentor info |
| GET | `/api/students` | Get all students for logged-in mentor |
| POST | `/api/students` | Add a new student |
| PUT | `/api/students/:id` | Update a student |
| DELETE | `/api/students/:id` | Delete a student |

---

## 🔐 Security

- Passwords hashed with **bcrypt** (salt rounds: 10)
- JWT tokens expire in **30 days**
- Each mentor can only access **their own students**
- Tokens are verified on every protected API call

---

## 🧪 Demo account

After starting, you can register any new account. There is no hardcoded demo account — all accounts persist permanently in `data/mentors.json`.
