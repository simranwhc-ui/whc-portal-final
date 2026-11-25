import express from "express";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";
import { protectStudent } from "../middleware/studentAuthMiddleware.js";
import {
    createStudentComplaint,
    getStaffComplaints,
    getStudentComplaintOptions,
    getStudentComplaints,
    respondToComplaint
} from "../controllers/complaintController.js";

const router = express.Router();

router.get("/student/options", protectStudent, getStudentComplaintOptions);
router.get("/student", protectStudent, getStudentComplaints);
router.post("/student", protectStudent, createStudentComplaint);

router.use("/staff", protect, allowRoles("admin", "counsellor", "trainer"));
router.get("/staff", getStaffComplaints);
router.patch("/staff/:id/response", respondToComplaint);

export default router;
