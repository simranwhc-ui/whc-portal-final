
import Student from "../models/Student.js";
import Lead from "../models/Lead.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import User from "../models/User.js";
import Batch from "../models/Batch.js";
import Attendance from "../models/Attendance.js";
import AttendanceSession from "../models/AttendanceSession.js";
import Project from "../models/Project.js";
import ProjectSubmission from "../models/ProjectSubmission.js";
import ProjectDeadlineExtension from "../models/ProjectDeadlineExtension.js";
import MonthlyEvaluation from "../models/MonthlyEvaluation.js";
import Fee from "../models/Fee.js";
import Complaint from "../models/Complaint.js";

// Validate YYYY-MM-DD dates
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

const createStudentUsername = async (name) => {
    const baseName = name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "student";

    let suffix = 1;
    let username = `${baseName}${suffix}`;

    while (await Student.exists({ username })) {
        suffix++;
        username = `${baseName}${suffix}`;
    }

    return username;
};

// --------------------------------------------------
// Convert Lead into Student
// --------------------------------------------------

export const convertLeadToStudent = async (req, res) => {
    try {
        const { leadId } = req.params;

        const lead = await Lead.findById(leadId);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        if (lead.status === "converted") {
            return res.status(400).json({
                success: false,
                message: "Lead is already converted"
            });
        }

        if (lead.status === "lost") {
            return res.status(400).json({
                success: false,
                message: "A lost lead cannot be converted"
            });
        }

        if (!lead.assignedCounsellor) {
            return res.status(400).json({
                success: false,
                message: "Lead must be assigned to a counsellor"
            });
        }

        // Counsellors can only convert their own leads
        if (req.user.role === "counsellor") {
            if (
                lead.assignedCounsellor.toString() !==
                req.user._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You can only convert your own leads"
                });
            }
        }

        if (lead.phone.trim().length < 6) {
            return res.status(400).json({
                success: false,
                message: "Student phone number must be at least 6 characters"
            });
        }

        // The numeric suffix keeps usernames unique when students share a name.
        const username = await createStudentUsername(lead.studentName);
        const plainPassword = lead.phone;

        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const student = await Student.create({
            name: lead.studentName,
            phone: lead.phone,
            course: lead.course,
            plan: "regular",
            status: "active",
            username,
            password: hashedPassword,
            counsellor: lead.assignedCounsellor,
            lead: lead._id
        });

        lead.status = "converted";
        lead.convertedAt = new Date();

        await lead.save();

        const populatedStudent = await Student.findById(student._id)
            .select("-password")
            .populate("counsellor", "name username email")
            .populate(
                "lead",
                "studentName phone course status convertedAt"
            );

        return res.status(201).json({
            success: true,
            message: "Lead converted to student successfully",
            student: populatedStudent,
            credentials: {
                username,
                password: plainPassword
            }
        });

    } catch (error) {
        console.error("Convert lead to student error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A student account already exists for this username"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Counsellor: Create a student admission and login
// --------------------------------------------------

export const createCounsellorStudent = async (req, res) => {
    try {
        const { name, fatherName, phone, course } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            (phone !== undefined && typeof phone !== "string") ||
            typeof course !== "string" ||
            !course.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Student name and course are required"
            });
        }

        const normalizedPhone = phone?.trim() || "";
        if (normalizedPhone && normalizedPhone.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Student phone number must be at least 6 characters"
            });
        }

        const username = await createStudentUsername(name.trim());
        const password = normalizedPhone || randomBytes(9).toString("base64url");
        const hashedPassword = await bcrypt.hash(password, 10);
        const student = await Student.create({
            name: name.trim(),
            fatherName: typeof fatherName === "string" ? fatherName.trim() : "",
            phone: normalizedPhone,
            course: course.trim(),
            plan: "regular",
            status: "active",
            username,
            password: hashedPassword,
            counsellor: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: "Student admission created successfully",
            student: {
                id: student._id,
                name: student.name,
                phone: student.phone,
                course: student.course,
                username: student.username,
                status: student.status,
                enrollmentDate: student.enrollmentDate
            },
            credentials: {
                username,
                password,
                passwordSource: normalizedPhone ? "phone" : "generated"
            }
        });
    } catch (error) {
        console.error("Create counsellor student error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A student with this username already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create student admission"
        });
    }
};

