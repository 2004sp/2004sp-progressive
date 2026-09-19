import ObjType from '#/cache/config/ObjType.js';
import {
    
    
    interactIF_UseOp, interactIfButton,
    interactPlayerOp, viableItemIds
} from '#/engine/bot/BotAction.js';
import { findClosest, Interfaces, Items } from '#/engine/bot/BotKnowledge.js';
import {
    BotTask,
    Player,
    walkTo,
    isNear,
    Locations,
    randInt,
    StuckDetector,
    ProgressWatchdog,
    InvType,
    bankInvId,
    openNearbyGate,
    advanceBankWalk,
    teleportNear
} from '#/engine/bot/tasks/BotTaskBase.js';
import World from '#/engine/World.js';

const removeWithOps = (
    player: Player,
    interfaceId: number,
    itemId: number,
    slot: number,
    amount: number
) => {
    const ops = [
        { size: 10, op: 3 },
        { size: 5,  op: 2 },
        { size: 1,  op: 1 },
    ];

    for (const { size, op } of ops) {
        const times = Math.floor(amount / size);
        if (times > 0) {
            for (let i = 0; i < times; i++) {
                interactIF_UseOp(player, interfaceId, itemId, slot, op, 90);
            }
            amount -= times * size;
        }
    }
};

export class BankstandTask extends BotTask {
    private state: 'walk'
        | 'move'
        | 'bank_walk'
        | 'bank'
        | 'idle'
        | 'trade_init'
        | 'trade_stage1'
        | 'trade_stage2'
        | 'trade_finalize' = 'walk';

    private duration:number;
    private readonly stuck = new StuckDetector(10, 2, 1);
    private readonly watchdog = new ProgressWatchdog();
    private hasBanked: boolean = false;
    private currentOfferSlot: number = 0;
    private stock: Map<number, { count: number; price: number }> = new Map();
    private requestedItem: number = -1;
    private requestedItemCount: number = 0;
    private requestedItemPrice: number = 0;
    private requestedTotalPrice: number = 0;
    private requestedAll: boolean = false;

    constructor() {
        super('Bankstand');
        this.duration = 3000; //3,000 * 0.6 = 1,800 seconds = 30 minutes
    }

