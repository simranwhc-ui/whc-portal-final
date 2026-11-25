    import Project from "../models/Project.js";
    import Batch from "../models/Batch.js";
    import Student from "../models/Student.js";
    import ProjectDeadlineExtension from "../models/ProjectDeadlineExtension.js";
    import ProjectSubmission from "../models/ProjectSubmission.js";

    export const createProject = async (req, res) => {
        try {
            const {
                title,
                description,
                subject,
                batchId,
                totalMarks,
                dueDate
            } = req.body;

            if (
                !title ||
                !subject ||
                !batchId ||
                totalMarks === undefined
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Title, subject, batch and total marks are required"
                });
            }

            if (
                !Number.isFinite(Number(totalMarks)) ||
                Number(totalMarks) <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Total marks must be greater than 0"
                });
            }

            const trainer = req.user;

            const subjectExists = trainer.subjects.some(
                assignedSubject =>
                    assignedSubject.toLowerCase() ===
                    subject.trim().toLowerCase()
            );

            if (!subjectExists) {
                return res.status(400).json({
                    success: false,
                    message:
                        "You are not assigned to this subject"
                });
            }

            const batch = await Batch.findOne({
                _id: batchId,
                trainer: req.user._id
            });

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Batch not found or does not belong to you"
                });
            }

            if (batch.students.length === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Cannot create a project for an empty batch"
                });
            }

            const evaluations = batch.students.map(
                studentId => ({
                    student: studentId,
                    status: "not_given",
                    marks: null
                })
            );

            const project = await Project.create({
                title: title.trim(),
                description: description?.trim() || "",
                subject: subject.trim(),
                trainer: req.user._id,
                batch: batch._id,
                totalMarks: Number(totalMarks),
                dueDate: dueDate || null,
                evaluations
            });

            // Create submission records for every student assigned to this project.
try {
    await ProjectSubmission.insertMany(
        batch.students.map(studentId => ({
            project: project._id,
            student: studentId,
            status: "not_submitted",
            submittedAt: null,
            markedBy: null,
            remarks: ""
        }))
    );
} catch (error) {
    // Clean up if submission initialization fails.
    await ProjectSubmission.deleteMany({
        project: project._id
    });

    await project.deleteOne();

    throw error;
}

            const populatedProject =
                await Project.findById(project._id)
                    .populate(
                        "trainer",
                        "name username email subjects"
                    )
                    .populate(
                        "batch",
                        "name startTime endTime"
                    )
                    .populate(
                        "evaluations.student",
                        "name phone course plan status"
                    );

            res.status(201).json({
                success: true,
                message:
                    "Project created successfully",
                project: populatedProject
            });

        } catch (error) {
            console.error(
                "Create project error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    };



    // Get All trainers Project

    export const getMyProjects = async (req, res) => {
        try {
            const projects = await Project.find({
                trainer: req.user._id
            })
                .populate(
                    "batch",
                    "name startTime endTime"
                )
                .populate(
                    "evaluations.student",
                    "name phone course plan status"
                )
                .sort({
                    createdAt: -1
                });

            res.status(200).json({
                success: true,
                count: projects.length,
                projects
            });

        } catch (error) {
            console.error(
                "Get trainer projects error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    };

    // Get One Project

    export const getMyProjectById = async (
        req,
        res
    ) => {
        try {
            const project =
                await Project.findOne({
                    _id: req.params.id,
                    trainer: req.user._id
                })
                    .populate(
                        "batch",
                        "name startTime endTime"
                    )
                    .populate(
                        "evaluations.student",
                        "name phone course plan status"
                    );

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Project not found or does not belong to you"
                });
            }

            res.status(200).json({
                success: true,
                project
            });

        } catch (error) {
            console.error(
                "Get project error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    };

    export const evaluateProjectStudent = async (
        req,
        res
    ) => {
        try {
            const {
                status,
                marks
            } = req.body;

            if (
                !["evaluated", "not_given"].includes(
                    status
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Status must be evaluated or not_given"
                });
            }

            const project =
                await Project.findOne({
                    _id: req.params.projectId,
                    trainer: req.user._id
                });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Project not found or does not belong to you"
                });
            }

            const evaluation =
                project.evaluations.find(
                    item =>
                        item.student.toString() ===
                        req.params.studentId
                );

            if (!evaluation) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Student is not assigned to this project"
                });
            }

            // A project must be marked as submitted before it can be evaluated.
