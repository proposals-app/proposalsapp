import {
  Column,
  Heading,
  Img,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import { baseUrl } from "../../const";

export const Header = () => (
  <Section className="bg-black py-4 w-full">
    <Row>
      <Column width="64">
        <Img
          src={`${baseUrl}/assets/icons/web/logo.svg`}
          width={60}
          height={60}
        />
      </Column>
      <Column className="pl-2 leading-3 align-bottom">
        <Heading
          as="h2"
          className="text-white text-heavy text-xl align-bottom m-0"
        >
          Daily Bulletin
        </Heading>
        <Text className="text-zinc-400 align-bottom m-0">
          {new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(new Date())}
        </Text>
      </Column>
    </Row>
  </Section>
);

export default Header;
