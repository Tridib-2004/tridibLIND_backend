
import mongoose,{Schema} from "mongoose";

const PostsSchema=mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    body:{
       type:String,
         default:""
    },
    likes:{
        type: Number,
        default:0
    },
    createdAt:{
         type:Date,
         default:Date.now
    },
    updatedAt:{
         type:Date,
         default:Date.now
    },
    media:{
        type:String,
        default:''
    },
    active:{
        type:Boolean,
        default:true
    },
    fileType:{
         type:String,
        default:''
    },
})

PostsSchema.index({userId:1,createdAt:-1});
const Post=mongoose.model("Post",PostsSchema);
export default Post;