uniform sampler2D tex_y;
uniform sampler2D tex_u;
uniform sampler2D tex_v;
uniform mat4 YUV2RGB;

varying vec2 tcoord;

void main(void) {
	if (tcoord.x < 0.0 || tcoord.x > 1.0 || tcoord.y < 0.0 || tcoord.y > 1.0) {
		gl_FragColor = vec4(0, 0, 0, 1);
	} else {
		float y = texture2D(tex_y, vec2(tcoord.x,1.0-tcoord.y)).r;
		float u = texture2D(tex_u, vec2(tcoord.x,1.0-tcoord.y)).r;
		float v = texture2D(tex_v, vec2(tcoord.x,1.0-tcoord.y)).r;
		gl_FragColor = vec4(y, u, v, 1) * YUV2RGB;
	}
}
