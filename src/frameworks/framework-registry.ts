import type { FrameworkDetector, RouteBinding, HookBinding, ScanContext } from '../types.js';
import { LaravelDetector } from './detectors/laravel.js';
import { DjangoDetector } from './detectors/django.js';
import { FlaskDetector } from './detectors/flask.js';
import { FastAPIDetector } from './detectors/fastapi.js';
import { ExpressDetector } from './detectors/express.js';
import { NestJSDetector } from './detectors/nestjs.js';
import { ReactRouterDetector } from './detectors/react-router.js';
import { TanstackRouterDetector } from './detectors/tanstack-router.js';
import { NextJSDetector } from './detectors/nextjs.js';
import { SvelteKitDetector } from './detectors/sveltekit.js';

export class FrameworkRegistry {
  private static instance: FrameworkRegistry | null = null;
  private detectors: FrameworkDetector[] = [];

  private constructor() {
    this.register(new LaravelDetector());
    this.register(new DjangoDetector());
    this.register(new FlaskDetector());
    this.register(new FastAPIDetector());
    this.register(new ExpressDetector());
    this.register(new NestJSDetector());
    this.register(new ReactRouterDetector());
    this.register(new TanstackRouterDetector());
    this.register(new NextJSDetector());
    this.register(new SvelteKitDetector());
  }

  static getInstance(): FrameworkRegistry {
    if (!FrameworkRegistry.instance) {
      FrameworkRegistry.instance = new FrameworkRegistry();
    }
    return FrameworkRegistry.instance;
  }

  register(detector: FrameworkDetector): void {
    this.detectors.push(detector);
  }

  getDetectors(): FrameworkDetector[] {
    return this.detectors;
  }

  async detectActiveFrameworks(projectRoot: string, files: string[]): Promise<FrameworkDetector[]> {
    const active: FrameworkDetector[] = [];
    for (const detector of this.detectors) {
      try {
        const isDetected = await detector.detect(projectRoot, files);
        if (isDetected) {
          active.push(detector);
        }
      } catch (err) {
        console.error(`Error detecting framework ${detector.name}:`, err);
      }
    }
    return active;
  }
}
