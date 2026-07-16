import axios from "axios";

// Create an axios instance to handle interceptors better
const api = axios.create({
    baseURL: "http://localhost:5000",
    withCredentials: true // For sending cookies
});

// Request interceptor (legacy token attachment removed for strictly cookie-based auth)
api.interceptors.request.use((config) => {
    return config;
});

// Response interceptor to handle 401 (Refresh Token)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 503) {
            window.location.href = "/maintenance";
            return Promise.reject(error);
        }

        const originalRequest = error.config;
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                // The backend will automatically set the new accessToken HTTP-Only cookie in the response
                await axios.post("http://localhost:5000/auth/refresh", {}, { withCredentials: true });

                // Retry original request, cookies are automatically sent withCredentials
                return api(originalRequest);
            } catch (err) {
                // Refresh failed, session completely expired, redirect to login
                console.error("Refresh failed", err);
                localStorage.removeItem("role");
                window.location.href = "/login";
                return Promise.reject(err);
            }
        }
        return Promise.reject(error);
    }
);

export const submitCodeAsync = (data, mode = "submit") => api.post(`/api/submit-async?mode=${mode}`, data);
export const getUsers = () => api.get("/api/admin/users");
export const promoteUser = (email, role) => api.patch("/api/admin/promote", { email, role });

// Teacher Quiz API
export const getDashboardStats = () => api.get("/api/teacher/dashboard");
export const getEvaluations = () => api.get("/api/teacher/evaluations");
export const getQuizzes = () => api.get("/api/teacher/quiz");
export const createQuiz = (data) => api.post("/api/teacher/quiz", data);

export const getAdminStats = () => api.get("/api/admin/dashboard");

export const getQuestionBank = () => api.get("/api/teacher/question-bank");
export const saveQuizQuestions = (questions) => api.post("/api/teacher/quiz/questions", { questions });
export const runCode = (quizId, data) => api.post(`/api/student/quiz/${quizId}/run`, data);
export const getSubmissions = () => api.get("/api/teacher/submissions");

export const getAuditLogs = () => api.get("/api/admin/logs");
export const getSettings = () => api.get("/api/admin/settings");
export const updateSettings = (settings) => api.post("/api/admin/settings", settings);

export const createFullQuiz = (data) => api.post("/api/teacher/quiz/full", data);

export const deleteUser = (email) => api.delete("/api/admin/user", { data: { email } });

export const getStudentComprehensiveAnalytics = (userId) => api.get(`/api/analytics/student/${userId}/comprehensive`);
export const getStudentRecommendations = (userId) => api.get(`/api/analytics/student/${userId}/recommendations`);
export const getStudentRecommendationsV2 = (userId) => api.get(`/api/analytics/student/${userId}/recommendations-v2`);
export const exportTeacherQuizAnalytics = (quizId) => api.get(`/api/analytics/teacher/quiz/${quizId}/export`, { responseType: "blob" });

// AI Provider Management
export const getAiProviders = () => api.get("/api/teacher/settings/ai-providers");
export const saveAiKey = (provider, apiKey) => api.post("/api/teacher/settings/ai-key", { provider, apiKey });
export const removeAiKey = (provider) => api.delete("/api/teacher/settings/ai-key", { data: { provider } });

export default api;
