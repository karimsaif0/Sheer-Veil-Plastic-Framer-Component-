import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

const COMPONENT_AUTHOR = "Karim Saif"

type Preset = "Organza" | "Ivory" | "Pearl" | "Smoke" | "Midnight"

type Props = {
    image?: { src: string; srcSet?: string; alt?: string } | string
    preset: Preset
    silk: string
    sheen: string
    background: string
    sheerness: number
    folds: number
    panels: "Split" | "Single"
    wind: number
    cursor: number
    lightAngle: number
    roomLight: number
    cursorLight: number
    openOn: "Submit" | "Click" | "Hover" | "Never"
    open: boolean
    closeAfter: number
    weave: boolean
    grain: boolean
    style?: React.CSSProperties
}

function parseColor(
    input: string,
    fallback: [number, number, number]
): [number, number, number] {
    if (!input) return fallback

    const s = input.trim()

    if (s[0] === "#") {
        let h = s.slice(1)

        if (h.length === 3) {
            h = h
                .split("")
                .map((c) => c + c)
                .join("")
        }

        const n = parseInt(h.slice(0, 6), 16)

        if (isNaN(n)) return fallback

        return [
            ((n >> 16) & 255) / 255,
            ((n >> 8) & 255) / 255,
            (n & 255) / 255,
        ]
    }

    const m = s.match(/rgba?\(([^)]+)\)/i)

    if (m) {
        const p = m[1]
            .split(/[ ,/]+/)
            .filter(Boolean)
            .map(parseFloat)

        return [p[0] / 255, p[1] / 255, p[2] / 255]
    }

    return fallback
}

const easeInOut = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const BG_VS = `
attribute vec2 aPos;
varying vec2 vUv;

void main(){
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const BG_FS = `
precision mediump float;

varying vec2 vUv;

uniform sampler2D uTex;
uniform vec4 uCover;
uniform float uZoom;
uniform vec3 uBg;
uniform float uHas;

void main(){
    vec2 uv = (vUv - 0.5) / uZoom + 0.5;
    uv = uv * uCover.xy + uCover.zw;
    uv.y = 1.0 - uv.y;

    vec3 c = texture2D(uTex, uv).rgb;

    gl_FragColor = vec4(mix(uBg, c, uHas), 1.0);
}
`

const CLOTH_VS = `
attribute vec3 aPos;
attribute vec3 aNor;
attribute vec2 aUv;

uniform float uAspect;
uniform float uF;

varying vec3 vN;
varying vec2 vScreen;
varying vec2 vUv;
varying float vZ;

void main(){
    float s = uF / (uF - aPos.z);

    vec2 clip = vec2(
        ((aPos.x / uAspect) * 2.0 - 1.0) * s,
        (1.0 - aPos.y * 2.0) * s
    );

    vScreen = clip * 0.5 + 0.5;
    vN = aNor;
    vUv = aUv;
    vZ = aPos.z;

    gl_Position = vec4(clip, 0.0, 1.0);
}
`

const CLOTH_FS = `
precision mediump float;

varying vec3 vN;
varying vec2 vScreen;
varying vec2 vUv;
varying float vZ;

uniform sampler2D uBlur;
uniform vec4 uCover;
uniform float uZoom;
uniform vec3 uSilk;
uniform vec3 uSheen;
uniform vec3 uBg;
uniform float uHas;
uniform float uSheer;
uniform float uRoom;
uniform vec3 uLight;
uniform vec3 uCur;
uniform float uWeave;
uniform float uAsp;

