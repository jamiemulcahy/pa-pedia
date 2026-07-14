/**
 * UnitModelViewer
 *
 * Renders a rotatable, textured 3D model of a PA unit with the game's
 * two-colour team-paint system. Geometry (Draco glb) + a grayscale diffuse +
 * an R/G/B channel mask are tinted at runtime by a small ShaderMaterial
 * (ported from the validated spike): mask R = main region, G = highlight
 * region, B = emissive. Two colour pickers drive the tint live; the choice is
 * persisted per faction (see {@link readTeamColorPref}) and can be reset to the
 * faction default.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { TeamColors } from '@/types/faction'
import { loadUnitModel, type LoadedUnitModel } from '@/services/modelLoader'
import { readTeamColorPref, writeTeamColorPref, clearTeamColorPref } from '@/services/teamColorPref'
import { isAuxiliaryMeshName } from '@/utils/auxiliaryMesh'

interface UnitModelViewerProps {
  factionId: string
  unitId: string
  version?: string | null
  /** Faction default team colours; falls back to a neutral pair when absent. */
  teamColors?: TeamColors
  /**
   * When false, render the canvas + colour controls without the bordered card
   * and "3D Model" heading — used inside the modal, which supplies its own
   * header/chrome. Defaults to true for standalone use.
   */
  showChrome?: boolean
}

/** Neutral fallback used when a faction defines no team colours. */
const NEUTRAL_COLORS: TeamColors = { primary: '#6b7280', secondary: '#9ca3af' }

// Cache the WebGL probe at module scope: it creates a canvas + GL context, and
// creating one per viewer mount needlessly consumes scarce WebGL contexts
// (browsers cap at ~16), pushing toward "too many contexts" on repeated opens.
let webglProbeResult: boolean | null = null

