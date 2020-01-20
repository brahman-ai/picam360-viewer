function VpmLoader(base_path, get_view_quaternion, callback, info_callback) {
	var m_base_path = base_path;
	var m_get_view_quaternion = get_view_quaternion;
	var m_frame_callback = callback;
	var m_info_callback = info_callback;
	var m_loaded_framecount = 0;
	var m_options = {
			"num_per_quarter" : 3,
			"fps" : 10,
			"keyframe_interval" : 1,
			"keyframe_offset" : [],
	};
	
	var m_view_quat = new THREE.Quaternion();
	var m_framecount = 0;
	var m_timer = null;
	var m_mbps = 0;
	var m_timestamp = new Date().getTime();
	var m_x_deg = 0;
	var m_y_deg = 0;

	function loadFile(path, callback, error_callbackk) {
		var req = new XMLHttpRequest();
		req.responseType = "arraybuffer";
		req.open("get", path, true);

		req.onerror = function() {
			if(error_callbackk){
				error_callbackk(req);
			}
			return;
		};
		req.onload = function() {
			if(req.status != 200){
				req.onerror();
				return;
			}
			callback(new Uint8Array(req.response));
		};
		req.send(null);
	}
	function request_new_frame(){
		if((m_framecount % m_options.keyframe_interval) == 0) {
			var q = m_get_view_quaternion();
			
			var v = new THREE.Vector3( 0, -1, 0 );
			v.applyQuaternion( q );
			v.r = Math.sqrt(v.x*v.x+v.z*v.z);
			
			var euler = {
				x:Math.atan2(v.r, -v.y),
				y:-Math.atan2(v.x, -v.z),
			};
			var x = parseInt(THREE.Math.radToDeg(euler.x));
			var y = parseInt(THREE.Math.radToDeg(euler.y));
			var p_angle = 90/m_options.num_per_quarter;
			var p = Math.round(x/p_angle);
			var _p = (p <= m_options.num_per_quarter) ? p : m_options.num_per_quarter * 2 - p;
			var split_y = (_p == 0) ? 1 : 4 * _p;
			var y_angle = 360/split_y;
			
			x = p*p_angle;
			y = Math.round(y/y_angle)*y_angle;
			x = (x+360)%360;
			y = (y+360)%360;
			if(x == 0 || x == 180) {
				y = 0;
			}
			m_x_deg = x;
			m_y_deg = y;
		}
		
		++m_framecount;
		var path = m_base_path + "/" + m_x_deg + "_" + m_y_deg + "/" + m_framecount + ".pif";
		// console.log(path);
		loadFile(path, (data) => {
			if(m_loaded_framecount == 0){
				console.log("start");
				if(m_info_callback){
					m_info_callback("sos");
				}
			}
			m_loaded_framecount++;
			
			var now = new Date().getTime();
			var elapsed = now - m_timestamp;
			var wait_ms = Math.max(1000/m_options.fps - elapsed, 33);// 30hz
																		// max
			setTimeout(()=>{
				var now = new Date().getTime();
				var elapsed = now - m_timestamp;
				elapsed = Math.max(elapsed, 1);
				{// bitrate
					var mbps = 8 * data.byteLength / elapsed / 1000;
					if(m_mbps == 0){
						m_mbps = mbps;
					}else{
						m_mbps = m_mbps*0.9+mbps*0.1;
					}
				}
				if(m_frame_callback){
					m_frame_callback(data);
				}
				m_timestamp = now;
				request_new_frame();
			}, wait_ms);
		}, (req) => {
			if(m_loaded_framecount == 0){
				console.log("not found : " + req.responseURL);
				if(m_info_callback){
					m_info_callback("not_found");
				}
			}else{
				console.log("end");
				if(m_info_callback){
					m_info_callback("eos");
				}
			}
		});
	}
	loadFile(base_path+"/config.json", (data)=>{
		var options = {};
		var txt = (new TextDecoder).decode(data);
		if (txt) {
			options = JSON.parse(txt);
		}
		m_options = Object.assign(m_options, options);
		request_new_frame();
		m_timer = setInterval(() => {
		}, 1000/m_options.fps);
	})
	
	
	var self = {
		get_bitrate_mbps : () => {
			return m_mbps;
		},
	}; // self
	return self;
}