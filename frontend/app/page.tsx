"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { readToken } from "@/lib/auth";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    router.replace(readToken() ? "/dashboard" : "/login");
  }, [router]);
  return null;
}
