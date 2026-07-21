class ClientGameProtCategory {
    static readonly USER_EVENT = new ClientGameProtCategory(10);
    static readonly CLIENT_EVENT = new ClientGameProtCategory(60);
    static readonly RESTRICTED_EVENT = new ClientGameProtCategory(5);

    constructor(readonly limit: number) {}
}

export default ClientGameProtCategory;
