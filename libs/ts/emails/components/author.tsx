import * as React from "react";
import { Row, Column, Text, Img } from "@react-email/components";

interface AuthorProps {
  type: "discussion" | "proposal";
  // Discussion author props
  discourseUsername?: string;
  discourseProfilePicture?: string;
  // Proposal author props
  address?: string;
  ens?: string;
}

export function Author({
  type,
  discourseUsername,
  discourseProfilePicture,
  address,
  ens,
}: AuthorProps) {
  return (
    <Row className="mb-4 flex items-center">
      <Column>
        {type === "discussion" && discourseProfilePicture && (
          <Img
            src={discourseProfilePicture}
            width="32"
            height="32"
            alt={discourseUsername}
            className="pr-2"
          />
        )}
      </Column>
      <Column>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          published by{" "}
          {type === "discussion" ? (
            <span className="font-medium">{discourseUsername}</span>
          ) : (
            <span className="font-medium">
              {ens || address?.slice(0, 6) + "..." + address?.slice(-4)}
            </span>
          )}
        </Text>
      </Column>
    </Row>
  );
}
