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
  Button,
} from "@react-email/components";
import * as React from "react";
import { Footer } from "../components/footer";
import { Unsubscribe } from "../components/unsubscribe";

interface NewDiscussionEmailProps {
  discussionTitle: string;
  discussionUrl: string;
  daoName: string;
}

export default function NewDiscussionEmailTemplate({
  discussionTitle = "Example Discussion",
  discussionUrl = "https://proposals.app/discussion/123",
  daoName = "Example DAO",
}: NewDiscussionEmailProps) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>New discussion started in {daoName}</Preview>
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
                    New Discussion
                  </Heading>
                </Column>
              </Row>

              <Text className="mb-4 text-gray-700">Hello,</Text>

              <Text className="mb-4 text-gray-700">
                A new discussion has been started in {daoName}:
              </Text>

              <Text className="mb-6 text-xl font-semibold text-gray-800">
                {discussionTitle}
              </Text>

              <Section className="mb-8 text-center">
                <Button
                  className="rounded-none bg-blue-600 px-6 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"
                  href={discussionUrl}
                >
                  View Discussion
                </Button>
              </Section>

              <Text className="mb-4 text-gray-700">
                Thanks, <br />
                The proposals.app Team
              </Text>

              <Text className="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-700">
                This is an automated message, please do not reply to this email.
              </Text>
            </Section>

            <Unsubscribe />
            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
