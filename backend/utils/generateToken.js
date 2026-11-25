
import jwt from "jsonwebtoken";

const generateToken = (user, role = user.role) => {
    return jwt.sign(
        {
            id: user._id,
            role: role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
};

export default generateToken;
