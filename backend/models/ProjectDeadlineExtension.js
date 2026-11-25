
import mongoose from "mongoose";

const projectDeadlineExtensionSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true
        },

        extendedDueDate: {
            type: Date,
            required: true
        },

        reason: {
            type: String,
            required: true,
            trim: true
        },

        extendedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

projectDeadlineExtensionSchema.index(
    { project: 1, student: 1 },
    { unique: true }
);

export default mongoose.model(
    "ProjectDeadlineExtension",
    projectDeadlineExtensionSchema
);
    