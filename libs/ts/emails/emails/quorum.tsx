import {
  Body,
  Button,
  Column,
  Container,
  Font,
  Head,
  Heading,
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
import Header from "../components/welcome/header";
import test_data from "../test_data/quorum_test_data.json";
import { baseUrl } from "../const";

export interface QuorumData {
  daoName: string;
  daoLogoUrl: string;
  chainLogoUrl: string;
  url: string;
  proposalName: string;
  countdownUrl: string;
  countdownUrlSmall: string;
  scoresTotal: number;
  quorum: number;
}

export const QuorumEmail = (data: QuorumData) => (
  <Html>
    <Font fontFamily="Roboto" fallbackFontFamily={"Verdana"} />
    <Tailwind>
      <Head />
      <Body className="bg-white m-0 p-0 text-zinc-800">
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

            <hr className="opacity-50" />

            <Row className="py-4">
              <Column width={52} height={66}>
                <Img
                  src={`${baseUrl}${
                    data.daoLogoUrl ? data.daoLogoUrl : test_data.daoLogoUrl
                  }`}
                  width={48}
                  height={48}
                />
                <Img
                  src={`${baseUrl}${
                    data.chainLogoUrl
                      ? data.chainLogoUrl
                      : test_data.chainLogoUrl
                  }`}
                  width={48}
                  height={16}
                />
              </Column>
              <Column className=" align-top">
                <Link href={`${data.url ? data.url : test_data.url}`}>
                  <Text className="m-0 text-zinc-800 font-bold text-lg">
                    {data.proposalName
                      ? data.proposalName
                      : test_data.proposalName}
                  </Text>
                </Link>
              </Column>
            </Row>

            <Row className="p-4 bg-black">
              <Column>
                <Heading as="h3" className="text-zinc-200">
                  This proposal is ending in
                </Heading>
                <Text className="text-xs text-zinc-200">
                  Please vote as soon as you can!
                </Text>
              </Column>

              <Column className="font-bold text-end w-[100px] md:w-[200px]">
                <Img
                  src={`${
                    data.countdownUrl
                      ? data.countdownUrl
                      : test_data.countdownUrl
                  }`}
                  className="hidden md:block"
                />
                <Img
                  src={`${
                    data.countdownUrlSmall
                      ? data.countdownUrlSmall
                      : test_data.countdownUrlSmall
                  }`}
                  className="block md:hidden"
                />
              </Column>
            </Row>

            <Row className="py-2 justify-between">
              <Column>
                <Text className="text-xs m-0">Not Enough Quorum</Text>
                <div className="flex gap-1">
                  <Text className="text-xs m-0">
                    {data.scoresTotal
                      ? data.scoresTotal
                      : test_data.scoresTotal}
                  </Text>
                  <Text className="text-xs m-0"> / </Text>
                  <Text className="text-xs text-zinc-500 m-0">
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

            <hr className="opacity-50" />

            <Text>Thank you for your contribution!</Text>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default QuorumEmail;
