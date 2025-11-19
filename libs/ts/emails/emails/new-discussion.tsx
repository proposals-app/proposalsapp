import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { Footer } from '../components/footer';
import { Unsubscribe } from '../components/unsubscribe';
import { Author } from '../components/author';

export interface NewDiscussionEmailProps {
  discussionTitle: string;
  discussionUrl: string;
  daoName: string;
  daoSlug: string;
  authorUsername: string;
  authorProfilePicture: string;
}

export default function NewDiscussionEmailTemplate({
  discussionTitle = 'This is a discussion title example',
  discussionUrl = 'https://proposals.app/discussion/123',
  daoName = 'Example DAO',
  daoSlug = 'example',
  authorUsername = 'example_user',
  authorProfilePicture = 'https://api.dicebear.com/9.x/pixel-art/png?seed=test',
}: NewDiscussionEmailProps) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>New discussion started in {daoName}</Preview>
        <Body className='bg-neutral-100 font-sans dark:bg-neutral-900'>
          <Container className='mx-auto max-w-[600px] p-2 lg:p-8'>
            <Section className='my-8 bg-white p-4 shadow-sm dark:bg-neutral-800 lg:p-8'>
              <Row className='flex items-start pb-2'>
                <Column>
                  <Img
                    src={`https://proposals.app/assets/logo_512.png`}
                    width='64'
                    height='64'
                    alt='proposals.app'
                  />
                </Column>
                <Column>
                  <Heading className='mb-4 text-center text-2xl font-bold text-neutral-800 dark:text-neutral-100'>
                    New Discussion
                  </Heading>
                </Column>
              </Row>

              <Text className='mb-4 text-neutral-700 dark:text-neutral-300'>
                Hello,
              </Text>

              <Text className='mb-4 text-neutral-700 dark:text-neutral-300'>
                A new discussion has been started in {daoName}:
              </Text>

              <Section className='py-4'>
                <Text className='mb-2 text-xl font-semibold text-neutral-800 dark:text-neutral-100'>
                  {discussionTitle}
                </Text>

                <Author
                  type='discussion'
                  discourseUsername={authorUsername}
                  discourseProfilePicture={authorProfilePicture}
                />
              </Section>

              <Section className='mb-8 text-center'>
                <Button
                  className='rounded-none bg-neutral-900 px-5 py-3 text-center text-[12px] font-semibold text-white no-underline hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200'
                  href={discussionUrl}
                >
                  View Discussion
                </Button>
              </Section>

              <Text className='mb-4 text-neutral-700 dark:text-neutral-300'>
                Thanks, <br />
                The proposals.app Team
              </Text>
            </Section>

            <Unsubscribe daoSlug={daoSlug} />
            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
