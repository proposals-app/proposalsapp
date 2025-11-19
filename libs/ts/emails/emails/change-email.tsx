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

export interface ChangeEmailProps {
  currentEmail?: string;
  newEmail?: string;
  verificationUrl?: string;
}

export default function ChangeEmailTemplate({
  currentEmail = 'user@example.com',
  newEmail = 'newemail@example.com',
  verificationUrl = 'https://proposals.app/verify-email-change',
}: ChangeEmailProps) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>Confirm your email address change on proposals.app</Preview>
        <Body className='bg-neutral-100 font-sans dark:bg-neutral-900'>
          <Container className='mx-auto max-w-[600px] p-2 lg:p-8'>
            <Section className='my-8 bg-neutral-50 p-4 shadow-sm dark:bg-neutral-800 lg:p-8'>
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
                    Confirm Email Change
                  </Heading>
                </Column>
              </Row>

              <Text className='mb-4 font-bold text-neutral-700 dark:text-neutral-300'>
                Hi {currentEmail},
              </Text>

              <Text className='mb-4 text-neutral-700 dark:text-neutral-300'>
                We received a request to change your email address on
                proposals.app.
              </Text>

              <Text className='mb-4 text-neutral-700 dark:text-neutral-300'>
                Your current email address is:{' '}
                <strong className='text-neutral-800 dark:text-neutral-100'>
                  {currentEmail}
                </strong>
              </Text>

              <Text className='mb-6 text-neutral-700 dark:text-neutral-300'>
                You asked to change it to:{' '}
                <strong className='text-neutral-800 dark:text-neutral-100'>
                  {newEmail}
                </strong>
              </Text>

              <Text className='mb-6 text-neutral-700 dark:text-neutral-300'>
                To confirm this change, please click the button below.
              </Text>

              <Section className='mb-8 text-center'>
                <Button
                  className='rounded-none bg-neutral-900 px-5 py-3 text-center text-[12px] font-semibold text-white no-underline hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200'
                  href={verificationUrl}
                >
                  Confirm Email Change
                </Button>
              </Section>

              <Text className='mb-4 text-neutral-700 dark:text-neutral-300'>
                If you did not request this change, please ignore this email.
              </Text>

              <Text className='mb-4 text-neutral-700 dark:text-neutral-300'>
                This link will expire in 1 hour.
              </Text>

              <Text className='mb-4 text-neutral-700 dark:text-neutral-300'>
                Thanks, <br />
                The proposals.app Team
              </Text>
            </Section>

            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
