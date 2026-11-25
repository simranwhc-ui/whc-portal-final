import User from "../models/User.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/generateToken.js";
import Student from "../models/Student.js";

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const user = await User.findOne({
            username: username.toLowerCase()
        }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const token = generateToken(user);

        res.status(200).json({
            success: true,
            message: "Login successful",

            token,

            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


export const studentLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const student = await Student.findOne({
            username: username.trim().toLowerCase()
        }).select("+password");

        if (!student) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        if (student.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your student account is not active"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            student.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const token = generateToken(student, "student");

        return res.status(200).json({
            success: true,
            message: "Student login successful",
            token,
            student: {
                id: student._id,
                name: student.name,
                username: student.username,
                course: student.course,
                plan: student.plan,
                status: student.status
            }
        });

    } catch (error) {
        console.error("Student login error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};
