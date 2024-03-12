import { Column, Img, Link, Row, Section, Text } from "@react-email/components";
import * as React from "react";
import { baseUrl } from "../const";

export const Footer = () => (
  <Section className="bg-black text-center py-4">
    <Text className="text-zinc-200 text-xs text-light">
      You are receiving this email because you subscribed to proposals.app.
    </Text>
    <Text className="text-zinc-200 text-xs text-light">
      If you wish to stop receiving these emails, you can{" "}
      <Link href="https://proposals.app" className="text-zinc-200">
        unsubcribe here
      </Link>
      .
    </Text>
    <Row className="max-w-min gap-4">
      <Column>
        <Img
          src={`${baseUrl}/assets/email/twitter.png`}
          width="24"
          height="24"
        />
      </Column>
      <Column>
        <Img
          src={`${baseUrl}/assets/email/discord.png`}
          width="24"
          height="24"
        />
      </Column>
      <Column>
        <Img
          src={`${baseUrl}/assets/email/github.png`}
          width="24"
          height="24"
        />
      </Column>
    </Row>
  </Section>
);

export default Footer;
