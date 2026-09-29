export const percentageChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

export const engagementPerPost = (likes, comments, posts) => (
  posts > 0 ? Number(((likes + comments) / posts).toFixed(2)) : 0
);