import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Login from "./auth/Login";
import ProtectedRoute from "./auth/ProtectedRoute";
import OAuthSuccess from "./auth/OAuthSuccess";
import { AuthProvider } from "./context/AuthContext";
import { AuthContext } from "./context/authStore";
import { useContext, useState, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import "./styles/common.css";
import { Menu, X, Sun, Moon } from "lucide-react";

import RequestAccess from "./auth/RequestAccess";
import ForgotPassword from "./auth/ForgotPassword";
import Maintenance from "./pages/Maintenance";
import DashboardLayout from "./layouts/DashboardLayout";

// Student Page
import Leaderboard from "./pages/student/Leaderboard";
import ActiveQuizzes from "./pages/student/ActiveQuizzes";
import UpcomingQuizzes from "./pages/student/UpcomingQuizzes";
import History from "./pages/student/History";
import AttemptQuiz from "./pages/student/AttemptQuiz";
import StudentAnalysis from "./pages/student/StudentAnalysis";
import QuestionReview from "./pages/student/QuestionReview";
import Practice from "./pages/student/Practice";
import PracticeQuiz from "./pages/student/PracticeQuiz";

// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CreateQuiz from "./pages/teacher/CreateQuiz";
import Evaluations from "./pages/teacher/Evaluations";
import QuizBuilder from "./pages/teacher/QuizBuilder";
import EvaluationViewer from "./pages/teacher/EvaluationViewer";
import QuizAnalytics from "./pages/teacher/QuizAnalytics";
import TeacherSettings from "./pages/teacher/TeacherSettings";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import AuditLogs from "./pages/admin/AuditLogs";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminRequests from "./pages/admin/AdminRequests";

// Master Admin Pages
import MasterDashboard from "./pages/master/MasterDashboard";
import LandingPage from "./pages/LandingPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";

// NavBar is now only for Student and Public pages. 
// Teacher/Admin navigation is handled by Sidebar in DashboardLayout.
function NavBar() {
  const { token, logout, role, profile, theme, toggleTheme } = useContext(AuthContext);
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  if (
    role === "teacher" ||
    role === "admin" ||
    location.pathname.includes("/student/quiz/") ||
    location.pathname === "/request-access" ||
    location.pathname === "/login" ||
    location.pathname === "/maintenance" ||
    location.pathname === "/"
  ) return null;

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) => `
    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium
    ${isActive(path)
      ? "bg-primary text-white shadow-lg shadow-primary/25 font-semibold"
      : "text-gray-400 hover:bg-white/5 hover:text-white"
    }
  `;

  return (
    <>
      <nav className="flex flex-col px-4 sm:px-6 py-3 bg-[#0a0a0a] border-b border-gray-800 sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between w-full">
          <Link to={token ? (role === 'teacher' ? "/teacher" : role === 'admin' ? "/admin" : "/student/dashboard") : "/"} className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500 mr-8 tracking-tight">
            QuizPortal
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            {role === "student" && (
              <>
                <Link to="/student/dashboard" className={`text-sm font-medium transition-colors ${isActive('/student/dashboard') ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>Active Quizzes</Link>
                <Link to="/leaderboard" className={`text-sm font-medium transition-colors ${isActive('/leaderboard') ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>Leaderboard</Link>
                <Link to="/upcoming" className={`text-sm font-medium transition-colors ${isActive('/upcoming') ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>Upcoming Quizzes</Link>
                <Link to="/history" className={`text-sm font-medium transition-colors ${isActive('/history') ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>History</Link>
                <Link to="/student/analysis" className={`text-sm font-medium transition-colors ${isActive('/student/analysis') ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>Analysis</Link>
                <Link to="/student/practice" className={`text-sm font-medium transition-colors ${isActive('/student/practice') ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>Practice</Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {role && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold">
                {role}
              </span>
            )}

            {profile && (
              <div className="hidden md:flex flex-col text-right border-r border-gray-800 pr-4">
                <span className="text-sm font-semibold text-white leading-tight">{profile.name}</span>
                <span className="text-[10px] text-gray-400 mt-0.5 leading-none">
                  {profile.college} &bull; <span className="text-primary">{profile.department}</span>
                </span>
              </div>
            )}
            
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-white rounded-lg border border-gray-800 transition-colors flex items-center justify-center"
              title="Toggle theme"
            >
              {theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            {/* Desktop Logout */}
            <div className="hidden md:block">
              {token ? (
                <button onClick={logout} className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors">
                  Logout ({role})
                </button>
              ) : (
                <Link to="/login" className="px-5 py-2 text-sm font-bold text-white bg-primary rounded-lg shadow-lg hover:bg-primary-hover transition-colors">
                  Login
                </Link>
              )}
            </div>

            {/* Mobile Menu Toggle button matching Teacher Sidebar */}
            {role === "student" && (
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 text-gray-300 hover:text-white focus:outline-none rounded-lg border border-gray-800 bg-white/5"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Slide-Over Menu Drawer matching Teacher Panel style */}
      {isMenuOpen && role === "student" && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col justify-between p-4 bg-[#0a0a0a] animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMenuOpen(false);
          }}
        >
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-800">
              <div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                  QuizPortal
                </span>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-0.5">Student Navigation</p>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg border border-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              <Link to="/student/dashboard" className={linkClass("/student/dashboard")}>Active Quizzes</Link>
              <Link to="/leaderboard" className={linkClass("/leaderboard")}>Leaderboard</Link>
              <Link to="/upcoming" className={linkClass("/upcoming")}>Upcoming Quizzes</Link>
              <Link to="/history" className={linkClass("/history")}>History</Link>
              <Link to="/student/analysis" className={linkClass("/student/analysis")}>Analysis</Link>
              <Link to="/student/practice" className={linkClass("/student/practice")}>Practice</Link>
            </nav>

            <div className="pt-4 mt-6 border-t border-gray-800">
              {profile && (
                <div className="px-4 py-3 mb-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-sm font-bold text-white truncate">{profile.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{profile.college}</p>
                  <p className="text-xs text-primary truncate uppercase tracking-widest mt-1 font-semibold">{profile.department} Dept</p>
                </div>
              )}

              {token && (
                <button
                  onClick={logout}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20 font-medium"
                >
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}



function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <SpeedInsights />
      <Analytics />
      <Toaster position="top-right" />
      <BrowserRouter>
        <ScrollToTop />
        <NavBar />
        <Routes>
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/login" element={<Login />} />
          <Route path="/request-access" element={<RequestAccess />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/oauth-success" element={<OAuthSuccess />} />

          {/* Student / Public */}
          {/* Student / Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute>
                <ActiveQuizzes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upcoming"
            element={
              <ProtectedRoute>
                <UpcomingQuizzes />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/analysis"
            element={
              <ProtectedRoute>
                <StudentAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/practice"
            element={
              <ProtectedRoute>
                <Practice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/practice/quiz/:id"
            element={
              <ProtectedRoute>
                <PracticeQuiz />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/review/:submissionId"
            element={
              <ProtectedRoute>
                <QuestionReview />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/quiz/:id"
            element={
              <ProtectedRoute>
                <AttemptQuiz />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            }
          />

          {/* Teacher Routes */}
          <Route path="/teacher" element={<ProtectedRoute role="teacher"><DashboardLayout><TeacherDashboard /></DashboardLayout></ProtectedRoute>} />
          <Route path="/teacher/create-quiz" element={<ProtectedRoute role="teacher"><DashboardLayout><CreateQuiz /></DashboardLayout></ProtectedRoute>} />
          <Route path="/teacher/quiz-builder" element={<ProtectedRoute role="teacher"><DashboardLayout><QuizBuilder /></DashboardLayout></ProtectedRoute>} />
          <Route path="/teacher/evaluations" element={<ProtectedRoute role="teacher"><DashboardLayout><Evaluations /></DashboardLayout></ProtectedRoute>} />
          <Route path="/teacher/evaluation/:id" element={<ProtectedRoute role="teacher"><DashboardLayout><EvaluationViewer /></DashboardLayout></ProtectedRoute>} />
          <Route path="/teacher/quiz/:id/analytics" element={<ProtectedRoute role="teacher"><DashboardLayout><QuizAnalytics /></DashboardLayout></ProtectedRoute>} />
          <Route path="/teacher/settings" element={<ProtectedRoute role="teacher"><DashboardLayout><TeacherSettings /></DashboardLayout></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><DashboardLayout><AdminDashboard /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/requests" element={<ProtectedRoute role="admin"><DashboardLayout><AdminRequests /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute role="admin"><DashboardLayout><UserManagement /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute role="admin"><DashboardLayout><AuditLogs /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute role="admin"><DashboardLayout><AdminSettings /></DashboardLayout></ProtectedRoute>} />
          
          {/* Master Admin Routes */}
          <Route path="/master" element={<ProtectedRoute role="master_admin"><DashboardLayout><MasterDashboard /></DashboardLayout></ProtectedRoute>} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

