import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            unique: true,
            sparse: true
        },

        phone: {
            type: String,
            trim: true,
            unique: true,
            sparse: true
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
            minlength: 6,
            select: false
        },

        role: {
            type: String,
            enum: ["admin", "counsellor", "trainer"],
            required: true
        },

        // Controls whether the user can login
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },

        // Only meaningful for employees
        employmentStatus: {
            type: String,
            enum: ["active", "on_leave"],
            default: "active"
        },

        subjects: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("User", userSchema);