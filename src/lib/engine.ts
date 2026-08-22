import { getCollection } from 'astro:content';
import {
  buildScoreEngine,
  type ScoreEngine,
  type MetricDef,
  type EvidenceRec,
} from './scoring';

/** 构建评分引擎（构建时执行一次/页面，代价可忽略） */
export async function getEngine(): Promise<ScoreEngine> {
  const metrics = (await getCollection('metrics')).map(
    (m) => m.data as unknown as MetricDef,
  );
  const evidence = (await getCollection('evidence')).map((e) => ({
    ...e.data,
  })) as unknown as EvidenceRec[];
  const engine = buildScoreEngine(metrics, evidence);
  for (const issue of engine.issues) {
    console[issue.level === 'error' ? 'error' : 'warn'](`[fitmodel] ${issue.msg}`);
  }
  return engine;
}

export type ModelEntry = {
  id: string;
  data: {
    id: string;
    name: string;
    vendor: string;
    availability_cn: 'direct' | 'restricted' | 'unavailable';
    [k: string]: unknown;
  };
};

export type ProductEntry = {
  id: string;
  data: {
    id: string;
    name: string;
    vendor: string;
    category: string;
    models_used: string[];
    pricing: string;
    free_tier: string;
    availability_cn: 'direct' | 'restricted' | 'unavailable';
    url?: string;
    notes: string;
  };
};
