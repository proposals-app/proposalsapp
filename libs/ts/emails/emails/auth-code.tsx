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
import Header from "../components/welcome/header";
import test_data from "./../test_data/auth_code_test_data.json";

export interface AuthCodeData {
  email: string;
  code: string;
}

export const AuthCodeEmail = (data: AuthCodeData) => (
  <Html>
    <Font fontFamily="Roboto" fallbackFontFamily={"Verdana"} />
    <Tailwind>
      <Head />
      <Body className="bg-white m-0 p-0 text-zinc-800">
        <Container>
          <Header />
          <Section className="p-2">
            <Heading as="h3">
              Hi, {data.email ? data.email : test_data.email}!
            </Heading>
            <Text>
              We noticed someone just tried to log in to your{" "}
              <Link href="proposals.app">proposals.app</Link> account. If this
              was you, please use the following code to confirm it:
            </Text>

            <Section className="w-min">
              <Text className="bg-black text-white text-4xl font-mono p-4 text-center">
                {data.code ? data.code : test_data.code}
              </Text>
            </Section>

            <Text>This code is valid for 5 minutes.</Text>
            <Text>
              Thanks,
              <br />
              proposals.app Team
              <br />
              <Link href="mailto:support@proposals.app">
                support@proposals.app
              </Link>
            </Text>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default AuthCodeEmail;
