# Lost Paint Studios — Studio Control Center

An all-in-one studio management web application engineered specifically for **Lost Paint Studios**. Built to empower the founders (**BuildwithKevin** and **AquaMiletYT**) and the 13-member international development team to manage tasks, team workloads, chapter roadmaps, daily dev logs, bug tracking, knowledge base documentation, Instagram marketing pipelines, gameplay recording sessions, Excel exports/imports, and database backups.

---

## 1. Studio & Project Context

- **Studio:** Lost Paint Studios
- **Game Title:** *Untitled Psychological Horror Game* (Game Title TBD)
- **Engine:** Unity URP (Universal Render Pipeline)
- **Target Platforms:** Steam / PC & Google Play / Android
- **Hardware Targets:** Low-end PCs (Intel Iris Xe / GTX 1050) and low-end Android devices (Snapdragon 680 / 4GB RAM)
- **Production Status:** Early Pre-Production (Sprint to Vertical Slice)
- **Target Experience:** 3–5 hours single-player atmospheric psychological horror & environmental mystery
- **Narrative Arc:** James Walker, an investigative photographer, visits the Miller family's abandoned farmhouse following an anonymous delivery of negatives. Environmental clues, Daniel Miller's obsession with an unearthed obsidian object, and basement excavation discoveries unravel the supernatural tragedy.
- **First Studio Priority:** A playable, coherent **Chapter 1 Opening / Vertical Slice**.

---

## 2. Team Roster (13 Core Members Seeded)

The system automatically initializes these 13 members in the database with their respective countries, flags, roles, and recording privileges:

1. 🇮🇳 **BuildwithKevin** — Basic UI Designing, Level Design, Visual Scripting, Main Founder.
2. 🇮🇳 **AquaMiletYT** — Story Writing, Design Support, Main Founder, Management.
3. 🇱🇧 **Hsein** — Main Designing, Substitute Visual Scripter.
4. 🇳🇬 **AuraKkboo** — Main Visual Scripter *(Approved for Gameplay Recording)*.
5. 🇳🇬 **Tobyosnow** — Assistant Designer, Story Ideas *(Approved for Gameplay Recording)*.
6. 🇮🇳 **Survivor** — Bug/Glitch Finding, Game Testing, Marketing, Trailer Creation, Social Media Management; Marketing and Industry Head *(Approved for Gameplay Recording)*.
7. 🇺🇸 **Steve** — Coding Support, Editing, Trailer Creation, Gameplay Recording, Shorts/Instagram content *(Approved for Gameplay Recording)*.
8. 🇭🇰 **Mach Studios** — 3D Modelling, Design, Texturing.
9. 🇲🇾 **Raffie0_0** — Music Artist.
10. 🇮🇳 **S4mmy** — Coding Assistance, Music Artist, Creative Assistant.
11. 🇮🇳 **Kite** — Coder.
12. 🇮🇳 **Raphaelle** — Designer.
13. 🇮🇳 **Rosie** — Basic Menu Designer.

*Note: Member profiles are maintained separately from authentication accounts. All names, countries, and roles remain fully editable by authorized users.*

---

## 3. Technology Architecture

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Backend:** Node.js, Express, TypeScript, Zod schema validation, express-rate-limit.
- **Database:** SQLite with Write-Ahead Logging (WAL) and foreign keys via `better-sqlite3`.
- **Operational Workbook:** ExcelJS for multi-sheet `.xlsx` exports, template generation, and transactional imports.
- **Authentication & Security:** bcrypt password hashing, HTTP-only secure cookie sessions, JWT, role-based authorization guards (`admin`, `editor`, `viewer`), tamper-evident audit logging.

---

## 4. Main Application Modules (13 Sections)

