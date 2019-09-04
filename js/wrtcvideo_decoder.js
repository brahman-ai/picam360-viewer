function WRTCVideoDecoder(callback) {
	var m_active_frame = null;
	var m_frame_callback = null;

	var m_frame_info_ary = [];
	var m_frame_ary = [];

	var m_image_capture = null;
	var m_video = null;
	var m_videoImage = null;
	var m_videoImageContext = null;
	var m_receiver = null;
	var m_need_to_push = null;
	
	function GetQueryString() {
		var result = {};
		if (1 < window.location.search.length) {
			var query = window.location.search.substring(1);
			var parameters = query.split('&');

			for (var i = 0; i < parameters.length; i++) {
				var element = parameters[i].split('=');

				var paramName = decodeURIComponent(element[0]);
				var paramValue = decodeURIComponent(element[1]);

				result[paramName] = paramValue;
			}
		}
		return result;
	}
	var query = GetQueryString();

	var m_is_init = false;
	var m_first_frame_info = false;
	var m_can_play = false;
	var info = {};
	var packet_pool = [];

	var self = {
		set_frame_callback: function(callback) {
			m_frame_callback = callback;
		},
		// @data : Uint8Array
		decode: function(data) {
			if (!m_active_frame) {
				if (data[0] == 0x49 && data[1] == 0x34) { // SOI
					if (data.length > 2) {
						m_active_frame = [new Uint8Array(data.buffer, data.byteOffset + 2)];
					} else {
						m_active_frame = [];
					}
				}
			} else {
				if (data.length != 2) {
					m_active_frame.push(data);
				}
			}
			if (m_active_frame &&
				(data[data.length - 2] == 0x32 && data[data.length - 1] == 0x30)) { // EOI
				try {
					var nal_type = 0;
					var nal_len = 0;
					var _nal_len = 0;
					if (((m_active_frame[0][4] & 0x7e) >> 1) == 40) { // sei
						var str = String.fromCharCode.apply("", m_active_frame[0]
							.subarray(4), 0);
						var split = str.split(' ');
						var uuid = null;
						for (var i = 0; i < split.length; i++) {
							var separator = (/[=,\"]/);
							var _split = split[i].split(separator);
							if (_split[0] == "uuid") {
								uuid = _split[2];
							}
						}
						if (!uuid) {
							return;
						}
						if (m_frame_callback) {
							m_frame_callback("frame_info", null, 0, 0,
								str, new Date().getTime());
						}
//						self.new_frame_info_handler({
//							info: str,
//							time: new Date().getTime(),
//							uuid: uuidParse.parse(uuid),
//						});
//						if (!m_first_frame_info) {
//							m_first_frame_info = true;
//							self.init();
//						}
					}
				} finally {
					m_active_frame = null;
				}
			} // if
		}, // decode
	}; // self
	return self;
}