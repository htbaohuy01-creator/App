
export interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export interface PatrolLog {
  id: string;
  guardId: string;
  guardName: string;
  startTime: number;
  endTime?: number;
  points: GeoPoint[];
  checkpoints: CheckpointStatus[];
  status: 'active' | 'completed' | 'incident';
}

export interface Checkpoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface CheckpointStatus {
  checkpointId: string;
  reachedAt?: number;
}

export enum UserRole {
  GUARD = 'GUARD',
  SUPERVISOR = 'SUPERVISOR'
}

export interface AnalysisResult {
  summary: string;
  anomalies: string[];
  efficiency: number;
  recommendations: string[];
}
