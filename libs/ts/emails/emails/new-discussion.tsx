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
        <Body className="bg-neutral-100 dark:bg-neutral-900 font-sans">
          <Container className="mx-auto max-w-[600px] p-2 lg:p-8">
            <Section className="my-8 bg-white dark:bg-neutral-800 p-4 shadow-sm lg:p-8">
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
                    New Discussion
                  </Heading>
                </Column>
              </Row>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">Hello,</Text>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                A new discussion has been started in {daoName}:
              </Text>

              <Text className="mb-6 text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                {discussionTitle}
              </Text>

              <Section className="mb-8 text-center">
                <Button
                  className="bg-neutral-900 dark:bg-neutral-100 px-5 py-3 text-center text-[12px] font-semibold text-white dark:text-neutral-900 no-underline hover:bg-neutral-800 dark:hover:bg-neutral-200"
                  href={discussionUrl}
                >
                  View Discussion
                </Button>
              </Section>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                Thanks, <br />
                The proposals.app Team
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
