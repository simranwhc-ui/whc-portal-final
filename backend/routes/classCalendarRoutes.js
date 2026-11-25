
import express from "express";

import {
    createCalendarEvent,
    getMyCalendar,
    updateCalendarEvent,
    deleteCalendarEvent
} from "../controllers/classCalendarController.js";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";

const router = express.Router();

// Only authenticated trainers can manage their calendar
router.use(protect);
router.use(allowRoles("trainer"));

router.post("/", createCalendarEvent);
router.get("/", getMyCalendar);
router.put("/:id", updateCalendarEvent);
router.delete("/:id", deleteCalendarEvent);

export default router;