void main(){
    vec3 n = normalize(vN);

    if(n.z < 0.0) {
        n = -n;
    }

    float ndv = clamp(n.z, 0.0, 1.0);

    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(uLight);
    vec3 H = normalize(L + V);

    float diff = max(dot(n, L), 0.0) * 0.7 + 0.3;
    float nh = max(dot(n, H), 0.0);

    float spec =
        pow(nh, 30.0) * 0.85 +
        pow(nh, 7.0) * 0.2;

    vec2 d = vec2(
        (uCur.x - vScreen.x) * uAsp,
        uCur.y - vScreen.y
    );

    vec3 L2 = normalize(vec3(d, 0.45));

    float nh2 = max(
        dot(n, normalize(L2 + V)),
        0.0
    );

    float fall = exp(-dot(d, d) * 16.0);

    float spec2 =
        (
            pow(nh2, 34.0) * 0.9 +
            pow(nh2, 6.0) * 0.12
        ) *
        fall *
        uCur.z;

    float fres = pow(1.0 - ndv, 2.4);

    vec2 uv = vScreen + n.xy * 0.04;

    uv = (uv - 0.5) / uZoom + 0.5;
    uv = uv * uCover.xy + uCover.zw;
    uv.y = 1.0 - uv.y;

    vec3 through = mix(
        uBg,
        texture2D(uBlur, uv).rgb,
        uHas
    );

    float lum = dot(
        through,
        vec3(0.3, 0.59, 0.11)
    );

    through = mix(
        through,
        through * uSilk,
        0.25
    );

    float op = clamp(
        uSheer * 0.85 +
        fres * 0.95,
        0.0,
        1.0
    );

    vec3 fabric =
        uSilk * diff * uRoom +
        uSilk * lum * 1.05 +
        through * 0.25;

    float w =
        1.0 +
        uWeave *
        (
            0.02 *
            sin(
                vUv.x * 380.0 +
                sin(vUv.y * 9.0) * 2.0
            ) +
            0.012 *
            sin(vUv.x * 97.0)
        );

    vec3 col = mix(
        through,
        fabric,
        op
    ) * w;

    col += uSheen *
        (
            spec *
            (
                0.25 +
                0.55 * uRoom +
                0.3 * op
            ) +
            spec2
        );

    col *=
        1.0 -
        clamp(-vZ, 0.0, 0.3) *
        0.8;

    gl_FragColor = vec4(col, 0.97);
}
`

function compile(gl: WebGLRenderingContext, vs: string, fs: string) {
    const createShader = (type: number, source: string) => {
        const shader = gl.createShader(type)!

        gl.shaderSource(shader, source)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(
                gl.getShaderInfoLog(shader) || "Shader compilation failed"
            )
        }

        return shader
    }

    const program = gl.createProgram()!

    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vs))

    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fs))

    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
            gl.getProgramInfoLog(program) || "Program linking failed"
        )
    }

    return program
}

type Panel = {
    nx: number
    ny: number
    pos: Float32Array
    prev: Float32Array
    nor: Float32Array
    uv: Float32Array
    pins: {
        i: number
        closedX: number
        rel: number
    }[]
    cons: Int32Array
    rest: Float32Array
    idx: Uint16Array
    side: number
}

function buildPanel(
    side: number,
    aspect: number,
    folds: number,
    split: boolean
): Panel {
    const nx = split ? 30 : 52
    const ny = 34

    const margin = 0.06 * aspect
    const overlap = 0.035 * aspect

    let rodA: number
    let rodB: number
    let openA: number
    let openB: number

    if (!split) {
        rodA = -margin
        rodB = aspect + margin
        openA = -margin
        openB = -margin + 0.16 * aspect
    } else if (side < 0) {
        rodA = -margin
        rodB = aspect * 0.5 + overlap
        openA = -margin
        openB = aspect * 0.12
    } else {
        rodA = aspect * 0.5 - overlap
        rodB = aspect + margin
        openA = aspect * 0.88
        openB = aspect + margin
    }

    const rodW = rodB - rodA
    const fabricW = rodW * 1.45

    const top = -0.075
    const len = 1.28

    const restX = fabricW / (nx - 1)
    const restY = len / (ny - 1)

    const pos = new Float32Array(nx * ny * 3)
    const uv = new Float32Array(nx * ny * 2)

    const segs = Math.max(2, Math.round(folds))

    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const k = j * nx + i
            const t = i / (nx - 1)

            const segT = t * segs
            const seg = Math.floor(Math.min(segT, segs - 1e-4))

            const local = segT - seg
            const dir = seg % 2 === 0 ? 1 : -1

            pos[k * 3] = rodA + t * rodW

            pos[k * 3 + 1] = top + j * restY * 0.985

            pos[k * 3 + 2] =
                ((dir * Math.sin(Math.PI * local) * rodW) / segs) *
                0.42 *
                (1 - (j / ny) * 0.35)

            uv[k * 2] = (side > 0 ? 0.5 : 0) + t * (split ? 0.5 : 1)

            uv[k * 2 + 1] = j / (ny - 1)
        }
    }

    const pins: Panel["pins"] = []

    for (let s = 0; s <= segs; s++) {
        const i = Math.round((s / segs) * (nx - 1))

        const f = s / segs

        const fromInner =
            side < 0 ? 1 - f : side > 0 ? f : Math.abs(f - 0.5) * 2

        pins.push({
            i,
            closedX: rodA + f * rodW,
            rel: 0.04 + fromInner * 0.32,
        })

        void openA
        void openB
    }

    const constraints: number[] = []
    const restLengths: number[] = []

    const addConstraint = (a: number, b: number, rest: number) => {
        constraints.push(a, b)
        restLengths.push(rest)
    }

    const diag = Math.hypot(restX, restY)

    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const k = j * nx + i

            if (i < nx - 1) {
                addConstraint(k, k + 1, restX)
            }

            if (j < ny - 1) {
                addConstraint(k, k + nx, restY)
            }

            if (i < nx - 1 && j < ny - 1) {
                addConstraint(k, k + nx + 1, diag)

                addConstraint(k + 1, k + nx, diag)
            }

            if (i < nx - 2) {
                addConstraint(k, k + 2, restX * 2)
            }

            if (j < ny - 2) {
                addConstraint(k, k + nx * 2, restY * 2)
            }
        }
    }

    const indices: number[] = []

    for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
            const k = j * nx + i

            indices.push(k, k + 1, k + nx, k + 1, k + nx + 1, k + nx)
        }
    }

    return {
        nx,
        ny,
        pos,
        prev: pos.slice(),
        nor: new Float32Array(nx * ny * 3),
        uv,
        pins,
        cons: new Int32Array(constraints),
        rest: new Float32Array(restLengths),
        idx: new Uint16Array(indices),
        side,
    }
}

function computeNormals(p: Panel) {
    const { nx, ny, pos, nor } = p

    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const k = j * nx + i

            const l = j * nx + Math.max(i - 1, 0)

            const rr = j * nx + Math.min(i + 1, nx - 1)

            const u = Math.max(j - 1, 0) * nx + i

            const d = Math.min(j + 1, ny - 1) * nx + i

            const ax = pos[rr * 3] - pos[l * 3]

            const ay = pos[rr * 3 + 1] - pos[l * 3 + 1]

            const az = pos[rr * 3 + 2] - pos[l * 3 + 2]

            const bx = pos[d * 3] - pos[u * 3]

            const by = pos[d * 3 + 1] - pos[u * 3 + 1]

            const bz = pos[d * 3 + 2] - pos[u * 3 + 2]

            let x = by * az - bz * ay

            let y = bz * ax - bx * az

            let z = bx * ay - by * ax

            const m = Math.hypot(x, y, z) || 1

            nor[k * 3] = x / m

            nor[k * 3 + 1] = y / m

            nor[k * 3 + 2] = z / m
        }
    }
}

const PRESETS: Record<
    Preset,
    {
        silk: string
        sheen: string
        background: string
        sheerness: number
        wind: number
        cursor: number
        lightAngle: number
        roomLight: number
        cursorLight: number
        weave: boolean
        grain: boolean
    }
> = {
    Organza: {
        silk: "#EDE8DC",
        sheen: "#FFFFFF",
        background: "#0B0B0C",
        sheerness: 0.55,
        wind: 0.5,
        cursor: 0.75,
        lightAngle: -50,
        roomLight: 0.12,
        cursorLight: 0.35,
        weave: true,
        grain: true,
    },
    Ivory: {
        silk: "#F3EBDD",
        sheen: "#FFF8E8",
        background: "#15120F",
        sheerness: 0.48,
        wind: 0.42,
        cursor: 0.65,
        lightAngle: -35,
        roomLight: 0.2,
        cursorLight: 0.3,
        weave: true,
        grain: true,
    },
    Pearl: {
        silk: "#DDE2E7",
        sheen: "#FFFFFF",
        background: "#101317",
        sheerness: 0.62,
        wind: 0.48,
        cursor: 0.8,
        lightAngle: -20,
        roomLight: 0.16,
        cursorLight: 0.42,
        weave: true,
        grain: false,
    },
    Smoke: {
        silk: "#777B82",
        sheen: "#DCE2EA",
        background: "#08090B",
        sheerness: 0.72,
        wind: 0.62,
        cursor: 0.9,
        lightAngle: 25,
        roomLight: 0.1,
        cursorLight: 0.5,
        weave: true,
        grain: true,
    },
    Midnight: {
        silk: "#292D35",
        sheen: "#9EA9B8",
        background: "#030407",
        sheerness: 0.82,
        wind: 0.55,
        cursor: 1,
        lightAngle: 50,
        roomLight: 0.08,
        cursorLight: 0.65,
        weave: true,
        grain: true,
    },
}

export function createKarimSaifSheerVeil(
    canvas: HTMLCanvasElement,
    host: HTMLElement,
    live: { current: any },
    src?: string,
    forceStatic = false
): () => void {
    const isStatic = forceStatic

    if (isStatic) return () => {}

    const gl = (canvas.getContext("webgl", {
        premultipliedAlpha: false,
        antialias: true,
        preserveDrawingBuffer: isStatic || !!(window as any).__launchPreserve,
    }) ||
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null

    if (!gl) return () => {}

    let bgProg: WebGLProgram
    let clProg: WebGLProgram

    try {
        bgProg = compile(gl, BG_VS, BG_FS)

        clProg = compile(gl, CLOTH_VS, CLOTH_FS)
    } catch {
        return () => {}
    }

    const quad = gl.createBuffer()

    gl.bindBuffer(gl.ARRAY_BUFFER, quad)

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
    )

    const createTexture = () => {
        const texture = gl.createTexture()!

        gl.bindTexture(gl.TEXTURE_2D, texture)

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            1,
            1,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array([0, 0, 0, 255])
        )

        return texture
    }

    const texSharp = createTexture()

    const texBlur = createTexture()

    const st: any = {
        has: 0,
        imgW: 1,
        imgH: 1,
        panels: [] as Panel[],
        w: 1,
        h: 1,
        aspect: 1,
        mouse: {
            x: -9,
            y: -9,
            vx: 0,
            vy: 0,
            on: false,
        },
        phase: "hung",
        phaseT: 0,
        reveal: 0,
        t: 0,
        raf: 0,
        curGlow: 0,
    }

    const upload = (img: HTMLImageElement | HTMLCanvasElement) => {
        gl.bindTexture(gl.TEXTURE_2D, texSharp)

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

        const bw = 480

        const bh = Math.max(
            8,
            Math.round((480 * (img as any).height) / (img as any).width)
        )

        const c = document.createElement("canvas")

        c.width = bw
        c.height = bh

        const cx = c.getContext("2d")!

        cx.filter = "blur(1.8px) saturate(1.15)"

        cx.drawImage(img, 0, 0, bw, bh)

        gl.bindTexture(gl.TEXTURE_2D, texBlur)

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c)

        st.imgW = (img as any).width

        st.imgH = (img as any).height

        st.has = 1

        if (isStatic) frame()
    }

    if (src) {
        const img = new Image()

        img.crossOrigin = "anonymous"

        img.onload = () => upload(img)

        img.src = src
    }

    let glPanels: {
        p: Panel
        pb: WebGLBuffer
        nb: WebGLBuffer
        ub: WebGLBuffer
        ib: WebGLBuffer
    }[] = []

    const build = (yOffset = 0) => {
        const P = live.current.props as Props

        const split = P.panels !== "Single"

        st.panels = split
            ? [
                  buildPanel(-1, st.aspect, P.folds, true),
                  buildPanel(1, st.aspect, P.folds, true),
              ]
            : [buildPanel(0, st.aspect, P.folds * 1.8, false)]

        glPanels.forEach((g) => {
            gl.deleteBuffer(g.pb)

            gl.deleteBuffer(g.nb)

            gl.deleteBuffer(g.ub)

            gl.deleteBuffer(g.ib)
        })

        glPanels = st.panels.map((p: Panel) => {
            const pb = gl.createBuffer()!

            const nb = gl.createBuffer()!

            const ub = gl.createBuffer()!

            const ib = gl.createBuffer()!

            gl.bindBuffer(gl.ARRAY_BUFFER, ub)

            gl.bufferData(gl.ARRAY_BUFFER, p.uv, gl.STATIC_DRAW)

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)

            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, p.idx, gl.STATIC_DRAW)

            return {
                p,
                pb,
                nb,
                ub,
                ib,
            }
        })

        if (yOffset) {
            for (const p of st.panels as Panel[]) {
                for (let k = 1; k < p.pos.length; k += 3) {
                    p.pos[k] += yOffset

                    p.prev[k] += yOffset
                }
            }

            return
        }

        const phase = st.phase

        st.phase = "hung"

        for (let i = 0; i < (isStatic ? 420 : 160); i++) {
            step(1 / 60, true)
        }

        st.phase = phase
    }

    const resize = () => {
        const r = host.getBoundingClientRect()

        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        st.w = Math.max(2, r.width)

        st.h = Math.max(2, r.height)

        canvas.width = Math.round(st.w * dpr)

        canvas.height = Math.round(st.h * dpr)

        const nextAspect = st.w / st.h

        if (Math.abs(nextAspect - st.aspect) > 0.02 || !st.panels.length) {
            st.aspect = nextAspect

            build()
        }

        gl.viewport(0, 0, canvas.width, canvas.height)

        if (isStatic) frame()
    }

    const step = (dt: number, settling = false) => {
        const P = live.current.props as Props

        st.t += dt

        const t = st.t

        if (st.phase === "gone") {
            st.phaseT += dt

            st.reveal = Math.min(1, st.reveal + dt / 1.2)

            return
        }

        st.phaseT += dt

        const gravity = 0.9
        const damp = 0.982

        const windAmp = settling ? 0.25 * P.wind : P.wind

        const m = st.mouse

        const rad = 0.16

        const cur = settling ? 0 : P.cursor

        for (const p of st.panels as Panel[]) {
            const { pos, prev } = p

            const n = pos.length / 3

            for (let k = 0; k < n; k++) {
                const x = pos[k * 3]

                const y = pos[k * 3 + 1]

                const z = pos[k * 3 + 2]

                let ax = 0
                let ay = gravity
                let az = 0

                const g =
                    Math.sin(x * 3.1 + t * 0.9) * Math.cos(y * 2.3 - t * 0.6) +
                    0.6 * Math.sin(x * 7.3 - t * 1.7 + y * 4.0)

                az += g * 0.55 * windAmp * (0.3 + y)

                ax += Math.sin(t * 0.35 + y * 2.0) * 0.08 * windAmp

                if (cur > 0 && m.on) {
                    const dx = x - m.x

                    const dy = y - m.y

                    const d2 = dx * dx + dy * dy

                    const f = Math.exp(-d2 / (rad * rad))

                    if (f > 0.002) {
                        az += f * 6.5 * cur

                        const d = Math.sqrt(d2) + 1e-4

                        ax += (dx / d) * f * 3.2 * cur + m.vx * f * 9 * cur

                        ay += (dy / d) * f * 1.4 * cur + m.vy * f * 5 * cur
                    }
                }

                const vx = (x - prev[k * 3]) * damp

                const vy = (y - prev[k * 3 + 1]) * damp

                const vz = (z - prev[k * 3 + 2]) * damp

                prev[k * 3] = x
                prev[k * 3 + 1] = y

                prev[k * 3 + 2] = z

                pos[k * 3] = x + vx + ax * dt * dt

                pos[k * 3 + 1] = y + vy + ay * dt * dt

                pos[k * 3 + 2] = z + vz + az * dt * dt
            }

            const { cons, rest } = p

            for (let it = 0; it < 7; it++) {
                for (let c = 0; c < rest.length; c++) {
                    const a = cons[c * 2] * 3

                    const b = cons[c * 2 + 1] * 3

                    const dx = pos[b] - pos[a]

                    const dy = pos[b + 1] - pos[a + 1]

                    const dz = pos[b + 2] - pos[a + 2]

                    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6

                    const diff = ((d - rest[c]) / d) * 0.5

                    pos[a] += dx * diff

                    pos[a + 1] += dy * diff

                    pos[a + 2] += dz * diff

                    pos[b] -= dx * diff

                    pos[b + 1] -= dy * diff

                    pos[b + 2] -= dz * diff
                }

                for (const pin of p.pins) {
                    if (st.phase === "dropping" && st.phaseT > pin.rel) {
                        continue
                    }

                    const k = pin.i * 3

                    let py = -0.075

                    if (st.phase === "lowering") {
                        py =
                            -0.075 -
                            1.45 * (1 - easeInOut(Math.min(1, st.phaseT / 1.5)))
                    }

                    pos[k] = pin.closedX

                    pos[k + 1] = py

                    pos[k + 2] = 0
                }

                for (let k = 2; k < pos.length; k += 3) {
                    if (pos[k] > 0.9) {
                        pos[k] = 0.9
                    }
                }
            }
        }

        if (st.phase === "dropping") {
            st.reveal = Math.min(1, st.reveal + dt / 1.4)

            if (st.phaseT > 2.8) {
                st.phase = "gone"

                st.phaseT = 0
            }
        } else {
            st.reveal = Math.max(0, st.reveal - dt / 1.2)

            if (st.phase === "lowering" && st.phaseT > 1.6) {
                st.phase = "hung"

                st.phaseT = 0
            }
        }

        m.vx *= 0.85
        m.vy *= 0.85
    }

    const frame = () => {
        const P = live.current.props as Props

        const bg = parseColor(P.background, [0.04, 0.04, 0.045])

        const silkC = parseColor(P.silk, [0.92, 0.9, 0.86])

        const sheenC = parseColor(P.sheen, [1, 1, 1])

        const ca = st.w / st.h

        const ia = st.imgW / st.imgH

        let sx = 1
        let sy = 1

        if (ia > ca) {
            sx = ca / ia
        } else {
            sy = ia / ca
        }

        const cover = [sx, sy, (1 - sx) / 2, (1 - sy) / 2]

        const zoom = 1.06 - 0.06 * easeInOut(st.reveal)

        gl.disable(gl.DEPTH_TEST)

        gl.clearColor(bg[0], bg[1], bg[2], 1)

        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(bgProg)

        gl.bindBuffer(gl.ARRAY_BUFFER, quad)

        const la = gl.getAttribLocation(bgProg, "aPos")

        gl.enableVertexAttribArray(la)

        gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0)

        gl.activeTexture(gl.TEXTURE0)

        gl.bindTexture(gl.TEXTURE_2D, texSharp)

        gl.uniform1i(gl.getUniformLocation(bgProg, "uTex"), 0)

        gl.uniform4fv(gl.getUniformLocation(bgProg, "uCover"), cover)

        gl.uniform1f(gl.getUniformLocation(bgProg, "uZoom"), zoom)

        gl.uniform3fv(gl.getUniformLocation(bgProg, "uBg"), bg)

        gl.uniform1f(gl.getUniformLocation(bgProg, "uHas"), st.has)

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        gl.disableVertexAttribArray(la)

        gl.enable(gl.BLEND)

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        gl.useProgram(clProg)

        const aP = gl.getAttribLocation(clProg, "aPos")

        const aN = gl.getAttribLocation(clProg, "aNor")

        const aU = gl.getAttribLocation(clProg, "aUv")

        const ang = ((P.lightAngle ?? -35) * Math.PI) / 180

        gl.uniform1f(gl.getUniformLocation(clProg, "uAspect"), st.aspect)

        gl.uniform1f(gl.getUniformLocation(clProg, "uAsp"), st.aspect)

        gl.uniform1f(gl.getUniformLocation(clProg, "uF"), 2.6)

        gl.uniform3fv(gl.getUniformLocation(clProg, "uSilk"), silkC)

        gl.uniform3fv(gl.getUniformLocation(clProg, "uSheen"), sheenC)

        gl.uniform3fv(gl.getUniformLocation(clProg, "uBg"), bg)

        gl.uniform1f(gl.getUniformLocation(clProg, "uHas"), st.has)

        gl.uniform1f(
            gl.getUniformLocation(clProg, "uSheer"),
            1 - Math.max(0, Math.min(1, P.sheerness))
        )

        gl.uniform3f(
            gl.getUniformLocation(clProg, "uLight"),
            Math.sin(ang) * 0.8,
            Math.cos(ang) * 0.55,
            0.75
        )

        gl.uniform1f(gl.getUniformLocation(clProg, "uWeave"), P.weave ? 1 : 0)

        gl.uniform1f(gl.getUniformLocation(clProg, "uRoom"), P.roomLight ?? 0.3)

        st.curGlow += ((st.mouse.on ? 1 : 0) - st.curGlow) * 0.08

        gl.uniform3f(
            gl.getUniformLocation(clProg, "uCur"),
            st.mouse.x / st.aspect,
            1 - st.mouse.y,
            st.curGlow * (P.cursorLight ?? 0.35)
        )

        gl.uniform4fv(gl.getUniformLocation(clProg, "uCover"), cover)

        gl.uniform1f(gl.getUniformLocation(clProg, "uZoom"), zoom)

        gl.activeTexture(gl.TEXTURE1)

        gl.bindTexture(gl.TEXTURE_2D, texBlur)

        gl.uniform1i(gl.getUniformLocation(clProg, "uBlur"), 1)

        for (const g of st.phase === "gone" ? [] : glPanels) {
            computeNormals(g.p)

            gl.bindBuffer(gl.ARRAY_BUFFER, g.pb)

            gl.bufferData(gl.ARRAY_BUFFER, g.p.pos, gl.DYNAMIC_DRAW)

            gl.enableVertexAttribArray(aP)

            gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0)

            gl.bindBuffer(gl.ARRAY_BUFFER, g.nb)

            gl.bufferData(gl.ARRAY_BUFFER, g.p.nor, gl.DYNAMIC_DRAW)

            gl.enableVertexAttribArray(aN)

            gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0)

            gl.bindBuffer(gl.ARRAY_BUFFER, g.ub)

            gl.enableVertexAttribArray(aU)

            gl.vertexAttribPointer(aU, 2, gl.FLOAT, false, 0, 0)

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib)

            gl.drawElements(gl.TRIANGLES, g.p.idx.length, gl.UNSIGNED_SHORT, 0)
        }

        gl.disable(gl.BLEND)
    }

    let acc = 0
    let last = performance.now()

    let visible = true

    const loop = (now: number) => {
        st.raf = requestAnimationFrame(loop)

        if (!visible) {
            last = now
            return
        }

        acc += Math.min(0.05, (now - last) / 1000)

        last = now

        let iterations = 0

        while (acc >= 1 / 60 && iterations < 3) {
            step(1 / 60)

            acc -= 1 / 60

            iterations++
        }

        const P = live.current.props as Props

        if (
            P.closeAfter > 0 &&
            st.phase === "gone" &&
            st.phaseT > P.closeAfter
        ) {
            setOpen(false)
        }

        frame()
    }

    const setOpen = (value: boolean) => {
        if (value && (st.phase === "hung" || st.phase === "lowering")) {
            st.phase = "dropping"

            st.phaseT = 0

            for (const p of st.panels as Panel[]) {
                const out = p.side === 0 ? 0 : p.side

                for (let k = 0; k < p.pos.length; k += 3) {
                    p.prev[k] -= out * 0.006

                    p.prev[k + 1] += 0.004

                    p.prev[k + 2] -= 0.01
                }
            }
        } else if (!value && (st.phase === "gone" || st.phase === "dropping")) {
            build(-1.45)

            st.phase = "lowering"

            st.phaseT = 0
        }
    }

    live.current.setOpen = setOpen

    if (live.current.props.open) {
        st.phase = "gone"
        st.reveal = 1
    }

    const toWorld = (event: PointerEvent) => {
        const r = host.getBoundingClientRect()

        return [
            ((event.clientX - r.left) / r.width) * st.aspect,
            (event.clientY - r.top) / r.height,
        ]
    }

    const onMove = (event: PointerEvent) => {
        const [x, y] = toWorld(event)

        const m = st.mouse

        if (m.on) {
            m.vx = m.vx * 0.5 + (x - m.x) * 0.5

            m.vy = m.vy * 0.5 + (y - m.y) * 0.5
        }

        m.x = x
        m.y = y
        m.on = true

        if (live.current.props.openOn === "Hover") {
            setOpen(true)
        }
    }

    const onLeave = () => {
        st.mouse.on = false

        if (live.current.props.openOn === "Hover") {
            setOpen(false)
        }
    }

    const onClick = () => {
        if (live.current.props.openOn === "Click") {
            setOpen(st.phase === "hung" || st.phase === "lowering")
        }
    }

    const onSubmit = () => {
        if (live.current.props.openOn === "Submit") {
            setOpen(true)
        }
    }

    const onEvent = (event: Event) => {
        setOpen((event as CustomEvent).detail !== false)
    }

    resize()

    let ro: ResizeObserver | null = null

    let io: IntersectionObserver | null = null

    if (!isStatic) {
        ro = new ResizeObserver(resize)

        ro.observe(host)

        io = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
        })

        io.observe(host)

        host.addEventListener("pointermove", onMove)

        host.addEventListener("pointerleave", onLeave)

        host.addEventListener("click", onClick)

        document.addEventListener("submit", onSubmit, true)

        window.addEventListener("launch:reveal", onEvent)

        st.raf = requestAnimationFrame(loop)
    } else {
        frame()
    }

    live.current.st = st
    ;(host as any).__karimSaifSheerVeil = {
        st,
        setOpen,
        frame,
        step,
    }

    return () => {
        cancelAnimationFrame(st.raf)

        ro?.disconnect()
        io?.disconnect()

        host.removeEventListener("pointermove", onMove)

        host.removeEventListener("pointerleave", onLeave)

        host.removeEventListener("click", onClick)

        document.removeEventListener("submit", onSubmit, true)

        window.removeEventListener("launch:reveal", onEvent)

        const extension = gl.getExtension("WEBGL_lose_context")

        extension?.loseContext()
    }
}

export default function KarimSaifSheerVeil(props: Props) {
    const {
        image,
        preset,
        silk,
        sheen,
        background,
        sheerness,
        folds,
        panels,
        wind,
        cursor,
        lightAngle,
        roomLight,
        cursorLight,
        openOn,
        open,
        closeAfter,
        weave,
        grain,
        style,
    } = props

    const wrap = useRef<HTMLDivElement>(null)

    const canvasRef = useRef<HTMLCanvasElement>(null)

    const live = useRef<any>({})

    const isStaticRenderer = useIsStaticRenderer()

    const src = typeof image === "string" ? image : image?.src

    const presetValues = PRESETS[preset] || PRESETS.Organza

    const activeProps = {
        ...props,
        silk: preset === "Organza" ? silk : presetValues.silk,
        sheen: preset === "Organza" ? sheen : presetValues.sheen,
        background: preset === "Organza" ? background : presetValues.background,
        sheerness: preset === "Organza" ? sheerness : presetValues.sheerness,
        wind: preset === "Organza" ? wind : presetValues.wind,
        cursor: preset === "Organza" ? cursor : presetValues.cursor,
        lightAngle: preset === "Organza" ? lightAngle : presetValues.lightAngle,
        roomLight: preset === "Organza" ? roomLight : presetValues.roomLight,
        cursorLight:
            preset === "Organza" ? cursorLight : presetValues.cursorLight,
        weave: preset === "Organza" ? weave : presetValues.weave,
        grain: preset === "Organza" ? grain : presetValues.grain,
    }

    live.current.props = activeProps

    useEffect(() => {
        if (isStaticRenderer) {
            return
        }

        const canvas = canvasRef.current

        const host = wrap.current

        if (!canvas || !host) {
            return
        }

        return createKarimSaifSheerVeil(canvas, host, live, src, false)
    }, [src, folds, panels, preset, isStaticRenderer])

    useEffect(() => {
        if (isStaticRenderer) {
            return
        }

        live.current.setOpen?.(!!open)
    }, [open, isStaticRenderer])

    const staticImage = typeof image === "string" ? image : image?.src
    const staticBackground = presetValues.background
    const staticSilk = presetValues.silk

    if (isStaticRenderer) {
        return (
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    background: staticBackground,
                    ...style,
                }}
            >
                {staticImage && (
                    <img
                        src={staticImage}
                        alt={typeof image === "string" ? "" : image?.alt || ""}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                )}

                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(90deg, ${staticSilk}22 0%, ${staticSilk}55 18%, ${staticSilk}18 34%, ${staticSilk}50 50%, ${staticSilk}18 66%, ${staticSilk}55 82%, ${staticSilk}22 100%)`,
                        opacity: Math.max(0.25, 1 - presetValues.sheerness * 0.55),
                        pointerEvents: "none",
                    }}
                />

                {activeProps.grain && (
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: -40,
                            pointerEvents: "none",
                            opacity: 0.09,
                            mixBlendMode: "overlay",
                            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
                        }}
                    />
                )}
            </div>
        )
    }

    return (
        <div
            ref={wrap}
            style={{
                position: "relative",
                overflow: "hidden",
                background,
                cursor: openOn === "Click" ? "pointer" : "default",
                touchAction: "pan-y",
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />

            {activeProps.grain && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: -40,
                        pointerEvents: "none",
                        opacity: 0.09,
                        mixBlendMode: "overlay",
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
                    }}
                />
            )}
        </div>
    )
}

