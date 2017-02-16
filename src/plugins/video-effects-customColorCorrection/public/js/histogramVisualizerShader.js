(function(window, document, jQuery) { //The function wrapper prevents leaking variables to global space
    // Setup the namespace for shaders to be added by other plugins at loadtime
    window.OROV = window.OROV || {};
    window.OROV.VideoEffects = window.OROV.VideoEffects || {};
    window.OROV.VideoEffects.shaders = window.OROV.VideoEffects.shaders || {};

    var fragment = `
precision mediump float;

uniform sampler2D u_histTexture;
uniform vec2 u_resolution;
uniform sampler2D u_maxTexture;

void main() {
  // get the max color constants
  vec4 maxColor = texture2D(u_maxTexture, vec2(0));
  
  // compute our current UV position
  vec2 uv = gl_FragCoord.xy / u_resolution;  
  
  // Get the history for this color 
  // (note: since u_histTexture is 256x1 uv.y is irrelevant
  vec4 hist = texture2D(u_histTexture, uv);
  
  // scale by maxColor so scaled goes from 0 to 1 with 1 = maxColor
  vec4 scaled = hist / maxColor;
  
  // 1 > maxColor, 0 otherwise
  vec4 color = step(uv.yyyy, scaled);
  
  gl_FragColor = vec4(color.rgb, 1);
}
`

 

    var vertex = `
attribute vec4 position;
void main() {
  gl_Position = position;
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

        window.OROV.VideoEffects.shaders.HistogramVisualizer= {
            shader: {
                fragmentShader: fragment,
                vertexShader: vertex,
                uniforms: uniforms
            },
            name: "Histogram"
        }
    });
}(window, document, $));