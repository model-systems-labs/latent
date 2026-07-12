export type BrowserLabFile<Track extends string = string> = {
  path: string;
  track: Track;
  title: string;
  source: string;
  referenceSource: string;
  updatedAt: number;
};

export type BrowserLabContract = {
  id: string;
  path: string;
  label: string;
  source: string;
  assertion?: string;
};

export type BrowserLabTestResult = {
  id: string;
  path: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type BrowserLabBuildGate = {
  passed: number;
  total: number;
  failures: BrowserLabTestResult[];
  canPromote: boolean;
};
