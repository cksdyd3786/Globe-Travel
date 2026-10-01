export interface FakePin {
  id: number
  lat: number
  lng: number
}

// 실제 여행 기록처럼 인기 여행지 주변에 핀이 몰리도록 한 중심점들
const HUBS: ReadonlyArray<readonly [number, number]> = [
  [37.5665, 126.978], // 서울
  [35.1796, 129.0756], // 부산
  [33.4996, 126.5312], // 제주
  [35.6762, 139.6503], // 도쿄
  [34.6937, 135.5023], // 오사카
  [25.033, 121.5654], // 타이베이
  [13.7563, 100.5018], // 방콕
  [21.0278, 105.8342], // 하노이
  [1.3521, 103.8198], // 싱가포르
  [-8.4095, 115.1889], // 발리
  [48.8566, 2.3522], // 파리
  [41.9028, 12.4964], // 로마
  [41.3874, 2.1686], // 바르셀로나
  [51.5072, -0.1276], // 런던
  [40.7128, -74.006], // 뉴욕
  [21.3069, -157.8583], // 호놀룰루
  [-33.8688, 151.2093], // 시드니
]

// 같은 개수면 매번 같은 배치가 나오도록 시드를 고정한 난수(mulberry32)
function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat))
const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180

/** 핀 70%는 여행지 주변(반경 수백 km)에, 30%는 지구 전체에 고르게 뿌린다. */
export function makeFakePins(count: number, seed = 20261001): FakePin[] {
  const rand = seededRandom(seed)
  const gaussian = () => {
    // Box-Muller 변환
    const u = Math.max(rand(), Number.EPSILON)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }

  const pins: FakePin[] = []
  for (let id = 0; id < count; id++) {
    if (rand() < 0.7) {
      const [lat, lng] = HUBS[Math.floor(rand() * HUBS.length)]
      pins.push({ id, lat: clampLat(lat + gaussian() * 2.5), lng: wrapLng(lng + gaussian() * 2.5) })
    } else {
      // 위도를 asin으로 뽑아야 극지방에 몰리지 않고 구면에 고르게 퍼진다
      const lat = (Math.asin(2 * rand() - 1) * 180) / Math.PI
      pins.push({ id, lat: clampLat(lat), lng: rand() * 360 - 180 })
    }
  }
  return pins
}
