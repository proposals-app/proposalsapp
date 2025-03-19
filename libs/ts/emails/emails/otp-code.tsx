import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Preview,
  Section,
  Tailwind,
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
        <Preview>Your verification code for proposals.app</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto max-w-[600px] p-4">
            <Section className="my-8 rounded-lg bg-white p-8 shadow-sm">
              <Heading className="mb-4 text-2xl font-bold text-gray-800">
                Verification Code
              </Heading>

              <Text className="mb-6 text-gray-600">
                Please use the following code to verify your account. This code
                will expire in 5 minutes.
              </Text>

              <Section className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4 text-center">
                <Text className="font-mono text-3xl font-bold tracking-widest text-gray-800">
                  {verificationCode}
                </Text>
              </Section>

              <Text className="mb-4 text-gray-600">
                If you did not request this code, please ignore this email or
                contact support if you have concerns.
              </Text>

              <Text className="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-600">
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