KarimSaifSheerVeil.defaultProps = {
    preset: "Organza",
    silk: "#EDE8DC",
    sheen: "#FFFFFF",
    background: "#0B0B0C",
    sheerness: 0.55,
    folds: 8,
    panels: "Split",
    wind: 0.5,
    cursor: 0.75,
    lightAngle: -50,
    roomLight: 0.12,
    cursorLight: 0.35,
    openOn: "Submit",
    open: false,
    closeAfter: 0,
    weave: true,
    grain: true,
}

addPropertyControls(KarimSaifSheerVeil, {
    preset: {
        type: ControlType.Enum,
        title: "Preset",
        options: ["Organza", "Ivory", "Pearl", "Smoke", "Midnight"],
        optionTitles: ["Organza", "Ivory", "Pearl", "Smoke", "Midnight"],
        displaySegmentedControl: false,
        description:
            "Choose a ready-made visual style for the sheer curtain. Organza keeps the individual styling controls active.",
    },

    image: {
        type: ControlType.ResponsiveImage,
        title: "Image",
        description:
            "Background image revealed through the translucent curtain.",
    },

    silk: {
        type: ControlType.Color,
        title: "Silk",
        description: "Controls the primary color of the translucent fabric.",
    },

    sheen: {
        type: ControlType.Color,
        title: "Sheen",
        description:
            "Controls the bright specular highlights and silk reflections.",
    },

    background: {
        type: ControlType.Color,
        title: "Backdrop",
        description:
            "Sets the background color visible behind the image and curtain.",
    },

    sheerness: {
        type: ControlType.Number,
        title: "Sheerness",
        min: 0,
        max: 1,
        step: 0.05,
        description:
            "Controls how transparent the fabric appears. Lower values create a denser veil.",
    },

    folds: {
        type: ControlType.Number,
        title: "Folds",
        min: 2,
        max: 14,
        step: 1,
        displayStepper: true,
        description:
            "Controls the number of physical fabric folds across the curtain.",
    },

    panels: {
        type: ControlType.Enum,
        title: "Panels",
        options: ["Split", "Single"],
        optionTitles: ["Split", "Single"],
        displaySegmentedControl: true,
        description:
            "Choose between two curtains opening from the center or one continuous curtain.",
    },

    wind: {
        type: ControlType.Number,
        title: "Wind",
        min: 0,
        max: 1.5,
        step: 0.05,
        description:
            "Controls the strength of the continuous simulated airflow across the fabric.",
    },

    cursor: {
        type: ControlType.Number,
        title: "Cursor Force",
        min: 0,
        max: 1.5,
        step: 0.05,
        description:
            "Controls how strongly pointer movement pushes and distorts the fabric.",
    },

    lightAngle: {
        type: ControlType.Number,
        title: "Light Angle",
        min: -90,
        max: 90,
        step: 5,
        unit: "°",
        description:
            "Changes the direction of the main light source across the silk.",
    },

    roomLight: {
        type: ControlType.Number,
        title: "Room Light",
        min: 0,
        max: 1.2,
        step: 0.05,
        description:
            "Controls ambient illumination on the fabric. Lower values create a darker cinematic curtain.",
    },

    cursorLight: {
        type: ControlType.Number,
        title: "Cursor Glow",
        min: 0,
        max: 1.5,
        step: 0.05,
        description:
            "Controls the intensity of the moving highlight created around the pointer.",
    },

    openOn: {
        type: ControlType.Enum,
        title: "Open On",
        options: ["Submit", "Click", "Hover", "Never"],
        optionTitles: ["Submit", "Click", "Hover", "Never"],
        displaySegmentedControl: true,
        description: "Determines which interaction opens the curtain.",
    },

    open: {
        type: ControlType.Boolean,
        title: "Open",
        description:
            "Opens or closes the curtain and can be connected to Framer variants or interactions.",
    },

    closeAfter: {
        type: ControlType.Number,
        title: "Close After",
        min: 0,
        max: 30,
        step: 1,
        unit: "s",
        description:
            "Automatically closes the curtain after it has opened. Set to 0 to keep it open.",
    },

    weave: {
        type: ControlType.Boolean,
        title: "Weave",
        description:
            "Adds a fine procedural textile pattern to the fabric surface.",
    },

    grain: {
        type: ControlType.Boolean,
        title: "Grain",
        description: "Made with 💛 by [@karimsaif](https://x.com/karimsaif0)",
    },
})