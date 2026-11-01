import type { Metadata } from "next";
import { Geist } from "next/font/google";

const geistSans = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slatwise | Slat fence calculator",
  description:
    "Enter a target height and your fence runs to get a bill of materials, cut list and quote. Specs and prices are illustrative.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geistSans.className}>
      <body>{children}</body>
    </html>
  );
}
