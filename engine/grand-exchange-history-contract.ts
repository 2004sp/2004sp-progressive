export type GrandExchangeHistoryOfferType = 'buy' | 'sell';
export type GrandExchangeHistoryStatus = 'pending' | 'partial' | 'completed' | 'cancelled';

export type GrandExchangeHistoryEntry = Readonly<{
    /**
     * Native r254 object ID. Group 643 must never import or render an r481 item definition.
     */
    nativeItemId: number;
    /**
     * Display name resolved from the native r254 object definition by the server-side GE layer.
     */
    itemName: string;
    offerType: GrandExchangeHistoryOfferType;
    status: GrandExchangeHistoryStatus;
    quantity: number;
    /**
     * Offer price per item in gp. Formatting is deliberately server-owned so the IF1 client only receives text.
     */
    priceEachGp: number;
    timestampText: string;
}>;

export type GrandExchangeHistoryRowBinding = Readonly<{
    row: number;
    offerTypeComponentId: number;
    quantityComponentId: number;
    itemNameComponentId: number;
    priceComponentId: number;
    separatorComponentId: number;
    itemModelHelperComponentId: number;
    statusHelperComponentId: number;
    timestampHelperComponentId: number;
}>;

/**
 * Stable local-client rendering contract for the five source history rows.
 *
 * Source components 25-50 are the frozen r481 fields/separators. Helpers 51-65
 * stay inside group 643's reserved 256-ID block and expose IF1 targets for
 * native-r254 item models plus status/timestamp text that r481 populated
 * dynamically through IF3/client-script state.
 */
export const GRAND_EXCHANGE_HISTORY_ROWS: readonly GrandExchangeHistoryRowBinding[] = Object.freeze(
    Array.from({ length: 5 }, (_, row) =>
        Object.freeze({
            row,
            offerTypeComponentId: 25 + row,
            quantityComponentId: 30 + row,
            itemNameComponentId: 35 + row,
            priceComponentId: 40 + row,
            separatorComponentId: 45 + row,
            itemModelHelperComponentId: 51 + row,
            statusHelperComponentId: 56 + row,
            timestampHelperComponentId: 61 + row,
        })
    )
);

/**
 * Deterministic display-only fixture for [debugproc,ge643test].
 * These IDs are native r254 objects (lobster 379, rune longsword 1303);
 * no r481 item configs/models are introduced by this contract.
 */
export const GRAND_EXCHANGE_HISTORY_PLACEHOLDER_ENTRIES: readonly GrandExchangeHistoryEntry[] = Object.freeze([
    Object.freeze({
        nativeItemId: 379,
        itemName: 'Lobster',
        offerType: 'buy',
        status: 'completed',
        quantity: 25,
        priceEachGp: 120,
        timestampText: '12 Dec 12:00',
    }),
    Object.freeze({
        nativeItemId: 1303,
        itemName: 'Rune longsword',
        offerType: 'sell',
        status: 'partial',
        quantity: 1,
        priceEachGp: 32000,
        timestampText: '12 Dec 11:45',
    }),
    Object.freeze({
        nativeItemId: 379,
        itemName: 'Lobster',
        offerType: 'buy',
        status: 'cancelled',
        quantity: 100,
        priceEachGp: 110,
        timestampText: '12 Dec 11:20',
    }),
    Object.freeze({
        nativeItemId: 1303,
        itemName: 'Rune longsword',
        offerType: 'sell',
        status: 'completed',
        quantity: 2,
        priceEachGp: 31500,
        timestampText: '12 Dec 10:55',
    }),
    Object.freeze({
        nativeItemId: 379,
        itemName: 'Lobster',
        offerType: 'buy',
        status: 'pending',
        quantity: 50,
        priceEachGp: 125,
        timestampText: '12 Dec 10:30',
    }),
]);
