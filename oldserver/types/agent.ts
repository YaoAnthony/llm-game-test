export type MemorySnapshot = {
  id: string;
  label: string;
  detail: string;
  position?: { x: number; y: number } | undefined;
  objectType?: string | undefined;
  createdAt: string;
  updatedAt: string;
};
