
import mongoose from "mongoose";

const classCalendarSchema = new mongoose.Schema(
    {
        trainer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // null means the event applies to all trainer batches
        batch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            default: null
        },

        // Store calendar dates as YYYY-MM-DD to avoid timezone errors
        date: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/
        },

        type: {
            type: String,
            enum: [
                "holiday",
                "meeting",
                "occasion",
                "class_cancelled",
                "other"
            ],
            required: true
        },

        reason: {
            type: String,
            required: true,
            trim: true
        }
    },
    { timestamps: true }
);

// Prevent duplicate events for the same scope and date
classCalendarSchema.index(
    {
        trainer: 1,
        date: 1,
        batch: 1
    },
    { unique: true }
);

export default mongoose.model(
    "ClassCalendar",
    classCalendarSchema
);
