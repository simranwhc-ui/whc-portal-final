
import mongoose from "mongoose";

import Attendance from "../models/Attendance.js";
import Batch from "../models/Batch.js";
import Student from "../models/Student.js";
import ClassCalendar from "../models/ClassCalendar.js";
import AttendanceSession from "../models/AttendanceSession.js";


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const isValidObjectId = (id) =>
    mongoose.Types.ObjectId.isValid(id);


const isValidDate = (date) => {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
    );
};


const getUTCDate = (date) =>
    new Date(`${date}T00:00:00.000Z`);


const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};


const getClassDayStatus = async ({
    trainerId,
    batch,
    date
}) => {
    const weekdays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    const weekday = weekdays[
        getUTCDate(date).getUTCDay()
    ];

    const scheduledDays = Array.isArray(batch.daysOfWeek)
        ? batch.daysOfWeek
        : [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];

    if (!scheduledDays.includes(weekday)) {
        return {
            isScheduled: false,
            reason: `${weekday} is not a scheduled class day`,
            event: null
        };
    }

    const event = await ClassCalendar.findOne({
        trainer: trainerId,
        date,
        $or: [
            { batch: null },
            { batch: batch._id }
        ]
    });

    if (event) {
        return {
            isScheduled: false,
            reason: event.reason,
            event
        };
    }

    return {
        isScheduled: true,
        reason: null,
        event: null
    };
};


// --------------------------------------------------
// 1. MARK ATTENDANCE
// --------------------------------------------------

export const markAttendance = async (req, res) => {
    let dbSession;

    try {
        const { batchId } = req.params;
        const { date, attendance } = req.body;

        // Validate batch ID
        if (!isValidObjectId(batchId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch ID"
            });
        }

        // Validate date
        if (!isValidDate(date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date. Use YYYY-MM-DD format."
            });
        }

        // Validate attendance array
        if (
            !Array.isArray(attendance) ||
            attendance.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Attendance must be a non-empty array"
            });
        }

        // Validate every record before creating a session
        const submittedStudentIds = new Set();

        for (const record of attendance) {
            if (
                !record ||
                !isValidObjectId(record.studentId) ||
                !["present", "absent"].includes(record.status)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Each record requires a valid studentId and status"
                });
            }

            const studentId = record.studentId.toString();

            if (submittedStudentIds.has(studentId)) {
                return res.status(400).json({
                    success: false,
                    message: "Duplicate student found in attendance request"
                });
            }

            submittedStudentIds.add(studentId);
        }

        const batch = await Batch.findOne({
            _id: batchId,
            trainer: req.user._id
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or does not belong to you"
            });
        }

        if (!batch.active) {
            return res.status(400).json({
                success: false,
                message: "Cannot mark attendance for an inactive batch"
            });
        }

        if (!batch.students || batch.students.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot mark attendance for an empty batch"
            });
        }

        // Check weekly schedule and calendar exceptions
        const classStatus = await getClassDayStatus({
            trainerId: req.user._id,
            batch,
            date
        });

        if (!classStatus.isScheduled) {
            return res.status(400).json({
                success: false,
                message: "No class is scheduled for this date",
                reason: classStatus.reason,
                eventType: classStatus.event?.type || null
            });
        }

        dbSession = await mongoose.startSession();

        let responseData;

        await dbSession.withTransaction(async () => {

            // Create or retrieve the session.
            // revision is incremented to serialize attendance
            // updates against session completion.
            const session = await AttendanceSession.findOneAndUpdate(
                {
                    trainer: req.user._id,
                    batch: batch._id,
                    date
                },
                {
                    $setOnInsert: {
                        students: batch.students,
                        status: "draft",
                        completedAt: null
                    },
                    $inc: {
                        revision: 1
                    }
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                    session: dbSession
                }
            );

            if (session.status === "completed") {
                throw createError(
                    "Attendance for this session has already been completed"
                );
            }

            // Validate submitted students against the original snapshot
            const sessionStudentIds = new Set(
                session.students.map(id => id.toString())
            );

            for (const studentId of submittedStudentIds) {
                if (!sessionStudentIds.has(studentId)) {
                    throw createError(
                        "One or more students do not belong to this attendance session"
                    );
                }
            }

            const attendanceDate = getUTCDate(date);

            const operations = attendance.map(record => ({
                updateOne: {
                    filter: {
                        trainer: req.user._id,
                        batch: batch._id,
                        student: record.studentId,
                        date: attendanceDate
                    },
                    update: {
                        $set: {
                            status: record.status
                        }
                    },
                    upsert: true
                }
            }));

            await Attendance.bulkWrite(
                operations,
                { session: dbSession }
            );

            const savedAttendance = await Attendance.find({
                trainer: req.user._id,
                batch: batch._id,
                date: attendanceDate,
                student: { $in: session.students }
            })
                .populate(
                    "student",
                    "name phone course plan status"
                )
                .populate(
                    "batch",
                    "name startTime endTime"
                )
                .sort({ createdAt: 1 })
                .session(dbSession);

            responseData = {
                session: {
                    id: session._id,
                    date: session.date,
                    status: session.status,
                    totalStudents: session.students.length
                },
                count: savedAttendance.length,
                attendance: savedAttendance
            };
        });

        return res.status(200).json({
            success: true,
            message: "Attendance saved successfully",
            ...responseData
        });

    } catch (error) {
        console.error("Mark attendance error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An attendance session is being created or updated. Please retry."
            });
        }

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Server error"
        });

    } finally {
        if (dbSession) {
            await dbSession.endSession();
        }
    }
};


