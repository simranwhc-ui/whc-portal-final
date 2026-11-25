import express from "express";

import protect from "../middleware/authMiddleware.js";
import allowRoles from "../middleware/roleMiddleware.js";

import {
    createFee,
    getFees,
    getStudentFees,
    recordPayment,
    getFeeDashboard,
    updateFee,
    deleteFee
} from "../controllers/feeController.js";

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));


// Dashboard
router.get(
    "/dashboard",
    getFeeDashboard
);


// All fees / filters
router.get(
    "/",
    getFees
);


// Fees of a particular student
router.get(
    "/student/:studentId",
    getStudentFees
);


// Create installment
router.post(
    "/",
    createFee
);


// Record payment
router.patch(
    "/:id/payment",
    recordPayment
);


// Update installment
router.put(
    "/:id",
    updateFee
);


// Delete installment
router.delete(
    "/:id",
    deleteFee
);

export default router;