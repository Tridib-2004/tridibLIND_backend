
import { Router } from "express";
import { activeCheck ,createPost,getAllPosts,togglePostLike,getPostComments,createPostComment } from "../controllers/posts.controllers.js";
import { postMediaUpload } from "../utils/upload.js";
const router=Router();

router.route("/").get(activeCheck);
router.route("/post").post(postMediaUpload.single('media'),createPost);
router.route("/all_posts").get(getAllPosts);
router.route("/:postId/like").post(togglePostLike);
router.route("/:postId/comments").get(getPostComments).post(createPostComment);

export default router;