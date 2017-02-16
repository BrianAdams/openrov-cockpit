(function(window, document, jQuery) { //The function wrapper prevents leaking variables to global space
    // Setup the namespace for shaders to be added by other plugins at loadtime
    window.OROV = window.OROV || {};
    window.OROV.VideoEffects = window.OROV.VideoEffects || {};
    window.OROV.VideoEffects.shaders = window.OROV.VideoEffects.shaders || {};

    var fragment = `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    uniform vec2 aspect;    
    vec2 texel = vec2(1.0 / aspect.x, 1.0 / aspect.y);
    // our texture
    uniform float u_redLow;
    uniform float u_redHigh;
    uniform float u_blueLow;
    uniform float u_blueHigh;
    uniform float u_greenLow;
    uniform float u_greenHigh;
    
    // the texCoords passed in from the vertex shader.

    void main() {
        vec4 color = texture2D(tDiffuse, vUv + texel * vec2(1.0,1.0));
        //Saturate
        if(color[0] < u_redLow) {color[0] = u_redLow;}
        if(color[0] > u_redHigh) {color[0] = u_redHigh;}
        if(color[1] < u_greenLow) {color[1] = u_greenLow;}
        if(color[1] > u_greenHigh) {color[1] = u_greenHigh;}
        if(color[2] < u_blueLow) {color[2] = u_blueLow;}
        if(color[2] > u_blueHigh) {color[2] = u_blueHigh;}
        
        color[0] = (color[0] - u_redLow)/(u_redHigh - u_redLow);
        color[1] = (color[1] - u_greenLow)/(u_greenHigh - u_greenLow);
        color[2] = (color[2] - u_blueLow)/(u_blueHigh - u_blueLow);
        gl_FragColor = color;
    }
`

   var fffragment = `
uniform sampler2D tDiffuse;
varying vec2 vUv;
uniform vec2 aspect;
vec2 texel = vec2(1.0 / aspect.x, 1.0 / aspect.y);
mat3 G[9];
// hard coded matrix values!!!! as suggested in https://github.com/neilmendoza/ofxPostProcessing/blob/master/src/EdgePass.cpp#L45
const mat3 g0 = mat3( 0.3535533845424652, 0, -0.3535533845424652, 0.5, 0, -0.5, 0.3535533845424652, 0, -0.3535533845424652 );
const mat3 g1 = mat3( 0.3535533845424652, 0.5, 0.3535533845424652, 0, 0, 0, -0.3535533845424652, -0.5, -0.3535533845424652 );
const mat3 g2 = mat3( 0, 0.3535533845424652, -0.5, -0.3535533845424652, 0, 0.3535533845424652, 0.5, -0.3535533845424652, 0 );
const mat3 g3 = mat3( 0.5, -0.3535533845424652, 0, -0.3535533845424652, 0, 0.3535533845424652, 0, 0.3535533845424652, -0.5 );
const mat3 g4 = mat3( 0, -0.5, 0, 0.5, 0, 0.5, 0, -0.5, 0 );
const mat3 g5 = mat3( -0.5, 0, 0.5, 0, 0, 0, 0.5, 0, -0.5 );
const mat3 g6 = mat3( 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.6666666865348816, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204 );
const mat3 g7 = mat3( -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, 0.6666666865348816, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408 );
const mat3 g8 = mat3( 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408 );

void main(void)
{
    G[0] = g0,
    G[1] = g1,
    G[2] = g2,
    G[3] = g3,
    G[4] = g4,
    G[5] = g5,
    G[6] = g6,
    G[7] = g7,
    G[8] = g8;
    mat3 I;
    float cnv[9];
    vec3 sample;
    /* fetch the 3x3 neighbourhood and use the RGB vector's length as intensity value */
    for (float i=0.0; i<3.0; i++) {
        for (float j=0.0; j<3.0; j++) {
            sample = texture2D(tDiffuse, vUv + texel * vec2(i-1.0,j-1.0) ).rgb; 
            I[int(i)][int(j)] = 0.2126 * sample.r + 0.7152 * sample.g + 0.0722 * sample.b; //length(sample);
        }
    }
    /* calculate the convolution values for all the masks */
    for (int i=0; i<9; i++) {
        float dp3 = dot(G[i][0], I[0]) + dot(G[i][1], I[1]) + dot(G[i][2], I[2]);
        cnv[i] = dp3 * dp3;
    }
    float M = (cnv[0] + cnv[1]) + (cnv[2] + cnv[3]);
    float S = (cnv[4] + cnv[5]) + (cnv[6] + cnv[7]) + (cnv[8] + M);
    vec4 col  = texture2D(tDiffuse, vUv + texel * vec2(1.0,1.0));
    gl_FragColor = vec4(vec3(0,sqrt(M/S),M/S), 1.0);
}
    `

    var vertex = `
    varying vec2 vUv;

    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;
    void main() {
        // convert the rectangle from pixels to 0.0 to 1.0
        vec2 zeroToOne = a_position / u_resolution;
        // convert from 0->1 to 0->2
        vec2 zeroToTwo = zeroToOne * 2.0;
        // convert from 0->2 to -1->+1 (clipspace)
        vec2 clipSpace = zeroToTwo - 1.0;
        //gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        // pass the texCoord to the fragment shader
        // The GPU will interpolate this value between points.
        v_texCoord = a_texCoord;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );       
    }
`

vertex = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`


    //This should probably be replaced with Brunch/webpack/requies....
    $.getScript('components/three.js/three.min.js', function() {
        var uniforms = {
            "tDiffuse": {
                value: null
            },
            "aspect": {
                value: new THREE.Vector2(512, 512)
            },
            "u_redLow": {value: 0},
            "u_redHigh": {value: 1.0},
            "u_blueLow": {value: 0},
            "u_blueHigh": {value: 1.0},
            "u_greenLow": {value: 0},
            "u_greenHigh": {value: 1.0},                        
        };

        window.OROV.VideoEffects.shaders.ColorCorrection= {
            shader: {
                fragmentShader: fragment,
                vertexShader: vertex,
                uniforms: uniforms
            },
            name: "Color Correction"
        }
    });
}(window, document, $));