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
  Column,
  Row,
} from "@react-email/components";
import * as React from "react";
import { Footer } from "../components/footer";

interface DeleteAccountProps {
  email?: string;
  verificationUrl?: string;
}

export default function DeleteAccountTemplate({
  email = "user@example.com",
  verificationUrl = "https://proposals.app/confirm-account-deletion",
}: DeleteAccountProps) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>Confirm your account deletion on proposals.app</Preview>
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
                    Confirm Account Deletion
                  </Heading>
                </Column>
              </Row>

              <Text className="mb-4 text-gray-700">Hello,</Text>

              <Text className="mb-4 text-gray-700">
                We received a request to delete your account ({email}) from
                proposals.app.
              </Text>

              <Section className="mb-6 bg-red-50 p-4">
                <Text className="font-bold text-red-700">
                  Warning: This action cannot be undone. Once your account is
                  deleted, there is no way to restore it.
                </Text>
              </Section>

              <Text className="mb-6 text-gray-700">
                If you still want to proceed, please click the button below to
                confirm.
              </Text>

              <Section className="mb-8 text-center">
                <Button
                  className="rounded-none bg-red-600 px-6 py-3 text-center text-sm font-medium text-white hover:bg-red-700"
                  href={verificationUrl}
                >
                  Confirm Account Deletion
                </Button>
              </Section>

              <Text className="mb-4 text-gray-700">
                If you did not request this deletion, please ignore this email.
              </Text>

              <Text className="mb-4 text-gray-700">
                This link will expire in 24 hours for security reasons.
              </Text>

              <Text className="mb-4 text-gray-700">
                If you have any questions, please contact our support team.
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
