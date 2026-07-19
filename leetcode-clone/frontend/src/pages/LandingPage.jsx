import React, { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/authStore";
import { 
  Code, 
  BookOpen, 
  ShieldCheck, 
  Terminal, 
  Trophy, 
  BarChart3, 
  Cpu, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Sparkles,
  Activity,
  Database,
  FileText,
  Users,
  Zap,
  Lock,
  Eye,
  Timer,
  GraduationCap,
  Minus,
  PenLine,
  Send,
  ClipboardList,
  Search,
  Coffee,
  Heart
} from "lucide-react";

/* ─── Tiny reusable pieces ─── */
const Pill = ({ children, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full ${className}`}>
    {children}
  </span>
);

const FeaturePoint = ({ icon: Icon, title, desc, color = "text-primary" }) => (
  <div className="flex items-start gap-3 group">
    <div className={`mt-0.5 shrink-0 ${color}`}><Icon size={16} strokeWidth={2.5} /></div>
    <div>
      <p className="font-semibold text-white text-[13px] leading-snug">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const { theme, toggleTheme } = useContext(AuthContext);

  const faqs = [
    { q: "How are programming exams evaluated?", a: "Submissions are compiled and run automatically against multiple private test cases using sandboxed compilation servers, checking for correctness, execution time, and memory limits." },
    { q: "Can we conduct both theory MCQs and coding questions in the same quiz?", a: "Yes, QuizPortal supports mixed-format exams. You can combine multiple-choice questions, descriptive theory answers, and interactive coding challenges in a single quiz." },
    { q: "How does the system handle power cuts or sudden tab closes during an exam?", a: "Student progress is auto-saved in real-time. If a student's system restarts or the browser closes, they can log back in and resume the exam right where they left off without losing their code." },
    { q: "Does QuizPortal prevent cheating?", a: "Yes, the platform includes proctoring constraints like fullscreen enforcement, copy-paste blocking, and tab-switch tracking, which notifies coordinators of any unauthorized browser actions." },
  ];

  return (
    <div className="min-h-screen bg-background text-main flex flex-col font-sans transition-colors duration-300">

      {/* ━━━ NAV ━━━ */}
      <header className="border-b border-gray-800/10 bg-background/80 backdrop-blur-lg sticky top-0 z-50 px-6">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-purple-600 tracking-tight">
            QuizPortal
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/request-access" className="text-sm text-gray-500 hover:text-white transition-colors hidden md:inline-block font-medium">
              Register
            </Link>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-white border border-gray-800/10 hover:border-gray-800/20 transition-all cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/login" className="btn-primary px-4 py-2 text-sm font-semibold rounded-lg">
              Login
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ━━━ HERO ━━━ */}
        <section className="relative overflow-hidden">
          {/* Subtle grid bg */}
          <div className="absolute inset-0 bg-grid mask-radial pointer-events-none"></div>

          <div className="relative z-10 pt-24 pb-20 px-6 max-w-5xl mx-auto text-center">
            <Pill className="bg-primary/8 text-primary border border-primary/15 mb-8">
              <Zap size={11} className="text-primary inline-block mr-1.5 align-middle" />
              <span className="align-middle">Less Ctrl+C. Less Ctrl+V. More Intelligence.</span>
            </Pill>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
              Stop grading code <br className="hidden sm:block" />
              by hand.
            </h1>

            <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6 leading-relaxed">
              QuizPortal gives your department a proper coding exam platform — sandboxed compilers, 
              automatic test-case grading, and a dashboard that actually makes sense.
            </p>

            <p className="text-sm text-gray-400 font-semibold mb-10">
              Because it's 2026, not 1998. Goodbye, Turbo C.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-3 max-w-sm mx-auto mb-6">
              <Link to="/request-access" className="btn-primary px-6 py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
                Get started <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="px-6 py-3 text-sm font-semibold text-gray-400 hover:text-white border border-gray-800/15 hover:border-gray-800/30 rounded-lg transition-colors text-center">
                Login
              </Link>
            </div>
            <p className="text-xs text-gray-600">No credit card required · Free for students</p>
          </div>
        </section>

        {/* ━━━ PRODUCT PREVIEW ━━━ */}
        <section className="px-6 pb-24 -mt-4">
          <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden border border-gray-800/15 bg-background-layer1 shadow-2xl">
            {/* Window chrome */}
            <div className="bg-[#18181b] px-4 py-2.5 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ff5f57]"></span>
                <span className="w-3 h-3 rounded-full bg-[#febc2e]"></span>
                <span className="w-3 h-3 rounded-full bg-[#28c840]"></span>
                <span className="text-[11px] text-gray-500 ml-3 font-mono">quizportal.edu/exam/dsa-midterm</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-gray-400 font-medium">Connected</span>
              </div>
            </div>

            {/* Editor split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[440px]">
              {/* Problem pane */}
              <div className="lg:col-span-4 p-6 border-b lg:border-b-0 lg:border-r border-white/5 text-left bg-[#121214]">
                <Pill className="bg-blue-500/10 text-blue-400 border-0 mb-4 text-[10px]">DSA Midterm · Q1 of 5</Pill>
                <h3 className="text-base font-bold text-white mb-3">Valid Parentheses</h3>
                <p className="text-[13px] text-gray-400 leading-relaxed mb-6">
                  Given a string <code className="text-gray-300 bg-white/5 px-1 rounded text-[12px]">s</code> containing 
                  only <code className="text-gray-300 bg-white/5 px-1 rounded text-[12px]">{"(){}[]"}</code>, 
                  determine if the input string is valid.
                </p>
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div className="bg-white/3 rounded-lg p-2.5 border border-white/5">
                    <span className="text-gray-500 block mb-0.5">Time limit</span>
                    <span className="text-white font-semibold">1 000 ms</span>
                  </div>
                  <div className="bg-white/3 rounded-lg p-2.5 border border-white/5">
                    <span className="text-gray-500 block mb-0.5">Memory</span>
                    <span className="text-white font-semibold">64 MB</span>
                  </div>
                </div>
              </div>

              {/* Code pane */}
              <div className="lg:col-span-8 flex flex-col bg-[#1e1e1e]">
                {/* Tab bar */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 text-[11px]">
                  <div className="flex">
                    <span className="px-3 py-1.5 text-white border-b-2 border-primary font-medium flex items-center gap-1.5">
                      <Code size={11} className="text-primary" /> solution.cpp
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 bg-white/5 text-gray-400 rounded hover:bg-white/8 cursor-pointer transition-colors">Run</span>
                    <span className="px-2.5 py-1 bg-primary/90 text-white rounded cursor-pointer hover:bg-primary transition-colors font-medium">Submit</span>
                  </div>
                </div>

                {/* Code body */}
                <div className="flex-1 p-5 font-mono text-[12.5px] leading-[1.7] text-left overflow-x-auto">
                  <table className="border-collapse">
                    <tbody className="align-top">
                      <tr><td className="pr-5 text-gray-600 select-none text-right w-8">1</td><td><span className="text-[#c586c0]">#include</span> <span className="text-[#ce9178]">&lt;stack&gt;</span></td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">2</td><td><span className="text-[#c586c0]">#include</span> <span className="text-[#ce9178]">&lt;string&gt;</span></td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">3</td><td>&nbsp;</td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">4</td><td><span className="text-[#569cd6]">bool</span> <span className="text-[#dcdcaa]">isValid</span>(<span className="text-[#569cd6]">string</span> s) &#123;</td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">5</td><td>&nbsp;&nbsp;&nbsp;&nbsp;stack&lt;<span className="text-[#569cd6]">char</span>&gt; st;</td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">6</td><td>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#c586c0]">for</span> (<span className="text-[#569cd6]">char</span> c : s) &#123;</td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">7</td><td className="bg-primary/8 -mx-2 px-2 rounded">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#c586c0]">if</span> (c == <span className="text-[#ce9178]">'('</span>) st.push(c);</td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">8</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&#125;</td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">9</td><td>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#c586c0]">return</span> st.empty();</td></tr>
                      <tr><td className="pr-5 text-gray-600 select-none text-right">10</td><td>&#125;</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Console */}
                <div className="border-t border-white/5 bg-[#1a1a1e] px-5 py-3 text-[11px] flex flex-wrap gap-5">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 size={12} /> Test 1 passed <span className="text-gray-600">0ms</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 size={12} /> Test 2 passed <span className="text-gray-600">3ms</span>
                  </span>
                  <span className="text-gray-600 ml-auto">Memory: 8.2 MB</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ SOCIAL PROOF ━━━ */}
        <section className="py-10 border-y border-gray-800/10 text-center bg-background-layer1/20">
          <p className="text-sm text-gray-400 font-medium mb-6 italic">
            "Trusted by teachers, loved by students, tolerated by deadlines."
          </p>
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-xs font-bold uppercase tracking-wider text-gray-500/80">
            <span>Gujarat Technological University</span>
            <span>GEC Gandhinagar</span>
            <span>Engineering Colleges</span>
          </div>
        </section>

        {/* ━━━ HOW IT WORKS ━━━ */}
        <section className="py-28 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-4xl font-bold text-white">Exam day in five steps</h2>
              <p className="text-gray-500 mt-3 max-w-lg mx-auto">From writing the first question to reviewing final grades — here's the whole flow.</p>
            </div>

            {/* Workflow with circles + connector */}
            <div className="relative">
              {/* SVG curved dotted connector line — hidden on mobile */}
              <svg className="absolute top-[52px] left-0 w-full h-12 hidden md:block pointer-events-none" viewBox="0 0 1000 48" preserveAspectRatio="none">
                <path
                  d="M 100,24 C 175,48 225,0 300,24 S 425,48 500,24 S 625,0 700,24 S 825,48 900,24"
                  fill="none"
                  stroke="var(--border-main, rgba(255,255,255,0.08))"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                />
              </svg>

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-12 md:gap-4">
                {[
                  { n: 1, icon: PenLine,       title: "Create",  desc: "Write questions in the quiz builder",  bg: "bg-[#fef0e6]", ring: "ring-[#fddcc4]", color: "text-[#e07a3a]" },
                  { n: 2, icon: Send,           title: "Assign",  desc: "Share exam links with students",       bg: "bg-[#e6f5ef]", ring: "ring-[#b7e4cf]", color: "text-[#2da66a]" },
                  { n: 3, icon: Code,           title: "Solve",   desc: "Students code in the browser",         bg: "bg-[#fef7e6]", ring: "ring-[#fce9b8]", color: "text-[#c9930a]" },
                  { n: 4, icon: CheckCircle2,   title: "Grade",   desc: "Test cases run automatically",         bg: "bg-[#e6f0fe]", ring: "ring-[#bdd5fc]", color: "text-[#3b7fdb]" },
                  { n: 5, icon: Search,         title: "Analyze", desc: "Review scores and insights",            bg: "bg-[#eee6fe]", ring: "ring-[#d4c0fc]", color: "text-[#7c4ddb]" },
                ].map((step) => (
                  <div key={step.n} className="flex flex-col items-center text-center relative z-10">
                    {/* Step number badge */}
                    <span className="text-[11px] font-bold text-gray-500 mb-2">{step.n}</span>

                    {/* Pastel circle with icon */}
                    <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${step.bg} ring-2 ${step.ring} shadow-sm flex items-center justify-center mb-5 transition-transform hover:scale-105`}>
                      <step.icon size={28} strokeWidth={1.8} className={step.color} />
                    </div>

                    {/* Title + description */}
                    <h4 className="font-bold text-white text-sm mb-1">{step.title}</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed max-w-[150px]">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ FOR STUDENTS ━━━ */}
        <section className="py-28 px-6 border-t border-gray-800/10">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Copy */}
            <div className="space-y-6 order-1 lg:order-2">
              <Pill className="bg-primary/8 text-primary border border-primary/15">For students</Pill>
              <h2 className="text-3xl font-bold text-white leading-snug">Just open the browser<br /> and start coding.</h2>
              <p className="text-gray-500 leading-relaxed">
                No local setup. No SDK installs. Students get a full Monaco editor with syntax highlighting, 
                real-time test feedback, and a live leaderboard — all inside the browser.
              </p>
              <div className="space-y-4 pt-2">
                <FeaturePoint icon={Code} title="Monaco code editor" desc="The same editor that powers VS Code, running in the browser." />
                <FeaturePoint icon={Zap} title="Instant feedback" desc="Test cases run in under a second. Students see pass/fail immediately." />
                <FeaturePoint icon={ShieldCheck} title="Safe Exam Browser mode" desc="Enforce fullscreen lock, disable tab-switching, and block copy-paste during quiz sessions." />
                <FeaturePoint icon={Trophy} title="Live leaderboard" desc="Rankings update as students submit, keeping things competitive." />
              </div>
            </div>

            {/* Mockup */}
            <div className="rounded-xl overflow-hidden border border-gray-800/10 bg-[#121214] shadow-xl order-2 lg:order-1">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                <span className="font-mono">leaderboard.live</span>
                <Pill className="bg-yellow-500/10 text-yellow-400 border-0 text-[9px]">Exam in progress</Pill>
              </div>
              <div className="p-5 space-y-2.5 text-[12px]">
                {[
                  { rank: 1, name: "Patel Devraj", score: "980", pct: "100%", color: "text-primary" },
                  { rank: 2, name: "Shah Neil", score: "920", pct: "95%", color: "text-gray-400" },
                  { rank: 3, name: "Dave Pujan", score: "895", pct: "89%", color: "text-gray-400" },
                ].map((s) => (
                  <div key={s.rank} className="flex items-center justify-between bg-white/3 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${s.rank === 1 ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-500'}`}>{s.rank}</span>
                      <span className="text-white font-medium">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="text-emerald-400 font-medium">{s.pct}</span>
                      <span className={`font-bold ${s.color}`}>{s.score} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ FOR TEACHERS ━━━ */}
        <section className="py-28 px-6 bg-background-layer1/30 border-y border-gray-800/10">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Copy */}
            <div className="space-y-6">
              <Pill className="bg-purple-500/10 text-purple-400 border border-purple-500/20">For teachers</Pill>
              <h2 className="text-3xl font-bold text-white leading-snug">Grade smarter,<br />not harder.</h2>
              <p className="text-gray-500 leading-relaxed">
                Create mixed-format exams (MCQs + coding + descriptive), then let the platform handle grading. 
                When you need to review code yourself, a side-by-side diff viewer is one click away.
              </p>
              <div className="space-y-4 pt-2">
                <FeaturePoint icon={FileText} title="Unified quiz builder" desc="Combine different question types in a single exam." color="text-purple-400" />
                <FeaturePoint icon={BarChart3} title="Auto-grading" desc="Compiler-verified scoring with normalized grade curves." color="text-purple-400" />
                <FeaturePoint icon={Eye} title="Manual review panel" desc="Side-by-side code diffs, inline comments, and score overrides." color="text-purple-400" />
              </div>
            </div>

            {/* Mockup */}
            <div className="rounded-xl overflow-hidden border border-gray-800/10 bg-[#121214] shadow-xl">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                <span className="font-mono">grading_review.diff</span>
                <Pill className="bg-purple-500/10 text-purple-400 border-0 text-[9px]">Manual review</Pill>
              </div>
              <div className="p-5 space-y-4 text-[12px] font-mono">
                {/* Diff block */}
                <div className="bg-white/3 rounded-lg border border-white/5 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/5 text-[10px] text-gray-500 flex justify-between">
                    <span>Student: CS2026-A22</span>
                    <span className="text-emerald-400">+2 lines</span>
                  </div>
                  <div className="p-3 space-y-0.5 text-[11px]">
                    <div className="text-gray-600">@@ -15,3 +15,5 @@</div>
                    <div className="bg-red-500/8 text-red-400 -mx-3 px-3 py-0.5">
                      <Minus size={10} className="inline mr-1" />return false;
                    </div>
                    <div className="bg-emerald-500/8 text-emerald-400 -mx-3 px-3 py-0.5">+ if(st.empty()) return true;</div>
                    <div className="bg-emerald-500/8 text-emerald-400 -mx-3 px-3 py-0.5">+ else return false;</div>
                  </div>
                </div>
                {/* Score bar */}
                <div className="bg-white/3 rounded-lg p-3 border border-white/5">
                  <div className="flex justify-between text-[11px] mb-2">
                    <span className="text-white font-medium">Score</span>
                    <span className="text-purple-400 font-bold">22 / 25</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: "88%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ FOR ADMINS ━━━ */}
        <section className="py-28 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Copy */}
            <div className="space-y-6 order-1 lg:order-2">
              <Pill className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">For admins</Pill>
              <h2 className="text-3xl font-bold text-white leading-snug">One place to run <br />the whole system.</h2>
              <p className="text-gray-500 leading-relaxed">
                Approve registrations, audit every change, and configure auth providers — without touching a database console.
              </p>
              <div className="space-y-4 pt-2">
                <FeaturePoint icon={ShieldCheck} title="Access moderation" desc="Approve or reject sign-ups manually or set auto-approval rules." color="text-emerald-400" />
                <FeaturePoint icon={Activity} title="Audit trail" desc="Every admin action is logged with timestamps and user IDs." color="text-emerald-400" />
                <FeaturePoint icon={Lock} title="Auth configuration" desc="Toggle OAuth providers, session lengths, and cookie policies." color="text-emerald-400" />
              </div>
            </div>

            {/* Mockup */}
            <div className="rounded-xl overflow-hidden border border-gray-800/10 bg-[#121214] shadow-xl order-2 lg:order-1">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                <span className="font-mono">access_queue.json</span>
                <Pill className="bg-emerald-500/10 text-emerald-400 border-0 text-[9px]">2 pending</Pill>
              </div>
              <div className="p-5 space-y-3 text-[12px]">
                {[
                  { name: "Dr. Rajesh Patel", email: "r.patel@gecg.edu", role: "Teacher" },
                  { name: "Shah Amit", email: "amit.s@student.gtu.ac.in", role: "Student" },
                ].map((req) => (
                  <div key={req.email} className="flex items-center justify-between bg-white/3 rounded-lg p-3.5 border border-white/5">
                    <div>
                      <p className="text-white font-medium text-[12px]">{req.name}</p>
                      <p className="text-[10px] text-gray-500">{req.email} · {req.role}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 rounded text-[10px] font-semibold cursor-pointer hover:bg-emerald-500/25 transition-colors">Approve</span>
                      <span className="px-2.5 py-1 bg-white/5 text-gray-500 rounded text-[10px] cursor-pointer hover:bg-white/10 transition-colors">Decline</span>
                    </div>
                  </div>
                ))}
                {/* Audit trail */}
                <div className="pt-3 mt-2 border-t border-white/5 text-[10px] text-gray-600 space-y-1 font-mono">
                  <p>[01:02] approved student CS2026-X12</p>
                  <p>[00:54] updated auth cookie params</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ UNDER THE HOOD ━━━ */}
        <section className="py-28 px-6 bg-background-layer1/30 border-y border-gray-800/10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white">Under the hood</h2>
              <p className="text-gray-500 mt-3 max-w-lg mx-auto">The infrastructure that keeps exams fast and fair, even when everyone submits at once.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card bg-background-layer1/50 border-gray-800/10 p-6">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-primary mb-5">
                  <Cpu size={20} />
                </div>
                <h3 className="font-bold text-white mb-2">Sandboxed execution</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Every submission runs inside an isolated Linux container with strict CPU, memory, and time limits. 
                  One student's infinite loop can't affect anyone else.
                </p>
              </div>

              <div className="card bg-background-layer1/50 border-gray-800/10 p-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 mb-5">
                  <Database size={20} />
                </div>
                <h3 className="font-bold text-white mb-2">Background job queue</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Submissions are processed through Redis + BullMQ. The UI stays responsive because grading happens 
                  asynchronously — students get real-time status updates via polling.
                </p>
              </div>

              <div className="card bg-background-layer1/50 border-gray-800/10 p-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-5">
                  <Sparkles size={20} />
                </div>
                <h3 className="font-bold text-white mb-2">AI classification</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Questions are automatically tagged with topic labels (arrays, graphs, DP) and difficulty estimates, 
                  so teachers don't have to categorize everything manually.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ COMPARISON ━━━ */}
        <section className="py-28 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white">QuizPortal vs. traditional exams</h2>
            </div>

            <div className="rounded-xl border border-gray-800/10 overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-background-layer2 border-b border-gray-800/15">
                    <th className="p-5 text-left text-white font-semibold"></th>
                    <th className="p-5 text-left text-gray-500 font-medium">Traditional</th>
                    <th className="p-5 text-left text-primary font-semibold">QuizPortal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/10 text-gray-500 text-[13px]">
                  {[
                    ["Code evaluation", "Manual review", "Automated test cases"],
                    ["Exam proctoring", "No tab-lock / basic monitoring", "Safe Exam Browser constraints"],
                    ["Grading speed", "Days", "Seconds"],
                    ["Analytics", "Spreadsheets", "Live dashboards"],
                    ["Setup time", "Weeks", "Minutes"],
                  ].map(([feature, old, next]) => (
                    <tr key={feature}>
                      <td className="p-5 font-medium text-white">{feature}</td>
                      <td className="p-5">
                        <span className="flex items-center gap-1.5 text-gray-500"><XCircle size={14} className="text-red-400/60" />{old}</span>
                      </td>
                      <td className="p-5">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-medium"><CheckCircle2 size={14} />{next}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ━━━ FAQ ━━━ */}
        <section className="py-28 px-6 bg-background-layer1/30 border-y border-gray-800/10">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">Questions & answers</h2>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-gray-800/10 rounded-lg overflow-hidden bg-background/50">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left font-medium text-white text-[14px] hover:bg-white/3 transition-colors cursor-pointer focus:outline-none"
                  >
                    <span>{faq.q}</span>
                    {openFaq === i ? <ChevronUp size={16} className="text-gray-500 shrink-0 ml-4" /> : <ChevronDown size={16} className="text-gray-500 shrink-0 ml-4" />}
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-[13px] text-gray-500 leading-relaxed border-t border-gray-800/5">
                      <p className="pt-3">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━ BOTTOM CTA ━━━ */}
        <section className="py-28 px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid mask-radial pointer-events-none opacity-50"></div>
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ready to try it?
            </h2>
            <p className="text-gray-500 leading-relaxed">
              Set up your first coding exam in under 10 minutes.<br className="hidden sm:block" />
              Free for students, no credit card required.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link to="/request-access" className="btn-primary px-6 py-3 text-sm font-semibold rounded-lg flex items-center gap-2">
                Get started <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="px-6 py-3 text-sm font-semibold text-gray-400 hover:text-white border border-gray-800/15 hover:border-gray-800/30 rounded-lg transition-colors">
                Login
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="border-t border-gray-800/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <span className="text-lg font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-purple-600">QuizPortal</span>
            <p className="text-[11px] text-gray-600 mt-1">Coding assessments for engineering colleges.</p>
            <p className="text-[10px] text-gray-500 mt-2 font-medium flex items-center justify-center md:justify-start gap-1">
              Made with <Coffee size={12} className="text-gray-500 inline-block" />, patience, and far too many test cases.
            </p>
          </div>
          <div className="flex gap-6 text-[11px] text-gray-600 font-medium">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
