'use client';

const HowToPlay = () => {
  return (
    <div>
      <h2 className="text-xl font-bold text-center text-yellow-300 mb-4">遊び方</h2>
      <div className="space-y-4 text-white text-lg">
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-yellow-400">1. ポイを動かす</h3>
          <p className="mt-1">マウスカーソルを動かして、水の中のポイ（すくう道具）を操作します。</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-yellow-400">2. 金魚をすくう</h3>
          <p className="mt-1">金魚にポイを重ねてクリックすると、金魚をすくうことができます。</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-yellow-400">3. ポイのライフ</h3>
          <p className="mt-1">ポイにはライフがあります。水の中で速く動かしすぎたり、金魚をすくうとライフが減っていきます。ライフがなくなるとポイが破れてしまいます。</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-yellow-400">4. ポイント</h3>
          <p className="mt-1">すくった金魚は、左上のお椀に入ります。金魚の種類によってもらえるポイントが違います。</p>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay;