import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

// 子ども向けに読みやすく、丸みのあるフォントを設定
const roundedMplus = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

// SEOやOGPのためのメタデータ
export const metadata: Metadata = {
  title: "わくわく！おまつり広場",
  description: "すきな屋台をえらんで、ゲームであそぼう！しゃてきやきんぎょすくいなど、たのしい屋台がいっぱい！",
  openGraph: {
    title: "わくわく！おまつり広場",
    description: "すきな屋台をえらんで、ゲームであそぼう！",
    images: [
      {
        url: "/ogp-placeholder.png", // OGP画像のプレースホルダ
        width: 1200,
        height: 630,
        alt: "おまつり広場のイメージ",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "わくわく！おまつり広場",
    description: "すきな屋台をえらんで、ゲームであそぼう！",
    images: ["/ogp-placeholder.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${roundedMplus.className} bg-[#2C2A4A] text-white`}>
        {children}
      </body>
    </html>
  );
}
