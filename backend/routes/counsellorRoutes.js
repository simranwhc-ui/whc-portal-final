import express from "express";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";
import {getCounsellorDashboard} from "../controllers/counsellorController.js";

import {getMyLeads,getMyLeadById,updateMyLead,updateMyLeadStatus,recordLeadFollowUp} from "../controllers/leadController.js";

import {
    createCounsellorStudent,
    getMyStudents,
    convertLeadToStudent
} from "../controllers/studentController.js";

const router = express.Router();

router.use(protect);
router.use(allowRoles("counsellor"));

router.get("/dashboard", getCounsellorDashboard);

// Leads
router.get("/leads", getMyLeads);
router.get("/leads/:id", getMyLeadById);
router.put("/leads/:id", updateMyLead);
router.patch("/leads/:id/status", updateMyLeadStatus);
router.post("/leads/:id/follow-ups", recordLeadFollowUp);

// Students
router.get("/students", getMyStudents);
router.post("/students", createCounsellorStudent);
router.post("/students/convert-lead/:leadId", convertLeadToStudent);


export default router;