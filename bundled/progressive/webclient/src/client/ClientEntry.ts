import { Client } from './Client.js';

import IfType from '#/config/IfType.js';
import LocType from '#/config/LocType.js';

const CUSTOM_CONTENT = (globalThis as typeof globalThis & {
    __customContent?: {
        grandExchange?: boolean;
        scrollwheelZoom?: boolean;
    };
}).__customContent;

const GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID = 8990;
const GRAND_EXCHANGE_BANK_BOOTH_NAME = 'bank booth';
const GRAND_EXCHANGE_ITEM_SEARCH_SELECTION_PREFIX = '__ge_select__:';
const GRAND_EXCHANGE_ENABLED = CUSTOM_CONTENT?.grandExchange === true;

// Bank-booth location configs live in the native r254 cache rather than the
// staged RuneScript sources. The option-2 GE build can remain published while
// launcher options 1 and 3 run, so interface presence alone is not a safe feature
// test. Require the runtime GE flag as well as the staged interface root before
// exposing the otherwise-unused third booth option. The matching oploc3 handlers
// are staged server-side only while the same feature flag is enabled.
if (GRAND_EXCHANGE_ENABLED) {
    const originalLocList = LocType.list.bind(LocType);
    LocType.list = (id: number): LocType => {
        const loc = originalLocList(id);
        if (
            IfType.list[GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID] &&
            loc.name?.toLowerCase() === GRAND_EXCHANGE_BANK_BOOTH_NAME &&
            loc.op &&
            !loc.op[2]
        ) {
            loc.op[2] = 'Collect';
        }
        return loc;
    };
}

// The live GE chatbox search and the Enter key both resume the same
// p_namedialog server suspension. Prefix only a clicked chatbox result so the
// server can distinguish "select this result" from "browse this query". The
// original method still owns closing/redrawing the chatbox and writing the
// response packet; Enter remains untouched and therefore opens the advanced
// result browser.
type GrandExchangeItemSearchPrototype = {
    submitGrandExchangeItemSearchResult(name: string): void;
};

const grandExchangeSearchPrototype = Client.prototype as unknown as GrandExchangeItemSearchPrototype;
const originalSubmitGrandExchangeItemSearchResult = grandExchangeSearchPrototype.submitGrandExchangeItemSearchResult;
grandExchangeSearchPrototype.submitGrandExchangeItemSearchResult = function (name: string): void {
    originalSubmitGrandExchangeItemSearchResult.call(
        this,
        `${GRAND_EXCHANGE_ITEM_SEARCH_SELECTION_PREFIX}${name}`
    );
};

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
