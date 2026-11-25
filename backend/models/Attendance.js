import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
    {
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

        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true
        },

        date: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: ["present", "absent"],
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate attendance for the same
// student + batch + date.
attendanceSchema.index(
    {
        trainer: 1,
        batch: 1,
        student: 1,
        date: 1
    },
    {
        unique: true
    }
);

export default mongoose.model(
    "Attendance",
    attendanceSchema
);