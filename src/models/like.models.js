import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema({
    //either video comment or tweet
    
    video: {
        type: Schema.Types.ObjectId,
        ref: "Video",
        
    },
    comment: {
        type: Schema.Types.ObjectId,
        ref: "comment",
    },
    tweet: {
        type: Schema.Types.ObjectId,
        ref: "Tweet",

    },
    likedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
},
    { timestamps: true }
);

export const like = mongoose.model("like", likeSchema);