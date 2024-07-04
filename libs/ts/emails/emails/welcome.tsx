import {
  Body,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Link,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";
import Footer from "../components/footer";
import Header from "../components/header";

export const WelcomeEmail = () => (
  <Html>
    <Font fontFamily="Roboto" fallbackFontFamily={"Verdana"} />
    <Tailwind>
      <Head />
      <Body className="bg-white m-0 p-0 text-zinc-800">
        <Container>
          <Header />
          <Section className="p-2">
            <Heading as="h3">Thank you for joining proposals.app!</Heading>

            <Text>
              To keep up with all proposals from the DAOs you are interested in,
              check out <Link href="proposals.app">proposals.app</Link>, where
              you can follow the most important DAOs, get notified when they
              launch new proposals and much more.
            </Text>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default WelcomeEmail;
