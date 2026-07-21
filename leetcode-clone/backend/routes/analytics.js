const express = require("express");
const {
    getQuizAnalytics,
    exportQuizAnalyticsCsv,
    getStudentComprehensiveAnalytics,
    getStudentRecommendations,
    getStudentRecommendationsV2
} = require("../controllers/analyticsController");
const { auth, authorize } = require("../middleware/auth");
const { requireInstitutionContext } = require("../middleware/institution");

const router = express.Router();

router.get(
    "/teacher/quiz/:quizId",
    auth,
    authorize('teacher'),
    requireInstitutionContext,
    getQuizAnalytics
);

router.get(
    "/teacher/quiz/:quizId/export",
    auth,
    authorize('teacher'),
    requireInstitutionContext,
    exportQuizAnalyticsCsv
);

// Student Comprehensive Analytics
router.get(
    "/student/:studentId/comprehensive",
    auth,
    getStudentComprehensiveAnalytics
);

router.get(
    "/student/:userId/recommendations",
    auth,
    getStudentRecommendations
);

router.get(
    "/student/:userId/recommendations-v2",
    auth,
    getStudentRecommendationsV2
);

module.exports = router;
