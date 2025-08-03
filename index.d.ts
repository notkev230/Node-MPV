// Type definitions for node-mpv 2.0-beta.3 (customized)
// Project: node-mpv <https://github.com/j-holub/Node-MPV>
// Definitions by: leonekmi <me@leonekmi.fr>
// Customized by: Your Name / Project

import EventEmitter = NodeJS.EventEmitter;

interface NodeMpvOptions {
	debug?: boolean;
	verbose?: boolean;
	socket?: string;
	audio_only?: boolean;
	auto_restart?: boolean;
	time_update?: number;
	binary?: string | null; // Changed from string to string | null
    ipcCommand?: '--input-unix-socket' | '--input-ipc-server' | null; // Added ipcCommand
    force_window?: boolean; // Force creation of a video output window
    [key: string]: any; // Allow other mpv options
}


interface StatusObject { // Renamed from Status for clarity
	property: string; // All status changes come via this property
	value: any;
}

interface PlaybackFinishedEvent {
    reason: 'eof';
    [key: string]: any;
}

interface StoppedEventData {
    reason?: 'eof' | 'stop' | 'quit' | 'error' | string; // From end-file or general stop
    error?: string | number; // mpv file_error or other error string/code
}

interface SeekEventData {
    start: number;
    end: number;
}

type EventNames =
	| "crashed"
	// | "getrequest" // Deprecated in v2
	| "seek"
	| "started" // Signifies a new file has loaded and is ready/starting
	| "stopped" // Player has stopped (idle, or explicit stop, or error)
	| "paused"
	| "resumed" // Playback has resumed from pause or started after loading
	| "status" // Generic property change
	| "timeposition" // Emitted by node-mpv at time_update interval
	| "quit" // User quit MPV externally
    | "error" // Errors from node-mpv or mpv process itself
    | "playback-finished"; // New: For clean end-of-file

type VoidCallback = () => void;
type VoidCallbackWithData<ArgType> = (arg: ArgType) => void;

export default class NodeMpv extends EventEmitter {
	constructor(options?: NodeMpvOptions, mpv_args?: string[]);

    // Start/Stop
	start(): Promise<void>;
	quit(): Promise<void>;
	isRunning(): boolean;

    // Load Content
	load(source: string, mode?: "replace" | "append" | "append-play", options?: string[]): Promise<void>;

    // Controls
	play(): Promise<void>;
	stop(): Promise<void>;
	pause(): Promise<void>;
	resume(): Promise<void>;
	togglePause(): Promise<void>;
	mute(set?: boolean): Promise<void>;
	volume(volumeLevel: number): Promise<void>; // 0-100
	adjustVolume(value: number): Promise<void>;
	seek(seconds: number, mode?: "relative" | "absolute" | "absolute-percent" | "relative-percent" | "keyframes" | "exact"): Promise<void>;
	goToPosition(seconds: number): Promise<void>;
	loop(times?: number | "inf" | "no"): Promise<void>;
    speed(scale: number): Promise<void>; // 0.01-100

    // Information
	isMuted(): Promise<boolean>;
	isPaused(): Promise<boolean>;
	isSeekable(): Promise<boolean>;
	getDuration(): Promise<number | null>; // Can be null for streams
	getTimePosition(): Promise<number | null>; // Can be null
	getPercentPosition(): Promise<number | null>; // Can be null
	getTimeRemaining(): Promise<number | null>; // Can be null
	getMetadata(): Promise<object | null>; // Can be null
	getArtist(): Promise<string | null>;
	getTitle(): Promise<string | null>;
	getAlbum(): Promise<string | null>;
	getYear(): Promise<number | string | null>; // Year can be string
	getFilename(mode?: "full" | "stripped"): Promise<string | null>;

