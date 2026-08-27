import { Client } from './Client.js';

const CUSTOM_CONTENT = (globalThis as typeof globalThis & {
    __customContent?: {
        scrollwheelZoom?: boolean;
    };
}).__customContent;

const SCROLLWHEEL_ZOOM_ENABLED = CUSTOM_CONTENT?.scrollwheelZoom === true;
const SCROLLWHEEL_ZOOM_MIN_DISTANCE = 768;
const SCROLLWHEEL_ZOOM_MAX_DISTANCE = 2048;
const SCROLLWHEEL_ZOOM_STEP = 64;

type CamFollow = (
    this: object,
    pitch: number,
    yaw: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    distance: number
) => void;

type ClientPrototypeWithCamFollow = {
    camFollow: CamFollow;
};

type ScrollwheelRuntimeClient = {
    ingame: boolean;
    sceneState: number;
    cinemaCam: boolean;
};

type ScrollwheelZoomState = {
    active: boolean;
    baseDistance: number;
    offset: number;
};

const clampZoomDistance = (distance: number): number => Math.max(
    SCROLLWHEEL_ZOOM_MIN_DISTANCE,
    Math.min(SCROLLWHEEL_ZOOM_MAX_DISTANCE, distance)
);

if (SCROLLWHEEL_ZOOM_ENABLED) {
    const zoomStates = new WeakMap<object, ScrollwheelZoomState>();
    let activeClient: (object & ScrollwheelRuntimeClient) | null = null;

    const getZoomState = (client: object, baseDistance: number): ScrollwheelZoomState => {
        let state = zoomStates.get(client);
        if (!state) {
            state = {
                active: false,
                baseDistance,
                offset: 0
            };
            zoomStates.set(client, state);
        }
        return state;
    };

    const clientPrototype = Client.prototype as unknown as ClientPrototypeWithCamFollow;
    const originalCamFollow = clientPrototype.camFollow;

    clientPrototype.camFollow = function (
        this: object,
        pitch: number,
        yaw: number,
        targetX: number,
        targetY: number,
        targetZ: number,
        distance: number
    ): void {
        const runtimeClient = this as object & ScrollwheelRuntimeClient;
        activeClient = runtimeClient;

        const state = getZoomState(this, distance);
        state.baseDistance = distance;

        const effectiveDistance = state.active
            ? clampZoomDistance(distance + state.offset)
            : distance;

        originalCamFollow.call(this, pitch, yaw, targetX, targetY, targetZ, effectiveDistance);
    };

    const canvas = document.getElementById('canvas');
    canvas?.addEventListener('wheel', (event: WheelEvent): void => {
        if (
            event.deltaY === 0 ||
            !activeClient ||
            !activeClient.ingame ||
            activeClient.sceneState !== 2 ||
            activeClient.cinemaCam
        ) {
            return;
        }

        const state = getZoomState(activeClient, SCROLLWHEEL_ZOOM_MIN_DISTANCE);
        const currentDistance = clampZoomDistance(
            state.active ? state.baseDistance + state.offset : state.baseDistance
        );
        const step = event.deltaY < 0 ? -SCROLLWHEEL_ZOOM_STEP : SCROLLWHEEL_ZOOM_STEP;
        const nextDistance = clampZoomDistance(currentDistance + step);

        state.offset = nextDistance - state.baseDistance;
        state.active = true;
        event.preventDefault();
    }, { passive: false });
}

export { Client };
