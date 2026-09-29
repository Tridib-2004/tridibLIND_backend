import { Router } from "express";
import { register,login,uploadprofilePicture,updateUserProfile,getUseraAndprofile,getMemberProfile,updateProfileData,getAllUserProfile,downlodeProfile,sendconnectionReqest,getMyConnectionRequest,whaatAreMyConnection,acceptConnectinRequset} from "../controllers/user.controllers.js";
import { getPerformance } from "../controllers/performance.controllers.js";
import { profilePictureUpload } from "../utils/upload.js";
const router=Router();

router.route("/update_profile_picture").post(profilePictureUpload.single('profile_picture'),uploadprofilePicture);
router.route("/register").post(register);
router.route("/login").post(login);
router.route("/user_update").post(updateUserProfile);
router.route("/get_user_and_profile").get(getUseraAndprofile);
router.route("/user/profile/:userId").get(getMemberProfile);
router.route("/user/performance").get(getPerformance);
router.route("/user/get_all_user").get(getAllUserProfile);
router.route("/update_profile_data").post(updateProfileData);
router.route("/user/download_resume").get(downlodeProfile);
router.route("/user/send_connection_request").post(sendconnectionReqest);
router.route("/user/getConnectionRequests").post(getMyConnectionRequest);
router.route("/user/userConnectionRequest").post(whaatAreMyConnection);
router.route("/user/acceptConnectionRequest").post(acceptConnectinRequset);


export default router;