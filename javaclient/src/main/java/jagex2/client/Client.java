package jagex2.client;

import deob.ObfuscatedName;
import jagex2.config.*;
import jagex2.dash3d.*;
import jagex2.datastruct.JString;
import jagex2.datastruct.LinkList;
import jagex2.graphics.*;
import jagex2.io.*;
import jagex2.sound.Wave;
import jagex2.wordenc.WordFilter;
import jagex2.wordenc.WordPack;
import sign.signlink;

import java.awt.*;
import java.io.DataInputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.net.InetAddress;
import java.net.Socket;
import java.net.URL;
import java.util.zip.CRC32;

@ObfuscatedName("client")
public class Client extends GameShell {

	@ObfuscatedName("client.ab")
	public int activeMapFunctionCount;

	@ObfuscatedName("client.bb")
	public int[] activeMapFunctionX = new int[1000];

	@ObfuscatedName("client.cb")
	public int[] activeMapFunctionZ = new int[1000];

	@ObfuscatedName("client.eb")
	public int[] varps = new int[2000];

	@ObfuscatedName("client.hb")
	public int menuArea;

	@ObfuscatedName("client.ib")
	public int menuX;

	@ObfuscatedName("client.jb")
	public int menuY;

	@ObfuscatedName("client.kb")
	public int menuWidth;

	@ObfuscatedName("client.lb")
	public int menuHeight;

	@ObfuscatedName("client.mb")
	public ClientNpc[] npcs = new ClientNpc[16384];

	@ObfuscatedName("client.nb")
	public int npcCount;

	@ObfuscatedName("client.ob")
	public int[] npcIds = new int[16384];

	@ObfuscatedName("client.pb")
	public int selectedCycle;

	@ObfuscatedName("client.qb")
	public int selectedInterface;

	@ObfuscatedName("client.rb")
	public int selectedItem;

	@ObfuscatedName("client.sb")
	public int selectedArea;

	@ObfuscatedName("client.tb")
	public Pix8 imageRedstone1v;

	@ObfuscatedName("client.ub")
	public Pix8 imageRedstone2v;

	@ObfuscatedName("client.vb")
	public Pix8 imageRedstone3v;

	@ObfuscatedName("client.wb")
	public Pix8 imageRedstone1hv;

	@ObfuscatedName("client.xb")
	public Pix8 imageRedstone2hv;

	@ObfuscatedName("client.yb")
	public static ClientPlayer localPlayer;

	@ObfuscatedName("client.zb")
	public FileStream[] fileStreams = new FileStream[5];

	@ObfuscatedName("client.bc")
	public Packet login = Packet.alloc(1);

	@ObfuscatedName("client.cc")
	public int[] cameraModifierJitter = new int[5];

	@ObfuscatedName("client.dc")
	public Pix32 genderButtonImage0;

	@ObfuscatedName("client.ec")
	public Pix32 genderButtonImage1;

	@ObfuscatedName("client.fc")
	public int[] flameBuffer0;

	@ObfuscatedName("client.gc")
	public int[] flameBuffer1;

	@ObfuscatedName("client.hc")
	public int cameraX;

	@ObfuscatedName("client.ic")
	public int cameraY;

	@ObfuscatedName("client.jc")
	public int cameraZ;

	@ObfuscatedName("client.kc")
	public int cameraPitch;

	@ObfuscatedName("client.lc")
	public int cameraYaw;

	@ObfuscatedName("client.mc")
	public static final int[] recol2d = new int[] { 9104, 10275, 7595, 3610, 7975, 8526, 918, 38802, 24466, 10145, 58654, 5027, 1457, 16565, 34991, 25486 };

	@ObfuscatedName("client.nc")
	public int macroCameraZ;

	@ObfuscatedName("client.oc")
	public int macroCameraZModifier = 2;

	@ObfuscatedName("client.pc")
	public long lastWaveStartTime;

	@ObfuscatedName("client.qc")
	public boolean withinTutorialIsland = false;

	@ObfuscatedName("client.rc")
	public int[][][] groundh;

	@ObfuscatedName("client.sc")
	public int minusedlevel;

	@ObfuscatedName("client.L")
	public int[] waveIds = new int[50];

	@ObfuscatedName("client.N")
	public boolean errorHost = false;

	@ObfuscatedName("client.T")
	public boolean redrawSidebar = false;

	@ObfuscatedName("client.V")
	public Pix32[] activeMapFunctions = new Pix32[1000];

	@ObfuscatedName("client.W")
	public int[] menuParamB = new int[500];

	@ObfuscatedName("client.X")
	public int[] menuParamC = new int[500];

	@ObfuscatedName("client.Y")
	public int[] menuAction = new int[500];

	@ObfuscatedName("client.Z")
	public int[] menuParamA = new int[500];

	@ObfuscatedName("client.Ab")
	public CollisionMap[] levelCollisionMap = new CollisionMap[4];

	@ObfuscatedName("client.Eb")
	public CRC32 crc32 = new CRC32();

	@ObfuscatedName("client.Fb")
	public boolean ingame = false;

	@ObfuscatedName("client.Kb")
	public boolean redrawPrivacySettings = false;

	@ObfuscatedName("client.Lb")
	public int[] CHAT_COLOURS = new int[] { 16776960, 16711680, 65280, 65535, 16711935, 16777215 };

	@ObfuscatedName("client.Mb")
	public int[] messageType = new int[100];

	@ObfuscatedName("client.Nb")
	public String[] messageSender = new String[100];

	@ObfuscatedName("client.Ob")
	public String[] messageText = new String[100];

	@ObfuscatedName("client.Pb")
	public int sideTab = 3;

	@ObfuscatedName("client.Rb")
	public int[] messageIds = new int[100];

	@ObfuscatedName("client.Tb")
	public int orbitCameraPitch = 128;

	@ObfuscatedName("client.Yb")
	public String[] friendName = new String[200];

	@ObfuscatedName("client.uc")
	public int macroMinimapAngleModifier = 2;

	@ObfuscatedName("client.Cc")
	public int[] flameLineOffset = new int[256];

	@ObfuscatedName("client.Ec")
	public int tutLayerId = -1;

	@ObfuscatedName("client.Hc")
	public String[] menuOption = new String[500];

	@ObfuscatedName("client.Nc")
	public int projectX = -1;

	@ObfuscatedName("client.Oc")
	public int projectY = -1;

	@ObfuscatedName("client.Uc")
	public int[] waveDelay = new int[50];

	@ObfuscatedName("client.ad")
	public int[] cameraModifierWobbleSpeed = new int[5];

	@ObfuscatedName("client.ed")
	public boolean midiActive = true;

	@ObfuscatedName("client.id")
	public Packet in = Packet.alloc(1);

	@ObfuscatedName("client.qd")
	public int[] designKits = new int[7];

	@ObfuscatedName("client.sd")
	public int MAX_CHATS = 50;

	@ObfuscatedName("client.td")
	public int[] chatX = new int[this.MAX_CHATS];

	@ObfuscatedName("client.ud")
	public int[] chatY = new int[this.MAX_CHATS];

	@ObfuscatedName("client.vd")
	public int[] chatHeight = new int[this.MAX_CHATS];

	@ObfuscatedName("client.wd")
	public int[] chatWidth = new int[this.MAX_CHATS];

	@ObfuscatedName("client.xd")
	public int[] chatColour = new int[this.MAX_CHATS];

	@ObfuscatedName("client.yd")
	public int[] chatEffect = new int[this.MAX_CHATS];

	@ObfuscatedName("client.zd")
	public int[] chatTimer = new int[this.MAX_CHATS];

	@ObfuscatedName("client.Ad")
	public String[] chatMessage = new String[this.MAX_CHATS];

	@ObfuscatedName("client.Dd")
	public int[] waveLoops = new int[50];

	@ObfuscatedName("client.Md")
	public int macroMinimapZoomModifier = 1;

	@ObfuscatedName("client.Od")
	public boolean waveEnabled = true;

	@ObfuscatedName("client.Pd")
	public boolean redrawSideicons = false;

	@ObfuscatedName("client.Qd")
	public Pix32[] imageHitmarks = new Pix32[20];

	@ObfuscatedName("client.Ud")
	public int[][] bfsCost = new int[104][104];

	@ObfuscatedName("client.Zd")
	public boolean cutscene = false;

	@ObfuscatedName("client.ge")
	public boolean flamesThread = false;

	@ObfuscatedName("client.me")
	public boolean sendCamera = false;

	@ObfuscatedName("client.ne")
	public int MAX_PLAYER_COUNT = 2048;

	@ObfuscatedName("client.oe")
	public int LOCAL_PLAYER_INDEX = 2047;

	@ObfuscatedName("client.pe")
	public ClientPlayer[] players = new ClientPlayer[this.MAX_PLAYER_COUNT];

	@ObfuscatedName("client.re")
	public int[] playerIds = new int[this.MAX_PLAYER_COUNT];

	@ObfuscatedName("client.te")
	public int[] entityUpdateIds = new int[this.MAX_PLAYER_COUNT];

	@ObfuscatedName("client.ue")
	public Packet[] playerAppearanceBuffer = new Packet[this.MAX_PLAYER_COUNT];

	@ObfuscatedName("client.ve")
	public boolean menuVisible = false;

	@ObfuscatedName("client.we")
	public boolean objGrabThreshold = false;

	@ObfuscatedName("client.Ge")
	public boolean flameThread = false;

	@ObfuscatedName("client.He")
	public int[][] bfsDirection = new int[104][104];

	@ObfuscatedName("client.Je")
	public boolean awaitingSync = false;

	@ObfuscatedName("client.Re")
	public LinkList[][][] objStacks = new LinkList[4][104][104];

	@ObfuscatedName("client.Ve")
	public boolean errorStarted = false;

	@ObfuscatedName("client.We")
	public int lastWaveId = -1;

	@ObfuscatedName("client.Xe")
	public int[] cameraModifierCycle = new int[5];

	@ObfuscatedName("client.cf")
	public String loginMes1 = "";

	@ObfuscatedName("client.df")
	public String loginMes2 = "";

	@ObfuscatedName("client.ef")
	public int[] statEffectiveLevel = new int[Stats.COUNT];

	@ObfuscatedName("client.ff")
	public boolean pressedContinueOption = false;

	@ObfuscatedName("client.jf")
	public LinkList spotanims = new LinkList();

	@ObfuscatedName("client.kf")
	public int[] compassMaskLineLengths = new int[33];

	@ObfuscatedName("client.mf")
	public String loginUser = "";

	@ObfuscatedName("client.nf")
	public String loginPass = "";

	@ObfuscatedName("client.yf")
	public boolean updateDesignModel = false;

	@ObfuscatedName("client.Af")
	public int lastWaveLoops = -1;

	@ObfuscatedName("client.Ef")
	public String reportAbuseInput = "";

	@ObfuscatedName("client.Gf")
	public int macroCameraAngleModifier = 1;

	@ObfuscatedName("client.If")
	public boolean redrawFrame = false;

	@ObfuscatedName("client.Lf")
	public LinkList projectiles = new LinkList();

	@ObfuscatedName("client.Of")
	public int[] entityRemovalIds = new int[1000];

	@ObfuscatedName("client.Pf")
	public int SCROLLBAR_TRACK = 2301979;

	@ObfuscatedName("client.Rf")
	public int SCROLLBAR_GRIP_LOWLIGHT = 3353893;

	@ObfuscatedName("client.Uf")
	public Pix8[] imageSideicons = new Pix8[13];

	@ObfuscatedName("client.bg")
	public int[] statBaseLevel = new int[Stats.COUNT];

	@ObfuscatedName("client.cg")
	public int[] tabInterfaceId = new int[] { -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 };

	@ObfuscatedName("client.hg")
	public Pix8[] imageMapscene = new Pix8[50];

	@ObfuscatedName("client.ug")
	public IfType chatInterface = new IfType();

	@ObfuscatedName("client.Cg")
	public boolean designGender = true;

	@ObfuscatedName("client.Fg")
	public int[] varCache = new int[2000];

	@ObfuscatedName("client.Kg")
	public int[] minimapMaskLineOffsets = new int[151];

	@ObfuscatedName("client.Lg")
	public final int[] LOC_SHAPE_TO_LAYER = new int[] { 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3 };

	@ObfuscatedName("client.Qg")
	public boolean errorLoading = false;

	@ObfuscatedName("client.Rg")
	public int chatScrollHeight = 78;

	@ObfuscatedName("client.Vg")
	public int SCROLLBAR_GRIP_HIGHLIGHT = 7759444;

	@ObfuscatedName("client.Wg")
	public int[] designColours = new int[5];

	@ObfuscatedName("client.Xg")
	public long[] ignoreName37 = new long[100];

	@ObfuscatedName("client.ch")
	public int[] cameraModifierWobbleScale = new int[5];

	@ObfuscatedName("client.dh")
	public long[] friendName37 = new long[200];

	@ObfuscatedName("client.fh")
	public int mainLayerId = -1;

	@ObfuscatedName("client.kh")
	public boolean redrawChatback = false;

	@ObfuscatedName("client.lh")
	public int[] bfsStepX = new int[4000];

	@ObfuscatedName("client.mh")
	public int[] bfsStepZ = new int[4000];

	@ObfuscatedName("client.yh")
	public int localPid = -1;

	@ObfuscatedName("client.zh")
	public Packet out = Packet.alloc(1);

	@ObfuscatedName("client.Jh")
	public int[] friendWorld = new int[200];

	@ObfuscatedName("client.Lh")
	public String chatTyped = "";

	@ObfuscatedName("client.Nh")
	public int macroCameraXModifier = 2;

	@ObfuscatedName("client.Oh")
	public int chatLayerId = -1;

	@ObfuscatedName("client.Ph")
	public Pix32[] imageHeadicons = new Pix32[20];

	@ObfuscatedName("client.ei")
	public int mainOverlayLayerId = -1;

	@ObfuscatedName("client.fi")
	public int[] statXP = new int[Stats.COUNT];

	@ObfuscatedName("client.gi")
	public String socialMessage = "";

	@ObfuscatedName("client.oi")
	public String chatbackInput = "";

	@ObfuscatedName("client.pi")
	public int SCROLLBAR_GRIP_FOREGROUND = 5063219;

	@ObfuscatedName("client.qi")
	public int[][] tileLastOccupiedCycle = new int[104][104];

	@ObfuscatedName("client.si")
	public String socialInput = "";

	@ObfuscatedName("client.yi")
	public int sideLayerId = -1;

	@ObfuscatedName("client.zi")
	public int[] compassMaskLineOffsets = new int[33];

	@ObfuscatedName("client.Ci")
	public int nextMidiSong = -1;

	@ObfuscatedName("client.Ei")
	public Pix32[] imageMapfunction = new Pix32[50];

	@ObfuscatedName("client.Ji")
	public String[] playerOptions = new String[5];

	@ObfuscatedName("client.Ki")
	public boolean[] playerOptionsPushDown = new boolean[5];

	@ObfuscatedName("client.Pi")
	public boolean showSocialInput = false;

	@ObfuscatedName("client.Qi")
	public boolean focused = true;

	@ObfuscatedName("client.Vi")
	public boolean midiFading = false;

	@ObfuscatedName("client.Zi")
	public boolean chatbackInputOpen = false;

	@ObfuscatedName("client.aj")
	public Pix32[] imageCross = new Pix32[8];

	@ObfuscatedName("client.bj")
	public boolean reportAbuseMuteOption = false;

	@ObfuscatedName("client.cj")
	public boolean scrollGrabbed = false;

	@ObfuscatedName("client.fj")
	public boolean flameActive = false;

	@ObfuscatedName("client.ij")
	public Pix8[] imageModIcons = new Pix8[2];

	@ObfuscatedName("client.kj")
	public int flashingTab = -1;

	@ObfuscatedName("client.lj")
	public int reportAbuseInterfaceId = -1;

	@ObfuscatedName("client.mj")
	public byte[] textureBuffer = new byte[16384];

	@ObfuscatedName("client.oj")
	public LinkList locChanges = new LinkList();

	@ObfuscatedName("client.pj")
	public int[] jagChecksum = new int[9];

	@ObfuscatedName("client.qj")
	public int minimapLevel = -1;

	@ObfuscatedName("client.Aj")
	public int[] minimapMaskLineLengths = new int[151];

	@ObfuscatedName("client.Bj")
	public boolean[] cameraModifierEnabled = new boolean[5];

	@ObfuscatedName("client.Gb")
	public static int nodeId = 10;

	@ObfuscatedName("client.Ib")
	public static boolean membersWorld = true;

	@ObfuscatedName("client.Zb")
	public static String CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!\"£$%^&*()-_=+[{]};:'@#~,<.>/?\\| ";

	@ObfuscatedName("client.uf")
	public static BigInteger LOGIN_RSAN = new BigInteger("7162900525229798032761816791230527296329313291232324290237849263501208207972894053929065636522363163621000728841182238772712427862772219676577293600221789");

	@ObfuscatedName("client.fg")
	public static int[] BITMASK = new int[32];

	@ObfuscatedName("client.ig")
	public static int[] levelExperience;

	@ObfuscatedName("client.Pg")
	public static BigInteger LOGIN_RSAE = new BigInteger("58778699976184461502525193738213253649000149147835990136706041084440742975821");

	@ObfuscatedName("client.uh")
	public static final int[][] recol1d = new int[][] { { 6798, 107, 10283, 16, 4797, 7744, 5799, 4634, 33697, 22433, 2983, 54193 }, { 8741, 12, 64030, 43162, 7735, 8404, 1701, 38430, 24094, 10153, 56621, 4783, 1341, 16578, 35003, 25239 }, { 25238, 8742, 12, 64030, 43162, 7735, 8404, 1701, 38430, 24094, 10153, 56621, 4783, 1341, 16578, 35003 }, { 4626, 11146, 6439, 12, 4758, 10270 }, { 4550, 4537, 5681, 5673, 5790, 6806, 8076, 4574 } };

	@ObfuscatedName("client.O")
	public int objSelected;

	@ObfuscatedName("client.P")
	public int objSelectedSlot;

	@ObfuscatedName("client.Q")
	public int objSelectedInterface;

	@ObfuscatedName("client.R")
	public int objInterface;

	@ObfuscatedName("client.U")
	public int lastProgressPercent;

	@ObfuscatedName("client.Bb")
	public int hintNpc;

	@ObfuscatedName("client.Cb")
	public static int oplogic7;

	@ObfuscatedName("client.Hb")
	public static int portOffset;

	@ObfuscatedName("client.Sb")
	public int objDragCycles;

	@ObfuscatedName("client.Ub")
	public int orbitCameraYaw;

	@ObfuscatedName("client.Vb")
	public int orbitCameraYawVelocity;

	@ObfuscatedName("client.Wb")
	public int orbitCameraPitchVelocity;

	@ObfuscatedName("client.Xb")
	public static int oplogic10;

	@ObfuscatedName("client.tc")
	public int macroMinimapAngle;

	@ObfuscatedName("client.zc")
	public static int oplogic2;

	@ObfuscatedName("client.Ac")
	public static int field1285;

	@ObfuscatedName("client.Fc")
	public int scrollInputPadding;

	@ObfuscatedName("client.Gc")
	public int tryMoveNearest;

	@ObfuscatedName("client.Ic")
	public int macroCameraCycle;

	@ObfuscatedName("client.Jc")
	public static int field1294;

	@ObfuscatedName("client.Qc")
	public int flagSceneTileX;

	@ObfuscatedName("client.Rc")
	public int flagSceneTileZ;

	@ObfuscatedName("client.Tc")
	public int lastAddress;

	@ObfuscatedName("client.Vc")
	public int cutsceneSrcLocalTileX;

	@ObfuscatedName("client.Wc")
	public int cutsceneSrcLocalTileZ;

	@ObfuscatedName("client.Xc")
	public int cutsceneSrcHeight;

	@ObfuscatedName("client.Yc")
	public int cutsceneMoveSpeed;

	@ObfuscatedName("client.Zc")
	public int cutsceneMoveAcceleration;

	@ObfuscatedName("client.cd")
	public int daysSinceLogin;

	@ObfuscatedName("client.dd")
	public int menuSize;

	@ObfuscatedName("client.gd")
	public int sceneState;

	@ObfuscatedName("client.jd")
	public int sceneCycle;

	@ObfuscatedName("client.ld")
	public int waveCount;

	@ObfuscatedName("client.nd")
	public int unreadMessageCount;

	@ObfuscatedName("client.pd")
	public int runenergy;

	@ObfuscatedName("client.rd")
	public int chatCount;

	@ObfuscatedName("client.Bd")
	public static int oplogic5;

	@ObfuscatedName("client.Cd")
	public static int field1339;

	@ObfuscatedName("client.Fd")
	public int splitPrivateChat;

	@ObfuscatedName("client.Gd")
	public int chatScrollOffset;

	@ObfuscatedName("client.Ld")
	public int macroMinimapZoom;

	@ObfuscatedName("client.Nd")
	public int inMultizone;

	@ObfuscatedName("client.Rd")
	public static int field1354;

	@ObfuscatedName("client.Vd")
	public int flameGradientCycle0;

	@ObfuscatedName("client.Wd")
	public int flameGradientCycle1;

	@ObfuscatedName("client.Yd")
	public int dragCycles;

	@ObfuscatedName("client.ae")
	public int flameCycle;

	@ObfuscatedName("client.be")
	public int objDragInterfaceId;

	@ObfuscatedName("client.ce")
	public int objDragSlot;

	@ObfuscatedName("client.de")
	public int objDragArea;

	@ObfuscatedName("client.ee")
	public int objGrabX;

	@ObfuscatedName("client.fe")
	public int objGrabY;

	@ObfuscatedName("client.je")
	public int orbitCameraX;

	@ObfuscatedName("client.ke")
	public int orbitCameraZ;

	@ObfuscatedName("client.le")
	public int sendCameraDelay;

	@ObfuscatedName("client.qe")
	public int playerCount;

	@ObfuscatedName("client.se")
	public int entityUpdateCount;

	@ObfuscatedName("client.xe")
	public int chatEffects;

	@ObfuscatedName("client.ye")
	public int spellSelected;

	@ObfuscatedName("client.ze")
	public int activeSpellId;

	@ObfuscatedName("client.Ae")
	public int activeSpellFlags;

	@ObfuscatedName("client.Fe")
	public int cameraPitchClamp;

	@ObfuscatedName("client.Pe")
	public int runweight;

	@ObfuscatedName("client.Te")
	public static int oplogic1;

	@ObfuscatedName("client.Ue")
	public static int oplogic6;

	@ObfuscatedName("client.Ze")
	public int flameCycle0;

	@ObfuscatedName("client.hf")
	public int loginSelect;

	@ObfuscatedName("client.of")
	public int psize;

	@ObfuscatedName("client.pf")
	public int ptype;

	@ObfuscatedName("client.qf")
	public int packetCycle;

	@ObfuscatedName("client.rf")
	public int noTimeoutCycle;

	@ObfuscatedName("client.sf")
	public int pendingLogout;

	@ObfuscatedName("client.xf")
	public int hintPlayer;

	@ObfuscatedName("client.Ff")
	public int macroCameraAngle;

	@ObfuscatedName("client.Hf")
	public int macroMinimapCycle;

	@ObfuscatedName("client.Kf")
	public int worldLocationState;

	@ObfuscatedName("client.Mf")
	public int systemUpdateTimer;

	@ObfuscatedName("client.Nf")
	public int entityRemovalCount;

	@ObfuscatedName("client.Qf")
	public int lastOverLayerId;

	@ObfuscatedName("client.Sf")
	public int hintType;

	@ObfuscatedName("client.Wf")
	public int mouseTrackedX;

	@ObfuscatedName("client.Xf")
	public int mouseTrackedY;

	@ObfuscatedName("client.Yf")
	public int sceneDelta;

	@ObfuscatedName("client.eg")
	public static int drawCycle;

	@ObfuscatedName("client.jg")
	public int hintTileX;

	@ObfuscatedName("client.kg")
	public int hintTileZ;

	@ObfuscatedName("client.lg")
	public int hintHeight;

	@ObfuscatedName("client.mg")
	public int hintOffsetX;

	@ObfuscatedName("client.ng")
	public int hintOffsetZ;

	@ObfuscatedName("client.og")
	public int sceneCenterZoneX;

	@ObfuscatedName("client.pg")
	public int sceneCenterZoneZ;

	@ObfuscatedName("client.vg")
	public int sceneBaseTileX;

	@ObfuscatedName("client.wg")
	public int sceneBaseTileZ;

	@ObfuscatedName("client.xg")
	public int mapLastBaseX;

	@ObfuscatedName("client.yg")
	public int mapLastBaseZ;

	@ObfuscatedName("client.Ag")
	public int membersAccount;

	@ObfuscatedName("client.Bg")
	public int loginscreen;

	@ObfuscatedName("client.Dg")
	public int oneMouseButton;

	@ObfuscatedName("client.Eg")
	public static int oplogic3;

	@ObfuscatedName("client.Gg")
	public int crossX;

	@ObfuscatedName("client.Hg")
	public int crossY;

	@ObfuscatedName("client.Ig")
	public int crossCycle;

	@ObfuscatedName("client.Jg")
	public int crossMode;

	@ObfuscatedName("client.Sg")
	public int staffmodlevel;

	@ObfuscatedName("client.Tg")
	public static int field1511;

	@ObfuscatedName("client.eh")
	public int bankArrangeMode;

	@ObfuscatedName("client.gh")
	public int hoveredSlot;

	@ObfuscatedName("client.hh")
	public int hoveredSlotInterfaceId;

	@ObfuscatedName("client.ih")
	public int warnMembersInNonMembers;

	@ObfuscatedName("client.vh")
	public int ptype0;

	@ObfuscatedName("client.wh")
	public int ptype1;

	@ObfuscatedName("client.xh")
	public int ptype2;

	@ObfuscatedName("client.Kh")
	public int chatTradeMode;

	@ObfuscatedName("client.Mh")
	public int macroCameraX;

	@ObfuscatedName("client.Zh")
	public int nextMusicDelay;

	@ObfuscatedName("client.hi")
	public int cutsceneDstLocalTileX;

	@ObfuscatedName("client.ii")
	public int cutsceneDstLocalTileZ;

	@ObfuscatedName("client.ji")
	public int cutsceneDstHeight;

	@ObfuscatedName("client.ki")
	public int cutsceneRotateSpeed;

	@ObfuscatedName("client.li")
	public int cutsceneRotateAcceleration;

	@ObfuscatedName("client.mi")
	public int overMainLayerId;

	@ObfuscatedName("client.ni")
	public int chatPublicMode;

	@ObfuscatedName("client.ri")
	public static int field1587;

	@ObfuscatedName("client.ti")
	public int mouseTrackedDelta;

	@ObfuscatedName("client.vi")
	public static int loopCycle;

	@ObfuscatedName("client.Ai")
	public static int field1596;

	@ObfuscatedName("client.Bi")
	public static int oplogic8;

	@ObfuscatedName("client.Fi")
	public int privateMessageCount;

	@ObfuscatedName("client.Gi")
	public int lastWaveLength;

	@ObfuscatedName("client.Hi")
	public int baseX;

	@ObfuscatedName("client.Ii")
	public int baseZ;

	@ObfuscatedName("client.Mi")
	public int overChatLayerId;

	@ObfuscatedName("client.Ni")
	public int friendCount;

	@ObfuscatedName("client.Oi")
	public int friendListStatus;

	@ObfuscatedName("client.Ui")
	public int midiSong;

	@ObfuscatedName("client.Wi")
	public static int oplogic9;

	@ObfuscatedName("client.Xi")
	public int socialInputType;

	@ObfuscatedName("client.dj")
	public int chatPrivateMode;

	@ObfuscatedName("client.hj")
	public int overSideLayerId;

	@ObfuscatedName("client.jj")
	public int daysSinceRecoveriesChanged;

	@ObfuscatedName("client.yj")
	public int ignoreCount;

	@ObfuscatedName("client.zj")
	public static int oplogic4;

	@ObfuscatedName("client.he")
	public long prevMousePressTime;

	@ObfuscatedName("client.Ye")
	public long socialName37;

	@ObfuscatedName("client.Zg")
	public long serverSeed;

	@ObfuscatedName("client.jh")
	public long sceneLoadStartTime;

	@ObfuscatedName("client.od")
	public World world;

	@ObfuscatedName("client.Pc")
	public Pix32 imageCompass;

	@ObfuscatedName("client.Sc")
	public Pix32 imageMinimap;

	@ObfuscatedName("client.Cf")
	public Pix32 imageMapmarker0;

	@ObfuscatedName("client.Df")
	public Pix32 imageMapmarker1;

	@ObfuscatedName("client.ah")
	public Pix32 imageFlamesLeft;

	@ObfuscatedName("client.bh")
	public Pix32 imageFlamesRight;

	@ObfuscatedName("client.ai")
	public Pix32 imageMapdot0;

	@ObfuscatedName("client.bi")
	public Pix32 imageMapdot1;

	@ObfuscatedName("client.ci")
	public Pix32 imageMapdot2;

	@ObfuscatedName("client.di")
	public Pix32 imageMapdot3;

	@ObfuscatedName("client.ui")
	public Pix32 imageMapedge;

	@ObfuscatedName("client.vc")
	public Pix8 imageBackbase1;

	@ObfuscatedName("client.wc")
	public Pix8 imageBackbase2;

	@ObfuscatedName("client.xc")
	public Pix8 imageBackhmid1;

	@ObfuscatedName("client.Kc")
	public Pix8 imageInvback;

	@ObfuscatedName("client.Lc")
	public Pix8 imageMapback;

	@ObfuscatedName("client.Mc")
	public Pix8 imageChatback;

	@ObfuscatedName("client.Sd")
	public Pix8 imageScrollbar0;

	@ObfuscatedName("client.Td")
	public Pix8 imageScrollbar1;

	@ObfuscatedName("client.De")
	public Pix8 imageTitlebox;

	@ObfuscatedName("client.Ee")
	public Pix8 imageTitlebutton;

	@ObfuscatedName("client.Ke")
	public Pix8 imageRedstone1;

	@ObfuscatedName("client.Le")
	public Pix8 imageRedstone2;

	@ObfuscatedName("client.Me")
	public Pix8 imageRedstone3;

	@ObfuscatedName("client.Ne")
	public Pix8 imageRedstone1h;

	@ObfuscatedName("client.Oe")
	public Pix8 imageRedstone2h;

	@ObfuscatedName("client.Hd")
	public PixFont fontPlain11;

	@ObfuscatedName("client.Id")
	public PixFont fontPlain12;

	@ObfuscatedName("client.Jd")
	public PixFont fontBold12;

	@ObfuscatedName("client.Kd")
	public PixFont fontQuill8;

	@ObfuscatedName("client.qg")
	public PixMap areaSidebar;

	@ObfuscatedName("client.rg")
	public PixMap areaMapback;

	@ObfuscatedName("client.sg")
	public PixMap areaViewport;

	@ObfuscatedName("client.tg")
	public PixMap areaChatback;

	@ObfuscatedName("client.oh")
	public PixMap areaBackbase1;

	@ObfuscatedName("client.ph")
	public PixMap areaBackbase2;

	@ObfuscatedName("client.qh")
	public PixMap areaBackhmid1;

	@ObfuscatedName("client.Ah")
	public PixMap imageTitle2;

	@ObfuscatedName("client.Bh")
	public PixMap imageTitle3;

	@ObfuscatedName("client.Ch")
	public PixMap imageTitle4;

	@ObfuscatedName("client.Dh")
	public PixMap imageTitle0;

	@ObfuscatedName("client.Eh")
	public PixMap imageTitle1;

	@ObfuscatedName("client.Fh")
	public PixMap imageTitle5;

	@ObfuscatedName("client.Gh")
	public PixMap imageTitle6;

	@ObfuscatedName("client.Hh")
	public PixMap imageTitle7;

	@ObfuscatedName("client.Ih")
	public PixMap imageTitle8;

	@ObfuscatedName("client.Qh")
	public PixMap areaBackleft1;

	@ObfuscatedName("client.Rh")
	public PixMap areaBackleft2;

	@ObfuscatedName("client.Sh")
	public PixMap areaBackright1;

	@ObfuscatedName("client.Th")
	public PixMap areaBackright2;

	@ObfuscatedName("client.Uh")
	public PixMap areaBacktop1;

	@ObfuscatedName("client.Vh")
	public PixMap areaBackvmid1;

	@ObfuscatedName("client.Wh")
	public PixMap areaBackvmid2;

	@ObfuscatedName("client.Xh")
	public PixMap areaBackvmid3;

	@ObfuscatedName("client.Yh")
	public PixMap areaBackhmid2;

	@ObfuscatedName("client.af")
	public OnDemand onDemand;

	@ObfuscatedName("client.Vf")
	public Isaac randomIn;

	@ObfuscatedName("client.ie")
	public JagFile jagTitle;

	@ObfuscatedName("client.wj")
	public MouseTracking mouseTracking;

	@ObfuscatedName("client.Li")
	public ClientStream stream;

	@ObfuscatedName("client.S")
	public String objSelectedName;

	@ObfuscatedName("client.Be")
	public String spellCaption;

	@ObfuscatedName("client.dg")
	public String lastProgressMessage;

	@ObfuscatedName("client.nj")
	public String modalMessage;

	@ObfuscatedName("client.Jb")
	public static boolean lowMem;

	@ObfuscatedName("client.Ie")
	public static boolean mouseTracked;

	@ObfuscatedName("client.Yi")
	public static boolean alreadyStarted;

	@ObfuscatedName("client.Zf")
	public int[] flameBuffer2;

	@ObfuscatedName("client.ag")
	public int[] flameBuffer3;

	@ObfuscatedName("client.Mg")
	public int[] mapBuildIndex;

	@ObfuscatedName("client.Ng")
	public int[] mapBuildGroundFile;

	@ObfuscatedName("client.Og")
	public int[] mapBuildLocationFile;

	@ObfuscatedName("client.Ri")
	public int[] areaChatbackOffset;

	@ObfuscatedName("client.Si")
	public int[] areaSidebarOffset;

	@ObfuscatedName("client.Ti")
	public int[] areaViewportOffset;

	@ObfuscatedName("client.rj")
	public int[] flameGradient;

	@ObfuscatedName("client.sj")
	public int[] flameGradient0;

	@ObfuscatedName("client.tj")
	public int[] flameGradient1;

	@ObfuscatedName("client.uj")
	public int[] flameGradient2;

	@ObfuscatedName("client.ej")
	public Pix8[] imageRunes;

	@ObfuscatedName("client.wf")
	public byte[][] mapBuildLocationData;

	@ObfuscatedName("client.gg")
	public byte[][] mapBuildGroundData;

	@ObfuscatedName("client.Ug")
	public byte[][][] mapl;

	static {
		int var0 = 2;
		for (int var1 = 0; var1 < 32; var1++) {
			BITMASK[var1] = var0 - 1;
			var0 += var0;
		}
		levelExperience = new int[99];
		int var2 = 0;
		for (int var3 = 0; var3 < 99; var3++) {
			int var4 = var3 + 1;
			int var5 = (int) ((double) var4 + Math.pow(2.0D, (double) var4 / 7.0D) * 300.0D);
			var2 += var5;
			levelExperience[var3] = var2 / 4;
		}
	}

	// ----

	public static void main(String[] arg0) {
		try {
			System.out.println("RS2 user client - release #" + signlink.clientversion);
			if (arg0.length == 5) {
				nodeId = Integer.parseInt(arg0[0]);
				portOffset = Integer.parseInt(arg0[1]);
				if (arg0[2].equals("lowmem")) {
					setLowMem();
				} else if (arg0[2].equals("highmem")) {
					setHighMem();
				} else {
					System.out.println("Usage: node-id, port-offset, [lowmem/highmem], [free/members], storeid");
					return;
				}
				if (arg0[3].equals("free")) {
					membersWorld = false;
				} else if (arg0[3].equals("members")) {
					membersWorld = true;
				} else {
					System.out.println("Usage: node-id, port-offset, [lowmem/highmem], [free/members], storeid");
					return;
				}
				signlink.storeid = Integer.parseInt(arg0[4]);
				signlink.startpriv(InetAddress.getLocalHost());
				Client var1 = new Client();
				var1.initApplication(765, 503);
			} else {
				System.out.println("Usage: node-id, port-offset, [lowmem/highmem], [free/members], storeid");
			}
		} catch (Exception var3) {
		}
	}

	public void init() {
		nodeId = Integer.parseInt(this.getParameter("nodeid"));
		portOffset = Integer.parseInt(this.getParameter("portoff"));
		String var1 = this.getParameter("lowmem");
		if (var1 != null && var1.equals("1")) {
			setLowMem();
		} else {
			setHighMem();
		}
		String var2 = this.getParameter("free");
		if (var2 != null && var2.equals("1")) {
			membersWorld = false;
		} else {
			membersWorld = true;
		}
		this.initApplet(503, 765);
	}

	public void run() {
		if (this.flamesThread) {
			this.renderFlames();
		} else {
			super.run();
		}
	}

	@ObfuscatedName("client.n(B)V")
	public static void setLowMem() {
		World.lowMem = true;
		Pix3D.lowMem = true;
		lowMem = true;
		ClientBuild.lowMem = true;
	}

	@ObfuscatedName("client.j(B)V")
	public static void setHighMem() {
		World.lowMem = false;
		Pix3D.lowMem = false;
		lowMem = false;
		ClientBuild.lowMem = false;
	}

	// ----

	public URL getCodeBase() {
		if (signlink.mainapp != null) {
			return signlink.mainapp.getCodeBase();
		}
		try {
			if (super.frame != null) {
				return new URL("http://127.0.0.1:" + (portOffset + 80));
			}
		} catch (Exception var1) {
		}
		return super.getCodeBase();
	}

	public String getParameter(String arg0) {
		return signlink.mainapp == null ? super.getParameter(arg0) : signlink.mainapp.getParameter(arg0);
	}

	@ObfuscatedName("client.L(I)Ljava/lang/String;")
	public String getHost() {
		if (signlink.mainapp == null) {
			return super.frame == null ? super.getDocumentBase().getHost().toLowerCase() : "runescape.com";
		} else {
			return signlink.mainapp.getDocumentBase().getHost().toLowerCase();
		}
	}

	@ObfuscatedName("client.c(I)Ljava/awt/Component;")
	public java.awt.Component getBaseComponent() {
		if (signlink.mainapp != null) {
			return signlink.mainapp;
		} else {
			return this;
		}
	}

	@ObfuscatedName("client.a(Ljava/lang/String;)Ljava/io/DataInputStream;")
	public DataInputStream openUrl(String arg0) throws IOException {
		return signlink.mainapp == null ? new DataInputStream((new URL(this.getCodeBase(), arg0)).openStream()) : signlink.openurl(arg0);
	}

	@ObfuscatedName("client.h(I)Ljava/net/Socket;")
	public Socket openSocket(int arg0) throws IOException {
		return signlink.mainapp == null ? new Socket(InetAddress.getByName(this.getCodeBase().getHost()), arg0) : signlink.opensocket(arg0);
	}

	@ObfuscatedName("client.a(Ljava/lang/Runnable;I)V")
	public void startThread(Runnable arg0, int arg1) {
		if (arg1 > 10) {
			arg1 = 10;
		}
		if (signlink.mainapp == null) {
			super.startThread(arg0, arg1);
		} else {
			signlink.startthread(arg0, arg1);
		}
	}

	@ObfuscatedName("client.a(IZ[B)V")
	public void saveMidi(boolean arg1, byte[] arg2) {
		signlink.midifade = arg1 ? 1 : 0;
		signlink.midisave(arg2, arg2.length);
	}

	@ObfuscatedName("client.f(Z)V")
	public void stopMidi() {
		signlink.midifade = 0;
		signlink.midi = "stop";
	}

	@ObfuscatedName("client.a(IIZ)V")
	public void setMidiVolume(int arg1, boolean arg2) {
		signlink.midivol = arg1;
		if (arg2) {
			signlink.midi = "voladjust";
		}
	}

	@ObfuscatedName("client.a([BII)Z")
	public boolean saveWave(byte[] arg0, int arg1) {
		return arg0 == null ? true : signlink.wavesave(arg0, arg1);
	}

	@ObfuscatedName("client.c(B)Z")
	public boolean replayWave() {
		return signlink.wavereplay();
	}

	@ObfuscatedName("client.e(II)V")
	public void setWaveVolume(int arg1) {
		signlink.wavevol = arg1;
	}

	// ----

	@ObfuscatedName("client.a()V")
	public void load() {
		if (signlink.sunjava) {
			super.mindel = 5;
		}
		if (alreadyStarted) {
			this.errorStarted = true;
			return;
		}
		alreadyStarted = true;
		boolean var1 = false;
		String var2 = this.getHost();
		if (var2.endsWith("jagex.com")) {
			var1 = true;
		}
		if (var2.endsWith("runescape.com")) {
			var1 = true;
		}
		if (var2.endsWith("192.168.1.2")) {
			var1 = true;
		}
		if (var2.endsWith("192.168.1.246")) {
			var1 = true;
		}
		if (var2.endsWith("192.168.1.247")) {
			var1 = true;
		}
		if (var2.endsWith("192.168.1.249")) {
			var1 = true;
		}
		if (var2.endsWith("192.168.1.253")) {
			var1 = true;
		}
		if (var2.endsWith("192.168.1.254")) {
			var1 = true;
		}
		if (var2.endsWith("127.0.0.1")) {
			var1 = true;
		}
		if (!var1) {
			this.errorHost = true;
			return;
		}
		if (signlink.cache_dat != null) {
			for (int var3 = 0; var3 < 5; var3++) {
				this.fileStreams[var3] = new FileStream(signlink.cache_idx[var3], 500000, var3 + 1, signlink.cache_dat);
			}
		}
		try {
			int var4 = 5;
			this.jagChecksum[8] = 0;
			while (this.jagChecksum[8] == 0) {
				this.drawProgress("Connecting to web server", 20);
				try {
					DataInputStream var5 = this.openUrl("crc" + (int) (Math.random() * 9.9999999E7D));
					Packet var6 = new Packet(new byte[36]);
					var5.readFully(var6.data, 0, 36);
					for (int var7 = 0; var7 < 9; var7++) {
						this.jagChecksum[var7] = var6.g4();
					}
					var5.close();
				} catch (IOException var80) {
					for (int var8 = var4; var8 > 0; var8--) {
						this.drawProgress("Error loading - Will retry in " + var8 + " secs.", 10);
						try {
							Thread.sleep(1000L);
						} catch (Exception var75) {
						}
					}
					var4 *= 2;
					if (var4 > 60) {
						var4 = 60;
					}
				}
			}
			this.jagTitle = this.getJagFile("title screen", this.jagChecksum[1], 25, "title", 1);
			this.fontPlain11 = new PixFont("p11", this.jagTitle);
			this.fontPlain12 = new PixFont("p12", this.jagTitle);
			this.fontBold12 = new PixFont("b12", this.jagTitle);
			this.fontQuill8 = new PixFont("q8", this.jagTitle);
			this.loadTitleBackground();
			this.loadTitleImages();
			JagFile var9 = this.getJagFile("config", this.jagChecksum[2], 30, "config", 2);
			JagFile var10 = this.getJagFile("interface", this.jagChecksum[3], 35, "interface", 3);
			JagFile var11 = this.getJagFile("2d graphics", this.jagChecksum[4], 40, "media", 4);
			JagFile var12 = this.getJagFile("textures", this.jagChecksum[6], 45, "textures", 6);
			JagFile var13 = this.getJagFile("chat system", this.jagChecksum[7], 50, "wordenc", 7);
			JagFile var14 = this.getJagFile("sound effects", this.jagChecksum[8], 55, "sounds", 8);
			this.mapl = new byte[4][104][104];
			this.groundh = new int[4][105][105];
			this.world = new World(104, 104, this.groundh, 4);
			for (int var15 = 0; var15 < 4; var15++) {
				this.levelCollisionMap[var15] = new CollisionMap(104, 104);
			}
			this.imageMinimap = new Pix32(512, 512);
			JagFile var16 = this.getJagFile("update list", this.jagChecksum[5], 60, "versionlist", 5);
			this.drawProgress("Connecting to update server", 60);
			this.onDemand = new OnDemand();
			this.onDemand.unpack(var16, this);
			AnimFrame.init(this.onDemand.getAnimCount());
			Model.init(this.onDemand.getFileCount(0), this.onDemand);
			if (!lowMem) {
				this.midiSong = 0;
				this.midiFading = false;
				this.onDemand.request(2, this.midiSong);
				while (this.onDemand.remaining() > 0) {
					this.onDemandLoop();
					try {
						Thread.sleep(100L);
					} catch (Exception var74) {
					}
				}
			}
			this.drawProgress("Requesting animations", 65);
			int var17 = this.onDemand.getFileCount(1);
			for (int var18 = 0; var18 < var17; var18++) {
				this.onDemand.request(1, var18);
			}
			while (this.onDemand.remaining() > 0) {
				int var19 = var17 - this.onDemand.remaining();
				if (var19 > 0) {
					this.drawProgress("Loading animations - " + var19 * 100 / var17 + "%", 65);
				}
				this.onDemandLoop();
				try {
					Thread.sleep(100L);
				} catch (Exception var73) {
				}
			}
			this.drawProgress("Requesting models", 70);
			int var20 = this.onDemand.getFileCount(0);
			for (int var21 = 0; var21 < var20; var21++) {
				int var22 = this.onDemand.getModelFlags(var21);
				if ((var22 & 0x1) != 0) {
					this.onDemand.request(0, var21);
				}
			}
			int var23 = this.onDemand.remaining();
			while (this.onDemand.remaining() > 0) {
				int var24 = var23 - this.onDemand.remaining();
				if (var24 > 0) {
					this.drawProgress("Loading models - " + var24 * 100 / var23 + "%", 70);
				}
				this.onDemandLoop();
				try {
					Thread.sleep(100L);
				} catch (Exception var72) {
				}
			}
			if (this.fileStreams[0] != null) {
				this.drawProgress("Requesting maps", 75);
				this.onDemand.request(3, this.onDemand.getMapFile(47, 48, 0));
				this.onDemand.request(3, this.onDemand.getMapFile(47, 48, 1));
				this.onDemand.request(3, this.onDemand.getMapFile(48, 48, 0));
				this.onDemand.request(3, this.onDemand.getMapFile(48, 48, 1));
				this.onDemand.request(3, this.onDemand.getMapFile(49, 48, 0));
				this.onDemand.request(3, this.onDemand.getMapFile(49, 48, 1));
				this.onDemand.request(3, this.onDemand.getMapFile(47, 47, 0));
				this.onDemand.request(3, this.onDemand.getMapFile(47, 47, 1));
				this.onDemand.request(3, this.onDemand.getMapFile(48, 47, 0));
				this.onDemand.request(3, this.onDemand.getMapFile(48, 47, 1));
				this.onDemand.request(3, this.onDemand.getMapFile(48, 148, 0));
				this.onDemand.request(3, this.onDemand.getMapFile(48, 148, 1));
				int var25 = this.onDemand.remaining();
				while (this.onDemand.remaining() > 0) {
					int var26 = var25 - this.onDemand.remaining();
					if (var26 > 0) {
						this.drawProgress("Loading maps - " + var26 * 100 / var25 + "%", 75);
					}
					this.onDemandLoop();
					try {
						Thread.sleep(100L);
					} catch (Exception var71) {
					}
				}
			}
			int var27 = this.onDemand.getFileCount(0);
			for (int var28 = 0; var28 < var27; var28++) {
				int var29 = this.onDemand.getModelFlags(var28);
				byte var30 = 0;
				if ((var29 & 0x8) != 0) {
					var30 = 10;
				} else if ((var29 & 0x20) != 0) {
					var30 = 9;
				} else if ((var29 & 0x10) != 0) {
					var30 = 8;
				} else if ((var29 & 0x40) != 0) {
					var30 = 7;
				} else if ((var29 & 0x80) != 0) {
					var30 = 6;
				} else if ((var29 & 0x2) != 0) {
					var30 = 5;
				} else if ((var29 & 0x4) != 0) {
					var30 = 4;
				}
				if ((var29 & 0x1) != 0) {
					var30 = 3;
				}
				if (var30 != 0) {
					this.onDemand.prefetchPriority(0, var30, var28);
				}
			}
			this.onDemand.prefetchMaps(membersWorld);
			if (!lowMem) {
				int var31 = this.onDemand.getFileCount(2);
				for (int var32 = 1; var32 < var31; var32++) {
					if (this.onDemand.shouldPrefetchMidi(var32)) {
						this.onDemand.prefetchPriority(2, (byte) 1, var32);
					}
				}
			}
			this.drawProgress("Unpacking media", 80);
			this.imageInvback = new Pix8(var11, "invback", 0);
			this.imageChatback = new Pix8(var11, "chatback", 0);
			this.imageMapback = new Pix8(var11, "mapback", 0);
			this.imageBackbase1 = new Pix8(var11, "backbase1", 0);
			this.imageBackbase2 = new Pix8(var11, "backbase2", 0);
			this.imageBackhmid1 = new Pix8(var11, "backhmid1", 0);
			for (int var33 = 0; var33 < 13; var33++) {
				this.imageSideicons[var33] = new Pix8(var11, "sideicons", var33);
			}
			this.imageCompass = new Pix32(var11, "compass", 0);
			this.imageMapedge = new Pix32(var11, "mapedge", 0);
			this.imageMapedge.trim();
			try {
				for (int var34 = 0; var34 < 50; var34++) {
					this.imageMapscene[var34] = new Pix8(var11, "mapscene", var34);
				}
			} catch (Exception var79) {
			}
			try {
				for (int var35 = 0; var35 < 50; var35++) {
					this.imageMapfunction[var35] = new Pix32(var11, "mapfunction", var35);
				}
			} catch (Exception var78) {
			}
			try {
				for (int var36 = 0; var36 < 20; var36++) {
					this.imageHitmarks[var36] = new Pix32(var11, "hitmarks", var36);
				}
			} catch (Exception var77) {
			}
			try {
				for (int var37 = 0; var37 < 20; var37++) {
					this.imageHeadicons[var37] = new Pix32(var11, "headicons", var37);
				}
			} catch (Exception var76) {
			}
			this.imageMapmarker0 = new Pix32(var11, "mapmarker", 0);
			this.imageMapmarker1 = new Pix32(var11, "mapmarker", 1);
			for (int var38 = 0; var38 < 8; var38++) {
				this.imageCross[var38] = new Pix32(var11, "cross", var38);
			}
			this.imageMapdot0 = new Pix32(var11, "mapdots", 0);
			this.imageMapdot1 = new Pix32(var11, "mapdots", 1);
			this.imageMapdot2 = new Pix32(var11, "mapdots", 2);
			this.imageMapdot3 = new Pix32(var11, "mapdots", 3);
			this.imageScrollbar0 = new Pix8(var11, "scrollbar", 0);
			this.imageScrollbar1 = new Pix8(var11, "scrollbar", 1);
			this.imageRedstone1 = new Pix8(var11, "redstone1", 0);
			this.imageRedstone2 = new Pix8(var11, "redstone2", 0);
			this.imageRedstone3 = new Pix8(var11, "redstone3", 0);
			this.imageRedstone1h = new Pix8(var11, "redstone1", 0);
			this.imageRedstone1h.hflip();
			this.imageRedstone2h = new Pix8(var11, "redstone2", 0);
			this.imageRedstone2h.hflip();
			this.imageRedstone1v = new Pix8(var11, "redstone1", 0);
			this.imageRedstone1v.vflip();
			this.imageRedstone2v = new Pix8(var11, "redstone2", 0);
			this.imageRedstone2v.vflip();
			this.imageRedstone3v = new Pix8(var11, "redstone3", 0);
			this.imageRedstone3v.vflip();
			this.imageRedstone1hv = new Pix8(var11, "redstone1", 0);
			this.imageRedstone1hv.hflip();
			this.imageRedstone1hv.vflip();
			this.imageRedstone2hv = new Pix8(var11, "redstone2", 0);
			this.imageRedstone2hv.hflip();
			this.imageRedstone2hv.vflip();
			for (int var39 = 0; var39 < 2; var39++) {
				this.imageModIcons[var39] = new Pix8(var11, "mod_icons", var39);
			}
			Pix32 var40 = new Pix32(var11, "backleft1", 0);
			this.areaBackleft1 = new PixMap(this.getBaseComponent(), var40.wi, var40.hi);
			var40.quickPlotSprite(0, 0);
			Pix32 var41 = new Pix32(var11, "backleft2", 0);
			this.areaBackleft2 = new PixMap(this.getBaseComponent(), var41.wi, var41.hi);
			var41.quickPlotSprite(0, 0);
			Pix32 var42 = new Pix32(var11, "backright1", 0);
			this.areaBackright1 = new PixMap(this.getBaseComponent(), var42.wi, var42.hi);
			var42.quickPlotSprite(0, 0);
			Pix32 var43 = new Pix32(var11, "backright2", 0);
			this.areaBackright2 = new PixMap(this.getBaseComponent(), var43.wi, var43.hi);
			var43.quickPlotSprite(0, 0);
			Pix32 var44 = new Pix32(var11, "backtop1", 0);
			this.areaBacktop1 = new PixMap(this.getBaseComponent(), var44.wi, var44.hi);
			var44.quickPlotSprite(0, 0);
			Pix32 var45 = new Pix32(var11, "backvmid1", 0);
			this.areaBackvmid1 = new PixMap(this.getBaseComponent(), var45.wi, var45.hi);
			var45.quickPlotSprite(0, 0);
			Pix32 var46 = new Pix32(var11, "backvmid2", 0);
			this.areaBackvmid2 = new PixMap(this.getBaseComponent(), var46.wi, var46.hi);
			var46.quickPlotSprite(0, 0);
			Pix32 var47 = new Pix32(var11, "backvmid3", 0);
			this.areaBackvmid3 = new PixMap(this.getBaseComponent(), var47.wi, var47.hi);
			var47.quickPlotSprite(0, 0);
			Pix32 var48 = new Pix32(var11, "backhmid2", 0);
			this.areaBackhmid2 = new PixMap(this.getBaseComponent(), var48.wi, var48.hi);
			var48.quickPlotSprite(0, 0);
			int var49 = (int) (Math.random() * 21.0D) - 10;
			int var50 = (int) (Math.random() * 21.0D) - 10;
			int var51 = (int) (Math.random() * 21.0D) - 10;
			int var52 = (int) (Math.random() * 41.0D) - 20;
			for (int var53 = 0; var53 < 50; var53++) {
				if (this.imageMapfunction[var53] != null) {
					this.imageMapfunction[var53].rgbAdjust(var50 + var52, var49 + var52, var51 + var52);
				}
				if (this.imageMapscene[var53] != null) {
					this.imageMapscene[var53].rgbAdjust(var50 + var52, var49 + var52, var51 + var52);
				}
			}
			this.drawProgress("Unpacking textures", 83);
			Pix3D.unpackTextures(var12);
			Pix3D.initColourTable(0.8D);
			Pix3D.initPool(20);
			this.drawProgress("Unpacking config", 86);
			SeqType.unpack(var9);
			LocType.unpack(var9);
			FloType.unpack(var9);
			ObjType.unpack(var9);
			NpcType.unpack(var9);
			IdkType.unpack(var9);
			SpotAnimType.unpack(var9);
			VarpType.unpack(var9);
			VarBitType.unpack(var9);
			ObjType.membersWorld = membersWorld;
			if (!lowMem) {
				this.drawProgress("Unpacking sounds", 90);
				byte[] var54 = var14.read("sounds.dat", null);
				Packet var55 = new Packet(var54);
				Wave.unpack(var55);
			}
			this.drawProgress("Unpacking interfaces", 95);
			PixFont[] var56 = new PixFont[] { this.fontPlain11, this.fontPlain12, this.fontBold12, this.fontQuill8};
			IfType.unpack(var11, var56, var10);
			this.drawProgress("Preparing game engine", 100);
			for (int var57 = 0; var57 < 33; var57++) {
				int var58 = 999;
				int var59 = 0;
				for (int var60 = 0; var60 < 34; var60++) {
					if (this.imageMapback.data[var60 + var57 * this.imageMapback.wi] == 0) {
						if (var58 == 999) {
							var58 = var60;
						}
					} else if (var58 != 999) {
						var59 = var60;
						break;
					}
				}
				this.compassMaskLineOffsets[var57] = var58;
				this.compassMaskLineLengths[var57] = var59 - var58;
			}
			for (int var61 = 5; var61 < 156; var61++) {
				int var62 = 999;
				int var63 = 0;
				for (int var64 = 25; var64 < 172; var64++) {
					if (this.imageMapback.data[var64 + var61 * this.imageMapback.wi] == 0 && (var64 > 34 || var61 > 34)) {
						if (var62 == 999) {
							var62 = var64;
						}
					} else if (var62 != 999) {
						var63 = var64;
						break;
					}
				}
				this.minimapMaskLineOffsets[var61 - 5] = var62 - 25;
				this.minimapMaskLineLengths[var61 - 5] = var63 - var62;
			}
			Pix3D.initWH(479, 96);
			this.areaChatbackOffset = Pix3D.scanline;
			Pix3D.initWH(190, 261);
			this.areaSidebarOffset = Pix3D.scanline;
			Pix3D.initWH(512, 334);
			this.areaViewportOffset = Pix3D.scanline;
			int[] var65 = new int[9];
			for (int var66 = 0; var66 < 9; var66++) {
				int var67 = var66 * 32 + 128 + 15;
				int var68 = var67 * 3 + 600;
				int var69 = Pix3D.sinTable[var67];
				var65[var66] = var68 * var69 >> 16;
			}
			World.init(500, 512, 334, 800, var65);
			WordFilter.unpack(var13);
			this.mouseTracking = new MouseTracking(this);
			this.startThread(this.mouseTracking, 10);
		} catch (Exception var81) {
			signlink.reporterror("loaderror " + this.lastProgressMessage + " " + this.lastProgressPercent);
			this.errorLoading = true;
		}
	}

	@ObfuscatedName("client.b(B)V")
	public void loop() {
		if (this.errorStarted || this.errorLoading || this.errorHost) {
			return;
		}
		loopCycle++;
		if (this.ingame) {
			this.gameLoop();
		} else {
			this.titleScreenLoop();
		}
		this.onDemandLoop();
	}

	@ObfuscatedName("client.a(I)V")
	public void draw() {
		if (this.errorStarted || this.errorLoading || this.errorHost) {
			this.drawError();
			return;
		}
		drawCycle++;
		if (this.ingame) {
			this.gameDraw();
		} else {
			this.titleScreenDraw(false);
		}
		this.dragCycles = 0;
	}

	@ObfuscatedName("client.b(Z)V")
	public void unload() {
		signlink.reporterror = false;
		try {
			if (this.stream != null) {
				this.stream.close();
			}
		} catch (Exception var2) {
		}
		this.stream = null;
		this.stopMidi();
		if (this.mouseTracking != null) {
			this.mouseTracking.active = false;
		}
		this.mouseTracking = null;
		this.onDemand.stop();
		this.onDemand = null;
		this.out = null;
		this.login = null;
		this.in = null;
		this.mapBuildIndex = null;
		this.mapBuildGroundData = null;
		this.mapBuildLocationData = null;
		this.mapBuildGroundFile = null;
		this.mapBuildLocationFile = null;
		this.groundh = null;
		this.mapl = null;
		this.world = null;
		this.levelCollisionMap = null;
		this.bfsDirection = null;
		this.bfsCost = null;
		this.bfsStepX = null;
		this.bfsStepZ = null;
		this.textureBuffer = null;
		this.areaSidebar = null;
		this.areaMapback = null;
		this.areaViewport = null;
		this.areaChatback = null;
		this.areaBackbase1 = null;
		this.areaBackbase2 = null;
		this.areaBackhmid1 = null;
		this.areaBackleft1 = null;
		this.areaBackleft2 = null;
		this.areaBackright1 = null;
		this.areaBackright2 = null;
		this.areaBacktop1 = null;
		this.areaBackvmid1 = null;
		this.areaBackvmid2 = null;
		this.areaBackvmid3 = null;
		this.areaBackhmid2 = null;
		this.imageInvback = null;
		this.imageMapback = null;
		this.imageChatback = null;
		this.imageBackbase1 = null;
		this.imageBackbase2 = null;
		this.imageBackhmid1 = null;
		this.imageSideicons = null;
		this.imageRedstone1 = null;
		this.imageRedstone2 = null;
		this.imageRedstone3 = null;
		this.imageRedstone1h = null;
		this.imageRedstone2h = null;
		this.imageRedstone1v = null;
		this.imageRedstone2v = null;
		this.imageRedstone3v = null;
		this.imageRedstone1hv = null;
		this.imageRedstone2hv = null;
		this.imageCompass = null;
		this.imageHitmarks = null;
		this.imageHeadicons = null;
		this.imageCross = null;
		this.imageMapdot0 = null;
		this.imageMapdot1 = null;
		this.imageMapdot2 = null;
		this.imageMapdot3 = null;
		this.imageMapscene = null;
		this.imageMapfunction = null;
		this.tileLastOccupiedCycle = null;
		this.players = null;
		this.playerIds = null;
		this.entityUpdateIds = null;
		this.playerAppearanceBuffer = null;
		this.entityRemovalIds = null;
		this.npcs = null;
		this.npcIds = null;
		this.objStacks = null;
		this.locChanges = null;
		this.projectiles = null;
		this.spotanims = null;
		this.menuParamB = null;
		this.menuParamC = null;
		this.menuAction = null;
		this.menuParamA = null;
		this.menuOption = null;
		this.varps = null;
		this.activeMapFunctionX = null;
		this.activeMapFunctionZ = null;
		this.activeMapFunctions = null;
		this.imageMinimap = null;
		this.friendName = null;
		this.friendName37 = null;
		this.friendWorld = null;
		this.imageTitle0 = null;
		this.imageTitle1 = null;
		this.imageTitle2 = null;
		this.imageTitle3 = null;
		this.imageTitle4 = null;
		this.imageTitle5 = null;
		this.imageTitle6 = null;
		this.imageTitle7 = null;
		this.imageTitle8 = null;
		this.unloadTitle();
		LocType.unload();
		NpcType.unload();
		ObjType.unload();
		FloType.list = null;
		IdkType.list = null;
		IfType.list = null;
		UnkType.list = null;
		SeqType.list = null;
		SpotAnimType.list = null;
		SpotAnimType.modelCache = null;
		VarpType.list = null;
		super.drawArea = null;
		ClientPlayer.modelCache = null;
		Pix3D.unload();
		World.unload();
		Model.unload();
		AnimFrame.unload();
		System.gc();
	}

	@ObfuscatedName("client.b(I)V")
	public void refresh() {
		this.redrawFrame = true;
	}

	// ----

	@ObfuscatedName("client.a(BLjava/lang/String;I)V")
	public void drawProgress(String arg1, int arg2) {
		boolean var4 = false;
		this.lastProgressPercent = arg2;
		this.lastProgressMessage = arg1;
		this.loadTitle();
		if (this.jagTitle == null) {
			super.drawProgress(arg1, arg2);
			return;
		}
		this.imageTitle4.bind();
		short var5 = 360;
		short var6 = 200;
		byte var7 = 20;
		this.fontBold12.centreString(var6 / 2 - 26 - var7, "RuneScape is loading - please wait...", var5 / 2, 16777215);
		int var8 = var6 / 2 - 18 - var7;
		Pix2D.drawRect(9179409, 304, var8, var5 / 2 - 152, 34);
		Pix2D.drawRect(0, 302, var8 + 1, var5 / 2 - 151, 32);
		Pix2D.fillRect(30, arg2 * 3, var5 / 2 - 150, var8 + 2, 9179409);
		Pix2D.fillRect(30, 300 - arg2 * 3, var5 / 2 - 150 + arg2 * 3, var8 + 2, 0);
		this.fontBold12.centreString(var6 / 2 + 5 - var7, arg1, var5 / 2, 16777215);
		this.imageTitle4.draw(171, 202, super.graphics);
		if (this.redrawFrame) {
			this.redrawFrame = false;
			if (!this.flameActive) {
				this.imageTitle0.draw(0, 0, super.graphics);
				this.imageTitle1.draw(0, 637, super.graphics);
			}
			this.imageTitle2.draw(0, 128, super.graphics);
			this.imageTitle3.draw(371, 202, super.graphics);
			this.imageTitle5.draw(265, 0, super.graphics);
			this.imageTitle6.draw(265, 562, super.graphics);
			this.imageTitle7.draw(171, 128, super.graphics);
			this.imageTitle8.draw(171, 562, super.graphics);
		}
	}

	@ObfuscatedName("client.s(I)V")
	public void drawError() {
		Graphics var2 = this.getBaseComponent().getGraphics();
		var2.setColor(Color.black);
		var2.fillRect(0, 0, 765, 503);
		this.setFramerate(1);
		if (this.errorLoading) {
			this.flameActive = false;
			var2.setFont(new Font("Helvetica", 1, 16));
			var2.setColor(Color.yellow);
			byte var3 = 35;
			var2.drawString("Sorry, an error has occured whilst loading RuneScape", 30, var3);
			int var5 = var3 + 50;
			var2.setColor(Color.white);
			var2.drawString("To fix this try the following (in order):", 30, var5);
			int var6 = var5 + 50;
			var2.setColor(Color.white);
			var2.setFont(new Font("Helvetica", 1, 12));
			var2.drawString("1: Try closing ALL open web-browser windows, and reloading", 30, var6);
			int var7 = var6 + 30;
			var2.drawString("2: Try clearing your web-browsers cache from tools->internet options", 30, var7);
			int var8 = var7 + 30;
			var2.drawString("3: Try using a different game-world", 30, var8);
			int var10 = var8 + 30;
			var2.drawString("4: Try rebooting your computer", 30, var10);
			int var12 = var10 + 30;
			var2.drawString("5: Try selecting a different version of Java from the play-game menu", 30, var12);
		}
		if (this.errorHost) {
			this.flameActive = false;
			var2.setFont(new Font("Helvetica", 1, 20));
			var2.setColor(Color.white);
			var2.drawString("Error - unable to load game!", 50, 50);
			var2.drawString("To play RuneScape make sure you play from", 50, 100);
			var2.drawString("http://www.runescape.com", 50, 150);
		}
		if (!this.errorStarted) {
			return;
		}
		this.flameActive = false;
		var2.setColor(Color.yellow);
		byte var4 = 35;
		var2.drawString("Error a copy of RuneScape already appears to be loaded", 30, var4);
		int var9 = var4 + 50;
		var2.setColor(Color.white);
		var2.drawString("To fix this try the following (in order):", 30, var9);
		int var11 = var9 + 50;
		var2.setColor(Color.white);
		var2.setFont(new Font("Helvetica", 1, 12));
		var2.drawString("1: Try closing ALL open web-browser windows, and reloading", 30, var11);
		int var13 = var11 + 30;
		var2.drawString("2: Try rebooting your computer, and reloading", 30, var13);
		int var14 = var13 + 30;
	}

	@ObfuscatedName("client.a(Ljava/lang/String;IIZLjava/lang/String;I)Lyb;")
	public JagFile getJagFile(String arg0, int arg1, int arg2, String arg4, int arg5) {
		byte[] var7 = null;
		int var8 = 5;
		try {
			if (this.fileStreams[0] != null) {
				var7 = this.fileStreams[0].read(arg5);
			}
		} catch (Exception var29) {
		}
		if (var7 != null) {
			this.crc32.reset();
			this.crc32.update(var7);
			int var9 = (int) this.crc32.getValue();
			if (var9 != arg1) {
				var7 = null;
			}
		}
		if (var7 != null) {
			return new JagFile(var7);
		}
		int var11 = 0;
		while (var7 == null) {
			String var12 = "Unknown error";
			this.drawProgress("Requesting " + arg0, arg2);
			Object var13 = null;
			try {
				int var14 = 0;
				DataInputStream var15 = this.openUrl(arg4 + arg1);
				byte[] var16 = new byte[6];
				var15.readFully(var16, 0, 6);
				Packet var17 = new Packet(var16);
				var17.pos = 3;
				int var18 = var17.g3() + 6;
				int var19 = 6;
				var7 = new byte[var18];
				for (int var20 = 0; var20 < 6; var20++) {
					var7[var20] = var16[var20];
				}
				while (var19 < var18) {
					int var21 = var18 - var19;
					if (var21 > 1000) {
						var21 = 1000;
					}
					int var22 = var15.read(var7, var19, var21);
					if (var22 < 0) {
						(new StringBuffer("Length error: ")).append(var19).append("/").append(var18).toString();
						throw new IOException("EOF");
					}
					var19 += var22;
					int var23 = var19 * 100 / var18;
					if (var23 != var14) {
						this.drawProgress("Loading " + arg0 + " - " + var23 + "%", arg2);
					}
					var14 = var23;
				}
				var15.close();
				try {
					if (this.fileStreams[0] != null) {
						this.fileStreams[0].write(var7.length, arg5, var7);
					}
				} catch (Exception var28) {
					this.fileStreams[0] = null;
				}
				if (var7 != null) {
					this.crc32.reset();
					this.crc32.update(var7);
					int var24 = (int) this.crc32.getValue();
					if (var24 != arg1) {
						var7 = null;
						var11++;
						var12 = "Checksum error: " + var24;
					}
				}
			} catch (IOException var30) {
				if (var12.equals("Unknown error")) {
					var12 = "Connection error";
				}
				var7 = null;
			} catch (NullPointerException var31) {
				var12 = "Null error";
				var7 = null;
				if (!signlink.reporterror) {
					return null;
				}
			} catch (ArrayIndexOutOfBoundsException var32) {
				var12 = "Bounds error";
				var7 = null;
				if (!signlink.reporterror) {
					return null;
				}
			} catch (Exception var33) {
				var12 = "Unexpected error";
				var7 = null;
				if (!signlink.reporterror) {
					return null;
				}
			}
			if (var7 == null) {
				for (int var25 = var8; var25 > 0; var25--) {
					if (var11 >= 3) {
						this.drawProgress("Game updated - please reload page", arg2);
						var25 = 10;
					} else {
						this.drawProgress(var12 + " - Retrying in " + var25, arg2);
					}
					try {
						Thread.sleep(1000L);
					} catch (Exception var27) {
					}
				}
				var8 *= 2;
				if (var8 > 60) {
					var8 = 60;
				}
			}
		}
		return new JagFile(var7);
	}

	@ObfuscatedName("client.o(I)V")
	public void onDemandLoop() {
		while (true) {
			OnDemandRequest var2 = this.onDemand.cycle();
			if (var2 == null) {
				return;
			}
			if (var2.archive == 0) {
				Model.unpack(var2.data, var2.file);
				if ((this.onDemand.getModelFlags(var2.file) & 0x62) != 0) {
					this.redrawSidebar = true;
					if (this.chatLayerId != -1) {
						this.redrawChatback = true;
					}
				}
			}
			if (var2.archive == 1 && var2.data != null) {
				AnimFrame.unpack(var2.data);
			}
			if (var2.archive == 2 && var2.file == this.midiSong && var2.data != null) {
				this.saveMidi(this.midiFading, var2.data);
			}
			if (var2.archive == 3 && this.sceneState == 1) {
				for (int var3 = 0; var3 < this.mapBuildGroundData.length; var3++) {
					if (this.mapBuildGroundFile[var3] == var2.file) {
						this.mapBuildGroundData[var3] = var2.data;
						if (var2.data == null) {
							this.mapBuildGroundFile[var3] = -1;
						}
						break;
					}
					if (this.mapBuildLocationFile[var3] == var2.file) {
						this.mapBuildLocationData[var3] = var2.data;
						if (var2.data == null) {
							this.mapBuildLocationFile[var3] = -1;
						}
						break;
					}
				}
			}
			if (var2.archive == 93 && this.onDemand.hasMapLocFile(var2.file)) {
				ClientBuild.prefetchLocations(new Packet(var2.data), this.onDemand);
			}
		}
	}

	@ObfuscatedName("client.l(B)V")
	public void titleScreenLoop() {
		if (this.loginscreen == 0) {
			int var2 = super.canvasWidth / 2 - 80;
			int var3 = super.canvasHeight / 2 + 20;
			int var14 = var3 + 20;
			if (super.mouseClickButton == 1 && super.mouseClickX >= var2 - 75 && super.mouseClickX <= var2 + 75 && super.mouseClickY >= var14 - 20 && super.mouseClickY <= var14 + 20) {
				this.loginscreen = 3;
				this.loginSelect = 0;
			}
			int var4 = super.canvasWidth / 2 + 80;
			if (super.mouseClickButton == 1 && super.mouseClickX >= var4 - 75 && super.mouseClickX <= var4 + 75 && super.mouseClickY >= var14 - 20 && super.mouseClickY <= var14 + 20) {
				this.loginMes1 = "";
				this.loginMes2 = "Enter your username & password.";
				this.loginscreen = 2;
				this.loginSelect = 0;
			}
		} else if (this.loginscreen == 2) {
			int var5 = super.canvasHeight / 2 - 40;
			int var15 = var5 + 30;
			int var16 = var15 + 25;
			if (super.mouseClickButton == 1 && super.mouseClickY >= var16 - 15 && super.mouseClickY < var16) {
				this.loginSelect = 0;
			}
			var5 = var16 + 15;
			if (super.mouseClickButton == 1 && super.mouseClickY >= var5 - 15 && super.mouseClickY < var5) {
				this.loginSelect = 1;
			}
			var5 += 15;
			int var6 = super.canvasWidth / 2 - 80;
			int var7 = super.canvasHeight / 2 + 50;
			int var17 = var7 + 20;
			if (super.mouseClickButton == 1 && super.mouseClickX >= var6 - 75 && super.mouseClickX <= var6 + 75 && super.mouseClickY >= var17 - 20 && super.mouseClickY <= var17 + 20) {
				this.login(this.loginUser, this.loginPass, false);
				if (this.ingame) {
					return;
				}
			}
			int var8 = super.canvasWidth / 2 + 80;
			if (super.mouseClickButton == 1 && super.mouseClickX >= var8 - 75 && super.mouseClickX <= var8 + 75 && super.mouseClickY >= var17 - 20 && super.mouseClickY <= var17 + 20) {
				this.loginscreen = 0;
				this.loginUser = "";
				this.loginPass = "";
			}
			while (true) {
				int var9 = this.pollKey();
				if (var9 == -1) {
					return;
				}
				boolean var10 = false;
				for (int var11 = 0; var11 < CHARSET.length(); var11++) {
					if (var9 == CHARSET.charAt(var11)) {
						var10 = true;
						break;
					}
				}
				if (this.loginSelect == 0) {
					if (var9 == 8 && this.loginUser.length() > 0) {
						this.loginUser = this.loginUser.substring(0, this.loginUser.length() - 1);
					}
					if (var9 == 9 || var9 == 10 || var9 == 13) {
						this.loginSelect = 1;
					}
					if (var10) {
						this.loginUser = this.loginUser + (char) var9;
					}
					if (this.loginUser.length() > 12) {
						this.loginUser = this.loginUser.substring(0, 12);
					}
				} else if (this.loginSelect == 1) {
					if (var9 == 8 && this.loginPass.length() > 0) {
						this.loginPass = this.loginPass.substring(0, this.loginPass.length() - 1);
					}
					if (var9 == 9 || var9 == 10 || var9 == 13) {
						this.loginSelect = 0;
					}
					if (var10) {
						this.loginPass = this.loginPass + (char) var9;
					}
					if (this.loginPass.length() > 20) {
						this.loginPass = this.loginPass.substring(0, 20);
					}
				}
			}
		} else if (this.loginscreen == 3) {
			int var12 = super.canvasWidth / 2;
			int var13 = super.canvasHeight / 2 + 50;
			int var18 = var13 + 20;
			if (super.mouseClickButton == 1 && super.mouseClickX >= var12 - 75 && super.mouseClickX <= var12 + 75 && super.mouseClickY >= var18 - 20 && super.mouseClickY <= var18 + 20) {
				this.loginscreen = 0;
				return;
			}
		}
	}

	@ObfuscatedName("client.a(Ljava/lang/String;Ljava/lang/String;Z)V")
	public void login(String arg0, String arg1, boolean arg2) {
		signlink.errorname = arg0;
		try {
			if (!arg2) {
				this.loginMes1 = "";
				this.loginMes2 = "Connecting to server...";
				this.titleScreenDraw(true);
			}
			this.stream = new ClientStream(this, this.openSocket(portOffset + 43594));
			long var4 = JString.toBase37(arg0);
			int var6 = (int) (var4 >> 16 & 0x1FL);
			this.out.pos = 0;
			this.out.p1(14);
			this.out.p1(var6);
			this.stream.write(this.out.data, 0, 2);
			for (int var7 = 0; var7 < 8; var7++) {
				this.stream.read();
			}
			int var8 = this.stream.read();
			if (var8 == 0) {
				this.stream.read(this.in.data, 0, 8);
				this.in.pos = 0;
				this.serverSeed = this.in.g8();
				int[] var9 = new int[] { (int) (Math.random() * 9.9999999E7D), (int) (Math.random() * 9.9999999E7D), (int) (this.serverSeed >> 32), (int) this.serverSeed};
				this.out.pos = 0;
				this.out.p1(10);
				this.out.p4(var9[0]);
				this.out.p4(var9[1]);
				this.out.p4(var9[2]);
				this.out.p4(var9[3]);
				this.out.p4(signlink.uid);
				this.out.pjstr(arg0);
				this.out.pjstr(arg1);
				this.out.rsaenc(LOGIN_RSAE, LOGIN_RSAN);
				this.login.pos = 0;
				if (arg2) {
					this.login.p1(18);
				} else {
					this.login.p1(16);
				}
				this.login.p1(this.out.pos + 36 + 1 + 1);
				this.login.p1(254);
				this.login.p1(lowMem ? 1 : 0);
				for (int var10 = 0; var10 < 9; var10++) {
					this.login.p4(this.jagChecksum[var10]);
				}
				this.login.pdata(0, this.out.data, this.out.pos);
				this.out.random = new Isaac(var9);
				for (int var11 = 0; var11 < 4; var11++) {
					var9[var11] += 50;
				}
				this.randomIn = new Isaac(var9);
				this.stream.write(this.login.data, 0, this.login.pos);
				var8 = this.stream.read();
			}
			if (var8 == 1) {
				try {
					Thread.sleep(2000L);
				} catch (Exception var21) {
				}
				this.login(arg0, arg1, arg2);
			} else if (var8 == 2) {
				this.staffmodlevel = this.stream.read();
				mouseTracked = this.stream.read() == 1;
				InputTracking.deactivate();
				this.prevMousePressTime = 0L;
				this.mouseTrackedDelta = 0;
				this.mouseTracking.length = 0;
				super.hasFocus = true;
				this.focused = true;
				this.ingame = true;
				this.out.pos = 0;
				this.in.pos = 0;
				this.ptype = -1;
				this.ptype0 = -1;
				this.ptype1 = -1;
				this.ptype2 = -1;
				this.psize = 0;
				this.packetCycle = 0;
				this.systemUpdateTimer = 0;
				this.pendingLogout = 0;
				this.hintType = 0;
				this.menuSize = 0;
				this.menuVisible = false;
				super.idleCycles = 0;
				for (int var12 = 0; var12 < 100; var12++) {
					this.messageText[var12] = null;
				}
				this.objSelected = 0;
				this.spellSelected = 0;
				this.sceneState = 0;
				this.waveCount = 0;
				this.macroCameraX = (int) (Math.random() * 100.0D) - 50;
				this.macroCameraZ = (int) (Math.random() * 110.0D) - 55;
				this.macroCameraAngle = (int) (Math.random() * 80.0D) - 40;
				this.macroMinimapAngle = (int) (Math.random() * 120.0D) - 60;
				this.macroMinimapZoom = (int) (Math.random() * 30.0D) - 20;
				this.orbitCameraYaw = (int) (Math.random() * 20.0D) - 10 & 0x7FF;
				this.minimapLevel = -1;
				this.flagSceneTileX = 0;
				this.flagSceneTileZ = 0;
				this.playerCount = 0;
				this.npcCount = 0;
				for (int var13 = 0; var13 < this.MAX_PLAYER_COUNT; var13++) {
					this.players[var13] = null;
					this.playerAppearanceBuffer[var13] = null;
				}
				for (int var14 = 0; var14 < 16384; var14++) {
					this.npcs[var14] = null;
				}
				localPlayer = this.players[this.LOCAL_PLAYER_INDEX] = new ClientPlayer();
				this.projectiles.clear();
				this.spotanims.clear();
				for (int var15 = 0; var15 < 4; var15++) {
					for (int var16 = 0; var16 < 104; var16++) {
						for (int var17 = 0; var17 < 104; var17++) {
							this.objStacks[var15][var16][var17] = null;
						}
					}
				}
				this.locChanges = new LinkList();
				this.friendListStatus = 0;
				this.friendCount = 0;
				this.tutLayerId = -1;
				this.chatLayerId = -1;
				this.mainLayerId = -1;
				this.sideLayerId = -1;
				this.mainOverlayLayerId = -1;
				this.pressedContinueOption = false;
				this.sideTab = 3;
				this.chatbackInputOpen = false;
				this.menuVisible = false;
				this.showSocialInput = false;
				this.modalMessage = null;
				this.inMultizone = 0;
				this.flashingTab = -1;
				this.designGender = true;
				this.validateCharacterDesign();
				for (int var18 = 0; var18 < 5; var18++) {
					this.designColours[var18] = 0;
				}
				for (int var19 = 0; var19 < 5; var19++) {
					this.playerOptions[var19] = null;
					this.playerOptionsPushDown[var19] = false;
				}
				oplogic1 = 0;
				oplogic2 = 0;
				oplogic3 = 0;
				oplogic4 = 0;
				oplogic5 = 0;
				oplogic6 = 0;
				oplogic7 = 0;
				oplogic8 = 0;
				oplogic9 = 0;
				oplogic10 = 0;
				this.prepareGame();
			} else if (var8 == 3) {
				this.loginMes1 = "";
				this.loginMes2 = "Invalid username or password.";
			} else if (var8 == 4) {
				this.loginMes1 = "Your account has been disabled.";
				this.loginMes2 = "Please check your message-centre for details.";
			} else if (var8 == 5) {
				this.loginMes1 = "Your account is already logged in.";
				this.loginMes2 = "Try again in 60 secs...";
			} else if (var8 == 6) {
				this.loginMes1 = "RuneScape has been updated!";
				this.loginMes2 = "Please reload this page.";
			} else if (var8 == 7) {
				this.loginMes1 = "This world is full.";
				this.loginMes2 = "Please use a different world.";
			} else if (var8 == 8) {
				this.loginMes1 = "Unable to connect.";
				this.loginMes2 = "Login server offline.";
			} else if (var8 == 9) {
				this.loginMes1 = "Login limit exceeded.";
				this.loginMes2 = "Too many connections from your address.";
			} else if (var8 == 10) {
				this.loginMes1 = "Unable to connect.";
				this.loginMes2 = "Bad session id.";
			} else if (var8 == 11) {
				this.loginMes2 = "Login server rejected session.";
				this.loginMes2 = "Please try again.";
			} else if (var8 == 12) {
				this.loginMes1 = "You need a members account to login to this world.";
				this.loginMes2 = "Please subscribe, or use a different world.";
			} else if (var8 == 13) {
				this.loginMes1 = "Could not complete login.";
				this.loginMes2 = "Please try using a different world.";
			} else if (var8 == 14) {
				this.loginMes1 = "The server is being updated.";
				this.loginMes2 = "Please wait 1 minute and try again.";
			} else if (var8 == 15) {
				this.ingame = true;
				this.out.pos = 0;
				this.in.pos = 0;
				this.ptype = -1;
				this.ptype0 = -1;
				this.ptype1 = -1;
				this.ptype2 = -1;
				this.psize = 0;
				this.packetCycle = 0;
				this.systemUpdateTimer = 0;
				this.menuSize = 0;
				this.menuVisible = false;
				this.sceneLoadStartTime = System.currentTimeMillis();
			} else if (var8 == 16) {
				this.loginMes1 = "Login attempts exceeded.";
				this.loginMes2 = "Please wait 1 minute and try again.";
			} else if (var8 == 17) {
				this.loginMes1 = "You are standing in a members-only area.";
				this.loginMes2 = "To play on this world move to a free area first";
			} else if (var8 == 20) {
				this.loginMes1 = "Invalid loginserver requested";
				this.loginMes2 = "Please try using a different world.";
			} else if (var8 == 21) {
				for (int var20 = this.stream.read(); var20 >= 0; var20--) {
					this.loginMes1 = "You have only just left another world";
					this.loginMes2 = "Your profile will be transfered in: " + var20 + " seconds";
					this.titleScreenDraw(true);
					try {
						Thread.sleep(1000L);
					} catch (Exception var22) {
					}
				}
				this.login(arg0, arg1, arg2);
			} else if (var8 == -1) {
				this.loginMes1 = "No response from server";
				this.loginMes2 = "Please try using a different world.";
			} else {
				System.out.println("response:" + var8);
				this.loginMes1 = "Unexpected server response";
				this.loginMes2 = "Please try using a different world.";
			}
		} catch (IOException var23) {
			this.loginMes1 = "";
			this.loginMes2 = "Error connecting to server.";
		}
	}

	@ObfuscatedName("client.q(I)V")
	public void logout() {
		try {
			if (this.stream != null) {
				this.stream.close();
			}
		} catch (Exception var3) {
		}
		this.stream = null;
		this.ingame = false;
		this.loginscreen = 0;
		this.loginUser = "";
		this.loginPass = "";
		InputTracking.deactivate();
		this.clearCaches();
		this.world.reset();
		for (int var2 = 0; var2 < 4; var2++) {
			this.levelCollisionMap[var2].reset();
		}
		System.gc();
		this.stopMidi();
		this.nextMidiSong = -1;
		this.midiSong = -1;
		this.nextMusicDelay = 0;
	}

	@ObfuscatedName("client.l(I)V")
	public void clearCaches() {
		LocType.mc1.clear();
		LocType.mc2.clear();
		NpcType.modelCache.clear();
		ObjType.modelCache.clear();
		ObjType.spriteCache.clear();
		ClientPlayer.modelCache.clear();
		SpotAnimType.modelCache.clear();
	}

	@ObfuscatedName("client.j(I)V")
	public void prepareGame() {
		if (this.areaChatback != null) {
			return;
		}
		this.unloadTitle();
		super.drawArea = null;
		this.imageTitle2 = null;
		this.imageTitle3 = null;
		this.imageTitle4 = null;
		this.imageTitle0 = null;
		this.imageTitle1 = null;
		this.imageTitle5 = null;
		this.imageTitle6 = null;
		this.imageTitle7 = null;
		this.imageTitle8 = null;
		this.areaChatback = new PixMap(this.getBaseComponent(), 479, 96);
		this.areaMapback = new PixMap(this.getBaseComponent(), 172, 156);
		Pix2D.cls();
		this.imageMapback.plotSprite(0, 0);
		this.areaSidebar = new PixMap(this.getBaseComponent(), 190, 261);
		this.areaViewport = new PixMap(this.getBaseComponent(), 512, 334);
		Pix2D.cls();
		this.areaBackbase1 = new PixMap(this.getBaseComponent(), 496, 50);
		this.areaBackbase2 = new PixMap(this.getBaseComponent(), 269, 37);
		this.areaBackhmid1 = new PixMap(this.getBaseComponent(), 249, 45);
		this.redrawFrame = true;
	}

	@ObfuscatedName("client.F(I)V")
	public void gameLoop() {
		if (this.systemUpdateTimer > 1) {
			this.systemUpdateTimer--;
		}
		if (this.pendingLogout > 0) {
			this.pendingLogout--;
		}
		for (int var2 = 0; var2 < 5 && this.tcpIn(); var2++) {
		}
		if (this.ingame) {
			synchronized (this.mouseTracking.lock) {
				if (!mouseTracked) {
					this.mouseTracking.length = 0;
				} else if (super.mouseClickButton != 0 || this.mouseTracking.length >= 40) {
					// EVENT_MOUSE_MOVE
					this.out.pIsaac(232);
					this.out.p1(0);
					int var4 = this.out.pos;
					int var5 = 0;
					for (int var6 = 0; var6 < this.mouseTracking.length && var4 - this.out.pos < 240; var6++) {
						var5++;
						int var7 = this.mouseTracking.y[var6];
						if (var7 < 0) {
							var7 = 0;
						} else if (var7 > 502) {
							var7 = 502;
						}
						int var8 = this.mouseTracking.x[var6];
						if (var8 < 0) {
							var8 = 0;
						} else if (var8 > 764) {
							var8 = 764;
						}
						int var9 = var7 * 765 + var8;
						if (this.mouseTracking.y[var6] == -1 && this.mouseTracking.x[var6] == -1) {
							var8 = -1;
							var7 = -1;
							var9 = 524287;
						}
						if (var8 != this.mouseTrackedX || var7 != this.mouseTrackedY) {
							int var10 = var8 - this.mouseTrackedX;
							this.mouseTrackedX = var8;
							int var11 = var7 - this.mouseTrackedY;
							this.mouseTrackedY = var7;
							if (this.mouseTrackedDelta < 8 && var10 >= -32 && var10 <= 31 && var11 >= -32 && var11 <= 31) {
								var10 += 32;
								var11 += 32;
								this.out.p2((this.mouseTrackedDelta << 12) + (var10 << 6) + var11);
								this.mouseTrackedDelta = 0;
							} else if (this.mouseTrackedDelta < 8) {
								this.out.p3((this.mouseTrackedDelta << 19) + 8388608 + var9);
								this.mouseTrackedDelta = 0;
							} else {
								this.out.p4((this.mouseTrackedDelta << 19) + -1073741824 + var9);
								this.mouseTrackedDelta = 0;
							}
						} else if (this.mouseTrackedDelta < 2047) {
							this.mouseTrackedDelta++;
						}
					}
					this.out.psize1(this.out.pos - var4);
					if (var5 >= this.mouseTracking.length) {
						this.mouseTracking.length = 0;
					} else {
						this.mouseTracking.length -= var5;
						for (int var12 = 0; var12 < this.mouseTracking.length; var12++) {
							this.mouseTracking.x[var12] = this.mouseTracking.x[var12 + var5];
							this.mouseTracking.y[var12] = this.mouseTracking.y[var12 + var5];
						}
					}
				}
			}
			if (super.mouseClickButton != 0) {
				long var13 = (super.mouseClickTime - this.prevMousePressTime) / 50L;
				if (var13 > 4095L) {
					var13 = 4095L;
				}
				this.prevMousePressTime = super.mouseClickTime;
				int var15 = super.mouseClickY;
				if (var15 < 0) {
					var15 = 0;
				} else if (var15 > 502) {
					var15 = 502;
				}
				int var16 = super.mouseClickX;
				if (var16 < 0) {
					var16 = 0;
				} else if (var16 > 764) {
					var16 = 764;
				}
				int var17 = var15 * 765 + var16;
				byte var18 = 0;
				if (super.mouseClickButton == 2) {
					var18 = 1;
				}
				int var19 = (int) var13;
				// EVENT_MOUSE_CLICK
				this.out.pIsaac(234);
				this.out.p4((var19 << 20) + (var18 << 19) + var17);
			}
			if (this.sendCameraDelay > 0) {
				this.sendCameraDelay--;
			}
			if (super.actionKey[1] == 1 || super.actionKey[2] == 1 || super.actionKey[3] == 1 || super.actionKey[4] == 1) {
				this.sendCamera = true;
			}
			if (this.sendCamera && this.sendCameraDelay <= 0) {
				this.sendCameraDelay = 20;
				this.sendCamera = false;
				// EVENT_CAMERA_POSITION
				this.out.pIsaac(91);
				this.out.p2(this.orbitCameraPitch);
				this.out.p2(this.orbitCameraYaw);
			}
			if (super.hasFocus && !this.focused) {
				this.focused = true;
				// EVENT_APPLET_FOCUS
				this.out.pIsaac(8);
				this.out.p1(1);
			}
			if (!super.hasFocus && this.focused) {
				this.focused = false;
				// EVENT_APPLET_FOCUS
				this.out.pIsaac(8);
				this.out.p1(0);
			}
			this.checkMinimap();
			this.locChangeDoQueue();
			this.soundsDoQueue();
			Packet var20 = InputTracking.flush();
			if (var20 != null) {
				// EVENT_TRACKING
				this.out.pIsaac(142);
				this.out.p2(var20.pos);
				this.out.pdata(0, var20.data, var20.pos);
				var20.release();
			}
			this.packetCycle++;
			if (this.packetCycle > 750) {
				this.tryReconnect();
			}
			this.movePlayers();
			this.moveNpcs();
			this.timeoutChat();
			this.sceneDelta++;
			if (this.crossMode != 0) {
				this.crossCycle += 20;
				if (this.crossCycle >= 400) {
					this.crossMode = 0;
				}
			}
			if (this.selectedArea != 0) {
				this.selectedCycle++;
				if (this.selectedCycle >= 15) {
					if (this.selectedArea == 2) {
						this.redrawSidebar = true;
					}
					if (this.selectedArea == 3) {
						this.redrawChatback = true;
					}
					this.selectedArea = 0;
				}
			}
			if (this.objDragArea != 0) {
				this.objDragCycles++;
				if (super.mouseX > this.objGrabX + 5 || super.mouseX < this.objGrabX - 5 || super.mouseY > this.objGrabY + 5 || super.mouseY < this.objGrabY - 5) {
					this.objGrabThreshold = true;
				}
				if (super.mouseButton == 0) {
					if (this.objDragArea == 2) {
						this.redrawSidebar = true;
					}
					if (this.objDragArea == 3) {
						this.redrawChatback = true;
					}
					this.objDragArea = 0;
					if (this.objGrabThreshold && this.objDragCycles >= 5) {
						this.hoveredSlotInterfaceId = -1;
						this.handleInput();
						if (this.hoveredSlotInterfaceId == this.objDragInterfaceId && this.hoveredSlot != this.objDragSlot) {
							IfType var21 = IfType.list[this.objDragInterfaceId];
							byte var22 = 0;
							if (this.bankArrangeMode == 1 && var21.clientCode == 206) {
								var22 = 1;
							}
							if (var21.linkObjType[this.hoveredSlot] <= 0) {
								var22 = 0;
							}
							if (var21.swappable) {
								int var23 = this.objDragSlot;
								int var24 = this.hoveredSlot;
								var21.linkObjType[var24] = var21.linkObjType[var23];
								var21.linkObjCount[var24] = var21.linkObjCount[var23];
								var21.linkObjType[var23] = -1;
								var21.linkObjCount[var23] = 0;
							} else if (var22 == 1) {
								int var25 = this.objDragSlot;
								int var26 = this.hoveredSlot;
								while (var25 != var26) {
									if (var25 > var26) {
										var21.swapObj(var25 - 1, var25);
										var25--;
									} else if (var25 < var26) {
										var21.swapObj(var25 + 1, var25);
										var25++;
									}
								}
							} else {
								var21.swapObj(this.hoveredSlot, this.objDragSlot);
							}

							// INV_BUTTOND
							this.out.pIsaac(176);
							this.out.p2(this.objDragInterfaceId);
							this.out.p2(this.objDragSlot);
							this.out.p2(this.hoveredSlot);
							this.out.p1(var22);
						}
					} else if ((this.oneMouseButton == 1 || this.isAddFriendOption(this.menuSize - 1)) && this.menuSize > 2) {
						this.showContextMenu();
					} else if (this.menuSize > 0) {
						this.useMenuOption(this.menuSize - 1);
					}
					this.selectedCycle = 10;
					super.mouseClickButton = 0;
				}
			}
			field1596++;
			if (field1596 > 62) {
				field1596 = 0;
				// ANTICHEAT_CYCLELOGIC7
				this.out.pIsaac(182);
			}
			if (World.groundX != -1) {
				int var27 = World.groundX;
				int var28 = World.groundZ;
				boolean var29 = this.tryMove(0, 0, 0, var27, 0, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var28, true, 0, 0);
				World.groundX = -1;
				if (var29) {
					this.crossX = super.mouseClickX;
					this.crossY = super.mouseClickY;
					this.crossMode = 1;
					this.crossCycle = 0;
				}
			}
			if (super.mouseClickButton == 1 && this.modalMessage != null) {
				this.modalMessage = null;
				this.redrawChatback = true;
				super.mouseClickButton = 0;
			}
			this.handleMouseInput();
			this.handleMinimapInput();
			this.handleTabInput();
			this.handleChatModeInput();
			if (super.mouseButton == 1 || super.mouseClickButton == 1) {
				this.dragCycles++;
			}
			if (this.sceneState == 2) {
				this.followCamera();
			}
			if (this.sceneState == 2 && this.cutscene) {
				this.cinemaCamera();
			}
			for (int var30 = 0; var30 < 5; var30++) {
				int var10002 = this.cameraModifierCycle[var30]++;
			}
			this.handleInputKey();
			super.idleCycles++;
			if (super.idleCycles > 4500) {
				this.pendingLogout = 250;
				super.idleCycles -= 500;
				// IDLE_TIMER
				this.out.pIsaac(144);
			}
			this.macroCameraCycle++;
			if (this.macroCameraCycle > 500) {
				this.macroCameraCycle = 0;
				int var31 = (int) (Math.random() * 8.0D);
				if ((var31 & 0x1) == 1) {
					this.macroCameraX += this.macroCameraXModifier;
				}
				if ((var31 & 0x2) == 2) {
					this.macroCameraZ += this.macroCameraZModifier;
				}
				if ((var31 & 0x4) == 4) {
					this.macroCameraAngle += this.macroCameraAngleModifier;
				}
			}
			if (this.macroCameraX < -50) {
				this.macroCameraXModifier = 2;
			}
			if (this.macroCameraX > 50) {
				this.macroCameraXModifier = -2;
			}
			if (this.macroCameraZ < -55) {
				this.macroCameraZModifier = 2;
			}
			if (this.macroCameraZ > 55) {
				this.macroCameraZModifier = -2;
			}
			if (this.macroCameraAngle < -40) {
				this.macroCameraAngleModifier = 1;
			}
			if (this.macroCameraAngle > 40) {
				this.macroCameraAngleModifier = -1;
			}
			this.macroMinimapCycle++;
			if (this.macroMinimapCycle > 500) {
				this.macroMinimapCycle = 0;
				int var32 = (int) (Math.random() * 8.0D);
				if ((var32 & 0x1) == 1) {
					this.macroMinimapAngle += this.macroMinimapAngleModifier;
				}
				if ((var32 & 0x2) == 2) {
					this.macroMinimapZoom += this.macroMinimapZoomModifier;
				}
			}
			if (this.macroMinimapAngle < -60) {
				this.macroMinimapAngleModifier = 2;
			}
			if (this.macroMinimapAngle > 60) {
				this.macroMinimapAngleModifier = -2;
			}
			if (this.macroMinimapZoom < -20) {
				this.macroMinimapZoomModifier = 1;
			}
			if (this.macroMinimapZoom > 10) {
				this.macroMinimapZoomModifier = -1;
			}
			this.noTimeoutCycle++;
			if (this.noTimeoutCycle > 50) {
				// NO_TIMEOUT
				this.out.pIsaac(239);
			}
			try {
				if (this.stream != null && this.out.pos > 0) {
					this.stream.write(this.out.data, 0, this.out.pos);
					this.out.pos = 0;
					this.noTimeoutCycle = 0;
				}
			} catch (IOException var34) {
				this.tryReconnect();
			} catch (Exception var35) {
				this.logout();
			}
		}
	}

	@ObfuscatedName("client.Q(I)V")
	public void tryReconnect() {
		if (this.pendingLogout > 0) {
			this.logout();
			return;
		}
		this.areaViewport.bind();
		this.fontPlain12.centreString(144, "Connection lost", 257, 0);
		this.fontPlain12.centreString(143, "Connection lost", 256, 16777215);
		this.fontPlain12.centreString(159, "Please wait - attempting to reestablish", 257, 0);
		this.fontPlain12.centreString(158, "Please wait - attempting to reestablish", 256, 16777215);
		this.areaViewport.draw(4, 4, super.graphics);
		this.flagSceneTileX = 0;
		ClientStream var2 = this.stream;
		this.ingame = false;
		this.login(this.loginUser, this.loginPass, true);
		if (!this.ingame) {
			this.logout();
		}
		try {
			var2.close();
		} catch (Exception var3) {
		}
	}

	@ObfuscatedName("client.e(I)V")
	public void checkMinimap() {
		if (lowMem && this.sceneState == 2 && ClientBuild.minusedlevel != this.minusedlevel) {
			this.areaViewport.bind();
			this.fontPlain12.centreString(151, "Loading - please wait.", 257, 0);
			this.fontPlain12.centreString(150, "Loading - please wait.", 256, 16777215);
			this.areaViewport.draw(4, 4, super.graphics);
			this.sceneState = 1;
			this.sceneLoadStartTime = System.currentTimeMillis();
		}
		if (this.sceneState == 1) {
			int var2 = this.checkScene();
			if (var2 != 0 && System.currentTimeMillis() - this.sceneLoadStartTime > 360000L) {
				signlink.reporterror(this.loginUser + " glcfb " + this.serverSeed + "," + var2 + "," + lowMem + "," + this.fileStreams[0] + "," + this.onDemand.remaining() + "," + this.minusedlevel + "," + this.sceneCenterZoneX + "," + this.sceneCenterZoneZ);
				this.sceneLoadStartTime = System.currentTimeMillis();
			}
		}
		if (this.sceneState == 2 && this.minusedlevel != this.minimapLevel) {
			this.minimapLevel = this.minusedlevel;
			this.minimapBuildBuffer(this.minusedlevel);
		}
	}

	@ObfuscatedName("client.d(B)I")
	public int checkScene() {
		for (int var2 = 0; var2 < this.mapBuildGroundData.length; var2++) {
			if (this.mapBuildGroundData[var2] == null && this.mapBuildGroundFile[var2] != -1) {
				return -1;
			}
			if (this.mapBuildLocationData[var2] == null && this.mapBuildLocationFile[var2] != -1) {
				return -2;
			}
		}
		boolean var3 = true;
		for (int var4 = 0; var4 < this.mapBuildGroundData.length; var4++) {
			byte[] var5 = this.mapBuildLocationData[var4];
			if (var5 != null) {
				int var6 = (this.mapBuildIndex[var4] >> 8) * 64 - this.sceneBaseTileX;
				int var7 = (this.mapBuildIndex[var4] & 0xFF) * 64 - this.sceneBaseTileZ;
				var3 &= ClientBuild.checkLocations(var7, var6, var5);
			}
		}
		if (!var3) {
			return -3;
		} else if (this.awaitingSync) {
			return -4;
		}

		this.sceneState = 2;
		ClientBuild.minusedlevel = this.minusedlevel;
		this.mapBuild();
		// MAP_BUILD_COMPLETE
		this.out.pIsaac(134);
		return 0;
	}

	@ObfuscatedName("client.m(B)V")
	public void mapBuild() {
		try {
			this.minimapLevel = -1;
			this.spotanims.clear();
			this.projectiles.clear();
			Pix3D.clearTexels();
			this.clearCaches();
			this.world.reset();
			for (int var2 = 0; var2 < 4; var2++) {
				this.levelCollisionMap[var2].reset();
			}
			System.gc();
			ClientBuild var3 = new ClientBuild(this.mapl, this.groundh, 104, 104);
			int var4 = this.mapBuildGroundData.length;
			ClientBuild.lowMem = World.lowMem;
			for (int var5 = 0; var5 < var4; var5++) {
				int var6 = this.mapBuildIndex[var5] >> 8;
				int var7 = this.mapBuildIndex[var5] & 0xFF;
				if (var6 == 33 && var7 >= 71 && var7 <= 73) {
					ClientBuild.lowMem = false;
				}
			}
			if (ClientBuild.lowMem) {
				this.world.fillBaseLevel(this.minusedlevel);
			} else {
				this.world.fillBaseLevel(0);
			}
			// NO_TIMEOUT
			this.out.pIsaac(239);
			for (int var8 = 0; var8 < var4; var8++) {
				int var9 = (this.mapBuildIndex[var8] >> 8) * 64 - this.sceneBaseTileX;
				int var10 = (this.mapBuildIndex[var8] & 0xFF) * 64 - this.sceneBaseTileZ;
				byte[] var11 = this.mapBuildGroundData[var8];
				if (var11 != null) {
					var3.loadGround(var9, (this.sceneCenterZoneX - 6) * 8, var11, (this.sceneCenterZoneZ - 6) * 8, var10);
				}
			}
			for (int var12 = 0; var12 < var4; var12++) {
				int var13 = (this.mapBuildIndex[var12] >> 8) * 64 - this.sceneBaseTileX;
				int var14 = (this.mapBuildIndex[var12] & 0xFF) * 64 - this.sceneBaseTileZ;
				byte[] var15 = this.mapBuildGroundData[var12];
				if (var15 == null && this.sceneCenterZoneZ < 800) {
					var3.fadeAdjacent(64, var13, var14, 64);
				}
			}
			// NO_TIMEOUT
			this.out.pIsaac(239);
			for (int var16 = 0; var16 < var4; var16++) {
				byte[] var17 = this.mapBuildLocationData[var16];
				if (var17 != null) {
					int var18 = (this.mapBuildIndex[var16] >> 8) * 64 - this.sceneBaseTileX;
					int var19 = (this.mapBuildIndex[var16] & 0xFF) * 64 - this.sceneBaseTileZ;
					var3.loadLocations(var19, this.world, var18, var17, this.levelCollisionMap);
				}
			}
			// NO_TIMEOUT
			this.out.pIsaac(239);
			var3.finishBuild(this.world, this.levelCollisionMap);
			this.areaViewport.bind();
			// NO_TIMEOUT
			this.out.pIsaac(239);
			for (int var20 = 0; var20 < 104; var20++) {
				for (int var21 = 0; var21 < 104; var21++) {
					this.showObject(var20, var21);
				}
			}
			this.locChangePostBuildCorrect();
		} catch (Exception var34) {
		}
		LocType.mc1.clear();
		if (lowMem && signlink.cache_dat != null) {
			int var23 = this.onDemand.getFileCount(0);
			for (int var24 = 0; var24 < var23; var24++) {
				int var25 = this.onDemand.getModelFlags(var24);
				if ((var25 & 0x79) == 0) {
					Model.unload(var24);
				}
			}
		}
		System.gc();
		Pix3D.initPool(20);
		this.onDemand.clearPrefetches();
		int var26 = (this.sceneCenterZoneX - 6) / 8 - 1;
		int var27 = (this.sceneCenterZoneX + 6) / 8 + 1;
		int var28 = (this.sceneCenterZoneZ - 6) / 8 - 1;
		int var29 = (this.sceneCenterZoneZ + 6) / 8 + 1;
		if (this.withinTutorialIsland) {
			var26 = 49;
			var27 = 50;
			var28 = 49;
			var29 = 50;
		}
		for (int var30 = var26; var30 <= var27; var30++) {
			for (int var31 = var28; var31 <= var29; var31++) {
				if (var30 == var26 || var30 == var27 || var31 == var28 || var31 == var29) {
					int var32 = this.onDemand.getMapFile(var30, var31, 0);
					if (var32 != -1) {
						this.onDemand.prefetch(3, var32);
					}
					int var33 = this.onDemand.getMapFile(var30, var31, 1);
					if (var33 != -1) {
						this.onDemand.prefetch(3, var33);
					}
				}
			}
		}
	}

	@ObfuscatedName("client.M(I)V")
	public void locChangePostBuildCorrect() {
		for (LocChange var2 = (LocChange) this.locChanges.head(); var2 != null; var2 = (LocChange) this.locChanges.next()) {
			if (var2.endTime == -1) {
				var2.startTime = 0;
				this.locChangeSetOld(var2);
			} else {
				var2.unlink();
			}
		}
	}

	@ObfuscatedName("client.a(IB)V")
	public void minimapBuildBuffer(int arg0) {
		int[] var3 = this.imageMinimap.data;
		int var4 = var3.length;
		for (int var5 = 0; var5 < var4; var5++) {
			var3[var5] = 0;
		}
		for (int var6 = 1; var6 < 103; var6++) {
			int var7 = (103 - var6) * 512 * 4 + 24628;
			for (int var8 = 1; var8 < 103; var8++) {
				if ((this.mapl[arg0][var8][var6] & 0x18) == 0) {
					this.world.render2DGround(var3, var7, 512, arg0, var8, var6);
				}
				if (arg0 < 3 && (this.mapl[arg0 + 1][var8][var6] & 0x8) != 0) {
					this.world.render2DGround(var3, var7, 512, arg0 + 1, var8, var6);
				}
				var7 += 4;
			}
		}
		int var9 = ((int) (Math.random() * 20.0D) + 238 - 10 << 16) + ((int) (Math.random() * 20.0D) + 238 - 10 << 8) + ((int) (Math.random() * 20.0D) + 238 - 10);
		int var10 = (int) (Math.random() * 20.0D) + 238 - 10 << 16;
		this.imageMinimap.setPixels();
		for (int var11 = 1; var11 < 103; var11++) {
			for (int var12 = 1; var12 < 103; var12++) {
				if ((this.mapl[arg0][var12][var11] & 0x18) == 0) {
					this.drawDetail(var9, arg0, var12, var10, var11);
				}
				if (arg0 < 3 && (this.mapl[arg0 + 1][var12][var11] & 0x8) != 0) {
					this.drawDetail(var9, arg0 + 1, var12, var10, var11);
				}
			}
		}
		this.areaViewport.bind();
		this.activeMapFunctionCount = 0;
		for (int var13 = 0; var13 < 104; var13++) {
			for (int var14 = 0; var14 < 104; var14++) {
				int var15 = this.world.gdType(this.minusedlevel, var13, var14);
				if (var15 != 0) {
					int var16 = var15 >> 14 & 0x7FFF;
					int var17 = LocType.get(var16).mapfunction;
					if (var17 >= 0) {
						int var18 = var13;
						int var19 = var14;
						if (var17 != 22 && var17 != 29 && var17 != 34 && var17 != 36 && var17 != 46 && var17 != 47 && var17 != 48) {
							byte var20 = 104;
							byte var21 = 104;
							int[][] var22 = this.levelCollisionMap[this.minusedlevel].flags;
							for (int var23 = 0; var23 < 10; var23++) {
								int var24 = (int) (Math.random() * 4.0D);
								if (var24 == 0 && var18 > 0 && var18 > var13 - 3 && (var22[var18 - 1][var19] & 0x280108) == 0) {
									var18--;
								}
								if (var24 == 1 && var18 < var20 - 1 && var18 < var13 + 3 && (var22[var18 + 1][var19] & 0x280180) == 0) {
									var18++;
								}
								if (var24 == 2 && var19 > 0 && var19 > var14 - 3 && (var22[var18][var19 - 1] & 0x280102) == 0) {
									var19--;
								}
								if (var24 == 3 && var19 < var21 - 1 && var19 < var14 + 3 && (var22[var18][var19 + 1] & 0x280120) == 0) {
									var19++;
								}
							}
						}
						this.activeMapFunctions[this.activeMapFunctionCount] = this.imageMapfunction[var17];
						this.activeMapFunctionX[this.activeMapFunctionCount] = var18;
						this.activeMapFunctionZ[this.activeMapFunctionCount] = var19;
						this.activeMapFunctionCount++;
					}
				}
			}
		}
		field1354++;
		if (field1354 > 112) {
			field1354 = 0;
			// ANTICHEAT_CYCLELOGIC3
			this.out.pIsaac(4);
			this.out.p1(50);
		}
	}

	@ObfuscatedName("client.d(I)V")
	public void locChangeDoQueue() {
		if (this.sceneState != 2) {
			return;
		}
		for (LocChange var2 = (LocChange) this.locChanges.head(); var2 != null; var2 = (LocChange) this.locChanges.next()) {
			if (var2.endTime > 0) {
				var2.endTime--;
			}
			if (var2.endTime != 0) {
				if (var2.startTime > 0) {
					var2.startTime--;
				}
				if (var2.startTime == 0 && var2.x >= 1 && var2.z >= 1 && var2.x <= 102 && var2.z <= 102 && (var2.newType < 0 || ClientBuild.changeLocAvailable(var2.newType, var2.newShape))) {
					this.locChangeUnchecked(var2.level, var2.newAngle, var2.newType, var2.z, var2.layer, var2.newShape, var2.x);
					var2.startTime = -1;
					if (var2.newType == var2.oldType && var2.oldType == -1) {
						var2.unlink();
					} else if (var2.newType == var2.oldType && var2.newAngle == var2.oldAngle && var2.newShape == var2.oldShape) {
						var2.unlink();
					}
				}
			} else if (var2.oldType < 0 || ClientBuild.changeLocAvailable(var2.oldType, var2.oldShape)) {
				this.locChangeUnchecked(var2.level, var2.oldAngle, var2.oldType, var2.z, var2.layer, var2.oldShape, var2.x);
				var2.unlink();
			}
		}
	}

	@ObfuscatedName("client.h(Z)V")
	public void soundsDoQueue() {
		for (int var2 = 0; var2 < this.waveCount; var2++) {
			if (this.waveDelay[var2] <= 0) {
				boolean var3 = false;
				try {
					if (this.waveIds[var2] != this.lastWaveId || this.waveLoops[var2] != this.lastWaveLoops) {
						Packet var4 = Wave.generate(this.waveLoops[var2], this.waveIds[var2]);
						if (System.currentTimeMillis() + (long) (var4.pos / 22) > this.lastWaveStartTime + (long) (this.lastWaveLength / 22)) {
							this.lastWaveLength = var4.pos;
							this.lastWaveStartTime = System.currentTimeMillis();
							if (this.saveWave(var4.data, var4.pos)) {
								this.lastWaveId = this.waveIds[var2];
								this.lastWaveLoops = this.waveLoops[var2];
							} else {
								var3 = true;
							}
						}
					} else if (!this.replayWave()) {
						var3 = true;
					}
				} catch (Exception var7) {
				}
				if (var3 && this.waveDelay[var2] != -5) {
					this.waveDelay[var2] = -5;
				} else {
					this.waveCount--;
					for (int var6 = var2; var6 < this.waveCount; var6++) {
						this.waveIds[var6] = this.waveIds[var6 + 1];
						this.waveLoops[var6] = this.waveLoops[var6 + 1];
						this.waveDelay[var6] = this.waveDelay[var6 + 1];
					}
					var2--;
				}
			} else {
				int var10002 = this.waveDelay[var2]--;
			}
		}
		if (this.nextMusicDelay > 0) {
			this.nextMusicDelay -= 20;
			if (this.nextMusicDelay < 0) {
				this.nextMusicDelay = 0;
			}
			if (this.nextMusicDelay == 0 && this.midiActive && !lowMem) {
				this.midiSong = this.nextMidiSong;
				this.midiFading = false;
				this.onDemand.request(2, this.midiSong);
			}
		}
	}

	@ObfuscatedName("client.c(Z)V")
	public void handleInput() {
		if (this.objDragArea != 0) {
			return;
		}
		this.menuOption[0] = "Cancel";
		this.menuAction[0] = 1106;
		this.menuSize = 1;
		this.handlePrivateChatInput();
		this.lastOverLayerId = 0;
		if (super.mouseX > 4 && super.mouseY > 4 && super.mouseX < 516 && super.mouseY < 338) {
			if (this.mainLayerId == -1) {
				this.handleViewportOptions();
			} else {
				this.handleComponentInput(super.mouseY, 4, IfType.list[this.mainLayerId], 4, super.mouseX, 0);
			}
		}
		if (this.lastOverLayerId != this.overMainLayerId) {
			this.overMainLayerId = this.lastOverLayerId;
		}
		this.lastOverLayerId = 0;
		if (super.mouseX > 553 && super.mouseY > 205 && super.mouseX < 743 && super.mouseY < 466) {
			if (this.sideLayerId != -1) {
				this.handleComponentInput(super.mouseY, 205, IfType.list[this.sideLayerId], 553, super.mouseX, 0);
			} else if (this.tabInterfaceId[this.sideTab] != -1) {
				this.handleComponentInput(super.mouseY, 205, IfType.list[this.tabInterfaceId[this.sideTab]], 553, super.mouseX, 0);
			}
		}
		if (this.lastOverLayerId != this.overSideLayerId) {
			this.redrawSidebar = true;
			this.overSideLayerId = this.lastOverLayerId;
		}
		this.lastOverLayerId = 0;
		if (super.mouseX > 17 && super.mouseY > 357 && super.mouseX < 496 && super.mouseY < 453) {
			if (this.chatLayerId != -1) {
				this.handleComponentInput(super.mouseY, 357, IfType.list[this.chatLayerId], 17, super.mouseX, 0);
			} else if (super.mouseY < 434 && super.mouseX < 426) {
				this.handleChatMouseInput(super.mouseY - 357, super.mouseX - 17);
			}
		}
		if (this.chatLayerId != -1 && this.lastOverLayerId != this.overChatLayerId) {
			this.redrawChatback = true;
			this.overChatLayerId = this.lastOverLayerId;
		}
		boolean var2 = false;
		while (!var2) {
			var2 = true;
			for (int var3 = 0; var3 < this.menuSize - 1; var3++) {
				if (this.menuAction[var3] < 1000 && this.menuAction[var3 + 1] > 1000) {
					String var4 = this.menuOption[var3];
					this.menuOption[var3] = this.menuOption[var3 + 1];
					this.menuOption[var3 + 1] = var4;
					int var5 = this.menuAction[var3];
					this.menuAction[var3] = this.menuAction[var3 + 1];
					this.menuAction[var3 + 1] = var5;
					int var6 = this.menuParamB[var3];
					this.menuParamB[var3] = this.menuParamB[var3 + 1];
					this.menuParamB[var3 + 1] = var6;
					int var7 = this.menuParamC[var3];
					this.menuParamC[var3] = this.menuParamC[var3 + 1];
					this.menuParamC[var3 + 1] = var7;
					int var8 = this.menuParamA[var3];
					this.menuParamA[var3] = this.menuParamA[var3 + 1];
					this.menuParamA[var3 + 1] = var8;
					var2 = false;
				}
			}
		}
	}

	@ObfuscatedName("client.r(I)V")
	public void handlePrivateChatInput() {
		if (this.splitPrivateChat == 0) {
			return;
		}
		int var2 = 0;
		if (this.systemUpdateTimer != 0) {
			var2 = 1;
		}
		for (int var3 = 0; var3 < 100; var3++) {
			if (this.messageText[var3] != null) {
				int var4 = this.messageType[var3];
				String var5 = this.messageSender[var3];
				boolean var6 = false;
				if (var5 != null && var5.startsWith("@cr1@")) {
					var5 = var5.substring(5);
					boolean var7 = true;
				}
				if (var5 != null && var5.startsWith("@cr2@")) {
					var5 = var5.substring(5);
					boolean var8 = true;
				}
				if ((var4 == 3 || var4 == 7) && (var4 == 7 || this.chatPrivateMode == 0 || this.chatPrivateMode == 1 && this.isFriend(var5))) {
					int var9 = 329 - var2 * 13;
					if (super.mouseX > 4 && super.mouseY - 4 > var9 - 10 && super.mouseY - 4 <= var9 + 3) {
						int var10 = this.fontPlain12.stringWid("From:  " + var5 + this.messageText[var3]) + 25;
						if (var10 > 450) {
							var10 = 450;
						}
						if (super.mouseX < var10 + 4) {
							if (this.staffmodlevel >= 1) {
								this.menuOption[this.menuSize] = "Report abuse @whi@" + var5;
								this.menuAction[this.menuSize] = 2524;
								this.menuSize++;
							}
							this.menuOption[this.menuSize] = "Add ignore @whi@" + var5;
							this.menuAction[this.menuSize] = 2047;
							this.menuSize++;
							this.menuOption[this.menuSize] = "Add friend @whi@" + var5;
							this.menuAction[this.menuSize] = 2605;
							this.menuSize++;
						}
					}
					var2++;
					if (var2 >= 5) {
						return;
					}
				}
				if ((var4 == 5 || var4 == 6) && this.chatPrivateMode < 2) {
					var2++;
					if (var2 >= 5) {
						return;
					}
				}
			}
		}
	}

	@ObfuscatedName("client.d(III)V")
	public void handleChatMouseInput(int arg0, int arg2) {
		int var4 = 0;
		for (int var5 = 0; var5 < 100; var5++) {
			if (this.messageText[var5] != null) {
				int var6 = this.messageType[var5];
				int var7 = 70 - var4 * 14 + this.chatScrollOffset + 4;
				if (var7 < -20) {
					break;
				}
				String var8 = this.messageSender[var5];
				boolean var9 = false;
				if (var8 != null && var8.startsWith("@cr1@")) {
					var8 = var8.substring(5);
					boolean var10 = true;
				}
				if (var8 != null && var8.startsWith("@cr2@")) {
					var8 = var8.substring(5);
					boolean var11 = true;
				}
				if (var6 == 0) {
					var4++;
				}
				if ((var6 == 1 || var6 == 2) && (var6 == 1 || this.chatPublicMode == 0 || this.chatPublicMode == 1 && this.isFriend(var8))) {
					if (arg0 > var7 - 14 && arg0 <= var7 && !var8.equals(localPlayer.name)) {
						if (this.staffmodlevel >= 1) {
							this.menuOption[this.menuSize] = "Report abuse @whi@" + var8;
							this.menuAction[this.menuSize] = 524;
							this.menuSize++;
						}
						this.menuOption[this.menuSize] = "Add ignore @whi@" + var8;
						this.menuAction[this.menuSize] = 47;
						this.menuSize++;
						this.menuOption[this.menuSize] = "Add friend @whi@" + var8;
						this.menuAction[this.menuSize] = 605;
						this.menuSize++;
					}
					var4++;
				}
				if ((var6 == 3 || var6 == 7) && this.splitPrivateChat == 0 && (var6 == 7 || this.chatPrivateMode == 0 || this.chatPrivateMode == 1 && this.isFriend(var8))) {
					if (arg0 > var7 - 14 && arg0 <= var7) {
						if (this.staffmodlevel >= 1) {
							this.menuOption[this.menuSize] = "Report abuse @whi@" + var8;
							this.menuAction[this.menuSize] = 524;
							this.menuSize++;
						}
						this.menuOption[this.menuSize] = "Add ignore @whi@" + var8;
						this.menuAction[this.menuSize] = 47;
						this.menuSize++;
						this.menuOption[this.menuSize] = "Add friend @whi@" + var8;
						this.menuAction[this.menuSize] = 605;
						this.menuSize++;
					}
					var4++;
				}
				if (var6 == 4 && (this.chatTradeMode == 0 || this.chatTradeMode == 1 && this.isFriend(var8))) {
					if (arg0 > var7 - 14 && arg0 <= var7) {
						this.menuOption[this.menuSize] = "Accept trade @whi@" + var8;
						this.menuAction[this.menuSize] = 507;
						this.menuSize++;
					}
					var4++;
				}
				if ((var6 == 5 || var6 == 6) && this.splitPrivateChat == 0 && this.chatPrivateMode < 2) {
					var4++;
				}
				if (var6 == 8 && (this.chatTradeMode == 0 || this.chatTradeMode == 1 && this.isFriend(var8))) {
					if (arg0 > var7 - 14 && arg0 <= var7) {
						this.menuOption[this.menuSize] = "Accept duel @whi@" + var8;
						this.menuAction[this.menuSize] = 957;
						this.menuSize++;
					}
					var4++;
				}
			}
		}
	}

	@ObfuscatedName("client.w(I)V")
	public void handleViewportOptions() {
		if (this.objSelected == 0 && this.spellSelected == 0) {
			this.menuOption[this.menuSize] = "Walk here";
			this.menuAction[this.menuSize] = 718;
			this.menuParamB[this.menuSize] = super.mouseX;
			this.menuParamC[this.menuSize] = super.mouseY;
			this.menuSize++;
		}
		int var2 = -1;
		for (int var3 = 0; var3 < Model.pickedCount; var3++) {
			int var4 = Model.pickedBitsets[var3];
			int var5 = var4 & 0x7F;
			int var6 = var4 >> 7 & 0x7F;
			int var7 = var4 >> 29 & 0x3;
			int var8 = var4 >> 14 & 0x7FFF;
			if (var4 != var2) {
				var2 = var4;
				if (var7 == 2 && this.world.typecode2(this.minusedlevel, var5, var6, var4) >= 0) {
					LocType var9 = LocType.get(var8);
					if (this.objSelected == 1) {
						this.menuOption[this.menuSize] = "Use " + this.objSelectedName + " with @cya@" + var9.name;
						this.menuAction[this.menuSize] = 810;
						this.menuParamA[this.menuSize] = var4;
						this.menuParamB[this.menuSize] = var5;
						this.menuParamC[this.menuSize] = var6;
						this.menuSize++;
					} else if (this.spellSelected != 1) {
						if (var9.op != null) {
							for (int var10 = 4; var10 >= 0; var10--) {
								if (var9.op[var10] != null) {
									this.menuOption[this.menuSize] = var9.op[var10] + " @cya@" + var9.name;
									if (var10 == 0) {
										this.menuAction[this.menuSize] = 625;
									}
									if (var10 == 1) {
										this.menuAction[this.menuSize] = 721;
									}
									if (var10 == 2) {
										this.menuAction[this.menuSize] = 743;
									}
									if (var10 == 3) {
										this.menuAction[this.menuSize] = 357;
									}
									if (var10 == 4) {
										this.menuAction[this.menuSize] = 1071;
									}
									this.menuParamA[this.menuSize] = var4;
									this.menuParamB[this.menuSize] = var5;
									this.menuParamC[this.menuSize] = var6;
									this.menuSize++;
								}
							}
						}
						this.menuOption[this.menuSize] = "Examine @cya@" + var9.name;
						this.menuAction[this.menuSize] = 1381;
						this.menuParamA[this.menuSize] = var4;
						this.menuParamB[this.menuSize] = var5;
						this.menuParamC[this.menuSize] = var6;
						this.menuSize++;
					} else if ((this.activeSpellFlags & 0x4) == 4) {
						this.menuOption[this.menuSize] = this.spellCaption + " @cya@" + var9.name;
						this.menuAction[this.menuSize] = 899;
						this.menuParamA[this.menuSize] = var4;
						this.menuParamB[this.menuSize] = var5;
						this.menuParamC[this.menuSize] = var6;
						this.menuSize++;
					}
				}
				if (var7 == 1) {
					ClientNpc var11 = this.npcs[var8];
					if (var11.type.size == 1 && (var11.x & 0x7F) == 64 && (var11.z & 0x7F) == 64) {
						for (int var12 = 0; var12 < this.npcCount; var12++) {
							ClientNpc var13 = this.npcs[this.npcIds[var12]];
							if (var13 != null && var13 != var11 && var13.type.size == 1 && var13.x == var11.x && var13.z == var11.z) {
								this.addNpcOptions(var5, var13.type, this.npcIds[var12], var6);
							}
						}
					}
					this.addNpcOptions(var5, var11.type, var8, var6);
				}
				if (var7 == 0) {
					ClientPlayer var14 = this.players[var8];
					if ((var14.x & 0x7F) == 64 && (var14.z & 0x7F) == 64) {
						for (int var15 = 0; var15 < this.npcCount; var15++) {
							ClientNpc var16 = this.npcs[this.npcIds[var15]];
							if (var16 != null && var16.type.size == 1 && var16.x == var14.x && var16.z == var14.z) {
								this.addNpcOptions(var5, var16.type, this.npcIds[var15], var6);
							}
						}
						for (int var17 = 0; var17 < this.playerCount; var17++) {
							ClientPlayer var18 = this.players[this.playerIds[var17]];
							if (var18 != null && var18 != var14 && var18.x == var14.x && var18.z == var14.z) {
								this.addPlayerOptions(var6, this.playerIds[var17], var5, var18);
							}
						}
					}
					this.addPlayerOptions(var6, var8, var5, var14);
				}
				if (var7 == 3) {
					LinkList var19 = this.objStacks[this.minusedlevel][var5][var6];
					if (var19 != null) {
						for (ClientObj var20 = (ClientObj) var19.tail(); var20 != null; var20 = (ClientObj) var19.prev()) {
							ObjType var21 = ObjType.get(var20.id);
							if (this.objSelected == 1) {
								this.menuOption[this.menuSize] = "Use " + this.objSelectedName + " with @lre@" + var21.name;
								this.menuAction[this.menuSize] = 111;
								this.menuParamA[this.menuSize] = var20.id;
								this.menuParamB[this.menuSize] = var5;
								this.menuParamC[this.menuSize] = var6;
								this.menuSize++;
							} else if (this.spellSelected != 1) {
								for (int var22 = 4; var22 >= 0; var22--) {
									if (var21.op != null && var21.op[var22] != null) {
										this.menuOption[this.menuSize] = var21.op[var22] + " @lre@" + var21.name;
										if (var22 == 0) {
											this.menuAction[this.menuSize] = 139;
										}
										if (var22 == 1) {
											this.menuAction[this.menuSize] = 778;
										}
										if (var22 == 2) {
											this.menuAction[this.menuSize] = 617;
										}
										if (var22 == 3) {
											this.menuAction[this.menuSize] = 224;
										}
										if (var22 == 4) {
											this.menuAction[this.menuSize] = 662;
										}
										this.menuParamA[this.menuSize] = var20.id;
										this.menuParamB[this.menuSize] = var5;
										this.menuParamC[this.menuSize] = var6;
										this.menuSize++;
									} else if (var22 == 2) {
										this.menuOption[this.menuSize] = "Take @lre@" + var21.name;
										this.menuAction[this.menuSize] = 617;
										this.menuParamA[this.menuSize] = var20.id;
										this.menuParamB[this.menuSize] = var5;
										this.menuParamC[this.menuSize] = var6;
										this.menuSize++;
									}
								}
								this.menuOption[this.menuSize] = "Examine @lre@" + var21.name;
								this.menuAction[this.menuSize] = 1152;
								this.menuParamA[this.menuSize] = var20.id;
								this.menuParamB[this.menuSize] = var5;
								this.menuParamC[this.menuSize] = var6;
								this.menuSize++;
							} else if ((this.activeSpellFlags & 0x1) == 1) {
								this.menuOption[this.menuSize] = this.spellCaption + " @lre@" + var21.name;
								this.menuAction[this.menuSize] = 370;
								this.menuParamA[this.menuSize] = var20.id;
								this.menuParamB[this.menuSize] = var5;
								this.menuParamC[this.menuSize] = var6;
								this.menuSize++;
							}
						}
					}
				}
			}
		}
	}

	@ObfuscatedName("client.A(I)V")
	public void handleMouseInput() {
		if (this.objDragArea != 0) {
			return;
		}
		int var2 = super.mouseClickButton;
		if (this.spellSelected == 1 && super.mouseClickX >= 516 && super.mouseClickY >= 160 && super.mouseClickX <= 765 && super.mouseClickY <= 205) {
			var2 = 0;
		}
		if (!this.menuVisible) {
			if (var2 == 1 && this.menuSize > 0) {
				int var13 = this.menuAction[this.menuSize - 1];
				if (var13 == 582 || var13 == 113 || var13 == 555 || var13 == 331 || var13 == 354 || var13 == 694 || var13 == 962 || var13 == 795 || var13 == 681 || var13 == 100 || var13 == 102 || var13 == 1328) {
					int var14 = this.menuParamB[this.menuSize - 1];
					int var15 = this.menuParamC[this.menuSize - 1];
					IfType var16 = IfType.list[var15];
					if (var16.draggable || var16.swappable) {
						this.objGrabThreshold = false;
						this.objDragCycles = 0;
						this.objDragInterfaceId = var15;
						this.objDragSlot = var14;
						this.objDragArea = 2;
						this.objGrabX = super.mouseClickX;
						this.objGrabY = super.mouseClickY;
						if (IfType.list[var15].layerId == this.mainLayerId) {
							this.objDragArea = 1;
						}
						if (IfType.list[var15].layerId == this.chatLayerId) {
							this.objDragArea = 3;
						}
						return;
					}
				}
			}
			if (var2 == 1 && (this.oneMouseButton == 1 || this.isAddFriendOption(this.menuSize - 1)) && this.menuSize > 2) {
				var2 = 2;
			}
			if (var2 == 1 && this.menuSize > 0) {
				this.useMenuOption(this.menuSize - 1);
			}
			if (var2 != 2 || this.menuSize <= 0) {
				return;
			}
			this.showContextMenu();
			return;
		}
		if (var2 != 1) {
			int var3 = super.mouseX;
			int var4 = super.mouseY;
			if (this.menuArea == 0) {
				var3 -= 4;
				var4 -= 4;
			}
			if (this.menuArea == 1) {
				var3 -= 553;
				var4 -= 205;
			}
			if (this.menuArea == 2) {
				var3 -= 17;
				var4 -= 357;
			}
			if (var3 < this.menuX - 10 || var3 > this.menuX + this.menuWidth + 10 || var4 < this.menuY - 10 || var4 > this.menuY + this.menuHeight + 10) {
				this.menuVisible = false;
				if (this.menuArea == 1) {
					this.redrawSidebar = true;
				}
				if (this.menuArea == 2) {
					this.redrawChatback = true;
				}
			}
		}
		if (var2 == 1) {
			int var5 = this.menuX;
			int var6 = this.menuY;
			int var7 = this.menuWidth;
			int var8 = super.mouseClickX;
			int var9 = super.mouseClickY;
			if (this.menuArea == 0) {
				var8 -= 4;
				var9 -= 4;
			}
			if (this.menuArea == 1) {
				var8 -= 553;
				var9 -= 205;
			}
			if (this.menuArea == 2) {
				var8 -= 17;
				var9 -= 357;
			}
			int var10 = -1;
			for (int var11 = 0; var11 < this.menuSize; var11++) {
				int var12 = var6 + 31 + (this.menuSize - 1 - var11) * 15;
				if (var8 > var5 && var8 < var5 + var7 && var9 > var12 - 13 && var9 < var12 + 3) {
					var10 = var11;
				}
			}
			if (var10 != -1) {
				this.useMenuOption(var10);
			}
			this.menuVisible = false;
			if (this.menuArea == 1) {
				this.redrawSidebar = true;
			}
			if (this.menuArea == 2) {
				this.redrawChatback = true;
			}
		}
	}

	@ObfuscatedName("client.g(B)V")
	public void handleMinimapInput() {
		if (super.mouseClickButton != 1) {
			return;
		}
		int var3 = super.mouseClickX - 25 - 550;
		int var4 = super.mouseClickY - 5 - 4;
		if (var3 < 0 || var4 < 0 || var3 >= 146 || var4 >= 151) {
			return;
		}
		var3 -= 73;
		var4 -= 75;
		int var5 = this.orbitCameraYaw + this.macroMinimapAngle & 0x7FF;
		int var6 = Pix3D.sinTable[var5];
		int var7 = Pix3D.cosTable[var5];
		int var8 = var6 * (this.macroMinimapZoom + 256) >> 8;
		int var9 = var7 * (this.macroMinimapZoom + 256) >> 8;
		int var10 = var4 * var8 + var3 * var9 >> 11;
		int var11 = var4 * var9 - var3 * var8 >> 11;
		int var12 = localPlayer.x + var10 >> 7;
		int var13 = localPlayer.z - var11 >> 7;
		boolean var14 = this.tryMove(0, 0, 0, var12, 1, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var13, true, 0, 0);
		if (var14) {
			this.out.p1(var3);
			this.out.p1(var4);
			this.out.p2(this.orbitCameraYaw);
			this.out.p1(57);
			this.out.p1(this.macroMinimapAngle);
			this.out.p1(this.macroMinimapZoom);
			this.out.p1(89);
			this.out.p2(localPlayer.x);
			this.out.p2(localPlayer.z);
			this.out.p1(this.tryMoveNearest);
			this.out.p1(63);
		}
	}

	@ObfuscatedName("client.p(I)V")
	public void handleTabInput() {
		if (super.mouseClickButton != 1) {
			return;
		}
		if (super.mouseClickX >= 539 && super.mouseClickX <= 573 && super.mouseClickY >= 169 && super.mouseClickY < 205 && this.tabInterfaceId[0] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 0;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 569 && super.mouseClickX <= 599 && super.mouseClickY >= 168 && super.mouseClickY < 205 && this.tabInterfaceId[1] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 1;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 597 && super.mouseClickX <= 627 && super.mouseClickY >= 168 && super.mouseClickY < 205 && this.tabInterfaceId[2] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 2;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 625 && super.mouseClickX <= 669 && super.mouseClickY >= 168 && super.mouseClickY < 203 && this.tabInterfaceId[3] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 3;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 666 && super.mouseClickX <= 696 && super.mouseClickY >= 168 && super.mouseClickY < 205 && this.tabInterfaceId[4] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 4;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 694 && super.mouseClickX <= 724 && super.mouseClickY >= 168 && super.mouseClickY < 205 && this.tabInterfaceId[5] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 5;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 722 && super.mouseClickX <= 756 && super.mouseClickY >= 169 && super.mouseClickY < 205 && this.tabInterfaceId[6] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 6;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 540 && super.mouseClickX <= 574 && super.mouseClickY >= 466 && super.mouseClickY < 502 && this.tabInterfaceId[7] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 7;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 572 && super.mouseClickX <= 602 && super.mouseClickY >= 466 && super.mouseClickY < 503 && this.tabInterfaceId[8] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 8;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 599 && super.mouseClickX <= 629 && super.mouseClickY >= 466 && super.mouseClickY < 503 && this.tabInterfaceId[9] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 9;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 627 && super.mouseClickX <= 671 && super.mouseClickY >= 467 && super.mouseClickY < 502 && this.tabInterfaceId[10] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 10;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 669 && super.mouseClickX <= 699 && super.mouseClickY >= 466 && super.mouseClickY < 503 && this.tabInterfaceId[11] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 11;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 696 && super.mouseClickX <= 726 && super.mouseClickY >= 466 && super.mouseClickY < 503 && this.tabInterfaceId[12] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 12;
			this.redrawSideicons = true;
		}
		if (super.mouseClickX >= 724 && super.mouseClickX <= 758 && super.mouseClickY >= 466 && super.mouseClickY < 502 && this.tabInterfaceId[13] != -1) {
			this.redrawSidebar = true;
			this.sideTab = 13;
			this.redrawSideicons = true;
		}
	}

	@ObfuscatedName("client.o(B)V")
	public void handleChatModeInput() {
		if (super.mouseClickButton != 1) {
			return;
		}
		if (super.mouseClickX >= 6 && super.mouseClickX <= 106 && super.mouseClickY >= 467 && super.mouseClickY <= 499) {
			this.chatPublicMode = (this.chatPublicMode + 1) % 4;
			this.redrawPrivacySettings = true;
			this.redrawChatback = true;
			// CHAT_SETMODE
			this.out.pIsaac(129);
			this.out.p1(this.chatPublicMode);
			this.out.p1(this.chatPrivateMode);
			this.out.p1(this.chatTradeMode);
		}
		if (super.mouseClickX >= 135 && super.mouseClickX <= 235 && super.mouseClickY >= 467 && super.mouseClickY <= 499) {
			this.chatPrivateMode = (this.chatPrivateMode + 1) % 3;
			this.redrawPrivacySettings = true;
			this.redrawChatback = true;
			// CHAT_SETMODE
			this.out.pIsaac(129);
			this.out.p1(this.chatPublicMode);
			this.out.p1(this.chatPrivateMode);
			this.out.p1(this.chatTradeMode);
		}
		if (super.mouseClickX >= 273 && super.mouseClickX <= 373 && super.mouseClickY >= 467 && super.mouseClickY <= 499) {
			this.chatTradeMode = (this.chatTradeMode + 1) % 3;
			this.redrawPrivacySettings = true;
			this.redrawChatback = true;
			// CHAT_SETMODE
			this.out.pIsaac(129);
			this.out.p1(this.chatPublicMode);
			this.out.p1(this.chatPrivateMode);
			this.out.p1(this.chatTradeMode);
		}
		if (super.mouseClickX >= 412 && super.mouseClickX <= 512 && super.mouseClickY >= 467 && super.mouseClickY <= 499) {
			this.closeModal();
			this.reportAbuseInput = "";
			this.reportAbuseMuteOption = false;
			for (int var2 = 0; var2 < IfType.list.length; var2++) {
				if (IfType.list[var2] != null && IfType.list[var2].clientCode == 600) {
					this.reportAbuseInterfaceId = this.mainLayerId = IfType.list[var2].layerId;
					return;
				}
			}
		}
	}

	@ObfuscatedName("client.g(I)V")
	public void closeModal() {
		// CLOSE_MODAL
		this.out.pIsaac(58);
		if (this.sideLayerId != -1) {
			this.sideLayerId = -1;
			this.redrawSidebar = true;
			this.pressedContinueOption = false;
			this.redrawSideicons = true;
		}
		if (this.chatLayerId != -1) {
			this.chatLayerId = -1;
			this.redrawChatback = true;
			this.pressedContinueOption = false;
		}
		this.mainLayerId = -1;
	}

	@ObfuscatedName("client.e(B)V")
	public void timeoutChat() {
		for (int var2 = -1; var2 < this.playerCount; var2++) {
			int var3;
			if (var2 == -1) {
				var3 = this.LOCAL_PLAYER_INDEX;
			} else {
				var3 = this.playerIds[var2];
			}
			ClientPlayer var4 = this.players[var3];
			if (var4 != null && var4.chatTimer > 0) {
				var4.chatTimer--;
				if (var4.chatTimer == 0) {
					var4.chatMessage = null;
				}
			}
		}
		for (int var5 = 0; var5 < this.npcCount; var5++) {
			int var6 = this.npcIds[var5];
			ClientNpc var7 = this.npcs[var6];
			if (var7 != null && var7.chatTimer > 0) {
				var7.chatTimer--;
				if (var7.chatTimer == 0) {
					var7.chatMessage = null;
				}
			}
		}
	}

	@ObfuscatedName("client.f(I)V")
	public void followCamera() {
		try {
			int var2 = localPlayer.x + this.macroCameraX;
			int var3 = localPlayer.z + this.macroCameraZ;
			if (this.orbitCameraX - var2 < -500 || this.orbitCameraX - var2 > 500 || this.orbitCameraZ - var3 < -500 || this.orbitCameraZ - var3 > 500) {
				this.orbitCameraX = var2;
				this.orbitCameraZ = var3;
			}
			if (this.orbitCameraX != var2) {
				this.orbitCameraX += (var2 - this.orbitCameraX) / 16;
			}
			if (this.orbitCameraZ != var3) {
				this.orbitCameraZ += (var3 - this.orbitCameraZ) / 16;
			}
			if (super.actionKey[1] == 1) {
				this.orbitCameraYawVelocity += (-24 - this.orbitCameraYawVelocity) / 2;
			} else if (super.actionKey[2] == 1) {
				this.orbitCameraYawVelocity += (24 - this.orbitCameraYawVelocity) / 2;
			} else {
				this.orbitCameraYawVelocity /= 2;
			}
			if (super.actionKey[3] == 1) {
				this.orbitCameraPitchVelocity += (12 - this.orbitCameraPitchVelocity) / 2;
			} else if (super.actionKey[4] == 1) {
				this.orbitCameraPitchVelocity += (-12 - this.orbitCameraPitchVelocity) / 2;
			} else {
				this.orbitCameraPitchVelocity /= 2;
			}
			this.orbitCameraYaw = this.orbitCameraYaw + this.orbitCameraYawVelocity / 2 & 0x7FF;
			this.orbitCameraPitch += this.orbitCameraPitchVelocity / 2;
			if (this.orbitCameraPitch < 128) {
				this.orbitCameraPitch = 128;
			}
			if (this.orbitCameraPitch > 383) {
				this.orbitCameraPitch = 383;
			}
			int var4 = this.orbitCameraX >> 7;
			int var5 = this.orbitCameraZ >> 7;
			int var6 = this.getAvH(this.orbitCameraZ, this.minusedlevel, this.orbitCameraX);
			int var7 = 0;
			if (var4 > 3 && var5 > 3 && var4 < 100 && var5 < 100) {
				for (int var8 = var4 - 4; var8 <= var4 + 4; var8++) {
					for (int var9 = var5 - 4; var9 <= var5 + 4; var9++) {
						int var10 = this.minusedlevel;
						if (var10 < 3 && (this.mapl[1][var8][var9] & 0x2) == 2) {
							var10++;
						}
						int var11 = var6 - this.groundh[var10][var8][var9];
						if (var11 > var7) {
							var7 = var11;
						}
					}
				}
			}
			int var12 = var7 * 192;
			if (var12 > 98048) {
				var12 = 98048;
			}
			if (var12 < 32768) {
				var12 = 32768;
			}
			if (var12 > this.cameraPitchClamp) {
				this.cameraPitchClamp += (var12 - this.cameraPitchClamp) / 24;
			} else if (var12 < this.cameraPitchClamp) {
				this.cameraPitchClamp += (var12 - this.cameraPitchClamp) / 80;
			}
		} catch (Exception var13) {
			signlink.reporterror("glfc_ex " + localPlayer.x + "," + localPlayer.z + "," + this.orbitCameraX + "," + this.orbitCameraZ + "," + this.sceneCenterZoneX + "," + this.sceneCenterZoneZ + "," + this.sceneBaseTileX + "," + this.sceneBaseTileZ);
			throw new RuntimeException("eek");
		}
	}

	@ObfuscatedName("client.v(I)V")
	public void cinemaCamera() {
		int var2 = this.cutsceneSrcLocalTileX * 128 + 64;
		int var3 = this.cutsceneSrcLocalTileZ * 128 + 64;
		int var4 = this.getAvH(var3, this.minusedlevel, var2) - this.cutsceneSrcHeight;
		if (this.cameraX < var2) {
			this.cameraX += this.cutsceneMoveSpeed + (var2 - this.cameraX) * this.cutsceneMoveAcceleration / 1000;
			if (this.cameraX > var2) {
				this.cameraX = var2;
			}
		}
		if (this.cameraX > var2) {
			this.cameraX -= this.cutsceneMoveSpeed + (this.cameraX - var2) * this.cutsceneMoveAcceleration / 1000;
			if (this.cameraX < var2) {
				this.cameraX = var2;
			}
		}
		if (this.cameraY < var4) {
			this.cameraY += this.cutsceneMoveSpeed + (var4 - this.cameraY) * this.cutsceneMoveAcceleration / 1000;
			if (this.cameraY > var4) {
				this.cameraY = var4;
			}
		}
		if (this.cameraY > var4) {
			this.cameraY -= this.cutsceneMoveSpeed + (this.cameraY - var4) * this.cutsceneMoveAcceleration / 1000;
			if (this.cameraY < var4) {
				this.cameraY = var4;
			}
		}
		if (this.cameraZ < var3) {
			this.cameraZ += this.cutsceneMoveSpeed + (var3 - this.cameraZ) * this.cutsceneMoveAcceleration / 1000;
			if (this.cameraZ > var3) {
				this.cameraZ = var3;
			}
		}
		if (this.cameraZ > var3) {
			this.cameraZ -= this.cutsceneMoveSpeed + (this.cameraZ - var3) * this.cutsceneMoveAcceleration / 1000;
			if (this.cameraZ < var3) {
				this.cameraZ = var3;
			}
		}
		int var5 = this.cutsceneDstLocalTileX * 128 + 64;
		int var6 = this.cutsceneDstLocalTileZ * 128 + 64;
		int var7 = this.getAvH(var6, this.minusedlevel, var5) - this.cutsceneDstHeight;
		int var8 = var5 - this.cameraX;
		int var9 = var7 - this.cameraY;
		int var10 = var6 - this.cameraZ;
		int var11 = (int) Math.sqrt((double) (var8 * var8 + var10 * var10));
		int var12 = (int) (Math.atan2((double) var9, (double) var11) * 325.949D) & 0x7FF;
		int var13 = (int) (Math.atan2((double) var8, (double) var10) * -325.949D) & 0x7FF;
		if (var12 < 128) {
			var12 = 128;
		}
		if (var12 > 383) {
			var12 = 383;
		}
		if (this.cameraPitch < var12) {
			this.cameraPitch += this.cutsceneRotateSpeed + (var12 - this.cameraPitch) * this.cutsceneRotateAcceleration / 1000;
			if (this.cameraPitch > var12) {
				this.cameraPitch = var12;
			}
		}
		if (this.cameraPitch > var12) {
			this.cameraPitch -= this.cutsceneRotateSpeed + (this.cameraPitch - var12) * this.cutsceneRotateAcceleration / 1000;
			if (this.cameraPitch < var12) {
				this.cameraPitch = var12;
			}
		}
		int var14 = var13 - this.cameraYaw;
		if (var14 > 1024) {
			var14 -= 2048;
		}
		if (var14 < -1024) {
			var14 += 2048;
		}
		if (var14 > 0) {
			this.cameraYaw += this.cutsceneRotateSpeed + var14 * this.cutsceneRotateAcceleration / 1000;
			this.cameraYaw &= 0x7FF;
		}
		if (var14 < 0) {
			this.cameraYaw -= this.cutsceneRotateSpeed + -var14 * this.cutsceneRotateAcceleration / 1000;
			this.cameraYaw &= 0x7FF;
		}
		int var15 = var13 - this.cameraYaw;
		if (var15 > 1024) {
			var15 -= 2048;
		}
		if (var15 < -1024) {
			var15 += 2048;
		}
		if (var15 < 0 && var14 > 0 || var15 > 0 && var14 < 0) {
			this.cameraYaw = var13;
		}
	}

	@ObfuscatedName("client.n(I)V")
	public void handleInputKey() {
		field1339++;
		if (field1339 > 192) {
			field1339 = 0;
			// ANTICHEAT_CYCLELOGIC4
			this.out.pIsaac(226);
			this.out.p1(232);
		}
		while (true) {
			int var2;
			do {
				while (true) {
					var2 = this.pollKey();
					if (var2 == -1) {
						return;
					}
					if (this.mainLayerId != -1 && this.mainLayerId == this.reportAbuseInterfaceId) {
						if (var2 == 8 && this.reportAbuseInput.length() > 0) {
							this.reportAbuseInput = this.reportAbuseInput.substring(0, this.reportAbuseInput.length() - 1);
						}
						break;
					}
					if (this.showSocialInput) {
						if (var2 >= 32 && var2 <= 122 && this.socialInput.length() < 80) {
							this.socialInput = this.socialInput + (char) var2;
							this.redrawChatback = true;
						}
						if (var2 == 8 && this.socialInput.length() > 0) {
							this.socialInput = this.socialInput.substring(0, this.socialInput.length() - 1);
							this.redrawChatback = true;
						}
						if (var2 == 13 || var2 == 10) {
							this.showSocialInput = false;
							this.redrawChatback = true;
							if (this.socialInputType == 1) {
								long var3 = JString.toBase37(this.socialInput);
								this.addFriend(var3);
							}
							if (this.socialInputType == 2 && this.friendCount > 0) {
								long var5 = JString.toBase37(this.socialInput);
								this.delFriend(var5);
							}
							if (this.socialInputType == 3 && this.socialInput.length() > 0) {
								// MESSAGE_PRIVATE
								this.out.pIsaac(214);
								this.out.p1(0);
								int var7 = this.out.pos;
								this.out.p8(this.socialName37);
								WordPack.pack(this.out, this.socialInput);
								this.out.psize1(this.out.pos - var7);
								this.socialInput = JString.toSentenceCase(this.socialInput);
								this.socialInput = WordFilter.filter(this.socialInput);
								this.addChat(JString.formatDisplayName(JString.fromBase37(this.socialName37)), 6, this.socialInput);
								if (this.chatPrivateMode == 2) {
									this.chatPrivateMode = 1;
									this.redrawPrivacySettings = true;
									// CHAT_SETMODE
									this.out.pIsaac(129);
									this.out.p1(this.chatPublicMode);
									this.out.p1(this.chatPrivateMode);
									this.out.p1(this.chatTradeMode);
								}
							}
							if (this.socialInputType == 4 && this.ignoreCount < 100) {
								long var8 = JString.toBase37(this.socialInput);
								this.addIgnore(var8);
							}
							if (this.socialInputType == 5 && this.ignoreCount > 0) {
								long var10 = JString.toBase37(this.socialInput);
								this.delIgnore(var10);
							}
						}
					} else if (this.chatbackInputOpen) {
						if (var2 >= 48 && var2 <= 57 && this.chatbackInput.length() < 10) {
							this.chatbackInput = this.chatbackInput + (char) var2;
							this.redrawChatback = true;
						}
						if (var2 == 8 && this.chatbackInput.length() > 0) {
							this.chatbackInput = this.chatbackInput.substring(0, this.chatbackInput.length() - 1);
							this.redrawChatback = true;
						}
						if (var2 == 13 || var2 == 10) {
							if (this.chatbackInput.length() > 0) {
								int var12 = 0;
								try {
									var12 = Integer.parseInt(this.chatbackInput);
								} catch (Exception var17) {
								}
								// RESUME_P_COUNTDIALOG
								this.out.pIsaac(161);
								this.out.p4(var12);
							}
							this.chatbackInputOpen = false;
							this.redrawChatback = true;
						}
					} else if (this.chatLayerId == -1) {
						if (var2 >= 32 && (var2 <= 122 || (this.chatTyped.startsWith("::") && var2 <= 126)) && this.chatTyped.length() < 80) {
							this.chatTyped = this.chatTyped + (char) var2;
							this.redrawChatback = true;
						}
						if (var2 == 8 && this.chatTyped.length() > 0) {
							this.chatTyped = this.chatTyped.substring(0, this.chatTyped.length() - 1);
							this.redrawChatback = true;
						}
						if ((var2 == 13 || var2 == 10) && this.chatTyped.length() > 0) {
							if (this.staffmodlevel == 2) {
								if (this.chatTyped.equals("::clientdrop")) {
									this.tryReconnect();
								}
								if (this.chatTyped.equals("::lag")) {
									this.lag();
								}
								if (this.chatTyped.equals("::prefetchmusic")) {
									for (int var13 = 0; var13 < this.onDemand.getFileCount(2); var13++) {
										this.onDemand.prefetchPriority(2, (byte) 1, var13);
									}
								}
							}
							if (this.chatTyped.startsWith("::")) {
								// CLIENT_CHEAT
								this.out.pIsaac(86);
								this.out.p1(this.chatTyped.length() - 1);
								this.out.pjstr(this.chatTyped.substring(2));
							} else {
								byte var14 = 0;
								if (this.chatTyped.startsWith("yellow:")) {
									var14 = 0;
									this.chatTyped = this.chatTyped.substring(7);
								}
								if (this.chatTyped.startsWith("red:")) {
									var14 = 1;
									this.chatTyped = this.chatTyped.substring(4);
								}
								if (this.chatTyped.startsWith("green:")) {
									var14 = 2;
									this.chatTyped = this.chatTyped.substring(6);
								}
								if (this.chatTyped.startsWith("cyan:")) {
									var14 = 3;
									this.chatTyped = this.chatTyped.substring(5);
								}
								if (this.chatTyped.startsWith("purple:")) {
									var14 = 4;
									this.chatTyped = this.chatTyped.substring(7);
								}
								if (this.chatTyped.startsWith("white:")) {
									var14 = 5;
									this.chatTyped = this.chatTyped.substring(6);
								}
								if (this.chatTyped.startsWith("flash1:")) {
									var14 = 6;
									this.chatTyped = this.chatTyped.substring(7);
								}
								if (this.chatTyped.startsWith("flash2:")) {
									var14 = 7;
									this.chatTyped = this.chatTyped.substring(7);
								}
								if (this.chatTyped.startsWith("flash3:")) {
									var14 = 8;
									this.chatTyped = this.chatTyped.substring(7);
								}
								if (this.chatTyped.startsWith("glow1:")) {
									var14 = 9;
									this.chatTyped = this.chatTyped.substring(6);
								}
								if (this.chatTyped.startsWith("glow2:")) {
									var14 = 10;
									this.chatTyped = this.chatTyped.substring(6);
								}
								if (this.chatTyped.startsWith("glow3:")) {
									var14 = 11;
									this.chatTyped = this.chatTyped.substring(6);
								}
								byte var15 = 0;
								if (this.chatTyped.startsWith("wave:")) {
									var15 = 1;
									this.chatTyped = this.chatTyped.substring(5);
								}
								if (this.chatTyped.startsWith("scroll:")) {
									var15 = 2;
									this.chatTyped = this.chatTyped.substring(7);
								}
								// MESSAGE_PUBLIC
								this.out.pIsaac(83);
								this.out.p1(0);
								int var16 = this.out.pos;
								this.out.p1(var14);
								this.out.p1(var15);
								WordPack.pack(this.out, this.chatTyped);
								this.out.psize1(this.out.pos - var16);
								this.chatTyped = JString.toSentenceCase(this.chatTyped);
								this.chatTyped = WordFilter.filter(this.chatTyped);
								localPlayer.chatMessage = this.chatTyped;
								localPlayer.chatColour = var14;
								localPlayer.chatEffect = var15;
								localPlayer.chatTimer = 150;
								if (this.staffmodlevel == 2) {
									this.addChat("@cr2@" + localPlayer.name, 2, localPlayer.chatMessage);
								} else if (this.staffmodlevel == 1) {
									this.addChat("@cr1@" + localPlayer.name, 2, localPlayer.chatMessage);
								} else {
									this.addChat(localPlayer.name, 2, localPlayer.chatMessage);
								}
								if (this.chatPublicMode == 2) {
									this.chatPublicMode = 3;
									this.redrawPrivacySettings = true;
									// CHAT_SETMODE
									this.out.pIsaac(129);
									this.out.p1(this.chatPublicMode);
									this.out.p1(this.chatPrivateMode);
									this.out.p1(this.chatTradeMode);
								}
							}
							this.chatTyped = "";
							this.redrawChatback = true;
						}
					}
				}
			} while ((var2 < 97 || var2 > 122) && (var2 < 65 || var2 > 90) && (var2 < 48 || var2 > 57) && var2 != 32);
			if (this.reportAbuseInput.length() < 12) {
				this.reportAbuseInput = this.reportAbuseInput + (char) var2;
			}
		}
	}

	@ObfuscatedName("client.t(I)V")
	public void lag() {
		System.out.println("============");
		System.out.println("flame-cycle:" + this.flameCycle);
		if (this.onDemand != null) {
			System.out.println("Od-cycle:" + this.onDemand.cycle);
		}
		System.out.println("loop-cycle:" + loopCycle);
		System.out.println("draw-cycle:" + drawCycle);
		System.out.println("ptype:" + this.ptype);
		System.out.println("psize:" + this.psize);
		if (this.stream != null) {
			this.stream.debug();
		}
		super.debug = true;
	}

	@ObfuscatedName("client.B(I)V")
	public void movePlayers() {
		for (int var2 = -1; var2 < this.playerCount; var2++) {
			int var3;
			if (var2 == -1) {
				var3 = this.LOCAL_PLAYER_INDEX;
			} else {
				var3 = this.playerIds[var2];
			}
			ClientPlayer var4 = this.players[var3];
			if (var4 != null) {
				this.moveEntity(var4, 1);
			}
		}
	}

	@ObfuscatedName("client.y(I)V")
	public void moveNpcs() {
		for (int var2 = 0; var2 < this.npcCount; var2++) {
			int var3 = this.npcIds[var2];
			ClientNpc var4 = this.npcs[var3];
			if (var4 != null) {
				this.moveEntity(var4, var4.type.size);
			}
		}
	}

	@ObfuscatedName("client.a(BLz;I)V")
	public void moveEntity(ClientEntity arg1, int arg2) {
		if (arg1.x < 128 || arg1.z < 128 || arg1.x >= 13184 || arg1.z >= 13184) {
			arg1.primarySeqId = -1;
			arg1.spotanimId = -1;
			arg1.exactMoveEndCycle = 0;
			arg1.exactMoveStartCycle = 0;
			arg1.x = arg1.routeTileX[0] * 128 + arg1.size * 64;
			arg1.z = arg1.routeTileZ[0] * 128 + arg1.size * 64;
			arg1.abortRoute();
		}
		if (arg1 == localPlayer && (arg1.x < 1536 || arg1.z < 1536 || arg1.x >= 11776 || arg1.z >= 11776)) {
			arg1.primarySeqId = -1;
			arg1.spotanimId = -1;
			arg1.exactMoveEndCycle = 0;
			arg1.exactMoveStartCycle = 0;
			arg1.x = arg1.routeTileX[0] * 128 + arg1.size * 64;
			arg1.z = arg1.routeTileZ[0] * 128 + arg1.size * 64;
			arg1.abortRoute();
		}
		if (arg1.exactMoveEndCycle > loopCycle) {
			this.exactMove1(arg1);
		} else if (arg1.exactMoveStartCycle >= loopCycle) {
			this.exactMove2(arg1);
		} else {
			this.routeMove(arg1);
		}
		this.entityFace(arg1);
		this.entityAnim(arg1);
	}

	@ObfuscatedName("client.a(Lz;B)V")
	public void exactMove1(ClientEntity arg0) {
		int var4 = arg0.exactMoveEndCycle - loopCycle;
		int var5 = arg0.exactMoveStartSceneTileX * 128 + arg0.size * 64;
		int var6 = arg0.exactMoveStartSceneTileZ * 128 + arg0.size * 64;
		arg0.x += (var5 - arg0.x) / var4;
		arg0.z += (var6 - arg0.z) / var4;
		arg0.seqDelayMove = 0;
		if (arg0.exactMoveFaceDirection == 0) {
			arg0.dstYaw = 1024;
		}
		if (arg0.exactMoveFaceDirection == 1) {
			arg0.dstYaw = 1536;
		}
		if (arg0.exactMoveFaceDirection == 2) {
			arg0.dstYaw = 0;
		}
		if (arg0.exactMoveFaceDirection == 3) {
			arg0.dstYaw = 512;
		}
	}

	@ObfuscatedName("client.a(BLz;)V")
	public void exactMove2(ClientEntity arg1) {
		if (arg1.exactMoveStartCycle == loopCycle || arg1.primarySeqId == -1 || arg1.primarySeqDelay != 0 || arg1.primarySeqCycle + 1 > SeqType.list[arg1.primarySeqId].getDuration(arg1.primarySeqFrame)) {
			int var3 = arg1.exactMoveStartCycle - arg1.exactMoveEndCycle;
			int var4 = loopCycle - arg1.exactMoveEndCycle;
			int var5 = arg1.exactMoveStartSceneTileX * 128 + arg1.size * 64;
			int var6 = arg1.exactMoveStartSceneTileZ * 128 + arg1.size * 64;
			int var7 = arg1.exactMoveEndSceneTileX * 128 + arg1.size * 64;
			int var8 = arg1.exactMoveEndSceneTileZ * 128 + arg1.size * 64;
			arg1.x = (var5 * (var3 - var4) + var7 * var4) / var3;
			arg1.z = (var6 * (var3 - var4) + var8 * var4) / var3;
		}
		arg1.seqDelayMove = 0;
		if (arg1.exactMoveFaceDirection == 0) {
			arg1.dstYaw = 1024;
		}
		if (arg1.exactMoveFaceDirection == 1) {
			arg1.dstYaw = 1536;
		}
		if (arg1.exactMoveFaceDirection == 2) {
			arg1.dstYaw = 0;
		}
		if (arg1.exactMoveFaceDirection == 3) {
			arg1.dstYaw = 512;
		}
		arg1.yaw = arg1.dstYaw;
	}

	@ObfuscatedName("client.a(Lz;I)V")
	public void routeMove(ClientEntity arg0) {
		arg0.secondarySeqId = arg0.readyanim;
		if (arg0.routeLength == 0) {
			arg0.seqDelayMove = 0;
			return;
		}
		if (arg0.primarySeqId != -1 && arg0.primarySeqDelay == 0) {
			SeqType var3 = SeqType.list[arg0.primarySeqId];
			if (arg0.preanimRouteLength > 0 && var3.preanim_move == 0) {
				arg0.seqDelayMove++;
				return;
			}
			if (arg0.preanimRouteLength <= 0 && var3.postanim_move == 0) {
				arg0.seqDelayMove++;
				return;
			}
		}
		int var4 = arg0.x;
		int var5 = arg0.z;
		int var6 = arg0.routeTileX[arg0.routeLength - 1] * 128 + arg0.size * 64;
		int var7 = arg0.routeTileZ[arg0.routeLength - 1] * 128 + arg0.size * 64;
		if (var6 - var4 > 256 || var6 - var4 < -256 || var7 - var5 > 256 || var7 - var5 < -256) {
			arg0.x = var6;
			arg0.z = var7;
			return;
		}
		if (var4 < var6) {
			if (var5 < var7) {
				arg0.dstYaw = 1280;
			} else if (var5 > var7) {
				arg0.dstYaw = 1792;
			} else {
				arg0.dstYaw = 1536;
			}
		} else if (var4 > var6) {
			if (var5 < var7) {
				arg0.dstYaw = 768;
			} else if (var5 > var7) {
				arg0.dstYaw = 256;
			} else {
				arg0.dstYaw = 512;
			}
		} else if (var5 < var7) {
			arg0.dstYaw = 1024;
		} else {
			arg0.dstYaw = 0;
		}
		int var8 = arg0.dstYaw - arg0.yaw & 0x7FF;
		if (var8 > 1024) {
			var8 -= 2048;
		}
		int var9 = arg0.walkanim_b;
		if (var8 >= -256 && var8 <= 256) {
			var9 = arg0.walkanim;
		} else if (var8 >= 256 && var8 < 768) {
			var9 = arg0.walkanim_r;
		} else if (var8 >= -768 && var8 <= -256) {
			var9 = arg0.walkanim_l;
		}
		if (var9 == -1) {
			var9 = arg0.walkanim;
		}
		arg0.secondarySeqId = var9;
		int var10 = 4;
		if (arg0.yaw != arg0.dstYaw && arg0.targetId == -1 && arg0.turnspeed != 0) {
			var10 = 2;
		}
		if (arg0.routeLength > 2) {
			var10 = 6;
		}
		if (arg0.routeLength > 3) {
			var10 = 8;
		}
		if (arg0.seqDelayMove > 0 && arg0.routeLength > 1) {
			var10 = 8;
			arg0.seqDelayMove--;
		}
		if (arg0.routeRun[arg0.routeLength - 1]) {
			var10 <<= 0x1;
		}
		if (var10 >= 8 && arg0.secondarySeqId == arg0.walkanim && arg0.runanim != -1) {
			arg0.secondarySeqId = arg0.runanim;
		}
		if (var4 < var6) {
			arg0.x += var10;
			if (arg0.x > var6) {
				arg0.x = var6;
			}
		} else if (var4 > var6) {
			arg0.x -= var10;
			if (arg0.x < var6) {
				arg0.x = var6;
			}
		}
		if (var5 < var7) {
			arg0.z += var10;
			if (arg0.z > var7) {
				arg0.z = var7;
			}
		} else if (var5 > var7) {
			arg0.z -= var10;
			if (arg0.z < var7) {
				arg0.z = var7;
			}
		}
		if (arg0.x == var6 && arg0.z == var7) {
			arg0.routeLength--;
			if (arg0.preanimRouteLength > 0) {
				arg0.preanimRouteLength--;
			}
		}
	}

	@ObfuscatedName("client.b(Lz;I)V")
	public void entityFace(ClientEntity arg0) {
		if (arg0.turnspeed == 0) {
			return;
		}
		if (arg0.targetId != -1 && arg0.targetId < 32768) {
			ClientNpc var3 = this.npcs[arg0.targetId];
			if (var3 != null) {
				int var4 = arg0.x - var3.x;
				int var5 = arg0.z - var3.z;
				if (var4 != 0 || var5 != 0) {
					arg0.dstYaw = (int) (Math.atan2((double) var4, (double) var5) * 325.949D) & 0x7FF;
				}
			}
		}
		if (arg0.targetId >= 32768) {
			int var6 = arg0.targetId - 32768;
			if (var6 == this.localPid) {
				var6 = this.LOCAL_PLAYER_INDEX;
			}
			ClientPlayer var7 = this.players[var6];
			if (var7 != null) {
				int var8 = arg0.x - var7.x;
				int var9 = arg0.z - var7.z;
				if (var8 != 0 || var9 != 0) {
					arg0.dstYaw = (int) (Math.atan2((double) var8, (double) var9) * 325.949D) & 0x7FF;
				}
			}
		}
		if ((arg0.targetTileX != 0 || arg0.targetTileZ != 0) && (arg0.routeLength == 0 || arg0.seqDelayMove > 0)) {
			int var10 = arg0.x - (arg0.targetTileX - this.sceneBaseTileX - this.sceneBaseTileX) * 64;
			int var11 = arg0.z - (arg0.targetTileZ - this.sceneBaseTileZ - this.sceneBaseTileZ) * 64;
			if (var10 != 0 || var11 != 0) {
				arg0.dstYaw = (int) (Math.atan2((double) var10, (double) var11) * 325.949D) & 0x7FF;
			}
			arg0.targetTileX = 0;
			arg0.targetTileZ = 0;
		}
		int var12 = arg0.dstYaw - arg0.yaw & 0x7FF;
		if (var12 != 0) {
			if (var12 < arg0.turnspeed || var12 > 2048 - arg0.turnspeed) {
				arg0.yaw = arg0.dstYaw;
			} else if (var12 > 1024) {
				arg0.yaw -= arg0.turnspeed;
			} else {
				arg0.yaw += arg0.turnspeed;
			}
			arg0.yaw &= 0x7FF;
			if (arg0.secondarySeqId == arg0.readyanim && arg0.yaw != arg0.dstYaw) {
				if (arg0.turnanim != -1) {
					arg0.secondarySeqId = arg0.turnanim;
				} else {
					arg0.secondarySeqId = arg0.walkanim;
				}
			}
		}
	}

	@ObfuscatedName("client.a(ZLz;)V")
	public void entityAnim(ClientEntity arg1) {
		arg1.needsForwardDrawPadding = false;
		if (arg1.secondarySeqId != -1) {
			SeqType var3 = SeqType.list[arg1.secondarySeqId];
			arg1.secondarySeqCycle++;
			if (arg1.secondarySeqFrame < var3.numFrames && arg1.secondarySeqCycle > var3.getDuration(arg1.secondarySeqFrame)) {
				arg1.secondarySeqCycle = 0;
				arg1.secondarySeqFrame++;
			}
			if (arg1.secondarySeqFrame >= var3.numFrames) {
				arg1.secondarySeqCycle = 0;
				arg1.secondarySeqFrame = 0;
			}
		}
		if (arg1.spotanimId != -1 && loopCycle >= arg1.spotanimLastCycle) {
			if (arg1.spotanimFrame < 0) {
				arg1.spotanimFrame = 0;
			}
			SeqType var4 = SpotAnimType.list[arg1.spotanimId].seq;
			arg1.spotanimCycle++;
			while (arg1.spotanimFrame < var4.numFrames && arg1.spotanimCycle > var4.getDuration(arg1.spotanimFrame)) {
				arg1.spotanimCycle -= var4.getDuration(arg1.spotanimFrame);
				arg1.spotanimFrame++;
			}
			if (arg1.spotanimFrame >= var4.numFrames && (arg1.spotanimFrame < 0 || arg1.spotanimFrame >= var4.numFrames)) {
				arg1.spotanimId = -1;
			}
		}
		if (arg1.primarySeqId != -1 && arg1.primarySeqDelay <= 1) {
			SeqType var5 = SeqType.list[arg1.primarySeqId];
			if (var5.preanim_move == 1 && arg1.preanimRouteLength > 0 && arg1.exactMoveEndCycle <= loopCycle && arg1.exactMoveStartCycle < loopCycle) {
				arg1.primarySeqDelay = 1;
				return;
			}
		}
		if (arg1.primarySeqId != -1 && arg1.primarySeqDelay == 0) {
			SeqType var6 = SeqType.list[arg1.primarySeqId];
			arg1.primarySeqCycle++;
			while (arg1.primarySeqFrame < var6.numFrames && arg1.primarySeqCycle > var6.getDuration(arg1.primarySeqFrame)) {
				arg1.primarySeqCycle -= var6.getDuration(arg1.primarySeqFrame);
				arg1.primarySeqFrame++;
			}
			if (arg1.primarySeqFrame >= var6.numFrames) {
				arg1.primarySeqFrame -= var6.loops;
				arg1.primarySeqLoop++;
				if (arg1.primarySeqLoop >= var6.maxloops) {
					arg1.primarySeqId = -1;
				}
				if (arg1.primarySeqFrame < 0 || arg1.primarySeqFrame >= var6.numFrames) {
					arg1.primarySeqId = -1;
				}
			}
			arg1.needsForwardDrawPadding = var6.stretches;
		}
		if (arg1.primarySeqDelay > 0) {
			arg1.primarySeqDelay--;
		}
	}

	@ObfuscatedName("client.D(I)V")
	public void loadTitle() {
		if (this.imageTitle2 != null) {
			return;
		}
		super.drawArea = null;
		this.areaChatback = null;
		this.areaMapback = null;
		this.areaSidebar = null;
		this.areaViewport = null;
		this.areaBackbase1 = null;
		this.areaBackbase2 = null;
		this.areaBackhmid1 = null;
		this.imageTitle0 = new PixMap(this.getBaseComponent(), 128, 265);
		Pix2D.cls();
		this.imageTitle1 = new PixMap(this.getBaseComponent(), 128, 265);
		Pix2D.cls();
		this.imageTitle2 = new PixMap(this.getBaseComponent(), 509, 171);
		Pix2D.cls();
		this.imageTitle3 = new PixMap(this.getBaseComponent(), 360, 132);
		Pix2D.cls();
		this.imageTitle4 = new PixMap(this.getBaseComponent(), 360, 200);
		Pix2D.cls();
		this.imageTitle5 = new PixMap(this.getBaseComponent(), 202, 238);
		Pix2D.cls();
		this.imageTitle6 = new PixMap(this.getBaseComponent(), 203, 238);
		Pix2D.cls();
		this.imageTitle7 = new PixMap(this.getBaseComponent(), 74, 94);
		Pix2D.cls();
		this.imageTitle8 = new PixMap(this.getBaseComponent(), 75, 94);
		Pix2D.cls();
		if (this.jagTitle != null) {
			this.loadTitleBackground();
			this.loadTitleImages();
		}
		this.redrawFrame = true;
	}

	@ObfuscatedName("client.i(B)V")
	public void loadTitleBackground() {
		byte[] var2 = this.jagTitle.read("title.dat", null);
		Pix32 var3 = new Pix32(var2, this);
		this.imageTitle0.bind();
		var3.quickPlotSprite(0, 0);
		this.imageTitle1.bind();
		var3.quickPlotSprite(0, -637);
		this.imageTitle2.bind();
		var3.quickPlotSprite(0, -128);
		this.imageTitle3.bind();
		var3.quickPlotSprite(-371, -202);
		this.imageTitle4.bind();
		var3.quickPlotSprite(-171, -202);
		this.imageTitle5.bind();
		var3.quickPlotSprite(-265, 0);
		this.imageTitle6.bind();
		var3.quickPlotSprite(-265, -562);
		this.imageTitle7.bind();
		var3.quickPlotSprite(-171, -128);
		this.imageTitle8.bind();
		var3.quickPlotSprite(-171, -562);
		int[] var4 = new int[var3.wi];
		for (int var5 = 0; var5 < var3.hi; var5++) {
			for (int var6 = 0; var6 < var3.wi; var6++) {
				var4[var6] = var3.data[var3.wi - var6 - 1 + var3.wi * var5];
			}
			for (int var7 = 0; var7 < var3.wi; var7++) {
				var3.data[var7 + var3.wi * var5] = var4[var7];
			}
		}
		this.imageTitle0.bind();
		var3.quickPlotSprite(0, 382);
		this.imageTitle1.bind();
		var3.quickPlotSprite(0, -255);
		this.imageTitle2.bind();
		var3.quickPlotSprite(0, 254);
		this.imageTitle3.bind();
		var3.quickPlotSprite(-371, 180);
		this.imageTitle4.bind();
		var3.quickPlotSprite(-171, 180);
		this.imageTitle5.bind();
		var3.quickPlotSprite(-265, 382);
		this.imageTitle6.bind();
		var3.quickPlotSprite(-265, -180);
		this.imageTitle7.bind();
		var3.quickPlotSprite(-171, 254);
		this.imageTitle8.bind();
		var3.quickPlotSprite(-171, -180);
		Pix32 var8 = new Pix32(this.jagTitle, "logo", 0);
		this.imageTitle2.bind();
		var8.plotSprite(382 - var8.wi / 2 - 128, 18);
		Object var9 = null;
		Object var10 = null;
		Object var11 = null;
		System.gc();
	}

	@ObfuscatedName("client.O(I)V")
	public void loadTitleImages() {
		this.imageTitlebox = new Pix8(this.jagTitle, "titlebox", 0);
		this.imageTitlebutton = new Pix8(this.jagTitle, "titlebutton", 0);
		this.imageRunes = new Pix8[12];
		for (int var2 = 0; var2 < 12; var2++) {
			this.imageRunes[var2] = new Pix8(this.jagTitle, "runes", var2);
		}
		this.imageFlamesLeft = new Pix32(128, 265);
		this.imageFlamesRight = new Pix32(128, 265);
		for (int var3 = 0; var3 < 33920; var3++) {
			this.imageFlamesLeft.data[var3] = this.imageTitle0.data[var3];
		}
		for (int var4 = 0; var4 < 33920; var4++) {
			this.imageFlamesRight.data[var4] = this.imageTitle1.data[var4];
		}
		this.flameGradient0 = new int[256];
		for (int var5 = 0; var5 < 64; var5++) {
			this.flameGradient0[var5] = var5 * 262144;
		}
		for (int var6 = 0; var6 < 64; var6++) {
			this.flameGradient0[var6 + 64] = var6 * 1024 + 16711680;
		}
		for (int var7 = 0; var7 < 64; var7++) {
			this.flameGradient0[var7 + 128] = var7 * 4 + 16776960;
		}
		for (int var8 = 0; var8 < 64; var8++) {
			this.flameGradient0[var8 + 192] = 16777215;
		}
		this.flameGradient1 = new int[256];
		for (int var9 = 0; var9 < 64; var9++) {
			this.flameGradient1[var9] = var9 * 1024;
		}
		for (int var10 = 0; var10 < 64; var10++) {
			this.flameGradient1[var10 + 64] = var10 * 4 + 65280;
		}
		for (int var11 = 0; var11 < 64; var11++) {
			this.flameGradient1[var11 + 128] = var11 * 262144 + 65535;
		}
		for (int var12 = 0; var12 < 64; var12++) {
			this.flameGradient1[var12 + 192] = 16777215;
		}
		this.flameGradient2 = new int[256];
		for (int var13 = 0; var13 < 64; var13++) {
			this.flameGradient2[var13] = var13 * 4;
		}
		for (int var14 = 0; var14 < 64; var14++) {
			this.flameGradient2[var14 + 64] = var14 * 262144 + 255;
		}
		for (int var15 = 0; var15 < 64; var15++) {
			this.flameGradient2[var15 + 128] = var15 * 1024 + 16711935;
		}
		for (int var16 = 0; var16 < 64; var16++) {
			this.flameGradient2[var16 + 192] = 16777215;
		}
		this.flameGradient = new int[256];
		this.flameBuffer0 = new int[32768];
		this.flameBuffer1 = new int[32768];
		this.updateFlameBuffer(null);
		this.flameBuffer2 = new int[32768];
		this.flameBuffer3 = new int[32768];
		this.drawProgress("Connecting to fileserver", 10);
		if (!this.flameActive) {
			this.flamesThread = true;
			this.flameActive = true;
			this.startThread(this, 2);
		}
	}

	@ObfuscatedName("client.a(ZB)V")
	public void titleScreenDraw(boolean arg0) {
		this.loadTitle();
		this.imageTitle4.bind();
		this.imageTitlebox.plotSprite(0, 0);
		short var4 = 360;
		short var5 = 200;
		if (this.loginscreen == 0) {
			int var6 = var5 / 2 + 80;
			this.fontPlain11.centreStringTag(7711145, var4 / 2, this.onDemand.message, var6, true);
			int var7 = var5 / 2 - 20;
			this.fontBold12.centreStringTag(16776960, var4 / 2, "Welcome to RuneScape", var7, true);
			int var18 = var7 + 30;
			int var8 = var4 / 2 - 80;
			int var9 = var5 / 2 + 20;
			this.imageTitlebutton.plotSprite(var8 - 73, var9 - 20);
			this.fontBold12.centreStringTag(16777215, var8, "New user", var9 + 5, true);
			int var10 = var4 / 2 + 80;
			this.imageTitlebutton.plotSprite(var10 - 73, var9 - 20);
			this.fontBold12.centreStringTag(16777215, var10, "Existing User", var9 + 5, true);
		}
		if (this.loginscreen == 2) {
			int var11 = var5 / 2 - 40;
			if (this.loginMes1.length() > 0) {
				this.fontBold12.centreStringTag(16776960, var4 / 2, this.loginMes1, var11 - 15, true);
				this.fontBold12.centreStringTag(16776960, var4 / 2, this.loginMes2, var11, true);
				var11 += 30;
			} else {
				this.fontBold12.centreStringTag(16776960, var4 / 2, this.loginMes2, var11 - 7, true);
				var11 += 30;
			}
			this.fontBold12.drawStringTag(true, "Username: " + this.loginUser + (this.loginSelect == 0 & loopCycle % 40 < 20 ? "@yel@|" : ""), var11, 16777215, var4 / 2 - 90);
			var11 += 15;
			this.fontBold12.drawStringTag(true, "Password: " + JString.censor(this.loginPass) + (this.loginSelect == 1 & loopCycle % 40 < 20 ? "@yel@|" : ""), var11, 16777215, var4 / 2 - 88);
			var11 += 15;
			if (!arg0) {
				int var12 = var4 / 2 - 80;
				int var13 = var5 / 2 + 50;
				this.imageTitlebutton.plotSprite(var12 - 73, var13 - 20);
				this.fontBold12.centreStringTag(16777215, var12, "Login", var13 + 5, true);
				int var14 = var4 / 2 + 80;
				this.imageTitlebutton.plotSprite(var14 - 73, var13 - 20);
				this.fontBold12.centreStringTag(16777215, var14, "Cancel", var13 + 5, true);
			}
		}
		if (this.loginscreen == 3) {
			this.fontBold12.centreStringTag(16776960, var4 / 2, "Create a free account", var5 / 2 - 60, true);
			int var15 = var5 / 2 - 35;
			this.fontBold12.centreStringTag(16777215, var4 / 2, "To create a new account you need to", var15, true);
			int var19 = var15 + 15;
			this.fontBold12.centreStringTag(16777215, var4 / 2, "go back to the main RuneScape webpage", var19, true);
			int var20 = var19 + 15;
			this.fontBold12.centreStringTag(16777215, var4 / 2, "and choose the red 'create account'", var20, true);
			int var21 = var20 + 15;
			this.fontBold12.centreStringTag(16777215, var4 / 2, "button at the top right of that page.", var21, true);
			int var22 = var21 + 15;
			int var16 = var4 / 2;
			int var17 = var5 / 2 + 50;
			this.imageTitlebutton.plotSprite(var16 - 73, var17 - 20);
			this.fontBold12.centreStringTag(16777215, var16, "Cancel", var17 + 5, true);
		}
		this.imageTitle4.draw(171, 202, super.graphics);
		if (this.redrawFrame) {
			this.redrawFrame = false;
			this.imageTitle2.draw(0, 128, super.graphics);
			this.imageTitle3.draw(371, 202, super.graphics);
			this.imageTitle5.draw(265, 0, super.graphics);
			this.imageTitle6.draw(265, 562, super.graphics);
			this.imageTitle7.draw(171, 128, super.graphics);
			this.imageTitle8.draw(171, 562, super.graphics);
		}
	}

	@ObfuscatedName("client.j(Z)V")
	public void gameDraw() {
		if (this.redrawFrame) {
			this.redrawFrame = false;
			this.areaBackleft1.draw(4, 0, super.graphics);
			this.areaBackleft2.draw(357, 0, super.graphics);
			this.areaBackright1.draw(4, 722, super.graphics);
			this.areaBackright2.draw(205, 743, super.graphics);
			this.areaBacktop1.draw(0, 0, super.graphics);
			this.areaBackvmid1.draw(4, 516, super.graphics);
			this.areaBackvmid2.draw(205, 516, super.graphics);
			this.areaBackvmid3.draw(357, 496, super.graphics);
			this.areaBackhmid2.draw(338, 0, super.graphics);
			this.redrawSidebar = true;
			this.redrawChatback = true;
			this.redrawSideicons = true;
			this.redrawPrivacySettings = true;
			if (this.sceneState != 2) {
				this.areaViewport.draw(4, 4, super.graphics);
				this.areaMapback.draw(4, 550, super.graphics);
			}
		}
		if (this.sceneState == 2) {
			this.gameDrawMain();
		}
		if (this.menuVisible && this.menuArea == 1) {
			this.redrawSidebar = true;
		}
		if (this.sideLayerId != -1) {
			boolean var2 = this.animateLayer(this.sceneDelta, this.sideLayerId);
			if (var2) {
				this.redrawSidebar = true;
			}
		}
		if (this.selectedArea == 2) {
			this.redrawSidebar = true;
		}
		if (this.objDragArea == 2) {
			this.redrawSidebar = true;
		}
		if (this.redrawSidebar) {
			this.drawSidebar();
			this.redrawSidebar = false;
		}
		if (this.chatLayerId == -1) {
			this.chatInterface.scrollPosition = this.chatScrollHeight - this.chatScrollOffset - 77;
			if (super.mouseX > 448 && super.mouseX < 560 && super.mouseY > 332) {
				this.doScrollbar(463, this.chatScrollHeight, false, super.mouseX - 17, this.chatInterface, super.mouseY - 357, 77, 0);
			}
			int var3 = this.chatScrollHeight - 77 - this.chatInterface.scrollPosition;
			if (var3 < 0) {
				var3 = 0;
			}
			if (var3 > this.chatScrollHeight - 77) {
				var3 = this.chatScrollHeight - 77;
			}
			if (this.chatScrollOffset != var3) {
				this.chatScrollOffset = var3;
				this.redrawChatback = true;
			}
		}
		if (this.chatLayerId != -1) {
			boolean var4 = this.animateLayer(this.sceneDelta, this.chatLayerId);
			if (var4) {
				this.redrawChatback = true;
			}
		}
		if (this.selectedArea == 3) {
			this.redrawChatback = true;
		}
		if (this.objDragArea == 3) {
			this.redrawChatback = true;
		}
		if (this.modalMessage != null) {
			this.redrawChatback = true;
		}
		if (this.menuVisible && this.menuArea == 2) {
			this.redrawChatback = true;
		}
		if (this.redrawChatback) {
			this.drawChat();
			this.redrawChatback = false;
		}
		if (this.sceneState == 2) {
			this.drawMinimap();
			this.areaMapback.draw(4, 550, super.graphics);
		}
		if (this.flashingTab != -1) {
			this.redrawSideicons = true;
		}
		if (this.redrawSideicons) {
			if (this.flashingTab != -1 && this.flashingTab == this.sideTab) {
				this.flashingTab = -1;
				// TUTORIAL_CLICKSIDE
				this.out.pIsaac(201);
				this.out.p1(this.sideTab);
			}
			this.redrawSideicons = false;
			this.areaBackhmid1.bind();
			this.imageBackhmid1.plotSprite(0, 0);
			if (this.sideLayerId == -1) {
				if (this.tabInterfaceId[this.sideTab] != -1) {
					if (this.sideTab == 0) {
						this.imageRedstone1.plotSprite(22, 10);
					}
					if (this.sideTab == 1) {
						this.imageRedstone2.plotSprite(54, 8);
					}
					if (this.sideTab == 2) {
						this.imageRedstone2.plotSprite(82, 8);
					}
					if (this.sideTab == 3) {
						this.imageRedstone3.plotSprite(110, 8);
					}
					if (this.sideTab == 4) {
						this.imageRedstone2h.plotSprite(153, 8);
					}
					if (this.sideTab == 5) {
						this.imageRedstone2h.plotSprite(181, 8);
					}
					if (this.sideTab == 6) {
						this.imageRedstone1h.plotSprite(209, 9);
					}
				}
				if (this.tabInterfaceId[0] != -1 && (this.flashingTab != 0 || loopCycle % 20 < 10)) {
					this.imageSideicons[0].plotSprite(29, 13);
				}
				if (this.tabInterfaceId[1] != -1 && (this.flashingTab != 1 || loopCycle % 20 < 10)) {
					this.imageSideicons[1].plotSprite(53, 11);
				}
				if (this.tabInterfaceId[2] != -1 && (this.flashingTab != 2 || loopCycle % 20 < 10)) {
					this.imageSideicons[2].plotSprite(82, 11);
				}
				if (this.tabInterfaceId[3] != -1 && (this.flashingTab != 3 || loopCycle % 20 < 10)) {
					this.imageSideicons[3].plotSprite(115, 12);
				}
				if (this.tabInterfaceId[4] != -1 && (this.flashingTab != 4 || loopCycle % 20 < 10)) {
					this.imageSideicons[4].plotSprite(153, 13);
				}
				if (this.tabInterfaceId[5] != -1 && (this.flashingTab != 5 || loopCycle % 20 < 10)) {
					this.imageSideicons[5].plotSprite(180, 11);
				}
				if (this.tabInterfaceId[6] != -1 && (this.flashingTab != 6 || loopCycle % 20 < 10)) {
					this.imageSideicons[6].plotSprite(208, 13);
				}
			}
			this.areaBackhmid1.draw(160, 516, super.graphics);
			this.areaBackbase2.bind();
			this.imageBackbase2.plotSprite(0, 0);
			if (this.sideLayerId == -1) {
				if (this.tabInterfaceId[this.sideTab] != -1) {
					if (this.sideTab == 7) {
						this.imageRedstone1v.plotSprite(42, 0);
					}
					if (this.sideTab == 8) {
						this.imageRedstone2v.plotSprite(74, 0);
					}
					if (this.sideTab == 9) {
						this.imageRedstone2v.plotSprite(102, 0);
					}
					if (this.sideTab == 10) {
						this.imageRedstone3v.plotSprite(130, 1);
					}
					if (this.sideTab == 11) {
						this.imageRedstone2hv.plotSprite(173, 0);
					}
					if (this.sideTab == 12) {
						this.imageRedstone2hv.plotSprite(201, 0);
					}
					if (this.sideTab == 13) {
						this.imageRedstone1hv.plotSprite(229, 0);
					}
				}
				if (this.tabInterfaceId[8] != -1 && (this.flashingTab != 8 || loopCycle % 20 < 10)) {
					this.imageSideicons[7].plotSprite(74, 2);
				}
				if (this.tabInterfaceId[9] != -1 && (this.flashingTab != 9 || loopCycle % 20 < 10)) {
					this.imageSideicons[8].plotSprite(102, 3);
				}
				if (this.tabInterfaceId[10] != -1 && (this.flashingTab != 10 || loopCycle % 20 < 10)) {
					this.imageSideicons[9].plotSprite(137, 4);
				}
				if (this.tabInterfaceId[11] != -1 && (this.flashingTab != 11 || loopCycle % 20 < 10)) {
					this.imageSideicons[10].plotSprite(174, 2);
				}
				if (this.tabInterfaceId[12] != -1 && (this.flashingTab != 12 || loopCycle % 20 < 10)) {
					this.imageSideicons[11].plotSprite(201, 2);
				}
				if (this.tabInterfaceId[13] != -1 && (this.flashingTab != 13 || loopCycle % 20 < 10)) {
					this.imageSideicons[12].plotSprite(226, 2);
				}
			}
			this.areaBackbase2.draw(466, 496, super.graphics);
			this.areaViewport.bind();
		}
		if (this.redrawPrivacySettings) {
			this.redrawPrivacySettings = false;
			this.areaBackbase1.bind();
			this.imageBackbase1.plotSprite(0, 0);
			this.fontPlain12.centreStringTag(16777215, 55, "Public chat", 28, true);
			if (this.chatPublicMode == 0) {
				this.fontPlain12.centreStringTag(65280, 55, "On", 41, true);
			}
			if (this.chatPublicMode == 1) {
				this.fontPlain12.centreStringTag(16776960, 55, "Friends", 41, true);
			}
			if (this.chatPublicMode == 2) {
				this.fontPlain12.centreStringTag(16711680, 55, "Off", 41, true);
			}
			if (this.chatPublicMode == 3) {
				this.fontPlain12.centreStringTag(65535, 55, "Hide", 41, true);
			}
			this.fontPlain12.centreStringTag(16777215, 184, "Private chat", 28, true);
			if (this.chatPrivateMode == 0) {
				this.fontPlain12.centreStringTag(65280, 184, "On", 41, true);
			}
			if (this.chatPrivateMode == 1) {
				this.fontPlain12.centreStringTag(16776960, 184, "Friends", 41, true);
			}
			if (this.chatPrivateMode == 2) {
				this.fontPlain12.centreStringTag(16711680, 184, "Off", 41, true);
			}
			this.fontPlain12.centreStringTag(16777215, 324, "Trade/duel", 28, true);
			if (this.chatTradeMode == 0) {
				this.fontPlain12.centreStringTag(65280, 324, "On", 41, true);
			}
			if (this.chatTradeMode == 1) {
				this.fontPlain12.centreStringTag(16776960, 324, "Friends", 41, true);
			}
			if (this.chatTradeMode == 2) {
				this.fontPlain12.centreStringTag(16711680, 324, "Off", 41, true);
			}
			this.fontPlain12.centreStringTag(16777215, 458, "Report abuse", 33, true);
			this.areaBackbase1.draw(453, 0, super.graphics);
			this.areaViewport.bind();
		}
		this.sceneDelta = 0;
	}

	@ObfuscatedName("client.J(I)V")
	public void gameDrawMain() {
		this.sceneCycle++;
		this.addPlayers(true);
		this.addNpcs(true);
		this.addPlayers(false);
		this.addNpcs(false);
		this.addProjectiles();
		this.addMapAnim();
		if (!this.cutscene) {
			int var2 = this.orbitCameraPitch;
			if (this.cameraPitchClamp / 256 > var2) {
				var2 = this.cameraPitchClamp / 256;
			}
			if (this.cameraModifierEnabled[4] && this.cameraModifierWobbleScale[4] + 128 > var2) {
				var2 = this.cameraModifierWobbleScale[4] + 128;
			}
			int var3 = this.orbitCameraYaw + this.macroCameraAngle & 0x7FF;
			this.camFollow(var2, this.orbitCameraX, this.getAvH(localPlayer.z, this.minusedlevel, localPlayer.x) - 50, this.orbitCameraZ, var2 * 3 + 600, var3);
		}
		int var4;
		if (this.cutscene) {
			var4 = this.roofCheck2();
		} else {
			var4 = this.roofCheck();
		}
		int var5 = this.cameraX;
		int var6 = this.cameraY;
		int var7 = this.cameraZ;
		int var8 = this.cameraPitch;
		int var9 = this.cameraYaw;
		for (int var10 = 0; var10 < 5; var10++) {
			if (this.cameraModifierEnabled[var10]) {
				int var11 = (int) (Math.random() * (double) (this.cameraModifierJitter[var10] * 2 + 1) - (double) this.cameraModifierJitter[var10] + Math.sin((double) this.cameraModifierCycle[var10] * ((double) this.cameraModifierWobbleSpeed[var10] / 100.0D)) * (double) this.cameraModifierWobbleScale[var10]);
				if (var10 == 0) {
					this.cameraX += var11;
				}
				if (var10 == 1) {
					this.cameraY += var11;
				}
				if (var10 == 2) {
					this.cameraZ += var11;
				}
				if (var10 == 3) {
					this.cameraYaw = this.cameraYaw + var11 & 0x7FF;
				}
				if (var10 == 4) {
					this.cameraPitch += var11;
					if (this.cameraPitch < 128) {
						this.cameraPitch = 128;
					}
					if (this.cameraPitch > 383) {
						this.cameraPitch = 383;
					}
				}
			}
		}
		int var12 = Pix3D.cycle;
		Model.checkHover = true;
		Model.pickedCount = 0;
		Model.mouseX = super.mouseX - 4;
		Model.mouseY = super.mouseY - 4;
		Pix2D.cls();
		this.world.renderAll(this.cameraX, this.cameraZ, this.cameraPitch, this.cameraY, var4, this.cameraYaw);
		this.world.removeSprites();
		this.entityOverlays();
		this.coordArrow();
		this.textureRunAnims(var12);
		this.otherOverlays();
		this.areaViewport.draw(4, 4, super.graphics);
		this.cameraX = var5;
		this.cameraY = var6;
		this.cameraZ = var7;
		this.cameraPitch = var8;
		this.cameraYaw = var9;
	}

	@ObfuscatedName("client.c(ZI)V")
	public void addPlayers(boolean arg0) {
		if (localPlayer.x >> 7 == this.flagSceneTileX && localPlayer.z >> 7 == this.flagSceneTileZ) {
			this.flagSceneTileX = 0;
			field1587++;
			if (field1587 > 122) {
				field1587 = 0;
				// ANTICHEAT_CYCLELOGIC6
				this.out.pIsaac(36);
				this.out.p1(62);
			}
		}
		int var3 = this.playerCount;
		if (arg0) {
			var3 = 1;
		}
		for (int var4 = 0; var4 < var3; var4++) {
			ClientPlayer var5;
			int var6;
			if (arg0) {
				var5 = localPlayer;
				var6 = this.LOCAL_PLAYER_INDEX << 14;
			} else {
				var5 = this.players[this.playerIds[var4]];
				var6 = this.playerIds[var4] << 14;
			}
			if (var5 != null && var5.isReady()) {
				var5.lowMemory = false;
				if ((lowMem && this.playerCount > 50 || this.playerCount > 200) && !arg0 && var5.secondarySeqId == var5.readyanim) {
					var5.lowMemory = true;
				}
				int var7 = var5.x >> 7;
				int var8 = var5.z >> 7;
				if (var7 >= 0 && var7 < 104 && var8 >= 0 && var8 < 104) {
					if (var5.locModel == null || loopCycle < var5.locStartCycle || loopCycle >= var5.locStopCycle) {
						if ((var5.x & 0x7F) == 64 && (var5.z & 0x7F) == 64) {
							if (this.tileLastOccupiedCycle[var7][var8] == this.sceneCycle) {
								continue;
							}
							this.tileLastOccupiedCycle[var7][var8] = this.sceneCycle;
						}
						var5.y = this.getAvH(var5.z, this.minusedlevel, var5.x);
						this.world.addDynamic(var5.yaw, var6, 60, var5.x, var5, var5.y, this.minusedlevel, var5.needsForwardDrawPadding, var5.z);
					} else {
						var5.lowMemory = false;
						var5.y = this.getAvH(var5.z, this.minusedlevel, var5.x);
						this.world.addDynamic(var5.y, var5.yaw, var5.minTileZ, 60, var5.maxTileZ, var5.z, var5, var5.minTileX, var5.x, var6, this.minusedlevel, var5.maxTileX);
					}
				}
			}
		}
	}

	@ObfuscatedName("client.b(ZI)V")
	public void addNpcs(boolean arg0) {
		for (int var3 = 0; var3 < this.npcCount; var3++) {
			ClientNpc var4 = this.npcs[this.npcIds[var3]];
			int var5 = (this.npcIds[var3] << 14) + 536870912;
			if (var4 != null && var4.isReady() && var4.type.alwaysontop == arg0) {
				int var6 = var4.x >> 7;
				int var7 = var4.z >> 7;
				if (var6 >= 0 && var6 < 104 && var7 >= 0 && var7 < 104) {
					if (var4.size == 1 && (var4.x & 0x7F) == 64 && (var4.z & 0x7F) == 64) {
						if (this.tileLastOccupiedCycle[var6][var7] == this.sceneCycle) {
							continue;
						}
						this.tileLastOccupiedCycle[var6][var7] = this.sceneCycle;
					}
					this.world.addDynamic(var4.yaw, var5, (var4.size - 1) * 64 + 60, var4.x, var4, this.getAvH(var4.z, this.minusedlevel, var4.x), this.minusedlevel, var4.needsForwardDrawPadding, var4.z);
				}
			}
		}
	}

	@ObfuscatedName("client.P(I)V")
	public void addProjectiles() {
		for (ClientProj var3 = (ClientProj) this.projectiles.head(); var3 != null; var3 = (ClientProj) this.projectiles.next()) {
			if (var3.level != this.minusedlevel || loopCycle > var3.endCycle) {
				var3.unlink();
			} else if (loopCycle >= var3.startCycle) {
				if (var3.target > 0) {
					ClientNpc var4 = this.npcs[var3.target - 1];
					if (var4 != null && var4.x >= 0 && var4.x < 13312 && var4.z >= 0 && var4.z < 13312) {
						var3.setTarget(var4.z, this.getAvH(var4.z, var3.level, var4.x) - var3.dstHeight, var4.x, loopCycle);
					}
				}
				if (var3.target < 0) {
					int var5 = -var3.target - 1;
					ClientPlayer var6;
					if (var5 == this.localPid) {
						var6 = localPlayer;
					} else {
						var6 = this.players[var5];
					}
					if (var6 != null && var6.x >= 0 && var6.x < 13312 && var6.z >= 0 && var6.z < 13312) {
						var3.setTarget(var6.z, this.getAvH(var6.z, var3.level, var6.x) - var3.dstHeight, var6.x, loopCycle);
					}
				}
				var3.move(this.sceneDelta);
				this.world.addDynamic(var3.yaw, -1, 60, (int) var3.x, var3, (int) var3.y, this.minusedlevel, false, (int) var3.z);
			}
		}
		field1294++;
		if (field1294 > 1174) {
			field1294 = 0;
			// ANTICHEAT_CYCLELOGIC1
			this.out.pIsaac(51);
			this.out.p1(0);
			int var7 = this.out.pos;
			if ((int) (Math.random() * 2.0D) == 0) {
				this.out.p2(11499);
			}
			this.out.p2(10548);
			if ((int) (Math.random() * 2.0D) == 0) {
				this.out.p1(139);
			}
			if ((int) (Math.random() * 2.0D) == 0) {
				this.out.p1(94);
			}
			this.out.p2(51693);
			this.out.p1(16);
			this.out.p2(15036);
			if ((int) (Math.random() * 2.0D) == 0) {
				this.out.p1(65);
			}
			this.out.p1((int) (Math.random() * 256.0D));
			this.out.p2(22990);
			this.out.psize1(this.out.pos - var7);
		}
	}

	@ObfuscatedName("client.I(I)V")
	public void addMapAnim() {
		MapSpotAnim var2 = (MapSpotAnim) this.spotanims.head();
		while (var2 != null) {
			if (var2.level != this.minusedlevel || var2.seqComplete) {
				var2.unlink();
			} else if (loopCycle >= var2.startCycle) {
				var2.update(this.sceneDelta);
				if (var2.seqComplete) {
					var2.unlink();
				} else {
					this.world.addDynamic(0, -1, 60, var2.x, var2, var2.y, var2.level, false, var2.z);
				}
			}
			var2 = (MapSpotAnim) this.spotanims.next();
		}
	}

	@ObfuscatedName("client.a(IIIIIII)V")
	public void camFollow(int arg0, int arg1, int arg2, int arg3, int arg5, int arg6) {
		int var8 = 2048 - arg0 & 0x7FF;
		int var9 = 2048 - arg6 & 0x7FF;
		int var10 = 0;
		int var11 = 0;
		int var12 = arg5;
		if (var8 != 0) {
			int var13 = Model.sinTable[var8];
			int var14 = Model.cosTable[var8];
			int var15 = var11 * var14 - arg5 * var13 >> 16;
			var12 = var11 * var13 + arg5 * var14 >> 16;
			var11 = var15;
		}
		if (var9 != 0) {
			int var16 = Model.sinTable[var9];
			int var17 = Model.cosTable[var9];
			int var18 = var12 * var16 + var10 * var17 >> 16;
			var12 = var12 * var17 - var10 * var16 >> 16;
			var10 = var18;
		}
		this.cameraX = arg1 - var10;
		this.cameraY = arg2 - var11;
		this.cameraZ = arg3 - var12;
		this.cameraPitch = arg0;
		this.cameraYaw = arg6;
	}

	@ObfuscatedName("client.i(Z)I")
	public int roofCheck2() {
		int var2 = this.getAvH(this.cameraZ, this.minusedlevel, this.cameraX);
		return var2 - this.cameraY >= 800 || (this.mapl[this.minusedlevel][this.cameraX >> 7][this.cameraZ >> 7] & 0x4) == 0 ? 3 : this.minusedlevel;
	}

	@ObfuscatedName("client.f(B)I")
	public int roofCheck() {
		int var2 = 3;
		if (this.cameraPitch < 310) {
			int var3 = this.cameraX >> 7;
			int var4 = this.cameraZ >> 7;
			int var5 = localPlayer.x >> 7;
			int var6 = localPlayer.z >> 7;
			if ((this.mapl[this.minusedlevel][var3][var4] & 0x4) != 0) {
				var2 = this.minusedlevel;
			}
			int var7;
			if (var5 > var3) {
				var7 = var5 - var3;
			} else {
				var7 = var3 - var5;
			}
			int var8;
			if (var6 > var4) {
				var8 = var6 - var4;
			} else {
				var8 = var4 - var6;
			}
			if (var7 > var8) {
				int var9 = var8 * 65536 / var7;
				int var10 = 32768;
				while (var3 != var5) {
					if (var3 < var5) {
						var3++;
					} else if (var3 > var5) {
						var3--;
					}
					if ((this.mapl[this.minusedlevel][var3][var4] & 0x4) != 0) {
						var2 = this.minusedlevel;
					}
					var10 += var9;
					if (var10 >= 65536) {
						var10 -= 65536;
						if (var4 < var6) {
							var4++;
						} else if (var4 > var6) {
							var4--;
						}
						if ((this.mapl[this.minusedlevel][var3][var4] & 0x4) != 0) {
							var2 = this.minusedlevel;
						}
					}
				}
			} else {
				int var11 = var7 * 65536 / var8;
				int var12 = 32768;
				while (var4 != var6) {
					if (var4 < var6) {
						var4++;
					} else if (var4 > var6) {
						var4--;
					}
					if ((this.mapl[this.minusedlevel][var3][var4] & 0x4) != 0) {
						var2 = this.minusedlevel;
					}
					var12 += var11;
					if (var12 >= 65536) {
						var12 -= 65536;
						if (var3 < var5) {
							var3++;
						} else if (var3 > var5) {
							var3--;
						}
						if ((this.mapl[this.minusedlevel][var3][var4] & 0x4) != 0) {
							var2 = this.minusedlevel;
						}
					}
				}
			}
		}
		if ((this.mapl[this.minusedlevel][localPlayer.x >> 7][localPlayer.z >> 7] & 0x4) != 0) {
			var2 = this.minusedlevel;
		}
		return var2;
	}

	@ObfuscatedName("client.N(I)V")
	public void entityOverlays() {
		this.chatCount = 0;
		for (int var2 = -1; var2 < this.playerCount + this.npcCount; var2++) {
			ClientEntity var3;
			if (var2 == -1) {
				var3 = localPlayer;
			} else if (var2 < this.playerCount) {
				var3 = this.players[this.playerIds[var2]];
			} else {
				var3 = this.npcs[this.npcIds[var2 - this.playerCount]];
			}
			if (var3 != null && var3.isReady()) {
				if (var2 >= this.playerCount) {
					NpcType var7 = ((ClientNpc) var3).type;
					if (var7.headicon >= 0 && var7.headicon < this.imageHeadicons.length) {
						this.getOverlayPos(var3.height + 15, var3);
						if (this.projectX > -1) {
							this.imageHeadicons[var7.headicon].plotSprite(this.projectX - 12, this.projectY - 30);
						}
					}
					if (this.hintType == 1 && this.hintNpc == this.npcIds[var2 - this.playerCount] && loopCycle % 20 < 10) {
						this.getOverlayPos(var3.height + 15, var3);
						if (this.projectX > -1) {
							this.imageHeadicons[2].plotSprite(this.projectX - 12, this.projectY - 28);
						}
					}
				} else {
					int var4 = 30;
					ClientPlayer var5 = (ClientPlayer) var3;
					if (var5.headicon != 0) {
						this.getOverlayPos(var3.height + 15, var3);
						if (this.projectX > -1) {
							for (int var6 = 0; var6 < 8; var6++) {
								if ((var5.headicon & 0x1 << var6) != 0) {
									this.imageHeadicons[var6].plotSprite(this.projectX - 12, this.projectY - var4);
									var4 -= 25;
								}
							}
						}
					}
					if (var2 >= 0 && this.hintType == 10 && this.hintPlayer == this.playerIds[var2]) {
						this.getOverlayPos(var3.height + 15, var3);
						if (this.projectX > -1) {
							this.imageHeadicons[7].plotSprite(this.projectX - 12, this.projectY - var4);
						}
					}
				}
				if (var3.chatMessage != null && (var2 >= this.playerCount || this.chatPublicMode == 0 || this.chatPublicMode == 3 || this.chatPublicMode == 1 && this.isFriend(((ClientPlayer) var3).name))) {
					this.getOverlayPos(var3.height, var3);
					if (this.projectX > -1 && this.chatCount < this.MAX_CHATS) {
						this.chatWidth[this.chatCount] = this.fontBold12.stringWid(var3.chatMessage) / 2;
						this.chatHeight[this.chatCount] = this.fontBold12.height2d;
						this.chatX[this.chatCount] = this.projectX;
						this.chatY[this.chatCount] = this.projectY;
						this.chatColour[this.chatCount] = var3.chatColour;
						this.chatEffect[this.chatCount] = var3.chatEffect;
						this.chatTimer[this.chatCount] = var3.chatTimer;
						this.chatMessage[this.chatCount++] = var3.chatMessage;
						if (this.chatEffects == 0 && var3.chatEffect == 1) {
							this.chatHeight[this.chatCount] += 10;
							this.chatY[this.chatCount] += 5;
						}
						if (this.chatEffects == 0 && var3.chatEffect == 2) {
							this.chatWidth[this.chatCount] = 60;
						}
					}
				}
				if (var3.combatCycle > loopCycle) {
					this.getOverlayPos(var3.height + 15, var3);
					if (this.projectX > -1) {
						int var8 = var3.health * 30 / var3.totalHealth;
						if (var8 > 30) {
							var8 = 30;
						}
						Pix2D.fillRect(5, var8, this.projectX - 15, this.projectY - 3, 65280);
						Pix2D.fillRect(5, 30 - var8, this.projectX - 15 + var8, this.projectY - 3, 16711680);
					}
				}
				for (int var9 = 0; var9 < 4; var9++) {
					if (var3.damageCycle[var9] > loopCycle) {
						this.getOverlayPos(var3.height / 2, var3);
						if (this.projectX > -1) {
							if (var9 == 1) {
								this.projectY -= 20;
							}
							if (var9 == 2) {
								this.projectX -= 15;
								this.projectY -= 10;
							}
							if (var9 == 3) {
								this.projectX += 15;
								this.projectY -= 10;
							}
							this.imageHitmarks[var3.damageType[var9]].plotSprite(this.projectX - 12, this.projectY - 12);
							this.fontPlain11.centreString(this.projectY + 4, String.valueOf(var3.damage[var9]), this.projectX, 0);
							this.fontPlain11.centreString(this.projectY + 3, String.valueOf(var3.damage[var9]), this.projectX - 1, 16777215);
						}
					}
				}
			}
		}
		for (int var10 = 0; var10 < this.chatCount; var10++) {
			int var11 = this.chatX[var10];
			int var12 = this.chatY[var10];
			int var13 = this.chatWidth[var10];
			int var14 = this.chatHeight[var10];
			boolean var15 = true;
			while (var15) {
				var15 = false;
				for (int var16 = 0; var16 < var10; var16++) {
					if (var12 + 2 > this.chatY[var16] - this.chatHeight[var16] && var12 - var14 < this.chatY[var16] + 2 && var11 - var13 < this.chatX[var16] + this.chatWidth[var16] && var11 + var13 > this.chatX[var16] - this.chatWidth[var16] && this.chatY[var16] - this.chatHeight[var16] < var12) {
						var12 = this.chatY[var16] - this.chatHeight[var16];
						var15 = true;
					}
				}
			}
			this.projectX = this.chatX[var10];
			this.projectY = this.chatY[var10] = var12;
			String var17 = this.chatMessage[var10];
			if (this.chatEffects == 0) {
				int var18 = 16776960;
				if (this.chatColour[var10] < 6) {
					var18 = this.CHAT_COLOURS[this.chatColour[var10]];
				}
				if (this.chatColour[var10] == 6) {
					var18 = this.sceneCycle % 20 < 10 ? 16711680 : 16776960;
				}
				if (this.chatColour[var10] == 7) {
					var18 = this.sceneCycle % 20 < 10 ? 255 : 65535;
				}
				if (this.chatColour[var10] == 8) {
					var18 = this.sceneCycle % 20 < 10 ? 45056 : 8454016;
				}
				if (this.chatColour[var10] == 9) {
					int var19 = 150 - this.chatTimer[var10];
					if (var19 < 50) {
						var18 = var19 * 1280 + 16711680;
					} else if (var19 < 100) {
						var18 = 16776960 - (var19 - 50) * 327680;
					} else if (var19 < 150) {
						var18 = (var19 - 100) * 5 + 65280;
					}
				}
				if (this.chatColour[var10] == 10) {
					int var20 = 150 - this.chatTimer[var10];
					if (var20 < 50) {
						var18 = var20 * 5 + 16711680;
					} else if (var20 < 100) {
						var18 = 16711935 - (var20 - 50) * 327680;
					} else if (var20 < 150) {
						var18 = (var20 - 100) * 327680 + 255 - (var20 - 100) * 5;
					}
				}
				if (this.chatColour[var10] == 11) {
					int var21 = 150 - this.chatTimer[var10];
					if (var21 < 50) {
						var18 = 16777215 - var21 * 327685;
					} else if (var21 < 100) {
						var18 = (var21 - 50) * 327685 + 65280;
					} else if (var21 < 150) {
						var18 = 16777215 - (var21 - 100) * 327680;
					}
				}
				if (this.chatEffect[var10] == 0) {
					this.fontBold12.centreString(this.projectY + 1, var17, this.projectX, 0);
					this.fontBold12.centreString(this.projectY, var17, this.projectX, var18);
				}
				if (this.chatEffect[var10] == 1) {
					this.fontBold12.centreStringWave(this.sceneCycle, 0, this.projectX, var17, this.projectY + 1);
					this.fontBold12.centreStringWave(this.sceneCycle, var18, this.projectX, var17, this.projectY);
				}
				if (this.chatEffect[var10] == 2) {
					int var22 = this.fontBold12.stringWid(var17);
					int var23 = (150 - this.chatTimer[var10]) * (var22 + 100) / 150;
					Pix2D.setClipping(this.projectX + 50, this.projectX - 50, 334, 0);
					this.fontBold12.drawString(0, this.projectX + 50 - var23, this.projectY + 1, var17);
					this.fontBold12.drawString(var18, this.projectX + 50 - var23, this.projectY, var17);
					Pix2D.resetClipping();
				}
			} else {
				this.fontBold12.centreString(this.projectY + 1, var17, this.projectX, 0);
				this.fontBold12.centreString(this.projectY, var17, this.projectX, 16776960);
			}
		}
	}

	@ObfuscatedName("client.x(I)V")
	public void coordArrow() {
		if (this.hintType == 2) {
			this.getOverlayPos((this.hintTileZ - this.sceneBaseTileZ << 7) + this.hintOffsetZ, (this.hintTileX - this.sceneBaseTileX << 7) + this.hintOffsetX, this.hintHeight * 2);
			if (this.projectX > -1 && loopCycle % 20 < 10) {
				this.imageHeadicons[2].plotSprite(this.projectX - 12, this.projectY - 28);
			}
		}
	}

	@ObfuscatedName("client.a(IBLz;)V")
	public void getOverlayPos(int arg0, ClientEntity arg2) {
		this.getOverlayPos(arg2.z, arg2.x, arg0);
	}

	@ObfuscatedName("client.b(IZII)V")
	public void getOverlayPos(int arg0, int arg2, int arg3) {
		if (arg2 < 128 || arg0 < 128 || arg2 > 13056 || arg0 > 13056) {
			this.projectX = -1;
			this.projectY = -1;
			return;
		}
		int var5 = this.getAvH(arg0, this.minusedlevel, arg2) - arg3;
		int var6 = arg2 - this.cameraX;
		int var7 = var5 - this.cameraY;
		int var8 = arg0 - this.cameraZ;
		int var9 = Model.sinTable[this.cameraPitch];
		int var10 = Model.cosTable[this.cameraPitch];
		int var11 = Model.sinTable[this.cameraYaw];
		int var12 = Model.cosTable[this.cameraYaw];
		int var13 = var8 * var11 + var6 * var12 >> 16;
		int var14 = var8 * var12 - var6 * var11 >> 16;
		int var16 = var7 * var10 - var14 * var9 >> 16;
		int var17 = var7 * var9 + var14 * var10 >> 16;
		if (var17 >= 50) {
			this.projectX = Pix3D.projectionX + (var13 << 9) / var17;
			this.projectY = Pix3D.projectionY + (var16 << 9) / var17;
		} else {
			this.projectX = -1;
			this.projectY = -1;
		}
	}

	@ObfuscatedName("client.a(IIII)I")
	public int getAvH(int arg0, int arg1, int arg2) {
		int var5 = arg2 >> 7;
		int var6 = arg0 >> 7;
		if (var5 < 0 || var6 < 0 || var5 > 103 || var6 > 103) {
			return 0;
		}
		int var7 = arg1;
		if (arg1 < 3 && (this.mapl[1][var5][var6] & 0x2) == 2) {
			var7 = arg1 + 1;
		}
		int var8 = arg2 & 0x7F;
		int var9 = arg0 & 0x7F;
		int var10 = this.groundh[var7][var5][var6] * (128 - var8) + this.groundh[var7][var5 + 1][var6] * var8 >> 7;
		int var11 = this.groundh[var7][var5][var6 + 1] * (128 - var8) + this.groundh[var7][var5 + 1][var6 + 1] * var8 >> 7;
		return var10 * (128 - var9) + var11 * var9 >> 7;
	}

	@ObfuscatedName("client.c(II)V")
	public void textureRunAnims(int arg0) {
		if (lowMem) {
			return;
		}
		if (Pix3D.textureCycle[17] >= arg0) {
			Pix8 var3 = Pix3D.textures[17];
			int var4 = var3.wi * var3.hi - 1;
			int var5 = var3.wi * this.sceneDelta * 2;
			byte[] var6 = var3.data;
			byte[] var7 = this.textureBuffer;
			for (int var8 = 0; var8 <= var4; var8++) {
				var7[var8] = var6[var8 - var5 & var4];
			}
			var3.data = var7;
			this.textureBuffer = var6;
			Pix3D.pushTexture(17);
		}
		if (Pix3D.textureCycle[24] >= arg0) {
			Pix8 var9 = Pix3D.textures[24];
			int var10 = var9.wi * var9.hi - 1;
			int var11 = var9.wi * this.sceneDelta * 2;
			byte[] var12 = var9.data;
			byte[] var13 = this.textureBuffer;
			for (int var14 = 0; var14 <= var10; var14++) {
				var13[var14] = var12[var14 - var11 & var10];
			}
			var9.data = var13;
			this.textureBuffer = var12;
			Pix3D.pushTexture(24);
		}
	}

	@ObfuscatedName("client.E(I)V")
	public void otherOverlays() {
		this.drawPrivateMessages();
		if (this.crossMode == 1) {
			this.imageCross[this.crossCycle / 100].plotSprite(this.crossX - 8 - 4, this.crossY - 8 - 4);
		}
		if (this.crossMode == 2) {
			this.imageCross[this.crossCycle / 100 + 4].plotSprite(this.crossX - 8 - 4, this.crossY - 8 - 4);
			field1511++;
			if (field1511 > 57) {
				field1511 = 0;
				// ANTICHEAT_CYCLELOGIC5
				this.out.pIsaac(100);
			}
		}
		if (this.mainOverlayLayerId != -1) {
			this.animateLayer(this.sceneDelta, this.mainOverlayLayerId);
			this.drawLayer(0, IfType.list[this.mainOverlayLayerId], 0, 0);
		}
		if (this.mainLayerId != -1) {
			this.animateLayer(this.sceneDelta, this.mainLayerId);
			this.drawLayer(0, IfType.list[this.mainLayerId], 0, 0);
		}
		this.getSpecialArea();
		if (!this.menuVisible) {
			this.handleInput();
			this.drawTooltip();
		} else if (this.menuArea == 0) {
			this.drawMenu();
		}
		if (this.inMultizone == 1) {
			this.imageHeadicons[1].plotSprite(472, 296);
		}
		if (this.systemUpdateTimer == 0) {
			return;
		}
		int var2 = this.systemUpdateTimer / 50;
		int var3 = var2 / 60;
		int var4 = var2 % 60;
		if (var4 < 10) {
			this.fontPlain12.drawString(16776960, 4, 329, "System update in: " + var3 + ":0" + var4);
		} else {
			this.fontPlain12.drawString(16776960, 4, 329, "System update in: " + var3 + ":" + var4);
		}
	}

	@ObfuscatedName("client.d(Z)V")
	public void drawPrivateMessages() {
		if (this.splitPrivateChat == 0) {
			return;
		}
		PixFont var3 = this.fontPlain12;
		int var4 = 0;
		if (this.systemUpdateTimer != 0) {
			var4 = 1;
		}
		for (int var5 = 0; var5 < 100; var5++) {
			if (this.messageText[var5] != null) {
				int var6 = this.messageType[var5];
				String var7 = this.messageSender[var5];
				byte var8 = 0;
				if (var7 != null && var7.startsWith("@cr1@")) {
					var7 = var7.substring(5);
					var8 = 1;
				}
				if (var7 != null && var7.startsWith("@cr2@")) {
					var7 = var7.substring(5);
					var8 = 2;
				}
				if ((var6 == 3 || var6 == 7) && (var6 == 7 || this.chatPrivateMode == 0 || this.chatPrivateMode == 1 && this.isFriend(var7))) {
					int var9 = 329 - var4 * 13;
					byte var10 = 4;
					var3.drawString(0, var10, var9, "From");
					var3.drawString(65535, var10, var9 - 1, "From");
					int var11 = var10 + var3.stringWid("From ");
					if (var8 == 1) {
						this.imageModIcons[0].plotSprite(var11, var9 - 12);
						var11 += 14;
					}
					if (var8 == 2) {
						this.imageModIcons[1].plotSprite(var11, var9 - 12);
						var11 += 14;
					}
					var3.drawString(0, var11, var9, var7 + ": " + this.messageText[var5]);
					var3.drawString(65535, var11, var9 - 1, var7 + ": " + this.messageText[var5]);
					var4++;
					if (var4 >= 5) {
						return;
					}
				}
				if (var6 == 5 && this.chatPrivateMode < 2) {
					int var12 = 329 - var4 * 13;
					var3.drawString(0, 4, var12, this.messageText[var5]);
					var3.drawString(65535, 4, var12 - 1, this.messageText[var5]);
					var4++;
					if (var4 >= 5) {
						return;
					}
				}
				if (var6 == 6 && this.chatPrivateMode < 2) {
					int var13 = 329 - var4 * 13;
					var3.drawString(0, 4, var13, "To " + var7 + ": " + this.messageText[var5]);
					var3.drawString(65535, 4, var13 - 1, "To " + var7 + ": " + this.messageText[var5]);
					var4++;
					if (var4 >= 5) {
						return;
					}
				}
			}
		}
	}

	@ObfuscatedName("client.G(I)V")
	public void getSpecialArea() {
		this.worldLocationState = 0;
		int var2 = (localPlayer.x >> 7) + this.sceneBaseTileX;
		int var3 = (localPlayer.z >> 7) + this.sceneBaseTileZ;
		if (var2 >= 3053 && var2 <= 3156 && var3 >= 3056 && var3 <= 3136) {
			this.worldLocationState = 1;
		}
		if (var2 >= 3072 && var2 <= 3118 && var3 >= 9492 && var3 <= 9535) {
			this.worldLocationState = 1;
		}
		if (this.worldLocationState == 1 && var2 >= 3139 && var2 <= 3199 && var3 >= 3008 && var3 <= 3062) {
			this.worldLocationState = 0;
		}
	}

	@ObfuscatedName("client.m(I)V")
	public void drawTooltip() {
		if (this.menuSize < 2 && this.objSelected == 0 && this.spellSelected == 0) {
			return;
		}
		String var2;
		if (this.objSelected == 1 && this.menuSize < 2) {
			var2 = "Use " + this.objSelectedName + " with...";
		} else if (this.spellSelected == 1 && this.menuSize < 2) {
			var2 = this.spellCaption + "...";
		} else {
			var2 = this.menuOption[this.menuSize - 1];
		}
		if (this.menuSize > 2) {
			var2 = var2 + "@whi@ / " + (this.menuSize - 2) + " more options";
		}
		this.fontBold12.drawStringAntiMacro(15, var2, 16777215, true, loopCycle / 1000, 4);
	}

	@ObfuscatedName("client.k(B)V")
	public void drawMenu() {
		int var2 = this.menuX;
		int var3 = this.menuY;
		int var4 = this.menuWidth;
		int var5 = this.menuHeight;
		int var6 = 6116423;
		Pix2D.fillRect(var5, var4, var2, var3, var6);
		Pix2D.fillRect(16, var4 - 2, var2 + 1, var3 + 1, 0);
		Pix2D.drawRect(0, var4 - 2, var3 + 18, var2 + 1, var5 - 19);
		this.fontBold12.drawString(var6, var2 + 3, var3 + 14, "Choose Option");
		int var7 = super.mouseX;
		int var8 = super.mouseY;
		if (this.menuArea == 0) {
			var7 -= 4;
			var8 -= 4;
		}
		if (this.menuArea == 1) {
			var7 -= 553;
			var8 -= 205;
		}
		if (this.menuArea == 2) {
			var7 -= 17;
			var8 -= 357;
		}
		for (int var10 = 0; var10 < this.menuSize; var10++) {
			int var11 = var3 + 31 + (this.menuSize - 1 - var10) * 15;
			int var12 = 16777215;
			if (var7 > var2 && var7 < var2 + var4 && var8 > var11 - 13 && var8 < var11 + 3) {
				var12 = 16776960;
			}
			this.fontBold12.drawStringTag(true, this.menuOption[var10], var11, var12, var2 + 3);
		}
	}

	@ObfuscatedName("client.a(IIIIII)V")
	public void drawDetail(int arg0, int arg1, int arg2, int arg4, int arg5) {
		int var7 = this.world.wallType(arg1, arg2, arg5);
		if (var7 != 0) {
			int var8 = this.world.typecode2(arg1, arg2, arg5, var7);
			int var9 = var8 >> 6 & 0x3;
			int var10 = var8 & 0x1F;
			int var11 = arg0;
			if (var7 > 0) {
				var11 = arg4;
			}
			int[] var12 = this.imageMinimap.data;
			int var13 = arg2 * 4 + 24624 + (103 - arg5) * 512 * 4;
			int var14 = var7 >> 14 & 0x7FFF;
			LocType var15 = LocType.get(var14);
			if (var15.mapscene == -1) {
				if (var10 == 0 || var10 == 2) {
					if (var9 == 0) {
						var12[var13] = var11;
						var12[var13 + 512] = var11;
						var12[var13 + 1024] = var11;
						var12[var13 + 1536] = var11;
					} else if (var9 == 1) {
						var12[var13] = var11;
						var12[var13 + 1] = var11;
						var12[var13 + 2] = var11;
						var12[var13 + 3] = var11;
					} else if (var9 == 2) {
						var12[var13 + 3] = var11;
						var12[var13 + 3 + 512] = var11;
						var12[var13 + 3 + 1024] = var11;
						var12[var13 + 3 + 1536] = var11;
					} else if (var9 == 3) {
						var12[var13 + 1536] = var11;
						var12[var13 + 1536 + 1] = var11;
						var12[var13 + 1536 + 2] = var11;
						var12[var13 + 1536 + 3] = var11;
					}
				}
				if (var10 == 3) {
					if (var9 == 0) {
						var12[var13] = var11;
					} else if (var9 == 1) {
						var12[var13 + 3] = var11;
					} else if (var9 == 2) {
						var12[var13 + 3 + 1536] = var11;
					} else if (var9 == 3) {
						var12[var13 + 1536] = var11;
					}
				}
				if (var10 == 2) {
					if (var9 == 3) {
						var12[var13] = var11;
						var12[var13 + 512] = var11;
						var12[var13 + 1024] = var11;
						var12[var13 + 1536] = var11;
					} else if (var9 == 0) {
						var12[var13] = var11;
						var12[var13 + 1] = var11;
						var12[var13 + 2] = var11;
						var12[var13 + 3] = var11;
					} else if (var9 == 1) {
						var12[var13 + 3] = var11;
						var12[var13 + 3 + 512] = var11;
						var12[var13 + 3 + 1024] = var11;
						var12[var13 + 3 + 1536] = var11;
					} else if (var9 == 2) {
						var12[var13 + 1536] = var11;
						var12[var13 + 1536 + 1] = var11;
						var12[var13 + 1536 + 2] = var11;
						var12[var13 + 1536 + 3] = var11;
					}
				}
			} else {
				Pix8 var16 = this.imageMapscene[var15.mapscene];
				if (var16 != null) {
					int var17 = (var15.width * 4 - var16.wi) / 2;
					int var18 = (var15.length * 4 - var16.hi) / 2;
					var16.plotSprite(arg2 * 4 + 48 + var17, (104 - arg5 - var15.length) * 4 + 48 + var18);
				}
			}
		}
		int var19 = this.world.sceneType(arg1, arg2, arg5);
		if (var19 != 0) {
			int var20 = this.world.typecode2(arg1, arg2, arg5, var19);
			int var21 = var20 >> 6 & 0x3;
			int var22 = var20 & 0x1F;
			int var23 = var19 >> 14 & 0x7FFF;
			LocType var24 = LocType.get(var23);
			if (var24.mapscene != -1) {
				Pix8 var25 = this.imageMapscene[var24.mapscene];
				if (var25 != null) {
					int var26 = (var24.width * 4 - var25.wi) / 2;
					int var27 = (var24.length * 4 - var25.hi) / 2;
					var25.plotSprite(arg2 * 4 + 48 + var26, (104 - arg5 - var24.length) * 4 + 48 + var27);
				}
			} else if (var22 == 9) {
				int var28 = 15658734;
				if (var19 > 0) {
					var28 = 15597568;
				}
				int[] var29 = this.imageMinimap.data;
				int var30 = arg2 * 4 + 24624 + (103 - arg5) * 512 * 4;
				if (var21 == 0 || var21 == 2) {
					var29[var30 + 1536] = var28;
					var29[var30 + 1024 + 1] = var28;
					var29[var30 + 512 + 2] = var28;
					var29[var30 + 3] = var28;
				} else {
					var29[var30] = var28;
					var29[var30 + 512 + 1] = var28;
					var29[var30 + 1024 + 2] = var28;
					var29[var30 + 1536 + 3] = var28;
				}
			}
		}
		int var31 = this.world.gdType(arg1, arg2, arg5);
		if (var31 != 0) {
			int var32 = var31 >> 14 & 0x7FFF;
			LocType var33 = LocType.get(var32);
			if (var33.mapscene != -1) {
				Pix8 var34 = this.imageMapscene[var33.mapscene];
				if (var34 != null) {
					int var35 = (var33.width * 4 - var34.wi) / 2;
					int var36 = (var33.length * 4 - var34.hi) / 2;
					var34.plotSprite(arg2 * 4 + 48 + var35, (104 - arg5 - var33.length) * 4 + 48 + var36);
				}
			}
		}
	}

	@ObfuscatedName("client.a(IIIII)Z")
	public boolean interactWithLoc(int arg0, int arg2, int arg3, int arg4) {
		int var6 = arg3 >> 14 & 0x7FFF;
		int var7 = this.world.typecode2(this.minusedlevel, arg0, arg2, arg3);
		if (var7 == -1) {
			return false;
		}
		int var8 = var7 & 0x1F;
		int var9 = var7 >> 6 & 0x3;
		field1285++;
		if (field1285 > 1086) {
			field1285 = 0;
			// ANTICHEAT_CYCLELOGIC2
			this.out.pIsaac(225);
			this.out.p1(0);
			int var10 = this.out.pos;
			if ((int) (Math.random() * 2.0D) == 0) {
				this.out.p2(16791);
			}
			this.out.p1(254);
			this.out.p2((int) (Math.random() * 65536.0D));
			this.out.p2(16128);
			this.out.p2(52610);
			this.out.p2((int) (Math.random() * 65536.0D));
			this.out.p2(55420);
			if ((int) (Math.random() * 2.0D) == 0) {
				this.out.p2(35025);
			}
			this.out.p2(46628);
			this.out.p1((int) (Math.random() * 256.0D));
			this.out.psize1(this.out.pos - var10);
		}
		if (var8 == 10 || var8 == 11 || var8 == 22) {
			LocType var11 = LocType.get(var6);
			int var12;
			int var13;
			if (var9 == 0 || var9 == 2) {
				var12 = var11.width;
				var13 = var11.length;
			} else {
				var12 = var11.length;
				var13 = var11.width;
			}
			int var14 = var11.forceapproach;
			if (var9 != 0) {
				var14 = (var14 << var9 & 0xF) + (var14 >> 4 - var9);
			}
			this.tryMove(var14, var13, 0, arg0, 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], arg2, false, var12, 0);
		} else {
			this.tryMove(0, 0, var9, arg0, 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], arg2, false, 0, var8 + 1);
		}
		this.crossX = super.mouseClickX;
		this.crossY = super.mouseClickY;
		this.crossMode = 2;
		this.crossCycle = 0;
		this.out.pIsaac(arg4);
		this.out.p2(arg0 + this.sceneBaseTileX);
		this.out.p2(arg2 + this.sceneBaseTileZ);
		this.out.p2(var6);
		return true;
	}

	@ObfuscatedName("client.a(IIIIIIIIIZII)Z")
	public boolean tryMove(int arg0, int arg1, int arg2, int arg4, int arg5, int arg6, int arg7, int arg8, boolean arg9, int arg10, int arg11) {
		byte var13 = 104;
		byte var14 = 104;
		for (int var15 = 0; var15 < var13; var15++) {
			for (int var16 = 0; var16 < var14; var16++) {
				this.bfsDirection[var15][var16] = 0;
				this.bfsCost[var15][var16] = 99999999;
			}
		}
		int var17 = arg7;
		int var18 = arg6;
		this.bfsDirection[arg7][arg6] = 99;
		this.bfsCost[arg7][arg6] = 0;
		byte var19 = 0;
		int var20 = 0;
		this.bfsStepX[var19] = arg7;
		int var36 = var19 + 1;
		this.bfsStepZ[var19] = arg6;
		boolean var21 = false;
		int var22 = this.bfsStepX.length;
		int[][] var23 = this.levelCollisionMap[this.minusedlevel].flags;
		while (var20 != var36) {
			var17 = this.bfsStepX[var20];
			var18 = this.bfsStepZ[var20];
			var20 = (var20 + 1) % var22;
			if (var17 == arg4 && var18 == arg8) {
				var21 = true;
				break;
			}
			if (arg11 != 0) {
				if ((arg11 < 5 || arg11 == 10) && this.levelCollisionMap[this.minusedlevel].testWall(arg2, arg4, var18, arg8, arg11 - 1, var17)) {
					var21 = true;
					break;
				}
				if (arg11 < 10 && this.levelCollisionMap[this.minusedlevel].testWDecor(arg4, var18, arg11 - 1, arg2, var17, arg8)) {
					var21 = true;
					break;
				}
			}
			if (arg10 != 0 && arg1 != 0 && this.levelCollisionMap[this.minusedlevel].testLoc(arg10, var17, arg0, arg4, var18, arg1, arg8)) {
				var21 = true;
				break;
			}
			int var24 = this.bfsCost[var17][var18] + 1;
			if (var17 > 0 && this.bfsDirection[var17 - 1][var18] == 0 && (var23[var17 - 1][var18] & 0x280108) == 0) {
				this.bfsStepX[var36] = var17 - 1;
				this.bfsStepZ[var36] = var18;
				var36 = (var36 + 1) % var22;
				this.bfsDirection[var17 - 1][var18] = 2;
				this.bfsCost[var17 - 1][var18] = var24;
			}
			if (var17 < var13 - 1 && this.bfsDirection[var17 + 1][var18] == 0 && (var23[var17 + 1][var18] & 0x280180) == 0) {
				this.bfsStepX[var36] = var17 + 1;
				this.bfsStepZ[var36] = var18;
				var36 = (var36 + 1) % var22;
				this.bfsDirection[var17 + 1][var18] = 8;
				this.bfsCost[var17 + 1][var18] = var24;
			}
			if (var18 > 0 && this.bfsDirection[var17][var18 - 1] == 0 && (var23[var17][var18 - 1] & 0x280102) == 0) {
				this.bfsStepX[var36] = var17;
				this.bfsStepZ[var36] = var18 - 1;
				var36 = (var36 + 1) % var22;
				this.bfsDirection[var17][var18 - 1] = 1;
				this.bfsCost[var17][var18 - 1] = var24;
			}
			if (var18 < var14 - 1 && this.bfsDirection[var17][var18 + 1] == 0 && (var23[var17][var18 + 1] & 0x280120) == 0) {
				this.bfsStepX[var36] = var17;
				this.bfsStepZ[var36] = var18 + 1;
				var36 = (var36 + 1) % var22;
				this.bfsDirection[var17][var18 + 1] = 4;
				this.bfsCost[var17][var18 + 1] = var24;
			}
			if (var17 > 0 && var18 > 0 && this.bfsDirection[var17 - 1][var18 - 1] == 0 && (var23[var17 - 1][var18 - 1] & 0x28010E) == 0 && (var23[var17 - 1][var18] & 0x280108) == 0 && (var23[var17][var18 - 1] & 0x280102) == 0) {
				this.bfsStepX[var36] = var17 - 1;
				this.bfsStepZ[var36] = var18 - 1;
				var36 = (var36 + 1) % var22;
				this.bfsDirection[var17 - 1][var18 - 1] = 3;
				this.bfsCost[var17 - 1][var18 - 1] = var24;
			}
			if (var17 < var13 - 1 && var18 > 0 && this.bfsDirection[var17 + 1][var18 - 1] == 0 && (var23[var17 + 1][var18 - 1] & 0x280183) == 0 && (var23[var17 + 1][var18] & 0x280180) == 0 && (var23[var17][var18 - 1] & 0x280102) == 0) {
				this.bfsStepX[var36] = var17 + 1;
				this.bfsStepZ[var36] = var18 - 1;
				var36 = (var36 + 1) % var22;
				this.bfsDirection[var17 + 1][var18 - 1] = 9;
				this.bfsCost[var17 + 1][var18 - 1] = var24;
			}
			if (var17 > 0 && var18 < var14 - 1 && this.bfsDirection[var17 - 1][var18 + 1] == 0 && (var23[var17 - 1][var18 + 1] & 0x280138) == 0 && (var23[var17 - 1][var18] & 0x280108) == 0 && (var23[var17][var18 + 1] & 0x280120) == 0) {
				this.bfsStepX[var36] = var17 - 1;
				this.bfsStepZ[var36] = var18 + 1;
				var36 = (var36 + 1) % var22;
				this.bfsDirection[var17 - 1][var18 + 1] = 6;
				this.bfsCost[var17 - 1][var18 + 1] = var24;
			}
			if (var17 < var13 - 1 && var18 < var14 - 1 && this.bfsDirection[var17 + 1][var18 + 1] == 0 && (var23[var17 + 1][var18 + 1] & 0x2801E0) == 0 && (var23[var17 + 1][var18] & 0x280180) == 0 && (var23[var17][var18 + 1] & 0x280120) == 0) {
				this.bfsStepX[var36] = var17 + 1;
				this.bfsStepZ[var36] = var18 + 1;
				var36 = (var36 + 1) % var22;
				this.bfsDirection[var17 + 1][var18 + 1] = 12;
				this.bfsCost[var17 + 1][var18 + 1] = var24;
			}
		}
		this.tryMoveNearest = 0;
		if (!var21) {
			if (arg9) {
				int var25 = 100;
				for (int var26 = 1; var26 < 2; var26++) {
					for (int var27 = arg4 - var26; var27 <= arg4 + var26; var27++) {
						for (int var28 = arg8 - var26; var28 <= arg8 + var26; var28++) {
							if (var27 >= 0 && var28 >= 0 && var27 < 104 && var28 < 104 && this.bfsCost[var27][var28] < var25) {
								var25 = this.bfsCost[var27][var28];
								var17 = var27;
								var18 = var28;
								this.tryMoveNearest = 1;
								var21 = true;
							}
						}
					}
					if (var21) {
						break;
					}
				}
			}
			if (!var21) {
				return false;
			}
		}
		byte var29 = 0;
		this.bfsStepX[var29] = var17;
		int var37 = var29 + 1;
		this.bfsStepZ[var29] = var18;
		int var30;
		int var31 = var30 = this.bfsDirection[var17][var18];
		while (var17 != arg7 || var18 != arg6) {
			if (var31 != var30) {
				var30 = var31;
				this.bfsStepX[var37] = var17;
				this.bfsStepZ[var37++] = var18;
			}
			if ((var31 & 0x2) != 0) {
				var17++;
			} else if ((var31 & 0x8) != 0) {
				var17--;
			}
			if ((var31 & 0x1) != 0) {
				var18++;
			} else if ((var31 & 0x4) != 0) {
				var18--;
			}
			var31 = this.bfsDirection[var17][var18];
		}
		if (var37 > 0) {
			int var32 = var37;
			if (var37 > 25) {
				var32 = 25;
			}
			var37--;
			int var33 = this.bfsStepX[var37];
			int var34 = this.bfsStepZ[var37];
			if (arg5 == 0) {
				// MOVE_GAMECLICK
				this.out.pIsaac(6);
				this.out.p1(var32 + var32 + 3);
			}
			if (arg5 == 1) {
				// MOVE_MINIMAPCLICK
				this.out.pIsaac(220);
				this.out.p1(var32 + var32 + 3 + 14);
			}
			if (arg5 == 2) {
				// MOVE_OPCLICK
				this.out.pIsaac(127);
				this.out.p1(var32 + var32 + 3);
			}
			if (super.actionKey[5] == 1) {
				this.out.p1(1);
			} else {
				this.out.p1(0);
			}
			this.out.p2(var33 + this.sceneBaseTileX);
			this.out.p2(var34 + this.sceneBaseTileZ);
			this.flagSceneTileX = this.bfsStepX[0];
			this.flagSceneTileZ = this.bfsStepZ[0];
			for (int var35 = 1; var35 < var32; var35++) {
				var37--;
				this.out.p1(this.bfsStepX[var37] - var33);
				this.out.p1(this.bfsStepZ[var37] - var34);
			}
			return true;
		} else if (arg5 == 1) {
			return false;
		} else {
			return true;
		}
	}

	@ObfuscatedName("client.g(Z)Z")
	public boolean tcpIn() {
		if (this.stream == null) {
			return false;
		}
		try {
			int var2 = this.stream.available();
			if (var2 == 0) {
				return false;
			}
			if (this.ptype == -1) {
				this.stream.read(this.in.data, 0, 1);
				this.ptype = this.in.data[0] & 0xFF;
				if (this.randomIn != null) {
					this.ptype = this.ptype - this.randomIn.nextInt() & 0xFF;
				}
				this.psize = Protocol.SERVERPROT_LENGTH[this.ptype];
				var2--;
			}
			if (this.psize == -1) {
				if (var2 <= 0) {
					return false;
				}
				this.stream.read(this.in.data, 0, 1);
				this.psize = this.in.data[0] & 0xFF;
				var2--;
			}
			if (this.psize == -2) {
				if (var2 <= 1) {
					return false;
				}
				this.stream.read(this.in.data, 0, 2);
				this.in.pos = 0;
				this.psize = this.in.g2();
				var2 -= 2;
			}
			if (var2 < this.psize) {
				return false;
			}
			this.in.pos = 0;
			this.stream.read(this.in.data, 0, this.psize);
			this.packetCycle = 0;
			this.ptype2 = this.ptype1;
			this.ptype1 = this.ptype0;
			this.ptype0 = this.ptype;
			if (this.ptype == 141) {
				// IF_OPENCHAT
				int var3 = this.in.g2();
				this.resetInterfaceAnimation(var3);
				if (this.sideLayerId != -1) {
					this.sideLayerId = -1;
					this.redrawSidebar = true;
					this.redrawSideicons = true;
				}
				this.chatLayerId = var3;
				this.redrawChatback = true;
				this.mainLayerId = -1;
				this.pressedContinueOption = false;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 197) {
				// IF_OPENMAIN
				int var4 = this.in.g2();
				this.resetInterfaceAnimation(var4);
				if (this.sideLayerId != -1) {
					this.sideLayerId = -1;
					this.redrawSidebar = true;
					this.redrawSideicons = true;
				}
				if (this.chatLayerId != -1) {
					this.chatLayerId = -1;
					this.redrawChatback = true;
				}
				if (this.chatbackInputOpen) {
					this.chatbackInputOpen = false;
					this.redrawChatback = true;
				}
				this.mainLayerId = var4;
				this.pressedContinueOption = false;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 167) {
				// CAM_RESET
				this.cutscene = false;
				for (int var5 = 0; var5 < 5; var5++) {
					this.cameraModifierEnabled[var5] = false;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 204) {
				// SET_PLAYER_OP
				int var6 = this.in.g1();
				int var7 = this.in.g1();
				String var8 = this.in.gstr();
				if (var6 >= 1 && var6 <= 5) {
					if (var8.equalsIgnoreCase("null")) {
						var8 = null;
					}
					this.playerOptions[var6 - 1] = var8;
					this.playerOptionsPushDown[var6 - 1] = var7 == 0;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 146) {
				// LAST_LOGIN_INFO
				this.lastAddress = this.in.g4();
				this.daysSinceLogin = this.in.g2();
				this.daysSinceRecoveriesChanged = this.in.g1();
				this.unreadMessageCount = this.in.g2();
				this.warnMembersInNonMembers = this.in.g1();
				if (this.lastAddress != 0 && this.mainLayerId == -1) {
					signlink.dnslookup(JString.formatIPv4(this.lastAddress));
					this.closeModal();
					short var9 = 650;
					if (this.daysSinceRecoveriesChanged != 201 || this.warnMembersInNonMembers == 1) {
						var9 = 655;
					}
					this.reportAbuseInput = "";
					this.reportAbuseMuteOption = false;
					for (int var10 = 0; var10 < IfType.list.length; var10++) {
						if (IfType.list[var10] != null && IfType.list[var10].clientCode == var9) {
							this.mainLayerId = IfType.list[var10].layerId;
							break;
						}
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 222) {
				// IF_SETOBJECT
				int var11 = this.in.g2();
				int var12 = this.in.g2();
				int var13 = this.in.g2();
				ObjType var14 = ObjType.get(var12);
				IfType.list[var11].modelType = 4;
				IfType.list[var11].modelId = var12;
				IfType.list[var11].modelXAn = var14.xan2d;
				IfType.list[var11].modelYAn = var14.yan2d;
				IfType.list[var11].modelZoom = var14.zoom2d * 100 / var13;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 63) {
				// UPDATE_IGNORELIST
				this.ignoreCount = this.psize / 8;
				for (int var15 = 0; var15 < this.ignoreCount; var15++) {
					this.ignoreName37[var15] = this.in.g8();
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 27) {
				// IF_SETPOSITION
				int var16 = this.in.g2();
				int var17 = this.in.g2b();
				int var18 = this.in.g2b();
				IfType var19 = IfType.list[var16];
				var19.x = var17;
				var19.y = var18;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 196) {
				// VARP_LARGE
				int var20 = this.in.g2();
				int var21 = this.in.g4();
				this.varCache[var20] = var21;
				if (this.varps[var20] != var21) {
					this.varps[var20] = var21;
					this.updateVarp(var20);
					this.redrawSidebar = true;
					if (this.tutLayerId != -1) {
						this.redrawChatback = true;
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 28) {
				// UPDATE_INV_FULL
				this.redrawSidebar = true;
				int var22 = this.in.g2();
				IfType var23 = IfType.list[var22];
				int var24 = this.in.g1();
				for (int var25 = 0; var25 < var24; var25++) {
					var23.linkObjType[var25] = this.in.g2();
					int var26 = this.in.g1();
					if (var26 == 255) {
						var26 = this.in.g4();
					}
					var23.linkObjCount[var25] = var26;
				}
				for (int var27 = var24; var27 < var23.linkObjType.length; var27++) {
					var23.linkObjType[var27] = 0;
					var23.linkObjCount[var27] = 0;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 136) {
				// UPDATE_STAT
				this.redrawSidebar = true;
				int var28 = this.in.g1();
				int var29 = this.in.g4();
				int var30 = this.in.g1();
				this.statXP[var28] = var29;
				this.statEffectiveLevel[var28] = var30;
				this.statBaseLevel[var28] = 1;
				for (int var31 = 0; var31 < 98; var31++) {
					if (var29 >= levelExperience[var31]) {
						this.statBaseLevel[var28] = var31 + 2;
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 187) {
				// IF_OPENSIDE
				int var32 = this.in.g2();
				this.resetInterfaceAnimation(var32);
				if (this.chatLayerId != -1) {
					this.chatLayerId = -1;
					this.redrawChatback = true;
				}
				if (this.chatbackInputOpen) {
					this.chatbackInputOpen = false;
					this.redrawChatback = true;
				}
				this.sideLayerId = var32;
				this.redrawSidebar = true;
				this.redrawSideicons = true;
				this.mainLayerId = -1;
				this.pressedContinueOption = false;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 249) {
				// IF_OPENMAIN_SIDE
				int var33 = this.in.g2();
				int var34 = this.in.g2();
				if (this.chatLayerId != -1) {
					this.chatLayerId = -1;
					this.redrawChatback = true;
				}
				if (this.chatbackInputOpen) {
					this.chatbackInputOpen = false;
					this.redrawChatback = true;
				}
				this.mainLayerId = var33;
				this.sideLayerId = var34;
				this.redrawSidebar = true;
				this.redrawSideicons = true;
				this.pressedContinueOption = false;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 5) {
				// P_COUNTDIALOG
				this.showSocialInput = false;
				this.chatbackInputOpen = true;
				this.chatbackInput = "";
				this.redrawChatback = true;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 239) {
				// TUT_OPEN
				int var35 = this.in.g2b();
				this.tutLayerId = var35;
				this.redrawChatback = true;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 38) {
				// IF_SETCOLOUR
				int var36 = this.in.g2();
				int var37 = this.in.g2();
				int var38 = var37 >> 10 & 0x1F;
				int var39 = var37 >> 5 & 0x1F;
				int var40 = var37 & 0x1F;
				IfType.list[var36].colour = (var38 << 19) + (var39 << 11) + (var40 << 3);
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 64) {
				// HINT_ARROW
				this.hintType = this.in.g1();
				if (this.hintType == 1) {
					this.hintNpc = this.in.g2();
				}
				if (this.hintType >= 2 && this.hintType <= 6) {
					if (this.hintType == 2) {
						this.hintOffsetX = 64;
						this.hintOffsetZ = 64;
					}
					if (this.hintType == 3) {
						this.hintOffsetX = 0;
						this.hintOffsetZ = 64;
					}
					if (this.hintType == 4) {
						this.hintOffsetX = 128;
						this.hintOffsetZ = 64;
					}
					if (this.hintType == 5) {
						this.hintOffsetX = 64;
						this.hintOffsetZ = 0;
					}
					if (this.hintType == 6) {
						this.hintOffsetX = 64;
						this.hintOffsetZ = 128;
					}
					this.hintType = 2;
					this.hintTileX = this.in.g2();
					this.hintTileZ = this.in.g2();
					this.hintHeight = this.in.g1();
				}
				if (this.hintType == 10) {
					this.hintPlayer = this.in.g2();
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 159) {
				// UPDATE_ZONE_FULL_FOLLOWS
				this.baseX = this.in.g1();
				this.baseZ = this.in.g1();
				for (int var41 = this.baseX; var41 < this.baseX + 8; var41++) {
					for (int var42 = this.baseZ; var42 < this.baseZ + 8; var42++) {
						if (this.objStacks[this.minusedlevel][var41][var42] != null) {
							this.objStacks[this.minusedlevel][var41][var42] = null;
							this.showObject(var41, var42);
						}
					}
				}
				for (LocChange var43 = (LocChange) this.locChanges.head(); var43 != null; var43 = (LocChange) this.locChanges.next()) {
					if (var43.x >= this.baseX && var43.x < this.baseX + 8 && var43.z >= this.baseZ && var43.z < this.baseZ + 8 && var43.level == this.minusedlevel) {
						var43.endTime = 0;
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 161) {
				// IF_SETPLAYERHEAD
				int var44 = this.in.g2();
				IfType.list[var44].modelType = 3;
				IfType.list[var44].modelId = (localPlayer.colour[0] << 24) + (localPlayer.colour[4] << 18) + (localPlayer.appearance[0] << 12) + (localPlayer.appearance[8] << 6) + localPlayer.appearance[11];
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 225) {
				// CAM_SHAKE
				int var45 = this.in.g1();
				int var46 = this.in.g1();
				int var47 = this.in.g1();
				int var48 = this.in.g1();
				this.cameraModifierEnabled[var45] = true;
				this.cameraModifierJitter[var45] = var46;
				this.cameraModifierWobbleScale[var45] = var47;
				this.cameraModifierWobbleSpeed[var45] = var48;
				this.cameraModifierCycle[var45] = 0;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 213) {
				// UPDATE_PID
				this.localPid = this.in.g2();
				this.membersAccount = this.in.g1();
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 170) {
				// UPDATE_INV_PARTIAL
				this.redrawSidebar = true;
				int var49 = this.in.g2();
				IfType var50 = IfType.list[var49];
				while (this.in.pos < this.psize) {
					int var51 = this.in.g1();
					int var52 = this.in.g2();
					int var53 = this.in.g1();
					if (var53 == 255) {
						var53 = this.in.g4();
					}
					if (var51 >= 0 && var51 < var50.linkObjType.length) {
						var50.linkObjType[var51] = var52;
						var50.linkObjCount[var51] = var53;
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 138) {
				// IF_SETTAB_ACTIVE
				this.sideTab = this.in.g1();
				this.redrawSidebar = true;
				this.redrawSideicons = true;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 255) {
				// FRIENDLIST_LOADED
				this.friendListStatus = this.in.g1();
				this.redrawSidebar = true;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 61) {
				// UPDATE_ZONE_PARTIAL_ENCLOSED
				this.baseX = this.in.g1();
				this.baseZ = this.in.g1();
				while (this.in.pos < this.psize) {
					int var54 = this.in.g1();
					this.zonePacket(var54, this.in);
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 75) {
				// SET_MULTIWAY
				this.inMultizone = this.in.g1();
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 55) {
				// CAM_MOVETO
				this.cutscene = true;
				this.cutsceneSrcLocalTileX = this.in.g1();
				this.cutsceneSrcLocalTileZ = this.in.g1();
				this.cutsceneSrcHeight = this.in.g2();
				this.cutsceneMoveSpeed = this.in.g1();
				this.cutsceneMoveAcceleration = this.in.g1();
				if (this.cutsceneMoveAcceleration >= 100) {
					this.cameraX = this.cutsceneSrcLocalTileX * 128 + 64;
					this.cameraZ = this.cutsceneSrcLocalTileZ * 128 + 64;
					this.cameraY = this.getAvH(this.cameraZ, this.minusedlevel, this.cameraX) - this.cutsceneSrcHeight;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 173) {
				// UPDATE_ZONE_PARTIAL_FOLLOWS
				this.baseX = this.in.g1();
				this.baseZ = this.in.g1();
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 29) {
				// FINISH_TRACKING
				Packet var55 = InputTracking.stop();
				if (var55 != null) {
					// EVENT_TRACKING
					this.out.pIsaac(142);
					this.out.p2(var55.pos);
					this.out.pdata(0, var55.data, var55.pos);
					var55.release();
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 0) {
				// CAM_LOOKAT
				this.cutscene = true;
				this.cutsceneDstLocalTileX = this.in.g1();
				this.cutsceneDstLocalTileZ = this.in.g1();
				this.cutsceneDstHeight = this.in.g2();
				this.cutsceneRotateSpeed = this.in.g1();
				this.cutsceneRotateAcceleration = this.in.g1();
				if (this.cutsceneRotateAcceleration >= 100) {
					int var56 = this.cutsceneDstLocalTileX * 128 + 64;
					int var57 = this.cutsceneDstLocalTileZ * 128 + 64;
					int var58 = this.getAvH(var57, this.minusedlevel, var56) - this.cutsceneDstHeight;
					int var59 = var56 - this.cameraX;
					int var60 = var58 - this.cameraY;
					int var61 = var57 - this.cameraZ;
					int var62 = (int) Math.sqrt((double) (var59 * var59 + var61 * var61));
					this.cameraPitch = (int) (Math.atan2((double) var60, (double) var62) * 325.949D) & 0x7FF;
					this.cameraYaw = (int) (Math.atan2((double) var59, (double) var61) * -325.949D) & 0x7FF;
					if (this.cameraPitch < 128) {
						this.cameraPitch = 128;
					}
					if (this.cameraPitch > 383) {
						this.cameraPitch = 383;
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 95) {
				// IF_SETANIM
				int var63 = this.in.g2();
				int var64 = this.in.g2b();
				IfType var65 = IfType.list[var63];
				var65.modelAnim = var64;
				if (var64 == -1) {
					var65.seqFrame = 0;
					var65.seqCycle = 0;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 94) {
				// UPDATE_RUNENERGY
				if (this.sideTab == 12) {
					this.redrawSidebar = true;
				}
				this.runenergy = this.in.g1();
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 58) {
				// TUT_FLASH
				this.flashingTab = this.in.g1();
				if (this.flashingTab == this.sideTab) {
					if (this.flashingTab == 3) {
						this.sideTab = 1;
					} else {
						this.sideTab = 3;
					}
					this.redrawSidebar = true;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 60) {
				// MESSAGE_PRIVATE
				long var66 = this.in.g8();
				int var68 = this.in.g4();
				int var69 = this.in.g1();
				boolean var70 = false;
				for (int var71 = 0; var71 < 100; var71++) {
					if (this.messageIds[var71] == var68) {
						var70 = true;
						break;
					}
				}
				if (var69 <= 1) {
					for (int var72 = 0; var72 < this.ignoreCount; var72++) {
						if (this.ignoreName37[var72] == var66) {
							var70 = true;
							break;
						}
					}
				}
				if (!var70 && this.worldLocationState == 0) {
					try {
						this.messageIds[this.privateMessageCount] = var68;
						this.privateMessageCount = (this.privateMessageCount + 1) % 100;
						String var73 = WordPack.unpack(this.in, this.psize - 13);
						String var74 = WordFilter.filter(var73);
						if (var69 == 2 || var69 == 3) {
							this.addChat("@cr2@" + JString.formatDisplayName(JString.fromBase37(var66)), 7, var74);
						} else if (var69 == 1) {
							this.addChat("@cr1@" + JString.formatDisplayName(JString.fromBase37(var66)), 7, var74);
						} else {
							this.addChat(JString.formatDisplayName(JString.fromBase37(var66)), 3, var74);
						}
					} catch (Exception var159) {
						signlink.reporterror("cde1");
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 143) {
				// UPDATE_REBOOT_TIMER
				this.systemUpdateTimer = this.in.g2() * 30;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 14) {
				// IF_SETSCROLLPOS
				int com = this.in.g2();
				int pos = this.in.g2();
				IfType inter = IfType.list[com];
				if (inter != null && inter.type == 0) {
					if (pos < 0) {
						pos = 0;
					}
					if (pos > inter.scrollSize - inter.height) {
						pos = inter.scrollSize - inter.height;
					}
					inter.scrollPosition = pos;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 3) {
				// IF_SETNPCHEAD
				int var79 = this.in.g2();
				int var80 = this.in.g2();
				IfType.list[var79].modelType = 2;
				IfType.list[var79].modelId = var80;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 164) {
				// UPDATE_RUNWEIGHT
				if (this.sideTab == 12) {
					this.redrawSidebar = true;
				}
				this.runweight = this.in.g2b();
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 168) {
				// UPDATE_INV_STOP_TRANSMIT
				int var81 = this.in.g2();
				IfType var82 = IfType.list[var81];
				for (int var83 = 0; var83 < var82.linkObjType.length; var83++) {
					var82.linkObjType[var83] = -1;
					var82.linkObjType[var83] = 0;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 123) {
				// NPC_INFO
				this.getNpcPos(this.in, this.psize);
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 211) {
				// IF_SETMODEL
				int var84 = this.in.g2();
				int var85 = this.in.g2();
				IfType.list[var84].modelType = 1;
				IfType.list[var84].modelId = var85;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 140) {
				// RESET_CLIENT_VARCACHE
				for (int var86 = 0; var86 < this.varps.length; var86++) {
					if (this.varps[var86] != this.varCache[var86]) {
						this.varps[var86] = this.varCache[var86];
						this.updateVarp(var86);
						this.redrawSidebar = true;
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 91) {
				// IF_SETTAB
				int var87 = this.in.g2();
				int var88 = this.in.g1();
				if (var87 == 65535) {
					var87 = -1;
				}
				this.tabInterfaceId[var88] = var87;
				this.redrawSidebar = true;
				this.redrawSideicons = true;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 21) {
				// LOGOUT
				this.logout();
				this.ptype = -1;
				return false;
			}
			if (this.ptype == 163) {
				// MIDI_SONG
				int var89 = this.in.g2();
				if (var89 == 65535) {
					var89 = -1;
				}
				if (var89 != this.nextMidiSong && this.midiActive && !lowMem && this.nextMusicDelay == 0) {
					this.midiSong = var89;
					this.midiFading = true;
					this.onDemand.request(2, this.midiSong);
				}
				this.nextMidiSong = var89;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 242) {
				// MIDI_JINGLE
				int var90 = this.in.g2();
				int var91 = this.in.g2();
				if (this.midiActive && !lowMem) {
					this.midiSong = var90;
					this.midiFading = false;
					this.onDemand.request(2, this.midiSong);
					this.nextMusicDelay = var91;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 174) {
				// IF_CLOSE
				if (this.sideLayerId != -1) {
					this.sideLayerId = -1;
					this.redrawSidebar = true;
					this.redrawSideicons = true;
				}
				if (this.chatLayerId != -1) {
					this.chatLayerId = -1;
					this.redrawChatback = true;
				}
				if (this.chatbackInputOpen) {
					this.chatbackInputOpen = false;
					this.redrawChatback = true;
				}
				this.mainLayerId = -1;
				this.pressedContinueOption = false;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 111) {
				// UPDATE_FRIENDLIST
				long var92 = this.in.g8();
				int var94 = this.in.g1();
				String var95 = JString.formatDisplayName(JString.fromBase37(var92));
				for (int var96 = 0; var96 < this.friendCount; var96++) {
					if (var92 == this.friendName37[var96]) {
						if (this.friendWorld[var96] != var94) {
							this.friendWorld[var96] = var94;
							this.redrawSidebar = true;
							if (var94 > 0) {
								this.addChat("", 5, var95 + " has logged in.");
							}
							if (var94 == 0) {
								this.addChat("", 5, var95 + " has logged out.");
							}
						}
						var95 = null;
						break;
					}
				}
				if (var95 != null && this.friendCount < 200) {
					this.friendName37[this.friendCount] = var92;
					this.friendName[this.friendCount] = var95;
					this.friendWorld[this.friendCount] = var94;
					this.friendCount++;
					this.redrawSidebar = true;
				}
				boolean var97 = false;
				while (!var97) {
					var97 = true;
					for (int var98 = 0; var98 < this.friendCount - 1; var98++) {
						if (this.friendWorld[var98] != nodeId && this.friendWorld[var98 + 1] == nodeId || this.friendWorld[var98] == 0 && this.friendWorld[var98 + 1] != 0) {
							int var99 = this.friendWorld[var98];
							this.friendWorld[var98] = this.friendWorld[var98 + 1];
							this.friendWorld[var98 + 1] = var99;
							String var100 = this.friendName[var98];
							this.friendName[var98] = this.friendName[var98 + 1];
							this.friendName[var98 + 1] = var100;
							long var101 = this.friendName37[var98];
							this.friendName37[var98] = this.friendName37[var98 + 1];
							this.friendName37[var98 + 1] = var101;
							this.redrawSidebar = true;
							var97 = false;
						}
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 85) {
				// IF_OPENOVERLAY
				int var103 = this.in.g2b();
				if (var103 >= 0) {
					this.resetInterfaceAnimation(var103);
				}
				this.mainOverlayLayerId = var103;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 87) {
				// PLAYER_INFO
				this.getPlayerPos(this.in, this.psize);
				this.awaitingSync = false;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 203) {
				// RESET_ANIMS
				for (int var104 = 0; var104 < this.players.length; var104++) {
					if (this.players[var104] != null) {
						this.players[var104].primarySeqId = -1;
					}
				}
				for (int var105 = 0; var105 < this.npcs.length; var105++) {
					if (this.npcs[var105] != null) {
						this.npcs[var105].primarySeqId = -1;
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 227) {
				// IF_SETHIDE
				int var106 = this.in.g2();
				boolean var107 = this.in.g1() == 1;
				IfType.list[var106].hidden = var107;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 25) {
				// SYNTH_SOUND
				int var108 = this.in.g2();
				int var109 = this.in.g1();
				int var110 = this.in.g2();
				if (this.waveEnabled && !lowMem && this.waveCount < 50) {
					this.waveIds[this.waveCount] = var108;
					this.waveLoops[this.waveCount] = var109;
					this.waveDelay[this.waveCount] = var110 + Wave.delay[var108];
					this.waveCount++;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 73) {
				// MESSAGE_GAME
				String var111 = this.in.gstr();
				if (var111.endsWith(":tradereq:")) {
					String var112 = var111.substring(0, var111.indexOf(":"));
					long var113 = JString.toBase37(var112);
					boolean var115 = false;
					for (int var116 = 0; var116 < this.ignoreCount; var116++) {
						if (this.ignoreName37[var116] == var113) {
							var115 = true;
							break;
						}
					}
					if (!var115 && this.worldLocationState == 0) {
						this.addChat(var112, 4, "wishes to trade with you.");
					}
				} else if (var111.endsWith(":duelreq:")) {
					String var117 = var111.substring(0, var111.indexOf(":"));
					long var118 = JString.toBase37(var117);
					boolean var120 = false;
					for (int var121 = 0; var121 < this.ignoreCount; var121++) {
						if (this.ignoreName37[var121] == var118) {
							var120 = true;
							break;
						}
					}
					if (!var120 && this.worldLocationState == 0) {
						this.addChat(var117, 8, "wishes to duel with you.");
					}
				} else {
					this.addChat("", 0, var111);
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 41) {
				// IF_SETTEXT
				int var122 = this.in.g2();
				String var123 = this.in.gstr();
				IfType.list[var122].text = var123;
				if (IfType.list[var122].layerId == this.tabInterfaceId[this.sideTab]) {
					this.redrawSidebar = true;
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 24) {
				// CHAT_FILTER_SETTINGS
				this.chatPublicMode = this.in.g1();
				this.chatPrivateMode = this.in.g1();
				this.chatTradeMode = this.in.g1();
				this.redrawPrivacySettings = true;
				this.redrawChatback = true;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 108) {
				// UNSET_MAP_FLAG
				this.flagSceneTileX = 0;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 209) {
				// REBUILD_NORMAL
				int var124 = this.in.g2();
				int var125 = this.in.g2();
				if (this.sceneCenterZoneX == var124 && this.sceneCenterZoneZ == var125 && this.sceneState == 2) {
					this.ptype = -1;
					return true;
				}
				this.sceneCenterZoneX = var124;
				this.sceneCenterZoneZ = var125;
				this.sceneBaseTileX = (this.sceneCenterZoneX - 6) * 8;
				this.sceneBaseTileZ = (this.sceneCenterZoneZ - 6) * 8;
				this.withinTutorialIsland = false;
				if ((this.sceneCenterZoneX / 8 == 48 || this.sceneCenterZoneX / 8 == 49) && this.sceneCenterZoneZ / 8 == 48) {
					this.withinTutorialIsland = true;
				}
				if (this.sceneCenterZoneX / 8 == 48 && this.sceneCenterZoneZ / 8 == 148) {
					this.withinTutorialIsland = true;
				}
				this.sceneState = 1;
				this.sceneLoadStartTime = System.currentTimeMillis();
				this.areaViewport.bind();
				this.fontPlain12.centreString(151, "Loading - please wait.", 257, 0);
				this.fontPlain12.centreString(150, "Loading - please wait.", 256, 16777215);
				this.areaViewport.draw(4, 4, super.graphics);
				int var126 = 0;
				for (int var127 = (this.sceneCenterZoneX - 6) / 8; var127 <= (this.sceneCenterZoneX + 6) / 8; var127++) {
					for (int var128 = (this.sceneCenterZoneZ - 6) / 8; var128 <= (this.sceneCenterZoneZ + 6) / 8; var128++) {
						var126++;
					}
				}
				this.mapBuildGroundData = new byte[var126][];
				this.mapBuildLocationData = new byte[var126][];
				this.mapBuildIndex = new int[var126];
				this.mapBuildGroundFile = new int[var126];
				this.mapBuildLocationFile = new int[var126];
				int var129 = 0;
				for (int var130 = (this.sceneCenterZoneX - 6) / 8; var130 <= (this.sceneCenterZoneX + 6) / 8; var130++) {
					for (int var131 = (this.sceneCenterZoneZ - 6) / 8; var131 <= (this.sceneCenterZoneZ + 6) / 8; var131++) {
						this.mapBuildIndex[var129] = (var130 << 8) + var131;
						if (this.withinTutorialIsland && (var131 == 49 || var131 == 149 || var131 == 147 || var130 == 50 || var130 == 49 && var131 == 47)) {
							this.mapBuildGroundFile[var129] = -1;
							this.mapBuildLocationFile[var129] = -1;
							var129++;
						} else {
							int var132 = this.mapBuildGroundFile[var129] = this.onDemand.getMapFile(var130, var131, 0);
							if (var132 != -1) {
								this.onDemand.request(3, var132);
							}
							int var133 = this.mapBuildLocationFile[var129] = this.onDemand.getMapFile(var130, var131, 1);
							if (var133 != -1) {
								this.onDemand.request(3, var133);
							}
							var129++;
						}
					}
				}
				int var134 = this.sceneBaseTileX - this.mapLastBaseX;
				int var135 = this.sceneBaseTileZ - this.mapLastBaseZ;
				this.mapLastBaseX = this.sceneBaseTileX;
				this.mapLastBaseZ = this.sceneBaseTileZ;
				for (int var136 = 0; var136 < 16384; var136++) {
					ClientNpc var137 = this.npcs[var136];
					if (var137 != null) {
						for (int var138 = 0; var138 < 10; var138++) {
							var137.routeTileX[var138] -= var134;
							var137.routeTileZ[var138] -= var135;
						}
						var137.x -= var134 * 128;
						var137.z -= var135 * 128;
					}
				}
				for (int var139 = 0; var139 < this.MAX_PLAYER_COUNT; var139++) {
					ClientPlayer var140 = this.players[var139];
					if (var140 != null) {
						for (int var141 = 0; var141 < 10; var141++) {
							var140.routeTileX[var141] -= var134;
							var140.routeTileZ[var141] -= var135;
						}
						var140.x -= var134 * 128;
						var140.z -= var135 * 128;
					}
				}
				this.awaitingSync = true;
				byte var142 = 0;
				byte var143 = 104;
				byte var144 = 1;
				if (var134 < 0) {
					var142 = 103;
					var143 = -1;
					var144 = -1;
				}
				byte var145 = 0;
				byte var146 = 104;
				byte var147 = 1;
				if (var135 < 0) {
					var145 = 103;
					var146 = -1;
					var147 = -1;
				}
				for (int var148 = var142; var148 != var143; var148 += var144) {
					for (int var149 = var145; var149 != var146; var149 += var147) {
						int var150 = var148 + var134;
						int var151 = var149 + var135;
						for (int var152 = 0; var152 < 4; var152++) {
							if (var150 >= 0 && var151 >= 0 && var150 < 104 && var151 < 104) {
								this.objStacks[var152][var148][var149] = this.objStacks[var152][var150][var151];
							} else {
								this.objStacks[var152][var148][var149] = null;
							}
						}
					}
				}
				for (LocChange var153 = (LocChange) this.locChanges.head(); var153 != null; var153 = (LocChange) this.locChanges.next()) {
					var153.x -= var134;
					var153.z -= var135;
					if (var153.x < 0 || var153.z < 0 || var153.x >= 104 || var153.z >= 104) {
						var153.unlink();
					}
				}
				if (this.flagSceneTileX != 0) {
					this.flagSceneTileX -= var134;
					this.flagSceneTileZ -= var135;
				}
				this.cutscene = false;
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 251) {
				// ENABLE_TRACKING
				InputTracking.activate();
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 186) {
				// VARP_SMALL
				int var154 = this.in.g2();
				byte var155 = this.in.g1b();
				this.varCache[var154] = var155;
				if (this.varps[var154] != var155) {
					this.varps[var154] = var155;
					this.updateVarp(var154);
					this.redrawSidebar = true;
					if (this.tutLayerId != -1) {
						this.redrawChatback = true;
					}
				}
				this.ptype = -1;
				return true;
			}
			if (this.ptype == 98 || this.ptype == 218 || this.ptype == 8 || this.ptype == 114 || this.ptype == 37 || this.ptype == 115 || this.ptype == 120 || this.ptype == 30 || this.ptype == 88 || this.ptype == 70) {
				this.zonePacket(this.ptype, this.in);
				this.ptype = -1;
				return true;
			}
			signlink.reporterror("T1 - " + this.ptype + "," + this.psize + " - " + this.ptype1 + "," + this.ptype2);
			this.logout();
		} catch (IOException var160) {
			this.tryReconnect();
		} catch (Exception var161) {
			var161.printStackTrace();
			String var157 = "T2 - " + this.ptype + "," + this.ptype1 + "," + this.ptype2 + " - " + this.psize + "," + (this.sceneBaseTileX + localPlayer.routeTileX[0]) + "," + (this.sceneBaseTileZ + localPlayer.routeTileZ[0]) + " - ";
			for (int var158 = 0; var158 < this.psize && var158 < 50; var158++) {
				var157 = var157 + this.in.data[var158] + ",";
			}
			signlink.reporterror(var157);
			this.logout();
		}
		return true;
	}

	@ObfuscatedName("client.a(ILmb;I)V")
	public void zonePacket(int arg0, Packet arg1) {
		if (arg0 == 70 || arg0 == 88) {
			// LOC_ADD_CHANGE || LOC_DEL
			int var4 = arg1.g1();
			int var5 = this.baseX + (var4 >> 4 & 0x7);
			int var6 = this.baseZ + (var4 & 0x7);
			int var7 = arg1.g1();
			int var8 = var7 >> 2;
			int var9 = var7 & 0x3;
			int var10 = this.LOC_SHAPE_TO_LAYER[var8];
			int var11;
			if (arg0 == 88) {
				var11 = -1;
			} else {
				var11 = arg1.g2();
			}
			if (var5 >= 0 && var6 >= 0 && var5 < 104 && var6 < 104) {
				this.locChangeCreate(this.minusedlevel, var5, 0, var11, var8, var10, -1, var6, var9);
			}
		} else if (arg0 == 30) {
			// LOC_ANIM
			int var12 = arg1.g1();
			int var13 = this.baseX + (var12 >> 4 & 0x7);
			int var14 = this.baseZ + (var12 & 0x7);
			int var15 = arg1.g1();
			int var16 = var15 >> 2;
			int var17 = var15 & 0x3;
			int var18 = this.LOC_SHAPE_TO_LAYER[var16];
			int var19 = arg1.g2();
			if (var13 >= 0 && var14 >= 0 && var13 < 103 && var14 < 103) {
				int var20 = this.groundh[this.minusedlevel][var13][var14];
				int var21 = this.groundh[this.minusedlevel][var13 + 1][var14];
				int var22 = this.groundh[this.minusedlevel][var13 + 1][var14 + 1];
				int var23 = this.groundh[this.minusedlevel][var13][var14 + 1];
				if (var18 == 0) {
					Wall var24 = this.world.getWall(this.minusedlevel, var13, var14);
					if (var24 != null) {
						int var25 = var24.typecode >> 14 & 0x7FFF;
						if (var16 == 2) {
							var24.model1 = new ClientLocAnim(2, var17 + 4, var20, var25, var22, var23, false, var19, var21);
							var24.model2 = new ClientLocAnim(2, var17 + 1 & 0x3, var20, var25, var22, var23, false, var19, var21);
						} else {
							var24.model1 = new ClientLocAnim(var16, var17, var20, var25, var22, var23, false, var19, var21);
						}
					}
				}
				if (var18 == 1) {
					Decor var26 = this.world.getDecor(var13, var14, this.minusedlevel);
					if (var26 != null) {
						var26.model = new ClientLocAnim(4, 0, var20, var26.typecode >> 14 & 0x7FFF, var22, var23, false, var19, var21);
					}
				}
				if (var18 == 2) {
					Sprite var27 = this.world.getScene(var13, var14, this.minusedlevel);
					if (var16 == 11) {
						var16 = 10;
					}
					if (var27 != null) {
						var27.model = new ClientLocAnim(var16, var17, var20, var27.typecode >> 14 & 0x7FFF, var22, var23, false, var19, var21);
					}
				}
				if (var18 == 3) {
					GroundDecor var28 = this.world.getGd(this.minusedlevel, var13, var14);
					if (var28 != null) {
						var28.model = new ClientLocAnim(22, var17, var20, var28.typecode >> 14 & 0x7FFF, var22, var23, false, var19, var21);
					}
				}
			}
		} else if (arg0 == 120) {
			// OBJ_ADD
			int var29 = arg1.g1();
			int var30 = this.baseX + (var29 >> 4 & 0x7);
			int var31 = this.baseZ + (var29 & 0x7);
			int var32 = arg1.g2();
			int var33 = arg1.g2();
			if (var30 >= 0 && var31 >= 0 && var30 < 104 && var31 < 104) {
				ClientObj var34 = new ClientObj();
				var34.id = var32;
				var34.count = var33;
				if (this.objStacks[this.minusedlevel][var30][var31] == null) {
					this.objStacks[this.minusedlevel][var30][var31] = new LinkList();
				}
				this.objStacks[this.minusedlevel][var30][var31].push(var34);
				this.showObject(var30, var31);
			}
		} else if (arg0 == 115) {
			// OBJ_DEL
			int var35 = arg1.g1();
			int var36 = this.baseX + (var35 >> 4 & 0x7);
			int var37 = this.baseZ + (var35 & 0x7);
			int var38 = arg1.g2();
			if (var36 >= 0 && var37 >= 0 && var36 < 104 && var37 < 104) {
				LinkList var39 = this.objStacks[this.minusedlevel][var36][var37];
				if (var39 != null) {
					for (ClientObj var40 = (ClientObj) var39.head(); var40 != null; var40 = (ClientObj) var39.next()) {
						if (var40.id == (var38 & 0x7FFF)) {
							var40.unlink();
							break;
						}
					}
					if (var39.head() == null) {
						this.objStacks[this.minusedlevel][var36][var37] = null;
					}
					this.showObject(var36, var37);
				}
			}
		} else if (arg0 == 37) {
			// MAP_PROJANIM
			int var41 = arg1.g1();
			int var42 = this.baseX + (var41 >> 4 & 0x7);
			int var43 = this.baseZ + (var41 & 0x7);
			int var44 = var42 + arg1.g1b();
			int var45 = var43 + arg1.g1b();
			int var46 = arg1.g2b();
			int var47 = arg1.g2();
			int var48 = arg1.g1() * 4;
			int var49 = arg1.g1() * 4;
			int var50 = arg1.g2();
			int var51 = arg1.g2();
			int var52 = arg1.g1();
			int var53 = arg1.g1();
			if (var42 >= 0 && var43 >= 0 && var42 < 104 && var43 < 104 && var44 >= 0 && var45 >= 0 && var44 < 104 && var45 < 104) {
				int var54 = var42 * 128 + 64;
				int var55 = var43 * 128 + 64;
				int var56 = var44 * 128 + 64;
				int var57 = var45 * 128 + 64;
				ClientProj var58 = new ClientProj(this.minusedlevel, var47, var50 + loopCycle, var51 + loopCycle, this.getAvH(var55, this.minusedlevel, var54) - var48, var49, var54, var52, var46, var55, var53);
				var58.setTarget(var57, this.getAvH(var57, this.minusedlevel, var56) - var49, var56, var50 + loopCycle);
				this.projectiles.push(var58);
			}
		} else if (arg0 == 114) {
			// MAP_ANIM
			int var59 = arg1.g1();
			int var60 = this.baseX + (var59 >> 4 & 0x7);
			int var61 = this.baseZ + (var59 & 0x7);
			int var62 = arg1.g2();
			int var63 = arg1.g1();
			int var64 = arg1.g2();
			if (var60 >= 0 && var61 >= 0 && var60 < 104 && var61 < 104) {
				int var65 = var60 * 128 + 64;
				int var66 = var61 * 128 + 64;
				MapSpotAnim var67 = new MapSpotAnim(this.getAvH(var66, this.minusedlevel, var65) - var63, loopCycle, var66, this.minusedlevel, var65, var62, var64);
				this.spotanims.push(var67);
			}
		} else if (arg0 == 8) {
			// OBJ_REVEAL
			int var68 = arg1.g1();
			int var69 = this.baseX + (var68 >> 4 & 0x7);
			int var70 = this.baseZ + (var68 & 0x7);
			int var71 = arg1.g2();
			int var72 = arg1.g2();
			int var73 = arg1.g2();
			if (var69 >= 0 && var70 >= 0 && var69 < 104 && var70 < 104 && var73 != this.localPid) {
				ClientObj var74 = new ClientObj();
				var74.id = var71;
				var74.count = var72;
				if (this.objStacks[this.minusedlevel][var69][var70] == null) {
					this.objStacks[this.minusedlevel][var69][var70] = new LinkList();
				}
				this.objStacks[this.minusedlevel][var69][var70].push(var74);
				this.showObject(var69, var70);
			}
		} else if (arg0 == 218) {
			// LOC_MERGE
			int var75 = arg1.g1();
			int var76 = this.baseX + (var75 >> 4 & 0x7);
			int var77 = this.baseZ + (var75 & 0x7);
			int var78 = arg1.g1();
			int var79 = var78 >> 2;
			int var80 = var78 & 0x3;
			int var81 = this.LOC_SHAPE_TO_LAYER[var79];
			int var82 = arg1.g2();
			int var83 = arg1.g2();
			int var84 = arg1.g2();
			int var85 = arg1.g2();
			byte var86 = arg1.g1b();
			byte var87 = arg1.g1b();
			byte var88 = arg1.g1b();
			byte var89 = arg1.g1b();
			ClientPlayer var90;
			if (var85 == this.localPid) {
				var90 = localPlayer;
			} else {
				var90 = this.players[var85];
			}
			if (var90 != null) {
				LocType var91 = LocType.get(var82);
				int var92 = this.groundh[this.minusedlevel][var76][var77];
				int var93 = this.groundh[this.minusedlevel][var76 + 1][var77];
				int var94 = this.groundh[this.minusedlevel][var76 + 1][var77 + 1];
				int var95 = this.groundh[this.minusedlevel][var76][var77 + 1];
				Model var96 = var91.getModel(var79, var80, var92, var93, var94, var95, -1);
				if (var96 != null) {
					this.locChangeCreate(this.minusedlevel, var76, var83 + 1, -1, 0, var81, var84 + 1, var77, 0);
					var90.locStartCycle = var83 + loopCycle;
					var90.locStopCycle = var84 + loopCycle;
					var90.locModel = var96;
					int var97 = var91.width;
					int var98 = var91.length;
					if (var80 == 1 || var80 == 3) {
						var97 = var91.length;
						var98 = var91.width;
					}
					var90.locOffsetX = var76 * 128 + var97 * 64;
					var90.locOffsetZ = var77 * 128 + var98 * 64;
					var90.locOffsetY = this.getAvH(var90.locOffsetZ, this.minusedlevel, var90.locOffsetX);
					if (var86 > var88) {
						byte var99 = var86;
						var86 = var88;
						var88 = var99;
					}
					if (var87 > var89) {
						byte var100 = var87;
						var87 = var89;
						var89 = var100;
					}
					var90.minTileX = var76 + var86;
					var90.maxTileX = var76 + var88;
					var90.minTileZ = var77 + var87;
					var90.maxTileZ = var77 + var89;
				}
			}
		} else if (arg0 == 98) {
			// OBJ_COUNT
			int var101 = arg1.g1();
			int var102 = this.baseX + (var101 >> 4 & 0x7);
			int var103 = this.baseZ + (var101 & 0x7);
			int var104 = arg1.g2();
			int var105 = arg1.g2();
			int var106 = arg1.g2();
			if (var102 >= 0 && var103 >= 0 && var102 < 104 && var103 < 104) {
				LinkList var107 = this.objStacks[this.minusedlevel][var102][var103];
				if (var107 != null) {
					for (ClientObj var108 = (ClientObj) var107.head(); var108 != null; var108 = (ClientObj) var107.next()) {
						if (var108.id == (var104 & 0x7FFF) && var108.count == var105) {
							var108.count = var106;
							break;
						}
					}
					this.showObject(var102, var103);
				}
			}
		}
	}

	@ObfuscatedName("client.a(IIIBIIIIII)V")
	public void locChangeCreate(int arg0, int arg1, int arg2, int arg4, int arg5, int arg6, int arg7, int arg8, int arg9) {
		LocChange var11 = null;
		for (LocChange var12 = (LocChange) this.locChanges.head(); var12 != null; var12 = (LocChange) this.locChanges.next()) {
			if (var12.level == arg0 && var12.x == arg1 && var12.z == arg8 && var12.layer == arg6) {
				var11 = var12;
				break;
			}
		}
		if (var11 == null) {
			var11 = new LocChange();
			var11.level = arg0;
			var11.layer = arg6;
			var11.x = arg1;
			var11.z = arg8;
			this.locChangeSetOld(var11);
			this.locChanges.push(var11);
		}
		var11.newType = arg4;
		var11.newShape = arg5;
		var11.newAngle = arg9;
		var11.startTime = arg2;
		var11.endTime = arg7;
	}

	@ObfuscatedName("client.a(ILob;)V")
	public void locChangeSetOld(LocChange arg1) {
		int var4 = 0;
		int var5 = -1;
		int var6 = 0;
		int var7 = 0;
		if (arg1.layer == 0) {
			var4 = this.world.wallType(arg1.level, arg1.x, arg1.z);
		}
		if (arg1.layer == 1) {
			var4 = this.world.decorType(arg1.x, arg1.level, arg1.z);
		}
		if (arg1.layer == 2) {
			var4 = this.world.sceneType(arg1.level, arg1.x, arg1.z);
		}
		if (arg1.layer == 3) {
			var4 = this.world.gdType(arg1.level, arg1.x, arg1.z);
		}
		if (var4 != 0) {
			int var8 = this.world.typecode2(arg1.level, arg1.x, arg1.z, var4);
			var5 = var4 >> 14 & 0x7FFF;
			var6 = var8 & 0x1F;
			var7 = var8 >> 6;
		}
		arg1.oldType = var5;
		arg1.oldShape = var6;
		arg1.oldAngle = var7;
	}

	@ObfuscatedName("client.a(IIIIIIZI)V")
	public void locChangeUnchecked(int arg0, int arg1, int arg2, int arg3, int arg4, int arg5, int arg7) {
		if (arg7 < 1 || arg3 < 1 || arg7 > 102 || arg3 > 102) {
			return;
		}
		if (lowMem && arg0 != this.minusedlevel) {
			return;
		}
		int var9 = 0;
		boolean var10 = true;
		boolean var11 = false;
		boolean var12 = false;
		if (arg4 == 0) {
			var9 = this.world.wallType(arg0, arg7, arg3);
		}
		if (arg4 == 1) {
			var9 = this.world.decorType(arg7, arg0, arg3);
		}
		if (arg4 == 2) {
			var9 = this.world.sceneType(arg0, arg7, arg3);
		}
		if (arg4 == 3) {
			var9 = this.world.gdType(arg0, arg7, arg3);
		}
		if (var9 != 0) {
			int var13 = this.world.typecode2(arg0, arg7, arg3, var9);
			int var14 = var9 >> 14 & 0x7FFF;
			int var15 = var13 & 0x1F;
			int var16 = var13 >> 6;
			if (arg4 == 0) {
				this.world.delWall(arg7, arg0, arg3);
				LocType var17 = LocType.get(var14);
				if (var17.blockwalk) {
					this.levelCollisionMap[arg0].delWall(var15, arg7, var16, arg3, var17.blockrange);
				}
			}
			if (arg4 == 1) {
				this.world.delDecor(arg7, arg3, arg0);
			}
			if (arg4 == 2) {
				this.world.delLoc(arg3, arg7, arg0);
				LocType var18 = LocType.get(var14);
				if (arg7 + var18.width > 103 || arg3 + var18.width > 103 || arg7 + var18.length > 103 || arg3 + var18.length > 103) {
					return;
				}
				if (var18.blockwalk) {
					this.levelCollisionMap[arg0].delLoc(var18.blockrange, var18.width, arg3, var18.length, var16, arg7);
				}
			}
			if (arg4 == 3) {
				this.world.delGroundDecor(arg0, arg3, arg7);
				LocType var19 = LocType.get(var14);
				if (var19.blockwalk && var19.active) {
					this.levelCollisionMap[arg0].unblockGround(arg3, arg7);
				}
			}
		}
		if (arg2 >= 0) {
			int var20 = arg0;
			if (arg0 < 3 && (this.mapl[1][arg7][arg3] & 0x2) == 2) {
				var20 = arg0 + 1;
			}
			ClientBuild.changeLocUnchecked(arg1, arg7, this.levelCollisionMap[arg0], arg3, arg5, arg2, this.world, this.groundh, var20, arg0);
		}
	}

	@ObfuscatedName("client.g(II)V")
	public void showObject(int arg0, int arg1) {
		LinkList var3 = this.objStacks[this.minusedlevel][arg0][arg1];
		if (var3 == null) {
			this.world.delObj(this.minusedlevel, arg0, arg1);
			return;
		}
		int var4 = -99999999;
		ClientObj var5 = null;
		for (ClientObj var6 = (ClientObj) var3.head(); var6 != null; var6 = (ClientObj) var3.next()) {
			ObjType var7 = ObjType.get(var6.id);
			int var8 = var7.cost;
			if (var7.stackable) {
				var8 *= var6.count + 1;
			}
			if (var8 > var4) {
				var4 = var8;
				var5 = var6;
			}
		}
		var3.addHead(var5);
		ClientObj var9 = null;
		ClientObj var10 = null;
		for (ClientObj var11 = (ClientObj) var3.head(); var11 != null; var11 = (ClientObj) var3.next()) {
			if (var11.id != var5.id && var9 == null) {
				var9 = var11;
			}
			if (var11.id != var5.id && var11.id != var9.id && var10 == null) {
				var10 = var11;
			}
		}
		int var12 = arg0 + (arg1 << 7) + 1610612736;
		this.world.setObj(var5, var12, this.getAvH(arg1 * 128 + 64, this.minusedlevel, arg0 * 128 + 64), var10, this.minusedlevel, arg0, arg1, var9);
	}

	@ObfuscatedName("client.c(Lmb;II)V")
	public void getPlayerPos(Packet arg0, int arg2) {
		this.entityRemovalCount = 0;
		this.entityUpdateCount = 0;
		this.getPlayerLocal(arg2, arg0);
		this.getPlayerOldVis(arg0, arg2);
		this.getPlayerNewVis(arg2, arg0);
		this.getPlayerExtended(arg0, arg2);
		for (int var4 = 0; var4 < this.entityRemovalCount; var4++) {
			int var5 = this.entityRemovalIds[var4];
			if (this.players[var5].cycle != loopCycle) {
				this.players[var5] = null;
			}
		}
		if (arg0.pos != arg2) {
			signlink.reporterror("Error packet size mismatch in getplayer pos:" + arg0.pos + " psize:" + arg2);
			throw new RuntimeException("eek");
		}
		for (int var6 = 0; var6 < this.playerCount; var6++) {
			if (this.players[this.playerIds[var6]] == null) {
				signlink.reporterror(this.loginUser + " null entry in pl list - pos:" + var6 + " size:" + this.playerCount);
				throw new RuntimeException("eek");
			}
		}
	}

	@ObfuscatedName("client.a(ZILmb;)V")
	public void getPlayerLocal(int arg1, Packet arg2) {
		arg2.bits();
		int var4 = arg2.gBit(1);
		if (var4 == 0) {
			return;
		}
		int var5 = arg2.gBit(2);
		if (var5 == 0) {
			this.entityUpdateIds[this.entityUpdateCount++] = this.LOCAL_PLAYER_INDEX;
		} else if (var5 == 1) {
			int var6 = arg2.gBit(3);
			localPlayer.moveCode(false, var6);
			int var7 = arg2.gBit(1);
			if (var7 == 1) {
				this.entityUpdateIds[this.entityUpdateCount++] = this.LOCAL_PLAYER_INDEX;
			}
		} else if (var5 == 2) {
			int var8 = arg2.gBit(3);
			localPlayer.moveCode(true, var8);
			int var9 = arg2.gBit(3);
			localPlayer.moveCode(true, var9);
			int var10 = arg2.gBit(1);
			if (var10 == 1) {
				this.entityUpdateIds[this.entityUpdateCount++] = this.LOCAL_PLAYER_INDEX;
			}
		} else if (var5 == 3) {
			this.minusedlevel = arg2.gBit(2);
			int var11 = arg2.gBit(7);
			int var12 = arg2.gBit(7);
			int var13 = arg2.gBit(1);
			localPlayer.teleport(var12, var11, var13 == 1);
			int var14 = arg2.gBit(1);
			if (var14 == 1) {
				this.entityUpdateIds[this.entityUpdateCount++] = this.LOCAL_PLAYER_INDEX;
			}
		}
	}

	@ObfuscatedName("client.b(Lmb;II)V")
	public void getPlayerOldVis(Packet arg0, int arg1) {
		int var4 = arg0.gBit(8);
		if (var4 < this.playerCount) {
			for (int var6 = var4; var6 < this.playerCount; var6++) {
				this.entityRemovalIds[this.entityRemovalCount++] = this.playerIds[var6];
			}
		}
		if (var4 > this.playerCount) {
			signlink.reporterror(this.loginUser + " Too many players");
			throw new RuntimeException("eek");
		}
		this.playerCount = 0;
		for (int var7 = 0; var7 < var4; var7++) {
			int var8 = this.playerIds[var7];
			ClientPlayer var9 = this.players[var8];
			int var10 = arg0.gBit(1);
			if (var10 == 0) {
				this.playerIds[this.playerCount++] = var8;
				var9.cycle = loopCycle;
			} else {
				int var11 = arg0.gBit(2);
				if (var11 == 0) {
					this.playerIds[this.playerCount++] = var8;
					var9.cycle = loopCycle;
					this.entityUpdateIds[this.entityUpdateCount++] = var8;
				} else if (var11 == 1) {
					this.playerIds[this.playerCount++] = var8;
					var9.cycle = loopCycle;
					int var12 = arg0.gBit(3);
					var9.moveCode(false, var12);
					int var13 = arg0.gBit(1);
					if (var13 == 1) {
						this.entityUpdateIds[this.entityUpdateCount++] = var8;
					}
				} else if (var11 == 2) {
					this.playerIds[this.playerCount++] = var8;
					var9.cycle = loopCycle;
					int var14 = arg0.gBit(3);
					var9.moveCode(true, var14);
					int var15 = arg0.gBit(3);
					var9.moveCode(true, var15);
					int var16 = arg0.gBit(1);
					if (var16 == 1) {
						this.entityUpdateIds[this.entityUpdateCount++] = var8;
					}
				} else if (var11 == 3) {
					this.entityRemovalIds[this.entityRemovalCount++] = var8;
				}
			}
		}
	}

	@ObfuscatedName("client.a(IILmb;)V")
	public void getPlayerNewVis(int arg0, Packet arg2) {
		while (arg2.bitPos + 10 < arg0 * 8) {
			int var4 = arg2.gBit(11);
			if (var4 == 2047) {
				break;
			}
			if (this.players[var4] == null) {
				this.players[var4] = new ClientPlayer();
				if (this.playerAppearanceBuffer[var4] != null) {
					this.players[var4].setAppearance(this.playerAppearanceBuffer[var4]);
				}
			}
			this.playerIds[this.playerCount++] = var4;
			ClientPlayer var5 = this.players[var4];
			var5.cycle = loopCycle;
			int var6 = arg2.gBit(5);
			if (var6 > 15) {
				var6 -= 32;
			}
			int var7 = arg2.gBit(5);
			if (var7 > 15) {
				var7 -= 32;
			}
			int var8 = arg2.gBit(1);
			var5.teleport(localPlayer.routeTileZ[0] + var7, localPlayer.routeTileX[0] + var6, var8 == 1);
			int var9 = arg2.gBit(1);
			if (var9 == 1) {
				this.entityUpdateIds[this.entityUpdateCount++] = var4;
			}
		}
		arg2.bytes();
	}

	@ObfuscatedName("client.a(ZLmb;I)V")
	public void getPlayerExtended(Packet arg1, int arg2) {
		for (int var4 = 0; var4 < this.entityUpdateCount; var4++) {
			int var5 = this.entityUpdateIds[var4];
			ClientPlayer var6 = this.players[var5];
			int var7 = arg1.g1();
			if ((var7 & 0x80) == 128) {
				var7 += arg1.g1() << 8;
			}
			this.getPlayerExtendedInfo(var7, arg1, var5, var6);
		}
	}

	@ObfuscatedName("client.a(ILmb;IILbb;)V")
	public void getPlayerExtendedInfo(int arg0, Packet arg1, int arg2, ClientPlayer arg4) {
		if ((arg0 & 0x1) == 1) {
			int var6 = arg1.g1();
			byte[] var7 = new byte[var6];
			Packet var8 = new Packet(var7);
			arg1.gdata(0, var7, var6);
			this.playerAppearanceBuffer[arg2] = var8;
			arg4.setAppearance(var8);
		}
		if ((arg0 & 0x2) == 2) {
			int var9 = arg1.g2();
			if (var9 == 65535) {
				var9 = -1;
			}
			if (var9 == arg4.primarySeqId) {
				arg4.primarySeqLoop = 0;
			}
			int var10 = arg1.g1();
			if (var9 == arg4.primarySeqId && var9 != -1) {
				int var11 = SeqType.list[var9].duplicatebehavior;
				if (var11 == 1) {
					arg4.primarySeqFrame = 0;
					arg4.primarySeqCycle = 0;
					arg4.primarySeqDelay = var10;
					arg4.primarySeqLoop = 0;
				}
				if (var11 == 2) {
					arg4.primarySeqLoop = 0;
				}
			} else if (var9 == -1 || arg4.primarySeqId == -1 || SeqType.list[var9].priority >= SeqType.list[arg4.primarySeqId].priority) {
				arg4.primarySeqId = var9;
				arg4.primarySeqFrame = 0;
				arg4.primarySeqCycle = 0;
				arg4.primarySeqDelay = var10;
				arg4.primarySeqLoop = 0;
				arg4.preanimRouteLength = arg4.routeLength;
			}
		}
		if ((arg0 & 0x4) == 4) {
			arg4.targetId = arg1.g2();
			if (arg4.targetId == 65535) {
				arg4.targetId = -1;
			}
		}
		if ((arg0 & 0x8) == 8) {
			arg4.chatMessage = arg1.gstr();
			arg4.chatColour = 0;
			arg4.chatEffect = 0;
			arg4.chatTimer = 150;
			this.addChat(arg4.name, 2, arg4.chatMessage);
		}
		if ((arg0 & 0x10) == 16) {
			int var12 = arg1.g1();
			int var13 = arg1.g1();
			arg4.addHitmark(var13, var12);
			arg4.combatCycle = loopCycle + 300;
			arg4.health = arg1.g1();
			arg4.totalHealth = arg1.g1();
		}
		if ((arg0 & 0x20) == 32) {
			arg4.targetTileX = arg1.g2();
			arg4.targetTileZ = arg1.g2();
		}
		if ((arg0 & 0x40) == 64) {
			int var14 = arg1.g2();
			int var15 = arg1.g1();
			int var16 = arg1.g1();
			int var17 = arg1.pos;
			if (arg4.name != null && arg4.ready) {
				long var18 = JString.toBase37(arg4.name);
				boolean var20 = false;
				if (var15 <= 1) {
					for (int var21 = 0; var21 < this.ignoreCount; var21++) {
						if (this.ignoreName37[var21] == var18) {
							var20 = true;
							break;
						}
					}
				}
				if (!var20 && this.worldLocationState == 0) {
					try {
						String var22 = WordPack.unpack(arg1, var16);
						String var23 = WordFilter.filter(var22);
						arg4.chatMessage = var23;
						arg4.chatColour = var14 >> 8;
						arg4.chatEffect = var14 & 0xFF;
						arg4.chatTimer = 150;
						if (var15 == 2 || var15 == 3) {
							this.addChat("@cr2@" + arg4.name, 1, var23);
						} else if (var15 == 1) {
							this.addChat("@cr1@" + arg4.name, 1, var23);
						} else {
							this.addChat(arg4.name, 2, var23);
						}
					} catch (Exception var28) {
						signlink.reporterror("cde2");
					}
				}
			}
			arg1.pos = var17 + var16;
		}
		if ((arg0 & 0x100) == 256) {
			arg4.spotanimId = arg1.g2();
			int var25 = arg1.g4();
			arg4.spotanimHeight = var25 >> 16;
			arg4.spotanimLastCycle = loopCycle + (var25 & 0xFFFF);
			arg4.spotanimFrame = 0;
			arg4.spotanimCycle = 0;
			if (arg4.spotanimLastCycle > loopCycle) {
				arg4.spotanimFrame = -1;
			}
			if (arg4.spotanimId == 65535) {
				arg4.spotanimId = -1;
			}
		}
		if ((arg0 & 0x200) == 512) {
			arg4.exactMoveStartSceneTileX = arg1.g1();
			arg4.exactMoveStartSceneTileZ = arg1.g1();
			arg4.exactMoveEndSceneTileX = arg1.g1();
			arg4.exactMoveEndSceneTileZ = arg1.g1();
			arg4.exactMoveEndCycle = arg1.g2() + loopCycle;
			arg4.exactMoveStartCycle = arg1.g2() + loopCycle;
			arg4.exactMoveFaceDirection = arg1.g1();
			arg4.abortRoute();
		}
		if ((arg0 & 0x400) != 1024) {
			return;
		}
		int var26 = arg1.g1();
		int var27 = arg1.g1();
		arg4.addHitmark(var27, var26);
		arg4.combatCycle = loopCycle + 300;
		arg4.health = arg1.g1();
		arg4.totalHealth = arg1.g1();
	}

	@ObfuscatedName("client.b(ILmb;I)V")
	public void getNpcPos(Packet arg1, int arg2) {
		this.entityRemovalCount = 0;
		this.entityUpdateCount = 0;
		this.getNpcPosOldVis(arg1, arg2);
		this.getNpcPosNewVis(arg1, arg2);
		this.getNpcPosExtended(arg2, arg1);
		for (int var4 = 0; var4 < this.entityRemovalCount; var4++) {
			int var5 = this.entityRemovalIds[var4];
			if (this.npcs[var5].cycle != loopCycle) {
				this.npcs[var5].type = null;
				this.npcs[var5] = null;
			}
		}
		if (arg1.pos != arg2) {
			signlink.reporterror(this.loginUser + " size mismatch in getnpcpos - pos:" + arg1.pos + " psize:" + arg2);
			throw new RuntimeException("eek");
		}
		for (int var6 = 0; var6 < this.npcCount; var6++) {
			if (this.npcs[this.npcIds[var6]] == null) {
				signlink.reporterror(this.loginUser + " null entry in npc list - pos:" + var6 + " size:" + this.npcCount);
				throw new RuntimeException("eek");
			}
		}
	}

	@ObfuscatedName("client.a(Lmb;II)V")
	public void getNpcPosOldVis(Packet arg0, int arg1) {
		arg0.bits();
		int var4 = arg0.gBit(8);
		if (var4 < this.npcCount) {
			for (int var5 = var4; var5 < this.npcCount; var5++) {
				this.entityRemovalIds[this.entityRemovalCount++] = this.npcIds[var5];
			}
		}
		if (var4 > this.npcCount) {
			signlink.reporterror(this.loginUser + " Too many npcs");
			throw new RuntimeException("eek");
		}
		this.npcCount = 0;
		for (int var6 = 0; var6 < var4; var6++) {
			int var7 = this.npcIds[var6];
			ClientNpc var8 = this.npcs[var7];
			int var9 = arg0.gBit(1);
			if (var9 == 0) {
				this.npcIds[this.npcCount++] = var7;
				var8.cycle = loopCycle;
			} else {
				int var10 = arg0.gBit(2);
				if (var10 == 0) {
					this.npcIds[this.npcCount++] = var7;
					var8.cycle = loopCycle;
					this.entityUpdateIds[this.entityUpdateCount++] = var7;
				} else if (var10 == 1) {
					this.npcIds[this.npcCount++] = var7;
					var8.cycle = loopCycle;
					int var11 = arg0.gBit(3);
					var8.moveCode(false, var11);
					int var12 = arg0.gBit(1);
					if (var12 == 1) {
						this.entityUpdateIds[this.entityUpdateCount++] = var7;
					}
				} else if (var10 == 2) {
					this.npcIds[this.npcCount++] = var7;
					var8.cycle = loopCycle;
					int var13 = arg0.gBit(3);
					var8.moveCode(true, var13);
					int var14 = arg0.gBit(3);
					var8.moveCode(true, var14);
					int var15 = arg0.gBit(1);
					if (var15 == 1) {
						this.entityUpdateIds[this.entityUpdateCount++] = var7;
					}
				} else if (var10 == 3) {
					this.entityRemovalIds[this.entityRemovalCount++] = var7;
				}
			}
		}
	}

	@ObfuscatedName("client.a(Lmb;ZI)V")
	public void getNpcPosNewVis(Packet arg0, int arg2) {
		while (arg0.bitPos + 21 < arg2 * 8) {
			int var4 = arg0.gBit(14);
			if (var4 == 16383) {
				break;
			}
			if (this.npcs[var4] == null) {
				this.npcs[var4] = new ClientNpc();
			}
			ClientNpc var5 = this.npcs[var4];
			this.npcIds[this.npcCount++] = var4;
			var5.cycle = loopCycle;
			var5.type = NpcType.get(arg0.gBit(11));
			var5.size = var5.type.size;
			var5.turnspeed = var5.type.turnspeed;
			var5.walkanim = var5.type.walkanim;
			var5.walkanim_b = var5.type.walkanim_b;
			var5.walkanim_l = var5.type.walkanim_l;
			var5.walkanim_r = var5.type.walkanim_r;
			var5.readyanim = var5.type.runanim;
			int var6 = arg0.gBit(5);
			if (var6 > 15) {
				var6 -= 32;
			}
			int var7 = arg0.gBit(5);
			if (var7 > 15) {
				var7 -= 32;
			}
			var5.teleport(localPlayer.routeTileZ[0] + var7, localPlayer.routeTileX[0] + var6, false);
			int var8 = arg0.gBit(1);
			if (var8 == 1) {
				this.entityUpdateIds[this.entityUpdateCount++] = var4;
			}
		}
		arg0.bytes();
	}

	@ObfuscatedName("client.a(IBLmb;)V")
	public void getNpcPosExtended(int arg0, Packet arg2) {
		for (int var4 = 0; var4 < this.entityUpdateCount; var4++) {
			int var5 = this.entityUpdateIds[var4];
			ClientNpc var6 = this.npcs[var5];
			int var7 = arg2.g1();
			if ((var7 & 0x1) == 1) {
				int var8 = arg2.g1();
				int var9 = arg2.g1();
				var6.addHitmark(var9, var8);
				var6.combatCycle = loopCycle + 300;
				var6.health = arg2.g1();
				var6.totalHealth = arg2.g1();
			}
			if ((var7 & 0x2) == 2) {
				int var10 = arg2.g2();
				if (var10 == 65535) {
					var10 = -1;
				}
				if (var10 == var6.primarySeqId) {
					var6.primarySeqLoop = 0;
				}
				int var11 = arg2.g1();
				if (var10 == var6.primarySeqId && var10 != -1) {
					int var12 = SeqType.list[var10].duplicatebehavior;
					if (var12 == 1) {
						var6.primarySeqFrame = 0;
						var6.primarySeqCycle = 0;
						var6.primarySeqDelay = var11;
						var6.primarySeqLoop = 0;
					}
					if (var12 == 2) {
						var6.primarySeqLoop = 0;
					}
				} else if (var10 == -1 || var6.primarySeqId == -1 || SeqType.list[var10].priority >= SeqType.list[var6.primarySeqId].priority) {
					var6.primarySeqId = var10;
					var6.primarySeqFrame = 0;
					var6.primarySeqCycle = 0;
					var6.primarySeqDelay = var11;
					var6.primarySeqLoop = 0;
					var6.preanimRouteLength = var6.routeLength;
				}
			}
			if ((var7 & 0x4) == 4) {
				var6.targetId = arg2.g2();
				if (var6.targetId == 65535) {
					var6.targetId = -1;
				}
			}
			if ((var7 & 0x8) == 8) {
				var6.chatMessage = arg2.gstr();
				var6.chatTimer = 100;
			}
			if ((var7 & 0x10) == 16) {
				int var13 = arg2.g1();
				int var14 = arg2.g1();
				var6.addHitmark(var14, var13);
				var6.combatCycle = loopCycle + 300;
				var6.health = arg2.g1();
				var6.totalHealth = arg2.g1();
			}
			if ((var7 & 0x20) == 32) {
				var6.type = NpcType.get(arg2.g2());
				var6.size = var6.type.size;
				var6.turnspeed = var6.type.turnspeed;
				var6.walkanim = var6.type.walkanim;
				var6.walkanim_b = var6.type.walkanim_b;
				var6.walkanim_l = var6.type.walkanim_l;
				var6.walkanim_r = var6.type.walkanim_r;
				var6.readyanim = var6.type.runanim;
			}
			if ((var7 & 0x40) == 64) {
				var6.spotanimId = arg2.g2();
				int var15 = arg2.g4();
				var6.spotanimHeight = var15 >> 16;
				var6.spotanimLastCycle = loopCycle + (var15 & 0xFFFF);
				var6.spotanimFrame = 0;
				var6.spotanimCycle = 0;
				if (var6.spotanimLastCycle > loopCycle) {
					var6.spotanimFrame = -1;
				}
				if (var6.spotanimId == 65535) {
					var6.spotanimId = -1;
				}
			}
			if ((var7 & 0x80) == 128) {
				var6.targetTileX = arg2.g2();
				var6.targetTileZ = arg2.g2();
			}
		}
	}

	@ObfuscatedName("client.u(I)V")
	public void showContextMenu() {
		int var2 = this.fontBold12.stringWid("Choose Option");
		for (int var3 = 0; var3 < this.menuSize; var3++) {
			int var4 = this.fontBold12.stringWid(this.menuOption[var3]);
			if (var4 > var2) {
				var2 = var4;
			}
		}
		var2 += 8;
		int var5 = this.menuSize * 15 + 21;
		if (super.mouseClickX > 4 && super.mouseClickY > 4 && super.mouseClickX < 516 && super.mouseClickY < 338) {
			int var6 = super.mouseClickX - 4 - var2 / 2;
			if (var6 + var2 > 512) {
				var6 = 512 - var2;
			}
			if (var6 < 0) {
				var6 = 0;
			}
			int var7 = super.mouseClickY - 4;
			if (var7 + var5 > 334) {
				var7 = 334 - var5;
			}
			if (var7 < 0) {
				var7 = 0;
			}
			this.menuVisible = true;
			this.menuArea = 0;
			this.menuX = var6;
			this.menuY = var7;
			this.menuWidth = var2;
			this.menuHeight = this.menuSize * 15 + 22;
		}
		if (super.mouseClickX > 553 && super.mouseClickY > 205 && super.mouseClickX < 743 && super.mouseClickY < 466) {
			int var8 = super.mouseClickX - 553 - var2 / 2;
			if (var8 < 0) {
				var8 = 0;
			} else if (var8 + var2 > 190) {
				var8 = 190 - var2;
			}
			int var9 = super.mouseClickY - 205;
			if (var9 < 0) {
				var9 = 0;
			} else if (var9 + var5 > 261) {
				var9 = 261 - var5;
			}
			this.menuVisible = true;
			this.menuArea = 1;
			this.menuX = var8;
			this.menuY = var9;
			this.menuWidth = var2;
			this.menuHeight = this.menuSize * 15 + 22;
		}
		if (super.mouseClickX <= 17 || super.mouseClickY <= 357 || super.mouseClickX >= 496 || super.mouseClickY >= 453) {
			return;
		}
		int var10 = super.mouseClickX - 17 - var2 / 2;
		if (var10 < 0) {
			var10 = 0;
		} else if (var10 + var2 > 479) {
			var10 = 479 - var2;
		}
		int var11 = super.mouseClickY - 357;
		if (var11 < 0) {
			var11 = 0;
		} else if (var11 + var5 > 96) {
			var11 = 96 - var5;
		}
		this.menuVisible = true;
		this.menuArea = 2;
		this.menuX = var10;
		this.menuY = var11;
		this.menuWidth = var2;
		this.menuHeight = this.menuSize * 15 + 22;
	}

	@ObfuscatedName("client.f(II)Z")
	public boolean isAddFriendOption(int arg0) {
		if (arg0 < 0) {
			return false;
		}
		int var3 = this.menuAction[arg0];
		if (var3 >= 2000) {
			var3 -= 2000;
		}
		return var3 == 605;
	}

	@ObfuscatedName("client.a(BI)V")
	public void useMenuOption(int arg1) {
		if (arg1 < 0) {
			return;
		}
		if (this.chatbackInputOpen) {
			this.chatbackInputOpen = false;
			this.redrawChatback = true;
		}
		int var3 = this.menuParamB[arg1];
		int var4 = this.menuParamC[arg1];
		int var5 = this.menuAction[arg1];
		int var6 = this.menuParamA[arg1];
		if (var5 >= 2000) {
			var5 -= 2000;
		}
		if (var5 == 737) {
			this.closeModal();
		}
		if (var5 == 563) {
			// OPHELDT
			this.out.pIsaac(102);
			this.out.p2(var6);
			this.out.p2(var3);
			this.out.p2(var4);
			this.out.p2(this.activeSpellId);
			this.selectedCycle = 0;
			this.selectedInterface = var4;
			this.selectedItem = var3;
			this.selectedArea = 2;
			if (IfType.list[var4].layerId == this.mainLayerId) {
				this.selectedArea = 1;
			}
			if (IfType.list[var4].layerId == this.chatLayerId) {
				this.selectedArea = 3;
			}
		}
		if (var5 == 694 || var5 == 962 || var5 == 795 || var5 == 681 || var5 == 100) {
			if (var5 == 681) {
				oplogic9++;
				if (oplogic9 >= 116) {
					// ANTICHEAT_OPLOGIC9
					this.out.pIsaac(162);
					this.out.p3(13018169);
				}
				// OPHELD4
				this.out.pIsaac(163);
			}
			if (var5 == 962) {
				// OPHELD2
				this.out.pIsaac(228);
			}
			if (var5 == 694) {
				// OPHELD1
				this.out.pIsaac(243);
			}
			if (var5 == 100) {
				// OPHELD5
				this.out.pIsaac(74);
			}
			if (var5 == 795) {
				// OPHELD3
				this.out.pIsaac(80);
			}
			this.out.p2(var6);
			this.out.p2(var3);
			this.out.p2(var4);
			this.selectedCycle = 0;
			this.selectedInterface = var4;
			this.selectedItem = var3;
			this.selectedArea = 2;
			if (IfType.list[var4].layerId == this.mainLayerId) {
				this.selectedArea = 1;
			}
			if (IfType.list[var4].layerId == this.chatLayerId) {
				this.selectedArea = 3;
			}
		}
		if (var5 == 398) {
			// OPHELDU
			this.out.pIsaac(200);
			this.out.p2(var6);
			this.out.p2(var3);
			this.out.p2(var4);
			this.out.p2(this.objInterface);
			this.out.p2(this.objSelectedSlot);
			this.out.p2(this.objSelectedInterface);
			this.selectedCycle = 0;
			this.selectedInterface = var4;
			this.selectedItem = var3;
			this.selectedArea = 2;
			if (IfType.list[var4].layerId == this.mainLayerId) {
				this.selectedArea = 1;
			}
			if (IfType.list[var4].layerId == this.chatLayerId) {
				this.selectedArea = 3;
			}
		}
		if (var5 == 231) {
			IfType var8 = IfType.list[var4];
			boolean var9 = true;
			if (var8.clientCode > 0) {
				var9 = this.handleInterfaceAction(var8);
			}
			if (var9) {
				// IF_BUTTON
				this.out.pIsaac(244);
				this.out.p2(var4);
			}
		}
		if (var5 == 1714) {
			ClientNpc var10 = this.npcs[var6];
			if (var10 != null) {
				String var11;
				if (var10.type.desc == null) {
					var11 = "It's a " + var10.type.name + ".";
				} else {
					var11 = new String(var10.type.desc);
				}
				this.addChat("", 0, var11);
			}
		}
		if (var5 == 524) {
			String var12 = this.menuOption[arg1];
			int var13 = var12.indexOf("@whi@");
			if (var13 != -1) {
				this.closeModal();
				this.reportAbuseInput = var12.substring(var13 + 5).trim();
				this.reportAbuseMuteOption = false;
				for (int var14 = 0; var14 < IfType.list.length; var14++) {
					if (IfType.list[var14] != null && IfType.list[var14].clientCode == 600) {
						this.reportAbuseInterfaceId = this.mainLayerId = IfType.list[var14].layerId;
						break;
					}
				}
			}
		}
		if (var5 == 721) {
			oplogic1 += var4;
			if (oplogic1 >= 139) {
				// ANTICHEAT_OPLOGIC1
				this.out.pIsaac(28);
				this.out.p4(0);
			}
			// OPLOC2
			this.interactWithLoc(var3, var4, var6, 213);
		}
		if (var5 == 242 || var5 == 209 || var5 == 309 || var5 == 852 || var5 == 793) {
			ClientNpc var15 = this.npcs[var6];
			if (var15 != null) {
				this.tryMove(0, 1, 0, var15.routeTileX[0], 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var15.routeTileZ[0], false, 1, 0);
				this.crossX = super.mouseClickX;
				this.crossY = super.mouseClickY;
				this.crossMode = 2;
				this.crossCycle = 0;
				if (var5 == 309) {
					// OPNPC3
					this.out.pIsaac(69);
				}
				if (var5 == 852) {
					// OPNPC4
					this.out.pIsaac(122);
				}
				if (var5 == 209) {
					// OPNPC2
					this.out.pIsaac(195);
				}
				if (var5 == 793) {
					// OPNPC5
					this.out.pIsaac(118);
				}
				if (var5 == 242) {
					// OPNPC1
					this.out.pIsaac(143);
				}
				this.out.p2(var6);
			}
		}
		if (var5 == 899 && this.interactWithLoc(var3, var4, var6, 26)) {
			// OPLOCT
			this.out.p2(this.activeSpellId);
		}
		if (var5 == 225) {
			// IF_BUTTON
			this.out.pIsaac(244);
			this.out.p2(var4);
			IfType var16 = IfType.list[var4];
			if (var16.scripts != null && var16.scripts[0][0] == 5) {
				int var17 = var16.scripts[0][1];
				if (this.varps[var17] != var16.scriptOperand[0]) {
					this.varps[var17] = var16.scriptOperand[0];
					this.updateVarp(var17);
					this.redrawSidebar = true;
				}
			}
		}
		if (var5 == 1328) {
			ObjType var18 = ObjType.get(var6);
			IfType var19 = IfType.list[var4];
			String var20;
			if (var19 != null && var19.linkObjCount[var3] >= 100000) {
				var20 = var19.linkObjCount[var3] + " x " + var18.name;
			} else if (var18.desc == null) {
				var20 = "It's a " + var18.name + ".";
			} else {
				var20 = new String(var18.desc);
			}
			this.addChat("", 0, var20);
		}
		if (var5 == 902) {
			String var21 = this.menuOption[arg1];
			int var22 = var21.indexOf("@whi@");
			if (var22 != -1) {
				long var23 = JString.toBase37(var21.substring(var22 + 5).trim());
				int var25 = -1;
				for (int var26 = 0; var26 < this.friendCount; var26++) {
					if (this.friendName37[var26] == var23) {
						var25 = var26;
						break;
					}
				}
				if (var25 != -1 && this.friendWorld[var25] > 0) {
					this.redrawChatback = true;
					this.chatbackInputOpen = false;
					this.showSocialInput = true;
					this.socialInput = "";
					this.socialInputType = 3;
					this.socialName37 = this.friendName37[var25];
					this.socialMessage = "Enter message to send to " + this.friendName[var25];
				}
			}
		}
		if (var5 == 357) {
			// OPLOC4
			this.interactWithLoc(var3, var4, var6, 87);
		}
		if (var5 == 370) {
			boolean var27 = this.tryMove(0, 0, 0, var3, 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var4, false, 0, 0);
			if (!var27) {
				this.tryMove(0, 1, 0, var3, 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var4, false, 1, 0);
			}
			this.crossX = super.mouseClickX;
			this.crossY = super.mouseClickY;
			this.crossMode = 2;
			this.crossCycle = 0;
			// OPOBJT
			this.out.pIsaac(202);
			this.out.p2(var3 + this.sceneBaseTileX);
			this.out.p2(var4 + this.sceneBaseTileZ);
			this.out.p2(var6);
			this.out.p2(this.activeSpellId);
		}
		if (var5 == 139 || var5 == 778 || var5 == 617 || var5 == 224 || var5 == 662) {
			boolean var29 = this.tryMove(0, 0, 0, var3, 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var4, false, 0, 0);
			if (!var29) {
				this.tryMove(0, 1, 0, var3, 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var4, false, 1, 0);
			}
			this.crossX = super.mouseClickX;
			this.crossY = super.mouseClickY;
			this.crossMode = 2;
			this.crossCycle = 0;
			if (var5 == 617) {
				// OPOBJ3
				this.out.pIsaac(178);
			}
			if (var5 == 662) {
				oplogic3 += this.sceneBaseTileZ;
				if (oplogic3 >= 118) {
					// ANTICHEAT_OPLOGIC3
					this.out.pIsaac(56);
					this.out.p4(0);
				}
				// OPOBJ5
				this.out.pIsaac(97);
			}
			if (var5 == 778) {
				// OPOBJ2
				this.out.pIsaac(67);
			}
			if (var5 == 139) {
				if ((var3 & 0x3) == 0) {
					oplogic7++;
				}
				if (oplogic7 >= 123) {
					// ANTICHEAT_OPLOGIC7
					this.out.pIsaac(187);
					this.out.p4(0);
				}
				// OPOBJ1
				this.out.pIsaac(141);
			}
			if (var5 == 224) {
				oplogic8 += var4;
				if (oplogic8 >= 75) {
					// ANTICHEAT_OPLOGIC8
					this.out.pIsaac(206);
					this.out.p1(19);
				}
				// OPOBJ4
				this.out.pIsaac(47);
			}
			this.out.p2(var3 + this.sceneBaseTileX);
			this.out.p2(var4 + this.sceneBaseTileZ);
			this.out.p2(var6);
		}
		if (var5 == 507 || var5 == 957) {
			String var31 = this.menuOption[arg1];
			int var32 = var31.indexOf("@whi@");
			if (var32 != -1) {
				String var33 = var31.substring(var32 + 5).trim();
				String var34 = JString.formatDisplayName(JString.fromBase37(JString.toBase37(var33)));
				boolean var35 = false;
				for (int var36 = 0; var36 < this.playerCount; var36++) {
					ClientPlayer var37 = this.players[this.playerIds[var36]];
					if (var37 != null && var37.name != null && var37.name.equalsIgnoreCase(var34)) {
						this.tryMove(0, 1, 0, var37.routeTileX[0], 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var37.routeTileZ[0], false, 1, 0);
						if (var5 == 507) {
							oplogic5 += var6;
							if (oplogic5 >= 66) {
								// ANTICHEAT_OPLOGIC5
								this.out.pIsaac(233);
								this.out.p1(154);
							}
							// OPPLAYER4
							this.out.pIsaac(72);
						}
						if (var5 == 957) {
							oplogic4++;
							if (oplogic4 >= 52) {
								// ANTICHEAT_OPLOGIC4
								this.out.pIsaac(121);
								this.out.p1(131);
							}
							// OPPLAYER1
							this.out.pIsaac(192);
						}
						this.out.p2(this.playerIds[var36]);
						var35 = true;
						break;
					}
				}
				if (!var35) {
					this.addChat("", 0, "Unable to find " + var34);
				}
			}
		}
		if (var5 == 810 && this.interactWithLoc(var3, var4, var6, 240)) {
			// OPLOCU
			this.out.p2(this.objInterface);
			this.out.p2(this.objSelectedSlot);
			this.out.p2(this.objSelectedInterface);
		}
		if (var5 == 1381) {
			int var38 = var6 >> 14 & 0x7FFF;
			LocType var39 = LocType.get(var38);
			String var40;
			if (var39.desc == null) {
				var40 = "It's a " + var39.name + ".";
			} else {
				var40 = new String(var39.desc);
			}
			this.addChat("", 0, var40);
		}
		if (var5 == 274) {
			IfType var41 = IfType.list[var4];
			this.spellSelected = 1;
			this.activeSpellId = var4;
			this.activeSpellFlags = var41.targetMask;
			this.objSelected = 0;
			this.redrawSidebar = true;
			String var42 = var41.targetVerb;
			if (var42.indexOf(" ") != -1) {
				var42 = var42.substring(0, var42.indexOf(" "));
			}
			String var43 = var41.targetVerb;
			if (var43.indexOf(" ") != -1) {
				var43 = var43.substring(var43.indexOf(" ") + 1);
			}
			this.spellCaption = var42 + " " + var41.targetText + " " + var43;
			if (this.activeSpellFlags == 16) {
				this.redrawSidebar = true;
				this.sideTab = 3;
				this.redrawSideicons = true;
			}
			return;
		}
		if (var5 == 582 || var5 == 113 || var5 == 555 || var5 == 331 || var5 == 354) {
			if (var5 == 331) {
				// INV_BUTTON4
				this.out.pIsaac(160);
			}
			if (var5 == 582) {
				if ((var6 & 0x3) == 0) {
					oplogic6++;
				}
				if (oplogic6 >= 133) {
					// ANTICHEAT_OPLOGIC6
					this.out.pIsaac(131);
					this.out.p2(6118);
				}
				// INV_BUTTON1
				this.out.pIsaac(181);
			}
			if (var5 == 113) {
				// INV_BUTTON2
				this.out.pIsaac(70);
			}
			if (var5 == 555) {
				// INV_BUTTON3
				this.out.pIsaac(59);
			}
			if (var5 == 354) {
				// INV_BUTTON5
				this.out.pIsaac(62);
			}
			this.out.p2(var6);
			this.out.p2(var3);
			this.out.p2(var4);
			this.selectedCycle = 0;
			this.selectedInterface = var4;
			this.selectedItem = var3;
			this.selectedArea = 2;
			if (IfType.list[var4].layerId == this.mainLayerId) {
				this.selectedArea = 1;
			}
			if (IfType.list[var4].layerId == this.chatLayerId) {
				this.selectedArea = 3;
			}
		}
		if (var5 == 111) {
			boolean var44 = this.tryMove(0, 0, 0, var3, 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var4, false, 0, 0);
			if (!var44) {
				this.tryMove(0, 1, 0, var3, 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var4, false, 1, 0);
			}
			this.crossX = super.mouseClickX;
			this.crossY = super.mouseClickY;
			this.crossMode = 2;
			this.crossCycle = 0;
			// OPOBJU
			this.out.pIsaac(245);
			this.out.p2(var3 + this.sceneBaseTileX);
			this.out.p2(var4 + this.sceneBaseTileZ);
			this.out.p2(var6);
			this.out.p2(this.objInterface);
			this.out.p2(this.objSelectedSlot);
			this.out.p2(this.objSelectedInterface);
		}
		if (var5 == 829) {
			ClientNpc var46 = this.npcs[var6];
			if (var46 != null) {
				this.tryMove(0, 1, 0, var46.routeTileX[0], 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var46.routeTileZ[0], false, 1, 0);
				this.crossX = super.mouseClickX;
				this.crossY = super.mouseClickY;
				this.crossMode = 2;
				this.crossCycle = 0;
				// OPNPCU
				this.out.pIsaac(119);
				this.out.p2(var6);
				this.out.p2(this.objInterface);
				this.out.p2(this.objSelectedSlot);
				this.out.p2(this.objSelectedInterface);
			}
		}
		if (var5 == 718) {
			if (this.menuVisible) {
				this.world.updateMousePicking(var4 - 4, var3 - 4);
			} else {
				this.world.updateMousePicking(super.mouseClickY - 4, super.mouseClickX - 4);
			}
		}
		if (var5 == 997 && !this.pressedContinueOption) {
			// RESUME_PAUSEBUTTON
			this.out.pIsaac(146);
			this.out.p2(var4);
			this.pressedContinueOption = true;
		}
		if (var5 == 639 || var5 == 499 || var5 == 27 || var5 == 387 || var5 == 185) {
			ClientPlayer var47 = this.players[var6];
			if (var47 != null) {
				this.tryMove(0, 1, 0, var47.routeTileX[0], 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var47.routeTileZ[0], false, 1, 0);
				this.crossX = super.mouseClickX;
				this.crossY = super.mouseClickY;
				this.crossMode = 2;
				this.crossCycle = 0;
				if (var5 == 387) {
					oplogic5 += var6;
					if (oplogic5 >= 66) {
						// ANTICHEAT_OPLOGIC5
						this.out.pIsaac(233);
						this.out.p1(154);
					}
					// OPPLAYER4
					this.out.pIsaac(72);
				}
				if (var5 == 27) {
					// OPPLAYER3
					this.out.pIsaac(18);
				}
				if (var5 == 639) {
					oplogic4++;
					if (oplogic4 >= 52) {
						// ANTICHEAT_OPLOGIC4
						this.out.pIsaac(121);
						this.out.p1(131);
					}
					// OPPLAYER1
					this.out.pIsaac(192);
				}
				if (var5 == 185) {
					// OPPLAYER5
					this.out.pIsaac(230);
				}
				if (var5 == 499) {
					// OPPLAYER2
					this.out.pIsaac(17);
				}
				this.out.p2(var6);
			}
		}
		if (var5 == 435) {
			// IF_BUTTON
			this.out.pIsaac(244);
			this.out.p2(var4);
			IfType var48 = IfType.list[var4];
			if (var48.scripts != null && var48.scripts[0][0] == 5) {
				int var49 = var48.scripts[0][1];
				this.varps[var49] = 1 - this.varps[var49];
				this.updateVarp(var49);
				this.redrawSidebar = true;
			}
		}
		if (var5 == 625) {
			// OPLOC1
			this.interactWithLoc(var3, var4, var6, 33);
		}
		if (var5 == 131) {
			ClientPlayer var50 = this.players[var6];
			if (var50 != null) {
				this.tryMove(0, 1, 0, var50.routeTileX[0], 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var50.routeTileZ[0], false, 1, 0);
				this.crossX = super.mouseClickX;
				this.crossY = super.mouseClickY;
				this.crossMode = 2;
				this.crossCycle = 0;
				// OPPLAYERT
				this.out.pIsaac(68);
				this.out.p2(var6);
				this.out.p2(this.activeSpellId);
			}
		}
		if (var5 == 1152) {
			ObjType var51 = ObjType.get(var6);
			String var52;
			if (var51.desc == null) {
				var52 = "It's a " + var51.name + ".";
			} else {
				var52 = new String(var51.desc);
			}
			this.addChat("", 0, var52);
		}
		if (var5 == 1071) {
			// OPLOC5
			this.interactWithLoc(var3, var4, var6, 147);
		}
		if (var5 == 605 || var5 == 47 || var5 == 513 || var5 == 884) {
			String var53 = this.menuOption[arg1];
			int var54 = var53.indexOf("@whi@");
			if (var54 != -1) {
				long var55 = JString.toBase37(var53.substring(var54 + 5).trim());
				if (var5 == 605) {
					this.addFriend(var55);
				}
				if (var5 == 47) {
					this.addIgnore(var55);
				}
				if (var5 == 513) {
					this.delFriend(var55);
				}
				if (var5 == 884) {
					this.delIgnore(var55);
				}
			}
		}
		if (var5 == 240) {
			ClientNpc var57 = this.npcs[var6];
			if (var57 != null) {
				this.tryMove(0, 1, 0, var57.routeTileX[0], 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var57.routeTileZ[0], false, 1, 0);
				this.crossX = super.mouseClickX;
				this.crossY = super.mouseClickY;
				this.crossMode = 2;
				this.crossCycle = 0;
				// OPNPCT
				this.out.pIsaac(231);
				this.out.p2(var6);
				this.out.p2(this.activeSpellId);
			}
		}
		if (var5 == 275) {
			ClientPlayer var58 = this.players[var6];
			if (var58 != null) {
				this.tryMove(0, 1, 0, var58.routeTileX[0], 2, localPlayer.routeTileZ[0], localPlayer.routeTileX[0], var58.routeTileZ[0], false, 1, 0);
				this.crossX = super.mouseClickX;
				this.crossY = super.mouseClickY;
				this.crossMode = 2;
				this.crossCycle = 0;
				// OPPLAYERU
				this.out.pIsaac(113);
				this.out.p2(var6);
				this.out.p2(this.objInterface);
				this.out.p2(this.objSelectedSlot);
				this.out.p2(this.objSelectedInterface);
			}
		}
		if (var5 == 743) {
			oplogic2++;
			if (oplogic2 >= 124) {
				// ANTICHEAT_OPLOGIC2
				this.out.pIsaac(77);
				this.out.p2(37954);
			}
			// OPLOC3
			this.interactWithLoc(var3, var4, var6, 98);
		}
		if (var5 == 102) {
			this.objSelected = 1;
			this.objSelectedSlot = var3;
			this.objSelectedInterface = var4;
			this.objInterface = var6;
			this.objSelectedName = ObjType.get(var6).name;
			this.spellSelected = 0;
			this.redrawSidebar = true;
			return;
		}
		this.objSelected = 0;
		this.spellSelected = 0;
		this.redrawSidebar = true;
	}

	@ObfuscatedName("client.a(ZILgc;II)V")
	public void addNpcOptions(int arg1, NpcType arg2, int arg3, int arg4) {
		if (this.menuSize >= 400) {
			return;
		}
		String var6 = arg2.name;
		if (arg2.vislevel != 0) {
			var6 = var6 + getCombatLevelTag(arg2.vislevel, localPlayer.combatLevel) + " (level-" + arg2.vislevel + ")";
		}
		if (this.objSelected == 1) {
			this.menuOption[this.menuSize] = "Use " + this.objSelectedName + " with @yel@" + var6;
			this.menuAction[this.menuSize] = 829;
			this.menuParamA[this.menuSize] = arg3;
			this.menuParamB[this.menuSize] = arg1;
			this.menuParamC[this.menuSize] = arg4;
			this.menuSize++;
		} else if (this.spellSelected == 1) {
			if ((this.activeSpellFlags & 0x2) == 2) {
				this.menuOption[this.menuSize] = this.spellCaption + " @yel@" + var6;
				this.menuAction[this.menuSize] = 240;
				this.menuParamA[this.menuSize] = arg3;
				this.menuParamB[this.menuSize] = arg1;
				this.menuParamC[this.menuSize] = arg4;
				this.menuSize++;
				return;
			}
		} else {
			if (arg2.op != null) {
				for (int var7 = 4; var7 >= 0; var7--) {
					if (arg2.op[var7] != null && !arg2.op[var7].equalsIgnoreCase("attack")) {
						this.menuOption[this.menuSize] = arg2.op[var7] + " @yel@" + var6;
						if (var7 == 0) {
							this.menuAction[this.menuSize] = 242;
						}
						if (var7 == 1) {
							this.menuAction[this.menuSize] = 209;
						}
						if (var7 == 2) {
							this.menuAction[this.menuSize] = 309;
						}
						if (var7 == 3) {
							this.menuAction[this.menuSize] = 852;
						}
						if (var7 == 4) {
							this.menuAction[this.menuSize] = 793;
						}
						this.menuParamA[this.menuSize] = arg3;
						this.menuParamB[this.menuSize] = arg1;
						this.menuParamC[this.menuSize] = arg4;
						this.menuSize++;
					}
				}
			}
			if (arg2.op != null) {
				for (int var8 = 4; var8 >= 0; var8--) {
					if (arg2.op[var8] != null && arg2.op[var8].equalsIgnoreCase("attack")) {
						short var9 = 0;
						if (arg2.vislevel > localPlayer.combatLevel) {
							var9 = 2000;
						}
						this.menuOption[this.menuSize] = arg2.op[var8] + " @yel@" + var6;
						if (var8 == 0) {
							this.menuAction[this.menuSize] = var9 + 242;
						}
						if (var8 == 1) {
							this.menuAction[this.menuSize] = var9 + 209;
						}
						if (var8 == 2) {
							this.menuAction[this.menuSize] = var9 + 309;
						}
						if (var8 == 3) {
							this.menuAction[this.menuSize] = var9 + 852;
						}
						if (var8 == 4) {
							this.menuAction[this.menuSize] = var9 + 793;
						}
						this.menuParamA[this.menuSize] = arg3;
						this.menuParamB[this.menuSize] = arg1;
						this.menuParamC[this.menuSize] = arg4;
						this.menuSize++;
					}
				}
			}
			this.menuOption[this.menuSize] = "Examine @yel@" + var6;
			this.menuAction[this.menuSize] = 1714;
			this.menuParamA[this.menuSize] = arg3;
			this.menuParamB[this.menuSize] = arg1;
			this.menuParamC[this.menuSize] = arg4;
			this.menuSize++;
		}
	}

	@ObfuscatedName("client.a(ZIIILbb;)V")
	public void addPlayerOptions(int arg1, int arg2, int arg3, ClientPlayer arg4) {
		if (arg4 == localPlayer || this.menuSize >= 400) {
			return;
		}
		String var6 = arg4.name + getCombatLevelTag(arg4.combatLevel, localPlayer.combatLevel) + " (level-" + arg4.combatLevel + ")";
		if (this.objSelected == 1) {
			this.menuOption[this.menuSize] = "Use " + this.objSelectedName + " with @whi@" + var6;
			this.menuAction[this.menuSize] = 275;
			this.menuParamA[this.menuSize] = arg2;
			this.menuParamB[this.menuSize] = arg3;
			this.menuParamC[this.menuSize] = arg1;
			this.menuSize++;
		} else if (this.spellSelected == 1) {
			if ((this.activeSpellFlags & 0x8) == 8) {
				this.menuOption[this.menuSize] = this.spellCaption + " @whi@" + var6;
				this.menuAction[this.menuSize] = 131;
				this.menuParamA[this.menuSize] = arg2;
				this.menuParamB[this.menuSize] = arg3;
				this.menuParamC[this.menuSize] = arg1;
				this.menuSize++;
			}
		} else {
			for (int var7 = 4; var7 >= 0; var7--) {
				if (this.playerOptions[var7] != null) {
					this.menuOption[this.menuSize] = this.playerOptions[var7] + " @whi@" + var6;
					short var8 = 0;
					if (this.playerOptions[var7].equalsIgnoreCase("attack")) {
						if (arg4.combatLevel > localPlayer.combatLevel) {
							var8 = 2000;
						}
					} else if (this.playerOptionsPushDown[var7]) {
						var8 = 2000;
					}
					if (var7 == 0) {
						this.menuAction[this.menuSize] = var8 + 639;
					}
					if (var7 == 1) {
						this.menuAction[this.menuSize] = var8 + 499;
					}
					if (var7 == 2) {
						this.menuAction[this.menuSize] = var8 + 27;
					}
					if (var7 == 3) {
						this.menuAction[this.menuSize] = var8 + 387;
					}
					if (var7 == 4) {
						this.menuAction[this.menuSize] = var8 + 185;
					}
					this.menuParamA[this.menuSize] = arg2;
					this.menuParamB[this.menuSize] = arg3;
					this.menuParamC[this.menuSize] = arg1;
					this.menuSize++;
				}
			}
		}
		for (int var9 = 0; var9 < this.menuSize; var9++) {
			if (this.menuAction[var9] == 718) {
				this.menuOption[var9] = "Walk here @whi@" + var6;
				break;
			}
		}
	}

	@ObfuscatedName("client.b(III)Ljava/lang/String;")
	public static String getCombatLevelTag(int arg1, int arg2) {
		int var4 = arg2 - arg1;
		if (var4 < -9) {
			return "@red@";
		} else if (var4 < -6) {
			return "@or3@";
		} else if (var4 < -3) {
			return "@or2@";
		} else if (var4 < 0) {
			return "@or1@";
		} else if (var4 > 9) {
			return "@gre@";
		} else if (var4 > 6) {
			return "@gr3@";
		} else if (var4 > 3) {
			return "@gr2@";
		} else if (var4 > 0) {
			return "@gr1@";
		} else {
			return "@yel@";
		}
	}

	@ObfuscatedName("client.a(IILd;II)V")
	public void drawLayer(int arg1, IfType arg2, int arg3, int arg4) {
		if (arg2.type != 0 || arg2.children == null || arg2.hidden && this.overMainLayerId != arg2.id && this.overSideLayerId != arg2.id && this.overChatLayerId != arg2.id) {
			return;
		}
		int var6 = Pix2D.boundLeft;
		int var7 = Pix2D.boundTop;
		int var8 = Pix2D.boundRight;
		int var9 = Pix2D.boundBottom;
		Pix2D.setClipping(arg3 + arg2.width, arg3, arg1 + arg2.height, arg1);
		int var10 = arg2.children.length;
		for (int var11 = 0; var11 < var10; var11++) {
			int var12 = arg2.childX[var11] + arg3;
			int var13 = arg2.childY[var11] + arg1 - arg4;
			IfType var14 = IfType.list[arg2.children[var11]];
			int var15 = var12 + var14.x;
			int var16 = var13 + var14.y;
			if (var14.clientCode > 0) {
				this.updateInterfaceContent(var14);
			}
			if (var14.type == 0) {
				if (var14.scrollPosition > var14.scrollSize - var14.height) {
					var14.scrollPosition = var14.scrollSize - var14.height;
				}
				if (var14.scrollPosition < 0) {
					var14.scrollPosition = 0;
				}
				this.drawLayer(var16, var14, var15, var14.scrollPosition);
				if (var14.scrollSize > var14.height) {
					this.drawScrollbar(var14.height, var14.scrollSize, var15 + var14.width, var14.scrollPosition, var16);
				}
			} else if (var14.type != 1) {
				if (var14.type == 2) {
					int var17 = 0;
					for (int var18 = 0; var18 < var14.height; var18++) {
						for (int var19 = 0; var19 < var14.width; var19++) {
							int var20 = var15 + var19 * (var14.marginX + 32);
							int var21 = var16 + var18 * (var14.marginY + 32);
							if (var17 < 20) {
								var20 += var14.invSlotOffsetX[var17];
								var21 += var14.invSlotOffsetY[var17];
							}
							if (var14.linkObjType[var17] > 0) {
								int var22 = 0;
								int var23 = 0;
								int var24 = var14.linkObjType[var17] - 1;
								if (var20 > Pix2D.boundLeft - 32 && var20 < Pix2D.boundRight && var21 > Pix2D.boundTop - 32 && var21 < Pix2D.boundBottom || this.objDragArea != 0 && this.objDragSlot == var17) {
									int var25 = 0;
									if (this.objSelected == 1 && this.objSelectedSlot == var17 && this.objSelectedInterface == var14.id) {
										var25 = 16777215;
									}
									Pix32 var26 = ObjType.getSprite(var25, var14.linkObjCount[var17], var24);
									if (var26 != null) {
										if (this.objDragArea != 0 && this.objDragSlot == var17 && this.objDragInterfaceId == var14.id) {
											var22 = super.mouseX - this.objGrabX;
											var23 = super.mouseY - this.objGrabY;
											if (var22 < 5 && var22 > -5) {
												var22 = 0;
											}
											if (var23 < 5 && var23 > -5) {
												var23 = 0;
											}
											if (this.objDragCycles < 5) {
												var22 = 0;
												var23 = 0;
											}
											var26.transPlotSprite(var20 + var22, 128, var21 + var23);
											if (var21 + var23 < Pix2D.boundTop && arg2.scrollPosition > 0) {
												int var27 = this.sceneDelta * (Pix2D.boundTop - var21 - var23) / 3;
												if (var27 > this.sceneDelta * 10) {
													var27 = this.sceneDelta * 10;
												}
												if (var27 > arg2.scrollPosition) {
													var27 = arg2.scrollPosition;
												}
												arg2.scrollPosition -= var27;
												this.objGrabY += var27;
											}
											if (var21 + var23 + 32 > Pix2D.boundBottom && arg2.scrollPosition < arg2.scrollSize - arg2.height) {
												int var28 = this.sceneDelta * (var21 + var23 + 32 - Pix2D.boundBottom) / 3;
												if (var28 > this.sceneDelta * 10) {
													var28 = this.sceneDelta * 10;
												}
												if (var28 > arg2.scrollSize - arg2.height - arg2.scrollPosition) {
													var28 = arg2.scrollSize - arg2.height - arg2.scrollPosition;
												}
												arg2.scrollPosition += var28;
												this.objGrabY -= var28;
											}
										} else if (this.selectedArea != 0 && this.selectedItem == var17 && this.selectedInterface == var14.id) {
											var26.transPlotSprite(var20, 128, var21);
										} else {
											var26.plotSprite(var20, var21);
										}
										if (var26.owi == 33 || var14.linkObjCount[var17] != 1) {
											int var29 = var14.linkObjCount[var17];
											this.fontPlain11.drawString(0, var20 + 1 + var22, var21 + 10 + var23, formatObjCount(var29));
											this.fontPlain11.drawString(16776960, var20 + var22, var21 + 9 + var23, formatObjCount(var29));
										}
									}
								}
							} else if (var14.invSlotGraphic != null && var17 < 20) {
								Pix32 var30 = var14.invSlotGraphic[var17];
								if (var30 != null) {
									var30.plotSprite(var20, var21);
								}
							}
							var17++;
						}
					}
				} else if (var14.type == 3) {
					boolean var31 = false;
					if (this.overChatLayerId == var14.id || this.overSideLayerId == var14.id || this.overMainLayerId == var14.id) {
						var31 = true;
					}
					int var32;
					if (this.getIfActive(var14)) {
						var32 = var14.colour2;
						if (var31 && var14.colour2Over != 0) {
							var32 = var14.colour2Over;
						}
					} else {
						var32 = var14.colour;
						if (var31 && var14.colourOver != 0) {
							var32 = var14.colourOver;
						}
					}
					if (var14.transparency == 0) {
						if (var14.fill) {
							Pix2D.fillRect(var14.height, var14.width, var15, var16, var32);
						} else {
							Pix2D.drawRect(var32, var14.width, var16, var15, var14.height);
						}
					} else if (var14.fill) {
						Pix2D.fillRectTrans(var16, 256 - (var14.transparency & 0xFF), var15, var14.height, var14.width, var32);
					} else {
						Pix2D.drawRectTrans(256 - (var14.transparency & 0xFF), var32, var14.width, var15, var14.height, var16);
					}
				} else if (var14.type == 4) {
					PixFont var33 = var14.font;
					String var34 = var14.text;
					boolean var35 = false;
					if (this.overChatLayerId == var14.id || this.overSideLayerId == var14.id || this.overMainLayerId == var14.id) {
						var35 = true;
					}
					int var36;
					if (this.getIfActive(var14)) {
						var36 = var14.colour2;
						if (var35 && var14.colour2Over != 0) {
							var36 = var14.colour2Over;
						}
						if (var14.text2.length() > 0) {
							var34 = var14.text2;
						}
					} else {
						var36 = var14.colour;
						if (var35 && var14.colourOver != 0) {
							var36 = var14.colourOver;
						}
					}
					if (var14.buttonType == 6 && this.pressedContinueOption) {
						var34 = "Please wait...";
						var36 = var14.colour;
					}
					if (Pix2D.width == 479) {
						if (var36 == 16776960) {
							var36 = 255;
						}
						if (var36 == 49152) {
							var36 = 16777215;
						}
					}
					int var37 = var16 + var33.height2d;
					while (var34.length() > 0) {
						if (var34.indexOf("%") != -1) {
							label348: while (true) {
								int var38 = var34.indexOf("%1");
								if (var38 == -1) {
									while (true) {
										int var39 = var34.indexOf("%2");
										if (var39 == -1) {
											while (true) {
												int var40 = var34.indexOf("%3");
												if (var40 == -1) {
													while (true) {
														int var41 = var34.indexOf("%4");
														if (var41 == -1) {
															while (true) {
																int var42 = var34.indexOf("%5");
																if (var42 == -1) {
																	break label348;
																}
																var34 = var34.substring(0, var42) + this.getIntString(this.getIfVar(4, var14)) + var34.substring(var42 + 2);
															}
														}
														var34 = var34.substring(0, var41) + this.getIntString(this.getIfVar(3, var14)) + var34.substring(var41 + 2);
													}
												}
												var34 = var34.substring(0, var40) + this.getIntString(this.getIfVar(2, var14)) + var34.substring(var40 + 2);
											}
										}
										var34 = var34.substring(0, var39) + this.getIntString(this.getIfVar(1, var14)) + var34.substring(var39 + 2);
									}
								}
								var34 = var34.substring(0, var38) + this.getIntString(this.getIfVar(0, var14)) + var34.substring(var38 + 2);
							}
						}
						int var43 = var34.indexOf("\\n");
						String var44;
						if (var43 == -1) {
							var44 = var34;
							var34 = "";
						} else {
							var44 = var34.substring(0, var43);
							var34 = var34.substring(var43 + 2);
						}
						if (var14.center) {
							var33.centreStringTag(var36, var15 + var14.width / 2, var44, var37, var14.shadowed);
						} else {
							var33.drawStringTag(var14.shadowed, var44, var37, var36, var15);
						}
						var37 += var33.height2d;
					}
				} else if (var14.type == 5) {
					Pix32 var45;
					if (this.getIfActive(var14)) {
						var45 = var14.graphic2;
					} else {
						var45 = var14.graphic;
					}
					if (var45 != null) {
						var45.plotSprite(var15, var16);
					}
				} else if (var14.type == 6) {
					int var46 = Pix3D.projectionX;
					int var47 = Pix3D.projectionY;
					Pix3D.projectionX = var15 + var14.width / 2;
					Pix3D.projectionY = var16 + var14.height / 2;
					int var48 = Pix3D.sinTable[var14.modelXAn] * var14.modelZoom >> 16;
					int var49 = Pix3D.cosTable[var14.modelXAn] * var14.modelZoom >> 16;
					boolean var50 = this.getIfActive(var14);
					int var51;
					if (var50) {
						var51 = var14.model2Anim;
					} else {
						var51 = var14.modelAnim;
					}
					Model var52;
					if (var51 == -1) {
						var52 = var14.getTempModel(-1, var50, -1);
					} else {
						SeqType var53 = SeqType.list[var51];
						var52 = var14.getTempModel(var53.frames[var14.seqFrame], var50, var53.iframes[var14.seqFrame]);
					}
					if (var52 != null) {
						var52.objRender(0, var14.modelYAn, 0, var14.modelXAn, 0, var48, var49);
					}
					Pix3D.projectionX = var46;
					Pix3D.projectionY = var47;
				} else if (var14.type == 7) {
					PixFont var54 = var14.font;
					int var55 = 0;
					for (int var56 = 0; var56 < var14.height; var56++) {
						for (int var57 = 0; var57 < var14.width; var57++) {
							if (var14.linkObjType[var55] > 0) {
								ObjType var58 = ObjType.get(var14.linkObjType[var55] - 1);
								String var59 = var58.name;
								if (var58.stackable || var14.linkObjCount[var55] != 1) {
									var59 = var59 + " x" + formatObjCountTagged(var14.linkObjCount[var55]);
								}
								int var60 = var15 + var57 * (var14.marginX + 115);
								int var61 = var16 + var56 * (var14.marginY + 12);
								if (var14.center) {
									var54.centreStringTag(var14.colour, var60 + var14.width / 2, var59, var61, var14.shadowed);
								} else {
									var54.drawStringTag(var14.shadowed, var59, var61, var14.colour, var60);
								}
							}
							var55++;
						}
					}
				}
			}
		}
		Pix2D.setClipping(var8, var6, var9, var7);
	}

	@ObfuscatedName("client.b(IIIIII)V")
	public void drawScrollbar(int arg1, int arg2, int arg3, int arg4, int arg5) {
		this.imageScrollbar0.plotSprite(arg3, arg5);
		this.imageScrollbar1.plotSprite(arg3, arg5 + arg1 - 16);
		Pix2D.fillRect(arg1 - 32, 16, arg3, arg5 + 16, this.SCROLLBAR_TRACK);
		int var7 = (arg1 - 32) * arg1 / arg2;
		if (var7 < 8) {
			var7 = 8;
		}
		int var8 = (arg1 - 32 - var7) * arg4 / (arg2 - arg1);
		Pix2D.fillRect(var7, 16, arg3, arg5 + 16 + var8, this.SCROLLBAR_GRIP_FOREGROUND);
		Pix2D.vline(arg5 + 16 + var8, var7, this.SCROLLBAR_GRIP_HIGHLIGHT, arg3, -490);
		Pix2D.vline(arg5 + 16 + var8, var7, this.SCROLLBAR_GRIP_HIGHLIGHT, arg3 + 1, -490);
		Pix2D.hline(arg3, arg5 + 16 + var8, this.SCROLLBAR_GRIP_HIGHLIGHT, 16);
		Pix2D.hline(arg3, arg5 + 17 + var8, this.SCROLLBAR_GRIP_HIGHLIGHT, 16);
		Pix2D.vline(arg5 + 16 + var8, var7, this.SCROLLBAR_GRIP_LOWLIGHT, arg3 + 15, -490);
		Pix2D.vline(arg5 + 17 + var8, var7 - 1, this.SCROLLBAR_GRIP_LOWLIGHT, arg3 + 14, -490);
		Pix2D.hline(arg3, arg5 + 15 + var8 + var7, this.SCROLLBAR_GRIP_LOWLIGHT, 16);
		Pix2D.hline(arg3 + 1, arg5 + 14 + var8 + var7, this.SCROLLBAR_GRIP_LOWLIGHT, 15);
	}

	@ObfuscatedName("client.b(BI)Ljava/lang/String;")
	public static String formatObjCount(int arg1) {
		if (arg1 < 100000) {
			return String.valueOf(arg1);
		} else if (arg1 < 10000000) {
			return arg1 / 1000 + "K";
		} else {
			return arg1 / 1000000 + "M";
		}
	}

	@ObfuscatedName("client.b(II)Ljava/lang/String;")
	public static String formatObjCountTagged(int arg0) {
		String var2 = String.valueOf(arg0);
		for (int var3 = var2.length() - 3; var3 > 0; var3 -= 3) {
			var2 = var2.substring(0, var3) + "," + var2.substring(var3);
		}
		if (var2.length() > 8) {
			var2 = "@gre@" + var2.substring(0, var2.length() - 8) + " million @whi@(" + var2 + ")";
		} else if (var2.length() > 4) {
			var2 = "@cya@" + var2.substring(0, var2.length() - 4) + "K @whi@(" + var2 + ")";
		}
		return " " + var2;
	}

	@ObfuscatedName("client.a(IIZBILd;III)V")
	public void doScrollbar(int arg0, int arg1, boolean arg2, int arg4, IfType arg5, int arg6, int arg7, int arg8) {
		if (this.scrollGrabbed) {
			this.scrollInputPadding = 32;
		} else {
			this.scrollInputPadding = 0;
		}
		this.scrollGrabbed = false;
		if (arg4 >= arg0 && arg4 < arg0 + 16 && arg6 >= arg8 && arg6 < arg8 + 16) {
			arg5.scrollPosition -= this.dragCycles * 4;
			if (arg2) {
				this.redrawSidebar = true;
			}
		} else if (arg4 >= arg0 && arg4 < arg0 + 16 && arg6 >= arg8 + arg7 - 16 && arg6 < arg8 + arg7) {
			arg5.scrollPosition += this.dragCycles * 4;
			if (arg2) {
				this.redrawSidebar = true;
			}
		} else if (arg4 >= arg0 - this.scrollInputPadding && arg4 < arg0 + 16 + this.scrollInputPadding && arg6 >= arg8 + 16 && arg6 < arg8 + arg7 - 16 && this.dragCycles > 0) {
			int var10 = (arg7 - 32) * arg7 / arg1;
			if (var10 < 8) {
				var10 = 8;
			}
			int var11 = arg6 - arg8 - 16 - var10 / 2;
			int var12 = arg7 - 32 - var10;
			arg5.scrollPosition = (arg1 - arg7) * var11 / var12;
			if (arg2) {
				this.redrawSidebar = true;
			}
			this.scrollGrabbed = true;
		}
	}

	@ObfuscatedName("client.a(IZ)Ljava/lang/String;")
	public String getIntString(int arg0) {
		return arg0 < 999999999 ? String.valueOf(arg0) : "*";
	}

	@ObfuscatedName("client.a(ZLd;)Z")
	public boolean getIfActive(IfType arg1) {
		if (arg1.scriptComparator == null) {
			return false;
		}
		for (int var3 = 0; var3 < arg1.scriptComparator.length; var3++) {
			int var4 = this.getIfVar(var3, arg1);
			int var5 = arg1.scriptOperand[var3];
			if (arg1.scriptComparator[var3] == 2) {
				if (var4 >= var5) {
					return false;
				}
			} else if (arg1.scriptComparator[var3] == 3) {
				if (var4 <= var5) {
					return false;
				}
			} else if (arg1.scriptComparator[var3] == 4) {
				if (var4 == var5) {
					return false;
				}
			} else if (var4 != var5) {
				return false;
			}
		}
		return true;
	}

	@ObfuscatedName("client.a(IILd;)I")
	public int getIfVar(int arg0, IfType arg2) {
		if (arg2.scripts == null || arg0 >= arg2.scripts.length) {
			return -2;
		}
		try {
			int[] var4 = arg2.scripts[arg0];
			int var5 = 0;
			int var6 = 0;
			byte var7 = 0;
			while (true) {
				int var8 = var4[var6++];
				int var9 = 0;
				byte var10 = 0;
				if (var8 == 0) {
					return var5;
				}
				if (var8 == 1) {
					var9 = this.statEffectiveLevel[var4[var6++]];
				}
				if (var8 == 2) {
					var9 = this.statBaseLevel[var4[var6++]];
				}
				if (var8 == 3) {
					var9 = this.statXP[var4[var6++]];
				}
				if (var8 == 4) {
					IfType var11 = IfType.list[var4[var6++]];
					int var12 = var4[var6++];
					if (var12 >= 0 && var12 < ObjType.count && (!ObjType.get(var12).members || membersWorld)) {
						for (int var13 = 0; var13 < var11.linkObjType.length; var13++) {
							if (var11.linkObjType[var13] == var12 + 1) {
								var9 += var11.linkObjCount[var13];
							}
						}
					}
				}
				if (var8 == 5) {
					var9 = this.varps[var4[var6++]];
				}
				if (var8 == 6) {
					var9 = levelExperience[this.statBaseLevel[var4[var6++]] - 1];
				}
				if (var8 == 7) {
					var9 = this.varps[var4[var6++]] * 100 / 46875;
				}
				if (var8 == 8) {
					var9 = localPlayer.combatLevel;
				}
				if (var8 == 9) {
					for (int var14 = 0; var14 < Stats.COUNT; var14++) {
						if (Stats.ENABLED[var14]) {
							var9 += this.statBaseLevel[var14];
						}
					}
				}
				if (var8 == 10) {
					IfType var15 = IfType.list[var4[var6++]];
					int var16 = var4[var6++] + 1;
					if (var16 >= 0 && var16 < ObjType.count && (!ObjType.get(var16).members || membersWorld)) {
						for (int var17 = 0; var17 < var15.linkObjType.length; var17++) {
							if (var15.linkObjType[var17] == var16) {
								var9 = 999999999;
								break;
							}
						}
					}
				}
				if (var8 == 11) {
					var9 = this.runenergy;
				}
				if (var8 == 12) {
					var9 = this.runweight;
				}
				if (var8 == 13) {
					int var18 = this.varps[var4[var6++]];
					int var19 = var4[var6++];
					var9 = (var18 & 0x1 << var19) == 0 ? 0 : 1;
				}
				if (var8 == 14) {
					int var20 = var4[var6++];
					VarBitType var21 = VarBitType.list[var20];
					int var22 = var21.basevar;
					int var23 = var21.startbit;
					int var24 = var21.endbit;
					int var25 = BITMASK[var24 - var23];
					var9 = this.varps[var22] >> var23 & var25;
				}
				if (var8 == 15) {
					var10 = 1;
				}
				if (var8 == 16) {
					var10 = 2;
				}
				if (var8 == 17) {
					var10 = 3;
				}
				if (var8 == 18) {
					var9 = (localPlayer.x >> 7) + this.sceneBaseTileX;
				}
				if (var8 == 19) {
					var9 = (localPlayer.z >> 7) + this.sceneBaseTileZ;
				}
				if (var8 == 20) {
					var9 = var4[var6++];
				}
				if (var10 == 0) {
					if (var7 == 0) {
						var5 += var9;
					}
					if (var7 == 1) {
						var5 -= var9;
					}
					if (var7 == 2 && var9 != 0) {
						var5 /= var9;
					}
					if (var7 == 3) {
						var5 *= var9;
					}
					var7 = 0;
				} else {
					var7 = var10;
				}
			}
		} catch (Exception var26) {
			return -1;
		}
	}

	@ObfuscatedName("client.a(IIILd;III)V")
	public void handleComponentInput(int arg0, int arg1, IfType arg3, int arg4, int arg5, int arg6) {
		if (arg3.type != 0 || arg3.children == null || arg3.hidden || (arg5 < arg4 || arg0 < arg1 || arg5 > arg4 + arg3.width || arg0 > arg1 + arg3.height)) {
			return;
		}
		int var8 = arg3.children.length;
		for (int var9 = 0; var9 < var8; var9++) {
			int var10 = arg3.childX[var9] + arg4;
			int var11 = arg3.childY[var9] + arg1 - arg6;
			IfType var12 = IfType.list[arg3.children[var9]];
			int var13 = var10 + var12.x;
			int var14 = var11 + var12.y;
			if ((var12.overlayer >= 0 || var12.colourOver != 0) && arg5 >= var13 && arg0 >= var14 && arg5 < var13 + var12.width && arg0 < var14 + var12.height) {
				if (var12.overlayer >= 0) {
					this.lastOverLayerId = var12.overlayer;
				} else {
					this.lastOverLayerId = var12.id;
				}
			}
			if (var12.type == 0) {
				this.handleComponentInput(arg0, var14, var12, var13, arg5, var12.scrollPosition);
				if (var12.scrollSize > var12.height) {
					this.doScrollbar(var13 + var12.width, var12.scrollSize, true, arg5, var12, arg0, var12.height, var14);
				}
			} else {
				if (var12.buttonType == 1 && arg5 >= var13 && arg0 >= var14 && arg5 < var13 + var12.width && arg0 < var14 + var12.height) {
					boolean var15 = false;
					if (var12.clientCode != 0) {
						var15 = this.handleSocialMenuOption(var12);
					}
					if (!var15) {
						this.menuOption[this.menuSize] = var12.option;
						this.menuAction[this.menuSize] = 231;
						this.menuParamC[this.menuSize] = var12.id;
						this.menuSize++;
					}
				}
				if (var12.buttonType == 2 && this.spellSelected == 0 && arg5 >= var13 && arg0 >= var14 && arg5 < var13 + var12.width && arg0 < var14 + var12.height) {
					String var16 = var12.targetVerb;
					if (var16.indexOf(" ") != -1) {
						var16 = var16.substring(0, var16.indexOf(" "));
					}
					this.menuOption[this.menuSize] = var16 + " @gre@" + var12.targetText;
					this.menuAction[this.menuSize] = 274;
					this.menuParamC[this.menuSize] = var12.id;
					this.menuSize++;
				}
				if (var12.buttonType == 3 && arg5 >= var13 && arg0 >= var14 && arg5 < var13 + var12.width && arg0 < var14 + var12.height) {
					this.menuOption[this.menuSize] = "Close";
					this.menuAction[this.menuSize] = 737;
					this.menuParamC[this.menuSize] = var12.id;
					this.menuSize++;
				}
				if (var12.buttonType == 4 && arg5 >= var13 && arg0 >= var14 && arg5 < var13 + var12.width && arg0 < var14 + var12.height) {
					this.menuOption[this.menuSize] = var12.option;
					this.menuAction[this.menuSize] = 435;
					this.menuParamC[this.menuSize] = var12.id;
					this.menuSize++;
				}
				if (var12.buttonType == 5 && arg5 >= var13 && arg0 >= var14 && arg5 < var13 + var12.width && arg0 < var14 + var12.height) {
					this.menuOption[this.menuSize] = var12.option;
					this.menuAction[this.menuSize] = 225;
					this.menuParamC[this.menuSize] = var12.id;
					this.menuSize++;
				}
				if (var12.buttonType == 6 && !this.pressedContinueOption && arg5 >= var13 && arg0 >= var14 && arg5 < var13 + var12.width && arg0 < var14 + var12.height) {
					this.menuOption[this.menuSize] = var12.option;
					this.menuAction[this.menuSize] = 997;
					this.menuParamC[this.menuSize] = var12.id;
					this.menuSize++;
				}
				if (var12.type == 2) {
					int var17 = 0;
					for (int var18 = 0; var18 < var12.height; var18++) {
						for (int var19 = 0; var19 < var12.width; var19++) {
							int var20 = var13 + var19 * (var12.marginX + 32);
							int var21 = var14 + var18 * (var12.marginY + 32);
							if (var17 < 20) {
								var20 += var12.invSlotOffsetX[var17];
								var21 += var12.invSlotOffsetY[var17];
							}
							if (arg5 >= var20 && arg0 >= var21 && arg5 < var20 + 32 && arg0 < var21 + 32) {
								this.hoveredSlot = var17;
								this.hoveredSlotInterfaceId = var12.id;
								if (var12.linkObjType[var17] > 0) {
									ObjType var22 = ObjType.get(var12.linkObjType[var17] - 1);
									if (this.objSelected == 1 && var12.interactable) {
										if (var12.id != this.objSelectedInterface || var17 != this.objSelectedSlot) {
											this.menuOption[this.menuSize] = "Use " + this.objSelectedName + " with @lre@" + var22.name;
											this.menuAction[this.menuSize] = 398;
											this.menuParamA[this.menuSize] = var22.id;
											this.menuParamB[this.menuSize] = var17;
											this.menuParamC[this.menuSize] = var12.id;
											this.menuSize++;
										}
									} else if (this.spellSelected != 1 || !var12.interactable) {
										if (var12.interactable) {
											for (int var23 = 4; var23 >= 3; var23--) {
												if (var22.iop != null && var22.iop[var23] != null) {
													this.menuOption[this.menuSize] = var22.iop[var23] + " @lre@" + var22.name;
													if (var23 == 3) {
														this.menuAction[this.menuSize] = 681;
													}
													if (var23 == 4) {
														this.menuAction[this.menuSize] = 100;
													}
													this.menuParamA[this.menuSize] = var22.id;
													this.menuParamB[this.menuSize] = var17;
													this.menuParamC[this.menuSize] = var12.id;
													this.menuSize++;
												} else if (var23 == 4) {
													this.menuOption[this.menuSize] = "Drop @lre@" + var22.name;
													this.menuAction[this.menuSize] = 100;
													this.menuParamA[this.menuSize] = var22.id;
													this.menuParamB[this.menuSize] = var17;
													this.menuParamC[this.menuSize] = var12.id;
													this.menuSize++;
												}
											}
										}
										if (var12.usable) {
											this.menuOption[this.menuSize] = "Use @lre@" + var22.name;
											this.menuAction[this.menuSize] = 102;
											this.menuParamA[this.menuSize] = var22.id;
											this.menuParamB[this.menuSize] = var17;
											this.menuParamC[this.menuSize] = var12.id;
											this.menuSize++;
										}
										if (var12.interactable && var22.iop != null) {
											for (int var24 = 2; var24 >= 0; var24--) {
												if (var22.iop[var24] != null) {
													this.menuOption[this.menuSize] = var22.iop[var24] + " @lre@" + var22.name;
													if (var24 == 0) {
														this.menuAction[this.menuSize] = 694;
													}
													if (var24 == 1) {
														this.menuAction[this.menuSize] = 962;
													}
													if (var24 == 2) {
														this.menuAction[this.menuSize] = 795;
													}
													this.menuParamA[this.menuSize] = var22.id;
													this.menuParamB[this.menuSize] = var17;
													this.menuParamC[this.menuSize] = var12.id;
													this.menuSize++;
												}
											}
										}
										if (var12.iop != null) {
											for (int var25 = 4; var25 >= 0; var25--) {
												if (var12.iop[var25] != null) {
													this.menuOption[this.menuSize] = var12.iop[var25] + " @lre@" + var22.name;
													if (var25 == 0) {
														this.menuAction[this.menuSize] = 582;
													}
													if (var25 == 1) {
														this.menuAction[this.menuSize] = 113;
													}
													if (var25 == 2) {
														this.menuAction[this.menuSize] = 555;
													}
													if (var25 == 3) {
														this.menuAction[this.menuSize] = 331;
													}
													if (var25 == 4) {
														this.menuAction[this.menuSize] = 354;
													}
													this.menuParamA[this.menuSize] = var22.id;
													this.menuParamB[this.menuSize] = var17;
													this.menuParamC[this.menuSize] = var12.id;
													this.menuSize++;
												}
											}
										}
										this.menuOption[this.menuSize] = "Examine @lre@" + var22.name;
										this.menuAction[this.menuSize] = 1328;
										this.menuParamA[this.menuSize] = var22.id;
										this.menuParamB[this.menuSize] = var17;
										this.menuParamC[this.menuSize] = var12.id;
										this.menuSize++;
									} else if ((this.activeSpellFlags & 0x10) == 16) {
										this.menuOption[this.menuSize] = this.spellCaption + " @lre@" + var22.name;
										this.menuAction[this.menuSize] = 563;
										this.menuParamA[this.menuSize] = var22.id;
										this.menuParamB[this.menuSize] = var17;
										this.menuParamC[this.menuSize] = var12.id;
										this.menuSize++;
									}
								}
							}
							var17++;
						}
					}
				}
			}
		}
	}

	@ObfuscatedName("client.a(ILd;)Z")
	public boolean handleSocialMenuOption(IfType arg1) {
		int var3 = arg1.clientCode;
		if (var3 >= 1 && var3 <= 200 || !(var3 < 701 || var3 > 900)) {
			if (var3 >= 801) {
				var3 -= 701;
			} else if (var3 >= 701) {
				var3 -= 601;
			} else if (var3 >= 101) {
				var3 -= 101;
			} else {
				var3--;
			}
			this.menuOption[this.menuSize] = "Remove @whi@" + this.friendName[var3];
			this.menuAction[this.menuSize] = 513;
			this.menuSize++;
			this.menuOption[this.menuSize] = "Message @whi@" + this.friendName[var3];
			this.menuAction[this.menuSize] = 902;
			this.menuSize++;
			return true;
		} else if (var3 >= 401 && var3 <= 500) {
			this.menuOption[this.menuSize] = "Remove @whi@" + arg1.text;
			this.menuAction[this.menuSize] = 884;
			this.menuSize++;
			return true;
		} else {
			return false;
		}
	}

	@ObfuscatedName("client.d(II)V")
	public void resetInterfaceAnimation(int arg1) {
		IfType var3 = IfType.list[arg1];
		for (int var4 = 0; var4 < var3.children.length && var3.children[var4] != -1; var4++) {
			IfType var5 = IfType.list[var3.children[var4]];
			if (var5.type == 1) {
				this.resetInterfaceAnimation(var5.id);
			}
			var5.seqFrame = 0;
			var5.seqCycle = 0;
		}
	}

	@ObfuscatedName("client.c(III)Z")
	public boolean animateLayer(int arg1, int arg2) {
		boolean var5 = false;
		IfType var6 = IfType.list[arg2];
		for (int var7 = 0; var7 < var6.children.length && var6.children[var7] != -1; var7++) {
			IfType var8 = IfType.list[var6.children[var7]];
			if (var8.type == 1) {
				var5 |= this.animateLayer(arg1, var8.id);
			}
			if (var8.type == 6 && (var8.modelAnim != -1 || var8.model2Anim != -1)) {
				boolean var9 = this.getIfActive(var8);
				int var10;
				if (var9) {
					var10 = var8.model2Anim;
				} else {
					var10 = var8.modelAnim;
				}
				if (var10 != -1) {
					SeqType var11 = SeqType.list[var10];
					var8.seqCycle += arg1;
					while (var8.seqCycle > var11.getDuration(var8.seqFrame)) {
						var8.seqCycle -= var11.getDuration(var8.seqFrame) + 1;
						var8.seqFrame++;
						if (var8.seqFrame >= var11.numFrames) {
							var8.seqFrame -= var11.loops;
							if (var8.seqFrame < 0 || var8.seqFrame >= var11.numFrames) {
								var8.seqFrame = 0;
							}
						}
						var5 = true;
					}
				}
			}
		}
		return var5;
	}

	@ObfuscatedName("client.a(ZI)V")
	public void updateVarp(int arg1) {
		int var3 = VarpType.list[arg1].clientcode;
		if (var3 == 0) {
			return;
		}
		int var4 = this.varps[arg1];
		if (var3 == 1) {
			if (var4 == 1) {
				Pix3D.initColourTable(0.9D);
			}
			if (var4 == 2) {
				Pix3D.initColourTable(0.8D);
			}
			if (var4 == 3) {
				Pix3D.initColourTable(0.7D);
			}
			if (var4 == 4) {
				Pix3D.initColourTable(0.6D);
			}
			ObjType.spriteCache.clear();
			this.redrawFrame = true;
		}
		if (var3 == 3) {
			boolean var5 = this.midiActive;
			if (var4 == 0) {
				this.setMidiVolume(0, this.midiActive);
				this.midiActive = true;
			}
			if (var4 == 1) {
				this.setMidiVolume(-400, this.midiActive);
				this.midiActive = true;
			}
			if (var4 == 2) {
				this.setMidiVolume(-800, this.midiActive);
				this.midiActive = true;
			}
			if (var4 == 3) {
				this.setMidiVolume(-1200, this.midiActive);
				this.midiActive = true;
			}
			if (var4 == 4) {
				this.midiActive = false;
			}
			if (this.midiActive != var5 && !lowMem) {
				if (this.midiActive) {
					this.midiSong = this.nextMidiSong;
					this.midiFading = false;
					this.onDemand.request(2, this.midiSong);
				} else {
					this.stopMidi();
				}
				this.nextMusicDelay = 0;
			}
		}
		if (var3 == 4) {
			if (var4 == 0) {
				this.waveEnabled = true;
				this.setWaveVolume(0);
			}
			if (var4 == 1) {
				this.waveEnabled = true;
				this.setWaveVolume(-400);
			}
			if (var4 == 2) {
				this.waveEnabled = true;
				this.setWaveVolume(-800);
			}
			if (var4 == 3) {
				this.waveEnabled = true;
				this.setWaveVolume(-1200);
			}
			if (var4 == 4) {
				this.waveEnabled = false;
			}
		}
		if (var3 == 5) {
			this.oneMouseButton = var4;
		}
		if (var3 == 6) {
			this.chatEffects = var4;
		}
		if (var3 == 8) {
			this.splitPrivateChat = var4;
			this.redrawChatback = true;
		}
		if (var3 == 9) {
			this.bankArrangeMode = var4;
		}
	}

	@ObfuscatedName("client.a(Ld;Z)V")
	public void updateInterfaceContent(IfType arg0) {
		int var3 = arg0.clientCode;
		if ((var3 < 1 || var3 > 100) && (var3 < 701 || var3 > 800)) {
			if (var3 >= 101 && var3 <= 200 || var3 >= 801 && var3 <= 900) {
				int var5 = this.friendCount;
				if (this.friendListStatus != 2) {
					var5 = 0;
				}
				if (var3 > 800) {
					var3 -= 701;
				} else {
					var3 -= 101;
				}
				if (var3 >= var5) {
					arg0.text = "";
					arg0.buttonType = 0;
				} else {
					if (this.friendWorld[var3] == 0) {
						arg0.text = "@red@Offline";
					} else if (this.friendWorld[var3] == nodeId) {
						arg0.text = "@gre@World-" + (this.friendWorld[var3] - 9);
					} else {
						arg0.text = "@yel@World-" + (this.friendWorld[var3] - 9);
					}
					arg0.buttonType = 1;
				}
			} else if (var3 == 203) {
				int var6 = this.friendCount;
				if (this.friendListStatus != 2) {
					var6 = 0;
				}
				arg0.scrollSize = var6 * 15 + 20;
				if (arg0.scrollSize <= arg0.height) {
					arg0.scrollSize = arg0.height + 1;
				}
			} else if (var3 >= 401 && var3 <= 500) {
				var3 -= 401;
				if (var3 >= this.ignoreCount) {
					arg0.text = "";
					arg0.buttonType = 0;
				} else {
					arg0.text = JString.formatDisplayName(JString.fromBase37(this.ignoreName37[var3]));
					arg0.buttonType = 1;
				}
			} else if (var3 == 503) {
				arg0.scrollSize = this.ignoreCount * 15 + 20;
				if (arg0.scrollSize <= arg0.height) {
					arg0.scrollSize = arg0.height + 1;
				}
			} else if (var3 == 327) {
				arg0.modelXAn = 150;
				arg0.modelYAn = (int) (Math.sin((double) loopCycle / 40.0D) * 256.0D) & 0x7FF;
				if (this.updateDesignModel) {
					for (int var7 = 0; var7 < 7; var7++) {
						int var8 = this.designKits[var7];
						if (var8 >= 0 && !IdkType.list[var8].checkModel()) {
							return;
						}
					}
					this.updateDesignModel = false;
					Model[] var9 = new Model[7];
					int var10 = 0;
					for (int var11 = 0; var11 < 7; var11++) {
						int var12 = this.designKits[var11];
						if (var12 >= 0) {
							var9[var10++] = IdkType.list[var12].getModelNoCheck();
						}
					}
					Model var13 = new Model(var9, var10);
					for (int var14 = 0; var14 < 5; var14++) {
						if (this.designColours[var14] != 0) {
							var13.recolour(recol1d[var14][0], recol1d[var14][this.designColours[var14]]);
							if (var14 == 1) {
								var13.recolour(recol2d[0], recol2d[this.designColours[var14]]);
							}
						}
					}
					var13.prepareAnim();
					var13.animate(SeqType.list[localPlayer.readyanim].frames[0]);
					var13.calculateNormals(64, 850, -30, -50, -30, true);
					arg0.modelType = 5;
					arg0.modelId = 0;
					IfType.cacheModel(0, var13, 5);
				}
			} else if (var3 == 324) {
				if (this.genderButtonImage0 == null) {
					this.genderButtonImage0 = arg0.graphic;
					this.genderButtonImage1 = arg0.graphic2;
				}
				if (this.designGender) {
					arg0.graphic = this.genderButtonImage1;
				} else {
					arg0.graphic = this.genderButtonImage0;
				}
			} else if (var3 == 325) {
				if (this.genderButtonImage0 == null) {
					this.genderButtonImage0 = arg0.graphic;
					this.genderButtonImage1 = arg0.graphic2;
				}
				if (this.designGender) {
					arg0.graphic = this.genderButtonImage0;
				} else {
					arg0.graphic = this.genderButtonImage1;
				}
			} else if (var3 == 600) {
				arg0.text = this.reportAbuseInput;
				if (loopCycle % 20 < 10) {
					arg0.text = arg0.text + "|";
				} else {
					arg0.text = arg0.text + " ";
				}
			} else {
				if (var3 == 613) {
					if (this.staffmodlevel < 1) {
						arg0.text = "";
					} else if (this.reportAbuseMuteOption) {
						arg0.colour = 16711680;
						arg0.text = "Moderator option: Mute player for 48 hours: <ON>";
					} else {
						arg0.colour = 16777215;
						arg0.text = "Moderator option: Mute player for 48 hours: <OFF>";
					}
				}
				if (var3 == 650 || var3 == 655) {
					if (this.lastAddress == 0) {
						arg0.text = "";
					} else {
						String var15;
						if (this.daysSinceLogin == 0) {
							var15 = "earlier today";
						} else if (this.daysSinceLogin == 1) {
							var15 = "yesterday";
						} else {
							var15 = this.daysSinceLogin + " days ago";
						}
						arg0.text = "You last logged in " + var15 + " from: " + signlink.dns;
					}
				}
				if (var3 == 651) {
					if (this.unreadMessageCount == 0) {
						arg0.text = "0 unread messages";
						arg0.colour = 16776960;
					}
					if (this.unreadMessageCount == 1) {
						arg0.text = "1 unread message";
						arg0.colour = 65280;
					}
					if (this.unreadMessageCount > 1) {
						arg0.text = this.unreadMessageCount + " unread messages";
						arg0.colour = 65280;
					}
				}
				if (var3 == 652) {
					if (this.daysSinceRecoveriesChanged == 201) {
						if (this.warnMembersInNonMembers == 1) {
							arg0.text = "@yel@This is a non-members world: @whi@Since you are a member we";
						} else {
							arg0.text = "";
						}
					} else if (this.daysSinceRecoveriesChanged == 200) {
						arg0.text = "You have not yet set any password recovery questions.";
					} else {
						String var16;
						if (this.daysSinceRecoveriesChanged == 0) {
							var16 = "Earlier today";
						} else if (this.daysSinceRecoveriesChanged == 1) {
							var16 = "Yesterday";
						} else {
							var16 = this.daysSinceRecoveriesChanged + " days ago";
						}
						arg0.text = var16 + " you changed your recovery questions";
					}
				}
				if (var3 == 653) {
					if (this.daysSinceRecoveriesChanged == 201) {
						if (this.warnMembersInNonMembers == 1) {
							arg0.text = "@whi@recommend you use a members world instead. You may use";
						} else {
							arg0.text = "";
						}
					} else if (this.daysSinceRecoveriesChanged == 200) {
						arg0.text = "We strongly recommend you do so now to secure your account.";
					} else {
						arg0.text = "If you do not remember making this change then cancel it immediately";
					}
				}
				if (var3 == 654) {
					if (this.daysSinceRecoveriesChanged == 201) {
						if (this.warnMembersInNonMembers == 1) {
							arg0.text = "@whi@this world but member benefits are unavailabe whilst here.";
						} else {
							arg0.text = "";
						}
					} else if (this.daysSinceRecoveriesChanged == 200) {
						arg0.text = "Do this from the 'account management' area on our front webpage";
					} else {
						arg0.text = "Do this from the 'account management' area on our front webpage";
					}
				}
			}
		} else if (var3 == 1 && this.friendListStatus == 0) {
			arg0.text = "Loading friend list";
			arg0.buttonType = 0;
		} else if (var3 == 1 && this.friendListStatus == 1) {
			arg0.text = "Connecting to friendserver";
			arg0.buttonType = 0;
		} else if (var3 == 2 && this.friendListStatus != 2) {
			arg0.text = "Please wait...";
			arg0.buttonType = 0;
		} else {
			int var4 = this.friendCount;
			if (this.friendListStatus != 2) {
				var4 = 0;
			}
			if (var3 > 700) {
				var3 -= 601;
			} else {
				var3--;
			}
			if (var3 >= var4) {
				arg0.text = "";
				arg0.buttonType = 0;
			} else {
				arg0.text = this.friendName[var3];
				arg0.buttonType = 1;
			}
		}
	}

	@ObfuscatedName("client.a(Ld;I)Z")
	public boolean handleInterfaceAction(IfType arg0) {
		int var3 = arg0.clientCode;
		if (this.friendListStatus == 2) {
			if (var3 == 201) {
				this.redrawChatback = true;
				this.chatbackInputOpen = false;
				this.showSocialInput = true;
				this.socialInput = "";
				this.socialInputType = 1;
				this.socialMessage = "Enter name of friend to add to list";
			}
			if (var3 == 202) {
				this.redrawChatback = true;
				this.chatbackInputOpen = false;
				this.showSocialInput = true;
				this.socialInput = "";
				this.socialInputType = 2;
				this.socialMessage = "Enter name of friend to delete from list";
			}
		}
		if (var3 == 205) {
			this.pendingLogout = 250;
			return true;
		}
		if (var3 == 501) {
			this.redrawChatback = true;
			this.chatbackInputOpen = false;
			this.showSocialInput = true;
			this.socialInput = "";
			this.socialInputType = 4;
			this.socialMessage = "Enter name of player to add to list";
		}
		if (var3 == 502) {
			this.redrawChatback = true;
			this.chatbackInputOpen = false;
			this.showSocialInput = true;
			this.socialInput = "";
			this.socialInputType = 5;
			this.socialMessage = "Enter name of player to delete from list";
		}
		if (var3 >= 300 && var3 <= 313) {
			int var4 = (var3 - 300) / 2;
			int var5 = var3 & 0x1;
			int var6 = this.designKits[var4];
			if (var6 != -1) {
				while (true) {
					if (var5 == 0) {
						var6--;
						if (var6 < 0) {
							var6 = IdkType.count - 1;
						}
					}
					if (var5 == 1) {
						var6++;
						if (var6 >= IdkType.count) {
							var6 = 0;
						}
					}
					if (!IdkType.list[var6].disable && IdkType.list[var6].type == var4 + (this.designGender ? 0 : 7)) {
						this.designKits[var4] = var6;
						this.updateDesignModel = true;
						break;
					}
				}
			}
		}
		if (var3 >= 314 && var3 <= 323) {
			int var7 = (var3 - 314) / 2;
			int var8 = var3 & 0x1;
			int var9 = this.designColours[var7];
			if (var8 == 0) {
				var9--;
				if (var9 < 0) {
					var9 = recol1d[var7].length - 1;
				}
			}
			if (var8 == 1) {
				var9++;
				if (var9 >= recol1d[var7].length) {
					var9 = 0;
				}
			}
			this.designColours[var7] = var9;
			this.updateDesignModel = true;
		}
		if (var3 == 324 && !this.designGender) {
			this.designGender = true;
			this.validateCharacterDesign();
		}
		if (var3 == 325 && this.designGender) {
			this.designGender = false;
			this.validateCharacterDesign();
		}
		if (var3 == 326) {
			// IF_PLAYERDESIGN
			this.out.pIsaac(13);
			this.out.p1(this.designGender ? 0 : 1);
			for (int var10 = 0; var10 < 7; var10++) {
				this.out.p1(this.designKits[var10]);
			}
			for (int var11 = 0; var11 < 5; var11++) {
				this.out.p1(this.designColours[var11]);
			}
			return true;
		}
		if (var3 == 613) {
			this.reportAbuseMuteOption = !this.reportAbuseMuteOption;
		}
		if (var3 >= 601 && var3 <= 612) {
			this.closeModal();
			if (this.reportAbuseInput.length() > 0) {
				// REPORT_ABUSE
				this.out.pIsaac(203);
				this.out.p8(JString.toBase37(this.reportAbuseInput));
				this.out.p1(var3 - 601);
				this.out.p1(this.reportAbuseMuteOption ? 1 : 0);
			}
		}
		return false;
	}

	@ObfuscatedName("client.e(Z)V")
	public void validateCharacterDesign() {
		this.updateDesignModel = true;
		for (int var2 = 0; var2 < 7; var2++) {
			this.designKits[var2] = -1;
			for (int var3 = 0; var3 < IdkType.count; var3++) {
				if (!IdkType.list[var3].disable && IdkType.list[var3].type == var2 + (this.designGender ? 0 : 7)) {
					this.designKits[var2] = var3;
					break;
				}
			}
		}
	}

	@ObfuscatedName("client.k(I)V")
	public void drawSidebar() {
		this.areaSidebar.bind();
		Pix3D.scanline = this.areaSidebarOffset;
		this.imageInvback.plotSprite(0, 0);
		if (this.sideLayerId != -1) {
			this.drawLayer(0, IfType.list[this.sideLayerId], 0, 0);
		} else if (this.tabInterfaceId[this.sideTab] != -1) {
			this.drawLayer(0, IfType.list[this.tabInterfaceId[this.sideTab]], 0, 0);
		}
		if (this.menuVisible && this.menuArea == 1) {
			this.drawMenu();
		}
		this.areaSidebar.draw(205, 553, super.graphics);
		this.areaViewport.bind();
		Pix3D.scanline = this.areaViewportOffset;
	}

	@ObfuscatedName("client.H(I)V")
	public void drawChat() {
		this.areaChatback.bind();
		Pix3D.scanline = this.areaChatbackOffset;
		this.imageChatback.plotSprite(0, 0);
		if (this.showSocialInput) {
			this.fontBold12.centreString(40, this.socialMessage, 239, 0);
			this.fontBold12.centreString(60, this.socialInput + "*", 239, 128);
		} else if (this.chatbackInputOpen) {
			this.fontBold12.centreString(40, "Enter amount:", 239, 0);
			this.fontBold12.centreString(60, this.chatbackInput + "*", 239, 128);
		} else if (this.modalMessage != null) {
			this.fontBold12.centreString(40, this.modalMessage, 239, 0);
			this.fontBold12.centreString(60, "Click to continue", 239, 128);
		} else if (this.chatLayerId != -1) {
			this.drawLayer(0, IfType.list[this.chatLayerId], 0, 0);
		} else if (this.tutLayerId != -1) {
			this.drawLayer(0, IfType.list[this.tutLayerId], 0, 0);
		} else {
			PixFont var2 = this.fontPlain12;
			int var3 = 0;
			Pix2D.setClipping(463, 0, 77, 0);
			for (int var4 = 0; var4 < 100; var4++) {
				if (this.messageText[var4] != null) {
					int var5 = this.messageType[var4];
					int var6 = 70 - var3 * 14 + this.chatScrollOffset;
					String var7 = this.messageSender[var4];
					byte var8 = 0;
					if (var7 != null && var7.startsWith("@cr1@")) {
						var7 = var7.substring(5);
						var8 = 1;
					}
					if (var7 != null && var7.startsWith("@cr2@")) {
						var7 = var7.substring(5);
						var8 = 2;
					}
					if (var5 == 0) {
						if (var6 > 0 && var6 < 110) {
							var2.drawStringTag(false, this.messageText[var4], var6, 0, 4);
						}
						var3++;
					}
					if ((var5 == 1 || var5 == 2) && (var5 == 1 || this.chatPublicMode == 0 || this.chatPublicMode == 1 && this.isFriend(var7))) {
						if (var6 > 0 && var6 < 110) {
							int var9 = 4;
							if (var8 == 1) {
								this.imageModIcons[0].plotSprite(var9, var6 - 12);
								var9 += 14;
							}
							if (var8 == 2) {
								this.imageModIcons[1].plotSprite(var9, var6 - 12);
								var9 += 14;
							}
							var2.drawString(0, var9, var6, var7 + ":");
							int var10 = var9 + var2.stringWid(var7) + 8;
							var2.drawString(255, var10, var6, this.messageText[var4]);
						}
						var3++;
					}
					if ((var5 == 3 || var5 == 7) && this.splitPrivateChat == 0 && (var5 == 7 || this.chatPrivateMode == 0 || this.chatPrivateMode == 1 && this.isFriend(var7))) {
						if (var6 > 0 && var6 < 110) {
							byte var11 = 4;
							var2.drawString(0, var11, var6, "From");
							int var12 = var11 + var2.stringWid("From ");
							if (var8 == 1) {
								this.imageModIcons[0].plotSprite(var12, var6 - 12);
								var12 += 14;
							}
							if (var8 == 2) {
								this.imageModIcons[1].plotSprite(var12, var6 - 12);
								var12 += 14;
							}
							var2.drawString(0, var12, var6, var7 + ":");
							int var13 = var12 + var2.stringWid(var7) + 8;
							var2.drawString(8388608, var13, var6, this.messageText[var4]);
						}
						var3++;
					}
					if (var5 == 4 && (this.chatTradeMode == 0 || this.chatTradeMode == 1 && this.isFriend(var7))) {
						if (var6 > 0 && var6 < 110) {
							var2.drawString(8388736, 4, var6, var7 + " " + this.messageText[var4]);
						}
						var3++;
					}
					if (var5 == 5 && this.splitPrivateChat == 0 && this.chatPrivateMode < 2) {
						if (var6 > 0 && var6 < 110) {
							var2.drawString(8388608, 4, var6, this.messageText[var4]);
						}
						var3++;
					}
					if (var5 == 6 && this.splitPrivateChat == 0 && this.chatPrivateMode < 2) {
						if (var6 > 0 && var6 < 110) {
							var2.drawString(0, 4, var6, "To " + var7 + ":");
							var2.drawString(8388608, var2.stringWid("To " + var7) + 12, var6, this.messageText[var4]);
						}
						var3++;
					}
					if (var5 == 8 && (this.chatTradeMode == 0 || this.chatTradeMode == 1 && this.isFriend(var7))) {
						if (var6 > 0 && var6 < 110) {
							var2.drawString(8270336, 4, var6, var7 + " " + this.messageText[var4]);
						}
						var3++;
					}
				}
			}
			Pix2D.resetClipping();
			this.chatScrollHeight = var3 * 14 + 7;
			if (this.chatScrollHeight < 78) {
				this.chatScrollHeight = 78;
			}
			this.drawScrollbar(77, this.chatScrollHeight, 463, this.chatScrollHeight - this.chatScrollOffset - 77, 0);
			String var14;
			if (localPlayer == null || localPlayer.name == null) {
				var14 = JString.formatDisplayName(this.loginUser);
			} else {
				var14 = localPlayer.name;
			}
			var2.drawString(0, 4, 90, var14 + ":");
			var2.drawString(255, var2.stringWid(var14 + ": ") + 6, 90, this.chatTyped + "*");
			Pix2D.hline(0, 77, 0, 479);
		}
		if (this.menuVisible && this.menuArea == 2) {
			this.drawMenu();
		}
		this.areaChatback.draw(357, 17, super.graphics);
		this.areaViewport.bind();
		Pix3D.scanline = this.areaViewportOffset;
	}

	@ObfuscatedName("client.h(B)V")
	public void drawMinimap() {
		this.areaMapback.bind();
		int var2 = this.orbitCameraYaw + this.macroMinimapAngle & 0x7FF;
		int var3 = localPlayer.x / 32 + 48;
		boolean var4 = false;
		int var5 = 464 - localPlayer.z / 32;
		this.imageMinimap.scanlineRotatePlotSprite(146, this.minimapMaskLineOffsets, this.macroMinimapZoom + 256, this.minimapMaskLineLengths, 25, var3, 151, 5, var5, var2);
		this.imageCompass.scanlineRotatePlotSprite(33, this.compassMaskLineOffsets, 256, this.compassMaskLineLengths, 0, 25, 33, 0, 25, this.orbitCameraYaw);
		for (int var6 = 0; var6 < this.activeMapFunctionCount; var6++) {
			int var7 = this.activeMapFunctionX[var6] * 4 + 2 - localPlayer.x / 32;
			int var8 = this.activeMapFunctionZ[var6] * 4 + 2 - localPlayer.z / 32;
			this.drawOnMinimap(this.activeMapFunctions[var6], var8, var7);
		}
		for (int var9 = 0; var9 < 104; var9++) {
			for (int var10 = 0; var10 < 104; var10++) {
				LinkList var11 = this.objStacks[this.minusedlevel][var9][var10];
				if (var11 != null) {
					int var12 = var9 * 4 + 2 - localPlayer.x / 32;
					int var13 = var10 * 4 + 2 - localPlayer.z / 32;
					this.drawOnMinimap(this.imageMapdot0, var13, var12);
				}
			}
		}
		for (int var14 = 0; var14 < this.npcCount; var14++) {
			ClientNpc var15 = this.npcs[this.npcIds[var14]];
			if (var15 != null && var15.isReady() && var15.type.minimap) {
				int var16 = var15.x / 32 - localPlayer.x / 32;
				int var17 = var15.z / 32 - localPlayer.z / 32;
				this.drawOnMinimap(this.imageMapdot1, var17, var16);
			}
		}
		for (int var18 = 0; var18 < this.playerCount; var18++) {
			ClientPlayer var19 = this.players[this.playerIds[var18]];
			if (var19 != null && var19.isReady()) {
				int var20 = var19.x / 32 - localPlayer.x / 32;
				int var21 = var19.z / 32 - localPlayer.z / 32;
				boolean var22 = false;
				long var23 = JString.toBase37(var19.name);
				for (int var25 = 0; var25 < this.friendCount; var25++) {
					if (var23 == this.friendName37[var25] && this.friendWorld[var25] != 0) {
						var22 = true;
						break;
					}
				}
				if (var22) {
					this.drawOnMinimap(this.imageMapdot3, var21, var20);
				} else {
					this.drawOnMinimap(this.imageMapdot2, var21, var20);
				}
			}
		}
		if (this.hintType != 0 && loopCycle % 20 < 10) {
			if (this.hintType == 1 && this.hintNpc >= 0 && this.hintNpc < this.npcs.length) {
				ClientNpc var26 = this.npcs[this.hintNpc];
				if (var26 != null) {
					int var27 = var26.x / 32 - localPlayer.x / 32;
					int var28 = var26.z / 32 - localPlayer.z / 32;
					this.drawMinimapHint(this.imageMapmarker1, var27, var28);
				}
			}
			if (this.hintType == 2) {
				int var29 = (this.hintTileX - this.sceneBaseTileX) * 4 + 2 - localPlayer.x / 32;
				int var30 = (this.hintTileZ - this.sceneBaseTileZ) * 4 + 2 - localPlayer.z / 32;
				this.drawMinimapHint(this.imageMapmarker1, var29, var30);
			}
			if (this.hintType == 10 && this.hintPlayer >= 0 && this.hintPlayer < this.players.length) {
				ClientPlayer var31 = this.players[this.hintPlayer];
				if (var31 != null) {
					int var32 = var31.x / 32 - localPlayer.x / 32;
					int var33 = var31.z / 32 - localPlayer.z / 32;
					this.drawMinimapHint(this.imageMapmarker1, var32, var33);
				}
			}
		}
		if (this.flagSceneTileX != 0) {
			int var34 = this.flagSceneTileX * 4 + 2 - localPlayer.x / 32;
			int var35 = this.flagSceneTileZ * 4 + 2 - localPlayer.z / 32;
			this.drawOnMinimap(this.imageMapmarker0, var35, var34);
		}
		Pix2D.fillRect(3, 3, 97, 78, 16777215);
		this.areaViewport.bind();
	}

	@ObfuscatedName("client.b(Ljb;III)V")
	public void drawMinimapHint(Pix32 arg0, int arg1, int arg2) {
		int var6 = arg1 * arg1 + arg2 * arg2;
		if (var6 <= 4225 || var6 >= 90000) {
			this.drawOnMinimap(arg0, arg2, arg1);
			return;
		}
		int var7 = this.orbitCameraYaw + this.macroMinimapAngle & 0x7FF;
		int var8 = Model.sinTable[var7];
		int var9 = Model.cosTable[var7];
		int var10 = var8 * 256 / (this.macroMinimapZoom + 256);
		int var11 = var9 * 256 / (this.macroMinimapZoom + 256);
		int var12 = arg2 * var10 + arg1 * var11 >> 16;
		int var13 = arg2 * var11 - arg1 * var10 >> 16;
		double var14 = Math.atan2((double) var12, (double) var13);
		int var16 = (int) (Math.sin(var14) * 63.0D);
		int var17 = (int) (Math.cos(var14) * 57.0D);
		this.imageMapedge.rotatePlotSprite(83 - var17 - 20, 20, 256, 15, var16 + 94 + 4 - 10, 20, var14, 15);
	}

	@ObfuscatedName("client.a(Ljb;III)V")
	public void drawOnMinimap(Pix32 arg0, int arg2, int arg3) {
		int var5 = this.orbitCameraYaw + this.macroMinimapAngle & 0x7FF;
		int var6 = arg3 * arg3 + arg2 * arg2;
		if (var6 > 6400) {
			return;
		}
		int var7 = Model.sinTable[var5];
		int var8 = Model.cosTable[var5];
		int var9 = var7 * 256 / (this.macroMinimapZoom + 256);
		int var10 = var8 * 256 / (this.macroMinimapZoom + 256);
		int var11 = arg2 * var9 + arg3 * var10 >> 16;
		int var12 = arg2 * var10 - arg3 * var9 >> 16;
		if (var6 > 2500) {
			arg0.scanlinePlotSprite(this.imageMapback, 83 - var12 - arg0.ohi / 2 - 4, var11 + 94 - arg0.owi / 2 + 4);
		} else {
			arg0.plotSprite(var11 + 94 - arg0.owi / 2 + 4, 83 - var12 - arg0.ohi / 2 - 4);
		}
	}

	@ObfuscatedName("client.a(Ljava/lang/String;IILjava/lang/String;)V")
	public void addChat(String arg0, int arg1, String arg3) {
		if (arg1 == 0 && this.tutLayerId != -1) {
			this.modalMessage = arg3;
			super.mouseClickButton = 0;
		}
		if (this.chatLayerId == -1) {
			this.redrawChatback = true;
		}
		for (int var5 = 99; var5 > 0; var5--) {
			this.messageType[var5] = this.messageType[var5 - 1];
			this.messageSender[var5] = this.messageSender[var5 - 1];
			this.messageText[var5] = this.messageText[var5 - 1];
		}
		this.messageType[0] = arg1;
		this.messageSender[0] = arg0;
		this.messageText[0] = arg3;
	}

	@ObfuscatedName("client.a(Ljava/lang/String;B)Z")
	public boolean isFriend(String arg0) {
		if (arg0 == null) {
			return false;
		}
		for (int var3 = 0; var3 < this.friendCount; var3++) {
			if (arg0.equalsIgnoreCase(this.friendName[var3])) {
				return true;
			}
		}
		return arg0.equalsIgnoreCase(localPlayer.name);
	}

	@ObfuscatedName("client.a(JB)V")
	public void addFriend(long arg0) {
		if (arg0 == 0L) {
			return;
		}
		if (this.friendCount >= 100 && this.membersAccount != 1) {
			this.addChat("", 0, "Your friendlist is full. Max of 100 for free users, and 200 for members");
		} else if (this.friendCount >= 200) {
			this.addChat("", 0, "Your friendlist is full. Max of 100 for free users, and 200 for members");
		} else {
			String var4 = JString.formatDisplayName(JString.fromBase37(arg0));
			for (int var5 = 0; var5 < this.friendCount; var5++) {
				if (this.friendName37[var5] == arg0) {
					this.addChat("", 0, var4 + " is already on your friend list");
					return;
				}
			}
			for (int var6 = 0; var6 < this.ignoreCount; var6++) {
				if (this.ignoreName37[var6] == arg0) {
					this.addChat("", 0, "Please remove " + var4 + " from your ignore list first");
					return;
				}
			}
			if (!var4.equals(localPlayer.name)) {
				this.friendName[this.friendCount] = var4;
				this.friendName37[this.friendCount] = arg0;
				this.friendWorld[this.friendCount] = 0;
				this.friendCount++;
				this.redrawSidebar = true;
				// FRIENDLIST_ADD
				this.out.pIsaac(9);
				this.out.p8(arg0);
			}
		}
	}

	@ObfuscatedName("client.a(JZ)V")
	public void delFriend(long arg0) {
		if (arg0 == 0L) {
			return;
		}
		for (int var4 = 0; var4 < this.friendCount; var4++) {
			if (this.friendName37[var4] == arg0) {
				this.friendCount--;
				this.redrawSidebar = true;
				for (int var5 = var4; var5 < this.friendCount; var5++) {
					this.friendName[var5] = this.friendName[var5 + 1];
					this.friendWorld[var5] = this.friendWorld[var5 + 1];
					this.friendName37[var5] = this.friendName37[var5 + 1];
				}
				// FRIENDLIST_DEL
				this.out.pIsaac(84);
				this.out.p8(arg0);
				break;
			}
		}
	}

	@ObfuscatedName("client.b(JI)V")
	public void addIgnore(long arg0) {
		if (arg0 == 0L) {
			return;
		}
		if (this.ignoreCount >= 100) {
			this.addChat("", 0, "Your ignore list is full. Max of 100 hit");
			return;
		}
		String var4 = JString.formatDisplayName(JString.fromBase37(arg0));
		for (int var5 = 0; var5 < this.ignoreCount; var5++) {
			if (this.ignoreName37[var5] == arg0) {
				this.addChat("", 0, var4 + " is already on your ignore list");
				return;
			}
		}
		for (int var6 = 0; var6 < this.friendCount; var6++) {
			if (this.friendName37[var6] == arg0) {
				this.addChat("", 0, "Please remove " + var4 + " from your friend list first");
				return;
			}
		}
		this.ignoreName37[this.ignoreCount++] = arg0;
		this.redrawSidebar = true;
		// IGNORELIST_ADD
		this.out.pIsaac(189);
		this.out.p8(arg0);
	}

	@ObfuscatedName("client.a(JI)V")
	public void delIgnore(long arg0) {
		if (arg0 == 0L) {
			return;
		}
		for (int var4 = 0; var4 < this.ignoreCount; var4++) {
			if (this.ignoreName37[var4] == arg0) {
				this.ignoreCount--;
				this.redrawSidebar = true;
				for (int var5 = var4; var5 < this.ignoreCount; var5++) {
					this.ignoreName37[var5] = this.ignoreName37[var5 + 1];
				}
				// IGNORELIST_DEL
				this.out.pIsaac(193);
				this.out.p8(arg0);
				break;
			}
		}
	}

	@ObfuscatedName("client.K(I)V")
	public void unloadTitle() {
		this.flameActive = false;
		while (this.flameThread) {
			this.flameActive = false;
			try {
				Thread.sleep(50L);
			} catch (Exception var2) {
			}
		}
		this.imageTitlebox = null;
		this.imageTitlebutton = null;
		this.imageRunes = null;
		this.flameGradient = null;
		this.flameGradient0 = null;
		this.flameGradient1 = null;
		this.flameGradient2 = null;
		this.flameBuffer0 = null;
		this.flameBuffer1 = null;
		this.flameBuffer2 = null;
		this.flameBuffer3 = null;
		this.imageFlamesLeft = null;
		this.imageFlamesRight = null;
	}

	// ----

	@ObfuscatedName("client.C(I)V")
	public void renderFlames() {
		this.flameThread = true;
		try {
			long var2 = System.currentTimeMillis();
			int var4 = 0;
			int var5 = 20;
			while (this.flameActive) {
				this.flameCycle++;
				this.updateFlames();
				this.updateFlames();
				this.drawFlames();
				var4++;
				if (var4 > 10) {
					long var6 = System.currentTimeMillis();
					int var8 = (int) (var6 - var2) / 10 - var5;
					var5 = 40 - var8;
					if (var5 < 5) {
						var5 = 5;
					}
					var4 = 0;
					var2 = var6;
				}
				try {
					Thread.sleep((long) var5);
				} catch (Exception var9) {
				}
			}
		} catch (Exception var10) {
		}
		this.flameThread = false;
	}

	@ObfuscatedName("client.z(I)V")
	public void updateFlames() {
		short var2 = 256;
		for (int var3 = 10; var3 < 117; var3++) {
			int var4 = (int) (Math.random() * 100.0D);
			if (var4 < 50) {
				this.flameBuffer2[var3 + (var2 - 2 << 7)] = 255;
			}
		}
		for (int var5 = 0; var5 < 100; var5++) {
			int var6 = (int) (Math.random() * 124.0D) + 2;
			int var7 = (int) (Math.random() * 128.0D) + 128;
			int var8 = var6 + (var7 << 7);
			this.flameBuffer2[var8] = 192;
		}
		for (int var9 = 1; var9 < var2 - 1; var9++) {
			for (int var10 = 1; var10 < 127; var10++) {
				int var11 = var10 + (var9 << 7);
				this.flameBuffer3[var11] = (this.flameBuffer2[var11 - 1] + this.flameBuffer2[var11 + 1] + this.flameBuffer2[var11 - 128] + this.flameBuffer2[var11 + 128]) / 4;
			}
		}
		this.flameCycle0 += 128;
		if (this.flameCycle0 > this.flameBuffer0.length) {
			this.flameCycle0 -= this.flameBuffer0.length;
			int var12 = (int) (Math.random() * 12.0D);
			this.updateFlameBuffer(this.imageRunes[var12]);
		}
		for (int var13 = 1; var13 < var2 - 1; var13++) {
			for (int var14 = 1; var14 < 127; var14++) {
				int var15 = var14 + (var13 << 7);
				int var16 = this.flameBuffer3[var15 + 128] - this.flameBuffer0[var15 + this.flameCycle0 & this.flameBuffer0.length - 1] / 5;
				if (var16 < 0) {
					var16 = 0;
				}
				this.flameBuffer2[var15] = var16;
			}
		}
		for (int var17 = 0; var17 < var2 - 1; var17++) {
			this.flameLineOffset[var17] = this.flameLineOffset[var17 + 1];
		}
		this.flameLineOffset[var2 - 1] = (int) (Math.sin((double) loopCycle / 14.0D) * 16.0D + Math.sin((double) loopCycle / 15.0D) * 14.0D + Math.sin((double) loopCycle / 16.0D) * 12.0D);
		if (this.flameGradientCycle0 > 0) {
			this.flameGradientCycle0 -= 4;
		}
		if (this.flameGradientCycle1 > 0) {
			this.flameGradientCycle1 -= 4;
		}
		if (this.flameGradientCycle0 == 0 && this.flameGradientCycle1 == 0) {
			int var18 = (int) (Math.random() * 2000.0D);
			if (var18 == 0) {
				this.flameGradientCycle0 = 1024;
			}
			if (var18 == 1) {
				this.flameGradientCycle1 = 1024;
			}
		}
	}

	@ObfuscatedName("client.a(Lkb;B)V")
	public void updateFlameBuffer(Pix8 arg0) {
		short var3 = 256;
		for (int var4 = 0; var4 < this.flameBuffer0.length; var4++) {
			this.flameBuffer0[var4] = 0;
		}
		for (int var5 = 0; var5 < 5000; var5++) {
			int var6 = (int) (Math.random() * 128.0D * (double) var3);
			this.flameBuffer0[var6] = (int) (Math.random() * 256.0D);
		}
		for (int var7 = 0; var7 < 20; var7++) {
			for (int var8 = 1; var8 < var3 - 1; var8++) {
				for (int var9 = 1; var9 < 127; var9++) {
					int var10 = var9 + (var8 << 7);
					this.flameBuffer1[var10] = (this.flameBuffer0[var10 - 1] + this.flameBuffer0[var10 + 1] + this.flameBuffer0[var10 - 128] + this.flameBuffer0[var10 + 128]) / 4;
				}
			}
			int[] var11 = this.flameBuffer0;
			this.flameBuffer0 = this.flameBuffer1;
			this.flameBuffer1 = var11;
		}
		if (arg0 != null) {
			int var14 = 0;
			for (int var15 = 0; var15 < arg0.hi; var15++) {
				for (int var16 = 0; var16 < arg0.wi; var16++) {
					if (arg0.data[var14++] != 0) {
						int var17 = var16 + 16 + arg0.xof;
						int var18 = var15 + 16 + arg0.yof;
						int var19 = var17 + (var18 << 7);
						this.flameBuffer0[var19] = 0;
					}
				}
			}
		}
	}

	@ObfuscatedName("client.i(I)V")
	public void drawFlames() {
		short var2 = 256;
		if (this.flameGradientCycle0 > 0) {
			for (int var3 = 0; var3 < 256; var3++) {
				if (this.flameGradientCycle0 > 768) {
					this.flameGradient[var3] = this.titleFlamesMerge(this.flameGradient0[var3], 1024 - this.flameGradientCycle0, this.flameGradient1[var3]);
				} else if (this.flameGradientCycle0 > 256) {
					this.flameGradient[var3] = this.flameGradient1[var3];
				} else {
					this.flameGradient[var3] = this.titleFlamesMerge(this.flameGradient1[var3], 256 - this.flameGradientCycle0, this.flameGradient0[var3]);
				}
			}
		} else if (this.flameGradientCycle1 > 0) {
			for (int var4 = 0; var4 < 256; var4++) {
				if (this.flameGradientCycle1 > 768) {
					this.flameGradient[var4] = this.titleFlamesMerge(this.flameGradient0[var4], 1024 - this.flameGradientCycle1, this.flameGradient2[var4]);
				} else if (this.flameGradientCycle1 > 256) {
					this.flameGradient[var4] = this.flameGradient2[var4];
				} else {
					this.flameGradient[var4] = this.titleFlamesMerge(this.flameGradient2[var4], 256 - this.flameGradientCycle1, this.flameGradient0[var4]);
				}
			}
		} else {
			for (int var5 = 0; var5 < 256; var5++) {
				this.flameGradient[var5] = this.flameGradient0[var5];
			}
		}
		for (int var6 = 0; var6 < 33920; var6++) {
			this.imageTitle0.data[var6] = this.imageFlamesLeft.data[var6];
		}
		int var7 = 0;
		int var8 = 1152;
		for (int var9 = 1; var9 < var2 - 1; var9++) {
			int var10 = this.flameLineOffset[var9] * (var2 - var9) / var2;
			int var11 = var10 + 22;
			if (var11 < 0) {
				var11 = 0;
			}
			var7 += var11;
			for (int var12 = var11; var12 < 128; var12++) {
				int var13 = this.flameBuffer2[var7++];
				if (var13 == 0) {
					var8++;
				} else {
					int var15 = 256 - var13;
					int var16 = this.flameGradient[var13];
					int var17 = this.imageTitle0.data[var8];
					this.imageTitle0.data[var8++] = ((var16 & 0xFF00FF) * var13 + (var17 & 0xFF00FF) * var15 & 0xFF00FF00) + ((var16 & 0xFF00) * var13 + (var17 & 0xFF00) * var15 & 0xFF0000) >> 8;
				}
			}
			var8 += var11;
		}
		this.imageTitle0.draw(0, 0, super.graphics);
		for (int var18 = 0; var18 < 33920; var18++) {
			this.imageTitle1.data[var18] = this.imageFlamesRight.data[var18];
		}
		int var19 = 0;
		int var20 = 1176;
		for (int var21 = 1; var21 < var2 - 1; var21++) {
			int var22 = this.flameLineOffset[var21] * (var2 - var21) / var2;
			int var23 = 103 - var22;
			int var24 = var20 + var22;
			for (int var25 = 0; var25 < var23; var25++) {
				int var26 = this.flameBuffer2[var19++];
				if (var26 == 0) {
					var24++;
				} else {
					int var28 = 256 - var26;
					int var29 = this.flameGradient[var26];
					int var30 = this.imageTitle1.data[var24];
					this.imageTitle1.data[var24++] = ((var29 & 0xFF00FF) * var26 + (var30 & 0xFF00FF) * var28 & 0xFF00FF00) + ((var29 & 0xFF00) * var26 + (var30 & 0xFF00) * var28 & 0xFF0000) >> 8;
				}
			}
			var19 += 128 - var23;
			var20 = var24 + (128 - var23 - var22);
		}
		this.imageTitle1.draw(0, 637, super.graphics);
	}

	@ObfuscatedName("client.a(IZII)I")
	public int titleFlamesMerge(int arg0, int arg2, int arg3) {
		int var5 = 256 - arg2;
		return ((arg0 & 0xFF00FF) * var5 + (arg3 & 0xFF00FF) * arg2 & 0xFF00FF00) + ((arg0 & 0xFF00) * var5 + (arg3 & 0xFF00) * arg2 & 0xFF0000) >> 8;
	}
}
