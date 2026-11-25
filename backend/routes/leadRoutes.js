import express from "express";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";

import {
    createLead,
    getLeads,
    getLeadById,
    updateLead,
    deleteLead,
    recordLeadFollowUp
} from "../controllers/leadController.js";

const router = express.Router();


// All current Lead routes require Admin
router.use(protect);
router.use(allowRoles("admin"));


// Create
router.post("/", createLead);


// Get all
router.get("/", getLeads);


// Get one
router.get("/:id", getLeadById);


// Update
router.put("/:id", updateLead);


router.post("/:id/follow-ups", recordLeadFollowUp);


// Delete
router.delete("/:id", deleteLead);


export default router;