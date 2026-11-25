import Student from "../models/Student.js";

export const getMyStudents = async (req, res) => {
    try {

        const students = await Student.find({
            trainer: req.user._id
        })
            .select("-password")
            .populate(
                "counsellor",
                "name username email"
            )
            .populate(
                "trainer",
                "name username email subjects"
            )
            .populate(
                "lead",
                "studentName phone course status convertedAt"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: students.length,
            students
        });

    } catch (error) {

        console.error(
            "Get trainer students error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const getMyStudentById = async (req, res) => {
    try {

        const student = await Student.findOne({
            _id: req.params.id,
            trainer: req.user._id
        })
            .select("-password")
            .populate(
                "counsellor",
                "name username email"
            )
            .populate(
                "trainer",
                "name username email subjects"
            )
            .populate(
                "lead",
                "studentName phone course status convertedAt"
            );

        if (!student) {
            return res.status(404).json({
                success: false,
                message:
                    "Student not found or not assigned to you"
            });
        }

        res.status(200).json({
            success: true,
            student
        });

    } catch (error) {

        console.error(
            "Get trainer student error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};



export const updateMyStudent = async (req, res) => {
    try {
        const { name, course } = req.body;

        if (
            name === undefined &&
            course === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Name or course is required"
            });
        }

        const student = await Student.findOne({
            _id: req.params.id,
            trainer: req.user._id
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found or not assigned to you"
            });
        }

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid student name"
                });
            }

            student.name = name.trim();
        }

        if (course !== undefined) {
            if (typeof course !== "string" || !course.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid course"
                });
            }

            student.course = course.trim();
        }

        await student.save();

        const updatedStudent = await Student.findById(student._id)
            .select("-password")
            .populate("counsellor", "name username email")
            .populate("trainer", "name username email subjects")
            .populate("lead", "studentName phone course status convertedAt")
            .populate("batch", "name startTime endTime daysOfWeek");

        res.status(200).json({
            success: true,
            message: "Student updated successfully",
            student: updatedStudent
        });

    } catch (error) {
        console.error("Update trainer student error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};
