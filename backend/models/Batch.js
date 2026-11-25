
import mongoose from "mongoose";

const VALID_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

const batchSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        trainer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
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
                    const ids = students.map(id => id.toString());
                    return new Set(ids).size === ids.length;
                },
                message: "A student cannot be added to the same batch twice"
            }
        },

        startTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):([0-5]\d)$/
        },

        endTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):([0-5]\d)$/
        },

        active: {
            type: Boolean,
            default: true
        },

        daysOfWeek: {
            type: [
                {
                    type: String,
                    enum: VALID_DAYS
                }
            ],
            default: [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday"
            ],
            validate: {
                validator: function (days) {
                    return (
                        Array.isArray(days) &&
                        days.length > 0 &&
                        new Set(days).size === days.length
                    );
                },
                message: "Days must be unique and contain at least one valid weekday"
            }
        }
    },
    {
        timestamps: true
    }
);

batchSchema.index({ trainer: 1, active: 1 });

export default mongoose.model("Batch", batchSchema);
