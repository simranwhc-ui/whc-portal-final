import Lead from "../models/Lead.js";
import Student from "../models/Student.js";

export const getCounsellorDashboard = async (req, res) => {
    try {
        const counsellorId = req.user._id;

        const [
            totalLeads,
            pendingLeads,
            contactedLeads,
            followUpLeads,
            convertedLeads,
            lostLeads,
            totalStudents
        ] = await Promise.all([
            Lead.countDocuments({
                assignedCounsellor: counsellorId
            }),

            Lead.countDocuments({
                assignedCounsellor: counsellorId,
                status: "pending"
            }),

            Lead.countDocuments({
                assignedCounsellor: counsellorId,
                status: "contacted"
            }),

            Lead.countDocuments({
                assignedCounsellor: counsellorId,
                status: "follow_up"
            }),

            Lead.countDocuments({
                assignedCounsellor: counsellorId,
                status: "converted"
            }),

            Lead.countDocuments({
                assignedCounsellor: counsellorId,
                status: "lost"
            }),

            Student.countDocuments({
                counsellor: counsellorId
            })
        ]);

        res.status(200).json({
            success: true,
            dashboard: {
                totalLeads,
                pendingLeads,
                contactedLeads,
                followUpLeads,
                convertedLeads,
                lostLeads,
                totalStudents
            }
        });

    } catch (error) {
        console.error(
            "Get counsellor dashboard error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};