import { ArrowDown } from 'lucide-react';

// ヒーローセクションのコンポーネント
export const Hero = () => {
  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-4 overflow-hidden">
      {/* 背景の装飾SVG */}
      <div className="absolute inset-0 z-0 opacity-20">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="pattern-circles" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse">
              <circle id="pattern-circle" cx="20" cy="20" r="2" fill="#FBBF24"></circle>
            </pattern>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-circles)"></rect>
        </svg>
      </div>

      <div className="relative z-10">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-amber-300 drop-shadow-lg">
          わくわく！
          <br />
          おまつりひろば
        </h1>
        <p className="mt-6 max-w-md mx-auto text-lg md:text-xl text-gray-200">
          すきな屋台を えらんで あそぼう！
        </p>
        <a
          href="#stalls-section"
          className="mt-10 inline-flex items-center justify-center h-16 px-8 rounded-2xl font-bold text-xl bg-pink-500 hover:bg-pink-600 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-pink-400 transition-transform hover:scale-105"
        >
          屋台をみにいく
          <ArrowDown className="ml-2 h-6 w-6" />
        </a>
      </div>
    </section>
  );
};
