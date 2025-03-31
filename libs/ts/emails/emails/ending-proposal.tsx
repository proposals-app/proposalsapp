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

export interface EndingProposalEmailProps {
  proposalName: string;
  proposalUrl: string;
  daoName: string;
  endTime: string;
}

export default function EndingProposalEmailTemplate({
  proposalName = "Example Proposal",
  proposalUrl = "https://proposals.app/proposal/123",
  daoName = "Example DAO",
  endTime = "2024-03-20 15:00 UTC",
}: EndingProposalEmailProps) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>Proposal ending soon in {daoName}</Preview>
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
                    Proposal Ending Soon
                  </Heading>
                </Column>
              </Row>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                Hello,
              </Text>

              <Text className="mb-4 text-neutral-700 dark:text-neutral-300">
                A proposal in {daoName} is ending in 24 hours:
              </Text>

              <Text className="mb-2 text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                {proposalName}
              </Text>

              <Text className="mb-6 text-neutral-700 dark:text-neutral-300">
                The proposal will end on {endTime}
              </Text>

              <Section className="mb-8 text-center">
                <Button
                  className="bg-neutral-900 px-5 py-3 text-center text-[12px] font-semibold text-white no-underline hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                  href={proposalUrl}
                >
                  View Proposal
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