    // Playlist
    loadPlaylist(playlist: string, mode?: "replace" | "append"): Promise<void>;
    append(file: string, mode?: "append" | "append-play", options?: string[]): Promise<void>;
    next(mode?: "weak" | "force"): Promise<boolean>; // Returns true if skipped, false otherwise
    prev(mode?: "weak" | "force"): Promise<boolean>;
    jump(position: number): Promise<boolean>; // True if jumped, false if not possible
    clearPlaylist(): Promise<void>;
    playlistRemove(index: number | "current"): Promise<void>;
    playlistMove(index1: number, index2: number): Promise<void>;
    shuffle(): Promise<void>;
    getPlaylistSize(): Promise<number>;
    getPlaylistPosition(): Promise<number>; // 0-based
    getPlaylistPosition1(): Promise<number>; // 1-based
    loopPlaylist(times?: number | "inf" | "no"): Promise<void>;

    // Audio
    addAudioTrack(file: string, flag?: "select" | "auto" | "cached", title?: string, lang?: string): Promise<void>;
    removeAudioTrack(id: number): Promise<void>; // ID is usually numeric
    selectAudioTrack(id: number | string): Promise<void>; // ID can be string like 'auto' or 'no'
    cycleAudioTracks(): Promise<void>;
    adjustAudioTiming(seconds: number): Promise<void>;

    // Video (keeping for completeness, though audio_only=true)
    fullscreen(): Promise<void>;
    leaveFullscreen(): Promise<void>;
    toggleFullscreen(): Promise<void>;
    screenshot(file: string, option?: "subtitles" | "video" | "window"): Promise<void>;
    rotateVideo(degrees: 0 | 90 | 180 | 270): Promise<void>;
    zoomVideo(factor: number): Promise<void>; // 0 = no zoom, 1 = 2x
    brightness(value: number): Promise<void>; // -100 to 100
    contrast(value: number): Promise<void>;
    saturation(value: number): Promise<void>;
    gamma(value: number): Promise<void>;
    hue(value: number): Promise<void>;

    // Subtitles
    addSubtitles(file: string, flag?: "select" | "auto" | "cached", title?: string, lang?: string): Promise<void>;
    removeSubtitles(id: number): Promise<void>; // ID is numeric
    selectSubtitles(id: number | string): Promise<void>; // ID can be string
    cycleSubtitles(): Promise<void>;
    toggleSubtitleVisibility(): Promise<void>;
    showSubtitles(): Promise<void>;
    hideSubtitles(): Promise<void>;
    adjustSubtitleTiming(seconds: number): Promise<void>;
    subtitleSeek(lines: number): Promise<void>;
    subtitleScale(scale: number): Promise<void>;
    displayASS(assMessage: string, duration: number, position?: 1|2|3|4|5|6|7|8|9): Promise<void>;

    // Properties & Commands
    setProperty(property: string, value: any): Promise<void>;
    setMultipleProperties(properties: Record<string, any>): Promise<void[]>; // Array of promises
    getProperty(property: string): Promise<any>;
    addProperty(property: string, value: number): Promise<void>;
    multiplyProperty(property: string, value: number): Promise<void>;
    cycleProperty(property: string): Promise<void>;
    command(command: string, args?: string[]): Promise<void>;
    commandJSON(commandObj: object): Promise<void>; // command is an object
    freeCommand(rawCommandString: string): Promise<void>; // Sends raw string

    // Observing
    observeProperty(property: string): Promise<void>; // Simplified in v2
    unobserveProperty(property: string): Promise<void>;

    // Event Emitter methods (ensure correct typings for your events)
	on(event: "crashed", listener: VoidCallback): this;
	on(event: "seek", listener: VoidCallbackWithData<SeekEventData>): this;
	on(event: "started", listener: VoidCallback): this;
	on(event: "stopped", listener: VoidCallbackWithData<StoppedEventData | undefined>): this; // data is optional
	on(event: "paused", listener: VoidCallback): this;
	on(event: "resumed", listener: VoidCallback): this;
	on(event: "status", listener: VoidCallbackWithData<StatusObject>): this;
	on(event: "timeposition", listener: VoidCallbackWithData<number>): this;
	on(event: "quit", listener: VoidCallback): this;
    on(event: "error", listener: VoidCallbackWithData<Error>): this;
    on(event: "playback-finished", listener: VoidCallbackWithData<PlaybackFinishedEvent>): this;
	on(event: string | symbol, listener: (...args: any[]) => void): this;


