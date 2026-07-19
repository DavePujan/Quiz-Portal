# 🖥️ QuizPortal Client (React SPA)

The frontend client for the **QuizPortal** platform. It provides role-based interfaces for students, teachers, admins, and master admins, integrating a coding workspace with real-time feedback and detailed telemetry visualization.

---

## 🎨 Design System & Styling
- **Tailwind CSS 4**: Utilizes the modern CSS-first Tailwind engine.
- **Glassmorphism / Sleek Dark Mode**: Designed with custom CSS rules in [common.css](file:///e:/z_projects/Quiz%20Portal/leetcode-clone/frontend/src/styles/common.css) for a premium, high-tech interface.
- **Iconography**: Powered by **Lucide React** for smooth, lightweight UI iconography.
- **Micro-animations**: Enhanced interactive buttons, transitions, and hover states.

---

## 📂 Key Directory Layout

```text
frontend/
├── public/                 # Static assets (favicons, logos)
├── src/
│   ├── auth/               # Auth handling (Login, Register, Password Reset)
│   ├── components/         # Reusable UI widgets (Sidebar, Modal, Loader)
│   ├── context/            # AuthContext & state store
│   ├── layouts/            # Navigation wrapper and responsive dashboard layouts
│   ├── pages/              # Role-based panels and views
│   │   ├── admin/          # Admin panels: User management, Audit logs, Requests
│   │   ├── master/         # Master admin dashboards
│   │   ├── student/        # Code editor workspace, Leaderboard, Quizzes history
│   │   └── teacher/        # Quiz builder, Evaluations, Analytics view
│   ├── styles/             # Global CSS variables and glassmorphism definitions
│   ├── utils/              # Axios instance and API call wrappers
│   ├── App.jsx             # Main routing registry & entrypoint
│   └── main.jsx            # React root injection point
└── package.json            # Scripts, DevDependencies, and dependencies
```

---

## 🛠️ Main Components & Views

### 1. 👨‍💻 Student Code Sandbox (`AttemptQuiz.jsx`)
- Integrates **Monaco Editor** for writing code.
- Options to choose languages (C, C++, Java, Python, Javascript).
- Triggers background compilation and runs test cases, displaying output and performance indicators.

### 2. 👩‍🏫 Quiz Builder (`QuizBuilder.jsx` / `CreateQuiz.jsx`)
- Supports dynamic addition of multiple-choice questions (MCQs), descriptive text questions, and functional coding challenges.
- Integrates semantic topic extraction via Groq AI classification on question submission.

### 3. 📊 Visual Analytics (`QuizAnalytics.jsx`)
- Visualizes assessment grades using **Recharts**.
- Displays standard deviation, score distribution density histograms, and average scores per educational topic.

---

## 🚦 Local Startup

### 1. Install dependencies:
```bash
npm install
```

### 2. Configure Environment:
Create `.env` at the root of `leetcode-clone/frontend/`:
```env
VITE_API_URL=http://localhost:5000
```

### 3. Start development server:
```bash
npm run dev
```
The client app runs on [http://localhost:5173](http://localhost:5173).

---

## 🧪 Testing & Linting
- **Linting check**: `npm run lint` (runs ESLint with type-aware parameters).
- **Run frontend checks**: `npm run test:runner`.
