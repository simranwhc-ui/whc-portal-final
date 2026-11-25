
import Project from "../models/Project.js";
import ProjectSubmission from "../models/ProjectSubmission.js";
import ProjectDeadlineExtension from "../models/ProjectDeadlineExtension.js";

// Get all projects assigned to the logged-in student
export const getMyAssignedProjects = async (req, res) => {
    try {
        const studentId = req.student._id;

        // Find only projects assigned to this student.
        const projects = await Project.find({
            "evaluations.student": studentId
        })
            .populate("trainer", "name username")
            .populate("batch", "name startTime endTime")
            .sort({ createdAt: -1 });

        if (projects.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                projects: []
            });
        }

        const projectIds = projects.map(project => project._id);

        // Fetch only this student's submission records.
        const submissions = await ProjectSubmission.find({
            project: { $in: projectIds },
            student: studentId
        });

        // Fetch only this student's deadline extensions.
        const extensions = await ProjectDeadlineExtension.find({
            project: { $in: projectIds },
            student: studentId
        });

        const submissionMap = new Map(
            submissions.map(item => [
                item.project.toString(),
                item
            ])
        );

        const extensionMap = new Map(
            extensions.map(item => [
                item.project.toString(),
                item
            ])
        );

        const formattedProjects = projects.map(project => {
            const projectId = project._id.toString();

            const evaluation = project.evaluations.find(
                item => item.student.toString() === studentId.toString()
            );

            const submission = submissionMap.get(projectId);
            const extension = extensionMap.get(projectId);

            return {
                id: project._id,
                title: project.title,
                description: project.description,
                subject: project.subject,

                trainer: project.trainer,
                batch: project.batch,

                totalMarks: project.totalMarks,

                originalDueDate: project.dueDate,
                effectiveDueDate: extension
                    ? extension.extendedDueDate
                    : project.dueDate,

                deadlineExtension: extension
                    ? {
                        extendedDueDate: extension.extendedDueDate,
                        reason: extension.reason
                    }
                    : null,

                submission: {
                    status: submission?.status || "not_submitted",
                    submittedAt: submission?.submittedAt || null,
                    remarks: submission?.remarks || ""
                },

                evaluation: {
                    status: evaluation?.status || "not_given",
                    marks: evaluation?.marks ?? null
                },

                createdAt: project.createdAt
            };
        });

        return res.status(200).json({
            success: true,
            count: formattedProjects.length,
            projects: formattedProjects
        });

    } catch (error) {
        console.error("Get student projects error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch assigned projects"
        });
    }
};
