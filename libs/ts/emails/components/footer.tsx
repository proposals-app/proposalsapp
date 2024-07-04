import { Hr, Link, Section, Text } from "@react-email/components";
import * as React from "react";

export const Footer = () => (
  <Section className="text-center py-4">
    <Hr className="border-[#C2AEA2]" />
    <Text className="text-[#C2AEA2] text-xs text-light">
      You are receiving this email because you subscribed to{" "}
      <Link href="https://proposals.app" className="text-[#C2AEA2]">
        proposals.app
      </Link>
    </Text>
    <Text className="text-[#C2AEA2] text-xs text-light">
      If you wish to stop receiving these emails, please{" "}
      <Link href="https://proposals.app" className="text-[#C2AEA2]">
        unsubcribe
      </Link>
      .
    </Text>
    {/* <Row className="max-w-min gap-4">
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
    </Row> */}
  </Section>
);

export default Footer;
