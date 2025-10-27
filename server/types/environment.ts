import type { TEnvironment } from "../models/Environment.js";

export type Coordinates = { x: number; y: number };

export type MysticalObjectState = Record<string, unknown>;

export interface MysticalObjectAction {
  id: string;
  label: string;
  verb?: string;
  description?: string;
  requires?: string[];
}

export interface SerializedMysticalObject {
  type: string;
  name: string;
  pos: Coordinates;
  interactVerb?: string;
  description?: string;
  state?: MysticalObjectState;
  actions?: MysticalObjectAction[];
}

export interface MysticalInteractionContext {
  env: TEnvironment;
  actionId?: string;
}

export interface MysticalInteractionResult {
  ok: boolean;
  message: string;
  consumed?: boolean;
  state?: MysticalObjectState;
  availableActions?: MysticalObjectAction[];
  events?: Array<{ type: string; payload?: unknown }>;
}
