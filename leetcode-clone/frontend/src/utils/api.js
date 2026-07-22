import axios from "axios";
import { API_BASE_URL } from "../config/api";

// Create an axios instance to handle interceptors better
const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true // For sending cookies
});

// Request interceptor: attach Authorization header for dual token support
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
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
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem("refreshToken");
                const headers = refreshToken ? { "x-refresh-token": refreshToken } : {};
                const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, {
                    withCredentials: true,
                    headers
                });

                if (res.data?.accessToken || res.data?.token) {
                    const newAccess = res.data.accessToken || res.data.token;
                    localStorage.setItem("accessToken", newAccess);
                    localStorage.setItem("token", newAccess);
                    originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                }

                return api(originalRequest);
            } catch (err) {
                console.error("Refresh failed", err);
                localStorage.removeItem("role");
                localStorage.removeItem("token");
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                window.location.href = "/login";
                return Promise.reject(err);
            }
        }
        return Promise.reject(error);
    }
);

export const pingBackend = () => api.get("/api/ping");


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
export const getAcademicCatalog = () => api.get("/api/teacher/academics");

export const deleteUser = (email) => api.delete("/api/admin/user", { data: { email } });

export const getStudentComprehensiveAnalytics = (userId) => api.get(`/api/analytics/student/${userId}/comprehensive`);
export const getStudentRecommendations = (userId) => api.get(`/api/analytics/student/${userId}/recommendations`);
export const getStudentRecommendationsV2 = (userId) => api.get(`/api/analytics/student/${userId}/recommendations-v2`);
export const exportTeacherQuizAnalytics = (quizId) => api.get(`/api/analytics/teacher/quiz/${quizId}/export`, { responseType: "blob" });

// AI Provider Management
export const getAiProviders = () => api.get("/api/teacher/settings/ai-providers");
export const saveAiKey = (provider, apiKey) => api.post("/api/teacher/settings/ai-key", { provider, apiKey });
export const removeAiKey = (provider) => api.delete("/api/teacher/settings/ai-key", { data: { provider } });

// Master Admin Endpoints
export const getMasterStats = () => api.get("/api/master/stats");
export const getMasterInstitutes = () => api.get("/api/master/institutes");
export const createInstitute = (data) => api.post("/api/master/institutes", data);
export const getMasterAdmins = () => api.get("/api/master/admins");
export const assignAdmin = (data) => api.post("/api/master/admins", data);
export const removeAdmin = (membershipId) => api.delete(`/api/master/admins/${membershipId}`);
export const getMasterSettings = () => api.get("/api/master/settings");
export const updateMasterSettings = (settings) => api.post("/api/master/settings", settings);
export const getMasterRequests = () => api.get("/api/master/requests");
export const approveMasterRequest = (email) => api.post("/api/master/requests/approve", { email });
export const rejectMasterRequest = (email) => api.post("/api/master/requests/reject", { email });

export default api;