// --------------------------------------------------
// 2. GET ATTENDANCE FOR A PARTICULAR BATCH AND DATE
// --------------------------------------------------

export const getBatchAttendance = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { date } = req.query;

        if (!isValidObjectId(batchId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch ID"
            });
        }

        if (!isValidDate(date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date. Use YYYY-MM-DD format."
            });
        }

        const batch = await Batch.findOne({
            _id: batchId,
            trainer: req.user._id
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or does not belong to you"
            });
        }

        const classStatus = await getClassDayStatus({
            trainerId: req.user._id,
            batch,
            date
        });

        if (!classStatus.isScheduled) {
            return res.status(200).json({
                success: true,
                message: "No class was scheduled on this date",
                classStatus: {
                    isScheduled: false,
                    reason: classStatus.reason,
                    eventType: classStatus.event?.type || null
                },
                summary: {
                    total: 0,
                    marked: 0,
                    unmarked: 0,
                    present: 0,
                    absent: 0,
                    progress: 0
                },
                attendance: []
            });
        }

        const session = await AttendanceSession.findOne({
            trainer: req.user._id,
            batch: batch._id,
            date
        });

        // Use the original snapshot if a session exists.
        // Otherwise, use the current batch roster.
        const studentIds = session
            ? session.students
            : batch.students;

        const records = studentIds.length > 0
            ? await Attendance.find({
                trainer: req.user._id,
                batch: batch._id,
                date: getUTCDate(date),
                student: { $in: studentIds }
            })
                .populate(
                    "student",
                    "name phone course plan status"
                )
                .populate(
                    "batch",
                    "name startTime endTime"
                )
                .sort({ createdAt: 1 })
            : [];

        const present = records.filter(
            record => record.status === "present"
        ).length;

        const absent = records.filter(
            record => record.status === "absent"
        ).length;

        const total = studentIds.length;
        const marked = present + absent;
        const unmarked = Math.max(0, total - marked);

        return res.status(200).json({
            success: true,

            classStatus: {
                isScheduled: true,
                reason: null,
                eventType: null
            },

            session: session
                ? {
                    id: session._id,
                    status: session.status,
                    completedAt: session.completedAt
                }
                : null,

            summary: {
                total,
                marked,
                unmarked,
                present,
                absent,
                progress: total > 0
                    ? Math.round((marked / total) * 100)
                    : 0
            },

            attendance: records
        });

    } catch (error) {
        console.error("Get batch attendance error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// --------------------------------------------------
// 3. GET ATTENDANCE HISTORY
// --------------------------------------------------

export const getAttendanceHistory = async (req, res) => {
    try {
        const {
            batchId,
            studentId,
            date,
            startDate,
            endDate
        } = req.query;

        const filter = {
            trainer: req.user._id
        };

        if (batchId) {
            if (!isValidObjectId(batchId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid batch ID"
                });
            }

            const batch = await Batch.findOne({
                _id: batchId,
                trainer: req.user._id
            });

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: "Batch not found or does not belong to you"
                });
            }

            filter.batch = batch._id;
        }

        if (studentId) {
            if (!isValidObjectId(studentId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid student ID"
                });
            }

            const student = await Student.findOne({
                _id: studentId,
                trainer: req.user._id
            });

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: "Student not found or not assigned to you"
                });
            }

            filter.student = student._id;
        }

        if (date) {
            if (!isValidDate(date)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date. Use YYYY-MM-DD format."
                });
            }

            filter.date = getUTCDate(date);

        } else if (startDate || endDate) {

            if (startDate && !isValidDate(startDate)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid start date"
                });
            }

            if (endDate && !isValidDate(endDate)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid end date"
                });
            }

            if (
                startDate &&
                endDate &&
                startDate > endDate
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Start date cannot be after end date"
                });
            }

            filter.date = {};

            if (startDate) {
                filter.date.$gte = getUTCDate(startDate);
            }

            if (endDate) {
                filter.date.$lte = new Date(
                    `${endDate}T23:59:59.999Z`
                );
            }
        }

        const history = await Attendance.find(filter)
            .populate(
                "student",
                "name phone course plan status"
            )
            .populate(
                "batch",
                "name startTime endTime"
            )
            .sort({
                date: -1,
                createdAt: -1
            });

        const present = history.filter(
            record => record.status === "present"
        ).length;

        const absent = history.filter(
            record => record.status === "absent"
        ).length;

        return res.status(200).json({
            success: true,

            summary: {
                totalRecords: history.length,
                present,
                absent
            },

            attendance: history
        });

    } catch (error) {
        console.error("Attendance history error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// --------------------------------------------------
// 4. COMPLETE ATTENDANCE SESSION
// --------------------------------------------------

export const completeAttendanceSession = async (req, res) => {
    let dbSession;

    try {
        const { sessionId } = req.params;

        if (!isValidObjectId(sessionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid attendance session ID"
            });
        }

        dbSession = await mongoose.startSession();

        let responseData;

        await dbSession.withTransaction(async () => {

            const session = await AttendanceSession.findOne({
                _id: sessionId,
                trainer: req.user._id
            }).session(dbSession);

            if (!session) {
                throw createError(
                    "Attendance session not found",
                    404
                );
            }

            if (session.status === "completed") {
                throw createError(
                    "Attendance session is already completed"
                );
            }

            if (session.students.length === 0) {
                throw createError(
                    "Cannot complete attendance for an empty session"
                );
            }

            const attendanceDate = getUTCDate(session.date);

            const records = await Attendance.find({
                trainer: req.user._id,
                batch: session.batch,
                date: attendanceDate,
                student: { $in: session.students }
            })
                .select("student status")
                .session(dbSession);

            const markedStudentIds = new Set(
                records.map(record => record.student.toString())
            );

            const missingStudents = session.students.filter(
                studentId => !markedStudentIds.has(
                    studentId.toString()
                )
            );

            if (missingStudents.length > 0) {
                throw createError(
                    "Attendance is incomplete. Mark every student before completing the session."
                );
            }

            const completedAt = new Date();

            // Conditional update prevents a second completion.
            const updateResult = await AttendanceSession.updateOne(
                {
                    _id: session._id,
                    trainer: req.user._id,
                    status: "draft"
                },
                {
                    $set: {
                        status: "completed",
                        completedAt
                    },
                    $inc: {
                        revision: 1
                    }
                },
                {
                    session: dbSession
                }
            );

            if (updateResult.matchedCount !== 1) {
                throw createError(
                    "Session could not be completed because it was updated concurrently",
                    409
                );
            }

            responseData = {
                session: {
                    _id: session._id,
                    batch: session.batch,
                    date: session.date,
                    status: "completed",
                    completedAt
                },

                summary: {
                    total: records.length,
                    present: records.filter(
                        record => record.status === "present"
                    ).length,
                    absent: records.filter(
                        record => record.status === "absent"
                    ).length
                }
            };
        });

        return res.status(200).json({
            success: true,
            message: "Attendance session completed successfully",
            ...responseData
        });

    } catch (error) {
        console.error("Complete attendance session error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Server error"
        });

    } finally {
        if (dbSession) {
            await dbSession.endSession();
        }
    }
};


