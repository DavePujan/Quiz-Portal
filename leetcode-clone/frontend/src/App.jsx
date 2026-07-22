import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Login from "./auth/Login";
import ProtectedRoute from "./auth/ProtectedRoute";
import OAuthSuccess from "./auth/OAuthSuccess";
import { AuthProvider } from "./context/AuthContext";
import { AuthContext } from "./context/authStore";
import { useContext, useState, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { SpeedInsights } from "@vercel/speed-insights/react";
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

  // Don't show Navbar for Teacher/Admin as they have Sidebar
  // Also don't show for Quiz Attempt page
  if (
    role === "teacher" ||
    role === "admin" ||
    location.pathname.includes("/student/quiz/") ||
    location.pathname === "/request-access" ||
    location.pathname === "/login" ||
    location.pathname === "/maintenance" ||
    location.pathname === "/"
  ) return null;

  return (
    <nav className="flex flex-col px-6 py-4 bg-background-layer1 border-b border-gray-800 sticky top-0 z-50 shadow-md">
      <div className="flex items-center justify-between w-full">
        <Link to={token ? (role === 'teacher' ? "/teacher" : role === 'admin' ? "/admin" : "/student/dashboard") : "/"} className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500 mr-8 tracking-tight">
          QuizPortal
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-6">
          {role === "student" && (
            <>
              <Link to="/student/dashboard" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Active Quizzes</Link>
              <Link to="/leaderboard" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Leaderboard</Link>
              <Link to="/upcoming" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Upcoming Quizzes</Link>
              <Link to="/history" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">History</Link>
              <Link to="/student/analysis" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Analysis</Link>
              <Link to="/student/practice" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Practice</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
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
            className="px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white rounded-lg border border-gray-800 transition-colors flex items-center justify-center"
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

          {/* Mobile Menu Toggle */}
          {role === "student" && (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-gray-400 hover:text-white focus:outline-none"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && role === "student" && (
        <div className="md:hidden mt-4 pb-2 border-t border-gray-800 pt-4 flex flex-col space-y-3 animation-fade-in">
          <Link to="/student/dashboard" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-gray-400 hover:text-white transition-colors pl-2">Active Quizzes</Link>
          <Link to="/leaderboard" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-gray-400 hover:text-white transition-colors pl-2">Leaderboard</Link>
          <Link to="/upcoming" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-gray-400 hover:text-white transition-colors pl-2">Upcoming Quizzes</Link>
          <Link to="/history" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-gray-400 hover:text-white transition-colors pl-2">History</Link>
          <Link to="/student/analysis" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-gray-400 hover:text-white transition-colors pl-2">Analysis</Link>
          <Link to="/student/practice" onClick={() => setIsMenuOpen(false)} className="text-base font-medium text-gray-400 hover:text-white transition-colors pl-2">Practice</Link>
          {token && (
            <button onClick={logout} className="text-left text-base font-medium text-red-400 hover:text-red-300 transition-colors pl-2 pt-2 border-t border-gray-800 mt-2">
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
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