    private getItemPrice(itemId: number): number {
        let price = 0;
        switch(itemId) {
            //Logs->
            case Items.LOGS: //+1 for certed versions too
            case (Items.LOGS + 1):
                price = 150;
                break;
            case Items.OAK_LOGS:
            case (Items.OAK_LOGS + 1):
                price = 50;
                break;
            case Items.WILLOW_LOGS:
            case (Items.WILLOW_LOGS + 1):
                price = 50;
                break;
            case Items.MAPLE_LOGS:
            case (Items.MAPLE_LOGS + 1):
                price = 175;
                break;
            case Items.YEW_LOGS:
            case (Items.YEW_LOGS + 1):
                price = 400;
                break;
            case Items.MAGIC_LOGS:
            case (Items.MAGIC_LOGS + 1):
                price = 1100;
                break;
            //Ores->
            case Items.COPPER_ORE:
            case (Items.COPPER_ORE + 1):
            case Items.TIN_ORE:
            case (Items.TIN_ORE + 1):
                price = 50;
                break;
            case Items.IRON_ORE:
            case (Items.IRON_ORE + 1):
                price = 350;
                break;
            case Items.COAL:
            case (Items.COAL + 1):
                price = 650;
                break;
            case Items.MITHRIL_ORE:
            case (Items.MITHRIL_ORE + 1):
                price = 500;
                break;
            case Items.ADAMANTITE_ORE:
            case (Items.ADAMANTITE_ORE + 1):
                price = 800;
                break;
            case Items.RUNITE_ORE:
            case (Items.RUNITE_ORE + 1):
                price = 8000;
                break;
            //Bars->
            case Items.BRONZE_BAR:
            case (Items.BRONZE_BAR + 1):
                price = 250;
                break;
            case Items.IRON_BAR:
            case (Items.IRON_BAR + 1):
                price = 400;
                break;
            case Items.STEEL_BAR:
            case (Items.STEEL_BAR + 1):
                price = 1500;
                break;
            case Items.SILVER_BAR:
            case (Items.SILVER_BAR + 1):
                price = 100;
                break;
            case Items.GOLD_BAR:
            case (Items.GOLD_BAR + 1):
                price = 350;
                break;
            case Items.MITHRIL_BAR:
            case (Items.MITHRIL_BAR + 1):
                price = 2000;
                break;
            case Items.ADAMANTITE_BAR:
            case (Items.ADAMANTITE_BAR + 1):
                price = 4000;
                break;
            case Items.RUNITE_BAR:
            case (Items.RUNITE_BAR + 1):
                price = 10000;
                break;
            //Gems->
            case Items.UNCUT_OPAL:
            case (Items.UNCUT_OPAL + 1):
                price = 40;
                break;
            case Items.UNCUT_JADE:
            case (Items.UNCUT_JADE + 1):
                price = 80;
                break;
            case Items.UNCUT_RED_TOPAZ:
            case (Items.UNCUT_RED_TOPAZ + 1):
                price = 200;
                break;
            case Items.UNCUT_SAPPHIRE:
            case (Items.UNCUT_SAPPHIRE + 1):
                price = 1200;
                break;
            case Items.UNCUT_EMERALD:
            case (Items.UNCUT_EMERALD + 1):
                price = 3400;
                break;
            case Items.UNCUT_RUBY:
            case (Items.UNCUT_RUBY + 1):
                price = 4000;
                break;
            case Items.UNCUT_DIAMOND:
            case (Items.UNCUT_DIAMOND + 1):
                price = 5000;
                break;
            case Items.UNCUT_DRAGONSTONE:
            case (Items.UNCUT_DRAGONSTONE + 1):
                price = 25000;
                break;
            case Items.DRAGONSTONE:
            case (Items.DRAGONSTONE + 1):
                price = 40000;
                break;
            //Bones->
            case Items.BONES:
            case (Items.BONES + 1):
                price = 10;
                break;
            case Items.BIG_BONES:
            case (Items.BIG_BONES + 1):
                price = 300;
                break;
            case Items.BAT_BONES:
            case (Items.BAT_BONES + 1):
                price = 10;
                break;
            case Items.BABYDRAGON_BONES:
            case (Items.BABYDRAGON_BONES + 1):
                price = 450;
                break;
            case Items.DRAGON_BONES:
            case (Items.DRAGON_BONES + 1):
                price = 2000;
                break;
            //Raw fish->
            case Items.RAW_SHRIMP:
            case (Items.RAW_SHRIMP + 1):
            case Items.RAW_ANCHOVIES:
            case (Items.RAW_ANCHOVIES + 1):
                price = 10;
                break;
            case Items.RAW_SARDINE:
            case (Items.RAW_SARDINE + 1):
                price = 15;
                break;
            case Items.RAW_TROUT:
            case (Items.RAW_TROUT + 1):
                price = 20;
                break;
            case Items.RAW_COD:
            case (Items.RAW_COD + 1):
                price = 20;
                break;
            case Items.RAW_SALMON:
            case (Items.RAW_SALMON + 1):
                price = 30;
                break;
            case Items.RAW_HERRING:
            case (Items.RAW_HERRING + 1):
            case Items.RAW_PIKE:
            case (Items.RAW_PIKE + 1):
            case Items.RAW_MACKEREL:
            case (Items.RAW_MACKEREL + 1):
                price = 10;
                break;
            case Items.RAW_TUNA:
            case (Items.RAW_TUNA + 1):
                price = 100;
                break;
            case Items.RAW_BASS:
            case (Items.RAW_BASS + 1):
                price = 100;
                break;
            case Items.RAW_LOBSTER:
            case (Items.RAW_LOBSTER + 1):
                price = 200;
                break;
            case Items.RAW_SWORDFISH:
            case (Items.RAW_SWORDFISH + 1):
                price = 300;
                break;
            case Items.RAW_SHARK:
            case (Items.RAW_SHARK + 1):
                price = 800;
                break;
            case Items.RAW_SEA_TURTLE:
            case (Items.RAW_SEA_TURTLE + 1):
                price = 1200;
                break;
            case Items.RAW_MANTA_RAY:
            case (Items.RAW_MANTA_RAY + 1):
                price = 1500;
                break;
            //Misc->
            case Items.BRONZE_ARROWHEADS:
                price = 1;
                break;
            case Items.IRON_ARROWHEADS:
                price = 2;
                break;
            case Items.STEEL_ARROWHEADS:
                price = 3;
                break;
            case Items.MITHRIL_ARROWHEADS:
                price = 55;
                break;
            case Items.ADAMANT_ARROWHEADS:
                price = 100;
                break;
            case Items.RUNE_ARROWHEADS:
                price = 200;
                break;
            case Items.EYE_OF_NEWT:
            case (Items.EYE_OF_NEWT + 1):
                price = 150;
                break;
            case Items.RED_SPIDERS_EGGS:
            case (Items.RED_SPIDERS_EGGS + 1):
                price = 200;
                break;
            case Items.LIMPWURT_ROOT:
            case (Items.LIMPWURT_ROOT + 1):
                price = 500;
                break;
            case Items.SNAPE_GRASS:
            case (Items.SNAPE_GRASS + 1):
                price = 900;
                break;
            case Items.VIAL_EMPTY:
            case (Items.VIAL_EMPTY + 1):
                price = 50;
                break;
            case Items.VIAL_OF_WATER:
            case (Items.VIAL_OF_WATER + 1):
                price = 300;
                break;
            case Items.SEAWEED:
            case (Items.SEAWEED + 1):
                price = 400;
                break;
            case Items.FEATHER:
                price = 20;
                break;
            case Items.CLAY:
            case (Items.CLAY + 1):
                price = 2;
                break;
            default:
                price = 1;
                break;
        }
        return price + randInt(1, 150); //Random fluctuation between sellers prices
    }

