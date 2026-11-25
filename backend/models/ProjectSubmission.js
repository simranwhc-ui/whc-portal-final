
import mongoose from "mongoose";

const projectSubmissionSchema = new mongoose.Schema(
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

        status: {
            type: String,
            enum: ["not_submitted", "submitted"],
            default: "not_submitted"
        },

        submittedAt: {
            type: Date,
            default: null
        },

        markedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        remarks: {
            type: String,
            trim: true,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

projectSubmissionSchema.index(
    { project: 1, student: 1 },
    { unique: true }
);

export default mongoose.model(
    "ProjectSubmission",
    projectSubmissionSchema
);
