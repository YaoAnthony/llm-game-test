
import { createMysticalObject } from "../Mystical/mysticalObject.js";
import type { SerializedMysticalObject } from "../Types/environment.js";


/**
 * include time, weather, environment effects etc.
 */
export class Environment {
    private objects: ReturnType<typeof createMysticalObject>[] = [];

    async load() {
        
    }

    getObjectAt(pos: { x: number; y: number }) {
        return this.objects.find(o => o.pos?.x === pos.x && o.pos?.y === pos.y);
    }

    toJSON() {
        return this.objects.map(o => o.toJSON());
    }
}
