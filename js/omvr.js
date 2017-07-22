/**
 * @author takumadx / http://www.ohmydigifab.com/
 */

function OMVR() {
	var myAttitude = {
		Pitch : 0,
		Yaw : 0,
		Roll : 0,
	};

	var vehicleAttitude = {
		Pitch : 0,
		Yaw : 0,
		Roll : 0,
	};

	var m_camera, m_scene, m_renderer, m_mesh;

	var m_window_mode = false;
	var m_canvas;
	var m_context;
	var m_effect;

	var m_videoImage;
	var m_videoImageContext;
	var m_videoTexture;
	var m_video;
	var m_videoStart = 0;

	function onWindowResize() {
		m_canvas.width = window.innerWidth;
		m_canvas.height = window.innerHeight;

		m_camera.aspect = window.innerWidth / window.innerHeight;
		m_camera.updateProjectionMatrix();

		m_renderer.setSize(window.innerWidth, window.innerHeight);
		m_effect.setSize(window.innerWidth, window.innerHeight);
	}

	function splitExt(filename) {
		return filename.split(/\.(?=[^.]+$)/);
	}

	function isSmartphone() {
		var user = "";
		if ((navigator.userAgent.indexOf('iPhone') > 0 && navigator.userAgent
			.indexOf('iPad') == -1)
			|| navigator.userAgent.indexOf('iPod') > 0
			|| navigator.userAgent.indexOf('Android') > 0) {
			return true;
		} else {
			return false;
		}
	}

	function loadFile(path, callback) {
		var req = new XMLHttpRequest();
		req.open("get", path, true);
		req.send(null);

		req.onload = function() {
			callback(req.responseText);
		}
	}

	var stereoEnabled = false;

	var self = {
		setMyAttitude : function(value) {
			myAttitude = value;
		},

		setVehicleAttitude : function(value) {
			vehicleAttitude = value;
		},

		addFisheyeCamera : function(default_image_url, imageUrl, flipX, flipY,
			image_updated_callback, attitude) {
			var geometry = new THREE.SphereGeometry(500, 100, 100, 0, Math.PI);
			geometry.scale(1, 1, 1);

			var texLoader = new THREE.TextureLoader();
			var texture = texLoader.load(default_image_url, function(tex) {
				var material = new THREE.ShaderMaterial({
					vertexShader : fisheye_vertexShader,
					fragmentShader : fisheye_fragmentShader,
					uniforms : {
						flipX : {
							type : 'i',
							value : flipX
						},
						flipY : {
							type : 'i',
							value : flipY
						},
						texture : {
							type : 't',
							value : texture
						}
					},
					side : THREE.DoubleSide,
					// 通常マテリアルのパラメータ
					blending : THREE.AdditiveBlending,
					transparent : true,
					depthTest : false
				});
				material.needsUpdate = true;
				var mesh = new THREE.Mesh(geometry, material);
				m_scene.add(mesh);

				fisheyeCameraList.push({
					loading : false,
					default_image_url : default_image_url,
					imageUrl : imageUrl,
					image_updated_callback : image_updated_callback,
					mesh : mesh,
					attitude : attitude
				});
			});
		},

		fps : 0,
		checkImageDelay : 1000,

		setTexture : function(default_image_url, default_image_type, imageUrl,
			image_type, flipX, flipY, image_updated_callback, attitude) {
			var geometry = new THREE.SphereGeometry(500, 60, 40);
			geometry.scale(-1, 1, 1);

			var maxAnisotropy = m_renderer.getMaxAnisotropy();
			var setTextureFunc = function(tex) {
				tex.generateMipmaps = false;// this is for performance
				tex.minFilter = THREE.LinearFilter;// this is for
				tex.anisotropy = maxAnisotropy;
				var material = new THREE.MeshBasicMaterial({
					map : tex
				});
				material.needsUpdate = true;
				if (m_mesh) {
					m_scene.remove(m_mesh);
					m_mesh = null;
				}
				m_mesh = new THREE.Mesh(geometry, material);
				m_scene.add(m_mesh);

				var euler_correct = new THREE.Euler(THREE.Math
					.degToRad(attitude.Pitch), THREE.Math
					.degToRad(attitude.Yaw), THREE.Math.degToRad(attitude.Roll), "YXZ");

				var quat_correct = new THREE.Quaternion();
				quat_correct.setFromEuler(euler_correct);

				var target = new THREE.Vector3(0, 0, 1);
				m_mesh.up = new THREE.Vector3(0, 1, 0);

				target.applyQuaternion(quat_correct);
				m_mesh.up.applyQuaternion(quat_correct);

				m_mesh.lookAt(target);

				m_window_mode = false;

				fisheyeCameraList.push({
					loading : false,
					default_image_url : default_image_url,
					imageUrl : imageUrl,
					image_updated_callback : image_updated_callback,
					mesh : m_mesh,
					attitude : attitude
				});
				var last_modified = "";
				var start_time = Date.now();
				var duration = 0;
				var load = function(callback) {
					var timeout = false;
					var succeeded = false;
					var texLoader = new THREE.TextureLoader();
					texLoader.crossOrigin = '*';
					texLoader.load(imageUrl, function(tex) {
						var end_time = Date.now();
						var _duration = end_time - start_time;
						if (_duration != 0) {
							duration = 0.9 * duration + 0.1 * _duration;
							self.fps = 1000.0 / (duration != 0 ? duration : 1);
							start_time = end_time;
						}
						// console.log('Drawing image');
						tex.generateMipmaps = false;// this is for performance
						tex.minFilter = THREE.LinearFilter;// this is for
						tex.anisotropy = maxAnisotropy;
						// performance
						var old = m_mesh.material.map;
						m_mesh.material.map = tex;
						m_mesh.material.needsUpdate = true;
						old.dispose();
						if (!timeout) {
							callback();
							succeeded = true;
						}
					});
					setTimeout(function() {
						if (!succeeded) {
							timeout = true;
							callback();
						}
					}, 5000);
				};
				var check_and_load = function() {
					if (self.checkImageLastUpdate) {
						$.ajax({
							url : imageUrl,
							type : 'HEAD',
						}).done(function(data, status, xhr) {
							var new_last_modified = xhr
								.getResponseHeader('Last-Modified');
							if (new_last_modified == last_modified) {
								setTimeout(function() {
									check_and_load();
								}, self.checkImageDelay);
							} else {
								last_modified = new_last_modified;
								load(check_and_load);
							}
						});
					} else {
						load(check_and_load);
					}
				};
				if (imageUrl) {
					check_and_load();
				}
			};
			if (!default_image_type) {
				default_image_type = splitExt(default_image_url.split('?')[0])[1]
					.toLowerCase();
			}
			switch (default_image_type) {
				case 'video' :
				case 'mp4' :
					m_video = document.createElement('video');
					m_video.crossOrigin = "Anonymous";
					m_video.src = default_image_url;
					m_video.load();
					if (isSmartphone()) {
						m_video
							.addEventListener("canplay", function() {
								console.log("video canplay!");
								m_videoImage = document.createElement('canvas');
								m_videoImage.width = m_video.videoWidth;
								m_videoImage.height = m_video.videoHeight;
								m_videoImageContext = m_videoImage
									.getContext('2d');
								m_videoImageContext.fillStyle = '#000000';
								m_videoImageContext
									.fillRect(0, 0, m_videoImage.width, m_videoImage.height);
								m_videoTexture = new THREE.Texture(m_videoImage);
								setTextureFunc(m_videoTexture);
								m_video
									.removeEventListener("canplay", arguments.callee, false);
							}, false);
					} else {
						m_video.autoplay = true;
						m_video.loop = true;
						m_video.crossOrigin = '*';
						setTextureFunc(new THREE.VideoTexture(m_video));
					}
					break;
				case 'jpg' :
				case 'jpeg' :
				case 'png' :
				case 'image' :
				default :
					var texLoader = new THREE.TextureLoader();
					texLoader.crossOrigin = '*';
					texLoader.load(default_image_url, setTextureFunc);
					break;
			}
		},

		init : function(canvas) {

			m_canvas = canvas;

			m_camera = new THREE.PerspectiveCamera(75, window.innerWidth
				/ window.innerHeight, 1, 1100);
			m_camera.position = new THREE.Vector3(0, 0, 0);
			m_camera.target = new THREE.Vector3(0, 0, -1);
			m_camera.up = new THREE.Vector3(0, 1, 0);
			m_camera.lookAt(m_camera.target);

			m_scene = new THREE.Scene();

			m_renderer = new THREE.WebGLRenderer({
				canvas : m_canvas,
				antialias : true
			});
			m_renderer.setPixelRatio(window.devicePixelRatio);
			m_renderer.setSize(window.innerWidth, window.innerHeight);
			container.appendChild(m_renderer.domElement);

			m_effect = new THREE.StereoEffect(m_renderer);
			m_effect.setSize(window.innerWidth, window.innerHeight);

			onWindowResize();
			window.addEventListener('resize', onWindowResize, false);

			self.setBoard();
		},

		setFov : function(value) {
			if (m_camera) {
				m_camera.fov = value;
				onWindowResize();
			}
		},

		setTextureImg : function(texture) {
			var texture_aspect = texture.width / texture.height;
			var window_aspect = (stereoEnabled
				? window.innerWidth / 2
				: window.innerWidth)
				/ window.innerHeight;
			var aspect = texture_aspect * window_aspect;			
			if (aspect < 1.0) {
				m_mesh.material.uniforms.tex_scalex.value = aspect;
				m_mesh.material.uniforms.tex_scaley.value = 1.0;
			} else {
				m_mesh.material.uniforms.tex_scalex.value = 1.0;
				m_mesh.material.uniforms.tex_scaley.value = 1.0 / aspect;
			}
			
			m_videoTexture.image = texture;
			m_videoTexture.needsUpdate = true;
		},

		setBoard : function() {
			m_videoImage = document.createElement('canvas');
			m_videoImage.width = 512;
			m_videoImage.height = 512;
			m_videoImageContext = m_videoImage.getContext('2d');
			m_videoImageContext.fillStyle = '#000000';
			m_videoImageContext
				.fillRect(0, 0, m_videoImage.width, m_videoImage.height);
			m_videoTexture = new THREE.Texture(m_videoImage);
			m_videoTexture.needsUpdate = true;
			m_videoTexture.generateMipmaps = false;// this is for performance
			m_videoTexture.minFilter = THREE.LinearFilter;// this is for
			m_videoTexture.anisotropy = m_renderer.getMaxAnisotropy();

			var geometry = new THREE.PlaneGeometry(2, 2);// position is
			// x:[-1,1],
			// y:[-1,1]
			loadFile("shader/board.frag?cache=no", function(fragmentShader) {
				loadFile("shader/board.vert?cache=no", function(vertexShader) {
					var material = new THREE.ShaderMaterial({
						vertexShader : vertexShader,
						fragmentShader : fragmentShader,
						uniforms : {
							tex_scalex : {
								type : 'f',
								value : 1
							},
							tex_scaley : {
								type : 'f',
								value : 1
							},
							tex : {
								type : 't',
								value : m_videoTexture
							}
						},
						side : THREE.DoubleSide,
						blending : THREE.NormalBlending,
						transparent : true,
						depthTest : false
					});

					m_mesh = new THREE.Mesh(geometry, material);
					m_mesh.material.needsUpdate = true;
					m_scene.add(m_mesh);
				});
			});
		},

		checkImageLastUpdate : true,

		animate : function(elapsedTime) {
			if (stereoEnabled) {
				m_effect.render(m_scene, m_camera);
			} else {
				m_renderer.render(m_scene, m_camera);
			}
		},

		setStereoEnabled : function(value) {
			stereoEnabled = value;
			onWindowResize();
		}
	};
	return self;
}