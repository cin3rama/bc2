export {};

declare global {
    interface Window {
        __MARKETFLOW_QUEUE__?: any[];
    }
}
