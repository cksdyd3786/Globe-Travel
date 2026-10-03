import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { FpsMeter } from './FpsMeter'
import { makeFakePins, type FakePin } from './fakePins'
import './GlobePerfPage.css'

/**
 * NFR-01 성능 검증 페이지: 휴대폰 브라우저에서 핀 1,000개를 띄운 지구본이 30fps 이상으로 도는지 잰다.
 * 클러스터링(FR-22) 없이 핀을 전부 그리므로 실제 화면보다 나쁜 조건이다.
 */

type PinMode = 'points' | 'merged' | 'html'

const PIN_COUNTS = [100, 1000, 3000] as const
const PIN_MODES: ReadonlyArray<{ value: PinMode; label: string; hint: string }> = [
  { value: 'points', label: '개별 메시', hint: '핀마다 3D 객체. 누를 수 있음(FR-04)' },
  { value: 'merged', label: '병합 메시', hint: '전체를 객체 하나로. 가장 빠르지만 누를 수 없음' },
  { value: 'html', label: 'HTML 요소', hint: '핀마다 DOM 요소. 꾸미기 쉬우나 느림' },
]
const ARC_COUNT = 50 // 타임랩스(FR-26) 경로 호 개수

const devicePixelRatio = window.devicePixelRatio || 1
// globe.gl의 기본값과 같다(기기 값을 최대 2로 제한)
const DEFAULT_PIXEL_RATIO = Math.min(2, devicePixelRatio)
const PIXEL_RATIOS = [...new Set([1, DEFAULT_PIXEL_RATIO, devicePixelRatio])].sort((a, b) => a - b)

function useViewportSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

function readGpuName(globe: GlobeMethods): string {
  const gl = globe.renderer().getContext()
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
}

function makeHtmlPin(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'html-pin'
  return el
}

export default function GlobePerfPage() {
  const { width, height } = useViewportSize()
  const globeRef = useRef<GlobeMethods | undefined>(undefined)

  const [pinCount, setPinCount] = useState<number>(1000)
  const [pinMode, setPinMode] = useState<PinMode>('points')
  const [showArcs, setShowArcs] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [pixelRatio, setPixelRatio] = useState(DEFAULT_PIXEL_RATIO)
  const [antialias, setAntialias] = useState(true)
  const [gpuName, setGpuName] = useState('확인 중')
  const [selectedPin, setSelectedPin] = useState<FakePin | null>(null)

  const pins = useMemo(() => makeFakePins(pinCount), [pinCount])
  const arcs = useMemo(
    () =>
      showArcs
        ? pins.slice(0, ARC_COUNT + 1).slice(1).map((end, i) => ({ start: pins[i], end }))
        : [],
    [pins, showArcs],
  )

  // 설정이 바뀌면 FPS 기록을 새로 시작한다
  const settingsKey = JSON.stringify({ pinCount, pinMode, showArcs, autoRotate, pixelRatio, antialias })

  // 안티에일리어싱은 WebGL 컨텍스트를 만들 때만 정할 수 있어서, 바뀌면 지구본을 새로 만든다
  const globeKey = antialias ? 'aa-on' : 'aa-off'

  const applyRenderSettings = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return
    globe.renderer().setPixelRatio(pixelRatio)
    const controls = globe.controls()
    controls.autoRotate = autoRotate
    controls.autoRotateSpeed = 0.8
  }, [pixelRatio, autoRotate])

  useEffect(applyRenderSettings, [applyRenderSettings, globeKey])

  const onGlobeReady = useCallback(() => {
    applyRenderSettings()
    if (globeRef.current) setGpuName(readGpuName(globeRef.current))
  }, [applyRenderSettings])

  return (
    <div className="perf-page">
      <Globe
        key={globeKey}
        ref={globeRef}
        width={width}
        height={height}
        rendererConfig={{ antialias }}
        onGlobeReady={onGlobeReady}
        globeImageUrl="/textures/earth-day.jpg"
        backgroundColor="#0b1020"
        pointsData={pinMode === 'html' ? [] : pins}
        pointsMerge={pinMode === 'merged'}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#ff5a5f'}
        pointAltitude={0.02}
        pointRadius={0.25}
        pointsTransitionDuration={0}
        onPointClick={(p) => setSelectedPin(p as FakePin)}
        htmlElementsData={pinMode === 'html' ? pins : []}
        htmlLat="lat"
        htmlLng="lng"
        htmlElement={makeHtmlPin}
        htmlTransitionDuration={0}
        arcsData={arcs}
        arcStartLat={(a) => (a as { start: FakePin }).start.lat}
        arcStartLng={(a) => (a as { start: FakePin }).start.lng}
        arcEndLat={(a) => (a as { end: FakePin }).end.lat}
        arcEndLng={(a) => (a as { end: FakePin }).end.lng}
        arcColor={() => '#ffd166'}
        arcStroke={0.4}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
        arcsTransitionDuration={0}
      />

      <FpsMeter key={settingsKey} />

      <details className="perf-panel" open>
        <summary>측정 조건</summary>

        <fieldset>
          <legend>핀 개수</legend>
          {PIN_COUNTS.map((n) => (
            <label key={n}>
              <input type="radio" name="count" checked={pinCount === n} onChange={() => setPinCount(n)} />
              {n.toLocaleString()}개
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>핀 그리는 방식</legend>
          {PIN_MODES.map((m) => (
            <label key={m.value} title={m.hint}>
              <input type="radio" name="mode" checked={pinMode === m.value} onChange={() => setPinMode(m.value)} />
              {m.label}
            </label>
          ))}
          <p className="hint">{PIN_MODES.find((m) => m.value === pinMode)?.hint}</p>
        </fieldset>

        <fieldset>
          <legend>해상도 배율 (기기 값 ×{devicePixelRatio})</legend>
          {PIXEL_RATIOS.map((r) => (
            <label key={r}>
              <input type="radio" name="ratio" checked={pixelRatio === r} onChange={() => setPixelRatio(r)} />×{r}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>그 밖의 부하</legend>
          <label>
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
            자동 회전
          </label>
          <label>
            <input type="checkbox" checked={showArcs} onChange={(e) => setShowArcs(e.target.checked)} />
            경로 호 {ARC_COUNT}개 (타임랩스)
          </label>
          <label>
            <input type="checkbox" checked={antialias} onChange={(e) => setAntialias(e.target.checked)} />
            안티에일리어싱
          </label>
        </fieldset>

        <p className="device">
          화면 {width}×{height} · GPU {gpuName}
          {selectedPin && ` · 누른 핀 #${selectedPin.id} (${selectedPin.lat.toFixed(2)}, ${selectedPin.lng.toFixed(2)})`}
        </p>
      </details>
    </div>
  )
}
