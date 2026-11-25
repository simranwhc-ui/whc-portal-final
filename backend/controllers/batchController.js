import Batch from "../models/Batch.js";
import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import mongoose from "mongoose";



const isValidObjectId = (id) =>
    mongoose.Types.ObjectId.isValid(id);



const isValidTime = (time) => {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

const VALID_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

const isValidDaysOfWeek = (days) => {
    return (
        Array.isArray(days) &&
        days.length > 0 &&
        days.every(day => VALID_DAYS.includes(day)) &&
        new Set(days).size === days.length
    );
};


// Create Batch


export const createBatch = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            name,
            startTime,
            endTime,
            students = [],
            daysOfWeek
        } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Batch name is required"
            });
        }

        if (!isValidTime(startTime) || !isValidTime(endTime) || startTime >= endTime) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch timings"
            });
        }

        if (
            daysOfWeek !== undefined &&
            !isValidDaysOfWeek(daysOfWeek)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid daysOfWeek"
            });
        }

        if (!Array.isArray(students)) {
            return res.status(400).json({
                success: false,
                message: "Students must be an array"
            });
        }

        const studentIds = [...new Set(students.map(String))];

        if (!studentIds.every(isValidObjectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID"
            });
        }

        let createdBatchId;

        await session.withTransaction(async () => {
            const assignedStudents = await Student.find({
                _id: { $in: studentIds },
                trainer: req.user._id,
                status: "active",
                $or: [
                    { batch: null },
                    { batch: { $exists: false } }
                ]
            }).session(session);

            if (assignedStudents.length !== studentIds.length) {
                throw new Error(
                    "Some students are inactive, not assigned to you, or already belong to another batch"
                );
            }

            const [batch] = await Batch.create([{
                name: name.trim(),
                trainer: req.user._id,
                students: studentIds,
                startTime,
                endTime,
                ...(daysOfWeek !== undefined && { daysOfWeek })
            }], { session });

            const result = await Student.updateMany(
                {
                    _id: { $in: studentIds },
                    trainer: req.user._id,
                    $or: [
                        { batch: null },
                        { batch: { $exists: false } }
                    ]
                },
                {
                    $set: { batch: batch._id }
                },
                { session }
            );

            if (result.modifiedCount !== studentIds.length) {
                throw new Error("Could not assign all students to the batch");
            }

            createdBatchId = batch._id;
        });

        const createdBatch = await Batch.findById(createdBatchId)
        .populate("students", "name phone course plan status")
        .populate("trainer", "name username email subjects");

        res.status(201).json({
            success: true,
            message: "Batch created successfully",
            batch: createdBatch
        });

    } catch (error) {
        console.error("Create batch error:", error);

        res.status(400).json({
            success: false,
            message: error.message || "Could not create batch"
        });

    } finally {
        await session.endSession();
    }
};


// Get Trainers Batch

