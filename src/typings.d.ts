declare module '@bakelor/iframe-bridge' {
    export class ClientBridgeService {
        callApi(apiName: string, params: any): Promise<any>;
        subscribeToChannel(channelName: string, callback: (data: any) => void): () => void;
    }

    export class HostBridgeService {
        registerApi(
            apiName: string,
            description: string,
            params: any,
            exampleResponse: any,
            implementation: (params: any) => Promise<any>
        ): void;
    }

    export enum ThemeType {
        LIGHT = 'light',
        DARK = 'dark'
    }

    export interface HostConfig {
        appName: string;
        version: string;
        theme: ThemeType;
        language: string;
        trustedOrigin: string;
        iframeWidth: string;
        iframeHeight: string;
        metaTags?: Array<{ name: string; content: string; }>;
        debug?: boolean;
    }

    export interface ClientConfig {
        appName: string;
        version: string;
        theme: ThemeType;
        language: string;
        trustedOrigin: string;
        poweredByLabel: string;
        metaTags?: Array<{ name: string; content: string; }>;
        debug?: boolean;
    }

    export class BakelorIframeBridgeModule { }
}

declare module '@bakelor/iframe-bridge';
