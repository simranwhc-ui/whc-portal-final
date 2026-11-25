import mongoose from "mongoose";
import Student from "../models/Student.js";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);

        const studentsCollectionExists = await conn.connection.db
            .listCollections({ name: Student.collection.name }, { nameOnly: true })
            .hasNext();

        if (studentsCollectionExists) {
            const indexes = await Student.collection.indexes();
            const uniquePhoneIndexes = indexes.filter(
                (index) => index.unique && index.key.phone !== undefined
            );

            for (const index of uniquePhoneIndexes) {
                await Student.collection.dropIndex(index.name);
                console.log(`Dropped legacy unique student phone index: ${index.name}`);
            }
        }

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;