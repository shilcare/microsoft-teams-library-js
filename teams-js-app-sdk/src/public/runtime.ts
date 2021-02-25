import { deepFreeze } from '../internal/utils';

export interface IRuntime {
  readonly apiVersion: number;
  readonly supports: {
    readonly calendar?: {};
    readonly mail?: {};
  };
}

export let runtime: IRuntime;

export function applyRuntimeConfig(runtimeConfig: IRuntime): void {
  runtime = deepFreeze(runtimeConfig);
}
