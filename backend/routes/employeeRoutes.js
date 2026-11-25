import express from "express";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";

import {
    createCounsellor,
    createTrainer,
    getCounsellors,
    getTrainers,
    getEmployeeById,
    updateEmployee,
    changeEmployeeStatus,
    changeCounsellorLeaveStatus,
    deleteEmployee,
    transferCounsellorWork,
    assignTrainerSubjects
} from "../controllers/employeeController.js";


const router = express.Router();


// Every route below requires Admin
router.use(protect);
router.use(allowRoles("admin"));


// CREATE
router.post("/counsellors", createCounsellor);

router.post("/trainers", createTrainer);


// GET ALL
router.get("/counsellors", getCounsellors);

router.get("/trainers", getTrainers);

router.patch("/trainers/:id/subjects",assignTrainerSubjects);


// COUNSELLOR LEAVE
router.patch(
    "/counsellors/:id/leave",
    changeCounsellorLeaveStatus
);

router.post(
    "/counsellors/transfer-work",
    transferCounsellorWork
);


// GET ONE
router.get("/:id", getEmployeeById);


// UPDATE
router.put("/:id", updateEmployee);


// ACTIVATE / DEACTIVATE LOGIN
router.patch("/:id/status", changeEmployeeStatus);


// DELETE
router.delete("/:id", deleteEmployee);


export default router;