export const getMyBatches = async (req, res) => {
    try {
        const batches = await Batch.find({
            trainer: req.user._id
        })
            .populate(
                "students",
                "name phone course plan status"
            )
            .sort({
                startTime: 1
            });

        res.status(200).json({
            success: true,
            count: batches.length,
            batches
        });

    } catch (error) {
        console.error(
            "Get batches error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Get One Batch


export const getMyBatchById = async (req, res) => {
    try {
        const batch = await Batch.findOne({
            _id: req.params.id,
            trainer: req.user._id
        }).populate(
            "students",
            "name phone course plan status"
        );

        if (!batch) {
            return res.status(404).json({
                success: false,
                message:
                    "Batch not found or does not belong to you"
            });
        }

        res.status(200).json({
            success: true,
            batch
        });

    } catch (error) {
        console.error(
            "Get batch error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Update Batch Name / Timings / Weekly Schedule

export const updateBatch = async (req, res) => {
    try {
        const {
            name,
            startTime,
            endTime,
            active,
            daysOfWeek
        } = req.body;

        const batch = await Batch.findOne({
            _id: req.params.id,
            trainer: req.user._id
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or does not belong to you"
            });
        }

        // Validate updated timings
        const newStartTime = startTime ?? batch.startTime;
        const newEndTime = endTime ?? batch.endTime;

        if (
            !isValidTime(newStartTime) ||
            !isValidTime(newEndTime) ||
            newStartTime >= newEndTime
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch timings"
            });
        }

        // Validate weekly schedule
        if (
            daysOfWeek !== undefined &&
            !isValidDaysOfWeek(daysOfWeek)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid daysOfWeek. Provide unique valid weekdays."
            });
        }

        // Update fields
        if (name !== undefined) {
            batch.name = name;
        }

        if (startTime !== undefined) {
            batch.startTime = startTime;
        }

        if (endTime !== undefined) {
            batch.endTime = endTime;
        }

        if (active !== undefined) {
            batch.active = active;
        }

        if (daysOfWeek !== undefined) {
            batch.daysOfWeek = daysOfWeek;
        }

        await batch.save();

        const updatedBatch = await Batch.findById(batch._id)
            .populate("students", "name phone course plan status");

        res.status(200).json({
            success: true,
            message: "Batch updated successfully",
            batch: updatedBatch
        });

    } catch (error) {
        console.error("Update batch error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// Add Students To Batch

export const addStudentsToBatch = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { studentIds } = req.body;

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "studentIds must be a non-empty array"
            });
        }

        const uniqueIds = [...new Set(studentIds.map(String))];

        if (!uniqueIds.every(isValidObjectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID"
            });
        }

        let batchId;

        await session.withTransaction(async () => {
            const batch = await Batch.findOne({
                _id: req.params.id,
                trainer: req.user._id,
                active: true
            }).session(session);

            if (!batch) {
                throw new Error("Active batch not found or does not belong to you");
            }

            const eligibleStudents = await Student.find({
                _id: { $in: uniqueIds },
                trainer: req.user._id,
                status: "active",
                $or: [
                    { batch: null },
                    { batch: { $exists: false } }
                ]
            }).session(session);

            if (eligibleStudents.length !== uniqueIds.length) {
                throw new Error(
                    "Some students are inactive, not assigned to you, or already belong to another batch"
                );
            }

            const result = await Student.updateMany(
                {
                    _id: { $in: uniqueIds },
                    trainer: req.user._id,
                    $or: [
                        { batch: null },
                        { batch: { $exists: false } }
                    ]
                },
                {
                    $set: { batch: batch._id }
                },
                { session }
            );

            if (result.modifiedCount !== uniqueIds.length) {
                throw new Error("Student assignment conflict");
            }

            batch.students.push(...uniqueIds);
            await batch.save({ session });

            batchId = batch._id;
        });

        const updatedBatch = await Batch.findById(batchId)
            .populate("students", "name phone course plan status");

        res.status(200).json({
            success: true,
            message: "Students added successfully",
            batch: updatedBatch
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });

    } finally {
        await session.endSession();
    }
};



// Remove a Student From Batch

export const removeStudentFromBatch = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        let batchId;

        await session.withTransaction(async () => {
            const batch = await Batch.findOne({
                _id: req.params.batchId,
                trainer: req.user._id
            }).session(session);

            if (!batch) {
                throw new Error("Batch not found");
            }

            const studentId = req.params.studentId;

            const exists = batch.students.some(
                id => id.toString() === studentId
            );

            if (!exists) {
                throw new Error("Student is not in this batch");
            }

            const student = await Student.findOneAndUpdate(
                {
                    _id: studentId,
                    trainer: req.user._id,
                    batch: batch._id
                },
                {
                    $set: { batch: null }
                },
                {
                    new: true,
                    session
                }
            );

            if (!student) {
                throw new Error("Student batch assignment is inconsistent");
            }

            batch.students.pull(studentId);
            await batch.save({ session });

            batchId = batch._id;
        });

        const updatedBatch = await Batch.findById(batchId)
            .populate("students", "name phone course plan status");

        res.status(200).json({
            success: true,
            message: "Student removed from batch successfully",
            batch: updatedBatch
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });

    } finally {
        await session.endSession();
    }
};


// Delete Batch

export const deleteBatch = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const batch = await Batch.findOne({
                _id: req.params.id,
                trainer: req.user._id
            }).session(session);

            if (!batch) {
                throw new Error("Batch not found");
            }

            await Student.updateMany(
                {
                    _id: { $in: batch.students },
                    batch: batch._id
                },
                {
                    $set: { batch: null }
                },
                { session }
            );

            batch.active = false;

            // Keep the original roster for historical reference.
            await batch.save({ session });
        });

        res.status(200).json({
            success: true,
            message: "Batch archived successfully. Historical records are preserved."
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });

    } finally {
        await session.endSession();
    }
};