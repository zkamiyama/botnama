export const nowMs = () => Date.now();

export const formatRequestId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;

export const createRequestId = () => formatRequestId("req");
export const createCommentId = () => formatRequestId("cmt");
