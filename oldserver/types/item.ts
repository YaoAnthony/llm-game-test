import type { TEnvironment } from "../models/Environment.js"

export interface InteractionContext {
    environment : TEnvironment;
    actionId?: string;
}