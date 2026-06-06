import type { OpPipeline } from './OpPipeline.js';
import type { PipelineOp } from './pipelineOps.js';

export interface TestOp {
  name: string;
  args: any[];
}

export interface FeatureTestCase {
  name: string;
  source: any[];
  ops: TestOp[];
  expected?: any;
  error?: any; // Error class/constructor, or message substring
}

export type FeatureCategory = 'lazy' | 'materializing' | 'terminal';

export interface FeaturePlugin {
  name: string; // Method name on Query/AsyncQuery, e.g. 'Where'
  kind?: string; // The op kind, e.g. 'where' (only for lazy/materializing)
  category: FeatureCategory;
  
  // For lazy/materializing operations:
  append?: (pipeline: OpPipeline<any>, ...args: any[]) => OpPipeline<any>;
  executeSync?: (source: Iterable<any>, op: any) => Iterable<any>;

  // For terminal operations:
  runSync?: (source: Iterable<any>, pipeline: OpPipeline<any>, ...args: any[]) => any;
  runAsync?: (source: AsyncIterable<any>, pipeline: OpPipeline<any>, ...args: any[]) => Promise<any>;

  testCases: FeatureTestCase[];
}

export const FeatureRegistry = new Map<string, FeaturePlugin>();

export function registerFeature(feature: FeaturePlugin): void {
  // Register by kind (for pipeline lookup) and by name (for dynamic method lookup)
  if (feature.kind) {
    FeatureRegistry.set(feature.kind, feature);
  }
  FeatureRegistry.set(feature.name, feature);
}
