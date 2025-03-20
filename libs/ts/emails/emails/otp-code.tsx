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

interface OTPEmailProps {
  verificationCode?: string;
}

export default function OTPEmail({
  verificationCode = "123123",
}: OTPEmailProps) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>Your verification code for proposals.app</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto max-w-[600px] p-2 lg:p-8">
            <Section className="my-8 bg-white p-4 shadow-sm lg:p-8">
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
                  <Heading className="mb-4 text-center text-2xl font-bold text-gray-800">
                    Verification Code
                  </Heading>
                </Column>
              </Row>

              <Text className="mb-6 text-gray-700">Hello,</Text>

              <Text className="mb-6 text-gray-700">
                To verify your account on proposals.app, please use the
                following code. This code will expire in 5 minutes.
              </Text>

              <Section className="mb-6 border border-gray-200 bg-gray-50 p-4 text-center">
                <Text className="font-mono text-3xl font-bold tracking-widest text-gray-800">
                  {verificationCode}
                </Text>
              </Section>

              <Text className="mb-4 text-gray-700">
                If you did not request this code, please ignore this email or
                contact support if you have concerns.
              </Text>

              <Text className="mb-4 text-gray-700">
                Thanks, <br />
                The proposals.app Team
              </Text>

              <Text className="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-700">
                This is an automated message, please do not reply to this email.
              </Text>
            </Section>

            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
