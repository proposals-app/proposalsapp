import { CombinedFeedItem, PostFeedItem } from "./Feed";

const isPostItem = (item: CombinedFeedItem): item is PostFeedItem => {
  return item.type === "post";
};

export const PostItem = ({ content }: { content: CombinedFeedItem }) => {
  if (!isPostItem(content)) {
    return null;
  }

  return (
    <div>
      <h3>{content.timestamp.toLocaleString()}</h3>
      <p>Posted by: {content.username || "Unknown"}</p>
      <div dangerouslySetInnerHTML={{ __html: content.cooked || "" }} />
    </div>
  );
};
