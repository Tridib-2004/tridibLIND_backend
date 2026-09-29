import mongoose from "mongoose";

const UserSchema=mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    username:{
        type:String,
        required:true,
        unique:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    active:{
        type:Boolean,
        default:true
    },
    password:{
        type:String,
        required:true,
    },
    profilePicture:{
        type:String,
        default:'default.jpg'
    },
    phone:{
        type:String,
        default:'',
        trim:true,
        maxlength:30
    },
    skills:{
        type:[String],
        default:[]
    },
    savedJobs:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Job'
    }],
    createdAt:{
        type:Date,
        default:Date.now
    },
    token:{
        type:String,
        default:''
    }
})

const User=mongoose.model("User",UserSchema);
export default User;