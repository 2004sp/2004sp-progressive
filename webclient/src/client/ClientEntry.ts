import { Client } from './Client.js';
import { Colour } from '#/graphics/Colour.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixFont from '#/graphics/PixFont.js';

type GrandExchangeSearchResult = {
    name: string;
};

type GrandExchangeSearchRuntimeClient = {
    socialInput: string;
    mouseX: number;
    mouseY: number;
    p11: PixFont | null | undefined;
    p12: PixFont | null | undefined;
    b12: PixFont | null | undefined;
    getGrandExchangeItemSearchResults(limit?: number): GrandExchangeSearchResult[];
};

type ClientPrototypeWithGrandExchangeSearch = {
    drawGrandExchangeItemSearchChatbox(this: GrandExchangeSearchRuntimeClient): void;
};

// The live GE search list is drawn directly in the webclient chatbox rather
// than through IF1 text widgets. Keep the existing hovered-row background and
// also switch the hovered item name to white so the clickable result is clear.
const grandExchangeSearchPrototype = Client.prototype as unknown as ClientPrototypeWithGrandExchangeSearch;
grandExchangeSearchPrototype.drawGrandExchangeItemSearchChatbox = function (
    this: GrandExchangeSearchRuntimeClient
): void {
    Pix2D.fillRect(0, 0, 479, 96, Colour.CHAT_BACKGROUND);
    this.b12?.drawStringCenter('Grand Exchange Item Search', 239, 12, 0x000000);
    this.p12?.drawString(`Search: ${this.socialInput}*`, 8, 27, 0x000000);

    const results = this.getGrandExchangeItemSearchResults(8);
    const hoverX = this.mouseX - 17;
    const hoverY = this.mouseY - 357;
    const startY = 35;
    const rowHeight = 12;

    if (results.length === 0) {
        this.p11?.drawString('No matching tradeable items.', 48, 53, 0x7e3200);
    } else {
        for (let index = 0; index < results.length; index++) {
            const item = results[index]!;
            const y = startY + index * rowHeight;
            const hovered = hoverX >= 47 && hoverX <= 463 && hoverY >= y && hoverY < y + rowHeight;
            if (hovered) {
                Pix2D.fillRect(47, y, 416, rowHeight, 0xb4a783);
            }
            this.p12?.drawString(item.name, 48, y + 12, hovered ? 0xffffff : 0x7e3200);
        }
    }

    this.p11?.drawString('Type to search, then click an item.', 8, 94, 0x000000);
};

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
