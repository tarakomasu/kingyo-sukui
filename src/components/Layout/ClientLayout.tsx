'use client';

import { usePathname } from "next/navigation";
import RankingFab from "@/components/RankingFab";
import UserNameModal from "@/components/UserNameModal";
import { useState, useEffect } from "react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isGamePage = pathname.startsWith("/game/");

  return (
    <>
      <UserNameModal />
      {isMounted && !isGamePage && <RankingFab />}
      {children}
    </>
  );
}
