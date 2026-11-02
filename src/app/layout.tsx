import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "@/styles/globals.scss";

const geistSans = Geist({
  subsets: ["latin"],
});

const TITLE = "Slatwise | Fence calculator";
const DESCRIPTION =
  "Aluminium slat and steel panel fencing: enter your runs to get a bill of materials, cut list and quote. Specs and prices are illustrative.";

export const metadata: Metadata = {
  metadataBase: new URL("https://slat-calc.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Slatwise",
    locale: "en_AU",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geistSans.className}>
      <body>{children}</body>
    </html>
  );
}
