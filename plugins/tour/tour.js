var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;
	var FACTOR = 10;// related to stereo

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
	
	var m_query = GetQueryString();
	var m_tour = {};
	var m_active_path;
	var m_branch_meshes;
	var m_active_branch;
	
	function get_view_quat() {
		var quat = m_plugin_host.get_view_quaternion() || new THREE.Quaternion();
		var view_offset_quat = m_plugin_host.get_view_offset() || new THREE.Quaternion();
		var view_quat = view_offset_quat.multiply(quat);
		return view_quat;
	};
	function convert_to_gl_quat(quat) {
		return new THREE.Quaternion(
				 -quat._x, quat._y, -quat._z, quat._w);
	}	
	
	function init(){
		if(!m_query['tour']){
			if(m_query['vpm']){
				m_plugin_host.set_info("waiting image...");
				m_plugin_host.load_vpm(m_query['vpm']);
			}
			return;
		}
		m_plugin_host.set_info("waiting image...");
		loadFile(m_query['tour'], (data) => {
			var txt = (new TextDecoder).decode(data);
			if (txt) {
				m_tour = JSON.parse(txt);
			}
			m_active_path = 'start';
			if(m_tour.paths && m_tour.paths[m_active_path]){
				m_plugin_host.load_vpm(m_tour.paths[m_active_path].vpm_path);
			}
		});
		setInterval(()=>{
			if(!m_branch_meshes){
				return;
			}
			var active_branch;
			for(var key in m_branch_meshes) {
				var branch = m_tour.paths[m_active_path].branches[key];
				var mesh = m_branch_meshes[key];
				
				var view_quat = convert_to_gl_quat(get_view_quat());
				var view_dir = new THREE.Vector3(0, -1, 0).applyQuaternion(view_quat);
				
				var euler = new THREE.Euler(THREE.Math.degToRad(-branch.dir[0]), THREE.Math
						 .degToRad(branch.dir[1]), THREE.Math.degToRad(branch.dir[2]), "YXZ");
				var quat = new THREE.Quaternion().setFromEuler(euler);
				var dir = new THREE.Vector3(0, -1, 0).applyQuaternion(quat);
				
				var dot = dir.dot(view_dir);
				var active = false;
				if(dot > 0.9){
					active_branch = key;
					active = true;
				}
				switch(branch.effect){
				case "arrow":
					arrow_effect(branch, mesh, active);
					break;
				case "rotate":
				default:
					rotate_effect(branch, mesh, active);
					break;
				}
			}
			m_active_branch = active_branch;
		},50);
	}
	
	function arrow_effect(branch, mesh, active){
		var now = new Date().getTime();
		var euler = new THREE.Euler(THREE.Math.degToRad(-branch.dir[0]), THREE.Math
				 .degToRad(branch.dir[1]), THREE.Math.degToRad(branch.dir[2]), "YXZ");
		var quat = new THREE.Quaternion().setFromEuler(euler);
		var pos = new THREE.Vector3(0, -100*FACTOR, 0).applyQuaternion(quat);
		mesh.position.copy( pos );
		mesh.quaternion.copy( quat );
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		var euler_diff = new THREE.Euler(-Math.PI/8, 0, 0, "YXZ");
		var quat_diff = new THREE.Quaternion().setFromEuler(euler_diff);
		mesh.quaternion.multiply(quat_diff);

		if(active){
			var vec = new THREE.Vector3(0, -30*FACTOR, 0).applyQuaternion(mesh.quaternion);
			var base = pos.sub(vec);
			var k = (now%(0.5*1000))/(0.5*1000);
			pos = base.add(vec.multiplyScalar(k));
			mesh.position.copy( pos );
//			var euler_diff2 = new THREE.Euler(0, 2*Math.PI*now/1000, 0, "YXZ");
//			var quat_diff2 = new THREE.Quaternion().setFromEuler(euler_diff2);
//			mesh.quaternion.multiply(quat_diff2);
			var scale = 2*FACTOR*(branch.marker_scale||1);
			mesh.scale.set(scale, scale, scale);
			mesh.material.opacity = 0.75;
		}else{
//			var vec = new THREE.Vector3(0, -10*FACTOR, 0).applyQuaternion(mesh.quaternion);
//			var base = pos.sub(vec);
//			var k = (now%(2*1000))/(2*1000);
//			pos = base.add(vec.multiplyScalar(k));
			mesh.position.copy( pos );
			var euler_diff2 = new THREE.Euler(0, 0.5*2*Math.PI*now/1000, 0, "YXZ");
			var quat_diff2 = new THREE.Quaternion().setFromEuler(euler_diff2);
			mesh.quaternion.multiply(quat_diff2);
			var scale = FACTOR*(branch.marker_scale||1);
			mesh.scale.set(scale, scale, scale);
			mesh.material.opacity = 0.5;
		}
	}
	
	function rotate_effect(branch, mesh, active){
		var now = new Date().getTime();
		var euler = new THREE.Euler(THREE.Math.degToRad(-branch.dir[0]), THREE.Math
				 .degToRad(branch.dir[1]), THREE.Math.degToRad(branch.dir[2]), "YXZ");
		var quat = new THREE.Quaternion().setFromEuler(euler);
		var pos = new THREE.Vector3(0, -100*FACTOR, 0).applyQuaternion(quat);
		mesh.position.copy( pos );
		mesh.quaternion.copy( quat );
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		if(active){
			var euler_diff = new THREE.Euler(0, 0.2*2*Math.PI*now/1000, 0, "YXZ");
			var quat_diff = new THREE.Quaternion().setFromEuler(euler_diff);
			mesh.quaternion.multiply(quat_diff);
			var scale = 5*FACTOR*(branch.marker_scale||1);
			mesh.scale.set(scale, scale, scale);
			mesh.material.opacity = 0.75;
		}else{
			var scale = FACTOR*(branch.marker_scale||1);
			mesh.scale.set(scale, scale, scale);
			mesh.material.opacity = 0.5;
		}
	}
	
	function load_svg(url, callback){
		var loader = new THREE.SVGLoader();
		loader.load(url, function ( data ) {
			var paths = data.paths;
			var group = new THREE.Group();

			for ( var i = 0; i < paths.length; i ++ ) {

				var path = paths[ i ];

				var material = new THREE.MeshBasicMaterial( {
					color: path.color,
					side: THREE.DoubleSide,
					depthWrite: false
				} );

				var shapes = path.toShapes( true );

				for ( var j = 0; j < shapes.length; j ++ ) {

					var shape = shapes[ j ];
					var geometry = new THREE.ShapeBufferGeometry( shape );
					var mesh = new THREE.Mesh( geometry, material );
					group.add( mesh );

				}

			}
			callback(group);
		});
	}
	
	function load_stl(url, callback){
		var loader = new STLLoader();
		loader.load(url, function ( geometry ) {
			var material = new THREE.MeshPhongMaterial( { 
				transparent: true, opacity: 0.5, color: 0xffff00, specular: 0x111111, shininess: 200 } );
			var mesh = new THREE.Mesh( geometry, material );
			callback(mesh);
		});
	}
	
	function load_amf(_url, callback){
		loadFile(_url, (data) => {
			var txt = (new TextDecoder).decode(data);
			var color = [1.0, 1.0, 0.0, 0.5];
			color_tag = sprintf(
					'<color><r>%f</r><g>%f</g><b>%f</b><a>%f</a></color>',
					color[0], color[1], color[2], color[3]);
			txt = txt.replace('<object id="0">', '<object id="0">' + color_tag);
			var url = URL.createObjectURL(new Blob([txt], {
				  type: "text/plain"
			}));
			var loader = new THREE.AMFLoader();
			loader.load(url, function ( mesh ) {
				callback(mesh);
			});
		});
	}
	
	return function(plugin_host) {
		m_plugin_host = plugin_host;
		
		var plugin = {
			init_options : function(options) {
				if (!m_is_init) {
					m_is_init = true;
					init(plugin);
				}
			},
			event_handler : function(sender, event) {
				if(!m_query['tour']){
					return;
				}
				if (sender == "ICADE") {// filter
					switch (event) {
					case "UP_BUTTON_DOWN" :
						sender = "self";
						event = "select_branch";
						break;
					}
				}
				if(sender == 'mouse'){// filter
					switch(event){
					case 'double_click':
						sender = "self";
						event = "select_branch";
						break;
					}
				}
				if(sender == 'vpm_loader'){
					switch(event){
					case 'sos':
						//break;
					case 'eos':
						if(m_branch_meshes){
							return;
						}
						m_branch_meshes = {};
						for(var key in m_tour.paths[m_active_path].branches) {
							var branch = m_tour.paths[m_active_path].branches[key];
							var loader;
							if(branch.marker.endsWith(".amf")){
								loader = load_amf;
							}else if(branch.marker.endsWith(".stl")){
								loader = load_stl;
							}else if(branch.marker.endsWith(".svg")){
								loader = load_svg;
							}
							loader(branch.marker, function(mesh){
								m_branch_meshes[key] = mesh;
								m_plugin_host.add_overlay_object( mesh );
					        } );
						}
						break;
					case 'not_found':
						m_plugin_host.set_info("image not found");
						break;
					default:
						break;
					}
				}
				if(sender == 'self'){
					switch(event){
					case 'select_branch':
						if(m_active_branch){
							m_active_path = m_active_branch;
							m_active_branch = null;// wait for next eos
							if(m_tour.paths && m_tour.paths[m_active_path]){
								m_plugin_host.load_vpm(m_tour.paths[m_active_path].vpm_path);
							}
							if(m_branch_meshes){
								for(var key in m_branch_meshes) {
									m_plugin_host.remove_overlay_object( m_branch_meshes[key] );
								}
							}
							m_branch_meshes = null;
						}
						break;
					default:
						break;
					}					
				}
			},
		};
		return plugin;
	}
})();