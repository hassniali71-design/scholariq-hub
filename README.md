# EduFlow Suite

SYSTEM INSTRUCTION & EXECUTION PROTOCOL FOR AI DEVELOPER (LOVABLE / CLINE)

PROJECT CRITICALITY & PURPOSE:

You are building an Enterprise-Grade Educational Center ERP & LMS platform. This is a production-ready application designed to automate educational centers with strict in-class timers, zero-excuse parent monitoring, and multi-tenant capabilities. Every single line of code must be clean, modular, fully typed (TypeScript), and thoroughly structured.

DEVELOPMENT & HANDOVER WORKFLOW:

1. Local-First Architecture: Assume this repository will be cloned and executed locally on VS Code using Node.js and Vite/React.

2. Modular Codebase: Write self-contained, highly structured components, utility functions, and custom hooks. DO NOT dump massive code into single files. Separate UI components, types (`types/index.ts`), Supabase client setups (`lib/supabase.ts`), and static mocks.

3. Credit Exhaustion Protocol (Seamless Handover):

   - If execution stops or credit/token limits are reached at any point, the project state MUST remain fully buildable and runnable (`npm run dev` should never break).

   - Ensure all pending changes are committed cleanly to the connected GitHub repository so the developer can seamlessly pull the code into VS Code and continue editing with local AI tools (e.g., Cline / Cursor).

STRICT UI & VISUAL IDENTITY RULES:

- Layout: Pure Clean White Canvas (#FFFFFF / #F8FAFC) with Deep Royal Navy Blue Sidebar (#1E3A8A).

- Typography: ALL Arabic UI text, labels, titles, descriptions, and KPI stats MUST use BOLD Typography (Font Weight: 700 to 900) with ultra-high contrast dark colors (#0F172A) for maximum readability on smart displays.

- Cards: Crisp high-contrast dashboard cards with 2px borders (`border-2 border-slate-300`).

REQUIRED CORE MODULES TO BUILD:

1. Super Admin / Owner Control Tower: Analytics, Financial flow, Teacher compliance SLA timers.

2. Staff / Secretary Gate: High-speed QR/Barcode check-in, cashier, shift closing.

3. Teacher In-Class Mode: Fullscreen presenter view with 4-step timers (10m Homework, PDF Lesson presentation, 60s Random Question Picker per student, Assignment release).

4. Student & Parent Portals: Attendance charts, real-time scorecards, gamification points, and WhatsApp activity logs.

5. Supabase Multi-Tenancy: Auth & Row Level Security (RLS) setup using `center_id`.

Analyze the complete architecture, read every specification carefully, and implement all modules exhaustively.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://scholariq-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/51a9760b-15a8-4d21-a590-901397fe002b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
