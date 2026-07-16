import React, { useContext } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AuthContext } from '../context/authStore';

export default function Maintenance() {
    const { token, role, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col items-center justify-center p-4">
        <div className="bg-background-layer2 p-8 rounded-xl shadow-2xl border border-gray-800 text-center max-w-md w-full">
            <div className="flex justify-center mb-6">
                <div className="p-4 bg-yellow-500/10 rounded-full">
                    <AlertTriangle className="w-12 h-12 text-yellow-500" />
                </div>
            </div>
            
            <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-linear-to-r from-yellow-400 to-orange-600">
                Under Maintenance
            </h1>
            
            <p className="text-text-secondary mb-8 leading-relaxed">
                We are currently performing scheduled maintenance to improve our platform. 
                Please check back later.
            </p>

                        {token && (
                            <button
                                type="button"
                                onClick={logout}
                                className="w-full mb-6 px-4 py-2 text-sm font-semibold text-red-300 border border-red-500/40 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                                Logout{role ? ` (${role})` : ""}
                            </button>
                        )}
            
            <div className="text-sm text-gray-500">
                &copy; {new Date().getFullYear()} QuizPortal. All rights reserved.
            </div>
        </div>
    </div>
  );
}
