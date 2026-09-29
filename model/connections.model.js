import mongoose,{Schema} from "mongoose";

const connectionSchema=mongoose.Schema({
    userId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User'
        },
    connectionId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User'
        },
    status_excepted:{
        type:Boolean,
        default:null
    },
    respondedAt:{
        type:Date,
        default:null
    }
})

connectionSchema.index({userId:1,status_excepted:1,respondedAt:1});
connectionSchema.index({connectionId:1,status_excepted:1,respondedAt:1});
const Connection=mongoose.model("Connetion",connectionSchema);
export default Connection;