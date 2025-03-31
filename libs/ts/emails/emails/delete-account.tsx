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

export interface DeleteAccountProps {
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
        <Body className="bg-neutral-100 font-sans dark:bg-neutral-900">
          <Container className="mx-auto max-w-[600px] p-2 lg:p-8">
            <Section className="my-8 bg-neutral-50 p-4 shadow-sm lg:p-8 dark:bg-neutral-800">
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
                    Confirm Account Deletion
                  </Heading>
                </Column>
              </Row>

              <Text className="bold mb-4 font-bold text-neutral-700 dark:text-neutral-300">
                Hi {email},
              </Text>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                We received a request to delete your account ({email}) from
                proposals.app.
              </Text>

              <Section className="mb-6 bg-red-50 p-4 dark:bg-red-900">
                <Text className="font-bold text-red-700 dark:text-red-300">
                  Warning: This action cannot be undone. Once your account is
                  deleted, there is no way to restore it.
                </Text>
              </Section>

              <Text className="mb-6 text-neutral-700 dark:text-neutral-300">
                If you still want to proceed, please click the button below to
                confirm.
              </Text>

              <Section className="mb-8 text-center">
                <Button
                  className="rounded-none bg-red-600 px-5 py-3 text-center text-[12px] font-semibold text-white no-underline hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                  href={verificationUrl}
                >
                  Confirm Account Deletion
                </Button>
              </Section>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                If you did not request this deletion, please ignore this email.
              </Text>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                This link will expire in 1 hour.
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
