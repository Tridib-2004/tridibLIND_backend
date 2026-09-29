
import  {Profile}  from "../model/profile.model.js";
import Connection from "../model/connections.model.js";
import User from "../model/user.model.js";
import ProfileView from "../model/profileView.model.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import PDFDocument from 'pdfkit';
import fs from "node:fs";
import path from "node:path";
import { uploadsDirectory } from "../utils/upload.js";
import { findUserByToken } from "../utils/userLookup.js";

//define the function of userdatatopdf
const converUserDataTOPDF= async (userData)=>{
   const doc=new PDFDocument();
   const outputPath=crypto.randomBytes(32).toString("hex") + ".pdf";
   fs.mkdirSync(uploadsDirectory,{recursive:true});
   const stream=fs.createWriteStream(path.join(uploadsDirectory,outputPath));

   await new Promise((resolve,reject)=>{
     stream.once("finish",resolve);
     stream.once("error",reject);
     doc.once("error",reject);
     doc.pipe(stream);
     const picturePath=userData.userId.profilePicture
       ? path.join(uploadsDirectory,path.basename(userData.userId.profilePicture))
       : "";
     if(picturePath&&fs.existsSync(picturePath)){
       doc.image(picturePath,{align:"center",width:100});
     }
     doc.fontSize(14).text(`Name: ${userData.userId.name}`);
     doc.fontSize(14).text(`Username: ${userData.userId.username}`);
     doc.fontSize(14).text(`Email: ${userData.userId.email}`);
     doc.fontSize(14).text(`Bio: ${userData.bio}`);
     doc.fontSize(14).text(`Current position: ${userData.currentPost}`);
     doc.fontSize(14).text("Past work:");
     userData.pastWork.forEach((work)=>{
       doc.fontSize(14).text(`Company name: ${work.company}`);
       doc.fontSize(14).text(`Position: ${work.position}`);
       doc.fontSize(14).text(`Year: ${work.year}`);
     });
     doc.end();
   });

    return outputPath;

}
//for resestration function
export const register = async (req, res) => {
  try {
    const { name, email, password, username } = req.body;
    if (!name || !email || !password || !username) {
      return res.status(400).json({
        message: "All parameters are required"
      });
    }

    const normalizedEmail=email.trim().toLowerCase();
    const normalizedUsername=username.trim();
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email:normalizedEmail,
      password: hashedPassword,
      username:normalizedUsername
    });

    await newUser.save();

    const newProfile = new Profile({
      userId: newUser._id
    });

    await newProfile.save();

    return res.status(201).json({
      success: true,
      message: "New user created successfully",
      userId: newUser._id
    });

  } catch (err) {
    return res.status(500).json({
      message: err.message
    });
  }
};

//for the login part

export const login= async(req,res)=>{
 try{
  const email=req.body?.email?.trim().toLowerCase();
  const password=req.body?.password;
  if(!email||!password){
    return res.status(400).json({
        message: "All parameters are required"
      });
  }

  const existingUser = await User.findOne({ email });
  if(!existingUser){
    return res.status(401).json({message:"Invalid email or password"});
  }
  const check=await bcrypt.compare(password,existingUser.password);
  if(!check){
    return res.status(401).json({message:"Invalid email or password"});
  }
  const token=crypto.randomBytes(32).toString("hex");
  await User.updateOne({_id: existingUser._id}, {token});
  return res.json({token});

 }
 catch(err){
  return res.status(500).json({
      message: err.message
    });
 }
};

//for update the profile picture
export const uploadprofilePicture= async(req,res)=>{
  try{
    const token=req.body?.token;
    if(!token||!req.file){
      return res.status(400).json({message:"A token and profile picture are required"});
    }
    const user=await findUserByToken(token);
    if(!user){
      return res.status(401).json({message:"Invalid or missing token"});
    } 
    user.profilePicture=req.file.filename;
    await user.save();
    return res.json({message:"profile picture updated"});

  }catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
}


//updte profile 
export const updateUserProfile=async(req,res)=>{
  try{
    const {token,name,username,email,phone,skills}=req.body || {};
    const user= await findUserByToken(token);
    
    if(!user){
      return res.status(401).json({message:"Invalid or missing token"});
    } 

    const newUserData={};
    if(name!==undefined) newUserData.name=name;
    if(username!==undefined) newUserData.username=username;
    if(email!==undefined) newUserData.email=email.trim().toLowerCase();
    if(phone!==undefined) newUserData.phone=String(phone).trim().slice(0,30);
    if(skills!==undefined){
      if(!Array.isArray(skills)||skills.length>50||skills.some((skill)=>typeof skill!=="string"||skill.length>60)){
        return res.status(400).json({message:"Skills must be a list of up to 50 short labels"});
      }
      newUserData.skills=[...new Set(skills.map((skill)=>skill.trim()).filter(Boolean))];
    }
    if(!Object.keys(newUserData).length){
      return res.status(400).json({message:"No account profile fields were provided"});
    }
    const uniqueFields=[];
    if(username!==undefined) uniqueFields.push({username});
    if(email!==undefined) uniqueFields.push({email:email.trim().toLowerCase()});
    const existingUser=uniqueFields.length
      ? await User.findOne({$or:uniqueFields})
      : null;
    
      if(existingUser&& String(existingUser._id)!==String(user._id)){
        return res.status(400).json({message:"user already exist"});
      }
    

    Object.assign(user,newUserData);
    await user.save();

    return res.json({message:"user updated"});
  }

  catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
};


//get user and profile
 export const getUseraAndprofile=async(req,res)=>{
  try{
     const {token}=req.query;
     const user=await findUserByToken(token);
    if(!user){
      return res.status(401).json({message:"Invalid or missing token"});
    } 
    const userProfile=await Profile.findOne({userId:user._id})
          .populate('userId','name email username profilePicture phone skills');

    return res.json(userProfile);

  }
  catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
 }

