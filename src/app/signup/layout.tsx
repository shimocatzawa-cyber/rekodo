import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your rekōdo account and start cataloguing your vinyl collection.",
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
