import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Preview,
  Section,
  Tailwind,
  Img,
  Head,
  Column,
  Row,
} from "@react-email/components";
import * as React from "react";
import { Footer } from "../components/footer";

export interface OTPEmailProps {
  verificationCode: string;
  email: string;
}

export default function OTPEmail({
  verificationCode = "123123",
  email = "user@example.com",
}: OTPEmailProps) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>Your verification code for proposals.app</Preview>
        <Body className="bg-neutral-100 font-sans dark:bg-neutral-900">
          <Container className="mx-auto max-w-[600px] p-2 lg:p-8">
            <Section className="my-8 bg-white p-4 shadow-sm lg:p-8 dark:bg-neutral-800">
              <Row className="flex items-start pb-2">
                <Column>
                  <Img
                    src={`https://proposals.app/assets/logo_512.png`}
                    width="64"
                    height="64"
                    alt="proposals.app"
                  />
                </Column>
                <Column>
                  <Heading className="mb-4 text-center text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                    Verification Code
                  </Heading>
                </Column>
              </Row>

              <Text className="mb-6 font-bold text-neutral-700 dark:text-neutral-200">
                Hi, {email}!
              </Text>

              <Text className="mb-6 text-neutral-700 dark:text-neutral-300">
                We noticed someone just tried to log in to your proposals.app
                account. If this was you, please use the following code to
                confirm it:
              </Text>

              <Section className="mb-6 border border-neutral-200 bg-neutral-50 p-4 text-center dark:border-neutral-700 dark:bg-neutral-700">
                <Text className="font-mono text-3xl font-bold tracking-widest text-neutral-800 dark:text-neutral-100">
                  {verificationCode}
                </Text>
              </Section>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                This code is valid for 5 minutes.
              </Text>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                Thanks, <br />
                The proposals.app Team
              </Text>
            </Section>

            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
