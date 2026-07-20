export default class ClientGameProt {
    static byId: ClientGameProt[] = [];

    static readonly NO_TIMEOUT = new ClientGameProt(239, 0); // NXT naming

    static readonly IDLE_TIMER = new ClientGameProt(144, 0);
    static readonly EVENT_MOUSE_CLICK = new ClientGameProt(234, 4);
    static readonly EVENT_MOUSE_MOVE = new ClientGameProt(232, -1);
    static readonly EVENT_APPLET_FOCUS = new ClientGameProt(8, 1);
    static readonly EVENT_TRACKING = new ClientGameProt(142, -2);
    static readonly EVENT_CAMERA_POSITION = new ClientGameProt(91, 4);

    static readonly ANTICHEAT_OPLOGIC1 = new ClientGameProt(28, 4);
    static readonly ANTICHEAT_OPLOGIC2 = new ClientGameProt(77, 2);
    static readonly ANTICHEAT_OPLOGIC3 = new ClientGameProt(56, 4);
    static readonly ANTICHEAT_OPLOGIC4 = new ClientGameProt(121, 1);
    static readonly ANTICHEAT_OPLOGIC5 = new ClientGameProt(233, 1);
    static readonly ANTICHEAT_OPLOGIC6 = new ClientGameProt(131, 2);
    static readonly ANTICHEAT_OPLOGIC7 = new ClientGameProt(187, 4);
    static readonly ANTICHEAT_OPLOGIC8 = new ClientGameProt(206, 1);
    static readonly ANTICHEAT_OPLOGIC9 = new ClientGameProt(162, 3);

    static readonly ANTICHEAT_CYCLELOGIC1 = new ClientGameProt(51, -1);
    static readonly ANTICHEAT_CYCLELOGIC2 = new ClientGameProt(225, -1);
    static readonly ANTICHEAT_CYCLELOGIC3 = new ClientGameProt(4, 1);
    static readonly ANTICHEAT_CYCLELOGIC4 = new ClientGameProt(226, 1);
    static readonly ANTICHEAT_CYCLELOGIC5 = new ClientGameProt(100, 0);
    static readonly ANTICHEAT_CYCLELOGIC6 = new ClientGameProt(36, 1);
    static readonly ANTICHEAT_CYCLELOGIC7 = new ClientGameProt(182, 0);

    static readonly OPOBJ1 = new ClientGameProt(141, 6); // NXT naming
    static readonly OPOBJ2 = new ClientGameProt(67, 6); // NXT naming
    static readonly OPOBJ3 = new ClientGameProt(178, 6); // NXT naming
    static readonly OPOBJ4 = new ClientGameProt(47, 6); // NXT naming
    static readonly OPOBJ5 = new ClientGameProt(97, 6); // NXT naming
    static readonly OPOBJT = new ClientGameProt(202, 8); // NXT naming
    static readonly OPOBJU = new ClientGameProt(245, 12); // NXT naming

    static readonly OPNPC1 = new ClientGameProt(143, 2); // NXT naming
    static readonly OPNPC2 = new ClientGameProt(195, 2); // NXT naming
    static readonly OPNPC3 = new ClientGameProt(69, 2); // NXT naming
    static readonly OPNPC4 = new ClientGameProt(122, 2); // NXT naming
    static readonly OPNPC5 = new ClientGameProt(118, 2); // NXT naming
    static readonly OPNPCT = new ClientGameProt(231, 4); // NXT naming
    static readonly OPNPCU = new ClientGameProt(119, 8); // NXT naming

    static readonly OPLOC1 = new ClientGameProt(33, 6); // NXT naming
    static readonly OPLOC2 = new ClientGameProt(213, 6); // NXT naming
    static readonly OPLOC3 = new ClientGameProt(98, 6); // NXT naming
    static readonly OPLOC4 = new ClientGameProt(87, 6); // NXT naming
    static readonly OPLOC5 = new ClientGameProt(147, 6); // NXT naming
    static readonly OPLOCT = new ClientGameProt(26, 8); // NXT naming
    static readonly OPLOCU = new ClientGameProt(240, 12); // NXT naming

    static readonly OPPLAYER1 = new ClientGameProt(192, 2); // NXT naming
    static readonly OPPLAYER2 = new ClientGameProt(17, 2); // NXT naming
    static readonly OPPLAYER3 = new ClientGameProt(18, 2); // NXT naming
    static readonly OPPLAYER4 = new ClientGameProt(72, 2); // NXT naming
    static readonly OPPLAYER5 = new ClientGameProt(230, 2); // NXT naming
    static readonly OPPLAYERT = new ClientGameProt(68, 4); // NXT naming
    static readonly OPPLAYERU = new ClientGameProt(113, 8); // NXT naming

    static readonly OPHELD1 = new ClientGameProt(243, 6); // name based on runescript trigger
    static readonly OPHELD2 = new ClientGameProt(228, 6); // name based on runescript trigger
    static readonly OPHELD3 = new ClientGameProt(80, 6); // name based on runescript trigger
    static readonly OPHELD4 = new ClientGameProt(163, 6); // name based on runescript trigger
    static readonly OPHELD5 = new ClientGameProt(74, 6); // name based on runescript trigger
    static readonly OPHELDT = new ClientGameProt(102, 8); // name based on runescript trigger
    static readonly OPHELDU = new ClientGameProt(200, 12); // name based on runescript trigger

    static readonly INV_BUTTON1 = new ClientGameProt(181, 6); // NXT has "IF_BUTTON1" but for our interface system, this makes more sense
    static readonly INV_BUTTON2 = new ClientGameProt(70, 6); // NXT has "IF_BUTTON2" but for our interface system, this makes more sense
    static readonly INV_BUTTON3 = new ClientGameProt(59, 6); // NXT has "IF_BUTTON3" but for our interface system, this makes more sense
    static readonly INV_BUTTON4 = new ClientGameProt(160, 6); // NXT has "IF_BUTTON4" but for our interface system, this makes more sense
    static readonly INV_BUTTON5 = new ClientGameProt(62, 6); // NXT has "IF_BUTTON5" but for our interface system, this makes more sense

    static readonly IF_BUTTON = new ClientGameProt(244, 2); // NXT naming
    static readonly RESUME_PAUSEBUTTON = new ClientGameProt(146, 2); // NXT naming
    static readonly CLOSE_MODAL = new ClientGameProt(58, 0); // NXT naming
    static readonly RESUME_P_COUNTDIALOG = new ClientGameProt(161, 4); // NXT naming
    static readonly RESUME_P_NAMEDIALOG = new ClientGameProt(10, -1); // custom: name input dialog
    static readonly TUT_CLICKSIDE = new ClientGameProt(201, 1);

    static readonly MAP_BUILD_COMPLETE = new ClientGameProt(134, 0); // NXT naming
    static readonly MOVE_OPCLICK = new ClientGameProt(127, -1); // comes with OP packets, name based on other MOVE packets
    static readonly REPORT_ABUSE = new ClientGameProt(203, 10);
    static readonly MOVE_MINIMAPCLICK = new ClientGameProt(220, -1); // NXT naming
    static readonly INV_BUTTOND = new ClientGameProt(176, 7); // NXT has "IF_BUTTOND" but for our interface system, this makes more sense
    static readonly IGNORELIST_DEL = new ClientGameProt(193, 8); // NXT naming
    static readonly IGNORELIST_ADD = new ClientGameProt(189, 8); // NXT naming
    static readonly IDK_SAVEDESIGN = new ClientGameProt(13, 13);
    static readonly CHAT_SETMODE = new ClientGameProt(129, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ClientGameProt(214, -1); // NXT naming
    static readonly FRIENDLIST_DEL = new ClientGameProt(84, 8); // NXT naming
    static readonly FRIENDLIST_ADD = new ClientGameProt(9, 8); // NXT naming
    static readonly CLIENT_CHEAT = new ClientGameProt(86, -1); // NXT naming
    static readonly MESSAGE_PUBLIC = new ClientGameProt(83, -1); // NXT naming
    static readonly MOVE_GAMECLICK = new ClientGameProt(6, -1); // NXT naming

    constructor(
        readonly id: number,
        readonly length: number
    ) {
        ClientGameProt.byId[id] = this;
    }
}
