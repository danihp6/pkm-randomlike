import { answerNodeRequest, type NodeRequest } from '../engine/region/preload';

/**
 * The node worker: answers every `NodeRequest` with `answerNodeRequest`. Not
 * imported by value from anywhere - the base scene reaches it through
 * `new Worker(new URL('../workers/nodeWorker.ts', import.meta.url), { type: 'module' })`,
 * so Vite emits it as its own chunk instead of inlining it.
 */
const scope = globalThis as unknown as Readonly<{
  addEventListener: (type: 'message', listener: (event: MessageEvent<NodeRequest>) => void) => void;
  postMessage: (message: unknown) => void;
}>;

scope.addEventListener('message', (event) => {
  scope.postMessage(answerNodeRequest(event.data));
});

export {};
