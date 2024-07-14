import {
  Body,
  Button,
  Column,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";
import Footer from "../components/footer";
import Header from "../components/header";
import { baseUrl } from "../src/const";
import test_data from "../test_data/quorum_test_data.json";

export interface QuorumData {
  daoName: string;
  daoLogoUrl: string;
  chainLogoUrl: string;
  url: string;
  proposalName: string;
  countdownUrl: string;
  countdownUrlSmall: string;
  scoresTotal: number;
  scoresQuorum: number;
  quorum: number;
}

export const QuorumEmail = (data: QuorumData) => (
  <Html>
    <Font fontFamily="Roboto" fallbackFontFamily={"Verdana"} />
    <Tailwind>
      <Head />
      <Body className="m-0 bg-white p-0 text-zinc-800">
        <Container>
          <Header />
          <Section className="p-2">
            <Heading as="h3">
              Hey {data.daoName ? data.daoName : test_data.daoName} voter!
            </Heading>

            <Text>
              This {data.daoName ? data.daoName : test_data.daoName} governance
              proposal is ending soon and has not reached quorum yet, so we need
              your vote!
            </Text>

            <Text>
              Please go ahead and vote before the proposal’s end date.
            </Text>
          </Section>

          <Hr />

          <Section className="py-4">
            <Row className="pb-4">
              <Column width={52} height={66}>
                <Img
                  src={`${baseUrl}/${
                    data.daoLogoUrl ? data.daoLogoUrl : test_data.daoLogoUrl
                  }_medium.png`}
                  width={48}
                  height={48}
                />
                <Img
                  src={`${baseUrl}/${
                    data.chainLogoUrl
                      ? data.chainLogoUrl
                      : test_data.chainLogoUrl
                  }`}
                  width={48}
                  height={16}
                />
              </Column>
              <Column className="align-top">
                <Link href={`${data.url ? data.url : test_data.url}`}>
                  <Text className="m-0 text-lg font-bold text-zinc-800">
                    {data.proposalName
                      ? data.proposalName
                      : test_data.proposalName}
                  </Text>
                </Link>
              </Column>
            </Row>

            <Row className="bg-black p-4">
              <Column>
                <Heading as="h3" className="text-zinc-200">
                  This proposal is ending in
                </Heading>
                <Text className="text-xs text-zinc-200">
                  Please vote as soon as you can!
                </Text>
              </Column>

              <Column className="md:w-[200px] w-[100px] text-end font-bold">
                <Img
                  src={`${
                    data.countdownUrl
                      ? data.countdownUrl
                      : test_data.countdownUrl
                  }`}
                  className="md:block hidden"
                />
                <Img
                  src={`${
                    data.countdownUrlSmall
                      ? data.countdownUrlSmall
                      : test_data.countdownUrlSmall
                  }`}
                  className="md:hidden block"
                />
              </Column>
            </Row>

            <Row className="justify-between py-2">
              <Column>
                <Text className="m-0 text-xs">Not Enough Quorum</Text>
                <div className="flex gap-1">
                  <Text className="m-0 text-xs">
                    {data.scoresQuorum
                      ? data.scoresQuorum
                      : test_data.scoresQuorum}
                  </Text>
                  <Text className="m-0 text-xs"> / </Text>
                  <Text className="m-0 text-xs text-zinc-500">
                    {data.quorum ? data.quorum : test_data.quorum}
                  </Text>
                </div>
              </Column>

              <Column align="right">
                <Button
                  href={data.url ? data.url : test_data.url}
                  className="bg-black px-6 py-4 text-zinc-200"
                >
                  Cast Vote
                </Button>
              </Column>
            </Row>
          </Section>

          <Hr />

          <Section>
            <Text>Thank you for your contribution!</Text>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default QuorumEmail;