if (status === "evaluated") {
    const submission = await ProjectSubmission.findOne({
        project: project._id,
        student: req.params.studentId
    });

    if (!submission || submission.status !== "submitted") {
        return res.status(400).json({
            success: false,
            message: "Mark the project as submitted before evaluating it"
        });
    }
}

            if (status === "not_given") {
                evaluation.status = "not_given";
                evaluation.marks = null;
            }

            if (status === "evaluated") {
                if (
                    marks === undefined ||
                    marks === null
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Marks are required when status is evaluated"
                    });
                }

                if (
                    !Number.isFinite(Number(marks)) ||
                    Number(marks) < 0 ||
                    Number(marks) > project.totalMarks
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            `Marks must be between 0 and ${project.totalMarks}`
                    });
                }

                evaluation.status = "evaluated";
                evaluation.marks = Number(marks);
            }

            await project.save();

            const updatedProject =
                await Project.findById(project._id)
                    .populate(
                        "batch",
                        "name startTime endTime"
                    )
                    .populate(
                        "evaluations.student",
                        "name phone course plan status"
                    );

            res.status(200).json({
                success: true,
                message:
                    "Project evaluation updated successfully",
                project: updatedProject
            });

        } catch (error) {
            console.error(
                "Evaluate project student error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    };

    // Delete Project

    export const deleteProject = async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.id,
            trainer: req.user._id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found or does not belong to you"
            });
        }

        // Remove all records associated with this project.
        await ProjectSubmission.deleteMany({
            project: project._id
        });

        await ProjectDeadlineExtension.deleteMany({
            project: project._id
        });

        await project.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Project and its related records deleted successfully"
        });

    } catch (error) {
        console.error("Delete project error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


    export const setProjectDeadlineExtension = async (req, res) => {
        try {
            const { projectId, studentId } = req.params;
            const { extendedDueDate, reason } = req.body;

            if (!extendedDueDate || !reason?.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Extended deadline and reason are required"
                });
            }

            const newDeadline = new Date(extendedDueDate);

            if (Number.isNaN(newDeadline.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid extended deadline"
                });
            }

            const project = await Project.findOne({
                _id: projectId,
                trainer: req.user._id
            });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found or does not belong to you"
                });
            }

            const assignedStudent = project.evaluations.some(
                evaluation =>
                    evaluation.student.toString() === studentId
            );

            if (!assignedStudent) {
                return res.status(404).json({
                    success: false,
                    message: "Student is not assigned to this project"
                });
            }

            if (!project.dueDate) {
                return res.status(400).json({
                    success: false,
                    message: "This project does not have an original deadline"
                });
            }

            if (newDeadline <= project.dueDate) {
                return res.status(400).json({
                    success: false,
                    message: "Extended deadline must be later than the original deadline"
                });
            }

            const extension = await ProjectDeadlineExtension.findOneAndUpdate(
                {
                    project: project._id,
                    student: studentId
                },
                {
                    $set: {
                        extendedDueDate: newDeadline,
                        reason: reason.trim(),
                        extendedBy: req.user._id
                    }
                },
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            )
                .populate("student", "name phone username")
                .populate("extendedBy", "name username");

            res.status(200).json({
                success: true,
                message: "Student deadline extension saved successfully",
                extension
            });

        } catch (error) {
            console.error("Set project deadline extension error:", error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    };


    export const getProjectDeadlineExtensions = async (req, res) => {
        try {
            const project = await Project.findOne({
                _id: req.params.projectId,
                trainer: req.user._id
            });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found or does not belong to you"
                });
            }

            const extensions = await ProjectDeadlineExtension.find({
                project: project._id
            })
                .populate("student", "name phone username")
                .populate("extendedBy", "name username")
                .sort({ updatedAt: -1 });

            res.status(200).json({
                success: true,
                count: extensions.length,
                extensions
            });

        } catch (error) {
            console.error("Get project deadline extensions error:", error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    };

    // Get submission status of all students assigned to a trainer's project
export const getProjectStudentSubmissions = async (req, res) => {
    try {
        const { projectId } = req.params;

        const project = await Project.findOne({
            _id: projectId,
            trainer: req.user._id
        }).populate("evaluations.student", "name phone username");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        // Ensure older projects also have submission records.
        const operations = project.evaluations
            .filter(item => item.student)
            .map(item => ({
                updateOne: {
                    filter: {
                        project: project._id,
                        student: item.student._id
                    },
                    update: {
                        $setOnInsert: {
                            status: "not_submitted",
                            submittedAt: null,
                            markedBy: null,
                            remarks: ""
                        }
                    },
                    upsert: true
                }
            }));

        if (operations.length > 0) {
            await ProjectSubmission.bulkWrite(operations);
        }

        const submissions = await ProjectSubmission.find({
            project: project._id
        })
            .populate("student", "name phone username")
            .populate("markedBy", "name username")
            .sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            project: {
                id: project._id,
                title: project.title,
                totalMarks: project.totalMarks,
                dueDate: project.dueDate
            },
            submissions
        });
    } catch (error) {
        console.error("Get project submissions error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch project submissions",
        });
    }
};


// Trainer manually updates a student's project submission status
export const updateProjectStudentSubmission = async (req, res) => {
    try {
        const { projectId, studentId } = req.params;
        const { status, submittedAt, remarks } = req.body;

        if (!["submitted", "not_submitted"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be submitted or not_submitted"
            });
        }

        const project = await Project.findOne({
            _id: projectId,
            trainer: req.user._id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        const assignedStudent = project.evaluations.find(
            item => item.student.toString() === studentId
        );

        if (!assignedStudent) {
            return res.status(404).json({
                success: false,
                message: "Student is not assigned to this project"
            });
        }

        // Do not allow a submitted project to be reverted after evaluation.
        if (
            status === "not_submitted" &&
            assignedStudent.status === "evaluated"
        ) {
            return res.status(400).json({
                success: false,
                message: "This project has already been evaluated. Undo the evaluation first."
            });
        }

        let finalSubmittedAt = null;

        if (status === "submitted") {
            finalSubmittedAt = submittedAt
                ? new Date(submittedAt)
                : new Date();

            if (Number.isNaN(finalSubmittedAt.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid submission date"
                });
            }

            if (finalSubmittedAt > new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "Submission date cannot be in the future"
                });
            }
        }

        const updateData = {
            status,
            submittedAt: finalSubmittedAt,
            markedBy: status === "submitted" ? req.user._id : null
        };

        if (remarks !== undefined) {
            updateData.remarks = remarks;
        }

        const submission = await ProjectSubmission.findOneAndUpdate(
            {
                project: project._id,
                student: studentId
            },
            {
                $set: updateData
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        )
            .populate("student", "name phone username")
            .populate("markedBy", "name username");

        return res.status(200).json({
            success: true,
            message: "Submission status updated successfully",
            submission
        });
    } catch (error) {
        console.error("Update project submission error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update submission status",
        });
    }
};
