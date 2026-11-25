import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import feeRoutes from "./routes/feeRoutes.js";
import leaderboardRoutes from "./routes/leaderboardRoutes.js";
import counsellorRoutes from "./routes/counsellorRoutes.js";
import trainerRoutes from "./routes/trainerRoutes.js";
import classCalendarRoutes from "./routes/classCalendarRoutes.js";
import studentPortalRoutes from "./routes/studentPortalRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";



const app = express();

// CLIENT_URL may hold one or more comma-separated origins.
// When it is not set, any origin is allowed (fine for development).
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((origin) => origin.trim())
    : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());


app.get("/", (req, res) => {
    res.json({
        message: "WHC Portal API is running"
    });
});


app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/counsellor", counsellorRoutes);
app.use("/api/trainer", trainerRoutes);
app.use("/api/trainer/calendar", classCalendarRoutes);
app.use("/api/student", studentPortalRoutes);
app.use("/api/complaints", complaintRoutes);

// Unknown route
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Last-resort error handler (bad JSON body, unexpected throws, ...)
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON in request body"
        });
    }

    console.error(err);

    res.status(err.status || 500).json({
        success: false,
        message: "Server error"
    });
});

export default app;