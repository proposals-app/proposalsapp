export interface ExtractedDiscourseTopicReference {
  id: number | null;
  slug: string | null;
}

export function extractDiscourseIdOrSlug(
  url: string
): ExtractedDiscourseTopicReference {
  const urlWithoutQuery = url.split('?')[0] ?? '';
  const cleanUrl = urlWithoutQuery.split('#')[0] ?? '';
  const parts = cleanUrl.split('/').filter(Boolean);
  const topicIndex = parts.findIndex((part) => part === 't');

  if (topicIndex === -1) {
    return { id: null, slug: null };
  }

  const firstPart = parts[topicIndex + 1];
  if (!firstPart) {
    return { id: null, slug: null };
  }

  const parsedTopicId = Number.parseInt(firstPart, 10);
  if (!Number.isNaN(parsedTopicId)) {
    return {
      id: parsedTopicId,
      slug: null,
    };
  }

  const parsedTrailingId = Number.parseInt(parts[topicIndex + 2] ?? '', 10);
  return {
    id: Number.isNaN(parsedTrailingId) ? null : parsedTrailingId,
    slug: firstPart,
  };
}
