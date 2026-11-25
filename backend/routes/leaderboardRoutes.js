import express from "express";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";

import {
    getLeaderboard
} from "../controllers/leaderboardController.js";

const router = express.Router();

router.use(protect);

// Admin and counsellors can see leaderboard
router.use(
    allowRoles("admin", "counsellor")
);

router.get("/", getLeaderboard);

export default router;