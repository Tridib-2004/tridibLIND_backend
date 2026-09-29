import mongoose from "mongoose";

const commentSchema=mongoose.Schema({
       userId:{
                type:mongoose.Schema.Types.ObjectId,
                ref:'User'
            },
        postId:{
                type:mongoose.Schema.Types.ObjectId,
                ref:'Post'
            },
        body:{
            type:String,
            required:true,
            trim:true,
            maxlength:2000
        },
        createdAt:{
            type:Date,
            default:Date.now
        }
})

commentSchema.index({postId:1,createdAt:1});
commentSchema.index({userId:1,createdAt:1});
const Comment=mongoose.model("Comment",commentSchema);
export default Comment;