1. **Studio Dashboard:** Live metrics calculated strictly from SQLite queries (open/completed/overdue tasks, chapter progress, team workload, bugs by severity, active blockers, upcoming deadlines).
2. **Tasks:** Kanban board and table views with category filtering, subtask checklists, comments stream, and acceptance criteria.
3. **Chapters & Roadmap:** 5 planned roadmap blocks (Days 1–20 Chapter 1 Opening vertical slice, Days 21–40 Farmhouse, Days 41–60 Farmhouse Mystery, Days 61–80 Daniel's Story, Days 81–100 Finale). Progress is calculated from linked task completion.
4. **Team:** Roster cards with country flags, roles, skill pills, workload metrics, and single-use account invitation links.
5. **Calendar / Time Blocks:** Scheduling for work sessions, team meetings, playtests, and milestone deadlines.
6. **Development Logs:** Standardized daily standup logs (Done, In Progress, Blocked, Next Steps, Notes) with timeline filtering.
7. **Bug Tracker & QA:** Glitch logging by severity (Critical, High, Medium, Low), reproduction steps, expected vs actual results, and status workflows.
8. **Documents / KB:** Internal markdown knowledge base with revision history for GDD pillars, narrative canon, and URP mobile optimization rules.
9. **Marketing & Social Media:** Instagram reel and post planner led by Survivor (Marketing & Industry Head), draft captions, review approvals, and publication tracking.
10. **Video, Trailer & Gameplay Production:** Capture pipeline for trailers, edits, and raw gameplay recordings assigned to approved leads (Steve, AuraKkboo, Tobyosnow, Survivor).
11. **Change Log / Activity:** Tamper-evident operational audit log recording user actions and security events.
12. **Data Import / Export:** Download operational `.xlsx` workbooks, templates, and perform transactional imports with safety backups. Includes Notion API gateway and manual JSON import routes.
13. **Settings / Backups:** Studio identity, game title placeholder, user role administration, disk snapshots, and direct SQLite database backup downloads.

---

## 5. Quick Start (Run Locally)

### Prerequisites
- Node.js v18+ (tested on Node v22.19.0)
- npm v10+

### One-Command Setup & Launch
Clone or navigate to the repository directory:
```bash
cd lost-paint-control-center
```

Install root, backend, and frontend dependencies:
```bash
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

Start both backend API (`:5000`) and frontend client (`:5173`) concurrently:
```bash
npm run dev
```

Visit the app in your browser at:
👉 **`http://localhost:5173`**

---

## 6. Initial Administrator Setup Flow

1. On first launch, the app detects that no user accounts exist yet and displays the **Founder Setup Modal**.
2. Select your founder identity (**BuildwithKevin** or **AquaMiletYT**), enter your email and a password (min 8 characters).
3. Click **Initialize Owner Account** — this creates the primary `admin` account with full permissions.
4. From the **Team** or **Settings** view, admins can generate secure, single-use invite tokens (valid 7 days) to onboard other team members as `editor` or `viewer`.

---

## 7. Verification & Automated Testing

Run the full integration test suite:
```bash
npm test
```

Run TypeScript strict checks across both client and server:
```bash
npm run typecheck
```

Build production bundles for deployment:
```bash
npm run build
```

---

## 8. Database Persistence & Disaster Recovery

- **Database Location:** `server/data/lost_paint.db`
- **Persistence:** SQLite WAL mode ensures transactional consistency across server restarts.
- **Manual Backup:** Admins can click **Download Live SQLite DB (.db)** from the Settings page to trigger a WAL checkpoint and download a clean, standalone database snapshot.
- **Safety Backups:** Every Excel import or manual data sync automatically makes a timestamped backup copy on disk before committing changes.
- **Restoration:**
  1. Stop the server process.
  2. Replace `server/data/lost_paint.db` with your `.db` backup file.
  3. Delete any stale `lost_paint.db-wal` or `lost_paint.db-shm` files.
  4. Start the server (`npm run dev`).

---

## 9. Notion Information Integration Pathway

The public Notion source page for the studio is:
[PAINT-STUDIOS-INFOS (Notion)](https://mountainous-mouse-69.a.notion.site/PAINT-SUDIOS-INFOS-3e140812c09680fdbffbf5256cfc82ee)

Two supported paths are implemented:
1. **Official Notion API:** Configure your `NOTION_TOKEN` internal integration secret and `NOTION_PAGE_ID` in the Settings tab. Use the "Test Notion API Connection" button to verify credentials with Notion's servers.
2. **Manual JSON / Markdown Pathway:** When an API token is not yet configured, use the Data Import view to paste exported JSON arrays for tasks or documents without risking page scraping or permission blocks.
