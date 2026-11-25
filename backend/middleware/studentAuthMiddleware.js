
import jwt from "jsonwebtoken";
import Student from "../models/Student.js";

export const protectStudent = async (req, res, next) => {
    try {
        let token;

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authorized. Token missing."
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Verify token belongs to a student
        if (decoded.role !== "student") {
            return res.status(403).json({
                success: false,
                message: "Student access only"
            });
        }

        const student = await Student.findById(decoded.id);

        if (!student) {
            return res.status(401).json({
                success: false,
                message: "Student account no longer exists"
            });
        }

        if (student.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Student account is not active"
            });
        }

        req.student = student;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};
