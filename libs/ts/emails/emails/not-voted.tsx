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
import test_data from "../test_data/not_voted_test_data.json";
import { baseUrl } from "../src/const";

export interface NotVotedData {
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

export const NotVotedEmail = (data: NotVotedData) => (
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
              proposal is ending soon and you did not vote yet!
            </Text>

            <Text>
              Please go ahead and vote before the proposal’s end date.
            </Text>
          </Section>

          <Hr />

          <Section className="py-4">
            <Row className="p-4 bg-black">
              <Column>
                <Row className="py-4">
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
                  <Column className=" align-top">
                    <Link href={`${data.url ? data.url : test_data.url}`}>
                      <Text className="m-0 text-white font-bold text-lg">
                        {data.proposalName
                          ? data.proposalName
                          : test_data.proposalName}
                      </Text>
                    </Link>
                  </Column>
                </Row>
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

            <Row className="pt-8">
              <Column align="center">
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

export default NotVotedEmail;