    private calculateTotalPrice(itemId: number, count: number): number {
        const data = this.stock.get(itemId);
        if (!data) return 0;
        return data.price * count;
    }

    private hasIncomingTrade(player: Player): boolean {
        return player.botTradeTargetPid !== -1;
    }

    shouldRun(): boolean {
        return true;
    }

    private getItemSlot(player: Player, itemId: number): number | null {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return null;

        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item && item.id === itemId) return i;
        }

        return null;
    }

    private getItemFromSlot(player: Player, slot: number): number {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return -1;

        const item = inv.get(slot);
        if (item) {return item.id;}

        return -1;
    }

    /**
     * Used for different invs slots
     * @param player
     * @param slot
     * @param invId
     * @private
     */
    private getItemFromSlotInv(player: Player, slot: number, invId: number) {
        const inv = player.getInventory(invId);
        if (!inv) return null;

        const item = inv.get(slot);
        if (item) {return item;}

        return null;
    }

    // ───────────────── MAIN LOOP ─────────────────

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank';

        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.interrupt();
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        if (this.duration > 0) {
            this.duration--;
        } else {
            //Find new event internally
            this.reset();
            return;
        }

        if (this.hasIncomingTrade(player) && !this.isTradeState()) {
            this.state = 'trade_init';
        }

        switch (this.state) {
            case 'walk': return this.handleWalk(player);
            case 'move': return this.handleMove(player);
            case 'idle': return this.handleIdle(player);
            case 'bank_walk': return this.handleBankWalk(player);
            case 'bank': return this.handleBank(player);

            case 'trade_init': return this.handleTradeInit(player);
            case 'trade_stage1': return this.handleTradeStage1(player);
            case 'trade_stage2': return this.handleTradeStage2(player);
            case 'trade_finalize': return this.handleTradeFinalize(player);
        }
    }

    private isTradeState(): boolean {
        return this.state.startsWith('trade_');
    }

    private getTradeTarget(player: Player): Player | null {
        if (player.botTradeTargetPid === -1) return null;
        const otherPlayer = World.getPlayerByUid(player.botTradeTargetPid);
        if(otherPlayer) {
            if(player.inOperableDistance(otherPlayer)) { //Maybe needs more
                return otherPlayer;
            }
        }
        return null;
    }

    private handleTradeInit(player: Player): void {
        const target = this.getTradeTarget(player);

        if (!target) {
            this.resetTrade(player, 'Invalid target');
            return;
        }

        player.say(`Oh hi ${target.displayName}, do you need anything? - please wait...`);
        interactPlayerOp(player, target.slot, 4);
        this.watchdog.notifyActivity();
        player.botTradeTargetStage = 0;
        this.state = 'trade_stage1';
        this.cooldown = randInt(4, 6);
    }

