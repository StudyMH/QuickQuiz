# ⚡ QuickQuiz By StudySphere

> **High-Performance, Mobile-First PWA for MPSC Aspirants**

QuickQuiz is a clean, offline-capable Progressive Web App (PWA) designed to provide Maharashtra Public Service Commission (MPSC) students with instant, authentic practice questions. Powered by the low-latency **Google Gemini Flash** engine, it delivers responsive quizzes, complete bilingual support (Marathi & English), and structured question analysis without visual clutter or unnecessary scrolling.

---

### 🚀 Key Features

- **⚡ Low-Latency Practice Engine:** Instant question generation powered by Gemini client-side architecture.
- **🌐 100% Bilingual Interface:** Full toggle between Marathi (मराठी) and English for question headlines, multi-statement lists, comparative tables, and options.
- **📱 Mobile-First PWA:** Native-app look and feel with full offline accessibility via Service Worker and web app manifest.
- **🎯 Authentic MPSC Formats:** Supports Standard MCQs, Multi-Statement questions (अ, ब, क, ड), and Match-the-Pairs tables matching current exam standards.
- **💾 Offline Vault & Dashboard:** Save difficult questions locally, run interactive drills, and back up/restore practice history via JSON.
- **🔒 Zero-Tracking Privacy:** Works entirely client-side; user progress, streaks, and API credentials are kept strictly in local storage.

---

### 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, Tailwind CSS
- **App Architecture:** Progressive Web App (PWA), Service Workers, LocalStorage / SessionStorage
- **AI Integration:** Google Gemini API (`generativelanguage.googleapis.com`)
- **Export & Utilities:** `html2canvas` (clean question snapshots), JSON-based state backups
