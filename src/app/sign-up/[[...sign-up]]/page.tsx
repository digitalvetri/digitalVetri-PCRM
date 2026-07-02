import { SignUp } from "@clerk/nextjs";
import { Logo } from "@/components/shared/logo";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <Logo tileSize={44} subtitle="Sales Intelligence" />
      <SignUp
        appearance={{
          variables: { colorPrimary: "#3047CA", borderRadius: "0.6rem" },
          elements: { cardBox: "shadow-none", card: "shadow-none" },
        }}
      />
    </div>
  );
}