// --------------------------------------------------
// 5. GET ATTENDANCE SESSIONS
// --------------------------------------------------

export const getAttendanceSessions = async (req, res) => {
    try {
        const {
            batchId,
            status,
            startDate,
            endDate
        } = req.query;

        const filter = {
            trainer: req.user._id
        };

        if (batchId) {
            if (!isValidObjectId(batchId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid batch ID"
                });
            }

            const batch = await Batch.findOne({
                _id: batchId,
                trainer: req.user._id
            });

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: "Batch not found"
                });
            }

            filter.batch = batch._id;
        }

        if (status) {
            if (!["draft", "completed"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid session status"
                });
            }

            filter.status = status;
        }

        if (startDate && !isValidDate(startDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid start date"
            });
        }

        if (endDate && !isValidDate(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid end date"
            });
        }

        if (
            startDate &&
            endDate &&
            startDate > endDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        if (startDate || endDate) {
            filter.date = {};

            if (startDate) {
                filter.date.$gte = startDate;
            }

            if (endDate) {
                filter.date.$lte = endDate;
            }
        }

        const sessions = await AttendanceSession.find(filter)
            .populate(
                "batch",
                "name startTime endTime daysOfWeek"
            )
            .sort({
                date: -1,
                createdAt: -1
            })
            .limit(100);

        if (sessions.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                sessions: []
            });
        }

        // Only query attendance for sessions whose batch still exists.
        const validSessions = sessions.filter(
            session => session.batch
        );

        const attendanceConditions = validSessions.map(session => ({
            batch: session.batch._id,
            date: getUTCDate(session.date)
        }));

        const attendanceRecords = attendanceConditions.length > 0
            ? await Attendance.find({
                trainer: req.user._id,
                $or: attendanceConditions
            }).select("batch student date status")
            : [];

        const attendanceMap = new Map();

        for (const record of attendanceRecords) {
            const dateKey = record.date
                .toISOString()
                .slice(0, 10);

            const key = `${record.batch.toString()}_${dateKey}`;

            if (!attendanceMap.has(key)) {
                attendanceMap.set(key, []);
            }

            attendanceMap.get(key).push(record);
        }

        const formattedSessions = sessions.map(session => {
            const batchId = session.batch?._id?.toString();

            const key = batchId
                ? `${batchId}_${session.date}`
                : null;

            const records = key
                ? attendanceMap.get(key) || []
                : [];

            const sessionStudentIds = new Set(
                session.students.map(id => id.toString())
            );

            const validRecords = records.filter(record =>
                sessionStudentIds.has(record.student.toString())
            );

            const present = validRecords.filter(
                record => record.status === "present"
            ).length;

            const absent = validRecords.filter(
                record => record.status === "absent"
            ).length;

            const totalStudents = session.students.length;
            const marked = present + absent;
            const unmarked = Math.max(
                0,
                totalStudents - marked
            );

            return {
                _id: session._id,
                date: session.date,
                status: session.status,
                completedAt: session.completedAt,

                batch: session.batch,

                summary: {
                    totalStudents,
                    marked,
                    unmarked,
                    present,
                    absent,
                    progress: totalStudents > 0
                        ? Math.round(
                            (marked / totalStudents) * 100
                        )
                        : 0
                }
            };
        });

        return res.status(200).json({
            success: true,
            count: formattedSessions.length,
            sessions: formattedSessions
        });

    } catch (error) {
        console.error("Get attendance sessions error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};
