/**
 * Post-processing chain, in order:
 *
 *   RenderPass -> Afterimage (trails) -> UnrealBloom -> Output (tone map,
 *   sRGB) -> Finish (aberration, vignette, grain, flash)
 *
 * Bloom runs in linear HDR before tone mapping, so the neon materials whose
 * colors exceed 1.0 are exactly the things that glow. The finish pass runs
 * after the output transform, so grain and vignette are applied in display
 * space where their strength is predictable.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { QualityTier } from "./quality.ts";
import { finishFragment, finishVertex } from "./shaders/finish.glsl.ts";

export interface PostLook {
  flash: number;
  flashColor: readonly [number, number, number];
  desaturate: number;
  /** Multiplies bloom; reduced flashing turns it down. */
  bloomScale: number;
}

export class PostChain {
  readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly trails: AfterimagePass;
  private readonly finish: ShaderPass;
  private tier: QualityTier;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    tier: QualityTier,
  ) {
    this.tier = tier;
    // A half-float, multisampled target: HDR headroom for bloom, and MSAA
    // because the canvas's own antialiasing does not apply to offscreen passes.
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: tier.antialias ? 4 : 0,
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    this.trails = new AfterimagePass(tier.trails);
    this.composer.addPass(this.trails);

    // Threshold above 1: only HDR emitters bloom, so bullet hues stay
    // legible instead of melting into one white glow.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1, 0.35, 1.05);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());

    this.finish = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAberration: { value: 0 },
        uGrain: { value: 0 },
        uVignette: { value: 0.55 },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Vector3(1, 1, 1) },
        uDesaturate: { value: 0 },
      },
      vertexShader: finishVertex,
      fragmentShader: finishFragment,
    });
    this.composer.addPass(this.finish);
    this.setTier(tier);
  }

  setTier(tier: QualityTier): void {
    this.tier = tier;
    this.trails.enabled = tier.trails > 0;
    this.trails.uniforms.damp.value = tier.trails;
    this.bloom.enabled = tier.bloom;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(timeSec: number, look: PostLook): void {
    const u = this.finish.uniforms;
    u.uTime.value = timeSec;
    u.uAberration.value = this.tier.chromaticAberration;
    u.uGrain.value = this.tier.grain;
    u.uFlash.value = look.flash;
    (u.uFlashColor.value as THREE.Vector3).set(...look.flashColor);
    u.uDesaturate.value = look.desaturate;
    this.bloom.strength = this.tier.bloomStrength * look.bloomScale;
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
  }
}
