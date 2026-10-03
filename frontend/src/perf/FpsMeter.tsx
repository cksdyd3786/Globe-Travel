import { useEffect, useState } from 'react'

const SAMPLE_MS = 500
const HISTORY_MS = 10_000
const TARGET_FPS = 30 // NFR-01

interface FpsStats {
  current: number
  avg: number
  min: number
  worstFrameMs: number
  seconds: number
}

const EMPTY: FpsStats = { current: 0, avg: 0, min: 0, worstFrameMs: 0, seconds: 0 }

/**
 * requestAnimationFrame 횟수로 실제 화면 갱신 빈도를 잰다.
 * 지구본도 같은 rAF 루프에서 그리므로, 렌더링이 밀리면 이 값도 같이 떨어진다.
 */
function useFps(): FpsStats {
  const [stats, setStats] = useState<FpsStats>(EMPTY)

  useEffect(() => {
    let rafId = 0
    let frames = 0
    let windowStart = performance.now()
    let lastFrame = windowStart
    let worstFrameMs = 0
    const samples: number[] = []

    const tick = (now: number) => {
      frames++
      worstFrameMs = Math.max(worstFrameMs, now - lastFrame)
      lastFrame = now

      const elapsed = now - windowStart
      if (elapsed >= SAMPLE_MS) {
        // 탭이 가려져 rAF가 멈췄다 돌아온 구간은 성능과 무관하므로 버린다
        if (elapsed < SAMPLE_MS * 4) {
          samples.push((frames * 1000) / elapsed)
          if (samples.length > HISTORY_MS / SAMPLE_MS) samples.shift()
          setStats({
            current: samples[samples.length - 1],
            avg: samples.reduce((a, b) => a + b, 0) / samples.length,
            min: Math.min(...samples),
            worstFrameMs,
            seconds: (samples.length * SAMPLE_MS) / 1000,
          })
        }
        frames = 0
        windowStart = now
        worstFrameMs = 0
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return stats
}

/**
 * 이 컴포넌트만 0.5초마다 다시 그려지도록 FPS 상태를 따로 둔다(지구본은 다시 그리지 않음).
 * 설정이 바뀌면 key를 바꿔 새로 마운트해서 기록을 처음부터 잰다.
 */
export function FpsMeter() {
  const { current, avg, min, worstFrameMs, seconds } = useFps()
  // 판정은 10초를 다 채운 뒤에만 한다(로딩 직후 끊김으로 오판하지 않게)
  const measuring = seconds < HISTORY_MS / 1000
  const pass = min >= TARGET_FPS

  return (
    <div className="fps-meter" aria-live="off">
      <div className="fps-current">
        <strong className={current >= TARGET_FPS ? 'ok' : 'bad'}>{current.toFixed(0)}</strong>
        <span>fps</span>
      </div>
      <dl>
        <dt>평균 ({seconds.toFixed(0)}초)</dt>
        <dd>{avg.toFixed(1)}</dd>
        <dt>최저</dt>
        <dd>{min.toFixed(1)}</dd>
        <dt>가장 긴 프레임</dt>
        <dd>{worstFrameMs.toFixed(0)} ms</dd>
      </dl>
      <div className={`fps-verdict ${measuring ? '' : pass ? 'ok' : 'bad'}`}>
        {measuring ? `측정 중… ${seconds.toFixed(0)}/${HISTORY_MS / 1000}초` : pass ? `NFR-01 통과 (최저 ${TARGET_FPS}fps 이상)` : `NFR-01 미달 (최저 ${TARGET_FPS}fps 미만)`}
      </div>
    </div>
  )
}
