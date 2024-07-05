import {
  Body,
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
import test_data from "./../test_data/bulletin_test_data.json";
import { baseUrl } from "../src/const";
import Header from "../components/header";
import moment from "moment";
moment.updateLocale("en", {
  relativeTime: {
    future: "%s left",
    past: "%s ago",
    s: "a few seconds",
    ss: "%d seconds",
    m: "a minute",
    mm: "%d minutes",
    h: "an hour",
    hh: "%d hours",
    d: "a day",
    dd: "%d days",
    M: "a month",
    MM: "%d months",
    y: "a year",
    yy: "%d years",
  },
});
export interface DailyBulletinData {
  endingSoonProposals: EndingSoonProposal[];
  newProposals: NewProposal[];
  endedProposals: EndedProposal[];
}

export interface EndingSoonProposal {
  daoLogoUrl: string;
  chainLogoUrl: string;
  url: string;
  proposalName: string;
  timeEnd: number;
  voteIconUrl: string;
  voteStatus: string;
}

export interface NewProposal {
  daoLogoUrl: string;
  chainLogoUrl: string;
  url: string;
  proposalName: string;
  timeEnd: number;
  voteIconUrl: string;
  voteStatus: string;
}

export interface EndedProposal {
  daoLogoUrl: string;
  chainLogoUrl: string;
  url: string;
  proposalName: string;
  quorumReached: boolean;
  hiddenResult: boolean;
  makerResult?: {
    choiceName: String;
    mkrSupporting: number;
  };
  result?: {
    choiceName: String;
    choicePercentage: number;
  };
  timeEnd: number;
  voteIconUrl: string;
  voteStatus: string;
}

export const DailyBulletinEmail = (data: DailyBulletinData) => {
  return (
    <Html>
      <Font fontFamily="Helvetica Neue" fallbackFontFamily={"Verdana"} />
      <Tailwind>
        <Head />
        <Body className="m-0 bg-[#F1EBE7]">
          <Container className="w-[360px] p-2 lg:w-[800px]">
            <Header />
            <Section className="lg:pt-8">
              <Heading as="h3">
                Daily Bulletin for{" "}
                {new Intl.DateTimeFormat("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }).format(new Date())}
              </Heading>
            </Section>

            <Section className="pt-4 lg:pt-8">
              <Heading as="h3">Proposals Ending Soon</Heading>

              <Text className="font-extralight">
                The voting on these proposals is going to end in the next 72
                hours. You might want to act on them soon.
              </Text>

              <EndingSoon
                data={
                  data.endingSoonProposals
                    ? data.endingSoonProposals
                    : test_data.endingSoonProposals
                }
              />
            </Section>

            <Section className="pt-8 lg:pt-16">
              <Heading as="h3">New Proposals</Heading>

              <Text className="font-extralight">
                These are the proposals that were created in the last 24 hours.
                You might want to check them out.
              </Text>

              <New
                data={
                  data.newProposals ? data.newProposals : test_data.newProposals
                }
              />
            </Section>

            <Section className="pt-8 lg:pt-16">
              <Heading as="h3">Past Proposals</Heading>

              <Text className="font-extralight">
                These are the proposals that were created in the last 24 hours.
                You might want to check them out.
              </Text>

              <Ended
                data={
                  data.endedProposals
                    ? data.endedProposals
                    : test_data.endedProposals
                }
              />
            </Section>
            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

const EndingSoon = (props: { data: EndingSoonProposal[] }) => {
  if (props.data.length == 0) {
    return (
      <Text className="rounded-xl bg-white py-4 text-center align-middle text-[#2C2927]">
        There are no proposals ending soon.
      </Text>
    );
  }

  return (
    <Section>
      {props.data.map((proposal) => (
        <div key={proposal.url}>
          <Row
            key={proposal.url}
            className="rounded-t-xl bg-white px-2 lg:rounded-xl"
          >
            <Column className="h-[48px] w-[48px]">
              <Img
                className="rounded-xl"
                src={`${baseUrl}/${proposal.daoLogoUrl}_medium.png`}
                width={48}
                height={48}
              />
            </Column>

            <Column>
              <Link href={`${proposal.url}`}>
                <Text className="m-2 min-w-[50%] text-start font-light text-[#2C2927]">
                  {proposal.proposalName}
                </Text>
              </Link>
            </Column>

            <Column className="hidden w-[160px] text-end font-bold lg:table-cell lg:p-2">
              <Text className="m-1 text-center text-xl font-semibold text-[#2C2927]">
                {moment.unix(proposal.timeEnd).utc().fromNow()}
              </Text>

              <Text className="m-1 text-center text-xs font-light text-[#2C2927]">
                {moment
                  .unix(proposal.timeEnd)
                  .utc()
                  .format("[ends on] MMM D [at] HH:mm [UTC]")}
              </Text>
            </Column>

            <Column className="table-cell h-[64px] w-[64px] lg:hidden">
              <Img
                src={`${baseUrl}/${proposal.voteIconUrl}`}
                width={64}
                className="m-0"
              />
            </Column>

            <Column className="hidden h-[82px] w-[82px] lg:table-cell">
              <Img
                src={`${baseUrl}/${proposal.voteIconUrl}`}
                width={82}
                className="m-0"
              />
            </Column>

            <Hr />
          </Row>
          <Row className="rounded-b-xl bg-white px-2 lg:hidden">
            <Column className="w-full font-bold" align="center">
              <Text className="m-1 text-center text-xl font-semibold text-[#2C2927]">
                {moment.unix(proposal.timeEnd).utc().fromNow()}
              </Text>

              <Text className="m-1 text-center text-xs font-light text-[#2C2927]">
                {moment
                  .unix(proposal.timeEnd)
                  .utc()
                  .format("[ends on] MMM D [at] HH:mm [UTC]")}
              </Text>
            </Column>
          </Row>
        </div>
      ))}
    </Section>
  );
};

const New = (props: { data: NewProposal[] }) => {
  if (props.data.length == 0) {
    return (
      <Text className="rounded-xl bg-white py-4 text-center align-middle text-[#2C2927]">
        There are no new proposals.
      </Text>
    );
  }

  return (
    <Section>
      {props.data.map((proposal) => (
        <div key={proposal.url}>
          <Row
            key={proposal.url}
            className="rounded-t-xl bg-white px-2 lg:rounded-xl"
          >
            <Column className="h-[48px] w-[48px]">
              <Img
                className="rounded-xl"
                src={`${baseUrl}/${proposal.daoLogoUrl}_medium.png`}
                width={48}
                height={48}
              />
            </Column>

            <Column>
              <Link href={`${proposal.url}`}>
                <Text className="m-2 min-w-[50%] text-start font-light text-[#2C2927]">
                  {proposal.proposalName}
                </Text>
              </Link>
            </Column>

            <Column className="hidden w-[160px] text-end font-bold lg:table-cell lg:p-2">
              <Text className="m-1 text-center text-xl font-semibold text-[#2C2927]">
                {moment.unix(proposal.timeEnd).utc().fromNow()}
              </Text>

              <Text className="m-1 text-center text-xs font-light text-[#2C2927]">
                {moment
                  .unix(proposal.timeEnd)
                  .utc()
                  .format("[ends on] MMM D [at] HH:mm [UTC]")}
              </Text>
            </Column>

            <Column className="table-cell h-[64px] w-[64px] lg:hidden">
              <Img
                src={`${baseUrl}/${proposal.voteIconUrl}`}
                width={64}
                className="m-0"
              />
            </Column>

            <Column className="hidden h-[82px] w-[82px] lg:table-cell">
              <Img
                src={`${baseUrl}/${proposal.voteIconUrl}`}
                width={82}
                className="m-0"
              />
            </Column>

            <Hr />
          </Row>
          <Row className="rounded-b-xl bg-white px-2 lg:hidden">
            <Column className="w-full font-bold" align="center">
              <Text className="m-1 text-center text-xl font-semibold text-[#2C2927]">
                {moment.unix(proposal.timeEnd).utc().fromNow()}
              </Text>

              <Text className="m-1 text-center text-xs font-light text-[#2C2927]">
                {moment
                  .unix(proposal.timeEnd)
                  .utc()
                  .format("[ends on] MMM D [at] HH:mm [UTC]")}
              </Text>
            </Column>
          </Row>
        </div>
      ))}
    </Section>
  );
};

const Ended = (props: { data: EndedProposal[] }) => {
  if (props.data.length == 0) {
    return (
      <Text className="rounded-xl bg-white py-4 text-center align-middle text-[#2C2927]">
        There are no proposals which ended recently.
      </Text>
    );
  }

  return (
    <Section>
      {props.data.map((proposal) => (
        <div key={proposal.url}>
          <Row
            key={proposal.url}
            className="rounded-t-xl bg-white px-2 lg:rounded-xl"
          >
            <Column className="h-[48px] w-[48px]">
              <Img
                className="rounded-xl"
                src={`${baseUrl}/${proposal.daoLogoUrl}_medium.png`}
                width={48}
                height={48}
              />
            </Column>

            <Column>
              <Link href={`${proposal.url}`}>
                <Text className="m-2 min-w-[50%] text-start font-light text-[#2C2927]">
                  {proposal.proposalName}
                </Text>
              </Link>
            </Column>

            {
              //Hidden result
            }
            <Column className="hidden w-[100px] py-1 text-center font-bold lg:table-cell lg:w-[200px]">
              {proposal.hiddenResult && (
                <>
                  <Row className="min-w-[80px] max-w-[180px] pb-2">
                    <div className="flex items-start justify-start gap-2">
                      <Img
                        className="bg-[#EDEDED]"
                        width={24}
                        height={24}
                        src={`${baseUrl}/assets/email/hidden.png`}
                      />
                      <Text className="m-0 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden text-ellipsis text-start font-bold">
                        Hidden Result
                      </Text>
                    </div>
                  </Row>
                  <Row className="m-0 min-w-[80px] max-w-[180px] pb-2">
                    <Column>
                      <div className="relative h-[10px] w-full bg-gray-200">
                        <div className="h-full w-full bg-black">
                          {/* <div className="text-white absolute text-xs font-thin pl-2">
                          ??
                        </div> */}
                        </div>
                      </div>
                    </Column>
                  </Row>
                </>
              )}
              {
                //No quorum
              }
              {!proposal.quorumReached && (
                <>
                  <Row className="min-w-[80px] max-w-[180px] pb-1">
                    <div className="flex items-start justify-start gap-2">
                      <Img
                        className="bg-[#EDEDED]"
                        width={24}
                        height={24}
                        src={`${baseUrl}/assets/email/cross.png`}
                      />
                      <Text className="m-0 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden text-ellipsis text-start font-bold">
                        No Quorum
                      </Text>
                    </div>
                  </Row>
                </>
              )}
              {
                //Normal proposal
              }
              {!proposal.hiddenResult &&
                proposal.quorumReached &&
                proposal.result?.choiceName &&
                proposal.result.choicePercentage && (
                  <>
                    <Row className="min-w-[80px] max-w-[180px] pb-1">
                      <div className="flex items-start justify-start gap-2">
                        <Img
                          className="bg-[#EDEDED]"
                          width={24}
                          height={24}
                          src={`${baseUrl}/assets/email/check.png`}
                        />
                        <Text className="m-0 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden text-ellipsis text-start font-bold">
                          {proposal.result?.choiceName}
                        </Text>
                      </div>
                    </Row>
                    <Row className="m-0 min-w-[80px] max-w-[180px] pb-1">
                      <Column>
                        <div className="relative m-0 h-[10px] w-full bg-gray-200">
                          <div
                            className={`bg-black w-[${proposal.result?.choicePercentage}%] h-full`}
                          >
                            {/* <div className="text-white absolute text-sm font-thin pl-2">
                            {proposal.result?.choicePercentage}%
                          </div> */}
                          </div>
                        </div>
                      </Column>
                    </Row>
                  </>
                )}
              {
                //Maker
              }
              {!proposal.hiddenResult &&
                proposal.quorumReached &&
                proposal.makerResult?.choiceName &&
                proposal.makerResult?.mkrSupporting && (
                  <>
                    <Row className="min-w-[80px] max-w-[180px] pb-1">
                      <div className="flex items-start justify-start gap-2">
                        <Img
                          className="bg-[#EDEDED]"
                          width={24}
                          height={24}
                          src={`${baseUrl}/assets/email/check.png`}
                        />
                        <Text className="m-0 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden text-ellipsis text-start font-bold">
                          {proposal.makerResult?.choiceName}
                        </Text>
                      </div>
                    </Row>

                    <Row className="min-w-[80px] max-w-[180px] pb-1">
                      <div className="flex justify-start gap-2">
                        <Text className="m-0 font-bold">
                          with {proposal.makerResult?.mkrSupporting} MKR
                        </Text>
                      </div>
                    </Row>
                  </>
                )}
              <Text className="m-0 text-center text-xs font-light text-[#2C2927]">
                {moment
                  .unix(proposal.timeEnd)
                  .utc()
                  .format("[ended on] MMM D [at] HH:mm [UTC]")}
              </Text>
            </Column>

            <Column className="table-cell h-[64px] w-[64px] lg:hidden">
              <Img
                src={`${baseUrl}/${proposal.voteIconUrl}`}
                width={64}
                className="m-0"
              />
            </Column>

            <Column className="hidden h-[82px] w-[82px] lg:table-cell">
              <Img
                src={`${baseUrl}/${proposal.voteIconUrl}`}
                width={82}
                className="m-0"
              />
            </Column>

            <Hr />
          </Row>

          <Row className="rounded-b-xl bg-white px-2 lg:hidden">
            <Column className="w-full font-bold" align="center">
              {proposal.hiddenResult && (
                <>
                  <Row className="m-0 w-full pb-1">
                    <div className="flex items-start justify-start gap-2">
                      <Img
                        className="bg-[#EDEDED]"
                        width={24}
                        height={24}
                        src={`${baseUrl}/assets/email/hidden.png`}
                      />
                      <Text className="m-0 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden text-ellipsis text-start font-bold">
                        Hidden Result
                      </Text>
                    </div>
                  </Row>
                  <Row className="m-0 w-full pb-1">
                    <Column>
                      <div className="relative h-[10px] w-full bg-gray-200">
                        <div className="h-full w-full bg-black">
                          {/* <div className="text-white absolute text-xs font-thin pl-2">
                        ??
                      </div> */}
                        </div>
                      </div>
                    </Column>
                  </Row>
                </>
              )}
              {
                //No quorum
              }
              {!proposal.quorumReached && (
                <>
                  <Row className="m-0 w-full pb-1">
                    <div className="flex items-start justify-start gap-2">
                      <Img
                        className="bg-[#EDEDED]"
                        width={24}
                        height={24}
                        src={`${baseUrl}/assets/email/cross.png`}
                      />
                      <Text className="m-0 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden text-ellipsis text-start font-bold">
                        No Quorum
                      </Text>
                    </div>
                  </Row>
                </>
              )}
              {
                //Normal proposal
              }
              {!proposal.hiddenResult &&
                proposal.quorumReached &&
                proposal.result?.choiceName &&
                proposal.result.choicePercentage && (
                  <>
                    <Row className="m-0 w-full pb-1">
                      <div className="flex items-start justify-start gap-2">
                        <Img
                          className="bg-[#EDEDED]"
                          width={24}
                          height={24}
                          src={`${baseUrl}/assets/email/check.png`}
                        />
                        <Text className="m-0 max-w-[240px] overflow-hidden text-ellipsis text-start font-bold">
                          {proposal.result?.choiceName}
                        </Text>
                      </div>
                    </Row>
                    <Row className="m-0 w-full pb-1">
                      <Column>
                        <div className="relative m-0 h-[10px] w-full bg-gray-200">
                          <div
                            className={`bg-black w-[${proposal.result?.choicePercentage}%] h-full`}
                          >
                            {/* <div className="text-white absolute text-sm font-thin pl-2">
                          {proposal.result?.choicePercentage}%
                        </div> */}
                          </div>
                        </div>
                      </Column>
                    </Row>
                  </>
                )}
              {
                //Maker
              }
              {!proposal.hiddenResult &&
                proposal.quorumReached &&
                proposal.makerResult?.choiceName &&
                proposal.makerResult?.mkrSupporting && (
                  <>
                    <Row className="min-w-[80px] max-w-[180px] pb-1">
                      <div className="flex items-start justify-start gap-2">
                        <Img
                          className="bg-[#EDEDED]"
                          width={24}
                          height={24}
                          src={`${baseUrl}/assets/email/check.png`}
                        />
                        <Text className="m-0 max-w-[240px] overflow-hidden text-ellipsis text-start font-bold">
                          {proposal.makerResult?.choiceName}
                        </Text>
                      </div>
                    </Row>

                    <Row className="m-0 w-full pb-1">
                      <div className="flex justify-start gap-2">
                        <Text className="m-0 font-bold">
                          with {proposal.makerResult?.mkrSupporting} MKR
                        </Text>
                      </div>
                    </Row>
                  </>
                )}
              <Text className="m-0 text-center text-xs font-light text-[#2C2927]">
                {moment
                  .unix(proposal.timeEnd)
                  .utc()
                  .format("[ended on] MMM D [at] HH:mm [UTC]")}
              </Text>
            </Column>
          </Row>
        </div>
      ))}
    </Section>
  );
};

export default DailyBulletinEmail;
