import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Preview,
  Section,
  Tailwind,
  Button,
  Img,
  Head,
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";
import { Footer } from "../components/footer";

interface ChangeEmailProps {
  currentEmail?: string;
  newEmail?: string;
  verificationUrl?: string;
}

export default function ChangeEmailTemplate({
  currentEmail = "user@example.com",
  newEmail = "newemail@example.com",
  verificationUrl = "https://proposals.app/verify-email-change",
}: ChangeEmailProps) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>Confirm your email address change on proposals.app</Preview>
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
                    Confirm Email Change
                  </Heading>
                </Column>
              </Row>

              <Text className="mb-4 text-gray-700">Hello,</Text>

              <Text className="mb-4 text-gray-700">
                We received a request to change your email address on
                proposals.app.
              </Text>

              <Text className="mb-4 text-gray-700">
                Your current email address is: <strong>{currentEmail}</strong>
              </Text>

              <Text className="mb-6 text-gray-700">
                You asked to change it to: <strong>{newEmail}</strong>
              </Text>

              <Text className="mb-6 text-gray-700">
                To confirm this change, please click the button below.
              </Text>

              <Section className="mb-8 text-center">
                <Button
                  className="rounded-none bg-blue-600 px-6 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"
                  href={verificationUrl}
                >
                  Confirm Email Change
                </Button>
              </Section>

              <Text className="mb-4 text-gray-700">
                If you did not request this change, please ignore this email.
              </Text>

              <Text className="mb-4 text-gray-700">
                This link will expire in 24 hours for security reasons.
              </Text>

              <Text className="mb-4 text-gray-700">
                If you have any questions, please contact our support team.
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
