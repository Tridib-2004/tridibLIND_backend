
import mongoose from "mongoose";
import Comment from "../model/comment.model.js";
import Like from "../model/like.model.js";
import Post from "../model/posts.model.js";
import { findUserByToken } from "../utils/userLookup.js";
export const activeCheck= async (req,res)=>{
    return res.status(200).json({message:"RUNNING"})
}


//for cretion  post
export const createPost=async(req,res)=>{
        const {token,body}=req.body || {};
    try{
        if(!token||(!body?.trim()&&!req.file)){
            return res.status(400).json({message:"A token and post text or photo are required"});
        }
        const user=await findUserByToken(token);
    if(!user){
            return res.status(401).json({message:"User does not exist"});
    } 
    const post=new Post({
        userId:user._id,
                body:body?.trim() || "",
        media:req.file != undefined? req.file.filename: "",
        fileType:req.file !=undefined? req.file.mimetype.split("/")[1]  : ""
    });
    await post.save();
     return res.status(200).json({message:"post createrd"});

    }
    catch(err){
        return res.status(500).json({message:err.message});
    }
};



//for getting ll post
export const getAllPosts=async(req,res)=>{

    try{
       const posts=await Post.find({active:{$ne:false}}).sort({createdAt:-1}).populate('userId','name username profilePicture').lean();
       const commentCounts=posts.length
           ? await Comment.aggregate([
               {$match:{postId:{$in:posts.map((post)=>post._id)}}},
               {$group:{_id:"$postId",count:{$sum:1}}}
           ])
           : [];
       const commentsByPost=new Map(commentCounts.map((item)=>[String(item._id),item.count]));
       for(const post of posts) post.commentsCount=commentsByPost.get(String(post._id))||0;
       const viewer=await findUserByToken(req.query.token);
       if(viewer&&posts.length){
           const postIds=posts.map((post)=>post._id);
           const viewerLikes=await Like.find({userId:viewer._id,postId:{$in:postIds}}).select("postId").lean();
           const likedPostIds=new Set(viewerLikes.map((like)=>String(like.postId)));
           for(const post of posts) post.viewerLiked=likedPostIds.has(String(post._id));
       }
        return res.json({posts});
    }
   catch(err){
        return res.status(500).json({message:err.message});
    } 
};

export const togglePostLike=async(req,res)=>{
    try{
        const {token}=req.body || {};
        const user=await findUserByToken(token);
        if(!user) return res.status(401).json({message:"Invalid or missing token"});
        if(!mongoose.isValidObjectId(req.params.postId)) return res.status(400).json({message:"Invalid post id"});

        const post=await Post.findOne({_id:req.params.postId,active:{$ne:false}});
        if(!post) return res.status(404).json({message:"Post not found"});
        const existingLike=await Like.findOne({userId:user._id,postId:post._id});
        if(existingLike){
            await Like.deleteOne({_id:existingLike._id});
            await Post.updateOne({_id:post._id},[{$set:{likes:{$max:[0,{$subtract:[{$ifNull:["$likes",0]},1]}]},updatedAt:new Date()}}]);
            return res.json({liked:false,likes:Math.max(0,(post.likes||0)-1)});
        }

        try{
            await Like.create({userId:user._id,postId:post._id});
        }catch(error){
            if(error.code===11000){
                const freshPost=await Post.findById(post._id).select("likes").lean();
                return res.json({liked:true,likes:freshPost?.likes||post.likes||0});
            }
            throw error;
        }
        await Post.updateOne({_id:post._id},{$inc:{likes:1},$set:{updatedAt:new Date()}});
        return res.json({liked:true,likes:(post.likes||0)+1});
    }catch(error){
        return res.status(500).json({message:"Unable to update post reaction"});
    }
};

export const getPostComments=async(req,res)=>{
    try{
        if(!mongoose.isValidObjectId(req.params.postId)) return res.status(400).json({message:"Invalid post id"});
        const postExists=await Post.exists({_id:req.params.postId,active:{$ne:false}});
        if(!postExists) return res.status(404).json({message:"Post not found"});
        const comments=await Comment.find({postId:req.params.postId})
            .sort({createdAt:1})
            .populate("userId","name username profilePicture");
        return res.json({comments});
    }catch(error){
        return res.status(500).json({message:"Unable to load comments"});
    }
};

export const createPostComment=async(req,res)=>{
    try{
        const {token,body}=req.body || {};
        const user=await findUserByToken(token);
        if(!user) return res.status(401).json({message:"Invalid or missing token"});
        if(!mongoose.isValidObjectId(req.params.postId)) return res.status(400).json({message:"Invalid post id"});
        if(typeof body!=="string"||!body.trim()) return res.status(400).json({message:"Comment text is required"});
        if(body.trim().length>2000) return res.status(400).json({message:"Comments must be 2000 characters or fewer"});
        const postExists=await Post.exists({_id:req.params.postId,active:{$ne:false}});
        if(!postExists) return res.status(404).json({message:"Post not found"});
        const comment=await Comment.create({userId:user._id,postId:req.params.postId,body:body.trim()});
        await comment.populate("userId","name username profilePicture");
        return res.status(201).json({comment});
    }catch(error){
        return res.status(500).json({message:"Unable to create comment"});
    }
};
