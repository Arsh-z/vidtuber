import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import "dotenv/config"

const connectDB = async () => {
    try {
        console.log(process.env.MONGODB_URI)
       const connectionInstance= await mongoose.connect(process.env.MONGODB_URI)
        
        console.log(`\n MongoDB connected ! DB host:${connectionInstance.connect.host}`);
           
    } catch (error) {
        console.log("mongoDB connection error", error)
        process.exit(1)

    }
}

export default connectDB;
