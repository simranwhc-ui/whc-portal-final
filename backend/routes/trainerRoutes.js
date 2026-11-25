
import express from "express";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";

import {
    createBatch,
    getMyBatches,
    getMyBatchById,
    updateBatch,
    addStudentsToBatch,
    removeStudentFromBatch,
    deleteBatch
} from "../controllers/batchController.js";

import {
    markAttendance,
    getBatchAttendance,
    getAttendanceHistory,
    completeAttendanceSession,
    getAttendanceSessions
} from "../controllers/attendanceController.js";

import {
    createProject,
    getMyProjects,
    getMyProjectById,
    evaluateProjectStudent,
    deleteProject,
    setProjectDeadlineExtension,
    getProjectDeadlineExtensions,
    getProjectStudentSubmissions,
    updateProjectStudentSubmission
} from "../controllers/projectController.js";

import { getTrainerDashboard } from "../controllers/trainerDashboardController.js";

import {
    getMyStudents,
    getMyStudentById,
    updateMyStudent
} from "../controllers/trainerController.js";

import {
    getTrainerMonthlyEvaluations,
    saveMonthlyEvaluation
} from "../controllers/monthlyEvaluationController.js";

const router = express.Router();

router.use(protect);
router.use(allowRoles("trainer"));

// Dashboard
router.get("/dashboard", getTrainerDashboard);

// Students
router.get("/students", getMyStudents);
router.get("/students/:id", getMyStudentById);
router.put("/students/:id", updateMyStudent);

// Batches
router.post("/batches", createBatch);
router.get("/batches", getMyBatches);
router.get("/batches/:id", getMyBatchById);
router.put("/batches/:id", updateBatch);
router.patch("/batches/:id/students", addStudentsToBatch);

router.delete(
    "/batches/:batchId/students/:studentId",
    removeStudentFromBatch
);

router.delete("/batches/:id", deleteBatch);

// Attendance
router.post("/attendance/:batchId", markAttendance);

router.get("/attendance/history", getAttendanceHistory);
router.get("/attendance/sessions", getAttendanceSessions);

router.patch(
    "/sessions/:sessionId/complete",
    completeAttendanceSession
);

router.get("/attendance/:batchId", getBatchAttendance);

// Projects
router.post("/projects", createProject);
router.get("/projects", getMyProjects);
router.get("/projects/:id", getMyProjectById);

router.patch(
    "/projects/:projectId/evaluate/:studentId",
    evaluateProjectStudent
);

router.delete("/projects/:id", deleteProject);

// Individual project deadline extensions
router.put(
    "/projects/:projectId/students/:studentId/extension",
    setProjectDeadlineExtension
);

router.get(
    "/projects/:projectId/extensions",
    getProjectDeadlineExtensions
);

// Project submissions
router.get(
    "/projects/:projectId/submissions",
    getProjectStudentSubmissions
);

router.patch(
    "/projects/:projectId/submissions/:studentId",
    updateProjectStudentSubmission
);

// Monthly evaluations
router.get("/monthly-evaluations", getTrainerMonthlyEvaluations);
router.post("/monthly-evaluations", saveMonthlyEvaluation);

export default router;