// --------------------------------------------------
// Get all students
// --------------------------------------------------

export const getStudents = async (req, res) => {
    try {
        const students = await Student.find()
            .select("-password")
            .populate("counsellor", "name email phone username")
            .populate(
                "lead",
                "studentName phone course status convertedAt"
            )
            .populate(
                "trainer",
                "name username email subjects status"
            )
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: students.length,
            students
        });

    } catch (error) {
        console.error("Get students error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Get one student
// --------------------------------------------------

export const getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .select("-password")
            .populate("counsellor", "name email phone username")
            .populate(
                "lead",
                "studentName phone course status convertedAt"
            )
            .populate(
                "trainer",
                "name username email subjects status"
            );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        return res.status(200).json({
            success: true,
            student
        });

    } catch (error) {
        console.error("Get student error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Update student basic information
// --------------------------------------------------

export const updateStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .select("-password");

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const { name, fatherName, phone, course } = req.body;

        if (name !== undefined) {
            student.name = name;
        }

        if (phone !== undefined) {
            if (typeof phone !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Phone number must be a string"
                });
            }

            // Username remains unchanged when phone is edited.
            const normalizedPhone = phone.trim();
            if (normalizedPhone && normalizedPhone.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "Student phone number must be at least 6 characters"
                });
            }
            student.phone = normalizedPhone;
        }

        if (course !== undefined) {
            student.course = course;
        }

        if (fatherName !== undefined) {
            if (typeof fatherName !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Father name must be a string"
                });
            }

            student.fatherName = fatherName.trim();
        }

        await student.save();

        const updatedStudent = await Student.findById(student._id)
            .select("-password")
            .populate("counsellor", "name username email")
            .populate("trainer", "name username email");

        return res.status(200).json({
            success: true,
            message: "Student updated successfully",
            student: updatedStudent
        });

    } catch (error) {
        console.error("Update student error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Change student plan
// --------------------------------------------------

export const changeStudentPlan = async (req, res) => {
    try {
        const { plan } = req.body;

        const allowedPlans = [
            "regular",
            "premium",
            "platinum",
            "platinum_pro",
            "industrial_training_6_weeks",
            "industrial_training_6_months"
        ];

        if (!allowedPlans.includes(plan)) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan. Allowed plans are: " +
                    allowedPlans.join(", ")
            });
        }

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        student.plan = plan;

        await student.save();

        const updatedStudent = await Student.findById(student._id)
            .select("-password")
            .populate("counsellor", "name username email")
            .populate("trainer", "name username email");

        return res.status(200).json({
            success: true,
            message: `Student plan changed to ${plan}`,
            student: updatedStudent
        });

    } catch (error) {
        console.error("Change student plan error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Change student status
// --------------------------------------------------

export const changeStudentStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const allowedStatuses = [
            "active",
            "non-active",
            "completed",
            "drop"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student status"
            });
        }

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        student.status = status;

        await student.save();

        const updatedStudent = await Student.findById(student._id)
            .select("-password")
            .populate("counsellor", "name username email")
            .populate("trainer", "name username email");

        return res.status(200).json({
            success: true,
            message: `Student status changed to ${status}`,
            student: updatedStudent
        });

    } catch (error) {
        console.error("Change student status error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Admin: Reset student password
// Defaults to the student's phone number (the initial password).
// --------------------------------------------------

export const resetStudentPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const plainPassword = newPassword || student.phone;

        if (
            typeof plainPassword !== "string" ||
            plainPassword.length < 6
        ) {
            return res.status(400).json({
                success: false,
                message: student.phone
                    ? "Password must be at least 6 characters"
                    : "No phone number is set; provide a new password of at least 6 characters"
            });
        }

        student.password = await bcrypt.hash(plainPassword, 10);

        await student.save();

        return res.status(200).json({
            success: true,
            message: newPassword
                ? "Student password reset successfully"
                : "Student password reset to their phone number"
        });

    } catch (error) {
        console.error("Reset student password error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Delete student
// --------------------------------------------------

export const deleteStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const cleanupOperations = [
            Batch.updateMany(
                { students: student._id },
                { $pull: { students: student._id } }
            ),
            AttendanceSession.updateMany(
                { students: student._id },
                { $pull: { students: student._id } }
            ),
            Attendance.deleteMany({ student: student._id }),
            MonthlyEvaluation.deleteMany({ student: student._id }),
            Project.updateMany(
                { "evaluations.student": student._id },
                { $pull: { evaluations: { student: student._id } } }
            ),
            ProjectSubmission.deleteMany({ student: student._id }),
            ProjectDeadlineExtension.deleteMany({ student: student._id }),
            Fee.deleteMany({ student: student._id }),
            Complaint.deleteMany({ student: student._id }),
        ];

        if (student.lead) {
            cleanupOperations.push(Lead.deleteOne({ _id: student.lead }));
        }

        await Promise.all(cleanupOperations);
        await student.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Student deleted successfully"
        });

    } catch (error) {
        console.error("Delete student error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Counsellor: Get my students
// --------------------------------------------------

export const getMyStudents = async (req, res) => {
    try {
        const students = await Student.find({
            counsellor: req.user._id
        })
            .select("-password")
            .populate("counsellor", "name username email")
            .populate(
                "lead",
                "studentName phone course status convertedAt"
            )
            .populate("trainer", "name username email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: students.length,
            students
        });

    } catch (error) {
        console.error("Get my students error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Assign trainer to student
// --------------------------------------------------

export const assignTrainerToStudent = async (req, res) => {
    try {
        const { trainerId } = req.body;

        if (!trainerId) {
            return res.status(400).json({
                success: false,
                message: "Trainer ID is required"
            });
        }

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const trainer = await User.findOne({
            _id: trainerId,
            role: "trainer",
            status: "active",
            employmentStatus: "active"
        });

        if (!trainer) {
            return res.status(404).json({
                success: false,
                message: "Active trainer not found"
            });
        }

        const oldTrainerId = student.trainer;

        if (
            oldTrainerId &&
            oldTrainerId.toString() === trainer._id.toString()
        ) {
            return res.status(400).json({
                success: false,
                message: "Student is already assigned to this trainer"
            });
        }

        // Remove the student from the previous trainer's batches.
        if (oldTrainerId) {
            await Batch.updateMany(
                {
                    trainer: oldTrainerId,
                    students: student._id
                },
                {
                    $pull: {
                        students: student._id
                    }
                }
            );
        }

        student.trainer = trainer._id;
        student.batch = null;

        await student.save();

        const updatedStudent = await Student.findById(student._id)
            .select("-password")
            .populate(
                "trainer",
                "name username email subjects status employmentStatus"
            )
            .populate("counsellor", "name username email");

        return res.status(200).json({
            success: true,
            message: "Trainer assigned to student successfully",
            student: updatedStudent
        });

    } catch (error) {
        console.error("Assign trainer to student error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Student: Get my attendance
// --------------------------------------------------

export const getMyAttendance = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

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

        const sessionFilter = {
            students: req.student._id,
            status: "completed"
        };

        if (startDate || endDate) {
            sessionFilter.date = {};

            if (startDate) {
                sessionFilter.date.$gte = startDate;
            }

            if (endDate) {
                sessionFilter.date.$lte = endDate;
            }
        }

        const sessions = await AttendanceSession.find(sessionFilter)
            .populate("batch", "name startTime endTime")
            .sort({ date: -1 });

        if (sessions.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No completed attendance sessions found",
                summary: {
                    totalClasses: 0,
                    present: 0,
                    absent: 0,
                    attendancePercentage: 0
                },
                attendance: []
            });
        }

        const sessionConditions = sessions.map(session => ({
            batch: session.batch?._id || session.batch,
            date: new Date(`${session.date}T00:00:00.000Z`)
        }));

        const records = await Attendance.find({
            student: req.student._id,
            $or: sessionConditions
        }).populate("batch", "name startTime endTime");

        const attendanceMap = new Map();

        for (const record of records) {
            const batchId = record.batch?._id
                ? record.batch._id.toString()
                : record.batch.toString();

            const date = record.date.toISOString().slice(0, 10);

            attendanceMap.set(`${batchId}_${date}`, record);
        }

        let present = 0;
        let absent = 0;

        const attendance = sessions.map(session => {
            const batchId = session.batch?._id
                ? session.batch._id.toString()
                : session.batch.toString();

            const key = `${batchId}_${session.date}`;
            const record = attendanceMap.get(key);

            const status = record?.status || "missing";

            if (status === "present") present++;
            if (status === "absent") absent++;

            return {
                date: session.date,
                batch: session.batch,
                status,
                sessionStatus: session.status
            };
        });

        const totalClasses = sessions.length;

        const attendancePercentage = totalClasses > 0
            ? Number(((present / totalClasses) * 100).toFixed(2))
            : 0;

        return res.status(200).json({
            success: true,
            summary: {
                totalClasses,
                present,
                absent,
                attendancePercentage
            },
            attendance
        });

    } catch (error) {
        console.error("Get student attendance error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// --------------------------------------------------
// Student: Dashboard
// --------------------------------------------------

export const getStudentDashboard = async (req, res) => {
    try {
        const studentId = req.student._id;

        // 1. Fetch student profile
        const student = await Student.findById(studentId)
            .select("-password")
            .populate("trainer", "name username email subjects status")
            .populate("counsellor", "name username email");

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        // 2. Fetch student's active batches
        const batches = await Batch.find({
            students: studentId,
            active: true
        })
            .select("name startTime endTime daysOfWeek active trainer")
            .populate("trainer", "name username email")
            .sort({ createdAt: -1 });

        // 3. Fetch attendance sessions, evaluations and projects
        const [sessions, monthlyEvaluations, projects] =
            await Promise.all([
                AttendanceSession.find({
                    students: studentId,
                    status: "completed"
                }).select("date batch"),

                MonthlyEvaluation.find({
                    student: studentId
                }).sort({ year: -1, month: -1 }),

                Project.find({
                    "evaluations.student": studentId
                })
            ]);

        // 4. Calculate attendance percentage
        let present = 0;
        let absent = 0;
        let missing = 0;

        if (sessions.length > 0) {
            const sessionConditions = sessions.map(session => ({
                batch: session.batch,
                date: new Date(`${session.date}T00:00:00.000Z`)
            }));

            const records = await Attendance.find({
                student: studentId,
                $or: sessionConditions
            }).select("batch date status");

            const attendanceMap = new Map();

            records.forEach(record => {
                const key = `${record.batch.toString()}_${
                    record.date.toISOString().slice(0, 10)
                }`;

                attendanceMap.set(key, record.status);
            });

            sessions.forEach(session => {
                const key = `${session.batch.toString()}_${session.date}`;
                const status = attendanceMap.get(key);

                if (status === "present") {
                    present++;
                } else if (status === "absent") {
                    absent++;
                } else {
                    missing++;
                }
            });
        }

        const totalClasses = sessions.length;

        const attendancePercentage = totalClasses > 0
            ? Number(((present / totalClasses) * 100).toFixed(2))
            : null;

        // 5. Calculate monthly evaluation average
        const evaluationCount = monthlyEvaluations.length;

        const evaluationAverage = evaluationCount > 0
            ? Number((
                monthlyEvaluations.reduce(
                    (total, evaluation) => total + evaluation.score,
                    0
                ) / evaluationCount
            ).toFixed(2))
            : null;

        // 6. Calculate project performance
        let earnedProjectMarks = 0;
        let totalProjectMarks = 0;
        let evaluatedProjects = 0;

        projects.forEach(project => {
            const evaluation = project.evaluations.find(
                item =>
                    item.student.toString() === studentId.toString()
            );

            if (
                evaluation &&
                evaluation.status === "evaluated" &&
                evaluation.marks !== null &&
                evaluation.marks !== undefined
            ) {
                earnedProjectMarks += evaluation.marks;
                totalProjectMarks += project.totalMarks;
                evaluatedProjects++;
            }
        });

        const projectPercentage = totalProjectMarks > 0
            ? Number((
                (earnedProjectMarks / totalProjectMarks) * 100
            ).toFixed(2))
            : null;

        // 7. Calculate overall performance
        const allComponentsAvailable =
            attendancePercentage !== null &&
            evaluationAverage !== null &&
            projectPercentage !== null;

        const overallScore = allComponentsAvailable
            ? Number((
                attendancePercentage * 0.30 +
                evaluationAverage * 0.30 +
                projectPercentage * 0.40
            ).toFixed(2))
            : null;

        // 8. Determine placement eligibility
        let placementEligibility = "pending";

        if (overallScore !== null) {
            placementEligibility =
                overallScore >= 60
                    ? "eligible"
                    : "not_eligible";
        }

        // 9. Return complete dashboard
        return res.status(200).json({
            success: true,

            dashboard: {
                profile: {
                    id: student._id,
                    name: student.name,
                    phone: student.phone,
                    username: student.username,
                    course: student.course,
                    plan: student.plan,
                    status: student.status,
                    enrollmentDate: student.enrollmentDate
                },

                trainer: student.trainer,
                counsellor: student.counsellor,
                batches,

                attendance: {
                    totalClasses,
                    present,
                    absent,
                    missing,
                    percentage: attendancePercentage,
                    weight: 30
                },

                monthlyEvaluation: {
                    totalEvaluations: evaluationCount,
                    averageScore: evaluationAverage,
                    weight: 30
                },

                projects: {
                    totalProjects: projects.length,
                    evaluatedProjects,
                    earnedMarks: earnedProjectMarks,
                    totalMarks: totalProjectMarks,
                    percentage: projectPercentage,
                    weight: 40
                },

                performance: {
                    overallScore,
                    placementThreshold: 60,
                    placementEligibility
                }
            }
        });

    } catch (error) {
        console.error("Student dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch student dashboard"
        });
    }
};

// --------------------------------------------------
// Student: Get my profile
// --------------------------------------------------

export const getMyProfile = async (req, res) => {
    try {
        const student = await Student.findById(req.student._id)
            .select("-password")
            .populate("counsellor", "name username email")
            .populate("trainer", "name username email subjects");

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        return res.status(200).json({
            success: true,
            profile: {
                id: student._id,
                name: student.name,
                phone: student.phone,
                username: student.username,
                course: student.course,
                plan: student.plan,
                status: student.status,
                enrollmentDate: student.enrollmentDate,
                counsellor: student.counsellor,
                trainer: student.trainer
            }
        });

    } catch (error) {
        console.error("Get student profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch student profile"
        });
    }
};

// --------------------------------------------------
// Student: Get my course and batch details
// --------------------------------------------------

export const getMyCourse = async (req, res) => {
    try {
        const student = await Student.findById(req.student._id)
            .select("course plan trainer")
            .populate("trainer", "name username email subjects");

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const batches = await Batch.find({
            students: student._id
        })
            .populate("trainer", "name username email subjects")
            .select("name trainer startTime endTime daysOfWeek active")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            course: {
                name: student.course,
                plan: student.plan,
                assignedTrainer: student.trainer
            },
            batches
        });

    } catch (error) {
        console.error("Get student course error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch course details"
        });
    }
};
