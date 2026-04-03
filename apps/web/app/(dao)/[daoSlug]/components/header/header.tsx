import { HeaderClient } from './header-client';
import { GroupHeaderBar } from './group-header-bar';

interface HeaderProps {
  groupId: string;
  withBack: boolean;
  withHide: boolean;
  originalAuthorName: string;
  originalAuthorPicture: string;
  groupName: string;
}

export async function Header({
  groupId,
  withBack,
  withHide,
  originalAuthorName,
  originalAuthorPicture,
  groupName,
}: HeaderProps) {
  if (withHide)
    return (
      <HeaderClient
        originalAuthorName={originalAuthorName}
        originalAuthorPicture={originalAuthorPicture}
        groupName={groupName}
        groupId={groupId}
        withBack={withBack}
      />
    );
  else
    return (
      <GroupHeaderBar
        groupId={groupId}
        withBack={withBack}
        originalAuthorName={originalAuthorName}
        originalAuthorPicture={originalAuthorPicture}
        groupName={groupName}
      />
    );
}
