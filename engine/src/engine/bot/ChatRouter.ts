import { BotLLM } from './BotLLM.js';

export class ChatRouter {
    static async route(
        playerMessage: string,
        fallback:      string,
        history:       ReadonlyArray<{ user: string; bot: string }> = [],
        playerName?:   string,
        timeoutMs      = 3000,
    ): Promise<string> {
        return BotLLM.generate(playerMessage, fallback, timeoutMs, history, playerName);
    }
}
