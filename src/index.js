import dotenv from "dotenv"
import { app } from "./app.js";
import connectDB from "./db/index.js";


const PORT = process.env.PORT || 8001

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`)
    })
  })
  .catch((err) => {
    consople.log("Mongo connection error",err)
  })