export const getMemberProfile=async(req,res)=>{
  try{
    const viewer=await findUserByToken(req.query.token);
    if(!viewer) return res.status(401).json({message:"Invalid or missing token"});
    if(!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({message:"Invalid profile id"});
    const viewedUser=await User.findById(req.params.userId).select("name username profilePicture createdAt");
    if(!viewedUser) return res.status(404).json({message:"Profile not found"});
    const profile=await Profile.findOne({userId:viewedUser._id}).populate("userId","name username profilePicture createdAt");
    if(!profile) return res.status(404).json({message:"Profile not found"});

    if(String(viewer._id)!==String(viewedUser._id)){
      const viewedAt=new Date();
      try{
        await ProfileView.updateOne(
          {viewerId:viewer._id,viewedUserId:viewedUser._id,dayKey:viewedAt.toISOString().slice(0,10)},
          {$setOnInsert:{viewedAt}},
          {upsert:true}
        );
      }catch(error){
        if(error.code!==11000) throw error;
      }
    }
    return res.json(profile);
  }catch(error){
    return res.status(500).json({message:"Unable to load profile"});
  }
};

 //update profile data
 export const updateProfileData=async(req,res)=>{
  try{

    const {token,...newProfileData}=req.body || {};
    const user=await findUserByToken(token);
    if(!user){
      return res.status(401).json({message:"Invalid or missing token"});
    } 

    const userProfile=await Profile.findOne({userId:user._id});
    if(!userProfile){
      return res.status(404).json({message:"Profile not found"});
    }
    const allowedFields=["bio","currentPost","pastWork","education"];
    const profileUpdates=Object.fromEntries(
      Object.entries(newProfileData).filter(([field])=>allowedFields.includes(field))
    );
    if(!Object.keys(profileUpdates).length){
      return res.status(400).json({message:"No profile fields were provided"});
    }
    Object.assign(userProfile,profileUpdates);
    await userProfile.save();
    return res.json({message:"profile updated"});

  }
  catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
 };


 //find all the user profile
 export const getAllUserProfile=async(req,res)=>{
  try{
      
    const allProfile=await Profile.find().populate('userId','name username profilePicture');
    return res.json(allProfile);
  }
  catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
 }

 //for downloding profile

 export const downlodeProfile=async(req,res)=>{
  try{
      const user_id=req.query.id;
      const userProfile=await Profile.findOne({userId: user_id}).populate('userId','name email username profilePicture');
      if(!userProfile){
        return res.status(404).json({message:"Profile not found"});
      }
      let a=await converUserDataTOPDF(userProfile);
      return res.json({message:a});
  }
  catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
 }

 //send connection request funtion

 export const sendconnectionReqest=async(req,res)=>{
  try{
    const {token,connetionId} =req.body || {};
    const user=await findUserByToken(token);
     if(!user){
     return res.status(401).json({message:"Invalid or missing token"});
     }
     const connectionUser=await User.findOne({_id: connetionId});
     if(!connectionUser){
      return res.status(404).json({message:"Connection user does not exist"});
         }
         if(String(user._id)===String(connectionUser._id)){
      return res.status(400).json({message:"You cannot connect with yourself"});
     }

     const existingRequest=await Connection.findOne(
      {
        $or:[
          {userId:user._id,connectionId:connectionUser._id},
          {userId:connectionUser._id,connectionId:user._id}
        ]
      }
    );
    if(existingRequest){
      return res.status(409).json({message:"A connection request already exists"});
    }

    const newRequest=new Connection({
      userId:user._id,
      connectionId:connectionUser._id
    });
   await newRequest.save();
   return res.json({message:"Request send"});

  }
  catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
 };


 //for getting my connection request

 export const getMyConnectionRequest=async(req,res)=>{
     const {token}=req.body || {};
     try{
       const user=await findUserByToken(token);
     if(!user){
      return res.status(401).json({message:"Invalid or missing token"});
     }
      const connections=await Connection.find({userId: user._id}).populate('connectionId','name email username profilePicture');

      return res.json(connections);
     }
     catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
 };

 //get whaat are my connection
 
 export const whaatAreMyConnection=async(req,res)=>{
     const {token}=req.body || {};
     try{
       const user=await findUserByToken(token);
     if(!user){
      return res.status(401).json({message:"Invalid or missing token"});
     }
      const connections=await Connection.find({connectionId: user._id}).populate('userId','name email username profilePicture');

      return res.json(connections);
     }
     catch(err){
    return res.status(500).json({
      message: err.message
    });
  }
 };

 //function for excecp connection
 export const acceptConnectinRequset=async(req,res)=>{
    const {token,requestId,action_type}=req.body || {};
  try{
      if(!["accept","decline"].includes(action_type)){
      return res.status(400).json({message:"Action must be accept or decline"});
      }
     
    const user=await findUserByToken(token);
     if(!user){
     return res.status(401).json({message:"Invalid or missing token"});
     }
     const connect=await Connection.findOne({_id:requestId});
     if(!connect){
      return res.status(404).json({message:"Connection request does not exist"});
     }
    if(String(connect.connectionId)!==String(user._id)){
     return res.status(403).json({message:"You cannot respond to this request"});
    }
    if(connect.status_excepted!==null){
     return res.status(409).json({message:"Request has already been answered"});
    }
     if(action_type === "accept"){
      connect.status_excepted=true;
     }else{
      connect.status_excepted=false;
     }
    connect.respondedAt=new Date();
   await connect.save();
   return res.json({message:"Request updataed"});
  }
catch(err){
    return res.status(500).json({
      message: err.message
    });
  }  

 };