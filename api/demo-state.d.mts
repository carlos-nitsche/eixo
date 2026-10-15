import type {Store} from '../src/model';
export function createDemoState(preferences?: Partial<Store['preferences']>, referenceDate?: Date | string): Store;
export function emptyDemoState(preferences?: Partial<Store['preferences']>): Store;
