'use client';

const HowToPlay = () => {
  return (
    <div>
      <h2 className="text-xl font-bold text-center text-yellow-300 mb-4">遊び方</h2>
      <div className="space-y-4 text-white text-lg">
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-yellow-400">1. ポイを操作しよう</h3>
          <p className="mt-1">マウスや指でポイを動かせます。クリック（またはタップ）している間、ポイは水の中に沈みます。</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-yellow-400">2. 金魚をすくおう</h3>
          <p className="mt-1">ポイを金魚に重ねて、クリック（またはタップ）をやめると金魚をすくえます。うまくすくって高得点をねらおう！</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-yellow-400">3. いろいろな金魚</h3>
          <p className="mt-1">金魚には色々な種類がいます。大きい金魚や珍しい金魚ほど高得点ですが、すくうとポイが大きく破れやすくなるので注意が必要です。</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-yellow-400">4. ポイのHP（体力）</h3>
          <p className="mt-1">ポイにはHPがあります。ポイを水に入れている間や、金魚をすくうとHPが減っていきます。HPが0になるとゲームオーバーです。</p>
        </div>
        <div className="p-4 bg-yellow-900 bg-opacity-50 rounded-lg border border-yellow-400">
          <h3 className="font-bold text-yellow-300">【上手にすくうコツ】</h3>
          <p className="mt-2">・ポイの真ん中じゃなく、<span class="text-yellow-300 font-bold">端っこの方でそーっとすくう</span>と、ポイが破れにくくなるよ。</p>
          <p className="mt-2">・一度にたくさんすくうと、<span class="text-yellow-300 font-bold">一番大きい金魚一匹分のダメージ</span>ですむからお得！思い切ってチャレンジしてみよう！</p>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay;