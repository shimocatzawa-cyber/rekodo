"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PasswordRecoveryHandler() {
  const router = useRouter();

  useEffect(() => {
    // Implicit flow: Supabase lands the user on the homepage with the recovery
    // token in the hash. Redirect to the update-password page with the hash
    // intact so Supabase processes it there rather than here.
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery" && hashParams.get("access_token")) {
      router.push(`/auth/update-password${window.location.hash}`);
      return;
    }

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/auth/update-password");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
