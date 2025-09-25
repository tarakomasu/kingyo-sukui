export type FishType = {
  name: "normal" | "black" | "orange" | "rare" | "rare1";
  src: string;
  score: number;
  radius: number;
  baseDamage: number;
  spawnWeight: number;
};

export const FISH_TYPES: FishType[] = [
  {
    name: "normal",
    src: "/kingyo-sukui/kingyos/normal.png",
    score: 100,
    radius: 30,
    baseDamage: 30,
    spawnWeight: 60,
  },
  {
    name: "black",
    src: "/kingyo-sukui/kingyos/black.png",
    score: 300,
    radius: 60,
    baseDamage: 60,
    spawnWeight: 15,
  },
  {
    name: "orange",
    src: "/kingyo-sukui/kingyos/orange.png",
    score: 300,
    radius: 60,
    baseDamage: 60,
    spawnWeight: 15,
  },
  {
    name: "rare",
    src: "/kingyo-sukui/kingyos/rare.png",
    score: 1000,
    radius: 100,
    baseDamage: 150,
    spawnWeight: 10,
  },
];

const totalWeight = FISH_TYPES.reduce((sum, fish) => sum + fish.spawnWeight, 0);

export function getRandomFishType(): FishType {
  let random = Math.random() * totalWeight;
  for (const fishType of FISH_TYPES) {
    if (random < fishType.spawnWeight) {
      return fishType;
    }
    random -= fishType.spawnWeight;
  }
  // Fallback to the first fish type, should not happen
  return FISH_TYPES[0];
}
