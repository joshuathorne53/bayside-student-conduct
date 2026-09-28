import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://bayside-student-conduct.peppy-kiwi-2273.chatgpt.site'),
  title: 'Bayside College | Student Conduct Register',
  description: 'A secure staff register for recording and actioning uniform and phone breaches.',
  openGraph: {
    title: 'Bayside College | Student Conduct Register',
    description: 'Uniform and phone breaches, handled clearly.',
    images: [{ url: '/og.png', width: 1792, height: 919, alt: 'Student Conduct Register' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bayside College | Student Conduct Register',
    description: 'Uniform and phone breaches, handled clearly.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
