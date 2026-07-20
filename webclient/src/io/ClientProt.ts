export const enum ClientProt {
    NO_TIMEOUT = 239, // index: 6 - NXT naming

    IDLE_TIMER = 144, // index: 30
    EVENT_MOUSE_CLICK = 234, // index: 31
    EVENT_MOUSE_MOVE = 232, // index: 32
    EVENT_APPLET_FOCUS = 8, // index: 33
    EVENT_TRACKING = 142, // index: 34
    EVENT_CAMERA_POSITION = 91, // index: 35

    ANTICHEAT_OPLOGIC1 = 28, // index: 60
    ANTICHEAT_OPLOGIC2 = 77, // index: 61
    ANTICHEAT_OPLOGIC3 = 56, // index: 62
    ANTICHEAT_OPLOGIC4 = 121, // index: 63
    ANTICHEAT_OPLOGIC5 = 233, // index: 64
    ANTICHEAT_OPLOGIC6 = 131, // index: 65
    ANTICHEAT_OPLOGIC7 = 187, // index: 66
    ANTICHEAT_OPLOGIC8 = 206, // index: 67
    ANTICHEAT_OPLOGIC9 = 162, // index: 68

    ANTICHEAT_CYCLELOGIC1 = 51, // index: 70
    ANTICHEAT_CYCLELOGIC2 = 225, // index: 71
    ANTICHEAT_CYCLELOGIC3 = 4, // index: 72
    ANTICHEAT_CYCLELOGIC4 = 226, // index: 73
    ANTICHEAT_CYCLELOGIC5 = 100, // index: 74
    ANTICHEAT_CYCLELOGIC6 = 36, // index: 75
    ANTICHEAT_CYCLELOGIC7 = 182, // index: 76

    OPOBJ1 = 141, // index: 80 - NXT naming
    OPOBJ2 = 67, // index: 81 - NXT naming
    OPOBJ3 = 178, // index: 82 - NXT naming
    OPOBJ4 = 47, // index: 83 - NXT naming
    OPOBJ5 = 97, // index: 84 - NXT naming
    OPOBJT = 202, // index: 88 - NXT naming
    OPOBJU = 245, // index: 89 - NXT naming

    OPNPC1 = 143, // index: 100 - NXT naming
    OPNPC2 = 195, // index: 101 - NXT naming
    OPNPC3 = 69, // index: 102 - NXT naming
    OPNPC4 = 122, // index: 103 - NXT naming
    OPNPC5 = 118, // index: 104 - NXT naming
    OPNPCT = 231, // index: 108 - NXT naming
    OPNPCU = 119, // index: 109 - NXT naming

    OPLOC1 = 33, // index: 120 - NXT naming
    OPLOC2 = 213, // index: 121 - NXT naming
    OPLOC3 = 98, // index: 122 - NXT naming
    OPLOC4 = 87, // index: 123 - NXT naming
    OPLOC5 = 147, // index: 124 - NXT naming
    OPLOCT = 26, // index: 128 - NXT naming
    OPLOCU = 240, // index: 129 - NXT naming

    OPPLAYER1 = 192, // index: 140 - NXT naming
    OPPLAYER2 = 17, // index: 141 - NXT naming
    OPPLAYER3 = 18, // index: 142 - NXT naming
    OPPLAYER4 = 72, // index: 143 - NXT naming
    OPPLAYER5 = 230, // index: 144 - NXT naming
    OPPLAYERT = 68, // index: 148 - NXT naming
    OPPLAYERU = 113, // index: 149 - NXT naming

    OPHELD1 = 243, // index: 160 - name based on runescript trigger
    OPHELD2 = 228, // index: 161 - name based on runescript trigger
    OPHELD3 = 80, // index: 162 - name based on runescript trigger
    OPHELD4 = 163, // index: 163 - name based on runescript trigger
    OPHELD5 = 74, // index: 164 - name based on runescript trigger
    OPHELDT = 102, // index: 168 - name based on runescript trigger
    OPHELDU = 200, // index: 169 - name based on runescript trigger

    INV_BUTTON1 = 181, // index: 190 - NXT has "IF_BUTTON1" but for our interface system, this makes more sense
    INV_BUTTON2 = 70, // index: 191 - NXT has "IF_BUTTON2" but for our interface system, this makes more sense
    INV_BUTTON3 = 59, // index: 192 - NXT has "IF_BUTTON3" but for our interface system, this makes more sense
    INV_BUTTON4 = 160, // index: 193 - NXT has "IF_BUTTON4" but for our interface system, this makes more sense
    INV_BUTTON5 = 62, // index: 194 - NXT has "IF_BUTTON5" but for our interface system, this makes more sense

    IF_BUTTON = 244, // index: 200 - NXT naming
    RESUME_PAUSEBUTTON = 146, // index: 201 - NXT naming
    CLOSE_MODAL = 58, // index: 202 - NXT naming
    RESUME_P_COUNTDIALOG = 161, // index: 203 - NXT naming
    RESUME_P_NAMEDIALOG = 10, // custom: name input dialog
    TUT_CLICKSIDE = 201, // index: 204

    MAP_BUILD_COMPLETE = 134, // index: 241 - NXT naming
    MOVE_OPCLICK = 127, // index: 242 - comes with OP packets, name based on other MOVE packets
    SEND_SNAPSHOT = 203, // index: 243 - NXT naming
    MOVE_MINIMAPCLICK = 220, // index: 244 - NXT naming
    INV_BUTTOND = 176, // index: 245 - NXT has "IF_BUTTOND" but for our interface system, this makes more sense
    IGNORELIST_DEL = 193, // index: 246 - NXT naming
    IGNORELIST_ADD = 189, // index: 247 - NXT naming
    IDK_SAVEDESIGN = 13, // index: 248 - based on function name
    CHAT_SETMODE = 129, // index: 249 - NXT naming
    MESSAGE_PRIVATE = 214, // index: 250 - NXT naming
    FRIENDLIST_DEL = 84, // index: 251 - NXT naming
    FRIENDLIST_ADD = 9, // index: 252 - NXT naming
    CLIENT_CHEAT = 86, // index: 253 - NXT naming
    MESSAGE_PUBLIC = 83, // index: 254 - NXT naming
    MOVE_GAMECLICK = 6, // index: 255 - NXT naming
};