/** Detect WebGL availability without throwing (probed once per session). */
function isWebGLAvailable(): boolean {
  if (webglProbeResult !== null) return webglProbeResult
  try {
    const canvas = document.createElement('canvas')
    webglProbeResult = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    webglProbeResult = false
  }
  return webglProbeResult
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  uniform sampler2D uDiffuse, uMask;
  uniform vec3 uMain, uHighlight, uLightDir;
  void main() {
    float lum = texture2D(uDiffuse, vUv).r;      // grayscale albedo / baked shading
    vec3 m = texture2D(uMask, vUv).rgb;          // r = main, g = highlight, b = emissive
    vec3 base = vec3(lum);                        // bare metal = grayscale
    base = mix(base, uMain * (0.35 + lum), m.r);  // main-colour regions
    base = mix(base, uHighlight * (0.35 + lum), m.g); // highlight regions
    float ndl = clamp(dot(normalize(vN), normalize(uLightDir)), 0.0, 1.0);
    vec3 col = base * (0.55 + 0.65 * ndl);        // form lighting over baked shading
    col += m.b * uMain * 1.2;                      // emissive glow
    gl_FragColor = vec4(col, 1.0);
  }
`

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; message: string }

export function UnitModelViewer({
  factionId,
  unitId,
  version,
  teamColors,
  showChrome = true,
}: UnitModelViewerProps) {
  const factionDefault: TeamColors = teamColors ?? NEUTRAL_COLORS

  const webglAvailable = useMemo(() => isWebGLAvailable(), [])

  // Colour state: a preference picked for THIS faction seeds the pickers; anything
  // else (no pref, or one picked on another faction) opens in faction defaults.
  const [main, setMain] = useState<string>(
    () => readTeamColorPref(factionId)?.main ?? factionDefault.primary
  )
  const [highlight, setHighlight] = useState<string>(
    () => readTeamColorPref(factionId)?.highlight ?? factionDefault.secondary
  )

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })

  const mountRef = useRef<HTMLDivElement | null>(null)
  const uniformsRef = useRef<{
    uMain: { value: THREE.Color }
    uHighlight: { value: THREE.Color }
  } | null>(null)

  // Push colour changes into the live shader uniforms (recolour without rebuild).
  useEffect(() => {
    if (uniformsRef.current) {
      uniformsRef.current.uMain.value.set(main)
      uniformsRef.current.uHighlight.value.set(highlight)
    }
  }, [main, highlight])

  // Persist against the current faction so the choice carries across its units.
  const setMainColor = (value: string) => {
    setMain(value)
    writeTeamColorPref({ main: value, highlight, factionId })
  }
  const setHighlightColor = (value: string) => {
    setHighlight(value)
    writeTeamColorPref({ main, highlight: value, factionId })
  }
  const resetToFactionDefault = () => {
    clearTeamColorPref()
    setMain(factionDefault.primary)
    setHighlight(factionDefault.secondary)
  }

  // Build the three.js scene once per unit.
  useEffect(() => {
    if (!webglAvailable) return
    const mount = mountRef.current
    if (!mount) return

    let cancelled = false
    let frame = 0
    let renderer: THREE.WebGLRenderer | null = null
    let controls: OrbitControls | null = null
    let dracoLoader: DRACOLoader | null = null
    let resizeObserver: ResizeObserver | null = null
    let loadedModel: LoadedUnitModel | null = null
    const disposables: Array<{ dispose: () => void }> = []

    setLoadState({ status: 'loading' })

    async function build() {
      let model: LoadedUnitModel | null
      try {
        model = await loadUnitModel(factionId, unitId, version)
      } catch (err) {
        // Generic on purpose: this error can carry internal URLs and stack text
        // (network / range / zip failures). The detail goes to the console for
        // developers, never to the panel.
        console.warn('Failed to load unit model', err)
        if (!cancelled) {
          setLoadState({ status: 'error', message: 'Could not load this model. Try reloading.' })
        }
        return
      }
      if (cancelled) {
        model?.release()
        return
      }
      if (!model) {
        setLoadState({ status: 'error', message: 'No model available for this unit' })
        return
      }
      loadedModel = model

      const width = mount!.clientWidth || 320
      const height = mount!.clientHeight || 320

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true })
      } catch (err) {
        if (!cancelled) {
          setLoadState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to initialise 3D renderer',
          })
        }
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
      mount!.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0f1420)

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.autoRotate = true
      controls.autoRotateSpeed = 1.2
      controls.enableDamping = true

      // Hemisphere + key light for ambience (grid + any non-shader meshes).
      scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x202028, 1.0))
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
      keyLight.position.set(4, 8, 5)
      scene.add(keyLight)

      const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b)
      // Sit the grid a hair below y=0 so it never lands exactly coplanar with a
      // model's flat underside (structures rest their base on y=0), which would
      // otherwise z-fight into a shimmer as the model auto-rotates. The offset is
      // scaled to the model below, once we know its size.
      scene.add(grid)
      disposables.push(grid.geometry, grid.material as THREE.Material)

      // Load textures from the model's URLs.
      const texLoader = new THREE.TextureLoader()
      const loadTexture = (url: string): Promise<THREE.Texture> =>
        new Promise((resolve, reject) => {
          texLoader.load(
            url,
            (tex) => {
              tex.flipY = false
              tex.colorSpace = THREE.NoColorSpace
              resolve(tex)
            },
            undefined,
            () => reject(new Error('Failed to load texture'))
          )
        })

      // A 1×1 fallback texture for units that ship geometry but no textures
      // (many Exiles/Bugs units): a neutral grey diffuse reads as bare metal,
      // and an all-zero mask means no team-colour regions and no emissive. The
      // shader is unchanged — it just samples a solid colour.
      const solidTexture = (r: number, g: number, b: number): THREE.Texture => {
        const tex = new THREE.DataTexture(
          new Uint8Array([r, g, b, 255]),
          1,
          1,
          THREE.RGBAFormat
        )
        tex.colorSpace = THREE.NoColorSpace
        tex.needsUpdate = true
        return tex
      }

      let diffuse: THREE.Texture
      let mask: THREE.Texture
      try {
        ;[diffuse, mask] = await Promise.all([
          model.diffuseUrl ? loadTexture(model.diffuseUrl) : Promise.resolve(solidTexture(170, 170, 170)),
          model.maskUrl ? loadTexture(model.maskUrl) : Promise.resolve(solidTexture(0, 0, 0)),
        ])
      } catch (err) {
        if (!cancelled) {
          setLoadState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load textures',
          })
        }
        return
      }
      if (cancelled) {
        diffuse.dispose()
        mask.dispose()
        return
      }
      disposables.push(diffuse, mask)

      const uniforms = {
        uDiffuse: { value: diffuse },
        uMask: { value: mask },
        uMain: { value: new THREE.Color(main) },
        uHighlight: { value: new THREE.Color(highlight) },
        uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.5).normalize() },
      }
      uniformsRef.current = { uMain: uniforms.uMain, uHighlight: uniforms.uHighlight }

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      })
      disposables.push(material)

      // Load geometry (Draco), vendored decoder — no external CDN.
      dracoLoader = new DRACOLoader()
      dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/gltf/`)
      const gltfLoader = new GLTFLoader()
      gltfLoader.setDRACOLoader(dracoLoader)

      let gltf
      try {
        gltf = await gltfLoader.loadAsync(model.glbUrl)
      } catch (err) {
        if (!cancelled) {
          setLoadState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load geometry',
          })
        }
        return
      }
      if (cancelled) return

      const obj = gltf.scene
      // Auxiliary meshes (build/nav platform `*_nav`, collision hull `*_col`)
      // ship inside the model but aren't part of the unit's appearance — left in,
      // factories render a stray "extra box". Collect them during the traverse
      // and remove them afterwards (mutating the graph mid-traverse is unsafe).
      const auxiliary: THREE.Mesh[] = []
      obj.traverse((n) => {
        const mesh = n as THREE.Mesh
        if (!mesh.isMesh) return
        if (isAuxiliaryMeshName(mesh.name)) {
          auxiliary.push(mesh)
          return
        }
        if (mesh.geometry) disposables.push(mesh.geometry)
        // Dispose the MeshStandardMaterial(s) GLTFLoader auto-created before
        // swapping in our shared team-colour material, so they don't leak.
        const original = mesh.material
        if (Array.isArray(original)) original.forEach((m) => m?.dispose?.())
        else original?.dispose?.()
        mesh.material = material
      })
      // Drop the auxiliary meshes from the scene graph so they neither render nor
      // skew the framing bounding box below, disposing their GPU resources.
      for (const mesh of auxiliary) {
        mesh.geometry?.dispose?.()
        const mat = mesh.material
        if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.())
        else mat?.dispose?.()
        mesh.removeFromParent()
      }

      // Frame the model.
      const box = new THREE.Box3().setFromObject(obj)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      obj.position.sub(center)
      obj.position.y += size.y / 2
      const r = Math.max(size.x, size.y, size.z) || 1
      camera.position.set(r * 1.6, r * 1.3, r * 1.9)
      // Tighten the depth range to the model's actual size. The default
      // 0.1 → 1000 span wastes almost all depth-buffer precision on empty space
      // in front of PA-scale models, so their many near-coplanar armour panels
      // z-fight into a heavy flicker while auto-rotating. A near:far ratio of a
      // few thousand keeps the depth buffer precise across the whole model.
      camera.near = r * 0.05
      camera.far = r * 100
      camera.updateProjectionMatrix()
      // Drop the grid just beneath the model's base so the two are never exactly
      // coplanar (see grid creation above).
      grid.position.y = -r * 0.002
      controls.target.set(0, size.y / 2, 0)
      controls.update()
      scene.add(obj)

      setLoadState({ status: 'loaded' })

      // Handle container resizing.
      resizeObserver = new ResizeObserver(() => {
        if (!renderer) return
        const w = mount!.clientWidth || 320
        const h = mount!.clientHeight || 320
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      })
      resizeObserver.observe(mount!)

      const animate = () => {
        if (cancelled || !renderer || !controls) return
        frame = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()
    }

    build()

    return () => {
      cancelled = true
      if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      controls?.dispose()
      for (const d of disposables) {
        try {
          d.dispose()
        } catch {
          // best-effort disposal
        }
      }
      dracoLoader?.dispose()
      if (renderer) {
        renderer.dispose()
        // Explicitly drop the GL context so the browser reclaims the context
        // slot immediately rather than on GC — otherwise repeated open/close
        // accumulates contexts toward the ~16 cap (black canvas).
        renderer.forceContextLoss()
        renderer.domElement.remove()
      }
      uniformsRef.current = null
      loadedModel?.release()
    }
    // Colours are intentionally excluded: recolouring updates uniforms in the
    // effect above rather than rebuilding the whole scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factionId, unitId, version, webglAvailable])

  // Optionally wrap content in the bordered "3D Model" card. Inside the modal
  // (showChrome=false) the modal supplies the header, so we render bare.
  const withChrome = (children: ReactNode, heading = true) =>
    showChrome ? (
      <div
        data-testid="model-viewer"
        className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
      >
        {heading && (
          <h2 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">3D Model</h2>
        )}
        {children}
      </div>
    ) : (
      <div data-testid="model-viewer">{children}</div>
    )

  if (!webglAvailable) {
    return withChrome(
      <p className="text-sm text-gray-500 dark:text-gray-400">
        3D preview unavailable — your browser does not support WebGL.
      </p>
    )
  }

  return withChrome(
    <>
      <div className="relative">
        <div
          ref={mountRef}
          data-testid="model-canvas-mount"
          className="aspect-square w-full rounded overflow-hidden bg-[#0f1420]"
        />
        {loadState.status === 'loading' && (
          <div
            data-testid="model-loading"
            className="absolute inset-0 flex items-center justify-center text-sm text-gray-300"
          >
            Loading 3D model…
          </div>
        )}
        {loadState.status === 'error' && (
          <div
            data-testid="model-error"
            className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-300"
          >
            {loadState.message}
          </div>
        )}
      </div>

      {/* Team-colour controls */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="w-16">Main</span>
            <input
              type="color"
              aria-label="Main colour"
              data-testid="color-main"
              value={main}
              onChange={(e) => setMainColor(e.target.value)}
              className="h-7 w-11 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="w-16">Highlight</span>
            <input
              type="color"
              aria-label="Highlight colour"
              data-testid="color-highlight"
              value={highlight}
              onChange={(e) => setHighlightColor(e.target.value)}
              className="h-7 w-11 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent"
            />
          </label>
        </div>
        <button
          type="button"
          data-testid="color-reset"
          onClick={resetToFactionDefault}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Reset to faction default
        </button>
      </div>
    </>
  )
}

export default UnitModelViewer
