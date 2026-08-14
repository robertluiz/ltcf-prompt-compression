export interface LifecycleStatus {
    installed: boolean;
    enabled: boolean;
    codexMarketplace: boolean;
    home: string;
}
export interface CodexMarketplace {
    add(): void;
    remove(): void;
}
export interface LifecycleOptions {
    home?: string;
    marketplace?: CodexMarketplace;
    skipCodex?: boolean;
    purge?: boolean;
}
export declare function installLifecycle(options?: LifecycleOptions): LifecycleStatus;
export declare function enableLifecycle(options?: LifecycleOptions): LifecycleStatus;
export declare function disableLifecycle(options?: LifecycleOptions): LifecycleStatus;
export declare function uninstallLifecycle(options?: LifecycleOptions): LifecycleStatus;
export declare function lifecycleStatus(options?: Pick<LifecycleOptions, "home">): LifecycleStatus;
export declare function isLifecycleEnabled(options?: Pick<LifecycleOptions, "home">): boolean;
export declare function formatLifecycleStatus(status: LifecycleStatus): string;
