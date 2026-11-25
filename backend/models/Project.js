import mongoose from "mongoose";

const projectEvaluationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true
        },

        status: {
            type: String,
            enum: ["evaluated", "not_given"],
            default: "not_given"
        },

        marks: {
            type: Number,
            min: 0,
            default: null
        }
    },
    {
        _id: false
    }
);

const projectSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        subject: {
            type: String,
            required: true,
            trim: true
        },

        trainer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        batch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            required: true
        },

        totalMarks: {
            type: Number,
            required: true,
            min: 1
        },

        dueDate: {
            type: Date,
            default: null
        },

        evaluations: {
            type: [projectEvaluationSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model(
    "Project",
    projectSchema
);