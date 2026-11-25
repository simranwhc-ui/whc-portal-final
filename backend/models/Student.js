import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        fatherName: {
            type: String,
            trim: true,
            default: ""
        },

        phone: {
            type: String,
            trim: true,
            default: ""
        },

        course: {
            type: String,
            required: true,
            trim: true
        },

        college: {
            type: String,
            trim: true,
            default: ""
        },

        plan: {
            type: String,
            enum: [
            "regular",
            "premium",
            "platinum",
            "platinum_pro",
            "industrial_training_6_weeks",
            "industrial_training_6_months"
            ],
            default: "regular"
        },

        status: {
            type: String,
            enum: [
                "active",
                "non-active",
                "completed",
                "drop"
            ],
            default: "active"
        },

        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        counsellor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        trainer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
        },

        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
            default: null
        },

        enrollmentDate: {
            type: Date,
            default: Date.now
        },

        batch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            default: null
        },
        
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Student", studentSchema);