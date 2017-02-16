(function(window, document, jQuery) { //The function wrapper prevents leaking variables to global space
    // Setup the namespace for shaders to be added by other plugins at loadtime
    window.OROV = window.OROV || {};
    window.OROV.VideoEffects = window.OROV.VideoEffects || {};
    window.OROV.VideoEffects.shaders = window.OROV.VideoEffects.shaders || {};

    var fragment = `
precision mediump float;

void main() {
  gl_FragColor = vec4(1);
}
`

 

    var vertex = `
attribute float pixelId;

uniform vec2 u_resolution;
uniform sampler2D u_texture;
uniform vec4 u_colorMult;

void main() {
  // based on an id (0, 1, 2, 3 ...) compute the pixel x, y for the source image
  vec2 pixel = vec2(mod(pixelId, u_resolution.x), floor(pixelId / u_resolution.x));
  
  // compute corresponding uv center of that pixel
  vec2 uv = (pixel + 0.5) / u_resolution;
  
  // get the pixels but 0 out channels we don't want
  vec4 color = texture2D(u_texture, uv) * u_colorMult;  
  
  // add up all the channels. Since 3 are zeroed out we'll get just one channel
  float colorSum = color.r + color.g + color.b + color.a;
  
  // set the position to be over a single pixel in the 256x1 destination texture
  gl_Position = vec4((colorSum * 255.0 + 0.5) / 256.0 * 2.0 - 1.0, 0.5, 0, 1);
  
  gl_PointSize = 1.0;
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
        };

        window.OROV.VideoEffects.shaders.Histogram= {
            shader: {
                fragmentShader: fragment,
                vertexShader: vertex,
                uniforms: uniforms
            },
            name: "Histogram"
        }
    });
}(window, document, $));