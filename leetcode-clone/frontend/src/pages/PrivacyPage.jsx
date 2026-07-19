import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/authStore";
import { Sun, Moon, ArrowLeft, Shield, Coffee } from "lucide-react";

export default function PrivacyPage() {
  const { theme, toggleTheme } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-background text-main flex flex-col font-sans transition-colors duration-300 relative overflow-hidden">
      {/* Background dot grid pattern */}
      <div className="absolute inset-0 bg-grid mask-radial pointer-events-none -z-10"></div>



      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        {/* Back Link */}
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-white transition-colors mb-8 group cursor-pointer">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </Link>

        {/* Title */}
        <div className="space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-wider">
            <Shield size={12} /> Legal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-gray-500 font-mono">Last updated: July 20, 2026</p>
        </div>

        {/* Legal Text */}
        <div className="space-y-10 text-sm text-gray-400 leading-relaxed">
          <p>
            At QuizPortal, we are committed to protecting your privacy and ensuring you have a positive experience on our platform. This policy outlines our handling practices and how we collect and use the personal data you provide during your online and offline interactions with us.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Data Collection</h2>
            <p>
              We collect information you provide directly to us when you register, including your name, email address, profile picture, and any registration credentials (such as college name and department) uploaded to our QuizPortal platform.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">How We Use Your Data</h2>
            <p>
              Your data is used strictly to provide, maintain, and improve our services. Specifically, we use your inputs (including code compilations, submissions, and responses during assessments) to calculate scores, generate performance analytics, and synchronize live leaderboards.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information. Your data is encrypted in transit and at rest. We do not sell your personal data to third parties. All compilation execution happens in isolated linux sandbox environments to prevent server-side interference.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Third-Party Services</h2>
            <p>
              We may use third-party AI models and sandboxed compilers (e.g., Judge0) to process test cases and evaluate responses. These providers are bound by strict data processing agreements and do not use your personal data or submitted solutions to train their models without explicit consent.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal data at any time. You can manage your preferences or request database deletions by contacting your institutional platform administrator.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Contact Us</h2>
            <p>
              If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact your institution's system administrator or reach out directly to QuizPortal developer support.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/10 py-12 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <span className="text-lg font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-purple-600">QuizPortal</span>
            <p className="text-[11px] text-gray-600 mt-1">Coding assessments for engineering colleges.</p>
            <p className="text-[10px] text-gray-500 mt-2 font-medium flex items-center justify-center md:justify-start gap-1">
              Made with <Coffee size={12} className="text-gray-500 inline-block" />, patience, and far too many test cases.
            </p>
          </div>
          <div className="flex gap-6 text-[11px] text-gray-600">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
