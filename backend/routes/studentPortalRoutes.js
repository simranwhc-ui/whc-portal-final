import express from "express";

import { protectStudent } from "../middleware/studentAuthMiddleware.js";

import {
    getMyAttendance,
    getStudentDashboard,
    getMyProfile,
    getMyCourse
} from "../controllers/studentController.js";

import { getMyAssignedProjects } from "../controllers/studentProjectController.js";
import { getMyMonthlyEvaluations } from "../controllers/monthlyEvaluationController.js";

import {
    getMyFees,
    getMyCalendar,
    changeMyPassword
} from "../controllers/studentPortalController.js";

const router = express.Router();

router.use(protectStudent);

router.get("/dashboard", getStudentDashboard);
router.get("/profile", getMyProfile);
router.get("/course", getMyCourse);
router.get("/attendance", getMyAttendance);
router.get("/projects", getMyAssignedProjects);
router.get("/monthly-evaluations", getMyMonthlyEvaluations);
router.get("/fees", getMyFees);
router.get("/calendar", getMyCalendar);

router.patch("/change-password", changeMyPassword);

export default router;
