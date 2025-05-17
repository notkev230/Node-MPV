'use strict';

// This file contains the event handlers for the ipcInterface module
// These function should not be called on their own, they are just bound
// to the respective events when the module is initialized
//
// Since they need access to some member variables they have to included to
// the module itself

const events = {
	// Thrown when the socket is closed by the other side
	// This function properly closes the socket by destroying it
	// Usually this will occur when MPV has crashed. The restarting is handled
	// by the mpv module, which will again recreate a socket
	//
	// Event: close
	closeHandler: function() {
		if(this.options.debug){
			console.log('[Node-MPV]: Socket closed on the other side. This usually occurs \
						 when MPV has crashed');
		}
		// properly close the connection
		this.socket.destroy();
	},
	// Cathces any error thrown by the socket and outputs it to the console if
	// set to debug
	//
	// @param error {Object}
	// Errorobject from the socket
	//
	// Event: error
	errHandler: function(error) {
		if(this.options.debug){
			console.log(error);
		}
	},
	// Handles the data received by MPV over the ipc socket
	// MPV messages end with the \n character, this function splits it and for
	// each message received
	//
	// Request messages sent from the module to MPV are either resolved or rejected
	// Events are sent upward to the mpv module's event handler
	//
	// @param data {String}
	// Data from the socket
	//
	// Event: data
	dataHandler: function(data) {
        let messages = data.toString().split('\n');
        messages.forEach((message) => {
            if(message.length > 0){
                try { // 添加 try-catch 包裹 JSON.parse
                    const JSONmessage = JSON.parse(message);
                    if(JSONmessage.request_id && JSONmessage.request_id !== 0 && this.ipcRequests[JSONmessage.request_id] !== undefined){ // 确保 ipcRequests 条目存在
                        if(JSONmessage.error === 'success'){
                            this.ipcRequests[JSONmessage.request_id].resolve(JSONmessage.data);
                        } else {
                            this.ipcRequests[JSONmessage.request_id].reject(JSONmessage.error);
                        }
                        delete this.ipcRequests[JSONmessage.request_id];
                    } else if (JSONmessage.event) { // 确保是事件消息
                        this.emit('message', JSONmessage); // 直接传递解析后的 JSON 对象
                    } else if (this.options.debug && !JSONmessage.request_id) {
                        // 非请求也非标准事件的消息
                        console.log('[Node-MPV IPC]: Received unhandled message structure:', JSONmessage);
                    }
                } catch (e) {
                    if (this.options.debug) {
                        console.error('[Node-MPV IPC]: Error parsing message from MPV:', message, e);
                    }
                    // 可以考虑发送一个错误事件，或者记录到更详细的日志
                }
            }
        });
    }
}

module.exports = events;
