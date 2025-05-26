import { Fira_Sans, Fira_Sans_Condensed, Fira_Mono } from 'next/font/google';

export const firaSans = Fira_Sans({
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fira-sans',
});

export const firaSansCondensed = Fira_Sans_Condensed({
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fira-sans-condensed',
});

export const firaMono = Fira_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fira-mono',
});