private intentCooldown = 0;
 
      private handleTradeStage1(player: Player): void {
        const target = this.getTradeTarget(player);
        if (!target) return this.resetTrade(player, 'Target lost');

        switch (player.botTradeTargetStage) {
            case 0: {
                // Waiting for items
                // Bot offers player all their items
                for(let i = 29; i > this.currentOfferSlot; this.currentOfferSlot++) { //This can be done in one action.
                    const itemId = this.getItemFromSlot(player, this.currentOfferSlot);
                    if (itemId != -1) {
                        interactIF_UseOp(player, Interfaces.TRADE_SIDE_INV, itemId, this.currentOfferSlot, 4);
                    }
                    if (this.currentOfferSlot > 27) {
                        player.botTradeTargetStage = 1;
                        this.currentOfferSlot = 0; //always reset
                        break;
                    }
                }
                break;
            }

            case 1:
                if(randInt(0, 2) === 0) {
                    player.say('Any?');
                } else {
                    if(randInt(0, 2) === 0) {
                        player.say('Want any?');
                    } else {
                        player.say('Anything?');
                    }
                }
                player.botTradeTargetStage = 2;
                this.state = 'trade_stage2';
                break;
        }
        this.cooldown = randInt(2, 4);
    }

    private handleTradeStage2(player: Player): void {
        const target = this.getTradeTarget(player);
        if (!target) return this.resetTrade(player, 'Target lost');

        switch (player.botTradeTargetStage) {
            case 2:
                if (player.botTradeTargetChatMessage != '') {
                    const msg = player.botTradeTargetChatMessage.toLowerCase();
                    if (msg.includes('all') || msg.includes('everything')) {
                        let total = 0;

                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        for (const [itemId, data] of this.stock.entries()) {
                            total += data.price * data.count;
                        }

                        player.say(`Everything will cost ${total}gp.`);
                        this.requestedAll = true;
                        this.requestedTotalPrice = total;

                        player.botTradeTargetChatMessage = '';
                        player.botTradeTargetStage = 3;
                        return;
                    } else if (msg.match('no') || msg.includes('nothing') || msg.includes('no thank') || msg.includes('no ty')) {
                        player.say('Np');
                        interactIfButton(player, 3422);
                        this.resetTrade(player);
                        return;
                    }
                    for (const [itemId, data] of this.stock.entries()) {
                        const itemName = ObjType.get(itemId).name?.toLowerCase().replaceAll('_', ' ');
                        if (!itemName) continue;

                        if (msg.includes(itemName)) {
                            const total = data.price * data.count;

                            player.say(`${ObjType.get(itemId).name} costs ${data.price}gp each, ${total}gp for all.`);

                            this.requestedItem = itemId;
                            this.requestedItemPrice = data.price;
                            this.requestedItemCount = data.count;
                            this.requestedTotalPrice = total;

                            player.botTradeTargetChatMessage = '';
                            player.botTradeTargetStage = 3;
                            return;
                        }
                    }
                    player.say("I don't have that item right now.");
                    player.botTradeTargetChatMessage = '';
                }
                break;
            case 3:
                if (player.botTradeTargetChatMessage != '') {
                    const msg = player.botTradeTargetChatMessage.toLowerCase();

                    if (msg.includes('yes')) {
                        player.say('Put up your coins.');
                        player.botTradeTargetStage = 4;
                    } else {
                        player.say('No problem, anything else?');
                        player.botTradeTargetStage = 1;
                        this.state = 'trade_stage1';
                    }

                    player.botTradeTargetChatMessage = '';
                } else {
                    if (this.requestedAll) {
                        player.say(`Do you want to buy everything for ${this.requestedTotalPrice}gp? (Yes/No)`);
                    } else {
                        player.say(`Do you want any ${ObjType.get(this.requestedItem).name} for ${this.requestedItemPrice}gp ea? Or ${this.requestedTotalPrice} for all`);
                    }
                }
                this.cooldown = randInt(10, 20);
                return;

            case 4: { //Siphon through all of the items leaving the requested
                const itemId = this.getItemFromSlotInv(player, this.currentOfferSlot, 90);
                if(!this.requestedAll) {
                    if (itemId) {
                        if ((itemId.id != this.requestedItem) && ((itemId.id - 1) != this.requestedItem)) {
                            //console.log(itemId.id + '(' + itemId.count + ') != ' + this.requestedItem + ' removing...');
                            interactIF_UseOp(player, Interfaces.TRADE_MAIN_INV, itemId.id, this.currentOfferSlot, 4, 90);
                        } else {
                            this.requestedItemCount = itemId.count;
                        }
                    }
                    this.currentOfferSlot++;
                    if (this.currentOfferSlot > 27) {
                        player.botTradeTargetStage = 5;
                        this.currentOfferSlot = 0; //always reset
                    }
                } else {
                    player.botTradeTargetStage = 5;//skip
                }
                return;
            }

   case 5: {
                player.say('Checking coins...');

                const target = this.getTradeTarget(player);
                if (target) {
                    for (let i = 0; i < 28; i++) {
                        const item = this.getItemFromSlotInv(target, i, 90);

                        if (item && item.id === 995) {
                            const gp = item.count;

                            let maxAffordable = 0;

                            if (this.requestedAll) {
                                if (gp >= this.requestedTotalPrice) {
                                    interactIfButton(player, 3420);
                                    this.state = 'trade_finalize';
                                    return;
                                } else {
                                    player.say('Not enough gp for everything...');
                                    this.cooldown = randInt(2, 4);
                                    return;
                                }
                            } else {
                                maxAffordable = Math.floor(gp / this.requestedItemPrice);

                                if (maxAffordable <= 0) {
                                    player.say('You need more gp.');
                                    this.cooldown = randInt(2, 4);
                                    return;
                                }
                                const newAmount = Math.min(maxAffordable, this.requestedItemCount);
                                const removalAmount = this.requestedItemCount - newAmount;
                                for(let i = 28; i > this.currentOfferSlot; this.currentOfferSlot++) {
                                    const itemId = this.getItemFromSlotInv(player, this.currentOfferSlot, 90);
                                    if (itemId) {
                                        if ((itemId.id == this.requestedItem) || ((itemId.id - 1) == this.requestedItem)) {
                                            removeWithOps(
                                                player,
                                                Interfaces.TRADE_MAIN_INV,
                                                itemId.id,
                                                this.currentOfferSlot,
                                                removalAmount
                                            );
                                            break;
                                        }
                                    }
                                }
                                this.requestedItemCount = newAmount;
                                player.say(`I can sell you ${newAmount} of them.`);

                                interactIfButton(player, 3420);
                                this.cooldown = randInt(4, 6);//<- add this
                                this.state = 'trade_finalize';
                                return;
                            }
                        }
                    }
                }
                break;
            }
        }

        this.cooldown = randInt(6, 10);
    }

    private handleTradeFinalize(player: Player): void {
        const target = this.getTradeTarget(player);
        let scamDetected = false;
        const expectedPrice = this.requestedAll
            ? this.requestedTotalPrice
            : (this.requestedItemCount * this.requestedItemPrice);

        let totalGpOffered = 0;

        if (target) {
            for (let i = 0; i < 28; i++) {
                const item = this.getItemFromSlotInv(target, i, 90);
                if (!item) continue;

                if (item.id === 995) {
                    totalGpOffered += item.count; //We can only have 1 stack of coins
                    break;
                }
            }

            if (totalGpOffered >= expectedPrice) {
                interactIfButton(player, 3546); // accept
            } else {
                interactIfButton(player, 3548); // decline
                scamDetected = true;
            }
        }

        if (!scamDetected) {
            if(Math.random() < 0.5) {
                player.say('Pleasure doing business.');
            } else {
                player.say('Ty');
            }
        } else {
            if(Math.random() < 0.5) {
                player.say(`You offered ${totalGpOffered}, I needed ${expectedPrice}.`);
            } else {
                player.say('Scammer!');
            }
        }
        //This should only reset when the trade has fully completed
        this.resetTrade(player);
        this.cooldown = randInt(30, 40); //Make it have a bigger delay
    }

    private handleMove(player: Player): void {
        const [lx, lz] = Locations.FIRE_VARROCK_ROAD;
        if(Math.random() < 0.2) {
            walkTo(
                player,
                lx + randInt(-4, 4),
                lz + randInt(-4, 4)
            );
        }
        if(!this.hasBanked) {
            this.state = 'bank_walk';
        } else {
            this.state = 'idle';
        }
        this.cooldown = randInt(4, 6);
    }

    private formatGp(amount: number): string {
        if (amount >= 1_000_000) {
            return `${Math.floor(amount / 1_000_000)}m`;
        }
        if (amount >= 10_000) {
            return `${Math.floor(amount / 1_000)}k`;
        }
        return `${amount}`;
    }

    private getTotalStockValue(): number {
        let total = 0;

        for (const [, data] of this.stock.entries()) {
            total += data.price * data.count;
        }

        return total;
    }

    private handleIdle(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;
        if (this.hasBanked) {
            player.closeModal();
            player.delayed = false;

            let saidSomething = false;

            if (this.stock.size === 0) {
                const rand = Math.random();

                if (Math.random() < 0.3) {
                    if (rand < 0.1) {
                        player.say('Just vibin here');
                    } else if (rand < 0.2) {
                        player.say('Dont even kno why im here');
                    } else if (rand < 0.3) {
                        player.say('Bankstanding lvls?');
                    } else if (rand < 0.4) {
                        player.say('This is exactly where I need to be');
                    } else if (rand < 0.5) {
                        player.say('Keep tryna find stuf but cant');
                    } else if (rand < 0.6) {
                        player.say('Zoned tf out');
                    } else if (rand < 0.7) {
                        player.say('I always do this');
                    } else if (rand < 0.8) {
                        player.say('Wher are my logss');
                    } else if (rand < 0.9) {
                        player.say('I think ive been hacked');
                    } else {
                        player.say('Guys, I just tried to do something very silly!');
                    }
                    saidSomething = true;
                }
            } else {
                const allItems = Array.from(this.stock.entries());
                const shuffled = allItems.sort(() => Math.random() - 0.5);

                const entries = shuffled.slice(0, 2).map(([id, data]) => {
                    const name = ObjType.get(id).name;
                    return (Math.random() < 0.5)
                        ? `${name} (${data.count}) - ${data.price}gp ea`
                        : `${name} (${data.count}) - ${data.price} ea`;
                });

                const totalValue = this.getTotalStockValue();
                const formattedTotal = this.formatGp(totalValue);

                const roll = Math.random();

                if (roll < 0.25) {
                    player.say(`Bank sale ${formattedTotal} - ${player.displayName}`);
                    saidSomething = true;

                } else if (roll < 0.5) {
                    player.say(`Selling: ${entries.join(', ')} - ${player.displayName}`);
                    saidSomething = true;

                } else {
                    player.say(`${entries.join(', ')} | All ${formattedTotal} - ${player.displayName}`);
                    saidSomething = true;
                }
            }

            if (saidSomething) {
                this.watchdog.notifyActivity();
            }
        }

        this.state = 'move';
        this.cooldown = randInt(8, 12);
    }

    private handleBankWalk(player: Player): void {
        const closest = Locations.VARROCK_WEST_BANK;
        if (!closest) return;

        const [bx, bz] = closest;

        if (!isNear(player, bx, bz, 4)) {
            this._stuckWalk(player, bx, bz);
            return;
        }

        

        if(!this.hasBanked) {
            this.state = 'bank';
        } else {
            this.state = 'walk';
        }
        this.cooldown = randInt(4, 6);

    }

    private handleBank(player: Player): void {
        const bank = player.getInventory(bankInvId());
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return;
        const result = advanceBankWalk(player, this.stuck);

        if (result === 'walk') {

            return;
        } else {
            this.stock.clear();
            player.say('Interacting with bank...');
            const inv = player.getInventory(InvType.INV);
            if (inv) {
                for (let i = 0; i < inv.capacity; i++) {
                    const item = inv.get(i);
                    if (item) {
                        this.depositItemToBank(player, item.id, item.count);
                    }
                }
            }
            //set withdraw as noted via button
            interactIfButton(player, 5386);
            this.withdrawViableItems(player);
            this.hasBanked = true;
        }
        //Close bank option
        interactIfButton(player, 5384);
        this.state = 'walk';
        this.cooldown = randInt(4, 6);
    }

    /**
     * deposits to bank and removes the item from inventory
     * @param player
     * @param itemId
     * @param count
     * @private
     */
    private depositItemToBank(player: Player, itemId: number, count: number): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;

        const bank = player.getInventory(bid);
        if (!bank) return;

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if(item.id == itemId) {
                const moved = inv.remove(item.id, count);
                if (moved.completed > 0) {
                    bank.add(item.id, moved.completed);
                    console.log('Banked item: ' + item.id + ' x ' + item.count);
                    break;
                }
            }
        }
    }

    /**
     * Withdraws viable materials, from a list, from the bot's bank
     * Using inferface option 4 (Withdraw all)
     * @param player
     * @private
     */
    private withdrawViableItems(player: Player): void {
        const inv = player.getInventory(bankInvId());
        if(inv) {
            const viableItemId = new Set(viableItemIds);
            for (let slot = 0; slot < inv.capacity; slot++) {
                const item = inv.get(slot);
                if (!item) continue;
                if (viableItemId.has(item.id)) {
                    //we withdraw
                    console.log('Attempting to withdraw item: ' + item.id + ' from slot: ' + slot);
                    const amount = item.count;
                    if(interactIF_UseOp(player, Interfaces.BANK_MAIN_INV, item.id, slot, 4, 95)) {
                        console.log('(' + player.displayName + ') successfully withdrawn item: ' + item.id + ' x ' + amount);
                        const existing = this.stock.get(item.id);
                        const price = this.getItemPrice(item.id);

                        if (existing) {
                            existing.count += amount;
                        } else {
                            this.stock.set(item.id, {
                                count: amount,
                                price: price
                            });
                        }
                    } else {
                        console.log('Could not withdraw item! ('+ item.id +') for (' + player.displayName + ')');
                    }
                }
            }
        }
    }

    private resetTrade(player: Player, reason?: string): void {
        if (reason) {
            console.log('[Trade] Reset:', reason);
        }
        //Reset everything
        player.botTradeTargetPid = -1;
        player.botTradeTargetStage = -1;
        player.botTradeTargetChatName = '';
        player.botTradeTargetChatMessage = '';
        this.requestedAll = false;
        this.requestedItem = 0;
        this.requestedItemCount = 0;
        this.requestedTotalPrice = 0;
        this.requestedItemPrice = 0;
        this.hasBanked = false;
        this.stock.clear();
        this.state = 'bank_walk';
    }

    private handleWalk(player: Player): void {
        // If the bot is far from Varrock (e.g. spawned in Lumbridge or Karamja),
        // teleport directly to the bank area instead of walking the whole map.
        const [bx, bz] = Locations.VARROCK_WEST_BANK;
        if (Math.abs(player.x - bx) > 50 || Math.abs(player.z - bz) > 50) {
            teleportNear(player, bx, bz);
            this.cooldown = randInt(2, 4);
            return;
        }

        const closest = findClosest(player, [
            Locations.VARROCK_WEST_BANK,
            Locations.FIRE_VARROCK_ROAD
        ]);

        if (!closest) return;

        const [lx, lz] = closest;

        if (!isNear(player, lx, lz, 2)) {
            walkTo(player, lx + randInt(-1, 1), lz + randInt(-1, 1));
            return;
        }

       

        this.state = 'idle';
        this.cooldown = randInt(4, 6);
    }

    // ───────────────── RESET ─────────────────

    private resetLoop(): void {
        this.state = 'walk';
        this.cooldown = 0;
        this.stuck.reset();
        this.watchdog.reset();
    }

    override reset(): void {
        super.reset();
        this.resetLoop();
    }

    // ───────────────── STUCK HANDLER ─────────────────

   private _stuckWalk(player: Player, lx: number, lz: number): void {
        if (!this.stuck.check(player, lx, lz)) {
            walkTo(player, lx, lz);
            return;
        }

        if (this.stuck.desperatelyStuck) {
            teleportNear(player, lx, lz);
            this.stuck.reset();
            return;
        }

        if (openNearbyGate(player, 30)) {
            this.intentCooldown = 3;
            return;
        }

        walkTo(player, player.x + randInt(-10, 10), player.z + randInt(-10, 10));
    }

    isComplete(): boolean {
        return false;
    }
}
