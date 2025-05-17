'use strict';

let net = require('net');

// This file contains the event handlers for the mpv module
// These function should not be called on their own, they are just bound
// to the respective events when the module is initialized
//
// Since they need access to some member variables they have to included to
// the module itself
//
// These events are bound in the _startStop.js submodule

const events = {
	// When the MPV is closed (either quit by the user or has crashed),
	// this handler is called
	//
	// If quit by the user, the quit event is emitted, does not occur
	// when the quit() method was used

	// If crashed the crashed event is emitted and if set to auto_restart, mpv
	// is restarted right away
	//
	// Event: close
	closeHandler: function (error_code) {
		// Clear all the listeners of this module
		this.mpvPlayer.removeAllListeners('close');
		this.mpvPlayer.removeAllListeners('error');
		this.mpvPlayer.removeAllListeners('message');
		clearInterval(this.timepositionListenerId);

		// destroy the socket because a new one will be created
		if (this.socket && this.socket.socket && !this.socket.socket.destroyed) {
			this.socket.socket.destroy();
		}


		// unset the running flag
		this.running = false;

		// check the error code
		switch (error_code) {
			// quit by the user on purpose
			case 0:
				this.emit('quit');
				if(this.options.debug || this.options.verbose){
					console.log('[Node-MPV]: MPV was quit by the user.');
				}
				break;
			// crashed
			case 4: // This error code might vary or not be reliable for crashes
			case 1: // Often a generic error code when process exits non-zero
			case null: // Can happen if process is killed externally
			default: // Treat other non-zero or null as potential crashes for restart logic
				if (error_code !== 0 && this.options.auto_restart) { // Only restart if not a clean quit (0)
					if(this.options.debug || this.options.verbose){
						console.log(`[Node-MPV]: MPV Player exited with code ${error_code}, attempting to restart (auto_restart enabled).`);
					}
					this.start()
					.then(() => {
						this.emit('crashed'); // Emit crashed even on successful restart
						if(this.options.debug || this.options.verbose){
							console.log('[Node-MPV]: Restarted MPV Player after exit/crash.');
						}
					})
					.catch((error) => {
						console.log('[Node-MPV]: Error restarting MPV Player after exit/crash:', error);
					});
				} else if (error_code !== 0) { // Crashed but auto_restart is false
					this.emit('crashed');
					if(this.options.debug || this.options.verbose){
						console.log(`[Node-MPV]: MPV Player exited with code ${error_code} (auto_restart disabled).`);
					}
				} else if (error_code !== 0 && !this.options.auto_restart) {
                    this.emit('crashed');
                     if(this.options.debug || this.options.verbose){
                        console.log('[Node-MPV]: MPV Player has crashed (auto_restart disabled).');
                    }
                }
				if(this.options.debug || this.options.verbose && error_code !== 0 && error_code !== 4){
					console.log('[Node-MPV]: MPV player was terminated with an unknown or non-crash error code: ' + error_code);
				}
				break;
		}
	},
	// When ever an error is called from the MPV child process it is reported here
	//
	// @param error {Object}
	// Error object sent by MPV
	//
	// Event: error
	errorHandler: function (error) {
		if(this.options.debug){
			console.log('[Node-MPV] Child Process Error:', error);
		}
		// Optionally, emit an error event for the application to handle
		this.emit('error', error);
	},
	// Parses the messages emittet from the ipcInterface. They are all JSON objects
	// sent directly by MPV
	messageHandler: function (message) {
		if('event' in message){
			switch(message.event) {
				case 'idle':
					if(this.options.verbose){console.log('[Node-MPV]: Event: idle (triggers stopped)')};
					this.emit('stopped');
					break;
				case 'end-file':
					if(this.options.verbose){console.log('[Node-MPV]: Event: end-file, reason:', message.reason, 'Error:', message.error)};
					if (message.reason === 'eof') {
						this.emit('playback-finished', { reason: 'eof' });
					} else {
                        // Pass the reason and error (if any) to the stopped event
						this.emit('stopped', { reason: message.reason, error: message.file_error || message.error });
					}
					break;
				case 'file-loaded': // This event signifies a new file has been loaded and is ready
					if(this.options.verbose){console.log('[Node-MPV]: Event: file-loaded (triggers started)')};
					this.emit('started'); // 'started' is more semantically correct here than playback-restart for a new file
					break;
				case 'playback-restart': // This happens on unpause or seek
					if(this.options.verbose){console.log('[Node-MPV]: Event: playback-restart (triggers resumed or seek completion)')};
					// This event is ambiguous. It can mean unpause or seek completion.
					// 'resumed' is emitted by 'unpause' event.
					// 'seek' event handles its own 'playback-restart' for completion.
					// So, we might not need to emit a generic 'started' here if other events cover it.
					// However, if it's used as a general "playback has (re)commenced", emit 'resumed'.
                    if (!this.seeking) { // If not currently in a seek operation handled by 'seek' event
                        this.emit('resumed');
                    }
					break;
				case 'pause':
					if(this.options.verbose){console.log('[Node-MPV]: Event: pause (triggers paused)')};
					this.emit('paused');
					break;
				case 'unpause':
					if(this.options.verbose){console.log('[Node-MPV]: Event: unpause (triggers resumed)')};
					this.emit('resumed');
					break;
				case 'seek':
					if(this.options.verbose){console.log('[Node-MPV]: Event: seek (start of seek)')};
                    this.seeking = true; // Mark that a seek operation has started
					const observeSocketOnSeek = new net.Socket();
					let seekstarttimepos = this.currentTimePos;
					let seekTimeout = 0;
					new Promise((resolve, reject) => {
						observeSocketOnSeek.on('error', (error) => {
							observeSocketOnSeek.destroy();
							return reject(this.errorHandler.errorMessage(10, `Socket error during seek observation: ${error.message}`, 'messageHandler(seek)'));
						});
						observeSocketOnSeek.connect({path: this.options.socket}, () =>{
							observeSocketOnSeek.on('data', (data) => {
								seekTimeout += 1;
								let messages = data.toString('utf-8').split('\n');
								messages.forEach((msgStr) => {
									if(msgStr.length > 0){
										const msg = JSON.parse(msgStr);
										if('event' in msg){
											if(msg.event === 'playback-restart'){ // Seek operation finished
												resolve({
													start: seekstarttimepos,
													end: this.currentTimePos // currentTimePos should be updated by 'time-pos' property change
												});
											}
											else if (msg.event === 'tracks-changed'){ // Should not happen during normal seek
												reject('Track changed during seek');
											}
										}
									}
								});
								if(seekTimeout > 20){ // Increased timeout slightly
									reject('Seek event timeout (no playback-restart)');
								}
							});
						});
					})
					.then((times) => {
						observeSocketOnSeek.destroy();
                        this.seeking = false;
						this.emit('seek', (times));
					})
					.catch((status) => {
						observeSocketOnSeek.destroy();
                        this.seeking = false;
						if(this.options.debug){
							console.log('[Node-MPV]: Seek event promise rejected/errored:', status);
						}
					});
					break;
				case 'property-change':
					if(message.name === 'time-pos'){
						this.currentTimePos = message.data;
					}
					this.emit('status', {
						'property': message.name,
						'value': message.data
					});
					if(this.options.verbose && message.name !== 'time-pos' && message.name !== 'idle-active' && message.name !== 'eof-reached'){ // Reduce noise
						 console.log('[Node-MPV]: Property change: ' + message.name + ' - ' + JSON.stringify(message.data));
					}
					break;
				default:
					if(this.options.verbose) {console.log('[Node-MPV]: Unhandled MPV event:', message.event, message)};
					break;
			}
		} else if (message.error && message.request_id === undefined) {
            // Asynchronous error from MPV not tied to a request
            if(this.options.debug){
                console.log('[Node-MPV]: Asynchronous MPV Error:', message.error);
            }
            this.emit('error', new Error(`MPV Error: ${message.error}`));
        }
	}
}

module.exports = events;
