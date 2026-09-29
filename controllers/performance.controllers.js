import Comment from "../model/comment.model.js";
import Connection from "../model/connections.model.js";
import Like from "../model/like.model.js";
import Post from "../model/posts.model.js";
import ProfileView from "../model/profileView.model.js";
import { findUserByToken } from "../utils/userLookup.js";
import { engagementPerPost, percentageChange } from "../utils/performanceMetrics.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

const startOfUtcDay = (date) => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate()
));

const dateKey = (date) => date.toISOString().slice(0, 10);
const monthKey = (date) => date.toISOString().slice(0, 7);

const addToBucket = (buckets, records, keyForDate, field) => {
  for (const record of records) {
    const key = keyForDate(new Date(record.createdAt || record.viewedAt || record.respondedAt));
    const bucket = buckets.get(key);
    if (bucket) bucket[field] += 1;
  }
};

export const getPerformance = async (req, res) => {
  try {
    const user = await findUserByToken(req.query.token);
    if (!user) {
      return res.status(401).json({ message: "Invalid or missing token" });
    }

    const requestedPeriod = req.query.period;
    const period = requestedPeriod === "all" || PERIOD_DAYS[requestedPeriod]
      ? requestedPeriod
      : "30d";
    const now = new Date();
    const currentStart = period === "all"
      ? null
      : startOfUtcDay(new Date(now.getTime() - (PERIOD_DAYS[period] - 1) * DAY_MS));
    const previousStart = currentStart
      ? new Date(currentStart.getTime() - PERIOD_DAYS[period] * DAY_MS)
      : null;

    const allPosts = await Post.find({ userId: user._id, active: { $ne: false } })
      .select("_id body likes createdAt")
      .lean();
    const postIds = allPosts.map((post) => post._id);
    const [allComments, allGivenComments, allReceivedLikes, allGivenLikes, allViews, connections] = await Promise.all([
      postIds.length ? Comment.find({ postId: { $in: postIds } }).select("_id userId postId createdAt").lean() : [],
      Comment.find({ userId: user._id }).select("_id postId createdAt").lean(),
      postIds.length ? Like.find({ postId: { $in: postIds } }).select("_id postId createdAt").lean() : [],
      Like.find({ userId: user._id }).select("_id postId createdAt").lean(),
      ProfileView.find({ viewedUserId: user._id }).select("_id viewedAt").lean(),
      Connection.find({
        $or: [{ userId: user._id }, { connectionId: user._id }],
        status_excepted: true,
      }).select("userId connectionId respondedAt").lean(),
    ]);

        const inRange = (date, start, end = now, endExclusive = false) => {
          const time = new Date(date).getTime();
          return (endExclusive ? time < end.getTime() : time <= end.getTime())
            && (!start || time >= start.getTime());
        };
    const currentPosts = allPosts.filter((post) => inRange(post.createdAt, currentStart));
    const previousPosts = previousStart
      ? allPosts.filter((post) => inRange(post.createdAt, previousStart, currentStart, true))
      : [];
    const currentLikes = allReceivedLikes.filter((like) => inRange(like.createdAt, currentStart));
    const previousLikes = previousStart
      ? allReceivedLikes.filter((like) => inRange(like.createdAt, previousStart, currentStart, true))
      : [];
    const currentComments = allComments.filter((comment) => inRange(comment.createdAt, currentStart));
    const previousComments = previousStart
      ? allComments.filter((comment) => inRange(comment.createdAt, previousStart, currentStart, true))
      : [];
    const currentGivenLikes = allGivenLikes.filter((like) => inRange(like.createdAt, currentStart));
    const currentViews = allViews.filter((view) => inRange(view.viewedAt, currentStart));
    const currentConnections = connections.filter((connection) => connection.respondedAt && inRange(connection.respondedAt, currentStart));

    const isAllTime = period === "all";
    const periodPosts = isAllTime ? allPosts : currentPosts;
    const periodLikes = isAllTime
      ? allPosts.reduce((total, post) => total + (post.likes || 0), 0)
      : currentLikes.length;
    const periodComments = isAllTime ? allComments.length : currentComments.length;
    const acceptedConnectionIds = new Set(connections.map((connection) => (
      String(connection.userId) === String(user._id)
        ? String(connection.connectionId)
        : String(connection.userId)
    )));
    const uniqueConnections = new Set([...acceptedConnectionIds].filter((id) => id !== String(user._id)));
    const summary = {
      posts: periodPosts.length,
      totalPosts: allPosts.length,
      likesReceived: periodLikes,
      commentsReceived: periodComments,
      connections: uniqueConnections.size,
      profileViews: isAllTime ? allViews.length : currentViews.length,
      engagementRate: engagementPerPost(periodLikes, periodComments, periodPosts.length),
    };

    const postStats = new Map();
    for (const post of allPosts) {
      postStats.set(String(post._id), {
        post,
        likes: post.likes || 0,
        comments: 0,
      });
    }
    for (const comment of allComments) {
      const stats = postStats.get(String(comment.postId));
      if (stats) stats.comments += 1;
    }
    const topPosts = [...postStats.values()]
      .map(({ post, likes, comments }) => ({
        id: post._id,
        content: post.body,
        createdAt: post.createdAt,
        likes,
        comments,
        engagement: likes + comments,
      }))
      .sort((left, right) => right.engagement - left.engagement || new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 5);

    const eventDates = [
      ...allPosts.map((post) => new Date(post.createdAt)),
      ...allReceivedLikes.map((like) => new Date(like.createdAt)),
      ...allComments.map((comment) => new Date(comment.createdAt)),
    ].filter((date) => !Number.isNaN(date.getTime()));
    const chartStart = isAllTime
      ? (eventDates.length ? new Date(Math.min(...eventDates.map((date) => date.getTime()))) : startOfUtcDay(now))
      : currentStart;
    const keyForDate = isAllTime ? monthKey : dateKey;
    const buckets = new Map();
    if (isAllTime) {
      const cursor = new Date(Date.UTC(chartStart.getUTCFullYear(), chartStart.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      while (cursor <= monthEnd) {
        const key = monthKey(cursor);
        buckets.set(key, { date: key, posts: 0, likes: 0, comments: 0 });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    } else {
      for (let index = 0; index < PERIOD_DAYS[period]; index += 1) {
        const date = new Date(currentStart.getTime() + index * DAY_MS);
        const key = dateKey(date);
        buckets.set(key, { date: key, posts: 0, likes: 0, comments: 0 });
      }
    }
    addToBucket(buckets, periodPosts, keyForDate, "posts");
    addToBucket(buckets, isAllTime ? allReceivedLikes : currentLikes, keyForDate, "likes");
    addToBucket(buckets, isAllTime ? allComments : currentComments, keyForDate, "comments");
    const activity = [...buckets.values()];

    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyCounts = Array.from({ length: 7 }, () => 0);
    for (const post of periodPosts) {
      weeklyCounts[new Date(post.createdAt).getUTCDay()] += 1;
    }
    const weeklyActivity = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
      day: weekdayNames[day],
      posts: weeklyCounts[day],
    }));

    const comparison = {
      previous: previousStart ? {
        posts: previousPosts.length,
        likes: previousLikes.length,
        comments: previousComments.length,
      } : null,
      postsChange: previousStart ? percentageChange(currentPosts.length, previousPosts.length) : null,
      likesChange: previousStart ? percentageChange(currentLikes.length, previousLikes.length) : null,
      commentsChange: previousStart ? percentageChange(currentComments.length, previousComments.length) : null,
    };
    const activitySummary = {
      postsCreated: currentPosts.length,
      likesGiven: currentGivenLikes.length,
      commentsMade: allGivenComments.filter((comment) => inRange(comment.createdAt, currentStart)).length,
      connectionsAdded: currentConnections.length,
      profileViewsReceived: isAllTime ? allViews.length : currentViews.length,
    };
    const activeDays = new Set(currentPosts.map((post) => dateKey(new Date(post.createdAt)))).size;

    return res.json({
      period,
      generatedAt: now.toISOString(),
      summary,
      comparison,
      activitySummary,
      activity,
      topPosts,
      weeklyActivity,
      consistency: { activeDays },
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to calculate performance data" });
  }
};