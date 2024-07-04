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
import test_data from "./../test_data/auth_code_test_data.json";
import Header from "../components/header";

export interface AuthCodeData {
  email: string;
  code: string;
}

export const AuthCodeEmail = (data: AuthCodeData) => (
  <Html>
    <Font fontFamily="Helvetica Neue" fallbackFontFamily={"Verdana"} />
    <Tailwind>
      <Head />
      <Body className="bg-[#F1EBE7]">
        <Container className="w-[360px] lg:w-[800px]">
          <Header />
          <Section>
            <Heading as="h3">
              Hi, {data.email ? data.email : test_data.email}!
            </Heading>
            <Text>
              We noticed someone just tried to log in to your{" "}
              <Link href="proposals.app" className="text-black underline">
                proposals.app
              </Link>{" "}
              account. If this was you, please use the following code to confirm
              it:
            </Text>

            <Section className="w-min" align="left">
              <Text className="rounded-xl bg-black px-4 py-2 text-center font-mono text-4xl font-bold text-white">
                {data.code ? data.code : test_data.code}
              </Text>
            </Section>

            <Section>
              <Text>This code is valid for 5 minutes.</Text>
              <Text>
                Thanks,
                <br />
                proposals.app Team
                <br />
                <Link
                  href="mailto:support@proposals.app"
                  className="text-black underline"
                >
                  support@proposals.app
                </Link>
              </Text>
            </Section>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default AuthCodeEmail;