	addListener(event: "crashed", listener: VoidCallback): this;
	addListener(event: "seek", listener: VoidCallbackWithData<SeekEventData>): this;
	addListener(event: "started", listener: VoidCallback): this;
	addListener(event: "stopped", listener: VoidCallbackWithData<StoppedEventData | undefined>): this;
	addListener(event: "paused", listener: VoidCallback): this;
	addListener(event: "resumed", listener: VoidCallback): this;
	addListener(event: "status", listener: VoidCallbackWithData<StatusObject>): this;
	addListener(event: "timeposition", listener: VoidCallbackWithData<number>): this;
	addListener(event: "quit", listener: VoidCallback): this;
    addListener(event: "error", listener: VoidCallbackWithData<Error>): this;
    addListener(event: "playback-finished", listener: VoidCallbackWithData<PlaybackFinishedEvent>): this;
	addListener(event: string | symbol, listener: (...args: any[]) => void): this;

    // ... (once, off, removeListener, removeAllListeners etc. with correct typings)
    once(event: "crashed", listener: VoidCallback): this;
	once(event: "seek", listener: VoidCallbackWithData<SeekEventData>): this;
	once(event: "started", listener: VoidCallback): this;
	once(event: "stopped", listener: VoidCallbackWithData<StoppedEventData | undefined>): this;
	once(event: "paused", listener: VoidCallback): this;
	once(event: "resumed", listener: VoidCallback): this;
	once(event: "status", listener: VoidCallbackWithData<StatusObject>): this;
	once(event: "timeposition", listener: VoidCallbackWithData<number>): this;
	once(event: "quit", listener: VoidCallback): this;
    once(event: "error", listener: VoidCallbackWithData<Error>): this;
    once(event: "playback-finished", listener: VoidCallbackWithData<PlaybackFinishedEvent>): this;
	once(event: string | symbol, listener: (...args: any[]) => void): this;

    off(event: "crashed", listener: VoidCallback): this;
	off(event: "seek", listener: VoidCallbackWithData<SeekEventData>): this;
	off(event: "started", listener: VoidCallback): this;
	off(event: "stopped", listener: VoidCallbackWithData<StoppedEventData | undefined>): this;
	off(event: "paused", listener: VoidCallback): this;
	off(event: "resumed", listener: VoidCallback): this;
	off(event: "status", listener: VoidCallbackWithData<StatusObject>): this;
	off(event: "timeposition", listener: VoidCallbackWithData<number>): this;
	off(event: "quit", listener: VoidCallback): this;
    off(event: "error", listener: VoidCallbackWithData<Error>): this;
    off(event: "playback-finished", listener: VoidCallbackWithData<PlaybackFinishedEvent>): this;
	off(event: string | symbol, listener: (...args: any[]) => void): this;

    removeListener(event: "crashed", listener: VoidCallback): this;
	removeListener(event: "seek", listener: VoidCallbackWithData<SeekEventData>): this;
	removeListener(event: "started", listener: VoidCallback): this;
	removeListener(event: "stopped", listener: VoidCallbackWithData<StoppedEventData | undefined>): this;
	removeListener(event: "paused", listener: VoidCallback): this;
	removeListener(event: "resumed", listener: VoidCallback): this;
	removeListener(event: "status", listener: VoidCallbackWithData<StatusObject>): this;
	removeListener(event: "timeposition", listener: VoidCallbackWithData<number>): this;
	removeListener(event: "quit", listener: VoidCallback): this;
    removeListener(event: "error", listener: VoidCallbackWithData<Error>): this;
    removeListener(event: "playback-finished", listener: VoidCallbackWithData<PlaybackFinishedEvent>): this;
	removeListener(event: string | symbol, listener: (...args: any[]) => void): this;

    removeAllListeners(event?: EventNames): this;
}
