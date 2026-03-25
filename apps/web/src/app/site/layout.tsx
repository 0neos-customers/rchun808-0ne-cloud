import type { Metadata } from "next";
import { Baskervville, Montserrat, JetBrains_Mono } from "next/font/google";
import "./marketing.css";

const baskervville = Baskervville({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const montserrat = Montserrat({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "One OS — Personal AI Infrastructure",
  description:
    "Your personal AI command center. An all-in-one system that turns Claude into your executive assistant, accessible from terminal, mobile, and Slack.",
  openGraph: {
    title: "One OS — Personal AI Infrastructure",
    description:
      "Your personal AI command center. Turn Claude into your executive assistant.",
    url: "https://0neos.com",
    siteName: "One OS",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${baskervville.variable} ${montserrat.variable} ${jetbrainsMono.variable} antialiased marketing-root`}>
      {children}
    </div>
  );
}
