import React, { useState, useEffect, useContext } from "react";
import { Trophy, Medal } from "lucide-react";
import { AuthContext } from "../../context/authStore";
import api from "../../utils/api";

const Leaderboard = () => {
    const { token } = useContext(AuthContext);
    const [leaderboard, setLeaderboard] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuizId, setSelectedQuizId] = useState("");

    // Fetch active quizzes for the dropdown
    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const response = await api.get("/api/student/quizzes?includeAttempted=true");
                const data = response.data;
                setQuizzes(data);
                if (data.length > 0) setSelectedQuizId(data[0].id);
            } catch (err) {
                console.error("Error fetching quizzes for leaderboard:", err);
            }
        };

        if (token) fetchQuizzes();
    }, [token]);

    // Fetch leaderboard for selected quiz
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!selectedQuizId) return;
            try {
                const response = await api.get(`/api/student/leaderboard?quizId=${selectedQuizId}`);
                setLeaderboard(response.data);
            } catch (err) {
                console.error("Error fetching leaderboard:", err);
            }
        };

        if (token && selectedQuizId) fetchLeaderboard();
    }, [token, selectedQuizId]);

    return (
        <div className="bg-[#1a1a1a] min-h-screen text-white p-8">
            <h1 className="text-3xl font-bold mb-6 flex items-center">
                <Trophy className="w-8 h-8 text-yellow-500 mr-2" /> Leaderboard
            </h1>

            <div className="mb-8">
                <label className="block mb-2 text-gray-400">Select Quiz:</label>
                <select
                    value={selectedQuizId}
                    onChange={(e) => setSelectedQuizId(e.target.value)}
                    className="bg-[#2a2a2a] text-white p-2 rounded border border-gray-600 w-full md:w-1/3"
                >
                    {quizzes.map(q => (
                        <option key={q.id} value={q.id}>{q.title}</option>
                    ))}
                </select>
            </div>

            <div className="bg-[#2a2a2a] rounded-lg overflow-hidden border border-gray-700">
                <table className="w-full text-left">
                    <thead className="bg-[#333] text-gray-300">
                        <tr>
                            <th className="p-4">Rank</th>
                            <th className="p-4">User</th>
                            <th className="p-4">Score</th>
                            <th className="p-4">Quiz</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="p-6 text-center text-gray-500">
                                    No submissions yet for this quiz.
                                </td>
                            </tr>
                        ) : (
                            leaderboard.map((entry, index) => (
                                <tr key={index} className="border-t border-gray-700 hover:bg-[#333]">
                                    <td className="p-4">
                                        {index + 1 === 1 ? <Medal className="w-5 h-5 text-yellow-400 inline" /> : index + 1 === 2 ? <Medal className="w-5 h-5 text-gray-400 inline" /> : index + 1 === 3 ? <Medal className="w-5 h-5 text-amber-600 inline" /> : `#${index + 1}`}
                                    </td>
                                    <td className="p-4 font-mono text-green-400">{entry.username}</td>
                                    <td className="p-4 font-bold">{entry.score}</td>
                                    <td className="p-4 text-sm text-gray-400">{entry.quizTitle}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Leaderboard;
