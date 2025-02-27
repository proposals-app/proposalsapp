import {
  Body,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";
import Footer from "../components/footer";
import Header from "../components/header";

export const DeprecationNoticeEmail = () => (
  <Html>
    <Font fontFamily="Helvetica Neue" fallbackFontFamily={"Verdana"} />
    <Tailwind>
      <Head />
      <Body className="m-0 bg-[#F1EBE7]">
        <Container className="w-[360px] p-2 lg:w-[800px]">
          <Header />
          <Section>
            <Heading className="text-lg">No more Daily Bulletin emails</Heading>
            <Text>
              We've been working on a new version of proposals.app, exclusive to
              Arbitrum DAO.
            </Text>

            <Text>
              We are deprecating these daily bulletin emails and will launch a
              new version of proposals.app that will include much more
              comprehensive notifications, but only for Arbitrum DAO proposals.
              Thank you for using proposals.app for these past months.
            </Text>

            <Text>See you soon!</Text>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default DeprecationNoticeEmail;
