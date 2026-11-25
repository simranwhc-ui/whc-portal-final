import express from "express";
import { login,studentLogin } from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/student-login", studentLogin);

router.get("/me", protect, (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user
    });
});

export default router;