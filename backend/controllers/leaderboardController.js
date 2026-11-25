import User from "../models/User.js";
import Lead from "../models/Lead.js";

export const getLeaderboard = async (req, res) => {
    try {
        // Get all active counsellors
        const counsellors = await User.find({
            role: "counsellor",
            status: "active"
        }).select("_id name username email");

        // Count converted leads for each counsellor
        const convertedCounts = await Lead.aggregate([
            {
                $match: {
                    assignedCounsellor: { $ne: null },
                    status: "converted"
                }
            },
            {
                $group: {
                    _id: "$assignedCounsellor",
                    convertedLeads: { $sum: 1 }
                }
            }
        ]);

        // Convert aggregation result into an easy lookup object
        const countMap = {};

        convertedCounts.forEach(item => {
            countMap[item._id.toString()] = item.convertedLeads;
        });

        // Add conversion count to every counsellor
        const leaderboard = counsellors.map(counsellor => ({
            counsellorId: counsellor._id,
            name: counsellor.name,
            username: counsellor.username,
            email: counsellor.email,
            convertedLeads:
                countMap[counsellor._id.toString()] || 0
        }));

        // Highest conversions first
        // If tied, sort alphabetically by name
        leaderboard.sort((a, b) => {
            if (b.convertedLeads !== a.convertedLeads) {
                return b.convertedLeads - a.convertedLeads;
            }

            return a.name.localeCompare(b.name);
        });

        // Add rank
        const rankedLeaderboard = leaderboard.map(
            (counsellor, index) => ({
                rank: index + 1,
                ...counsellor
            })
        );

        res.status(200).json({
            success: true,
            count: rankedLeaderboard.length,
            leaderboard: rankedLeaderboard
        });

    } catch (error) {
        console.error("Get leaderboard error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};