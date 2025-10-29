import type { TEnvironment } from "../models/Environment.js";

export type Coordinates = { x: number; y: number };

export type MysticalObjectState = Record<string, unknown>;

export interface MysticalInteractionOutcomeSpec {
  id: string;
  label: string;
  description?: string;
  resultType?: string;
  payloadExample?: unknown;
}

export interface MysticalObjectInteraction {
  id: string;
  label: string;
  verb?: string;
  description?: string;
  requires?: string[];
  mcpFunctions: string[];
  resultPreviews?: MysticalInteractionOutcomeSpec[];
}

export interface SerializedMysticalObject {
  type: string;
  name: string;
  pos: Coordinates;
  interactVerb?: string;
  description?: string;
  state?: MysticalObjectState;
  interactions?: MysticalObjectInteraction[];
}

export interface MysticalInteractionContext {
  env: TEnvironment;
  actionId?: string;
}

export interface MysticalInteractionResult {
  ok: boolean;
  message: string;
  interactionId?: string;
  resultId?: string;
  resultType?: string;
  consumed?: boolean;
  state?: MysticalObjectState;
  availableInteractions?: MysticalObjectInteraction[];
  events?: Array<{ type: string; payload?: unknown }>;
  data?: unknown;
}
