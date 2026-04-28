import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Focus Cat",
  description: "Pomodoro timing, ambient audio, tasks, notes, and streak tracking in one focused workspace",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
