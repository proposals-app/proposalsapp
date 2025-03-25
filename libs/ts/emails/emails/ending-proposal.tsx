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

interface EndingProposalEmailProps {
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
                    Proposal Ending Soon
                  </Heading>
                </Column>
              </Row>

              <Text className="mb-4 text-gray-700">Hello,</Text>

              <Text className="mb-4 text-gray-700">
                A proposal in {daoName} is ending in 24 hours:
              </Text>

              <Text className="mb-2 text-xl font-semibold text-gray-800">
                {proposalName}
              </Text>

              <Text className="mb-6 text-gray-700">
                The proposal will end on {endTime}
              </Text>

              <Section className="mb-8 text-center">
                <Button
                  className="rounded-none bg-blue-600 px-6 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"
                  href={proposalUrl}
                >
                  View Proposal
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

            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
