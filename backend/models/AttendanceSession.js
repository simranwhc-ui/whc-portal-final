
import mongoose from "mongoose";

const attendanceSessionSchema = new mongoose.Schema(
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

        date: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/
        },

        students: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Student"
                }
            ],
            default: [],
            validate: {
                validator: function (students) {
                    const ids = students.map(id =>
                        id.toString()
                    );

                    return ids.length === new Set(ids).size;
                },
                message: "Duplicate students are not allowed in an attendance session"
            }
        },

        status: {
            type: String,
            enum: ["draft", "completed"],
            default: "draft"
        },

        completedAt: {
            type: Date,
            default: null
        },

        // Incremented whenever the session is modified.
        // Helps coordinate concurrent attendance operations.
        revision: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

attendanceSessionSchema.index(
    {
        trainer: 1,
        batch: 1,
        date: 1
    },
    {
        unique: true
    }
);

export default mongoose.model(
    "AttendanceSession",
    attendanceSessionSchema
);
