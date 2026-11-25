import User from "../models/User.js";
import Student from "../models/Student.js";
import Batch from "../models/Batch.js";
import Attendance from "../models/Attendance.js";
import Project from "../models/Project.js";

export const getTrainerDashboard = async (req, res) => {
    try {
        const trainerId = req.user._id;

        // Get trainer with assigned subjects
        const trainer = await User.findOne({
            _id: trainerId,
            role: "trainer"
        }).select("name username email subjects");

        if (!trainer) {
            return res.status(404).json({
                success: false,
                message: "Trainer not found"
            });
        }

        // Get assigned students
        const students = await Student.find({
            trainer: trainerId
        })
            .select("_id name phone course plan status")
            .sort({ name: 1 });

        // Get trainer's active batches
        const batches = await Batch.find({
            trainer: trainerId,
            active: true
        })
            .select(
                "name startTime endTime students active"
            )
            .populate(
                "students",
                "name phone course plan status"
            )
            .sort({ startTime: 1 });

        // Today's date
        const now = new Date();

        const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        const endOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1
        );

        // Today's attendance
        const todayAttendance =
            await Attendance.find({
                trainer: trainerId,
                date: {
                    $gte: startOfToday,
                    $lt: endOfToday
                }
            })
                .select(
                    "student batch date status"
                )
                .populate(
                    "student",
                    "name phone course"
                )
                .populate(
                    "batch",
                    "name startTime endTime"
                );

        const presentCount =
            todayAttendance.filter(
                record =>
                    record.status === "present"
            ).length;

        const absentCount =
            todayAttendance.filter(
                record =>
                    record.status === "absent"
            ).length;

        // Today's projects
        const todayProjects =
            await Project.find({
                trainer: trainerId,
                createdAt: {
                    $gte: startOfToday,
                    $lt: endOfToday
                }
            })
                .select(
                    "title subject batch totalMarks dueDate"
                )
                .populate(
                    "batch",
                    "name startTime endTime"
                );

        res.status(200).json({
            success: true,

            dashboard: {
                trainer: {
                    name: trainer.name,
                    username: trainer.username,
                    email: trainer.email
                },

                subjects: {
                    total: trainer.subjects.length,
                    names: trainer.subjects
                },

                students: {
                    total: students.length,
                    students
                },

                batches: {
                    total: batches.length,
                    batches
                },

                today: {
                    date: startOfToday,

                    attendance: {
                        totalRecords:
                            todayAttendance.length,

                        present:
                            presentCount,

                        absent:
                            absentCount
                    },

                    batches: batches,

                    projectsCreated:
                        todayProjects.length,

                    projects:
                        todayProjects
                }
            }
        });

    } catch (error) {
        console.error(
            "Get trainer dashboard error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};