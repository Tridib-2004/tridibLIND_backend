import assert from "node:assert/strict";
import test from "node:test";
import Comment from "../model/comment.model.js";
import Application from "../model/application.model.js";
import Connection from "../model/connections.model.js";
import Job from "../model/job.model.js";
import Like from "../model/like.model.js";
import Post from "../model/posts.model.js";
import ProfileView from "../model/profileView.model.js";
import { Profile } from "../model/profile.model.js";
import { findUserByToken } from "../utils/userLookup.js";
import { engagementPerPost, percentageChange } from "../utils/performanceMetrics.js";
import { jobFields } from "../controllers/job.controllers.js";

test("comment body uses a required string field", () => {
  const body = Comment.schema.path("body");
  assert.equal(body.instance, "String");
  assert.equal(body.isRequired, true);
});

test("posts may contain only media and likes default to zero", () => {
  assert.equal(Post.schema.path("body").defaultValue, "");
  assert.equal(Post.schema.path("likes").defaultValue, 0);
});

test("connection requests begin in a pending state", () => {
  assert.equal(Connection.schema.path("status_excepted").defaultValue, null);
});

test("profiles default to empty education and work history", () => {
  const profile = new Profile();
  assert.deepEqual(profile.education, []);
  assert.deepEqual(profile.pastWork, []);
});

test("missing credentials never become an unfiltered user query", () => {
  assert.equal(findUserByToken(undefined), null);
  assert.equal(findUserByToken(""), null);
  assert.deepEqual(findUserByToken("session-token").getFilter(), { token: "session-token" });
});

test("like records are unique per member and post and have timestamps", () => {
  assert.equal(Like.schema.path("createdAt").instance, "Date");
  assert.ok(Like.schema.indexes().some(([index]) => index.userId === 1 && index.postId === 1));
});

test("profile visits are deduplicated per viewer, member, and day", () => {
  assert.equal(ProfileView.schema.path("viewedAt").instance, "Date");
  assert.ok(ProfileView.schema.indexes().some(([index]) => index.viewerId === 1 && index.viewedUserId === 1 && index.dayKey === 1));
});

test("performance calculations safely handle zero baselines", () => {
  assert.equal(percentageChange(0, 0), 0);
  assert.equal(percentageChange(4, 0), null);
  assert.equal(percentageChange(6, 4), 50);
  assert.equal(engagementPerPost(0, 0, 0), 0);
  assert.equal(engagementPerPost(10, 5, 2), 7.5);
});

test("job applications have unique applicant/job pairs and valid statuses", () => {
  assert.ok(Application.schema.indexes().some(([index]) => index.jobId === 1 && index.applicantId === 1));
  assert.deepEqual(Application.schema.path("status").enumValues, ["Applied", "Reviewing", "Shortlisted", "Rejected", "Hired"]);
});

test("job validation rejects reversed salary ranges and accepts a valid listing", () => {
  const valid = {
    title: "Frontend developer",
    companyName: "Example Co",
    location: "Kolkata",
    workMode: "Hybrid",
    jobType: "Full-time",
    experienceLevel: "Fresher",
    salaryMin: 400000,
    salaryMax: 700000,
    skills: ["React", "Node.js"],
    description: "Build application features.",
  };
  assert.equal(jobFields(valid).title, "Frontend developer");
  assert.throws(() => jobFields({ ...valid, salaryMin: 800000 }), /Minimum salary cannot exceed maximum salary/);
  assert.equal(Job.schema.path("postedBy").isRequired, true);
});
