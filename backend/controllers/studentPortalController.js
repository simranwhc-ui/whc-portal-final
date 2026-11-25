import bcrypt from "bcryptjs";

import Student from "../models/Student.js";
import Fee from "../models/Fee.js";
import Batch from "../models/Batch.js";
import ClassCalendar from "../models/ClassCalendar.js";

const isValidDate = (date) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
    );
};

// --------------------------------------------------
// Student: Get my fees
// GET /api/student/fees
// --------------------------------------------------

export const getMyFees = async (req, res) => {
    try {
        const fees = await Fee.find({ student: req.student._id })
            .sort({ dueDate: 1 });

        const now = new Date();

        let totalAmount = 0;
        let totalPaid = 0;
        let totalOverdue = 0;

        const formatted = fees.map((fee) => {
            const remaining = Math.max(fee.amount - fee.paidAmount, 0);

            // Stored status can be stale (nothing flips "upcoming" to
            // "overdue" automatically), so work it out at read time.
            let status;

            if (fee.paidAmount >= fee.amount) {
                status = "paid";
            } else if (new Date(fee.dueDate) < now) {
                status = "overdue";
                totalOverdue += remaining;
            } else {
                status = "upcoming";
            }

            totalAmount += fee.amount;
            totalPaid += fee.paidAmount;

            return {
                id: fee._id,
                description: fee.description,
                amount: fee.amount,
                paidAmount: fee.paidAmount,
                remainingAmount: remaining,
                dueDate: fee.dueDate,
                paidDate: fee.paidDate,
                status
            };
        });

        return res.status(200).json({
            success: true,
            summary: {
                totalAmount,
                totalPaid,
                totalRemaining: totalAmount - totalPaid,
                totalOverdue
            },
            count: formatted.length,
            fees: formatted
        });

    } catch (error) {
        console.error("Get student fees error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch fees"
        });
    }
};

// --------------------------------------------------
// Student: Get my class calendar (holidays, cancelled classes, ...)
// GET /api/student/calendar?date=&startDate=&endDate=
//
// Shows events created by the student's trainer that apply to
// all of the trainer's batches or to the student's own batch.
// --------------------------------------------------

export const getMyCalendar = async (req, res) => {
    try {
        const { date, startDate, endDate } = req.query;

        if (date && !isValidDate(date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date. Use YYYY-MM-DD."
            });
        }

        if (startDate && !isValidDate(startDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid start date. Use YYYY-MM-DD."
            });
        }

        if (endDate && !isValidDate(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid end date. Use YYYY-MM-DD."
            });
        }

        if (startDate && endDate && startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        if (!req.student.trainer) {
            return res.status(200).json({
                success: true,
                count: 0,
                events: []
            });
        }

        const batches = await Batch.find({
            students: req.student._id,
            trainer: req.student.trainer,
            active: true
        }).select("_id");

        const filter = {
            trainer: req.student.trainer,
            $or: [
                { batch: null },
                { batch: { $in: batches.map((batch) => batch._id) } }
            ]
        };

        if (date) {
            filter.date = date;
        } else if (startDate || endDate) {
            filter.date = {};

            if (startDate) filter.date.$gte = startDate;
            if (endDate) filter.date.$lte = endDate;
        }

        const events = await ClassCalendar.find(filter)
            .select("date type reason batch")
            .populate("batch", "name startTime endTime")
            .sort({ date: 1 });

        return res.status(200).json({
            success: true,
            count: events.length,
            events
        });

    } catch (error) {
        console.error("Get student calendar error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch calendar"
        });
    }
};

// --------------------------------------------------
// Student: Change my password
// PATCH /api/student/change-password
// --------------------------------------------------

export const changeMyPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (
            typeof currentPassword !== "string" ||
            typeof newPassword !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Passwords must be text"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters"
            });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from the current password"
            });
        }

        const student = await Student.findById(req.student._id)
            .select("+password");

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const matches = await bcrypt.compare(
            currentPassword,
            student.password
        );

        if (!matches) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        student.password = await bcrypt.hash(newPassword, 10);

        await student.save();

        return res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error) {
        console.error("Change student password error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to change password"
        });
    }
};
