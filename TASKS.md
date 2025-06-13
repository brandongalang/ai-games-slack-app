# AI Games Slack App - Development Tasks

Progress: **5 of 26 tasks complete (19%)**

## ✅ Completed Tasks

### Task 1: Project Setup and Initialization ✅
**Priority:** High | **Dependencies:** None  
Set up the initial project structure, including the Git repository, Slack App configuration, Supabase project, and a basic Bolt.js application scaffold.

### Task 2: Database Schema Implementation ✅  
**Priority:** High | **Dependencies:** Task 1  
Define and implement the PostgreSQL database schema in Supabase based on the PRD.

### Task 3: Implement `/submit` Slash Command and Modal ✅
**Priority:** High | **Dependencies:** Task 1, 2  
Implement the `/submit` slash command, including the modal for input and saving submission data to the database. Handle optional file uploads.

### Task 4: Basic XP Awarding for Submission ✅
**Priority:** High | **Dependencies:** Task 2, 3  
Implement the basic XP awarding mechanism when a user submits a prompt/workflow.

### Task 6: Setup Cloud Run for LLM Services ✅
**Priority:** Medium | **Dependencies:** Task 1  
Set up the Cloud Run (or Fly.io) environment for hosting LLM service functions.

---

## 🔄 Currently In Progress

### Task 11: Implement 'Remix this' Message Shortcut 🔄
**Priority:** Medium | **Dependencies:** Task 3  
Implement the 'Remix this' message shortcut to pre-fill the `/submit` modal and preserve lineage.

---

## 📋 Pending Tasks

### Task 5: Implement Slack Home Tab - Personal View (Basic)
**Priority:** Medium | **Dependencies:** Task 1, 2, 4  
Develop the initial Slack Home Tab view displaying personal XP, current streak (initially 0), and season timer/progress.

### Task 7: Implement LLM Clarity Scorer
**Priority:** Medium | **Dependencies:** Task 2, 3, 6  
Implement the LLM-based clarity scorer for submitted prompts. This includes an API endpoint and asynchronous invocation.

### Task 8: Implement Weekly Prompt Challenge
**Priority:** Medium | **Dependencies:** Task 1, 2  
Implement the weekly prompt challenge, including scheduling the Monday post and storing seed prompts.

### Task 9: Implement Streak Calculation & Daily Nudge DM
**Priority:** Medium | **Dependencies:** Task 2, 4  
Implement streak calculation logic and the daily nudge DM for inactive users.

### Task 10: Implement `/status` Slash Command
**Priority:** Medium | **Dependencies:** Task 2, 4, 5, 9  
Implement the `/status` slash command to show personal XP, badges (placeholder initially), and season progress in a DM.

### Task 12: Implement LLM Similarity/Remix Detector
**Priority:** Medium | **Dependencies:** Task 2, 3, 6  
Implement the LLM-based similarity/remix detector as a nightly batch process.

### Task 13: Implement Full XP Event Logic
**Priority:** High | **Dependencies:** Task 2, 4, 7, 9, 11, 12  
Implement the complete set of XP event rules and integrate them into the system.

### Task 14: Implement LLM Helpful Comment Judge
**Priority:** Medium | **Dependencies:** Task 2, 6  
Implement the LLM-based helpful comment judge.

### Task 15: Enhance Home Tab & /status with Full Data
**Priority:** Medium | **Dependencies:** Task 5, 10, 13  
Update the Slack Home Tab and `/status` command to reflect full XP, streak, and badge information.

### Task 16: Implement Team Leaderboard on Home Tab
**Priority:** Medium | **Dependencies:** Task 2, 5, 13  
Implement the team leaderboard on the Home Tab, showing top 3 users. Consider forking slack-gamebot2 for rank endpoints.

### Task 17: Implement Badge System & Slack Profile Update
**Priority:** Medium | **Dependencies:** Task 2, 13  
Implement the badge system, including logic for earning badges and updating user profiles with emoji via Slack API.

### Task 18: Implement Prompt Library MVP
**Priority:** Medium | **Dependencies:** Task 2, 3, 7  
Develop the MVP of the Prompt Library: a read-only, searchable list of prompts, hosted possibly as a Supabase-portal or simple React app, with RLS. Implement `/library` command.

### Task 19: Implement LLM Digest Writer
**Priority:** Medium | **Dependencies:** Task 2, 6, 13  
Implement the LLM-based digest writer for summarizing top prompts for weekly/Friday digests.

### Task 20: Implement Scheduled Digest Posts
**Priority:** Medium | **Dependencies:** Task 1, 2, 8, 16, 19  
Implement scheduled digest posts for Wednesday (mid-week recap) and Friday (season-style digest).

### Task 21: Implement Season Management Logic
**Priority:** Medium | **Dependencies:** Task 2, 4  
Implement season management logic, including starting/ending seasons and handling XP decay if applicable.

### Task 22: Implement User Onboarding and Notification Preferences
**Priority:** Low | **Dependencies:** Task 1, 2, 9  
Implement user onboarding DM for first-time app use and notification preferences (e.g., opt-out for streak DMs).

### Task 23: Finalize Security and Privacy Features
**Priority:** High | **Dependencies:** Task 2, 3, 18  
Finalize security measures, including comprehensive Supabase Row Level Security policies and PII handling.

### Task 24: Containerize Application and Setup Deployment
**Priority:** High | **Dependencies:** Task 1, 6, 23  
Containerize the Bolt.js application and LLM services (if separate) and set up deployment pipelines for Cloud Run or Fly.io.

### Task 25: Create Onboarding Documentation and Admin Config
**Priority:** Low | **Dependencies:** Task 22  
Create onboarding documentation for users and basic admin configuration guides. Address any remaining polish items.

### Task 26: Comprehensive Testing, Bug Fixing, and Optimization
**Priority:** Medium | **Dependencies:** All previous tasks  
Conduct comprehensive end-to-end testing, fix identified bugs, and optimize performance based on usage patterns and NFRs.

---

## Task Dependencies Graph

```
1 → 2 → 3 → 4
│   │   │   │
│   │   └── 11 → 13
│   │           │
│   └── 5 ────── 15, 16
│       │
└── 6 → 7, 12, 14, 19
        │
        └── 13 → 15, 16, 17, 20

23 ← 2, 3, 18
24 ← 1, 6, 23
25 ← 22
26 ← ALL
```

## Notes

- Tasks marked with ✅ are complete and committed to the repository
- Tasks marked with 🔄 are currently being worked on
- Priority levels: High (critical path), Medium (important features), Low (polish/documentation)
- Dependencies must be completed before a task can begin