# Movie & TV Show Tracker

A lightweight, private, client-side web application to track movies and TV shows, manage your watchlist, log watched episodes, and stay up to date on upcoming releases—with zero cloud lock-in.

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Dexie.js (IndexedDB)**.

---

## ✨ Features

- **🔍 TV Show Discovery**: Search shows in real-time with debounced queries via the TVMaze API. View posters, premier dates, genres, networks, and complete season/episode guides.
- **🎬 Standalone Movie Tracking**: Add movies manually with release years, genres, and overviews. Mark movies as watched with a single-click toggle.
- **📺 Active Watching Dashboard**:
  - Displays your **Currently Watching** titles with dynamic progress indicators and next episode badges (e.g. `S01E03`).
  - **Single-Click Quick Increment (`+1 Episode`)**: Instantly mark your next episode as watched from the card, with automated season rollover and series completion.
- **📅 Upcoming Air Dates**: Highlights next episode air dates for ongoing and in-season shows directly on show cards and in detail views.
- **📑 Interactive Episode Checklist**:
  - Detailed modal view with tabs for every season and checklists for each episode.
  - Check or uncheck individual episodes to adjust your progress at any time.
- **🏷️ Library Management Across Status Tabs**:
  - **Currently Watching**: Active shows and movies with immediate progress tracking.
  - **Watchlist (Plan to Watch)**: Queued titles ready to start.
  - **Completed**: Finished series and movies.
  - **Dropped**: Abandoned or paused titles.
- **⭐ Personal Ratings & Notes**: Assign 1–10 numerical ratings and write personal notes with debounced autosaving.
- **💾 Local-First & 100% Client-Side (ADR-0001)**:
  - All tracking data, episode progress, ratings, and notes persist securely in your browser's IndexedDB via Dexie.js.
  - No account creation, no external database dependencies, and no telemetry.
- **📦 Backup Export & Import**:
  - Export your complete library to a standalone JSON file anytime.
  - Import JSON backups with strict schema validation and error reporting.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (Turbopack, App Router)](https://nextjs.org/)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Local Storage**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper) & `dexie-react-hooks`
- **Testing**: [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/) & `fake-indexeddb`
- **Linting**: [ESLint 9](https://eslint.org/)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.18.0 or newer
- **npm**: v9.0.0 or newer

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/sourabh-kanwade/ai-show-tracker.git
   cd ai-show-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

The test suite includes comprehensive unit and integration tests covering the database store, TVMaze client, backup serialization, and UI components:

```bash
# Run entire test suite (191 tests)
npm test

# Run tests in watch mode
npm run test:watch

# Type check TypeScript without emitting
npx tsc --noEmit

# Run ESLint
npm run lint

# Compile production build
npm run build
```

---

## 📚 Domain Glossary

The project adheres to unified domain terminology defined in [`GLOSSARY.md`](./GLOSSARY.md):

| Term | Definition |
| :--- | :--- |
| **Title** | A movie or TV show tracked in the application. |
| **Watch Status** | The state of a title: `Watching`, `Plan to Watch`, `Completed`, or `Dropped`. |
| **Watchlist** | The user's collection of saved titles with the `Plan to Watch` status. |
| **Episode Progress** | The record of individual seasons and episodes marked as watched for a title. |
| **Quick Increment** | Single-click action on an active card to mark the next episode as watched. |
| **Rating** | Personal numerical evaluation on a 1–10 scale. |
| **Personal Notes** | Freeform text field for personal thoughts, quotes, or reminders. |

---

## 🏛️ Architectural Decisions

- **[ADR-0001: Client-Side Browser Storage and No AI](docs/adr/0001-client-side-browser-storage-and-no-ai.md)**: All data remains local in IndexedDB; no external cloud database or runtime LLM dependencies are used, ensuring user privacy and instant performance.

---

## 📄 License

This project is licensed under the MIT License.
