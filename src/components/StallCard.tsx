import Link from 'next/link';
import Image from 'next/image';

// カードのProps（型定義）
type StallCardProps = {
  name: string;
  description: string;
  href: string;
  imageSrc: string;
  isActive: boolean;
};

// 屋台カードのコンポーネント
export const StallCard = ({ name, description, href, imageSrc, isActive }: StallCardProps) => {
  const CardContent = () => (
    <>
      {/* 準備中バッジ (isActiveがfalseの場合のみ表示) */}
      {!isActive && (
        <div className="absolute top-4 right-4 bg-gray-700 text-white text-sm font-bold px-3 py-1 rounded-full shadow-md z-10">
          じゅんびちゅう
        </div>
      )}
      
      {/* 屋台の画像 */}
      <div className="relative h-48 w-full mb-4">
        <Image
          src={imageSrc}
          alt={`${name}のイラスト`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      <div className="flex flex-col flex-grow p-4 pt-0">
        <h3 className="text-3xl font-bold text-gray-800">{name}</h3>
        <p className="mt-2 text-base text-gray-600 flex-grow">{description}</p>
        
        {/* ボタン */}
        <div
          className={`mt-6 flex items-center justify-center h-14 w-full rounded-xl font-bold text-lg text-white transition-colors
            ${isActive
              ? 'bg-amber-500 group-hover:bg-amber-600'
              : 'bg-gray-400 cursor-not-allowed'
            }`}
        >
          {isActive ? 'ゲームをはじめる' : 'じゅんびちゅう'}
        </div>
      </div>
    </>
  );

  // isActiveがtrueの場合: Linkコンポーネントでラップし、インタラクティブにする
  if (isActive) {
    return (
      <Link
        href={href}
        aria-label={`${name}：ゲームをはじめる`}
        className="group relative flex flex-col bg-white rounded-2xl shadow-lg transition-transform duration-300 ease-in-out hover:scale-[1.03] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
      >
        <CardContent />
      </Link>
    );
  }

  // isActiveがfalseの場合: divでラップし、クリックできないようにする
  return (
    <div
      aria-disabled="true"
      className="relative flex flex-col bg-white rounded-2xl shadow-lg opacity-60"
    >
      <CardContent />
    </div>
  );
};
