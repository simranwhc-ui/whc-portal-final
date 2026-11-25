import express from "express";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";

import {
    getStudents,
    getStudentById,
    updateStudent,
    changeStudentPlan,
    changeStudentStatus,
    deleteStudent,
    assignTrainerToStudent,
    resetStudentPassword
} from "../controllers/studentController.js";

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));


// Get all students
router.get("/", getStudents);


// Get one student
router.get("/:id", getStudentById);


// Update student
router.put("/:id", updateStudent);


router.patch("/:id/trainer", assignTrainerToStudent);

// Reset student login password
router.patch("/:id/reset-password", resetStudentPassword);

// Change plan
router.patch("/:id/plan",changeStudentPlan);


// Change status
router.patch("/:id/status",changeStudentStatus);


// Delete student
router.delete("/:id", deleteStudent);

export default router;