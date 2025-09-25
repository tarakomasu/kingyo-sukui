"use client";

import { usePathname } from "next/navigation";
import RankingFab from "@/components/RankingFab";
import UserNameModal from "@/components/UserNameModal";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isGamePage = pathname.startsWith("/game/kingyo-new/game");

  return (
    <>
      <UserNameModal />
      {!isGamePage && <RankingFab />}
      {children}
    </>
  );
}
