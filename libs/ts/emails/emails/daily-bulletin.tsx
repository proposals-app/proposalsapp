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
  countdownUrl: string;
  countdownUrlSmall: string;
  countdownString: string;
  voteIconUrl: string;
  voteStatus: string;
}

export interface NewProposal {
  daoLogoUrl: string;
  chainLogoUrl: string;
  url: string;
  proposalName: string;
  countdownUrl: string;
  countdownUrlSmall: string;
  countdownString: string;
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
  countdownString: string;
  voteIconUrl: string;
  voteStatus: string;
}

export const DailyBulletinEmail = (data: DailyBulletinData) => {
  return (
    <Html>
      <Font fontFamily="Roboto" fallbackFontFamily={"Verdana"} />
      <Tailwind>
        <Head />
        <Body className="bg-[#F1EBE7] m-0 p-0 text-black">
          <Container className="p-2" width={800}>
            <Header />

            <Section className="py-2">
              <Heading as="h3">
                Daily Bulletin for{" "}
                {new Intl.DateTimeFormat("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }).format(new Date())}
              </Heading>
            </Section>

            <Section className="py-8">
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

            <Section className="py-8">
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

            <Section className="py-8">
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
      <Text className="text-[#2C2927] bg-white py-4 align-middle text-center rounded-xl">
        There are no proposals ending soon.
      </Text>
    );
  }

  return (
    <Section>
      {props.data.map((proposal) => (
        <Row key={proposal.url} className="bg-white rounded-xl px-2">
          <Column width={48} height={48}>
            <Img
              className="rounded-xl"
              src={`${baseUrl}/${proposal.daoLogoUrl}_medium.png`}
              width={48}
              height={48}
            />
          </Column>

          <Column>
            <Link href={`${proposal.url}`}>
              <Text className="min-w-[50%] font-light md:font-normal text-start m-2 text-[#2C2927]">
                {proposal.proposalName}
              </Text>
            </Link>
          </Column>

          <Column className="font-bold text-end w-[100px] md:w-[200px]">
            <Img src={`${proposal.countdownUrl}`} className="hidden md:block" />
            <Img
              src={`${proposal.countdownUrlSmall}`}
              className="block md:hidden"
            />
            <Text className="hidden md:block text-center font-light text-xs text-[#2C2927] m-0">
              ends {proposal.countdownString}
            </Text>
          </Column>

          <Column className="font-bold text-center" width={82}>
            <Img src={`${baseUrl}/${proposal.voteIconUrl}`} width={82} />
          </Column>
          <Hr />
        </Row>
      ))}
    </Section>
  );
};

const New = (props: { data: NewProposal[] }) => {
  if (props.data.length == 0) {
    return (
      <Text className="text-[#2C2927] bg-white py-4 align-middle text-center rounded-xl">
        There are no new proposals.
      </Text>
    );
  }

  return (
    <Section>
      {props.data.map((proposal) => (
        <Row key={proposal.url} className="bg-white rounded-xl px-2">
          <Column width={48} height={48}>
            <Img
              className="rounded-xl"
              src={`${baseUrl}/${proposal.daoLogoUrl}_medium.png`}
              width={48}
              height={48}
            />
          </Column>

          <Column>
            <Link href={`${proposal.url}`}>
              <Text className="min-w-[50%] font-light md:font-normal text-start m-2 text-[#2C2927]">
                {proposal.proposalName}
              </Text>
            </Link>
          </Column>

          <Column className="font-bold text-center w-[100px] md:w-[200px]">
            <Img src={`${proposal.countdownUrl}`} className="hidden md:block" />
            <Img
              src={`${proposal.countdownUrlSmall}`}
              className="block md:hidden"
            />
            <Text className="hidden md:block text-center font-light text-xs text-[#2C2927] m-0">
              {proposal.countdownString}
            </Text>
          </Column>

          <Column className="font-bold text-center" width={82}>
            <Img src={`${baseUrl}/${proposal.voteIconUrl}`} width={82} />
            <Text className="hidden">{proposal.voteStatus}</Text>
          </Column>
          <Hr />
        </Row>
      ))}
    </Section>
  );
};

const Ended = (props: { data: EndedProposal[] }) => {
  if (props.data.length == 0) {
    return (
      <Text className="text-[#2C2927] bg-white py-4 align-middle text-center rounded-xl">
        There are no proposals which ended recently.
      </Text>
    );
  }

  return (
    <Section>
      {props.data.map((proposal) => (
        <Row key={proposal.url} className="bg-white rounded-xl px-2">
          <Column width={48} height={48}>
            <Img
              className="rounded-xl"
              src={`${baseUrl}/${proposal.daoLogoUrl}_medium.png`}
              width={48}
              height={48}
            />
          </Column>

          <Column>
            <Link href={`${proposal.url}`}>
              <Text className="min-w-[50%] font-light md:font-normal text-start m-2 text-[#2C2927]">
                {proposal.proposalName}
              </Text>
            </Link>
          </Column>

          {
            //Hidden result
          }
          <Column className="font-bold text-center w-[100px] md:w-[200px] py-1">
            {proposal.hiddenResult && (
              <>
                <Row className="pb-2 max-w-[180px] min-w-[80px]">
                  <div className="flex justify-start gap-2 items-start">
                    <Img
                      className="bg-[#EDEDED]"
                      width={24}
                      height={24}
                      src={`${baseUrl}/assets/email/hidden.png`}
                    />
                    <Text className="text-start font-bold m-0 text-ellipsis overflow-hidden max-w-[120px] min-w-[120px] w-[120px]">
                      Hidden Result
                    </Text>
                  </div>
                </Row>
                <Row className="pb-2 max-w-[180px] min-w-[80px] m-0">
                  <Column>
                    <div className="bg-gray-200 w-full h-[10px] relative">
                      <div className="bg-black w-full h-full">
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
                <Row className="pb-1 max-w-[180px] min-w-[80px]">
                  <div className="flex justify-start gap-2 items-start">
                    <Img
                      className="bg-[#EDEDED]"
                      width={24}
                      height={24}
                      src={`${baseUrl}/assets/email/cross.png`}
                    />
                    <Text className="text-start font-bold m-0 text-ellipsis overflow-hidden max-w-[120px] min-w-[120px] w-[120px]">
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
                  <Row className="pb-1 max-w-[180px] min-w-[80px]">
                    <div className="flex justify-start gap-2 items-start">
                      <Img
                        className="bg-[#EDEDED]"
                        width={24}
                        height={24}
                        src={`${baseUrl}/assets/email/check.png`}
                      />
                      <Text className="text-start font-bold m-0 text-ellipsis overflow-hidden max-w-[120px] min-w-[120px] w-[120px]">
                        {proposal.result?.choiceName}
                      </Text>
                    </div>
                  </Row>
                  <Row className="pb-1 max-w-[180px] min-w-[80px] m-0">
                    <Column>
                      <div className="bg-gray-200 w-full h-[10px] relative m-0">
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
                  <Row className="pb-1 max-w-[180px] min-w-[80px]">
                    <div className="flex justify-start gap-2 items-start">
                      <Img
                        className="bg-[#EDEDED]"
                        width={24}
                        height={24}
                        src={`${baseUrl}/assets/email/check.png`}
                      />
                      <Text className="text-start font-bold m-0 text-ellipsis overflow-hidden max-w-[120px] min-w-[120px] w-[120px]">
                        {proposal.makerResult?.choiceName}
                      </Text>
                    </div>
                  </Row>

                  <Row className="pb-1 max-w-[180px] min-w-[80px]">
                    <div className="flex justify-start gap-2">
                      <Text className="font-bold m-0">
                        with {proposal.makerResult?.mkrSupporting} MKR
                      </Text>
                    </div>
                  </Row>
                </>
              )}
            <Text className="hidden md:block text-center font-light text-xs text-[#2C2927] m-0">
              {proposal.countdownString}
            </Text>
          </Column>

          <Column className="font-bold text-center" width={82}>
            <Img src={`${baseUrl}/${proposal.voteIconUrl}`} width={82} />
            <Text className="hidden">{proposal.voteStatus}</Text>
          </Column>
          <Hr />
        </Row>
      ))}
    </Section>
  );
};

export default DailyBulletinEmail;
