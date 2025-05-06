export interface UserJourney {
  startPoint: string;
  endPoint: string;
  decisionPoints: string[];
  insights: string[];
  satisfactionScore: number;
  completionRate: number;
  abandonmentPoints?: string[];
}

export interface ValidationResult {
  score: number;
  confidence: number;
  evidence: string[];
  marketSize?: number;
  growthRate?: number;
  competitorCount?: number;
  userDemand?: number;
}

export interface CompetitiveAdvantage {
  type: string;
  description: string;
  strength: number; // 0-1 score
  sustainability: number; // 0-1 score
  evidence: string[];
}

export interface EntryBarrier {
  type: string;
  description: string;
  severity: number; // 0-1 score
  overcomingStrategy: string;
  evidence: string[];
}

export interface CompetitionAnalysisResult {
  competitiveAdvantages: CompetitiveAdvantage[];
  entryBarriers: EntryBarrier[];
  overallCompetitivePosition: number; // 0-1 score
  recommendations: string[];
} 